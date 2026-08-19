import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BillingCustomerKind = "individual" | "company_fr" | "company_foreign";
export type PaymentTerms = "immediate" | "on_receipt" | "net_days";

export type BillingCustomer = {
  id: string;
  driver_id: string;
  client_id: string | null;
  kind: BillingCustomerKind;
  display_name: string;
  legal_name: string | null;
  siren: string | null;
  vat_number: string | null;
  foreign_tax_id: string | null;
  country_code: string;
  billing_address: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  po_number: string | null;
  internal_ref: string | null;
  payment_terms: PaymentTerms;
  payment_terms_days: number | null;
  archived_at: string | null;
};

export const CUSTOMER_KIND_LABELS: Record<BillingCustomerKind, string> = {
  individual: "Particulier",
  company_fr: "Entreprise française",
  company_foreign: "Entreprise étrangère",
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  immediate: "Paiement immédiat",
  on_receipt: "À réception de facture",
  net_days: "Délai en jours",
};

/** Vérification locale du SIREN (Luhn) — le contrôle définitif reste côté base. */
export function isValidSiren(value: string) {
  const s = value.replace(/\s/g, "");
  if (!/^\d{9}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(s[8 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function useBillingCustomers(driverId?: string, includeArchived = false) {
  return useQuery({
    queryKey: ["billing-customers", driverId, includeArchived],
    enabled: !!driverId,
    queryFn: async () => {
      let q = supabase
        .from("billing_customers")
        .select("*")
        .eq("driver_id", driverId!)
        .order("display_name");
      if (!includeArchived) q = q.is("archived_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BillingCustomer[];
    },
  });
}
