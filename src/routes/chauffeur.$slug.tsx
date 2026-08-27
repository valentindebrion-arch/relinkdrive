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
  Facebook,
  Instagram,
  Languages,
  Linkedin,
  Luggage,
  MapPin,
  MessageCircle,
  Moon,
  Music2,
  Phone,
  PlugZap,
  Quote,
  Star as StarIcon,
  ThumbsUp,
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
import { VehicleShowcase } from "@/components/VehicleShowcase";
import { TripEstimator, type TripEstimate } from "@/components/driver/TripEstimator";
import { saveRequestDraft } from "@/lib/request-draft";
import { prefersReducedMotion, setDriverCelebration } from "@/lib/driver-celebration";
import { DriverAddedOverlay } from "@/components/client/DriverAddedOverlay";

import { BRAND } from "@/lib/brand";
import {
  BookingThemeScope,
  PoweredByRelink,
  useDriverBranding,
} from "@/components/BookingThemeScope";
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

function driverNameFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const Route = createFileRoute("/chauffeur/$slug")({
  head: ({ params }) => {
    const displayName = driverNameFromSlug(params.slug);
    const url = `https://relinkdriver.lovable.app/chauffeur/${params.slug}`;
    const title = `${displayName}, chauffeur VTC — ${BRAND.name}`;
    const description = `Découvrez le profil de ${displayName}, chauffeur VTC indépendant : véhicule, services, zone d'intervention et disponibilités. Ajoutez-le à votre carnet de confiance.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: `${displayName} — Chauffeur VTC`,
            description,
            url,
            areaServed: "France",
            serviceType: "Chauffeur VTC",
            provider: { "@type": "Person", name: displayName },
          }),
        },
      ],
    };
  },
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
  const { session, user, isDriver, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [celebration, setCelebration] = useState<{ first: boolean } | null>(null);

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

  // Thème personnalisé du chauffeur (lien direct, QR code).
  const branding = useDriverBranding({ slug });

  const [reviewsLimit, setReviewsLimit] = useState(3);

  const reviewsQuery = useQuery({
    queryKey: ["public-driver-reviews", slug, reviewsLimit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_driver_reviews", {
        _slug: slug,
        _limit: reviewsLimit,
      });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        rating: number;
        comment: string | null;
        created_at: string;
        author_name: string;
        author_avatar: string | null;
      }[];
    },
  });

  const ratingQuery = useQuery({
    queryKey: ["public-driver-rating", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_driver_rating", { _slug: slug });
      if (error) throw error;
      return (data?.[0] ?? null) as {
        rating_avg: number | null;
        rating_count: number;
        stars5: number;
        stars4: number;
        stars3: number;
        stars2: number;
        stars1: number;
      } | null;
    },
  });

  useEffect(() => {
    if (d?.user_id)
      void supabase.rpc("track_driver_event", { _slug: slug, _event: "driver_page_view" });
  }, [d?.user_id, slug]);

  const driverId = d?.user_id;
  const driverCity = d?.city ?? null;

  const connect = useCallback(async () => {
    if (!user?.id || !driverId) return;
    if (isDriver || isAdmin) {
      toast.info("Seuls les comptes passagers peuvent ajouter un chauffeur à leur carnet.");
      return;
    }
    setAdding(true);
    // Nombre de chauffeurs déjà au carnet : détermine la variante « premier chauffeur ».
    const { count: before } = await supabase
      .from("driver_client_connections")
      .select("id", { count: "exact", head: true })
      .eq("client_id", user.id);
    const { error } = await supabase.from("driver_client_connections").insert({
      client_id: user.id,
      driver_id: driverId,
      source: source === "qr" ? "qr_code" : "link",
    });
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
    void connQuery.refetch();

    // Enregistrement réussi : on lance immédiatement l'expérience d'achievement.
    const first = (before ?? 0) === 0;
    const name =
      (driverQuery.data?.full_name ?? "").trim().split(" ")[0] || "Votre chauffeur";
    setDriverCelebration({ driverId, firstName: name, first });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(12);
      } catch {
        /* retour tactile indisponible */
      }
    }
    if (prefersReducedMotion()) {
      toast.success("Chauffeur ajouté à votre carnet");
      void navigate({ to: "/espace/chauffeurs" });
      return;
    }
    setCelebration({ first });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, driverId, driverCity, source, isDriver, isAdmin, driverQuery.data, navigate]);

  // Ajout automatique après connexion / création de compte depuis ce lien
  useEffect(() => {
    if (!user?.id || !driverId || connQuery.isLoading || connQuery.data) return;
    if (isDriver || isAdmin) return;
    if (sessionStorage.getItem("relink:pending-driver") !== slug) return;
    sessionStorage.removeItem("relink:pending-driver");
    void connect();
  }, [user?.id, driverId, connQuery.isLoading, connQuery.data, slug, connect]);

  const exteriorQuery = useSignedUrl("vehicles", d?.vehicle_photo_url);
  const interiorQuery = useSignedUrl("vehicles", d?.vehicle_interior_photo_url);
  const frontQuery = useSignedUrl("vehicles", d?.vehicle_front_photo_url);
  const sideQuery = useSignedUrl("vehicles", d?.vehicle_side_photo_url);
  const vehiclePhoto = exteriorQuery.data ?? null;
  const interiorPhoto = interiorQuery.data ?? null;
  const frontPhoto = frontQuery.data ?? null;
  const sidePhoto = sideQuery.data ?? null;
  const vehiclePhotos = {
    isLoading:
      exteriorQuery.isLoading ||
      interiorQuery.isLoading ||
      frontQuery.isLoading ||
      sideQuery.isLoading,
  };

  if (driverQuery.isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!d) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold">Page chauffeur indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce lien n'est plus actif. Le chauffeur n'est pas disponible actuellement sur{" "}
            {BRAND.name}.
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
    { label: "Animaux acceptés", icon: Dog, on: d.pets_policy === "accepted" },
  ].filter((e) => e.on);

  const publicPhone: string | null = d.public_phone ?? null;
  const whatsapp: string | null = d.whatsapp_number ?? null;
  const socials: { label: string; url: string; icon: typeof Car }[] = [
    { label: "Instagram", url: d.instagram_url, icon: Instagram },
    { label: "Facebook", url: d.facebook_url, icon: Facebook },
    { label: "TikTok", url: d.tiktok_url, icon: Music2 },
    { label: "LinkedIn", url: d.linkedin_url, icon: Linkedin },
  ].filter((s): s is { label: string; url: string; icon: typeof Car } => !!s.url);

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

  async function removeFromBook() {
    if (!user?.id || !driverId) return;
    setAdding(true);
    const { error } = await supabase
      .from("driver_client_connections")
      .delete()
      .eq("client_id", user.id)
      .eq("driver_id", driverId);
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${firstName} a été retiré de votre carnet`);
    void connQuery.refetch();
  }

  /** Envoie le client vers le formulaire existant, prérempli avec l'estimation. */
  function goToRequest(est: TripEstimate) {
    trackRequest();
    saveRequestDraft({
      driver_id: d!.user_id,
      pickup_address: est.pickup,
      dropoff_address: est.dropoff,
      scheduled_at: "",
      whenMode: "now",
      pickupOk: true,
      dropoffOk: true,
    });
    if (!session) {
      sessionStorage.setItem("relink:pending-driver", slug);
      navigate({
        to: "/auth",
        search: { mode: "signup", role: "client", next: "/espace/demandes" },
      });
      return;
    }
    void navigate({ to: "/espace/demandes", search: { driver: d!.user_id } });
  }

  const bookAction =
    isDriver || isAdmin ? (
      <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
        Vous êtes connecté avec un compte professionnel : seuls les comptes passagers peuvent
        ajouter un chauffeur à leur carnet.
      </p>
    ) : connected ? (
      <div className="space-y-2 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary">
          <Check className="size-4" /> {firstName} est dans mes chauffeurs
        </p>
        <button
          type="button"
          onClick={() => setRemoveOpen(true)}
          disabled={adding}
          className="text-xs font-semibold text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
        >
          Retirer {firstName} de mes chauffeurs
        </button>
      </div>
    ) : (
      <Button
        className="h-12 w-full text-base"
        onClick={() => startAdd("signup")}
        disabled={adding || !accepting}
      >
        <UserPlus className="size-4" /> Ajouter {firstName} à mes chauffeurs
      </Button>
    );

  const experienceLabel = memberSince ? `Depuis ${memberSince}` : "Nouveau";
  const vehicleLabel = [d.vehicle_brand, d.vehicle_model].filter(Boolean).join(" ") || "Véhicule";
  const vehicleSub = [d.vehicle_color, d.vehicle_category].filter(Boolean).join(" • ") || "Berline";

  const reviews = reviewsQuery.data ?? [];
  const ratingAvg =
    ratingQuery.data?.rating_avg != null ? Number(ratingQuery.data.rating_avg) : null;
  const ratingCount = Number(ratingQuery.data?.rating_count ?? 0);
  const distribution = [5, 4, 3, 2, 1].map((s) => ({
    stars: s,
    count: Number(
      (ratingQuery.data as Record<string, number> | null | undefined)?.[`stars${s}`] ?? 0,
    ),
  }));

  const availabilityChips = (d.availability ?? []) as string[];
  const zoneChips = [
    ...(d.city ? [d.city] : []),
    ...(d.zone ? [d.zone] : []),
    ...((d.service_areas ?? []) as string[]),
  ];

  return (
    <BookingThemeScope theme={branding.data?.themeId} className="min-h-screen pb-28 sm:pb-10">
      <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
        <Link
          to="/"
          className="block text-center text-xs font-medium tracking-wide text-muted-foreground uppercase transition hover:opacity-80 active:scale-95 cursor-pointer"
        >
          {BRAND.name}
        </Link>

        {/* 1 — Identité du chauffeur */}
        <section className="surface overflow-hidden">
          <div className="flex items-center gap-3.5 p-5 pb-4">
            <div className="relative shrink-0">
              {d.avatar_url ? (
                <img
                  src={d.avatar_url}
                  alt={firstName}
                  className="size-20 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground">
                  {firstName.charAt(0)}
                </div>
              )}
              <span
                className={`absolute right-1 bottom-1 size-3.5 rounded-full border-2 border-background ${accepting ? "bg-primary" : "bg-muted-foreground"}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="flex min-w-0 items-center gap-1.5 text-[24px] leading-tight font-black tracking-tight">
                <span className="truncate">
                  {firstName}
                  {lastInitial ? ` ${lastInitial}.` : ""}
                </span>
                <BadgeCheck
                  className="size-5 shrink-0 text-primary"
                  aria-label="Chauffeur vérifié"
                />
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="size-3.5 fill-warning text-warning" />
                  <span className="text-foreground">
                    {ratingAvg ? ratingAvg.toFixed(2) : "Nouveau"}
                  </span>
                  {ratingCount ? <span>({ratingCount} avis)</span> : null}
                </span>
                {d.city ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3.5" /> <span className="truncate">{d.city}</span>
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {vehicleLabel} · {vehicleSub}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <ShieldCheck className="size-3.5" /> Chauffeur vérifié {BRAND.name}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{experienceLabel}</span>
          </div>
          {d.public_intro || d.bio ? (
            <p className="flex gap-2 border-t border-border px-5 py-4 text-sm whitespace-pre-line text-muted-foreground">
              <Quote className="size-4 shrink-0 fill-primary text-primary" />
              {d.public_intro ?? d.bio}
            </p>
          ) : null}
        </section>

        {/* 2 — Estimer mon trajet */}
        <TripEstimator
          driverId={d.user_id}
          firstName={firstName}
          onRequest={goToRequest}
          autoLocate
        />

        {/* 3 — Disponibilités */}
        <Section title="Disponibilités">
          <p
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${accepting ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            <span
              className={`size-2 rounded-full ${accepting ? "bg-primary" : "bg-muted-foreground"}`}
            />
            {accepting ? "Accepte des demandes" : "Ne prend pas de demande actuellement"}
          </p>
          {availabilityChips.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {availabilityChips.map((a) => {
                const item = AVAILABILITY_LABELS[a];
                return item ? (
                  <Chip key={a} icon={item.icon}>
                    {item.label}
                  </Chip>
                ) : null;
              })}
            </div>
          ) : null}
          <p className="mt-3 text-muted-foreground">
            {d.booking_notice ?? "Disponible principalement sur réservation, selon mon planning."}
          </p>
        </Section>

        {/* 4 — Zone d'activité */}
        {zoneChips.length || d.stations?.length || d.airports?.length ? (
          <Section title="Zone d'activité">
            <div className="flex flex-wrap gap-2">
              {zoneChips.map((z) => (
                <Chip key={z} icon={MapPin}>
                  {z}
                </Chip>
              ))}
              {((d.stations ?? []) as string[]).map((z) => (
                <Chip key={z}>Gare · {z}</Chip>
              ))}
              {((d.airports ?? []) as string[]).map((z) => (
                <Chip key={z}>Aéroport · {z}</Chip>
              ))}
              {d.long_distance ? <Chip>Longue distance</Chip> : null}
            </div>
          </Section>
        ) : null}

        {/* 5 — Le véhicule */}
        <section className="space-y-3">
          <VehicleShowcase
            loading={vehiclePhotos.isLoading}
            overlay={
              d.max_passengers ? `${vehicleLabel} · ${d.max_passengers} places` : vehicleLabel
            }
            photos={[
              {
                key: d.vehicle_photo_url ?? "exterior",
                url: vehiclePhoto,
                label: "Extérieur du véhicule",
              },
              { key: d.vehicle_side_photo_url ?? "side", url: sidePhoto, label: "Vue de côté" },
              { key: d.vehicle_front_photo_url ?? "front", url: frontPhoto, label: "Vue de face" },
              {
                key: d.vehicle_interior_photo_url ?? "interior",
                url: interiorPhoto,
                label: "Intérieur du véhicule",
              },
            ]}
          />
          <Section title="Le véhicule">
            <p className="font-medium">
              {[d.vehicle_brand, d.vehicle_model, d.vehicle_color].filter(Boolean).join(" · ") ||
                vehicleLabel}
              {d.vehicle_year ? ` · ${d.vehicle_year}` : ""}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>
                {d.max_passengers != null
                  ? `Jusqu'à ${d.max_passengers} passagers`
                  : "Capacité en passagers non renseignée"}
              </li>
              <li>
                {d.large_luggage_capacity != null
                  ? `${d.large_luggage_capacity} grands bagages`
                  : d.luggage_capacity != null
                    ? `${d.luggage_capacity} bagages au total`
                    : "Capacité en bagages non renseignée"}
              </li>
              {d.cabin_luggage_capacity != null ? (
                <li>{d.cabin_luggage_capacity} bagages cabine</li>
              ) : null}
              {d.child_seat ? <li>Siège enfant disponible</li> : null}
              {d.booster_seat ? <li>Rehausseur disponible</li> : null}
              {d.stroller_space ? <li>Espace pour poussette</li> : null}
              {d.accessible ? <li>Accessible en fauteuil roulant</li> : null}
              {d.large_trunk ? <li>Grand coffre pour bagages volumineux</li> : null}
            </ul>
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
        </section>

        {/* 6 — Votre trajet avec [prénom] */}
        <Section title={`Votre trajet avec ${firstName}`}>
          <div className="flex flex-wrap gap-2">
            {((d.languages ?? []) as string[]).map((l) => (
              <Chip key={l} icon={Languages}>
                {l}
              </Chip>
            ))}
            {((d.services ?? []) as string[]).map((s) => (
              <Chip key={s} icon={Briefcase}>
                {s}
              </Chip>
            ))}
            {d.quiet_ride ? <Chip icon={Volume2}>Trajet silencieux sur demande</Chip> : null}
            {d.luggage_help ? <Chip icon={Luggage}>Aide avec les bagages</Chip> : null}
            {d.card_payment ? <Chip icon={CreditCard}>Paiement par carte</Chip> : null}
            <Chip icon={Dog}>
              {d.pets_policy === "accepted"
                ? `Animaux acceptés${d.pets_max ? ` (jusqu'à ${d.pets_max})` : ""}`
                : d.pets_policy === "conditional"
                  ? "Animaux sous conditions"
                  : "Animaux non acceptés"}
            </Chip>
          </div>
          {d.pets_conditions && d.pets_policy === "conditional" ? (
            <p className="mt-2 text-xs text-muted-foreground">{d.pets_conditions}</p>
          ) : null}

          {publicPhone || whatsapp || socials.length ? (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {publicPhone ? (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href={`tel:${publicPhone.replace(/\s/g, "")}`}>
                    <Phone className="size-4" /> Appeler {publicPhone}
                  </a>
                </Button>
              ) : null}
              {whatsapp ? (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-4" /> Écrire sur WhatsApp
                  </a>
                </Button>
              ) : null}
              {socials.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {socials.map((s) => (
                    <Button key={s.label} asChild variant="secondary" size="sm">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                      >
                        <s.icon className="size-4" /> {s.label}
                      </a>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Section>

        {/* 7 — Avis passagers */}
        <Section title={ratingCount ? `Avis des passagers (${ratingCount})` : "Avis des passagers"}>
          {ratingCount ? (
            <>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5">
                <div className="text-center">
                  <p className="text-4xl font-black">
                    {ratingAvg?.toFixed(2)}
                    <span className="text-base font-medium text-muted-foreground"> /5</span>
                  </p>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon key={i} className="size-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Basé sur {ratingCount} avis</p>
                </div>
                <div className="space-y-1.5 border-l border-border pl-5">
                  {distribution.map((r) => (
                    <div key={r.stars} className="flex items-center gap-2 text-xs">
                      <span className="w-8 shrink-0 text-muted-foreground">{r.stars} ★</span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${ratingCount ? (r.count / ratingCount) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right text-muted-foreground">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {reviews.map((r) => (
                  <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      {r.author_avatar ? (
                        <img
                          src={r.author_avatar}
                          alt=""
                          loading="lazy"
                          className="size-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {r.author_name.charAt(0)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.author_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("fr-FR", {
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <StarIcon
                          key={i}
                          className={`size-3.5 ${i <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
                        />
                      ))}
                    </div>
                    {r.comment ? (
                      <p className="mt-2 line-clamp-5 text-sm text-muted-foreground">{r.comment}</p>
                    ) : null}
                  </article>
                ))}
              </div>
              {ratingCount > reviews.length ? (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setReviewsLimit((n) => Math.min(n + 6, 20))}
                >
                  Voir tous les avis
                </Button>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl bg-muted/60 p-5 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <StarIcon className="size-5" />
              </div>
              <p className="mt-2 font-semibold">Pas encore d'avis</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Les avis apparaîtront ici après les premiers trajets réalisés avec {firstName}.
              </p>
            </div>
          )}
        </Section>

        {/* 8 — Votre chauffeur est vérifié */}
        <Section title="Votre chauffeur est vérifié">
          <p className="text-muted-foreground">
            {BRAND.name} vérifie les documents professionnels de {firstName} avant la publication de
            cette page.
          </p>
          <ul className="mt-3 space-y-2">
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

        {/* 9 — Comment ça fonctionne ? */}
        <Section title="Comment ça fonctionne ?">
          <ol className="space-y-2">
            {[
              "Estimez votre trajet en quelques secondes.",
              `Envoyez votre demande directement à ${firstName}.`,
              "Échangez avec lui et organisez votre trajet.",
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
            {BRAND.name} vous permet de conserver les coordonnées des chauffeurs que vous avez
            réellement rencontrés et ne prélève aucune commission sur les courses.
          </p>
        </Section>

        {/* Carnet de chauffeurs — dernier bloc fonctionnel */}
        <div className="surface p-5">{bookAction}</div>

        <div className="space-y-1 pb-2 text-center text-xs text-muted-foreground">
          <p>
            {BRAND.name} — carnet privé de chauffeurs. Seules les informations que le chauffeur a
            choisi de publier sont visibles ici : aucune coordonnée personnelle n'est diffusée
            automatiquement.
          </p>
          <p>
            Mentions légales · Confidentialité — {BRAND.name} n'organise aucune mise en relation
            publique et ne prélève aucune commission. Les données des passagers ne sont utilisées
            que pour la relation avec les chauffeurs de leur carnet.
          </p>
        </div>
        <PoweredByRelink />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajouter {firstName} à vos chauffeurs ?</AlertDialogTitle>
            <AlertDialogDescription>
              {firstName} sera enregistré dans votre carnet privé et pourra recevoir vos demandes de
              trajet. Vous pouvez le retirer à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void connect()}>Confirmer l'ajout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {firstName} de vos chauffeurs ?</AlertDialogTitle>
            <AlertDialogDescription>
              {firstName} ne figurera plus dans votre carnet et vous ne pourrez plus lui envoyer de
              demande de trajet. Vous pourrez l'ajouter de nouveau à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeFromBook()}>Retirer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {celebration ? (
        <DriverAddedOverlay
          firstName={firstName}
          name={d.full_name ?? firstName}
          vehicleLabel={vehicleLabel}
          photoUrl={sidePhoto ?? vehiclePhoto ?? frontPhoto}
          first={celebration.first}
          onDone={() => {
            setCelebration(null);
            void navigate({ to: "/espace/chauffeurs" });
          }}
        />
      ) : null}
      {false && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:hidden">
          <a
            href="#estimation"
            className="pointer-events-auto mx-auto flex h-12 max-w-lg items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg"
          >
            Estimer mon trajet
          </a>
        </div>
      )}
    </BookingThemeScope>
  );
}
