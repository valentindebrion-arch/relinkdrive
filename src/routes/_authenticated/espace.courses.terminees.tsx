import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { RideCard } from "@/components/RideCard";

export const Route = createFileRoute("/_authenticated/espace/courses/terminees")({
  head: () => ({
    meta: [
      { title: "Courses terminées — Relink" },
      {
        name: "description",
        content: "Retrouvez l'historique complet de vos courses Relink terminées, avec leurs prix et leurs factures.",
      },
      { property: "og:title", content: "Courses terminées — Relink" },
      { property: "og:description", content: "Historique complet de vos trajets Relink terminés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompletedRides,
});

function CompletedRides() {
  const { user } = useAuth();

  const data = useQuery({
    queryKey: ["client-rides-completed", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: rides }, { data: invoices }] = await Promise.all([
        supabase
          .from("rides")
          .select("*")
          .eq("client_id", user!.id)
          .eq("status", "completed")
          .order("scheduled_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", user!.id),
      ]);
      return { rides: rides ?? [], invoices: invoices ?? [] };
    },
  });

  const rides = data.data?.rides ?? [];
  const invoices = data.data?.invoices ?? [];

  return (
    <div className="overflow-x-hidden">
      <Link
        to="/espace/courses"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes courses
      </Link>
      <PageHeader title="Courses terminées" description="Toutes vos courses effectuées." />
      {rides.length === 0 ? (
        <EmptyState title="Aucune course terminée" />
      ) : (
        <div className="space-y-3">
          {rides.map((r) => (
            <RideCard key={r.id} ride={r} invoice={invoices.find((i) => i.ride_id === r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
