import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { QrCode, ShieldCheck, Users, Receipt, CalendarClock, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useAuth, homeForRoles } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} — L'outil post-course des chauffeurs VTC indépendants` },
      {
        name: "description",
        content:
          "Après la course, votre client vous ajoute à son carnet privé de chauffeurs de confiance. Zéro commission, zéro mise en concurrence.",
      },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      {
        property: "og:description",
        content: "Fidélisez vos clients après la course : QR code, demandes, planning et factures.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: QrCode, title: "Vous présentez votre QR code", text: "À la fin de la course, le client ouvre votre page personnelle." },
  { icon: Users, title: "Il vous ajoute à son carnet", text: "La relation est enregistrée : il ne peut réserver qu'auprès de vous." },
  { icon: CalendarClock, title: "Il vous envoie ses demandes", text: "Vous acceptez, proposez un horaire et un tarif, puis confirmez." },
  { icon: Receipt, title: "Vous facturez et suivez", text: "Planning, CRM, factures et statistiques mis à jour automatiquement." },
];

function Landing() {
  const { session, roles, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/chauffeurs" className="rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
            Chauffeurs
          </Link>
          {!loading && session ? (
            <Link
              to={homeForRoles(roles)}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
            >
              Mon espace
            </Link>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }} className="rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
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

      <section className="mx-auto max-w-6xl px-5 pt-10 pb-16">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="size-3.5" /> Outil post-course · sans commission
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
          {BRAND.tagline}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {BRAND.name} n'est pas une plateforme de mise en relation. Aucune recherche publique, aucune
          attribution automatique : vos clients vous ajoutent volontairement après une première course.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup", role: "driver" }}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm"
          >
            {BRAND.driverPromise}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup", role: "client" }}
            className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium"
          >
            Je suis passager
          </Link>
        </div>
      </section>

      <section className="border-y border-border bg-card/60 py-14">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="surface p-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <s.icon className="size-4" />
              </div>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Étape {i + 1}</p>
              <h2 className="mt-1 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 text-primary" />
            <div>
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
        {BRAND.name} — aucune commission sur les courses. Nom et identité provisoires.
      </footer>
    </div>
  );
}
