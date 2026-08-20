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
  UserRound,
  ChevronRight,
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
import { VehicleGallery } from "@/components/VehicleGallery";

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
    if (d?.user_id) void supabase.rpc("track_driver_event", { _slug: slug, _event: "driver_page_view" });
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
    toast.success("Chauffeur ajouté à votre carnet");
    void connQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, driverId, driverCity, source, isDriver, isAdmin]);

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
  const vehiclePhoto = exteriorQuery.data ?? null;
  const interiorPhoto = interiorQuery.data ?? null;
  const vehiclePhotos = { isLoading: exteriorQuery.isLoading || interiorQuery.isLoading };


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

  const primaryAction = isDriver || isAdmin ? (
    <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
      Vous êtes connecté avec un compte professionnel : seuls les comptes passagers peuvent ajouter un
      chauffeur à leur carnet.
    </p>
  ) : connected ? (
    <div className="space-y-2">
      <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary">
        <Check className="size-4" /> Déjà dans mes chauffeurs
      </p>
      <Button asChild className="h-12 w-full text-base" onClick={trackRequest}>
        <Link to="/espace/demandes" search={{ driver: d.user_id }}>
          Demander un trajet à {firstName}
        </Link>
      </Button>
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
  const ratingAvg = ratingQuery.data?.rating_avg != null ? Number(ratingQuery.data.rating_avg) : null;
  const ratingCount = Number(ratingQuery.data?.rating_count ?? 0);
  const distribution = [5, 4, 3, 2, 1].map((s) => ({
    stars: s,
    count: Number((ratingQuery.data as Record<string, number> | null | undefined)?.[`stars${s}`] ?? 0),
  }));

  return (
    <BookingThemeScope theme={branding.data?.themeId} className="min-h-screen pb-10">
      <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
        <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {BRAND.name}
        </p>

        {/* 1. En-tête */}
        <section className="space-y-4 pt-1">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {d.avatar_url ? (
                <img src={d.avatar_url} alt={firstName} className="size-24 rounded-full object-cover" />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-accent text-3xl font-semibold text-accent-foreground">
                  {firstName.charAt(0)}
                </div>
              )}
              <span
                className={`absolute right-1 bottom-1 size-5 rounded-full border-2 border-background ${accepting ? "bg-primary" : "bg-muted-foreground"}`}
              />
            </div>
            <div className="min-w-0 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <BadgeCheck className="size-4" /> Chauffeur vérifié
              </span>
              <h1 className="mt-2 truncate text-3xl font-black tracking-tight">
                {firstName}
                {lastInitial ? ` ${lastInitial}.` : ""}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <StarIcon className="size-4 fill-warning text-warning" />
                <span className="font-semibold text-foreground">
                  {ratingAvg ? ratingAvg.toFixed(2) : "Nouveau"}
                </span>
                {ratingCount ? <span>• {ratingCount} avis</span> : null}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: UserRound, title: experienceLabel, sub: "Expérience" },
              { icon: MapPin, title: d.city ?? "—", sub: "Zone d'activité" },
              { icon: Car, title: vehicleLabel, sub: vehicleSub },
            ].map((s) => (
              <div key={s.sub} className="surface min-w-0 p-3">
                <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <s.icon className="size-4" />
                </span>
                <p className="mt-2 truncate text-sm font-bold">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4">
            <ShieldCheck className="size-7 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Chauffeur professionnel vérifié</p>
              <p className="text-sm text-muted-foreground">Identité, permis et assurance contrôlés.</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </div>
        </section>

        {/* 2. Présentation */}
        {d.public_intro || d.bio ? (
          <Section title={`À propos de ${firstName}`}>
            <p className="flex gap-2 whitespace-pre-line text-muted-foreground">
              <Quote className="size-4 shrink-0 fill-primary text-primary" />
              {d.public_intro ?? d.bio}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
              {[
                {
                  icon: Languages,
                  label: "Langues",
                  value: (d.languages ?? []).join(", ") || "Français",
                },
                {
                  icon: StarIcon,
                  label: "Note moyenne",
                  value: ratingAvg ? `${ratingAvg.toFixed(2)}/5` : "Pas encore noté",
                },
                {
                  icon: ThumbsUp,
                  label: "Apprécié pour",
                  value: (d.services ?? []).slice(0, 2).join(", ") || "Ponctualité",
                },
              ].map((m) => (
                <div key={m.label} className="flex min-w-0 items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <m.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="truncate text-sm font-semibold">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* 2 ter. Note et avis */}
        <Section title="Avis des passagers">
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
                      <span className="w-8 shrink-0 text-right text-muted-foreground">{r.count}</span>
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


        {/* 2 bis. Contact et réseaux (uniquement ce que le chauffeur a rendu public) */}
        {publicPhone || whatsapp || socials.length ? (
          <Section title={`Contacter ${firstName}`}>
            <div className="space-y-2">
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
                      <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                        <s.icon className="size-4" /> {s.label}
                      </a>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Seules les coordonnées que {firstName} a choisi de rendre publiques sont affichées.
            </p>
          </Section>
        ) : null}



        {/* 3. Photos du véhicule — section critique, toujours affichée */}
        <VehicleGallery
          loading={vehiclePhotos.isLoading}
          photos={[
            {
              key: d.vehicle_photo_url ?? "exterior",
              url: vehiclePhoto,
              label: "Extérieur du véhicule",
            },
            {
              key: d.vehicle_interior_photo_url ?? "interior",
              url: interiorPhoto,
              label: "Intérieur du véhicule",
            },
          ]}
        />

        {/* 4. Véhicule */}
        {d.vehicle_brand || d.max_passengers ? (
          <Section title="Le véhicule">


            <p className="font-medium">
              {[d.vehicle_brand, d.vehicle_model, d.vehicle_color].filter(Boolean).join(" · ")}
              {d.vehicle_year ? ` · ${d.vehicle_year}` : ""}
            </p>
            <p className="mt-1 text-muted-foreground">
              {d.vehicle_category ? `${d.vehicle_category} · ` : ""}
              {d.max_passengers != null
                ? `Jusqu'à ${d.max_passengers} passagers`
                : "Capacité en passagers non renseignée"}
            </p>

            {/* Capacités déclarées par le chauffeur */}
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
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
              <li>
                {d.pets_policy === "accepted"
                  ? `Animaux acceptés${d.pets_max ? ` (jusqu'à ${d.pets_max})` : ""}`
                  : d.pets_policy === "conditional"
                    ? `Animaux acceptés sous conditions${d.pets_conditions ? ` : ${d.pets_conditions}` : ""}`
                    : "Animaux non acceptés"}
              </li>
              {d.pets_carrier_required && d.pets_policy !== "refused" ? (
                <li>Animal transporté en caisse ou en sac obligatoire</li>
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

        <div className="space-y-1 pb-2 text-center text-xs text-muted-foreground">
          <p>
            {BRAND.name} — carnet privé de chauffeurs. Seules les informations que le chauffeur a choisi de
            publier sont visibles ici : aucune coordonnée personnelle n'est diffusée automatiquement.
          </p>
          <p>
            Mentions légales · Confidentialité — {BRAND.name} n'organise aucune mise en relation publique et
            ne prélève aucune commission. Les données des passagers ne sont utilisées que pour la relation
            avec les chauffeurs de leur carnet.
          </p>
        </div>
        <PoweredByRelink />
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
    </BookingThemeScope>
  );
}
