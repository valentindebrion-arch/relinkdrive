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
          "Questions fréquentes sur l'utilisation de Relink, l'outil de réservation utilisé par votre chauffeur, et support technique du logiciel.",
      },
      { property: "og:title", content: `Centre d'aide — ${BRAND.name}` },
      {
        property: "og:description",
        content: "Aide sur le logiciel Relink ; les questions liées à la course vont à votre chauffeur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const FAQ = [
  {
    q: "Comment ajouter un chauffeur ?",
    a: "Scannez le QR code de votre chauffeur ou ouvrez le lien personnel qu'il vous a partagé, puis appuyez sur « Ajouter à mes chauffeurs ». Il apparaît ensuite dans l'onglet Chauffeurs. Seuls les chauffeurs que vous ajoutez vous-même apparaissent : aucun chauffeur inconnu ne vous est proposé.",
  },
  {
    q: "Comment envoyer une demande de réservation ?",
    a: "Depuis l'accueil, sélectionnez votre chauffeur, indiquez votre trajet puis choisissez « Maintenant » ou « Planifier ». La demande est envoyée directement à votre chauffeur, qui l'accepte ou la refuse lui-même et vous répond avec son horaire et son tarif.",
  },
  {
    q: "Qui fixe le tarif ?",
    a: "Le tarif est celui de votre chauffeur : il définit ses prix, ses conditions et ses modalités de paiement. Relink se contente d'afficher et de transmettre ces informations.",
  },
  {
    q: "Comment obtenir ma facture ?",
    a: "La facture est émise par votre chauffeur à la fin de la course. Retrouvez-la dans Courses → Terminées.",
  },
  {
    q: "Comment annuler ou modifier une réservation ?",
    a: "Ouvrez la course concernée depuis l'onglet Courses et utilisez le bouton d'annulation ; votre chauffeur en est immédiatement informé. Pour un changement d'horaire ou de lieu, contactez-le directement.",
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
        {BRAND.name} est l'outil de réservation utilisé par votre chauffeur. Voici comment
        l'utiliser, et qui contacter selon votre question.
      </p>

      <section className="surface mt-6 border-primary/30 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Car className="size-4 text-primary" /> Une question sur votre course
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Horaire, lieu de rendez-vous, retard, véhicule, tarif, modification, annulation, objet
          oublié : cette demande concerne votre course. Contactez directement votre chauffeur, seul
          responsable de la prestation.
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
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="surface mt-4 p-5">
        <h2 className="text-base font-semibold">Signaler un problème technique</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Page inaccessible, erreur d'affichage, bouton sans effet, problème de connexion,
          notification non reçue, réservation qui ne s'enregistre pas : l'équipe {BRAND.name}
          {" "}intervient uniquement sur le fonctionnement du logiciel, du lundi au vendredi de 9h à
          18h.
        </p>
        <a
          href="mailto:support@relink.app"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
        >
          <Mail className="size-4" /> support@relink.app
        </a>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <LifeBuoy className="mt-0.5 size-4 shrink-0" />
          Vous pouvez aussi utiliser « Signaler un problème technique » dans l'onglet Profil.
        </p>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">{POSITIONING.responsibility}</p>
    </div>
  );
}

