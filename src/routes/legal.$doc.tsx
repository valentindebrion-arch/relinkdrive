import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand";

type Doc = { title: string; description: string; sections: { heading: string; body: string[] }[] };

const DOCS: Record<string, Doc> = {
  cgu: {
    title: "Conditions générales d'utilisation",
    description:
      "Les règles d'utilisation de Relink pour les passagers et les chauffeurs indépendants.",
    sections: [
      {
        heading: "1. Objet",
        body: [
          "Relink est un outil de mise en relation entre un passager et un chauffeur VTC indépendant qu'il a lui-même ajouté à son carnet. Relink n'est pas un transporteur et n'organise aucune course.",
        ],
      },
      {
        heading: "2. Compte",
        body: [
          "Vous vous engagez à fournir des informations exactes et à conserver vos identifiants confidentiels. Un compte est strictement personnel.",
        ],
      },
      {
        heading: "3. Courses et prix",
        body: [
          "Le prix, les conditions et l'exécution de la course relèvent exclusivement du chauffeur indépendant. Les estimations affichées sont indicatives.",
        ],
      },
      {
        heading: "4. Résiliation",
        body: [
          "Vous pouvez demander la suppression de votre compte à tout moment depuis l'onglet Profil. Certaines données peuvent être conservées pour répondre aux obligations comptables et légales.",
        ],
      },
    ],
  },
  cgv: {
    title: "Conditions générales de vente",
    description:
      "Prix, envoi d'une demande de course et conditions d'annulation applicables sur Relink.",
    sections: [
      {
        heading: "1. Tarif affiché",
        body: [
          "Le montant présenté avant l'envoi d'une demande est calculé par Relink à partir de l'itinéraire estimé : 1,90 € par kilomètre, avec un minimum de 9 €, arrondi à l'euro supérieur (l'écart d'arrondi revient au chauffeur).",
          "Ce montant est une estimation transmise au chauffeur. Le chauffeur peut proposer un autre horaire ou un autre prix lorsqu'il répond à la demande : le prix devient ferme uniquement lorsque la demande est acceptée aux conditions affichées.",
        ],
      },
      {
        heading: "2. Envoi d'une demande",
        body: [
          "L'envoi d'une demande ne vaut pas réservation. La demande reste en attente jusqu'à son acceptation par le chauffeur indépendant, qui reste libre de l'accepter ou de la refuser.",
        ],
      },
      {
        heading: "3. Annulation",
        body: [
          "Vous pouvez annuler une demande ou une course depuis l'application. Relink n'applique aucun frais d'annulation et ne prélève aucun paiement : le règlement de la course s'effectue directement auprès du chauffeur, uniquement si la course est réalisée.",
        ],
      },
      {
        heading: "4. Paiement",
        body: [
          "Relink n'encaisse pas les courses. Le paiement, la facturation et toute condition particulière relèvent du chauffeur indépendant qui réalise la course.",
        ],
      },
    ],
  },
  confidentialite: {

    title: "Politique de confidentialité",
    description: "Comment Relink collecte, utilise et protège vos données personnelles.",
    sections: [
      {
        heading: "Données collectées",
        body: [
          "Identité (nom, e-mail, téléphone), adresses de course, historique des courses et factures, et si vous l'autorisez, votre position et vos notifications push.",
        ],
      },
      {
        heading: "Usages",
        body: [
          "Vos données servent uniquement à créer votre compte, transmettre vos demandes au chauffeur que vous avez choisi, éditer vos factures et assurer le support.",
        ],
      },
      {
        heading: "Partage",
        body: [
          "Seul le chauffeur concerné par une demande accède aux informations nécessaires à cette course. Aucune revente de données n'est effectuée.",
        ],
      },
      {
        heading: "Vos droits",
        body: [
          "Accès, rectification, export et suppression : ces actions sont disponibles depuis l'onglet Profil, section « Gestion du compte ».",
        ],
      },
    ],
  },
  mentions: {
    title: "Mentions légales",
    description: "Éditeur, hébergement et contact de la plateforme Relink.",
    sections: [
      {
        heading: "Éditeur",
        body: ["Relink — plateforme en cours de constitution. Contact : contact@relink.app"],
      },
      {
        heading: "Hébergement",
        body: ["Application et base de données hébergées au sein de l'Union européenne."],
      },
      {
        heading: "Chauffeurs",
        body: [
          "Chaque chauffeur présent sur Relink exerce en tant que professionnel indépendant, sous sa propre responsabilité et avec ses propres mentions légales.",
        ],
      },
    ],
  },
  donnees: {
    title: "Données personnelles et consentements",
    description: "Gestion des consentements et des données personnelles sur Relink.",
    sections: [
      {
        heading: "Consentements",
        body: [
          "La position et les notifications push sont facultatives et se règlent depuis l'onglet Profil, section « Préférences ». Vous pouvez les retirer à tout moment.",
        ],
      },
      {
        heading: "Communications",
        body: [
          "Les messages liés au déroulement d'une course (confirmation, départ, facture) sont indispensables au service. Les communications commerciales sont facultatives.",
        ],
      },
      {
        heading: "Conservation",
        body: [
          "Les factures sont conservées pendant la durée légale applicable, même après la suppression du compte.",
        ],
      },
    ],
  },
};

export const Route = createFileRoute("/legal/$doc")({
  loader: ({ params }) => {
    const doc = DOCS[params.doc];
    if (!doc) throw notFound();
    return doc;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — ${BRAND.name}` : `Informations légales — ${BRAND.name}`;
    const description = loaderData?.description ?? "Informations légales Relink.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => <LegalFallback />,
  notFoundComponent: () => <LegalFallback />,
  component: LegalPage,
});

function LegalFallback() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Ce document n'existe pas.</p>
      <Link to="/espace/parametres" className="mt-3 inline-block text-sm font-medium text-primary">
        Retour au profil
      </Link>
    </div>
  );
}

function LegalPage() {
  const doc = Route.useLoaderData();
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
      <h1 className="text-2xl font-bold">{doc.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
      <div className="mt-6 space-y-5">
        {doc.sections.map((s) => (
          <section key={s.heading} id={slugify(s.heading)} className="surface scroll-mt-6 p-5">
            <h2 className="text-base font-semibold">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-2 text-sm text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
