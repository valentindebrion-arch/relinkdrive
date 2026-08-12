import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, LifeBuoy } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";
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
          "Questions fréquentes, contact et assistance pour utiliser Relink avec votre chauffeur VTC.",
      },
      { property: "og:title", content: `Centre d'aide — ${BRAND.name}` },
      { property: "og:description", content: "Toutes les réponses pour utiliser Relink au quotidien." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const FAQ = [
  {
    q: "Comment ajouter un chauffeur à mon carnet ?",
    a: "Scannez le QR code de votre chauffeur ou ouvrez le lien de sa fiche publique, puis appuyez sur « Ajouter à mes chauffeurs ». Il apparaît ensuite dans l'onglet Chauffeurs.",
  },
  {
    q: "Comment demander une course ?",
    a: "Depuis l'accueil, indiquez votre destination puis choisissez « Maintenant » ou « Planifier ». Votre chauffeur reçoit la demande et vous répond avec un prix et un horaire.",
  },
  {
    q: "Comment obtenir ma facture ?",
    a: "Une facture est générée automatiquement à la fin de chaque course payante. Retrouvez-la dans Courses → Terminées.",
  },
  {
    q: "Comment annuler une course ?",
    a: "Ouvrez la course concernée depuis l'onglet Courses et utilisez le bouton d'annulation. Le chauffeur en est immédiatement informé.",
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
        Les réponses aux questions les plus fréquentes et les moyens de nous joindre.
      </p>

      <section className="surface mt-6 p-5">
        <h2 className="text-base font-semibold">Questions fréquentes</h2>
        <Accordion type="single" collapsible className="mt-2">
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} value={`q${i}`}>
              <AccordionTrigger className="text-left text-sm">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="surface mt-4 p-5">
        <h2 className="text-base font-semibold">Nous contacter</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Notre équipe répond du lundi au vendredi, de 9h à 18h.
        </p>
        <a
          href="mailto:support@relink.app"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Mail className="size-4" /> support@relink.app
        </a>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <LifeBuoy className="mt-0.5 size-4 shrink-0" />
          Pour un problème lié à une course précise, utilisez « Signaler un problème » dans l'onglet
          Profil : votre course sera automatiquement rattachée au signalement.
        </p>
      </section>
    </div>
  );
}
