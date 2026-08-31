/**
 * Sélection éditoriale « Top 10 » : l'administrateur choisit manuellement
 * jusqu'à 10 chauffeurs existants (table driver_profiles) et définit leur ordre.
 * Seule la relation driver_id + position est stockée : aucune donnée de profil
 * n'est dupliquée, la page Client « Trouver » lit toujours le profil réel.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Car,
  ExternalLink,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { PageHeader, EmptyState } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanBadge } from "@/components/admin/SubscriptionAdminCard";
import { StatusBadge } from "@/components/StatusBadge";
import { VERIFICATION_LABELS } from "@/lib/labels";
import { useSignedUrls } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/top10")({
  head: () => ({
    meta: [
      { title: "Top 10 chauffeurs — Administration ReLink" },
      {
        name: "description",
        content:
          "Sélectionnez et ordonnez jusqu'à 10 chauffeurs mis en avant sur la page Trouver de l'espace client ReLink.",
      },
      { property: "og:title", content: "Top 10 chauffeurs — Administration ReLink" },
      {
        property: "og:description",
        content: "Pilotez la sélection éditoriale de chauffeurs affichée côté client.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTop10,
});

const MAX = 10;

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
  verification_status: string;
  vehicle: string | null;
  vehiclePhotoPath: string | null;
};

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

function AdminTop10() {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const directory = useQuery({
    queryKey: ["admin", "drivers", "top10-directory"],
    queryFn: async (): Promise<Driver[]> => {
      const { data: drivers, error } = await supabase
        .from("driver_profiles")
        .select("user_id, slug, city, zone, plan, verification_status, business_name")
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
          verification_status: d.verification_status,
          vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
          vehiclePhotoPath: car?.photo_url ?? null,
        } satisfies Driver;
      });
    },
  });

  const selection = useQuery({
    queryKey: ["admin", "top10"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top10_drivers")
        .select("driver_id, rank_position")
        .order("rank_position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const drivers = useMemo(() => directory.data ?? [], [directory.data]);
  const byId = useMemo(() => new Map(drivers.map((d) => [d.user_id, d])), [drivers]);
  const selected = useMemo(
    () =>
      (selection.data ?? [])
        .map((row) => ({ ...row, driver: byId.get(row.driver_id) ?? null }))
        .filter((row) => !!row.driver),
    [selection.data, byId],
  );
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.driver_id)), [selected]);
  const full = selected.length >= MAX;

  const photos = useSignedUrls("vehicles", [
    ...selected.map((s) => s.driver?.vehiclePhotoPath ?? null),
    ...drivers.map((d) => d.vehiclePhotoPath),
  ]);

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      // On réécrit les positions via des valeurs temporaires pour éviter tout
      // conflit sur l'unicité du chauffeur pendant la réindexation.
      for (const [i, id] of ids.entries()) {
        const { error } = await supabase
          .from("top10_drivers")
          .update({ rank_position: i + 1 })
          .eq("driver_id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "top10"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const add = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase
        .from("top10_drivers")
        .insert({ driver_id: driverId, rank_position: selected.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chauffeur ajouté au Top 10.");
      void qc.invalidateQueries({ queryKey: ["admin", "top10"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase.from("top10_drivers").delete().eq("driver_id", driverId);
      if (error) throw error;
      const rest = selected.filter((s) => s.driver_id !== driverId).map((s) => s.driver_id);
      for (const [i, id] of rest.entries()) {
        await supabase
          .from("top10_drivers")
          .update({ rank_position: i + 1 })
          .eq("driver_id", id);
      }
    },
    onSuccess: () => {
      toast.success("Chauffeur retiré du Top 10. Son compte reste inchangé.");
      void qc.invalidateQueries({ queryKey: ["admin", "top10"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  function move(index: number, delta: number) {
    const ids = selected.map((s) => s.driver_id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    reorder.mutate(next);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = selected.map((s) => s.driver_id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    setDragId(null);
    reorder.mutate(next);
  }

  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers
      .filter((d) => !selectedIds.has(d.user_id))
      .filter((d) =>
        q
          ? [d.full_name, d.business_name, d.email, d.city, d.zone, d.vehicle]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      );
  }, [drivers, selectedIds, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Top 10"
        description="Sélection éditoriale des chauffeurs mis en avant sur la page Trouver de l'espace client."
        action={
          <Button onClick={() => setPickerOpen(true)} disabled={full}>
            <Plus className="size-4" /> Ajouter un chauffeur
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
          {selected.length} / {MAX} chauffeurs sélectionnés
        </span>
        {full ? (
          <span className="text-sm text-muted-foreground">
            Le Top 10 est complet — retirez un chauffeur pour en ajouter un autre.
          </span>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground uppercase">
          Chauffeurs sélectionnés
        </h2>
        {selection.isLoading || directory.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : selected.length === 0 ? (
          <EmptyState
            title="Aucun chauffeur sélectionné"
            description="Ajoutez jusqu'à 10 chauffeurs existants pour alimenter la page Trouver côté client."
          />
        ) : (
          <ol className="space-y-2">
            {selected.map((row, index) => {
              const d = row.driver!;
              const photo = d.vehiclePhotoPath ? (photos.data?.[d.vehiclePhotoPath] ?? null) : null;
              return (
                <li
                  key={d.user_id}
                  draggable
                  onDragStart={() => setDragId(d.user_id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(d.user_id)}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 ${
                    dragId === d.user_id ? "opacity-60" : ""
                  }`}
                >
                  <GripVertical
                    className="size-4 shrink-0 cursor-grab text-muted-foreground"
                    aria-hidden
                  />
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {photo ? (
                      <img
                        src={photo}
                        alt={`Véhicule de ${d.full_name}`}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-muted-foreground">
                        <Car className="size-5" aria-hidden />
                      </span>
                    )}
                  </div>
                  <Avatar name={d.full_name} url={d.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.full_name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[d.vehicle, d.city].filter(Boolean).join(" · ") || "Profil incomplet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PlanBadge plan={d.plan} />
                    <StatusBadge status={d.verification_status} labels={VERIFICATION_LABELS} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Monter"
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Descendre"
                      disabled={index === selected.length - 1 || reorder.isPending}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild aria-label="Fiche admin">
                      <Link to="/admin/chauffeurs/$driverId" params={{ driverId: d.user_id }}>
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(d.user_id)}
                    >
                      <Trash2 className="size-4" /> Retirer du Top 10
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card sm:rounded-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-lg font-bold">Ajouter un chauffeur</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.length} / {MAX} sélectionnés
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer"
                onClick={() => setPickerOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </header>

            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, e-mail, ville ou véhicule"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {full ? (
                <p className="rounded-xl bg-muted p-4 text-center text-sm font-semibold">
                  Le Top 10 est complet. Retirez d'abord un chauffeur pour en ajouter un nouveau.
                </p>
              ) : pickable.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Aucun chauffeur trouvé.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pickable.map((d) => {
                    const photo = d.vehiclePhotoPath
                      ? (photos.data?.[d.vehiclePhotoPath] ?? null)
                      : null;
                    return (
                      <li
                        key={d.user_id}
                        className="flex items-center gap-3 rounded-xl border border-border p-3"
                      >
                        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {photo ? (
                            <img
                              src={photo}
                              alt={`Véhicule de ${d.full_name}`}
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="grid size-full place-items-center text-muted-foreground">
                              <Car className="size-5" aria-hidden />
                            </span>
                          )}
                        </div>
                        <Avatar name={d.full_name} url={d.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{d.full_name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {[d.vehicle, d.city, d.email].filter(Boolean).join(" · ")}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <PlanBadge plan={d.plan} />
                            <StatusBadge
                              status={d.verification_status}
                              labels={VERIFICATION_LABELS}
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={add.isPending}
                          onClick={() => add.mutate(d.user_id)}
                        >
                          <Plus className="size-4" /> Ajouter au Top 10
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
