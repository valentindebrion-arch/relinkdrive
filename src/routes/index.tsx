import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  QrCode,
  ShieldCheck,
  Users,
  Receipt,
  CalendarClock,
  Sparkles,
  Car,
  BadgeEuro,
  Bell,
  MapPin,
  Star,
  Check,
} from "lucide-react";
import { BRAND, POSITIONING } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, homeForRoles } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} — Logiciel de réservation des chauffeurs indépendants` },
      {
        name: "description",
        content:
          "ReLink est le logiciel de planning, de réservation et de relation client des chauffeurs VTC indépendants. Chaque chauffeur partage son espace avec ses propres clients. Zéro commission.",
      },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      {
        property: "og:description",
        content: BRAND.subline,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});


const steps = [
  { icon: QrCode, title: "Le chauffeur partage son accès", text: "QR code ou lien personnel remis à ses clients à la fin de la course." },
  { icon: Users, title: "Le client ajoute son chauffeur", text: "Il accède à l'espace de réservation de ce chauffeur, et de lui seul." },
  { icon: CalendarClock, title: "Les demandes arrivent au chauffeur", text: "Le client consulte les disponibilités ; le chauffeur accepte ou refuse lui-même." },
  { icon: Receipt, title: "Course, suivi et facture", text: "Suivi côté client, planning, facturation et statistiques côté chauffeur." },
];

const driverPoints = [
  { icon: BadgeEuro, title: "0 % de commission", text: "Vos tarifs, votre TVA, votre chiffre d'affaires. ReLink ne prend rien sur vos courses." },
  { icon: Users, title: "Vos clients restent vos clients", text: "Aucune mise en concurrence, aucune attribution : ReLink ne vous envoie jamais de course." },
  { icon: CalendarClock, title: "Votre planning, vos disponibilités", text: "Vos horaires, vos absences : vos clients ne réservent que sur vos créneaux libres." },
  { icon: Receipt, title: "Facturation automatique", text: "Factures PDF conformes (franchise ou TVA), suivi clients et statistiques d'activité." },
];

const clientPoints = [
  { icon: Car, title: "Réserver auprès de son chauffeur", text: "Vous accédez à l'espace de réservation des chauffeurs que vous avez ajoutés." },
  { icon: MapPin, title: "Une demande en 3 étapes", text: "Adresse, options, confirmation. La demande part directement à votre chauffeur." },
  { icon: Bell, title: "Réponse et suivi", text: "Vous savez quand votre chauffeur a répondu, et où en est votre trajet." },
  { icon: Star, title: "Tarif indiqué par le chauffeur", text: "Le prix est celui de votre chauffeur ; la facture est émise par lui." },
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
            Chauffeurs
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
                <span className="hidden sm:inline">Créer mon compte chauffeur</span>
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 sm:px-5 sm:pt-10 sm:pb-14">
        <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground sm:text-xs">
          <Sparkles className="size-3.5 shrink-0" />
          <span className="truncate">Logiciel pour chauffeurs indépendants · sans commission</span>
        </p>
        <h1 className="mt-4 max-w-3xl text-[1.75rem] leading-tight font-semibold text-balance sm:mt-5 sm:text-4xl lg:text-5xl">
          {BRAND.tagline}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:mt-4 sm:text-lg">
          {BRAND.subline} Chaque chauffeur dispose de son propre espace de réservation : il partage
          son lien ou son QR code avec ses clients, eux consultent ses disponibilités et lui
          envoient leurs demandes directement. Le chauffeur accepte ou refuse lui-même, fixe ses
          tarifs et garde la maîtrise de sa clientèle.
        </p>
        <div className="mt-5 grid gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup", role: "driver" }}
            className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground shadow-sm"
          >
            Je suis chauffeur VTC
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup", role: "client" }}
            className="rounded-xl border border-border bg-card px-5 py-3 text-center text-sm font-medium"
          >
            Mon chauffeur m'a partagé son lien
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-6 sm:text-sm">
          {["Sans commission", "Aucune attribution de course", "Réservation directe", "Factures conformes"].map((t) => (
            <li key={t} className="inline-flex min-w-0 items-center gap-1.5">
              <Check className="size-4 shrink-0 text-primary" />
              <span className="truncate">{t}</span>
            </li>
          ))}
        </ul>

      </section>


      {/* Deux publics, deux promesses */}
      <section className="border-y border-border bg-card/60 py-10 sm:py-14">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:gap-6 sm:px-5 lg:grid-cols-2">
          <div className="surface min-w-0 p-4 sm:p-6">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Pour les chauffeurs</p>
            <h2 className="mt-2 text-xl font-semibold text-balance sm:text-2xl">
              Votre outil de réservation, pas une plateforme
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous partagez votre lien ou votre QR code avec vos clients. Ils réservent auprès de
              vous, jamais auprès de ReLink : vous restez seul décisionnaire de vos courses.
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
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Pour les passagers</p>
            <h2 className="mt-2 text-xl font-semibold text-balance sm:text-2xl">
              L'espace de réservation de vos chauffeurs
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous ajoutez les chauffeurs que vous connaissez, consultez leurs disponibilités et
              leur envoyez vos demandes directement. Aucun chauffeur inconnu ne vous est proposé.
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
              to="/auth"
              search={{ mode: "signup", role: "client" }}
              className="mt-6 block rounded-xl border border-border bg-card px-5 py-3 text-center text-sm font-medium sm:inline-block"
            >
              Créer mon compte passager
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-14">
        <h2 className="text-xl font-semibold sm:text-2xl">Comment ça marche</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Le chauffeur ouvre son espace à ses clients ; la relation reste directe entre eux.
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
              <p className="font-semibold">Chauffeurs vérifiés, données protégées</p>
              <p className="text-sm text-muted-foreground">
                Documents contrôlés par notre équipe, géolocalisation temporaire et uniquement pendant
                une course, notes privées invisibles aux clients.
              </p>
            </div>
          </div>
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="shrink-0 rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground"
          >
            Accéder à mon espace
          </Link>
        </div>
      </section>


      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        <p className="mx-auto max-w-2xl">{POSITIONING.responsibility}</p>
        <p className="mt-2">
          {BRAND.name} — aucune commission sur les courses. Nom et identité provisoires.
        </p>
      </footer>

    </div>
  );
}
