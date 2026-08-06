import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Briefcase,
  Car,
  Check,
  CreditCard,
  Clock,
  Dog,
  Droplets,
  Languages,
  Luggage,
  MapPin,
  Moon,
  PlugZap,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  UserPlus,
  Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSignedUrl } from "@/lib/storage";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/chauffeur/$slug")({
  head: () => ({
    meta: [
      { title: `Votre chauffeur de confiance — ${BRAND.name}` },
      {
        name: "description",
        content: "Ajoutez ce chauffeur à votre carnet privé et sollicitez-le pour vos prochains trajets.",
      },
      { property: "og:title", content: `Votre chauffeur de confiance — ${BRAND.name}` },
      { property: "og:description", content: "Ajoutez ce chauffeur à votre carnet de confiance." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverPublicPage,
});

const AVAILABILITY_LABELS: Record<string, { label: string; icon: typeof Sun }> = {
  advance: { label: "Sur réservation à l'avance", icon: Clock },
  day: { label: "Service de jour", icon: Sun },
  night: { label: "Service de nuit", icon: Moon },
  weekend: { label: "Disponible le week-end", icon: Sparkles },
  long_distance: { label: "Longue distance", icon: MapPin },
};

const VERIFICATION_BADGES: { doc: string; label: string }[] = [
  { doc: "identity", label: "Identité vérifiée" },
  { doc: "company_proof", label: "Entreprise vérifiée" },
  { doc: "vtc_card", label: "Carte professionnelle vérifiée" },
  { doc: "driving_license", label: "Permis vérifié" },
  { doc: "insurance", label: "Assurance vérifiée" },
  { doc: "registration", label: "Véhicule vérifié" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

function Chip({ icon: Icon, children }: { icon?: typeof Car; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
      {Icon ? <Icon className="size-3.5 text-primary" /> : null}
      {children}
    </span>
  );
}

function DriverPublicPage() {
  const { slug } = Route.useParams();
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const source =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("src") === "qr"
      ? "qr"
      : "link";

  const driverQuery = useQuery({
    queryKey: ["public-driver", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_driver_page", { _slug: slug });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const d = driverQuery.data;

  const connQuery = useQuery({
    queryKey: ["conn", slug, user?.id],
    enabled: !!user?.id && !!d?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_client_connections")
        .select("id")
        .eq("client_id", user!.id)
        .eq("driver_id", d!.user_id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (d?.user_id) void supabase.rpc("track_driver_event", { _slug: slug, _event: "driver_page_view" });
  }, [d?.user_id, slug]);

  const driverId = d?.user_id;
  const driverCity = d?.city ?? null;

  const connect = useCallback(async () => {
    if (!user?.id || !driverId) return;
    setAdding(true);
    const { error } = await supabase
      .from("driver_client_connections")
      .insert({ client_id: user.id, driver_id: driverId, source: source === "qr" ? "qr_code" : "link" });
    setAdding(false);
    if (error) {
      if (error.code === "23505") {
        toast.success("Ce chauffeur est déjà dans votre carnet");
        void connQuery.refetch();
        return;
      }
      toast.error(error.message);
      return;
    }
    await supabase.from("analytics_events").insert({
      event: "driver_added",
      driver_id: driverId,
      client_id: user.id,
      city: driverCity,
      metadata: { source },
    });
    await supabase.from("notifications").insert({
      user_id: driverId,
      title: "Nouveau client fidélisé",
      body: "Un client vient de vous ajouter à son carnet.",
      kind: "connection",
      link: "/pro/clients",
    });
    toast.success("Chauffeur ajouté à votre carnet");
    void connQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, driverId, driverCity, source]);

  // Ajout automatique après connexion / création de compte depuis ce lien
  useEffect(() => {
    if (!user?.id || !driverId || connQuery.isLoading || connQuery.data) return;
    if (sessionStorage.getItem("relink:pending-driver") !== slug) return;
    sessionStorage.removeItem("relink:pending-driver");
    void connect();
  }, [user?.id, driverId, connQuery.isLoading, connQuery.data, slug, connect]);

  const vehiclePhoto = useSignedUrl("vehicles", d?.vehicle_photo_url).data;
  const interiorPhoto = useSignedUrl("vehicles", d?.vehicle_interior_photo_url).data;

  if (driverQuery.isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!d) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold">Page chauffeur indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce lien n'est plus actif. Le chauffeur n'est pas disponible actuellement sur {BRAND.name}.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  const connected = !!connQuery.data;
  const firstName = (d.full_name ?? "").trim().split(" ")[0] || "Votre chauffeur";
  const lastInitial = (d.full_name ?? "").trim().split(" ")[1]?.charAt(0);
  const accepting = d.accepting_requests !== false;
  const verifiedDocs: string[] = d.verified_docs ?? [];
  const memberSince = d.member_since
    ? new Date(d.member_since).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  const equipments: { label: string; icon: typeof Car; on: boolean }[] = [
    { label: "Climatisation", icon: Snowflake, on: !!d.air_conditioning },
    { label: "Chargeurs téléphone", icon: PlugZap, on: !!d.chargers },
    { label: "Bouteilles d'eau", icon: Droplets, on: !!d.water },
    { label: "Paiement par carte", icon: CreditCard, on: !!d.card_payment },
    { label: "Trajet silencieux sur demande", icon: Volume2, on: !!d.quiet_ride },
    { label: "Aide aux bagages", icon: Luggage, on: !!d.luggage_help },
    { label: "Animaux acceptés", icon: Dog, on: !!d.pets_allowed },
  ].filter((e) => e.on);

  function startAdd(mode: "signin" | "signup" = "signup") {
    void supabase.rpc("track_driver_event", { _slug: slug, _event: "driver_add_click" });
    if (!session) {
      sessionStorage.setItem("relink:pending-driver", slug);
      void supabase.rpc("track_driver_event", { _slug: slug, _event: "driver_signup_started" });
      navigate({ to: "/auth", search: { mode, role: "client", next: `/chauffeur/${slug}` } });
      return;
    }
    setConfirmOpen(true);
  }

  function trackRequest() {
    void supabase.rpc("track_driver_event", { _slug: slug, _event: "driver_request_click" });
  }

  const primaryAction = connected ? (
    <Button asChild className="h-12 w-full text-base" onClick={trackRequest}>
      <Link to="/espace/demandes" search={{ driver: d.user_id }}>
        Demander un trajet à {firstName}
      </Link>
    </Button>
  ) : (
    <Button
      className="h-12 w-full text-base"
      onClick={() => startAdd("signup")}
      disabled={adding || !accepting}
    >
      <UserPlus className="size-4" /> Ajouter {firstName} à mes chauffeurs
    </Button>
  );

  return (
    <div className="min-h-screen bg-muted/30 pb-28 sm:pb-10">
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {BRAND.name}
        </p>

        {/* 1. En-tête */}
        <section className="surface overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            {d.avatar_url ? (
              <img src={d.avatar_url} alt={firstName} className="size-20 rounded-full object-cover" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground">
                {firstName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">
                {firstName}
                {lastInitial ? ` ${lastInitial}.` : ""}, votre chauffeur de confiance
              </h1>
              <p className="text-sm text-muted-foreground">
                {d.business_name ?? "Chauffeur VTC indépendant"}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                <BadgeCheck className="size-4" /> Chauffeur vérifié
              </p>
            </div>
          </div>
          {d.city || d.zone ? (
            <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-muted-foreground">
              <MapPin className="size-4 text-primary" />
              Chauffeur professionnel vérifié à {d.city ?? "votre ville"}
              {d.zone ? ` et ${d.zone}` : " et dans ses alentours"}
            </p>
          ) : null}
          {vehiclePhoto ? (
            <img src={vehiclePhoto} alt="Véhicule" className="h-48 w-full object-cover" />
          ) : null}
          {d.vehicle_brand || d.vehicle_model ? (
            <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm">
              <Car className="size-4 text-primary" />
              {[d.vehicle_brand, d.vehicle_model].filter(Boolean).join(" ")}
            </p>
          ) : null}

          <div className="space-y-2 border-t border-border p-5">
            {!accepting ? (
              <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
                Ce chauffeur n'accepte actuellement pas de nouvelles demandes.
              </p>
            ) : null}
            {primaryAction}
            {connected ? (
              <>
                <p className="text-center text-sm text-primary">
                  {firstName} fait partie de vos chauffeurs de confiance.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/espace/chauffeurs">Voir dans mes chauffeurs</Link>
                </Button>
              </>
            ) : (
              <>
                {!session ? (
                  <Button variant="outline" className="w-full" onClick={() => startAdd("signin")}>
                    J'ai déjà un compte — me connecter
                  </Button>
                ) : null}
                <p className="text-center text-xs text-muted-foreground">
                  Retrouvez facilement {firstName} pour vos prochains déplacements. Vous restez libre de le
                  retirer de votre carnet à tout moment.
                </p>
              </>
            )}
          </div>
        </section>

        {/* 2. Présentation */}
        {d.public_intro || d.bio ? (
          <Section title={`Bonjour, je suis ${firstName}`}>
            <p className="whitespace-pre-line text-muted-foreground">{d.public_intro ?? d.bio}</p>
          </Section>
        ) : null}

        {/* 3. Véhicule */}
        {d.vehicle_brand || d.max_passengers ? (
          <Section title="Le véhicule">
            {interiorPhoto ? (
              <img src={interiorPhoto} alt="Intérieur du véhicule" className="mb-3 h-40 w-full rounded-lg object-cover" />
            ) : null}
            <p className="font-medium">
              {[d.vehicle_brand, d.vehicle_model, d.vehicle_color].filter(Boolean).join(" · ")}
              {d.vehicle_year ? ` · ${d.vehicle_year}` : ""}
            </p>
            <p className="mt-1 text-muted-foreground">
              {d.vehicle_category ? `${d.vehicle_category} · ` : ""}
              {d.max_passengers ?? 4} passagers · {d.luggage_capacity ?? 2} bagages
            </p>
            {equipments.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {equipments.map((e) => (
                  <Chip key={e.label} icon={e.icon}>
                    {e.label}
                  </Chip>
                ))}
              </div>
            ) : null}
          </Section>
        ) : null}

        {/* 4. Services */}
        {d.services?.length ? (
          <Section title="Services proposés">
            <div className="flex flex-wrap gap-2">
              {d.services.map((s: string) => (
                <Chip key={s} icon={Briefcase}>
                  {s}
                </Chip>
              ))}
            </div>
          </Section>
        ) : null}

        {/* 5. Zone d'activité */}
        {d.city || d.service_areas?.length || d.stations?.length || d.airports?.length ? (
          <Section title="Zone d'activité">
            <div className="flex flex-wrap gap-2">
              {d.city ? <Chip icon={MapPin}>{d.city}</Chip> : null}
              {d.zone ? <Chip icon={MapPin}>{d.zone}</Chip> : null}
              {(d.service_areas ?? []).map((z: string) => (
                <Chip key={z} icon={MapPin}>
                  {z}
                </Chip>
              ))}
              {(d.stations ?? []).map((z: string) => (
                <Chip key={z}>Gare · {z}</Chip>
              ))}
              {(d.airports ?? []).map((z: string) => (
                <Chip key={z}>Aéroport · {z}</Chip>
              ))}
              {d.long_distance ? <Chip>Longue distance</Chip> : null}
            </div>
          </Section>
        ) : null}

        {/* 6. Disponibilités */}
        {d.availability?.length || d.booking_notice ? (
          <Section title="Disponibilités">
            <div className="flex flex-wrap gap-2">
              {(d.availability ?? []).map((a: string) => {
                const item = AVAILABILITY_LABELS[a];
                return item ? (
                  <Chip key={a} icon={item.icon}>
                    {item.label}
                  </Chip>
                ) : null;
              })}
            </div>
            <p className="mt-3 text-muted-foreground">
              {d.booking_notice ?? "Disponible principalement sur réservation, selon mon planning."}
            </p>
          </Section>
        ) : null}

        {/* 7. Confiance */}
        <Section title="Votre chauffeur vérifié">
          <ul className="space-y-2">
            {VERIFICATION_BADGES.filter((b) => verifiedDocs.includes(b.doc)).map((b) => (
              <li key={b.doc} className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> {b.label}
              </li>
            ))}
            {d.company_verified ? (
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Entreprise enregistrée
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Profil validé par {BRAND.name}
            </li>
            {memberSince ? (
              <li className="flex items-center gap-2 text-muted-foreground">
                <Check className="size-4" /> Membre depuis {memberSince}
              </li>
            ) : null}
          </ul>
        </Section>

        {/* 8. Langues et préférences */}
        {d.languages?.length || equipments.length ? (
          <Section title="Langues et préférences de trajet">
            <div className="flex flex-wrap gap-2">
              {(d.languages ?? []).map((l: string) => (
                <Chip key={l} icon={Languages}>
                  {l}
                </Chip>
              ))}
              {d.quiet_ride ? <Chip icon={Volume2}>Trajet silencieux sur demande</Chip> : null}
              {d.luggage_help ? <Chip icon={Luggage}>Aide avec les bagages</Chip> : null}
              {d.pets_allowed ? <Chip icon={Dog}>Animaux acceptés</Chip> : null}
              {d.card_payment ? <Chip icon={CreditCard}>Paiement par carte</Chip> : null}
            </div>
          </Section>
        ) : null}

        {/* 9. Comment ça fonctionne */}
        <Section title="Comment ça fonctionne ?">
          <ol className="space-y-2">
            {[
              "Ajoutez ce chauffeur à votre carnet.",
              "Retrouvez-le lors de votre prochain besoin.",
              "Envoyez-lui directement une demande de trajet.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            {BRAND.name} vous permet de conserver les coordonnées des chauffeurs que vous avez réellement
            rencontrés. {BRAND.name} ne vous attribue jamais un chauffeur inconnu et ne prélève aucune
            commission sur les courses.
          </p>
        </Section>

        {/* 11. Bouton final */}
        <div className="surface p-5">{primaryAction}</div>

        <p className="pb-2 text-center text-xs text-muted-foreground">
          {BRAND.name} — carnet privé de chauffeurs. Aucune donnée personnelle du chauffeur n'est diffusée
          publiquement.
        </p>
      </div>

      {/* Barre d'action mobile */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto max-w-lg">{primaryAction}</div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajouter {firstName} à vos chauffeurs ?</AlertDialogTitle>
            <AlertDialogDescription>
              {firstName} sera enregistré dans votre carnet privé et pourra recevoir vos demandes de trajet.
              Vous pouvez le retirer à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void connect()}>Confirmer l'ajout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
