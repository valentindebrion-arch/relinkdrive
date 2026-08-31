import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { CSSProperties } from "react";
import {
  QrCode,
  Users,
  Search,
  Sparkles,
  Car,
  Heart,
  MapPin,
  Phone,
  Check,
  Eye,
  Palette,
  Share2,
  Sparkles,
  ArrowRight,
  Smartphone,
  Link2,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, homeForRoles } from "@/lib/auth";
import { getBookingTheme, type BookingThemeId } from "@/lib/booking-themes";
import { WFW_LABEL } from "@/lib/woman-for-woman";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} — Trouvez et gardez vos chauffeurs VTC` },
      {
        name: "description",
        content:
          "Découvrez des chauffeurs VTC indépendants, consultez leurs vitrines professionnelles et ajoutez vos chauffeurs préférés à votre réseau ReLink.",
      },
      { property: "og:title", content: `${BRAND.name} — Trouvez et gardez vos chauffeurs VTC` },
      {
        property: "og:description",
        content:
          "Le réseau des chauffeurs indépendants : vitrines professionnelles, découverte par secteur, contact direct.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://relinkconnect.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${BRAND.name} — Trouvez et gardez vos chauffeurs VTC` },
      {
        name: "twitter:description",
        content:
          "Annuaire de chauffeurs VTC indépendants : vitrines, QR code, réseau personnel et contact direct.",
      },
    ],
    links: [{ rel: "canonical", href: "https://relinkconnect.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: BRAND.name,
          url: "https://relinkconnect.app/",
          description:
            "Réseau de chauffeurs VTC indépendants : vitrines professionnelles, découverte et contact direct.",
        }),
      },
    ],
  }),
  component: Landing,
});

/* ---------------------------------- data --------------------------------- */

const heroPoints = [
  "Vitrines professionnelles",
  "Contact direct",
  "Réseau personnel",
  "Aucune commission ReLink",
];

const clientPoints = [
  {
    icon: Search,
    title: "Découvrez",
    text: "Explorez les chauffeurs présents dans votre secteur et découvrez leur univers professionnel.",
  },
  {
    icon: Eye,
    title: "Comparez leurs vitrines",
    text: "Véhicule, prestations, zones d'intervention, tarifs indicatifs, langues et présentation : choisissez selon vos besoins.",
  },
  {
    icon: Heart,
    title: "Ajoutez vos chauffeurs",
    text: "Un profil vous intéresse ? Ajoutez-le à « Mes chauffeurs » pour le retrouver facilement.",
  },
  {
    icon: Phone,
    title: "Contactez directement",
    text: "Téléphone, SMS, WhatsApp, site ou autres moyens proposés par le chauffeur : la prise de contact se fait directement avec lui.",
  },
];

const steps = [
  {
    icon: MapPin,
    title: "Découvrez",
    text: "Explorez les chauffeurs présents dans votre secteur et trouvez les profils correspondant à vos besoins.",
  },
  {
    icon: Eye,
    title: "Consultez leur vitrine",
    text: "Découvrez leur véhicule, leurs prestations, leurs secteurs, leurs tarifs indicatifs et leur présentation.",
  },
  {
    icon: Heart,
    title: "Ajoutez",
    text: "Ajoutez les chauffeurs qui vous intéressent à « Mes chauffeurs ».",
  },
  {
    icon: Phone,
    title: "Retrouvez-les facilement",
    text: "Votre réseau de chauffeurs reste accessible depuis ReLink. Lorsque vous en avez besoin, leurs coordonnées sont à portée de main. Le contact se fait directement avec le chauffeur.",
  },
];

const driverPoints = [
  {
    icon: Car,
    title: "Votre propre vitrine",
    text: "Photo, présentation, véhicule, prestations, secteurs, tarifs et moyens de contact réunis sur une seule page.",
  },
  {
    icon: Palette,
    title: "Une vitrine à votre image",
    text: "Personnalisez le style de votre profil et présentez votre activité comme vous le souhaitez.",
  },
  {
    icon: QrCode,
    title: "Votre QR Code personnel",
    text: "Affichez-le dans votre véhicule, sur vos cartes ou vos supports de communication. Un scan suffit pour retrouver votre vitrine.",
  },
  {
    icon: Users,
    title: "Développez votre réseau",
    text: "Les clients peuvent vous ajouter à « Mes chauffeurs » et retrouver votre profil facilement lorsqu'ils souhaitent vous recontacter.",
  },
];

const pillars = [
  {
    icon: Car,
    label: "Pour les chauffeurs",
    text: "Une présence professionnelle indépendante des plateformes.",
  },
  {
    icon: Heart,
    label: "Pour les clients",
    text: "Un réseau personnel de chauffeurs à retrouver facilement.",
  },
  {
    icon: Link2,
    label: "Entre les deux",
    text: "Un contact direct, sans intermédiaire ReLink dans la prestation.",
  },
];

type PreviewCard = {
  theme: BookingThemeId;
  name: string;
  city: string;
  vehicle: string;
  tags: string[];
  wfw?: boolean;
};

const previewCards: PreviewCard[] = [
  {
    theme: "relink_classic",
    name: "Julien M.",
    city: "Lyon · Rhône",
    vehicle: "Berline · 4 places",
    tags: ["Aéroport", "Business"],
  },
  {
    theme: "professional_blue",
    name: "Karim B.",
    city: "Paris · Île-de-France",
    vehicle: "Van · 7 places",
    tags: ["Gare", "Groupes"],
  },
  {
    theme: "luxury_black_gold",
    name: "Antoine R.",
    city: "Nice · Alpes-Maritimes",
    vehicle: "Première classe",
    tags: ["Événements", "Mise à disposition"],
  },
  {
    theme: "women_for_women",
    name: "Sofia L.",
    city: "Bordeaux · Gironde",
    vehicle: "Berline · 4 places",
    tags: ["Longue distance"],
    wfw: true,
  },
];

/* -------------------------------- helpers -------------------------------- */

function themeStyle(theme: BookingThemeId): CSSProperties {
  const t = getBookingTheme(theme);
  return {
    "--card-accent": t.vars["--driver-primary"],
    "--card-soft": t.vars["--driver-accent"],
    "--card-accent-text": t.vars["--driver-text-accent"],
  } as CSSProperties;
}

function DriverPreviewCard({ card }: { card: PreviewCard }) {
  return (
    <article
      style={themeStyle(card.theme)}
      className="min-w-0 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
          style={{ background: "var(--card-soft)", color: "var(--card-accent-text)" }}
        >
          {card.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{card.name}</p>
          <p className="truncate text-xs text-muted-foreground">{card.city}</p>
        </div>
        <span
          className="ml-auto size-2.5 shrink-0 rounded-full"
          style={{ background: "var(--card-accent)" }}
          aria-hidden
        />
      </div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{card.vehicle}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {card.wfw && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "var(--card-soft)", color: "var(--card-accent-text)" }}
          >
            <Sparkles className="size-3" />
            {WFW_LABEL}
          </span>
        )}
        {card.tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>
      <div
        className="mt-3 rounded-xl px-3 py-2 text-center text-xs font-medium"
        style={{ background: "var(--card-accent)", color: "oklch(0.99 0.005 150)" }}
      >
        Voir la vitrine
      </div>
    </article>
  );
}

/* --------------------------------- page ---------------------------------- */

function Landing() {
  const { session, roles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: homeForRoles(roles), replace: true });
    }
  }, [loading, session, roles, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="min-w-0">
          <BrandLogo to="/" size="md" />
        </div>
        <nav className="flex shrink-0 items-center gap-1.5 text-sm">
          <Link
            to="/chauffeurs"
            className="hidden rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Trouver
          </Link>
          {!loading && session ? (
            <Link
              to={homeForRoles(roles)}
              className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground sm:px-4"
            >
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="rounded-lg px-2.5 py-2 text-muted-foreground hover:text-foreground sm:px-3"
              >
                Connexion
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "driver" }}
                className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground sm:px-4"
              >
                Inscription
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* HERO */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 sm:px-5 sm:pt-10 sm:pb-14">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="min-w-0">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground sm:text-xs">
              <Sparkles className="size-3.5 shrink-0" />
              <span className="truncate">Le réseau des chauffeurs indépendants</span>
            </p>
            <h1 className="mt-4 max-w-3xl text-[1.75rem] leading-tight font-semibold text-balance sm:mt-5 sm:text-4xl lg:text-5xl">
              Trouvez les chauffeurs qui vous correspondent.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:mt-4 sm:text-lg">
              Découvrez leur vitrine, ajoutez vos chauffeurs préférés à votre réseau et
              retrouvez-les facilement quand vous en avez besoin.
            </p>
            <div className="mt-5 grid gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
              <Link
                to="/chauffeurs"
                className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground shadow-sm"
              >
                Trouver un chauffeur
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "driver" }}
                className="rounded-xl border border-border bg-card px-5 py-3 text-center text-sm font-medium"
              >
                Créer ma vitrine chauffeur
              </Link>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-6 sm:text-sm">
              {heroPoints.map((t) => (
                <li key={t} className="inline-flex min-w-0 items-center gap-1.5">
                  <Check className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Aperçu visuel de profils ReLink */}
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-3">
              {previewCards.map((c) => (
                <DriverPreviewCard key={c.name} card={c} />
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Aperçu de vitrines ReLink et de leurs styles personnalisables.
            </p>
          </div>
        </div>
      </section>

      {/* POUR LES CLIENTS */}
      <section className="border-y border-border bg-card/60 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Pour les clients
          </p>
          <h2 className="mt-2 text-xl font-semibold text-balance sm:text-2xl">
            Vos chauffeurs, réunis au même endroit.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Découvrez des professionnels dans votre secteur et construisez votre propre réseau de
            chauffeurs.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {clientPoints.map((p) => (
              <li key={p.title} className="surface flex min-w-0 gap-3 p-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <p.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{p.title}</span>
                  <span className="block text-sm text-muted-foreground">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
            Construisez votre réseau personnel de chauffeurs et retrouvez facilement les profils qui
            vous intéressent.
          </p>
          <Link
            to="/chauffeurs"
            className="mt-4 block rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground sm:inline-block"
          >
            Découvrir les chauffeurs
          </Link>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-14">
        <h2 className="text-xl font-semibold text-balance sm:text-2xl">
          Découvrez. Ajoutez. Retrouvez. Contactez.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          ReLink vous aide à construire votre propre réseau de chauffeurs indépendants.
        </p>

        <ol className="relative mt-6 grid gap-3 border-l border-border pl-6 sm:grid-cols-2 sm:gap-4 sm:border-l-0 sm:pl-0 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="surface relative min-w-0 p-4 sm:p-5">
              <span
                className="absolute top-6 -left-[1.9rem] size-3 rounded-full border-2 border-background bg-primary sm:hidden"
                aria-hidden
              />
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <s.icon className="size-4" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-balance">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* POUR LES CHAUFFEURS */}
      <section className="border-y border-border bg-card/60 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Pour les chauffeurs
          </p>
          <h2 className="mt-2 text-xl font-semibold text-balance sm:text-2xl">
            Votre vitrine professionnelle, à votre image.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Créez une page professionnelle complète, partagez-la avec vos clients et développez
            votre visibilité au-delà des plateformes.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {driverPoints.map((p) => (
              <li key={p.title} className="surface flex min-w-0 gap-3 p-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <p.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{p.title}</span>
                  <span className="block text-sm text-muted-foreground">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Thèmes */}
          <div className="surface mt-6 p-4 sm:p-6">
            <p className="text-sm font-medium">Choisissez le style de votre vitrine</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  "relink_classic",
                  "professional_blue",
                  "dynamic_red",
                  "luxury_black_gold",
                  "women_for_women",
                ] as BookingThemeId[]
              ).map((id) => {
                const t = getBookingTheme(id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ background: t.vars["--driver-primary"] }}
                      aria-hidden
                    />
                    {t.name}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="surface mt-4 p-4 sm:p-6">
            <h3 className="font-semibold">Créez votre vitrine ReLink</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Quelques minutes suffisent pour commencer à construire votre présence professionnelle.
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup", role: "driver" }}
              className="mt-4 block rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground sm:inline-block"
            >
              Créer ma vitrine
            </Link>
          </div>
        </div>
      </section>

      {/* QR CODE */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-14">
        <div className="surface grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-center">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-balance sm:text-2xl">
              Votre vitrine vous accompagne partout.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Dans votre véhicule, sur une carte de visite ou vos réseaux : partagez votre QR Code
              ou votre lien ReLink pour permettre à vos clients de retrouver votre profil.
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup", role: "driver" }}
              className="mt-4 block rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground sm:inline-block"
            >
              Créer ma vitrine
            </Link>
          </div>
          <ol className="grid gap-2 sm:grid-cols-3">
            {[
              { icon: QrCode, label: "QR Code" },
              { icon: Smartphone, label: "Un scan" },
              { icon: Sparkles, label: "Votre vitrine" },
            ].map((s) => (
              <li
                key={s.label}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 sm:flex-col sm:gap-2 sm:p-4 sm:text-center"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <s.icon className="size-5" />
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* WOMAN FOR WOMAN */}
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-5 sm:pb-14">
        <div
          className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          style={{
            borderColor: "oklch(0.9 0.015 335)",
            background:
              "linear-gradient(135deg, oklch(0.97 0.02 320), oklch(0.97 0.025 345), oklch(0.99 0.008 330))",
          }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "oklch(0.93 0.035 345)", color: "oklch(0.4 0.12 325)" }}
            >
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold" style={{ color: "oklch(0.35 0.12 320)" }}>
                {WFW_LABEL}
              </p>
              <p className="text-sm" style={{ color: "oklch(0.42 0.06 325)" }}>
                Un espace dédié permettant aux chauffeuses éligibles de proposer une vitrine
                réservée aux clientes.
              </p>
            </div>
          </div>
          <Link
            to="/chauffeurs"
            className="shrink-0 rounded-xl px-5 py-3 text-center text-sm font-medium"
            style={{ background: "oklch(0.45 0.16 318)", color: "oklch(0.99 0.005 330)" }}
          >
            Découvrir {WFW_LABEL}
          </Link>
        </div>
      </section>

      {/* CE QU'EST RELINK */}
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-5 sm:pb-14">
        <div className="surface p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-balance sm:text-2xl">
            ReLink crée le lien. Le chauffeur reste indépendant.
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            ReLink est un réseau professionnel permettant aux chauffeurs indépendants de présenter
            leur activité et aux clients de les découvrir, de les enregistrer et de les contacter.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            ReLink n'organise pas la prestation de transport et n'intervient pas dans la relation
            commerciale conclue entre le client et le chauffeur.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.label} className="min-w-0 rounded-xl border border-border bg-card p-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <p.icon className="size-4" />
                </span>
                <p className="mt-3 text-sm font-medium">{p.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-5 sm:pb-16">
        <div className="surface p-5 text-center sm:p-8">
          <h2 className="text-xl font-semibold text-balance sm:text-3xl">
            Votre réseau commence ici.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Vous cherchez un chauffeur ? Découvrez les professionnels présents sur ReLink. Vous êtes
            chauffeur ? Créez votre vitrine et faites-vous connaître.
          </p>
          <div className="mt-5 grid gap-2 sm:flex sm:justify-center sm:gap-3">
            <Link
              to="/chauffeurs"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Trouver un chauffeur <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup", role: "driver" }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium"
            >
              <Share2 className="size-4" /> Créer ma vitrine
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border px-4 py-8 text-sm sm:px-5">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          <div className="min-w-0">
            <BrandLogo size="sm" />
            <p className="mt-3 text-xs text-muted-foreground">
              Le réseau des chauffeurs indépendants : vitrine professionnelle, découverte et contact
              direct.
            </p>
          </div>
          <nav className="grid gap-2 text-muted-foreground">
            <Link to="/chauffeurs" className="hover:text-foreground">
              Trouver un chauffeur
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup", role: "driver" }}
              className="hover:text-foreground"
            >
              Créer ma vitrine
            </Link>
            <Link to="/auth" search={{ mode: "signin" }} className="hover:text-foreground">
              Connexion
            </Link>
            <Link to="/aide" className="hover:text-foreground">
              Aide
            </Link>
          </nav>
          <nav className="grid gap-2 text-muted-foreground">
            <Link to="/legal/$doc" params={{ doc: "mentions" }} className="hover:text-foreground">
              Mentions légales
            </Link>
            <Link
              to="/legal/$doc"
              params={{ doc: "confidentialite" }}
              className="hover:text-foreground"
            >
              Confidentialité
            </Link>
            <Link to="/legal/$doc" params={{ doc: "cgu" }} className="hover:text-foreground">
              Conditions d'utilisation
            </Link>
            <Link to="/legal/$doc" params={{ doc: "donnees" }} className="hover:text-foreground">
              Données personnelles
            </Link>
          </nav>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          ReLink est un réseau professionnel de chauffeurs indépendants. ReLink n'organise, ne gère
          et n'exécute aucune prestation de transport : le tarif définitif et les conditions sont
          convenus directement entre le client et le chauffeur.
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {BRAND.name} — le réseau des chauffeurs indépendants.
        </p>
      </footer>
    </div>
  );
}
