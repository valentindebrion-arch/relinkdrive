/**
 * Contrôle de publication des chauffeurs sur ReLink.
 *
 * Chaque chauffeur inscrit est publié automatiquement : cette page permet
 * uniquement de retirer un profil de ReLink (dépublication réversible) ou de
 * le remettre en ligne. Le statut réel est stocké dans
 * `driver_profiles.page_published` et contrôlé côté serveur par toutes les
 * lectures publiques (recherche, vitrine, QR code, carnet client).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Car, ExternalLink, EyeOff, RotateCcw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { PageHeader, EmptyState } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanBadge } from "@/components/admin/SubscriptionAdminCard";
import { useSignedUrls } from "@/lib/storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/top10")({
  head: () => ({
    meta: [
      { title: "Chauffeurs publiés — Administration ReLink" },
      {
        name: "description",
        content:
          "Contrôlez la publication des chauffeurs sur ReLink : retirer un profil du réseau ou le remettre en ligne.",
      },
      { property: "og:title", content: "Chauffeurs publiés — Administration ReLink" },
      {
        property: "og:description",
        content: "Publication et retrait des vitrines chauffeurs ReLink.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDriverPublication,
});

type Driver = {
  user_id: string;
  slug: string;
  full_name: string;
  business_name: string | null;
  email: string | null;
  city: string | null;
  zone: string | null;
  avatar_url: string | null;
  plan: "free" | "pro";
  published: boolean;
  vehicle: string | null;
  vehiclePhotoPath: string | null;
};

type Filter = "all" | "published" | "removed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "published", label: "Publiés" },
  { key: "removed", label: "Retirés" },
];

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url)
    return (
      <AvatarPhoto url={url} name={name} className="size-10 shrink-0 rounded-full object-cover" />
    );
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
      {initials(name)}
    </span>
  );
}

function PublicationBadge({ published }: { published: boolean }) {
  return (
    <span
      className={
        "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (published
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive")
      }
    >
      {published ? "Publié" : "Retiré"}
    </span>
  );
}

function AdminDriverPublication() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<Driver | null>(null);

  const directory = useQuery({
    queryKey: ["admin", "drivers", "publication"],
    queryFn: async (): Promise<Driver[]> => {
      const { data: drivers, error } = await supabase
        .from("driver_profiles")
        .select("user_id, slug, city, zone, plan, page_published, business_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (drivers ?? []).map((d) => d.user_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: vehicles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", ids),
        supabase
          .from("vehicles")
          .select("driver_id, brand, model, photo_url, is_primary")
          .in("driver_id", ids),
      ]);
      return (drivers ?? []).map((d) => {
        const p = (profiles ?? []).find((x) => x.id === d.user_id);
        const car =
          (vehicles ?? []).find((v) => v.driver_id === d.user_id && v.is_primary) ??
          (vehicles ?? []).find((v) => v.driver_id === d.user_id);
        return {
          user_id: d.user_id,
          slug: d.slug,
          full_name: p?.full_name || d.business_name || "Chauffeur",
          business_name: d.business_name,
          email: p?.email ?? null,
          city: d.city,
          zone: d.zone,
          avatar_url: p?.avatar_url ?? null,
          plan: d.plan === "pro" ? "pro" : "free",
          published: Boolean(d.page_published),
          vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
          vehiclePhotoPath: car?.photo_url ?? null,
        } satisfies Driver;
      });
    },
  });

  const drivers = useMemo(() => directory.data ?? [], [directory.data]);
  const photos = useSignedUrls(
    "vehicles",
    drivers.map((d) => d.vehiclePhotoPath),
  );

  const setPublished = useMutation({
    mutationFn: async ({ driverId, published }: { driverId: string; published: boolean }) => {
      const { error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>
      )("admin_set_driver_published", {
        _driver: driverId,
        _published: published,
        _reason: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, v) => {
      toast.success(
        v.published
          ? "Chauffeur remis sur ReLink."
          : "Chauffeur retiré de ReLink. Son compte reste inchangé.",
      );
      void qc.invalidateQueries({ queryKey: ["admin", "drivers", "publication"] });
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers
      .filter((d) =>
        filter === "all" ? true : filter === "published" ? d.published : !d.published,
      )
      .filter((d) =>
        q
          ? [d.full_name, d.business_name, d.email, d.city, d.zone, d.vehicle]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      );
  }, [drivers, filter, search]);

  const publishedCount = drivers.filter((d) => d.published).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chauffeurs"
        description="Chauffeurs publiés sur ReLink. Un chauffeur dont l'inscription est complète est publié automatiquement ; le retrait est une action de modération réversible."
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
          {publishedCount} publié{publishedCount > 1 ? "s" : ""}
        </span>
        <span className="text-sm text-muted-foreground">
          {drivers.length - publishedCount} retiré{drivers.length - publishedCount > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un nom, un e-mail, une ville…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs ${filter === f.key ? "border-primary bg-accent" : "border-border text-muted-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {directory.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          title="Aucun chauffeur"
          description="Aucun chauffeur ne correspond à cette recherche."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => (
            <li
              key={d.user_id}
              className="surface flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap"
            >
              <Avatar name={d.full_name} url={d.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{d.full_name}</p>
                  <PublicationBadge published={d.published} />
                  <PlanBadge plan={d.plan} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[d.city || d.zone, d.email].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Car className="size-3" /> {d.vehicle ?? "Véhicule non renseigné"}
                </p>
              </div>
              {photos.data?.[drivers.findIndex((x) => x.user_id === d.user_id)] ? (
                <img
                  src={photos.data[drivers.findIndex((x) => x.user_id === d.user_id)] ?? ""}
                  alt={`Véhicule de ${d.full_name}`}
                  className="hidden h-14 w-24 rounded-lg object-cover sm:block"
                  loading="lazy"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/chauffeur/$slug" params={{ slug: d.slug }} target="_blank">
                    <ExternalLink className="size-4" /> Vitrine
                  </Link>
                </Button>
                {d.published ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={setPublished.isPending}
                    onClick={() => setPending(d)}
                  >
                    <EyeOff className="size-4" /> Retirer de ReLink
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={setPublished.isPending}
                    onClick={() => setPending(d)}
                  >
                    <RotateCcw className="size-4" /> Remettre sur ReLink
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.published
                ? "Retirer ce chauffeur de ReLink ?"
                : "Remettre ce chauffeur sur ReLink ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.published
                ? "Le chauffeur ne sera plus visible par les clients et sa vitrine publique deviendra inaccessible. Vous pourrez le republier ultérieurement."
                : "Le chauffeur redeviendra visible sur ReLink : recherche, chauffeurs autour de vous, vitrine publique et QR code."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pending) return;
                setPublished.mutate({
                  driverId: pending.user_id,
                  published: !pending.published,
                });
                setPending(null);
              }}
            >
              {pending?.published ? "Retirer de ReLink" : "Remettre sur ReLink"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
