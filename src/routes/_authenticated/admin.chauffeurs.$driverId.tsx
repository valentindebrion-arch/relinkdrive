import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminGenderCard,
  AdminHistoryCard,
  AdminTicketsCard,
} from "@/components/admin/AdminSupportCards";
import {
  AdminDriverHoursCard,
  AdminDriverIdentityCard,
  AdminDriverServicesCard,
  AdminDriverShowcaseCard,
  AdminDriverTariffCard,
} from "@/components/admin/AdminDriverEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { DossierReview } from "@/components/admin/DossierReview";
import { SubscriptionAdminCard } from "@/components/admin/SubscriptionAdminCard";
import { DriverActivityCard } from "@/components/admin/DriverActivityCard";
import { VehiclePhotosAdminCard } from "@/components/admin/VehiclePhotosAdminCard";

export const Route = createFileRoute("/_authenticated/admin/chauffeurs/$driverId")({
  head: () => ({
    meta: [
      { title: "Examen du dossier chauffeur — ReLink" },
      {
        name: "description",
        content:
          "Contrôle administratif détaillé d'un dossier chauffeur ReLink : pièces, informations déclarées et décisions.",
      },
      { property: "og:title", content: "Examen du dossier chauffeur — ReLink" },
      {
        property: "og:description",
        content: "Interface de modération des dossiers chauffeurs ReLink.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DossierDetailPage,
});

/** Éligibilité au programme Women for Women : décision administrative uniquement. */
function WomenProgramCard({ driverId }: { driverId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["wfw-eligibility", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_profiles")
        .select("women_for_women_eligible, women_for_women_verified_at")
        .eq("user_id", driverId)
        .maybeSingle();
      return data;
    },
  });

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          women_for_women_eligible: next,
          women_for_women_verified_at: next ? new Date().toISOString() : null,
          women_for_women_verified_by: next ? (user?.id ?? null) : null,
        })
        .eq("user_id", driverId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["wfw-eligibility", driverId] });
      toast.success(next ? "Chauffeuse déclarée éligible." : "Éligibilité retirée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setBusy(false);
    }
  }

  const eligible = Boolean(q.data?.women_for_women_eligible);

  return (
    <section className="surface mb-4 flex items-start justify-between gap-4 p-5">
      <div className="flex gap-3">
        <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Programme Women for Women</p>
          <p className="text-xs text-muted-foreground">
            Autorise le thème de réservation « Women for Women ». Sans cette validation, le thème
            reste indisponible même en modifiant la requête côté chauffeur.
          </p>
          {eligible && q.data?.women_for_women_verified_at ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Vérifié le {new Date(q.data.women_for_women_verified_at).toLocaleDateString("fr-FR")}
            </p>
          ) : null}
        </div>
      </div>
      <Switch
        checked={eligible}
        disabled={busy || q.isLoading}
        onCheckedChange={(v) => void toggle(v)}
        aria-label="Éligibilité Women for Women"
      />
    </section>
  );
}

/** Raccourci vers la vitrine publique réellement servie aux clients. */
function PublicShowcaseLink({ driverId }: { driverId: string }) {
  const { data } = useQuery({
    queryKey: ["admin", "driver-slug", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_profiles")
        .select("slug")
        .eq("user_id", driverId)
        .maybeSingle();
      return data;
    },
  });
  if (!data?.slug) return null;
  return (
    <div className="mb-4">
      <Button asChild size="sm" variant="outline">
        <Link to="/chauffeur/$slug" params={{ slug: data.slug }} target="_blank">
          <ExternalLink className="size-4" /> Voir la vitrine publique
        </Link>
      </Button>
    </div>
  );
}

function DossierDetailPage() {
  const { driverId } = Route.useParams();
  return (
    <>
      <Link
        to="/admin/chauffeurs"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Chauffeurs
      </Link>
      <PublicShowcaseLink driverId={driverId} />
      <SubscriptionAdminCard driverId={driverId} />
      <AdminDriverIdentityCard driverId={driverId} />
      <AdminGenderCard userId={driverId} />
      <AdminDriverShowcaseCard driverId={driverId} />
      <AdminDriverServicesCard driverId={driverId} />
      <AdminDriverHoursCard driverId={driverId} />
      <AdminDriverTariffCard driverId={driverId} />
      <DriverActivityCard driverId={driverId} />
      <VehiclePhotosAdminCard driverId={driverId} />
      <WomenProgramCard driverId={driverId} />
      <DossierReview driverId={driverId} />
      <AdminTicketsCard userId={driverId} />
      <AdminHistoryCard userId={driverId} />
    </>
  );
}
