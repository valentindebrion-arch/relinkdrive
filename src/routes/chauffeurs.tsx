import { createFileRoute, Link } from "@tanstack/react-router";
import {
  QrCode,
  ShieldCheck,
  Users,
  Receipt,
  CalendarClock,
  Car,
  Bot,
  BadgeEuro,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/chauffeurs")({
  head: () => ({
    meta: [
      { title: `Espace chauffeurs VTC — ${BRAND.name}` },
      {
        name: "description",
        content:
          "L'espace dédié aux chauffeurs VTC indépendants : QR code de fidélisation, demandes clients, planning, CRM et facturation, sans commission.",
      },
      { property: "og:title", content: `Espace chauffeurs VTC — ${BRAND.name}` },
      {
        property: "og:description",
        content: "QR code, demandes, planning, CRM et factures : tout votre suivi post-course au même endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DriversPage,
});

const features = [
  { icon: QrCode, title: "QR code de fidélisation", text: "Votre page personnelle que le client scanne en fin de course pour vous ajouter à son carnet." },
  { icon: Users, title: "CRM clients", text: "Historique, statut de fidélité et notes privées invisibles pour vos clients." },
  { icon: CalendarClock, title: "Planning hebdomadaire", text: "Vos courses confirmées et vos créneaux d'indisponibilité en un coup d'œil." },
  { icon: Receipt, title: "Facturation", text: "Factures numérotées avec TVA calculée automatiquement à la fin de la course." },
  { icon: Car, title: "Véhicule & documents", text: "Assurance, contrôle technique et carte VTC suivis avec alertes d'expiration." },
  { icon: Bot, title: "Assistant", text: "Relances clients, factures manquantes et documents à renouveler suggérés chaque jour." },
];

const steps = [
  "Créez votre compte chauffeur et complétez votre entreprise et votre véhicule.",
  "Déposez vos documents : notre équipe vérifie votre dossier.",
  "Publiez votre page et présentez votre QR code après chaque course.",
  "Recevez les demandes, confirmez vos tarifs, facturez.",
];

function DriversPage() {
  const { session, isDriver, loading } = useAuth();
  const signedInDriver = !loading && session && isDriver;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {signedInDriver ? (
            <Link to="/pro" className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">
              Mon espace chauffeur
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                Connexion
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "driver" }}
                className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
              >
                Créer mon compte chauffeur
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-8 pb-14">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <BadgeEuro className="size-3.5" /> 0 % de commission sur vos courses
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
          L'espace dédié aux chauffeurs VTC indépendants
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {BRAND.name} ne vous met jamais en concurrence : vos clients vous ajoutent volontairement après
          une première course, puis réservent directement auprès de vous.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to={signedInDriver ? "/pro" : "/auth"}
            search={signedInDriver ? {} : { mode: "signup", role: "driver" }}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm"
          >
            {signedInDriver ? "Ouvrir mon espace chauffeur" : "Créer mon compte chauffeur"}
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium"
          >
            Retour à l'accueil
          </Link>
        </div>
      </section>

      <section className="border-y border-border bg-card/60 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">Tout votre suivi post-course</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="surface p-5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="size-4" />
                </div>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-semibold">Comment démarrer</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s} className="surface flex gap-3 p-5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground">{s}</p>
            </li>
          ))}
        </ol>

        <div className="surface mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="font-semibold">Dossier vérifié par notre équipe</p>
              <p className="text-sm text-muted-foreground">
                Carte VTC, assurance et documents contrôlés avant la publication de votre page publique.
              </p>
            </div>
          </div>
          <Link
            to={signedInDriver ? "/pro/verification" : "/auth"}
            search={signedInDriver ? undefined : { mode: "signup", role: "driver" }}
            className="shrink-0 rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground"
          >
            {signedInDriver ? "Compléter ma vérification" : "Commencer maintenant"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        {BRAND.name} — aucune commission sur les courses.
      </footer>
    </div>
  );
}
