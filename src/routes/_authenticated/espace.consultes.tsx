import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchConnectedProfiles } from "@/lib/connected-profiles";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";

export const Route = createFileRoute("/_authenticated/espace/consultes")({
  head: () => ({
    meta: [
      { title: "Chauffeurs récemment consultés — Relink" },
      {
        name: "description",
        content:
          "Retrouvez rapidement les profils de chauffeurs VTC que vous avez consultés récemment sur ReLink.",
      },
      { property: "og:title", content: "Chauffeurs récemment consultés — Relink" },
      { property: "og:description", content: "Vos dernières consultations de profils chauffeurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecentlyViewed,
});

function RecentlyViewed() {
  const { user } = useAuth();

  const data = useQuery({
    queryKey: ["recent-driver-views", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: views, error } = await supabase
        .from("driver_profile_views")
        .select("driver_id, viewed_at")
        .eq("client_id", user!.id)
        .order("viewed_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const ids = (views ?? []).map((v) => v.driver_id);
      if (!ids.length) return [];

      const [profiles, { data: dprofiles }] = await Promise.all([
        fetchConnectedProfiles(ids),
        supabase.rpc("get_connected_driver_profiles"),
      ]);

      return (views ?? []).map((v) => {
        const p = (profiles ?? []).find((x) => x.id === v.driver_id);
        const dp = (dprofiles ?? []).find((x) => x.user_id === v.driver_id);
        return {
          id: v.driver_id,
          viewedAt: v.viewed_at,
          name: dp?.business_name || p?.full_name || "Chauffeur",
          avatar: p?.avatar_url ?? null,
          city: dp?.city ?? null,
          slug: dp?.slug ?? null,
        };
      });
    },
  });

  const list = data.data ?? [];

  return (
    <div className="overflow-x-hidden">
      <PageHeader
        title="Récemment consultés"
        description="Les profils chauffeurs que vous avez ouverts récemment."
      />

      {list.length === 0 ? (
        <EmptyState
          title="Aucune consultation récente"
          description="Les profils que vous ouvrez depuis l'annuaire ou un QR code apparaîtront ici."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((d) => (
            <li key={d.id}>
              {d.slug ? (
                <Link
                  to="/chauffeur/$slug"
                  params={{ slug: d.slug }}
                  className="surface flex items-center gap-3 p-3 hover:bg-muted/40"
                >
                  {d.avatar ? (
                    <img
                      src={d.avatar}
                      alt=""
                      loading="lazy"
                      className="size-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {d.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(d.viewedAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                      })}
                      {d.city ? ` · ${d.city}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
