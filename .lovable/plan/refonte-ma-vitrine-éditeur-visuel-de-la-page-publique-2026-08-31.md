# Refonte « Ma vitrine » — éditeur visuel de la page publique

## Objectif

`/pro` devient l'unique endroit où le chauffeur construit sa présence ReLink : il voit sa vraie
page publique et l'édite directement, bloc par bloc, avec un bouton **Enregistrer** global.

## 1. Une vitrine, deux modes

Créer un jeu de composants de présentation partagés (`src/components/showcase/`) utilisés à la
fois par la page publique `/chauffeur/$slug` et par l'éditeur `/pro` :

- `ShowcaseHeader` — photo, prénom + initiale, badge vérifié, ville / secteur, badge et teinte
  Woman for Woman (rendu strictement identique dans l'éditeur).
- `ShowcaseAbout` — « À propos de moi ».
- `ShowcaseSectors` — départements d'intervention (utilisés par la page Trouver), gares, aéroports.
- `ShowcaseServices` — prestations.
- `ShowcaseLanguages` — langues parlées.
- `ShowcaseVehicle` — « Mon véhicule » : marque, modèle, année, catégorie, places, bagages,
  équipements.
- `ShowcaseVehiclePhotos` — extérieur / côté / face / intérieur (galerie existante réutilisée).
- `ShowcaseTariffs` — prix au km, course minimum, prise en charge, avec la règle Gratuit / Pro
  existante conservée.
- `ShowcaseContact` — téléphone, SMS, WhatsApp, e-mail, site.
- `ShowcaseLinks` — Instagram, Facebook, TikTok, LinkedIn.

Chaque composant accepte une prop optionnelle `onEdit`. Absente → rendu public pur. Présente →
petit crayon discret, et, si la section est vide, un emplacement « + Ajouter … » au lieu d'un bloc
masqué. Une vitrine toute neuve affiche donc la structure complète à compléter.

## 2. Éditeur `/pro`

- Barre haute avec deux onglets : **Modifier ma vitrine** / **Voir comme un client**.
  En mode client, tous les contrôles d'édition disparaissent.
- Édition en bottom sheet mobile-first (composant `sheet` déjà présent), une feuille par section :
  présentation, secteurs (sélecteur de départements), prestations (cases à cocher du référentiel
  `showcase.ts`), langues, véhicule, tarifs, contact, liens. Photo de profil et photos véhicule :
  upload direct depuis l'appareil photo ou la galerie, prévisualisation immédiate.
- Un brouillon local unique : plusieurs sections modifiables avant sauvegarde.
  - bandeau « Modifications non enregistrées » + bouton **Enregistrer les modifications** sticky
    tant que le brouillon est sale ;
  - après sauvegarde : « ✓ Votre vitrine a été mise à jour » ;
  - tentative de sortie avec modifications en attente → boîte de dialogue « Continuer la
    modification » / « Quitter sans enregistrer » (garde de navigation + `beforeunload`).
- Les photos restent enregistrées immédiatement à l'upload (règle ReLink existante : écriture sur
  la ligne véhicule unique via `ensureVehicleRowId`, jamais de doublon, jamais de photo générique).

## 3. Une seule source de données

Aucune copie parallèle : l'éditeur lit et écrit exactement les tables de la page publique —
`profiles`, `driver_profiles`, `vehicles`, `driver_tariffs` — et un adaptateur produit le même
objet « vitrine » que `get_public_driver_page`. Une modification enregistrée est donc visible
immédiatement sur la vraie page publique.

## 4. Complétude et visibilité

- Bloc de complétude compact : pourcentage + barre + « Prochaine étape : … » qui fait défiler
  jusqu'à la section concernée. Quand tout est fait : « ✓ Votre vitrine est complète ».
  Plus de liste de huit lignes barrées.
- Section « Ma visibilité · 30 derniers jours » compacte : vues, apparitions, ajouts au réseau,
  clics contact (RPC existante `get_driver_visibility_stats`).

## 5. Lien et QR code

Section « Mon QR code ReLink » intégrée : QR de la vraie URL publique, **Copier le lien**,
**Partager**, **Télécharger le QR**. L'URL technique n'est plus l'élément principal affiché.

## 6. Public / privé

La vitrine ne montre que des informations publiques. Les documents, permis et justificatifs
restent exclusivement dans « Vérification / Mon dossier », inchangés.

## 7. Navigation chauffeur

Les routes `/pro/profil`, `/pro/vehicule`, `/pro/tarification`, `/pro/liens`, `/pro/qr` sont
conservées et continuent de fonctionner. Le menu et la barre inférieure sont simplifiés autour de
Ma vitrine, Vérification, Mon entreprise, Mon compte. Terminologie : « Mon véhicule » partout.

## Hors périmètre

Aucune fonctionnalité de réservation, planning, disponibilité ou acceptation de course.
