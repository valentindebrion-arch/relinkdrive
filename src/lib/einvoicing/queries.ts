import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntityCategory } from "@/lib/einvoicing/spec";

export type CompanyEinvoicing = {
  id: string;
  legal_name: string | null;
  siren: string | null;
  entity_category: EntityCategory;
  entity_category_source: string;
  anticipation_opt_in: boolean;
  einvoicing_opt_in: boolean;
  einvoicing_address: string | null;
  receive_enabled: boolean;
  issue_enabled: boolean;
  ereporting_enabled: boolean;
  obligation_start_on: string | null;
  pa_provider: string | null;
  pa_status: string;
  pa_environment: string;
  vat_on_debits: boolean;
};

export function useCompanyEinvoicing(driverId?: string) {
  return useQuery({
    queryKey: ["company-einvoicing", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("driver_id", driverId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as CompanyEinvoicing | null;
    },
  });
}

export type EinvoiceRow = {
  id: string;
  number: string | null;
  document_type: string;
  status: string;
  issued_on: string;
  service_date: string | null;
  due_on: string | null;
  amount_ht: number;
  amount_ttc: number;
  amount_due: number | null;
  vat_rate: number;
  customer_kind: string;
  customer_snapshot: Record<string, unknown> | null;
  issuer_snapshot: Record<string, unknown> | null;
  routing_channel: string;
  transmission_status: string;
  transmission_error: string | null;
  transmitted_at: string | null;
  documents_generated_at: string | null;
  facturx_profile: string | null;
  facturx_spec_version: string | null;
  legacy_pre_reform: boolean;
  pdf_path: string | null;
  structured_path: string | null;
  ride_id: string | null;
};

export function useEinvoices(driverId?: string) {
  return useQuery({
    queryKey: ["einvoices", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("driver_id", driverId!)
        .not("number", "is", null)
        .order("issued_on", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as EinvoiceRow[];
    },
  });
}

export type InvoiceDocumentRow = {
  id: string;
  invoice_id: string;
  kind: string;
  path: string;
  sha256: string;
  byte_size: number | null;
  spec_version: string | null;
  profile: string | null;
  generated_at: string;
};

export function useInvoiceDocuments(invoiceId?: string | null) {
  return useQuery({
    queryKey: ["invoice-documents", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_documents")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("generated_at");
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceDocumentRow[];
    },
  });
}

export type TransmissionRow = {
  id: string;
  invoice_id: string;
  channel: string;
  direction: string;
  status: string;
  pa_provider: string | null;
  external_id: string | null;
  ack_code: string | null;
  ack_message: string | null;
  occurred_at: string;
};

export function useInvoiceTransmissions(invoiceId?: string | null) {
  return useQuery({
    queryKey: ["invoice-transmissions", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_transmissions")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TransmissionRow[];
    },
  });
}
