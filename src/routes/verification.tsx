import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, FileCheck2, Building2, Car, AlertTriangle } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: `Profil vérifié — ce que ReLink contrôle` },
      {
        name: "description",
        content:
          "Le badge « Profil vérifié » de ReLink signifie que les informations professionnelles du chauffeur ont été contrôlées par notre équipe : identité, carte VTC, entreprise, assurance et véhicule.",
      },
      { property: "og:title", content: "Profil vérifié — ce que ReLink contrôle" },
      {
        property: "og:description",
        content: "Ce que signifie exactement le badge « Profil vérifié » sur ReLink.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerificationPage,
});

const checks = [
  {
    icon: FileCheck2,
    title: "Identité et carte professionnelle",
    text: "Pièce d'identité et carte professionnelle VTC (ou licence taxi) en cours de validité.",
  },
  {
    icon: Building2,
    title: "Entreprise déclarée",
    text: "Existence de la structure et cohérence du numéro SIREN/SIRET communiqué.",
  },
  {
    icon: Car,
    title: "Véhicule et assurance",
    text: "Carte grise, assurance professionnelle et, le cas échéant, visite technique.",
  },
];

function VerificationPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <BrandLogo to="/" size="md" />
        <Link to="/chauffeurs" className="text-sm text-muted-foreground hover:text-foreground">
          Annuaire
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <ShieldCheck className="size-3.5" /> Profil vérifié
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-balance sm:text-3xl">
          Ce que signifie la vérification {BRAND.name}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Avant d'attribuer le badge « Profil vérifié », notre équipe contrôle les informations professionnelles
          transmises par le chauffeur. L'objectif est de limiter les faux profils et d'améliorer la confiance des
          utilisateurs de l'annuaire.
        </p>

        <ul className="mt-8 grid gap-4">
          {checks.map((c) => (
            <li key={c.title} className="surface flex gap-3 p-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <c.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{c.title}</span>
                <span className="block text-sm text-muted-foreground">{c.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="surface mt-8 flex gap-3 border-l-4 border-l-primary p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 text-sm">
            <p className="font-medium">Ce que le badge ne garantit pas</p>
            <p className="mt-1 text-muted-foreground">
              « Profil vérifié » atteste uniquement du contrôle documentaire des informations professionnelles au moment
              de la validation. Ce n'est pas une garantie de la qualité de la prestation, du prix pratiqué ni de la
              disponibilité du chauffeur. ReLink n'organise, ne gère et n'exécute aucune course.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/chauffeurs"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Trouver un chauffeur
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup", role: "driver" }}
            className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium"
          >
            Faire vérifier mon profil
          </Link>
        </div>
      </main>
    </div>
  );
}
