/**
 * Connexion du chauffeur à SA plateforme agréée.
 *
 * Les secrets ne transitent jamais par cette table : seule une référence
 * opaque (`credentials_reference`) est conservée, le secret réel étant détenu
 * par le fournisseur ou un coffre serveur. Rien n'est jamais affiché en clair.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProvider, type ConnectionContext, type ProviderEnvironment } from "@/lib/einvoicing/provider";

export type EInvoicingConnection = {
  id: string;
  driver_id: string;
  company_id: string | null;
  provider_key: string;
  environment: ProviderEnvironment;
  external_account_id: string | null;
  electronic_billing_address: string | null;
  connection_status: "not_connected" | "pending" | "connected" | "expired" | "error";
  reception_enabled: boolean;
  emission_enabled: boolean;
  transaction_reporting_enabled: boolean;
  payment_reporting_enabled: boolean;
  auto_reporting_enabled: boolean;
  credentials_reference: string | null;
  last_error_message: string | null;
  connected_at: string | null;
  last_verified_at: string | null;
  last_sync_at: string | null;
};

export const CONNECTION_STATUS_LABELS: Record<EInvoicingConnection["connection_status"], string> = {
  not_connected: "Non connectée",
  pending: "Raccordement en cours",
  connected: "Connectée",
  expired: "Connexion expirée",
  error: "Erreur de connexion",
};

export function connectionContext(c: EInvoicingConnection): ConnectionContext {
  return {
    providerKey: c.provider_key,
    environment: c.environment,
    externalAccountId: c.external_account_id,
    electronicBillingAddress: c.electronic_billing_address,
    credentialsReference: c.credentials_reference,
  };
}

/** Connexion active du chauffeur (une seule à la fois côté interface). */
export function useEinvoicingConnection(driverId?: string) {
  return useQuery({
    queryKey: ["einvoicing-connection", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("e_invoicing_connections")
        .select("*")
        .eq("driver_id", driverId!)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EInvoicingConnection | null;
    },
  });
}

export function useConnectionMutations(driverId?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["einvoicing-connection", driverId] });

  const connect = useMutation({
    mutationFn: async (input: {
      providerKey: string;
      environment: ProviderEnvironment;
      externalAccountId?: string | null;
      electronicBillingAddress?: string | null;
      credentialsReference?: string | null;
    }) => {
      if (!driverId) throw new Error("Session expirée");
      const provider = getProvider(input.providerKey);
      if (input.environment === "production" && provider.simulation)
        throw new Error("Un connecteur de test ne peut pas être utilisé en production.");
      const res = await provider.connect({
        providerKey: provider.key,
        environment: input.environment,
        externalAccountId: input.externalAccountId ?? null,
        electronicBillingAddress: input.electronicBillingAddress ?? null,
        credentialsReference: input.credentialsReference ?? null,
      });
      const { error } = await supabase.from("e_invoicing_connections").upsert(
        {
          driver_id: driverId,
          provider_key: provider.key,
          environment: input.environment,
          external_account_id: input.externalAccountId ?? null,
          electronic_billing_address: input.electronicBillingAddress ?? null,
          credentials_reference: input.credentialsReference ?? null,
          connection_status: res.status,
          reception_enabled: provider.supportsReception,
          emission_enabled: true,
          transaction_reporting_enabled: provider.supportsTransactionReporting,
          payment_reporting_enabled: provider.supportsPaymentReporting,
          connected_at: res.status === "connected" ? new Date().toISOString() : null,
          last_verified_at: new Date().toISOString(),
          last_error_message: res.status === "error" ? (res.message ?? null) : null,
        },
        { onConflict: "driver_id,provider_key,environment" },
      );
      if (error) throw error;
      return res;
    },
    onSuccess: invalidate,
  });

  const test = useMutation({
    mutationFn: async (connection: EInvoicingConnection) => {
      const provider = getProvider(connection.provider_key);
      const res = await provider.testConnection(connectionContext(connection));
      await supabase
        .from("e_invoicing_connections")
        .update({
          connection_status: res.ok ? "connected" : "error",
          last_verified_at: new Date().toISOString(),
          last_error_message: res.ok ? null : res.message,
        })
        .eq("id", connection.id);
      return res;
    },
    onSuccess: invalidate,
  });

  const sync = useMutation({
    mutationFn: async (connection: EInvoicingConnection) => {
      await supabase
        .from("e_invoicing_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", connection.id);
    },
    onSuccess: invalidate,
  });

  const disconnect = useMutation({
    mutationFn: async (connection: EInvoicingConnection) => {
      await getProvider(connection.provider_key).disconnect(connectionContext(connection));
      const { error } = await supabase.from("e_invoicing_connections").delete().eq("id", connection.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; values: Partial<EInvoicingConnection> }) => {
      const { error } = await supabase
        .from("e_invoicing_connections")
        .update(input.values as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { connect, test, sync, disconnect, update };
}
