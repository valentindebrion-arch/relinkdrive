import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { RideCard } from "@/components/RideCard";

export const Route = createFileRoute("/_authenticated/espace/courses/annulees")({
  head: () => ({
    meta: [
      { title: "Courses annulées — Relink" },
      {
        name: "description",
        content: "Consultez la liste complète de vos courses Relink annulées, avec dates, itinéraires et détails.",
      },
      { property: "og:title", content: "Courses annulées — Relink" },
      { property: "og:description", content: "Liste complète de vos trajets Relink annulés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CancelledRides,
});

function CancelledRides() {
  const { user } = useAuth();

  const data = useQuery({
    queryKey: ["client-rides-cancelled", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: rides } = await supabase
        .from("rides")
        .select("*")
        .eq("client_id", user!.id)
        .eq("status", "cancelled")
        .order("scheduled_at", { ascending: false });
      return rides ?? [];
    },
  });

  const rides = data.data ?? [];

  return (
    <div className="overflow-x-hidden">
      <Link
        to="/espace/courses"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes courses
      </Link>
      <PageHeader title="Courses annulées" description="Toutes vos courses annulées." />
      {rides.length === 0 ? (
        <EmptyState title="Aucune course annulée" />
      ) : (
        <div className="space-y-3">
          {rides.map((r) => (
            <RideCard key={r.id} ride={r} />
          ))}
        </div>
      )}
    </div>
  );
}
