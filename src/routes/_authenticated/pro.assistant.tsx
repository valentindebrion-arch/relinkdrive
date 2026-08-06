import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyVehicle, useMyDocuments } from "@/lib/driver-queries";
import { PageHeader } from "@/components/Ui";
import { DOCUMENT_LABELS, formatDate, formatEuro } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/pro/assistant")({
  component: AssistantPage,
});

type Tip = { title: string; body: string; to?: string; cta?: string; tone: "info" | "warn" };

function AssistantPage() {
  const { user } = useAuth();
  const driver = useDriverProfile();
  const vehicle = useMyVehicle();
  const docs = useMyDocuments();

  const data = useQuery({
    queryKey: ["assistant", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: rides }, { data: invoices }, { data: requests }, { data: conns }] = await Promise.all([
        supabase.from("rides").select("*").eq("driver_id", user!.id).eq("is_block", false),
        supabase.from("invoices").select("*").eq("driver_id", user!.id),
        supabase.from("ride_requests").select("*").eq("driver_id", user!.id),
        supabase.from("driver_client_connections").select("*").eq("driver_id", user!.id),
      ]);
      return { rides: rides ?? [], invoices: invoices ?? [], requests: requests ?? [], conns: conns ?? [] };
    },
  });

  const tips: Tip[] = [];
  const soon = (d?: string | null) => d && new Date(d).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45;

  if (driver.data && driver.data.verification_status !== "verified") {
    tips.push({
      title: "Finalisez votre vérification",
      body: "Tant que votre dossier n'est pas validé, votre page publique reste inactive.",
      to: "/pro/verification",
      cta: "Compléter mon dossier",
      tone: "warn",
    });
  }
  if (!vehicle.data) {
    tips.push({
      title: "Ajoutez votre véhicule",
      body: "Les clients choisissent plus facilement un chauffeur dont ils voient le véhicule et les équipements.",
      to: "/pro/vehicule",
      cta: "Renseigner mon véhicule",
      tone: "info",
    });
  }
  if (soon(vehicle.data?.insurance_expires_at)) {
    tips.push({
      title: "Assurance bientôt expirée",
      body: `Échéance le ${formatDate(vehicle.data?.insurance_expires_at)}. Pensez à renouveler et à mettre à jour votre justificatif.`,
      to: "/pro/verification",
      cta: "Mettre à jour",
      tone: "warn",
    });
  }
  if (soon(vehicle.data?.inspection_expires_at)) {
    tips.push({
      title: "Contrôle technique à prévoir",
      body: `Échéance le ${formatDate(vehicle.data?.inspection_expires_at)}.`,
      tone: "warn",
    });
  }
  (docs.data ?? []).forEach((d) => {
    if (d.status === "rejected") {
      tips.push({
        title: `${DOCUMENT_LABELS[d.doc_type] ?? d.doc_type} refusé`,
        body: d.review_note ?? "Un administrateur demande une nouvelle version de ce document.",
        to: "/pro/verification",
        cta: "Renvoyer le document",
        tone: "warn",
      });
    }
  });

  const invoices = data.data?.invoices ?? [];
  const unpaid = invoices.filter((i) => i.status === "sent");
  if (unpaid.length) {
    tips.push({
      title: `${unpaid.length} facture(s) en attente de paiement`,
      body: `Total à relancer : ${formatEuro(unpaid.reduce((s, i) => s + Number(i.amount_ttc), 0))}.`,
      to: "/pro/factures",
      cta: "Voir les factures",
      tone: "info",
    });
  }
  const completedWithoutInvoice = (data.data?.rides ?? []).filter(
    (r) => r.status === "completed" && !invoices.some((i) => i.ride_id === r.id),
  );
  if (completedWithoutInvoice.length) {
    tips.push({
      title: "Courses sans facture",
      body: `${completedWithoutInvoice.length} course(s) terminée(s) n'ont pas encore de facture.`,
      to: "/pro/courses",
      cta: "Facturer",
      tone: "info",
    });
  }
  const pendingRequests = (data.data?.requests ?? []).filter((r) => r.status === "new");
  if (pendingRequests.length) {
    tips.push({
      title: "Demandes sans réponse",
      body: `${pendingRequests.length} demande(s) attendent votre réponse. Répondre vite augmente la fidélisation.`,
      to: "/pro/demandes",
      cta: "Répondre",
      tone: "warn",
    });
  }
  const inactive = (data.data?.conns ?? []).filter((c) => c.crm_status === "inactive");
  if (inactive.length) {
    tips.push({
      title: "Clients inactifs",
      body: `${inactive.length} client(s) n'ont pas réservé depuis longtemps : un message peut les relancer.`,
      to: "/pro/clients",
      cta: "Voir mes clients",
      tone: "info",
    });
  }
  if ((data.data?.conns.length ?? 0) < 10) {
    tips.push({
      title: "Développez votre carnet",
      body: "Présentez votre QR code à la fin de chaque course : c'est le moment où le client est le plus réceptif.",
      to: "/pro/qr",
      cta: "Afficher mon QR code",
      tone: "info",
    });
  }

  return (
    <>
      <PageHeader title="Assistant" description="Des recommandations simples basées sur votre activité réelle." />
      {tips.length === 0 ? (
        <div className="surface p-6 text-sm text-muted-foreground">
          Tout est à jour. Continuez à partager votre QR code après chaque course.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tips.map((t) => (
            <div
              key={t.title}
              className={`surface p-5 ${t.tone === "warn" ? "border-warning/40 bg-warning/5" : ""}`}
            >
              <h2 className="font-semibold">{t.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
              {t.to ? (
                <Link to={t.to} className="mt-3 inline-block text-sm font-medium text-primary">
                  {t.cta} →
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
