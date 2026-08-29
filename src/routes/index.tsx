import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  QrCode,
  ShieldCheck,
  Users,
  Search,
  Sparkles,
  Car,
  Heart,
  MapPin,
  Phone,
  Check,
  Eye,
} from "lucide-react";
import { BRAND, POSITIONING } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, homeForRoles } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} — Le réseau des chauffeurs VTC` },
      {
        name: "description",
        content:
          "ReLink est l'annuaire des chauffeurs VTC indépendants. Découvrez des chauffeurs professionnels dans votre secteur, consultez leur vitrine et gardez vos chauffeurs préférés dans votre réseau.",
      },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { property: "og:description", content: BRAND.subline },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: Search,
    title: "Découvrir",
    text: "Explorez les chauffeurs professionnels présents dans votre secteur.",
  },
  {
    icon: Eye,
    title: "Consulter",
    text: "Vitrine complète : véhicules, prestations, zones desservies, tarifs indicatifs.",
  },
  {
    icon: Heart,
    title: "Garder",
    text: "Ajoutez un chauffeur à « Mes chauffeurs » et retrouvez-le en un instant.",
  },
  {
    icon: Phone,
    title: "Contacter",
    text: "Vous joignez le chauffeur directement. ReLink s'arrête là.",
  },
];

const driverPoints = [
  {
    icon: Eye,
    title: "Faites-vous connaître au-delà des plateformes",
    text: "Une vitrine professionnelle publique, indexée et partageable.",
  },
  {
    icon: Car,
    title: "Présentez vos véhicules",
    text: "Photos, gamme, capacité, équipements : montrez ce que vous proposez vraiment.",
  },
  {
    icon: QrCode,
    title: "Un QR code personnel",
    text: "Dans votre véhicule, sur vos cartes de visite : vos clients vous retrouvent facilement.",
  },
  {
    icon: Users,
    title: "Développez votre réseau de clients directs",
    text: "Chaque client qui vous enregistre vous garde à portée de main.",
  },
];

const clientPoints = [
  {
    icon: MapPin,
    title: "Des chauffeurs près de chez vous",
    text: "Recherchez par ville, secteur, type de véhicule ou prestation.",
  },
  {
    icon: ShieldCheck,
    title: "Profils vérifiés",
    text: "Les informations professionnelles des chauffeurs sont contrôlées par ReLink.",
  },
  {
    icon: Heart,
    title: "Votre réseau personnel",
    text: "Constituez votre carnet de chauffeurs de confiance, trajet après trajet.",
  },
  {
    icon: Phone,
    title: "Contact direct",
    text: "Téléphone, SMS, WhatsApp, site : vous échangez directement avec le professionnel.",
  },
];

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
            Annuaire
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
                <span className="sm:hidden">Inscription</span>
                <span className="hidden sm:inline">Je suis chauffeur</span>
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 sm:px-5 sm:pt-10 sm:pb-14">
        <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground sm:text-xs">
          <Sparkles className="size-3.5 shrink-0" />
          <span className="truncate">Le réseau des chauffeurs VTC indépendants</span>
        </p>
        <h1 className="mt-4 max-w-3xl text-[1.75rem] leading-tight font-semibold text-balance sm:mt-5 sm:text-4xl lg:text-5xl">
          {BRAND.tagline}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:mt-4 sm:text-lg">
          {BRAND.subline}
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
            Je suis chauffeur
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-6 sm:text-sm">
          {["Profils vérifiés", "Contact direct", "Aucune commission", "Aucune réservation"].map(
            (t) => (
              <li key={t} className="inline-flex min-w-0 items-center gap-1.5">
                <Check className="size-4 shrink-0 text-primary" />
                <span className="truncate">{t}</span>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="border-y border-border bg-card/60 py-10 sm:py-14">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:gap-6 sm:px-5 lg:grid-cols-2">
          <div className="surface min-w-0 p-4 sm:p-6">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              Pour les chauffeurs
            </p>
            <h2 className="mt-2 text-xl font-semibold text-balance sm:text-2xl">
              Votre vitrine professionnelle
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Être visible, présenter son activité, développer son réseau et être retrouvé
              facilement par ses clients.
            </p>

            <ul className="mt-5 grid gap-4">
              {driverPoints.map((p) => (
                <li key={p.title} className="flex min-w-0 gap-3">
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
            <Link
              to="/auth"
              search={{ mode: "signup", role: "driver" }}
              className="mt-6 block rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground sm:inline-block"
            >
              {BRAND.driverPromise}
            </Link>
          </div>

          <div className="surface min-w-0 p-4 sm:p-6">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              Pour les clients
            </p>
            <h2 className="mt-2 text-xl font-semibold text-balance sm:text-2xl">
              Votre carnet de chauffeurs
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Découvrez, comparez, enregistrez. Le jour où vous en avez besoin, vos chauffeurs sont
              déjà là.
            </p>

            <ul className="mt-5 grid gap-4">
              {clientPoints.map((p) => (
                <li key={p.title} className="flex min-w-0 gap-3">
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
            <Link
              to="/chauffeurs"
              className="mt-6 block rounded-xl border border-border bg-card px-5 py-3 text-center text-sm font-medium sm:inline-block"
            >
              Explorer l'annuaire
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-14">
        <h2 className="text-xl font-semibold sm:text-2xl">
          Trouver. Découvrir. Garder. Contacter.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          ReLink aide à trouver un chauffeur. ReLink ne gère pas la course.
        </p>

        <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="surface min-w-0 p-4 sm:p-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <s.icon className="size-4" />
              </div>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Étape {i + 1}</p>
              <h3 className="mt-1 font-semibold text-balance">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-5 sm:pb-16">
        <div className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-semibold">Profils vérifiés</p>
              <p className="text-sm text-muted-foreground">
                Les informations professionnelles des chauffeurs sont contrôlées par notre équipe
                avant l'attribution du badge « Profil vérifié ».
              </p>
            </div>
          </div>
          <Link
            to="/verification"
            className="shrink-0 rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground"
          >
            Comprendre la vérification
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        <p className="mx-auto max-w-2xl">{POSITIONING.responsibility}</p>
        <p className="mt-2">{BRAND.name} — le réseau des chauffeurs VTC.</p>
      </footer>
    </div>
  );
}
