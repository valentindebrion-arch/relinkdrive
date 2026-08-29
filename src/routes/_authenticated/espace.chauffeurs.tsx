import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Car, Check, Compass, MapPin, Plus, Search, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchConnectedProfile, fetchConnectedProfiles } from "@/lib/connected-profiles";
import { useAuth } from "@/lib/auth";
import { AddDriverSheet } from "@/components/client/AddDriverSheet";
import { ClientTopBar } from "@/components/client/ClientTopBar";
import { useSignedUrls } from "@/lib/storage";
import {
  prefersReducedMotion,
  takeDriverCelebration,
  type DriverCelebration,
} from "@/lib/driver-celebration";
import { WFW_LABEL } from "@/lib/woman-for-woman";
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

export const Route = createFileRoute("/_authenticated/espace/chauffeurs")({
  component: ClientDrivers,
});

function initials(name?: string | null) {
  return (
    (name ?? "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function ClientDrivers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [wfwOnly, setWfwOnly] = useState(false);
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<{ id: string; name: string } | null>(null);

  // Suite de l'animation d'ajout : la carte arrive dans la liste.
  const [celebration, setCelebration] = useState<DriverCelebration | null>(null);
  useEffect(() => {
    const c = takeDriverCelebration();
    if (!c) return;
    setCelebration(c);
    const t = window.setTimeout(() => setCelebration(null), 3200);
    return () => window.clearTimeout(t);
  }, []);

  // Temps réel : le statut Disponible / Indisponible se met à jour sans rechargement.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("client-drivers-availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["client-drivers", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const drivers = useQuery({
    queryKey: ["client-drivers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: conns } = await supabase
        .from("driver_client_connections")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (conns ?? []).map((c) => c.driver_id);
      if (!ids.length) return [];
      const [{ data: profiles }, { data: dprofiles }, { data: vehicles }] = await Promise.all([
        fetchConnectedProfiles(ids).then((data) => ({ data })),
        supabase.rpc("get_connected_driver_profiles"),
        // Le client ne reçoit que les champs affichés : jamais la plaque ni les données administratives.
        supabase
          .from("vehicles")
          .select("driver_id, brand, model, is_primary, photo_url, photo_side_url")
          .in("driver_id", ids),
      ]);

      return Promise.all(
        (conns ?? []).map(async (c) => {
          const profile = (profiles ?? []).find((p) => p.id === c.driver_id);
          const dp = (dprofiles ?? []).find((d) => d.user_id === c.driver_id);
          const car =
            (vehicles ?? []).find((v) => v.driver_id === c.driver_id && v.is_primary) ??
            (vehicles ?? []).find((v) => v.driver_id === c.driver_id);
          const ratingAvg: number | null = null;
          return {
            id: c.driver_id,
            name: dp?.business_name || profile?.full_name || "Chauffeur",
            avatarUrl: profile?.avatar_url ?? null,
            available: !!dp?.on_duty && dp?.accepting_requests !== false,
            vehicle: car ? [car.brand, car.model].filter(Boolean).join(" ") || null : null,
            photoPath: car?.photo_side_url ?? car?.photo_url ?? null,
            zone: dp?.city || dp?.zone || null,
            slug: dp?.slug ?? null,
            trips: 0,
            ratingAvg,
            ratingCount: 0,
            womanForWoman:
              (dp as { woman_for_woman?: boolean } | undefined)?.woman_for_woman ?? false,
          };
        }),
      );
    },
  });

  const list = useMemo(() => drivers.data ?? [], [drivers.data]);
  const photos = useSignedUrls(
    "vehicles",
    list.map((d) => d.photoPath),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Le filtre Woman for Woman s'applique dès les résultats : aucun chauffeur
    // non compatible n'est proposé puis bloqué à la réservation.
    const base = wfwOnly ? list.filter((d) => d.womanForWoman) : list;
    if (!q) return base;
    return base.filter((d) =>
      [d.name, d.vehicle, d.zone].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [list, search, wfwOnly]);

  /**
   * Retrait du carnet : suppression backend d'abord, puis animation rouge de sortie.
   * En cas d'échec, la carte reste en place et une erreur est affichée.
   * Après l'animation, redirection automatique vers l'Accueil client (/espace).
   */
  async function removeDriver(driverId: string, name: string) {
    if (!user?.id || removingId) return;
    const firstName = name.split(" ")[0] || "Le chauffeur";
    const { error } = await supabase
      .from("driver_client_connections")
      .delete()
      .eq("client_id", user.id)
      .eq("driver_id", driverId);
    if (error) {
      toast.error("Le retrait a échoué. Réessayez dans un instant.");
      return;
    }
    const finish = () => {
      void queryClient.invalidateQueries({ queryKey: ["client-drivers", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["discover-drivers"] });
      void queryClient.invalidateQueries({ queryKey: ["top10-drivers"] });
      toast.success(`${firstName} a été retiré de vos chauffeurs`);
      // Navigation interne vers l'Accueil client une fois l'animation terminée.
      void navigate({ to: "/espace" });
    };
    setRemovingId(driverId);
    window.setTimeout(finish, prefersReducedMotion() ? 220 : 1500);
  }

  return (
    <div className="w-full max-w-full pb-4">
      <ClientTopBar />

      <header className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-black tracking-tight">Mes chauffeurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre carnet personnel de chauffeurs de confiance.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
          <Users className="size-3.5" aria-hidden /> {list.length}
        </span>
      </header>

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-extrabold text-primary-foreground transition active:scale-[0.985]"
      >
        <Plus className="size-5" /> Ajouter un chauffeur
      </button>

      {list.length >= 4 ? (
        <label className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un chauffeur"
            className="w-full bg-transparent text-sm font-semibold outline-none"
          />
        </label>
      ) : null}

      {list.some((d) => d.womanForWoman) ? (
        <button
          type="button"
          aria-pressed={wfwOnly}
          onClick={() => setWfwOnly((v) => !v)}
          className={
            "mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold transition " +
            (wfwOnly
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground")
          }
        >
          {WFW_LABEL}
        </button>
      ) : null}

      {celebration ? (
        <div
          role="status"
          aria-live="polite"
          className="achievement-land mt-4 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-center"
        >
          <p className="text-[14px] font-black tracking-tight text-primary">
            {celebration.first ? "Votre réseau commence ici" : "+1 chauffeur de confiance"}
          </p>
          <p className="mt-0.5 text-[12.5px] font-semibold text-muted-foreground">
            {celebration.first
              ? `${celebration.firstName} est votre premier chauffeur Relink`
              : `${celebration.firstName} rejoint vos chauffeurs`}
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {drivers.isLoading ? (
          [0, 1].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-card"
            >
              <div className="aspect-[16/10] w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-5 w-1/2 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
                <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-card p-6 text-center">
            <p className="text-sm font-bold">Votre carnet est vide</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez un chauffeur en scannant son QR code en fin de course, ou découvrez nos
              chauffeurs recommandés.
            </p>
            <Link
              to="/espace/decouvrir"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-primary/35 px-5 text-sm font-bold text-primary"
            >
              <Compass className="size-4" /> Trouver un chauffeur
            </Link>
          </div>
        ) : (
          filtered.map((d) => {
            const photoUrl = d.photoPath ? (photos.data?.[d.photoPath] ?? null) : null;
            const justAdded = celebration?.driverId === d.id;
            const leaving = removingId === d.id;
            const cardClassName = `group block overflow-hidden rounded-[1.25rem] border bg-card shadow-card transition active:scale-[0.985] ${
              justAdded ? "achievement-land border-primary/40" : "border-border"
            }${leaving ? " removal-exit border-destructive/50" : ""}${d.womanForWoman ? " wfw-card" : ""}`;
            const cardBody = (
              <>
                {/* Photo véhicule — pleine largeur, format identique aux cartes Top 10 */}
                <div className="relative aspect-video w-full bg-muted">
                  {d.womanForWoman ? (
                    <span className="wfw-badge absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-sm backdrop-blur-sm">
                      {WFW_LABEL}
                    </span>
                  ) : null}
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`Véhicule de ${d.name}`}
                      className="size-full cursor-default object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground">
                      <Car className="size-8" aria-hidden />
                    </span>
                  )}
                  {leaving ? (
                    <span className="removal-veil pointer-events-none absolute inset-0 bg-destructive/25" />
                  ) : null}
                </div>

                {/* Informations compactes */}
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {d.avatarUrl ? (
                        <img
                          src={d.avatarUrl}
                          alt=""
                          onError={(e) => (e.currentTarget.style.display = "none")}
                          className="size-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                          {initials(d.name)}
                        </span>
                      )}
                      <p className="truncate text-[15px] leading-tight font-extrabold">{d.name}</p>
                    </div>

                    {leaving ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-bold text-destructive-foreground">
                        <Check className="size-3.5" strokeWidth={3} /> Chauffeur retiré
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground">
                        Voir le profil
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-[13px] font-semibold text-muted-foreground">
                    {d.vehicle ?? "Véhicule non renseigné"}
                  </p>

                  <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold">
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        d.available
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          d.available ? "status-dot-pulse bg-primary" : "bg-muted-foreground/60"
                        }`}
                        aria-hidden
                      />
                      {d.available ? "Disponible" : "Indisponible"}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{d.zone ?? "Zone non renseignée"}</span>
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {d.trips > 0
                        ? `${d.trips} trajet${d.trips > 1 ? "s" : ""} ensemble`
                        : "Aucun trajet ensemble"}
                    </p>
                    {leaving ? null : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setToRemove({ id: d.id, name: d.name });
                        }}
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted-foreground underline underline-offset-4 transition hover:text-destructive"
                      >
                        <UserMinus className="size-3.5" aria-hidden /> Retirer
                      </button>
                    )}
                  </div>
                </div>
              </>
            );

            const card =
              d.slug && !leaving ? (
                <Link to="/chauffeur/$slug" params={{ slug: d.slug }} className={cardClassName}>
                  {cardBody}
                </Link>
              ) : (
                <div className={cardClassName}>{cardBody}</div>
              );

            return (
              <div key={d.id} className={leaving ? "removal-slot" : undefined}>
                {card}
              </div>
            );
          })
        )}
      </div>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retirer {toRemove?.name.split(" ")[0] ?? "ce chauffeur"} de vos chauffeurs ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Il ne figurera plus dans votre carnet et vous ne pourrez plus lui envoyer de demande
              de trajet. Vous pourrez l'ajouter de nouveau à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = toRemove;
                setToRemove(null);
                if (target) void removeDriver(target.id, target.name);
              }}
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddDriverSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
