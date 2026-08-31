import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, LifeBuoy, Car } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND, POSITIONING } from "@/lib/brand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: `Centre d'aide — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Questions fréquentes sur ReLink, le réseau des chauffeurs VTC : ajouter un chauffeur, comprendre l'estimation indicative, contacter un professionnel.",
      },
      { property: "og:title", content: `Centre d'aide — ${BRAND.name}` },
      {
        property: "og:description",
        content:
          "Aide sur ReLink ; toute question liée à une prestation se traite directement avec le chauffeur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const FAQ = [
  {
    q: "Comment ajouter un chauffeur à mon réseau ?",
    a: "Scannez son QR code ReLink, ouvrez son lien personnel ou trouvez-le dans l'annuaire, puis appuyez sur « Ajouter à mes chauffeurs ». Il apparaît ensuite dans l'onglet Mes chauffeurs.",
  },
  {
    q: "Puis-je réserver une course sur ReLink ?",
    a: "Non. ReLink est un annuaire : il vous permet de découvrir des chauffeurs et d'accéder à leurs coordonnées professionnelles. La course, son tarif et ses conditions se conviennent directement avec le chauffeur.",
  },
  {
    q: "À quoi correspond l'estimation indicative ?",
    a: "Elle est calculée à partir des informations tarifaires renseignées par le chauffeur et s'affiche sous forme de fourchette. Aucune demande n'est envoyée : le tarif définitif, la disponibilité et les conditions sont à convenir avec le chauffeur.",
  },
  {
    q: "Que signifie le badge « Profil vérifié » ?",
    a: "Notre équipe a contrôlé les informations professionnelles du chauffeur : identité, carte professionnelle, entreprise, assurance et véhicule. Ce n'est pas une garantie de la qualité de la prestation.",
  },
  {
    q: "Comment contacter un chauffeur ?",
    a: "Depuis son profil, le bloc « Contacter le chauffeur » regroupe les moyens qu'il a publiés : téléphone, SMS, WhatsApp, site internet et réseaux sociaux.",
  },
  {
    q: "Je me connecte avec Google, ai-je un mot de passe ?",
    a: "Non. Si vous n'utilisez que Google, aucun mot de passe n'existe sur votre compte. Vous pouvez en créer un en demandant un lien de réinitialisation depuis l'onglet Profil.",
  },
];

function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex justify-center">
        <BrandLogo to="/" size="md" />
      </div>
      <Link
        to="/espace/parametres"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mon profil
      </Link>

      <h1 className="text-2xl font-bold">Centre d'aide</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {BRAND.name} est le réseau des chauffeurs VTC. Voici comment l'utiliser, et qui contacter
        selon votre question.
      </p>

      <section className="surface mt-6 border-primary/30 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Car className="size-4 text-primary" /> Une question sur une prestation
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Horaire, lieu de rendez-vous, véhicule, tarif, disponibilité, objet oublié : ces questions
          concernent la prestation. Contactez directement le chauffeur, seul responsable.
        </p>
        <Link
          to="/espace/chauffeurs"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Contacter mon chauffeur
        </Link>
      </section>

      <section className="surface mt-4 p-5">
        <h2 className="text-base font-semibold">Questions fréquentes</h2>
        <Accordion type="single" collapsible className="mt-2">
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} value={`q${i}`}>
              <AccordionTrigger className="text-left text-sm">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="surface mt-4 p-5">
        <h2 className="text-base font-semibold">Signaler un problème technique</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Page inaccessible, erreur d'affichage, bouton sans effet, problème de connexion,
          notification non reçue : l'équipe {BRAND.name} intervient uniquement sur le fonctionnement
          du logiciel, du lundi au vendredi de 9h à 18h.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/support/nouveau"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <LifeBuoy className="size-4" /> Contacter le support ReLink
          </Link>
          <Link
            to="/support"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
          >
            <Mail className="size-4" /> Mes demandes
          </Link>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <LifeBuoy className="mt-0.5 size-4 shrink-0" />
          Vous pouvez aussi utiliser « Signaler un problème technique » dans l'onglet Profil.
        </p>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">{POSITIONING.responsibility}</p>
    </div>
  );
}
