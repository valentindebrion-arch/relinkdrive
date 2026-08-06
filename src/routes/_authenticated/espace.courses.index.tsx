import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { RideCard } from "@/components/RideCard";

export const Route = createFileRoute("/_authenticated/espace/courses/")({
  head: () => ({
    meta: [
      { title: "Mes courses — Relink" },
      {
        name: "description",
        content:
          "Suivez vos trajets Relink en cours, retrouvez vos courses terminées et vos courses annulées avec leurs factures.",
      },
      { property: "og:title", content: "Mes courses — Relink" },
      { property: "og:description", content: "Trajets en cours, terminés et annulés avec leurs factures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientRides,
});

function Section({
  title,
  count,
  to,
  children,
}: {
  title: string;
  count: number;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {title} <span className="text-muted-foreground">({count})</span>
        </h2>
        {count > 3 ? (
          <Link to={to} className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
            Voir tout <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ClientRides() {
  const { user } = useAuth();

  const data = useQuery({
    queryKey: ["client-rides", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: rides }, { data: invoices }] = await Promise.all([
        supabase.from("rides").select("*").eq("client_id", user!.id).order("scheduled_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", user!.id),
      ]);
      return { rides: rides ?? [], invoices: invoices ?? [] };
    },
  });

  const rides = data.data?.rides ?? [];
  const invoices = data.data?.invoices ?? [];
  const invoiceFor = (id: string) => invoices.find((i) => i.ride_id === id);

  const ongoing = rides.filter((r) => !["completed", "cancelled"].includes(r.status));
  const completed = rides.filter((r) => r.status === "completed");
  const cancelled = rides.filter((r) => r.status === "cancelled");

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader title="Mes courses" description="Historique et suivi de vos trajets." />

      <Link
        to="/espace/courses/demandes"
        className="surface flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        <span className="font-medium">Mes demandes</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      {rides.length === 0 ? (
        <EmptyState title="Aucune course" description="Vos courses confirmées apparaîtront ici." />
      ) : (
        <>
          {ongoing.length > 0 ? (
            <section>
              <h2 className="mb-2 text-base font-semibold">En cours et à venir</h2>
              <div className="space-y-3">
                {ongoing.map((r) => (
                  <RideCard key={r.id} ride={r} invoice={invoiceFor(r.id)} />
                ))}
              </div>
            </section>
          ) : null}

          {completed.length > 0 ? (
            <Section title="Fin de course" count={completed.length} to="/espace/courses/terminees">
              {completed.slice(0, 3).map((r) => (
                <RideCard key={r.id} ride={r} invoice={invoiceFor(r.id)} />
              ))}
            </Section>
          ) : null}

          {cancelled.length > 0 ? (
            <Section title="Courses annulées" count={cancelled.length} to="/espace/courses/annulees">
              {cancelled.slice(0, 3).map((r) => (
                <RideCard key={r.id} ride={r} invoice={invoiceFor(r.id)} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
