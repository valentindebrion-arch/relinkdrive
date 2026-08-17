import { useQuery } from "@tanstack/react-query";
import { Banknote, CreditCard, FileText, Landmark, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHODS } from "@/lib/labels";

/**
 * Source de vérité unique : les clés proviennent de PAYMENT_METHODS (facturation,
 * clôture de course). Aucune liste parallèle n'est créée ici, seulement l'habillage
 * client (icône, libellé de réservation, description courte).
 */
export const PAYMENT_METHOD_OPTIONS = [
  {
    key: "cash",
    label: "Espèces",
    description: "Vous réglez en liquide à la fin de la course.",
    icon: Banknote,
  },
  {
    key: "card",
    label: "Carte bancaire auprès du chauffeur",
    description: "Le chauffeur dispose d'un terminal de paiement à bord.",
    icon: CreditCard,
  },
  {
    key: "transfer",
    label: "Virement",
    description: "Le chauffeur vous transmet ses coordonnées bancaires.",
    icon: Landmark,
  },
  {
    key: "invoice",
    label: "Sur facture",
    description: "Règlement après réception de la facture du chauffeur.",
    icon: FileText,
  },
  {
    key: "other",
    label: "Autre mode convenu avec le chauffeur",
    description: "Lien de paiement ou modalité convenue directement avec lui.",
    icon: Wallet,
  },
] as const;

export type PaymentMethodOption = (typeof PAYMENT_METHOD_OPTIONS)[number];

/** Libellé affiché au client au moment de la réservation. */
export function paymentMethodLabel(key: string | null | undefined) {
  if (!key) return null;
  return (
    PAYMENT_METHOD_OPTIONS.find((o) => o.key === key)?.label ?? PAYMENT_METHODS[key] ?? key
  );
}

export function paymentMethodIcon(key: string | null | undefined) {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.key === key)?.icon ?? Wallet;
}

/** Modes réellement activés par le chauffeur (vérité serveur). */
export function useDriverPaymentMethods(driverId: string | null) {
  return useQuery({
    queryKey: ["driver-payment-methods", driverId],
    enabled: !!driverId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("driver_payment_methods", {
        _driver: driverId!,
      });
      if (error) throw error;
      const keys = (data ?? []) as string[];
      return PAYMENT_METHOD_OPTIONS.filter((o) => keys.includes(o.key));
    },
  });
}
