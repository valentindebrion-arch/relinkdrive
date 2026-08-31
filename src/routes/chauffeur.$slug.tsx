import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Globe,
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
import { TripEstimator } from "@/components/driver/TripEstimator";
import { useDisplayAvatar } from "@/components/AvatarPhoto";
import { showcaseFromPublicRow, vehicleTitle } from "@/lib/showcase-model";
import {
  ShowcaseAbout,
  ShowcaseContactSection,
  ShowcaseHeader,
  ShowcaseLanguages,
  ShowcaseLinksSection,
  ShowcaseSectors,
  ShowcaseServices,
  ShowcaseVehicleInfo,
} from "@/components/showcase/ShowcaseSections";
import { prefersReducedMotion, setDriverCelebration } from "@/lib/driver-celebration";
import { DriverAddedOverlay } from "@/components/client/DriverAddedOverlay";
import { DriverRemovedOverlay } from "@/components/client/DriverRemovedOverlay";

import {
  WFW_CLIENT_BLOCKED_HELP,
  WFW_CLIENT_BLOCKED_TITLE,
  WFW_CLIENT_PROFILE_INCOMPLETE,
  WFW_LABEL,
  WFW_PUBLIC_DESCRIPTION,
  WFW_PUBLIC_HEADER_NOTICE,
  wfwClientAccess,
} from "@/lib/woman-for-woman";

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
    const description = `Découvrez le profil de ${displayName}, chauffeur VTC indépendant sur ReLink : véhicule, prestations, zones desservies et coordonnées professionnelles. Ajoutez-le à votre réseau.`;
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
  const { session, user, profile, isDriver, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removal, setRemoval] = useState(false);

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

  useEffect(() => {
    if (!d?.user_id) return;
    void supabase.rpc("track_driver_event", { _slug: slug, _event: "driver_page_view" });
    // Historique « Récemment consultés » du client connecté.
    if (user?.id && user.id !== d.user_id) {
      void supabase
        .from("driver_profile_views")
        .upsert(
          { client_id: user.id, driver_id: d.user_id, viewed_at: new Date().toISOString() },
          { onConflict: "client_id,driver_id" },
        );
    }
  }, [d?.user_id, slug, user?.id]);

  const driverId = d?.user_id;
  const driverCity = d?.city ?? null;

  const connect = useCallback(async () => {
    if (!user?.id || !driverId) return;
    if (isDriver || isAdmin) {
      toast.info("Seuls les comptes passagers peuvent ajouter un chauffeur à leur carnet.");
      return;
    }
    // Woman for Woman : contrôle côté interface (le serveur refuse aussi la relation).
    const access = wfwClientAccess(
      (driverQuery.data as { woman_for_woman?: boolean } | null)?.woman_for_woman,
      profile?.gender,
    );
    if (access !== "ok") {
      toast.error(
        access === "incomplete" ? WFW_CLIENT_PROFILE_INCOMPLETE : WFW_CLIENT_BLOCKED_HELP,
      );
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
      toast.error(
        /woman_for_woman_not_eligible/i.test(error.message)
          ? WFW_CLIENT_BLOCKED_HELP
          : error.message,
      );
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
    // Le chauffeur quitte immédiatement les espaces de découverte et rejoint le carnet.
    void queryClient.invalidateQueries({ queryKey: ["top10-drivers"] });
    void queryClient.invalidateQueries({ queryKey: ["client-drivers"] });
    void queryClient.invalidateQueries({ queryKey: ["discover-drivers"] });

    // Enregistrement réussi : on lance immédiatement l'expérience d'achievement.
    const first = (before ?? 0) === 0;
    const name = (driverQuery.data?.full_name ?? "").trim().split(" ")[0] || "Votre chauffeur";
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
  const avatarUrl = useDisplayAvatar(d?.avatar_url);

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
  // Woman for Woman : la relation n'est possible qu'avec une cliente compatible.
  const womanForWoman = Boolean((d as { woman_for_woman?: boolean }).woman_for_woman);
  const wfwAccess = wfwClientAccess(womanForWoman, profile?.gender);
  // Visiteur non connecté : on laisse le parcours d'inscription se faire, la
  // compatibilité Woman for Woman est vérifiée après connexion (et côté serveur).
  const wfwLocked = !!session && !isDriver && !isAdmin && wfwAccess !== "ok";
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
  const website: string | null = (d as { website_url?: string | null }).website_url ?? null;

  type ContactLink = {
    kind: string;
    label: string;
    href: string;
    icon: typeof Car;
    external?: boolean;
    primary?: boolean;
  };

  /** Moyens de contact publiés par le chauffeur, dans l'ordre d'utilité. */
  const contactLinks: ContactLink[] = (
    [
      publicPhone
        ? {
            kind: "phone",
            label: `Appeler ${publicPhone}`,
            href: `tel:${publicPhone.replace(/\s/g, "")}`,
            icon: Phone,
            primary: true,
          }
        : null,
      publicPhone
        ? {
            kind: "sms",
            label: "Envoyer un SMS",
            href: `sms:${publicPhone.replace(/\s/g, "")}`,
            icon: MessageCircle,
          }
        : null,
      whatsapp
        ? {
            kind: "whatsapp",
            label: "Écrire sur WhatsApp",
            href: `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`,
            icon: MessageCircle,
            external: true,
          }
        : null,
      website
        ? { kind: "website", label: "Site internet", href: website, icon: Globe, external: true }
        : null,
      d.instagram_url
        ? {
            kind: "instagram",
            label: "Instagram",
            href: d.instagram_url,
            icon: Instagram,
            external: true,
          }
        : null,
      d.facebook_url
        ? {
            kind: "facebook",
            label: "Facebook",
            href: d.facebook_url,
            icon: Facebook,
            external: true,
          }
        : null,
      d.tiktok_url
        ? { kind: "tiktok", label: "TikTok", href: d.tiktok_url, icon: Music2, external: true }
        : null,
      d.linkedin_url
        ? {
            kind: "linkedin",
            label: "LinkedIn",
            href: d.linkedin_url,
            icon: Linkedin,
            external: true,
          }
        : null,
    ] as (ContactLink | null)[]
  ).filter((c): c is ContactLink => !!c);

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

  /** Statistique de visibilité : clic sur un moyen de contact. */
  function trackContact(kind: string) {
    void supabase.rpc("track_driver_event", { _slug: slug, _event: `contact_click:${kind}` });
  }

  async function removeFromBook() {
    if (!user?.id || !driverId) return;
    setAdding(true);
    // Backend d'abord : la carte ne disparaît qu'après suppression confirmée.
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
    void queryClient.invalidateQueries({ queryKey: ["client-drivers"] });
    void queryClient.invalidateQueries({ queryKey: ["discover-drivers"] });
    void queryClient.invalidateQueries({ queryKey: ["top10-drivers"] });
    if (prefersReducedMotion()) {
      toast.success(`${firstName} a été retiré de vos chauffeurs`);
      void connQuery.refetch();
      return;
    }
    setRemoval(true);
  }

  /** Message de blocage Woman for Woman (profil incompatible ou incomplet). */
  const wfwGate = wfwLocked ? (
    <div className="wfw-card rounded-2xl border px-4 py-3 text-sm">
      {wfwAccess === "incomplete" ? (
        <>
          <p className="font-semibold">{WFW_LABEL}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{WFW_CLIENT_PROFILE_INCOMPLETE}</p>
          <Button asChild className="mt-3 h-11 w-full">
            <Link to="/espace/parametres">Compléter mon profil</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="font-semibold">{WFW_CLIENT_BLOCKED_TITLE}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{WFW_CLIENT_BLOCKED_HELP}</p>
        </>
      )}
    </div>
  ) : null;

  const bookAction =
    wfwGate && !connected ? (
      wfwGate
    ) : isDriver || isAdmin ? (
      <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
        Vous êtes connecté avec un compte professionnel : seuls les comptes passagers peuvent
        ajouter un chauffeur à leur carnet.
      </p>
    ) : connected ? (
      <div className="space-y-2 text-center">
        <p
          className={
            "flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors " +
            (removal ? "text-destructive" : "text-primary")
          }
        >
          <Check className="size-4" />{" "}
          {removal ? "Chauffeur retiré" : `${firstName} est dans mes chauffeurs`}
        </p>
        <button
          type="button"
          onClick={() => setRemoveOpen(true)}
          disabled={adding || removal}
          className="text-xs font-semibold text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
        >
          Retirer {firstName} de mes chauffeurs
        </button>
      </div>
    ) : (
      <Button
        className="h-12 w-full text-base"
        onClick={() => startAdd("signup")}
        disabled={adding}
      >
        <UserPlus className="size-4" /> Ajouter {firstName} à mes chauffeurs
      </Button>
    );

  const experienceLabel = memberSince ? `Depuis ${memberSince}` : "Nouveau";
  const showcase = showcaseFromPublicRow(d as unknown as Record<string, unknown>);
  const vehicleLabel = vehicleTitle(showcase.vehicle);
  const vehicleSub = [d.vehicle_color, d.vehicle_category].filter(Boolean).join(" • ") || "Berline";

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
        <ShowcaseHeader
          data={showcase}
          avatarUrl={avatarUrl}
          subtitle={`${vehicleLabel} · ${vehicleSub} · ${experienceLabel}`}
        />
        <ShowcaseAbout about={showcase.about} />

        {/* 2 — Contacter le chauffeur */}
        <ShowcaseContactSection
          title={`Contacter ${firstName}`}
          contact={showcase.contact}
          intro={`${BRAND.name} ne gère ni la réservation ni la course : vous échangez directement avec le chauffeur.`}
          onTrack={trackContact}
        />

        {/* 3 — Estimation indicative */}
        <TripEstimator slug={slug} firstName={firstName} autoLocate />

        {/* 4 — Prestations proposées */}
        <ShowcaseServices services={showcase.services} longDistance={showcase.longDistance} />

        {/* 5 — Secteurs d'intervention */}
        <ShowcaseSectors data={showcase} />

        {/* 6 — Le véhicule */}
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
          <ShowcaseVehicleInfo vehicle={showcase.vehicle} />
        </section>

        {/* 7 — Langues et liens */}
        <ShowcaseLanguages languages={showcase.languages} />
        <ShowcaseLinksSection links={showcase.links} onTrack={trackContact} />

        {showcase.womanForWoman ? (
          <div className="wfw-card flex items-start gap-2 rounded-2xl border px-4 py-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-wfw" aria-hidden />
            <p className="text-[12.5px] leading-snug">
              <span className="font-semibold">{WFW_LABEL}</span>
              <span className="block text-muted-foreground">{WFW_PUBLIC_DESCRIPTION}</span>
            </p>
          </div>
        ) : null}

        {/* 8 — Votre chauffeur est vérifié */}
        <Section title="Profil vérifié">
          <p className="text-muted-foreground">
            {BRAND.name} contrôle les informations professionnelles de {firstName} avant la
            publication de cette vitrine. Ce badge n'est pas une garantie de la prestation.
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
              <ShieldCheck className="size-4 text-primary" /> Informations professionnelles
              contrôlées par {BRAND.name}
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
              `Consultez la vitrine de ${firstName} : véhicules, prestations, zones desservies.`,
              "Ajoutez-le à vos chauffeurs pour le retrouver plus tard.",
              "Contactez-le directement pour convenir de votre trajet.",
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
            {BRAND.name} met les chauffeurs en visibilité et vous donne accès à leurs coordonnées
            professionnelles. La prestation, son tarif et ses conditions se conviennent directement
            avec le chauffeur.
          </p>
        </Section>

        {/* Carnet de chauffeurs — dernier bloc fonctionnel */}
        <div className="surface p-5">{bookAction}</div>

        <div className="space-y-1 pb-2 text-center text-xs text-muted-foreground">
          <p>
            {BRAND.name} — le réseau des chauffeurs VTC. Seules les informations que le chauffeur a
            choisi de publier sont visibles ici.
          </p>
          <p>{BRAND.name} n'organise, ne gère et n'exécute aucune course.</p>
        </div>
        <PoweredByRelink />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajouter {firstName} à vos chauffeurs ?</AlertDialogTitle>
            <AlertDialogDescription></AlertDialogDescription>
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
              chauffeurs. Vous pourrez l'ajouter de nouveau à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeFromBook()}>Retirer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {removal ? (
        <DriverRemovedOverlay
          firstName={firstName}
          name={d.full_name ?? firstName}
          vehicleLabel={vehicleLabel}
          photoUrl={sidePhoto ?? vehiclePhoto ?? frontPhoto}
          onDone={() => {
            setRemoval(false);
            void connQuery.refetch();
          }}
        />
      ) : null}

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
    </BookingThemeScope>
  );
}
