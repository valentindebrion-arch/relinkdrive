# Refonte ReLink — du logiciel VTC au réseau de chauffeurs

Principe directeur : **ReLink aide à trouver un chauffeur. ReLink ne gère pas la course.**

## 1. Ce qui existe aujourd'hui

L'application est actuellement structurée autour de l'exécution de courses :

- **Client** : accueil réservation, tunnel de demande en 4 étapes, suivi de course temps réel, historiques (en cours / terminées / annulées), demandes, mes chauffeurs, découvrir.
- **Chauffeur** : dashboard d'activité, courses, demandes, planning, disponibilités, clients/CRM, facturation + e-invoicing (Factur-X, e-reporting, factures fournisseurs), tarification, dossier de vérification, véhicule, entreprise, QR code, personnalisation.
- **Admin** : inscriptions, chauffeurs, courses actives, utilisateurs, signalements, Top 10.
- **Base** : ~53 tables, dont une grosse moitié dédiée aux courses, demandes, factures, paiements et e-reporting.

## 2. Ce qui est supprimé

**Pages client** : `espace.demandes`, `espace.courses.*` (index, détail, terminées, annulées, demandes), `espace.suivi.$id`.

**Pages chauffeur** : `pro.courses.*`, `pro.demandes`, `pro.planning.*`, `pro.disponibilites`, `pro.factures`, `pro.clients-factures`, `pro.einvoicing`, `pro.clients.*`, `pro.activite`.

**Pages admin** : `admin.courses.*`.

**Composants** : tout `src/components/request/*`, `Planning`, `DriverRequests`, `UpcomingRides`, `ActivityPage`, `BillingCustomersPage`, `EinvoicingPage`, `EreportingPanel`, `SupplierInvoicesPanel`, `InvoiceIssueDialog`, `SubmitInvoiceDialog`, `PlatformConnectionPanel`, `TaxSection`/`TaxSetupBanner`, `ActiveRidePanel`, `CompleteRideDialog`, `NotifyClientSms`, `tracking/*`, `InvoiceDownloadCard`.

**Librairies / serveur** : `src/lib/einvoicing/*`, `invoice-pdf`, `invoice-archive`, `day-planning*`, `schedule-slots*`, `availability*`, `ride-*` (cancel, sms, start), `compatibility`, `payment-methods`, `immediate-request`, `request-draft`, `tracking-status`, `driver-board*`, `pro-stats`, `tax*`, `billing-customers`, `admin-rides`, `route-estimate.functions` (remplacé).

**Notifications** : suppression des catégories `request` / `ride` / `invoice`. On conserve le push pour `connection` (ajout à un réseau) et `info`.

## 3. Ce qui est conservé

- Authentification, rôles, Google OAuth, comptes existants (aucun compte cassé).
- Dossier de vérification chauffeur + workflow admin de validation → badge « Profil vérifié ».
- Profil public chauffeur (`/chauffeur/$slug`), QR code, galerie véhicule et photos.
- « Mes chauffeurs » (connexions client ↔ chauffeur) — c'est désormais le cœur du produit.
- Découverte géographique (secteur, département, cache géo), Top 10 admin, signalements.
- Design system actuel (blanc / gris / vert ReLink), thèmes de profil, PWA.

## 4. Ce qui est transformé

| Existant | Devient |
| --- | --- |
| Accueil client « réserver » | Accueil réseau : Mes chauffeurs + suggestions du secteur |
| Estimateur lié à une demande | Estimateur **purement indicatif**, en fourchette, sans envoi |
| Bouton « Réserver » | Bouton « Contacter le chauffeur » (appel, SMS, WhatsApp, site, réseaux) |
| Tarification (facturation) | « Mes tarifs » : prise en charge, prix/km, minimum, forfaits — alimente l'estimateur |
| Dashboard chauffeur d'activité | Dashboard de visibilité : complétude du profil + statistiques de vues/ajouts/clics |
| Page véhicule unique | **Mes véhicules** : plusieurs véhicules présentables |
| Statistiques CA / courses | Statistiques de profil uniquement |

## 5. Nouvelle arborescence

```text
Public
  /                      Accueil : "Votre réseau de chauffeurs VTC"
  /chauffeurs            Recherche & annuaire (ville, véhicule, prestations, passagers, langues)
  /chauffeur/$slug       Profil vitrine + estimateur indicatif + Contacter
  /verification          Ce que signifie "Profil vérifié"
  /aide, /legal/$doc, /auth...

Client (/espace)
  /espace                Mes chauffeurs (réseau)
  /espace/decouvrir      Découvrir
  /espace/consultes      Récemment consultés
  /espace/parametres     Mon profil

Chauffeur (/pro)
  /pro                   Ma vitrine (complétude + stats de visibilité)
  /pro/profil            Identité, présentation, langues, expérience, secteurs, prestations
  /pro/vehicules         Mes véhicules
  /pro/tarifs            Mes tarifs
  /pro/liens             Mes liens & contacts
  /pro/qr                Mon QR code
  /pro/dossier           Vérification
  /pro/entreprise        Informations professionnelles
  /pro/parametres        Mon compte

Admin
  /admin, /admin/inscriptions, /admin/chauffeurs, /admin/utilisateurs,
  /admin/signalements, /admin/top10
```

## 6. Parcours

**Client** : Découvrir → Consulter le profil → Comparer → Enregistrer dans « Mes chauffeurs » → Contacter directement (hors ReLink). Le QR code en véhicule mène au profil puis à l'ajout.

**Chauffeur** : Inscription → Dossier vérifié → Compléter sa vitrine (photo, présentation, véhicules, prestations, zones, tarifs, liens) → Partager son QR code → Suivre ses statistiques de visibilité.

## 7. Base de données

Nouvelles tables :
- `driver_vehicles` (plusieurs véhicules par chauffeur : marque, modèle, gamme, passagers, bagages, équipements, photos, ordre).
- `driver_services` ou colonne `services text[]` (prestations) + `languages text[]`, `experience_years`, `service_areas`.
- `driver_links` (type : phone, sms, whatsapp, website, instagram, facebook, autre + valeur + ordre).
- `driver_pricing` (prise en charge, prix/km, prix minimum, marge basse/haute pour la fourchette, forfaits).
- `profile_views` / `profile_events` (vue, apparition en recherche, ajout au réseau, clic contact) pour les statistiques.
- `recent_driver_views` pour « récemment consultés ».

Tables retirées (après vérification des dépendances, en fin de migration) : `rides`, `ride_requests`, `ride_status_history`, `ride_reviews`, `ride_request_terms_acceptances`, `invoices` et toutes les tables `invoice_*`, `payments`, `supplier_invoices`, `ereporting_*`, `e_invoicing_connections`, `billing_customers`, `driver_tariffs`/`driver_tariff_migrations`, `driver_tax_profiles`, `driver_working_hours`, `driver_absences`, `driver_breaks`, `driver_day_overrides`, `driver_schedule_settings`, `driver_plan_changes`, `live_locations`, `invoice_counters`, `document_reviews` si inutilisée.

Fonctions SQL supprimées : `create_client_ride_request`, `compute_ride_quote`, `check_ride_compatibility`, `issue_invoice`, `next_invoice_number`, `queue_ereporting`, tous les `guard_ride_*` / `guard_invoice_*`, `driver_available_between`, `driver_day_window`, `expire_stale_immediate_requests`, etc.

Fonctions conservées / adaptées : `get_public_driver_page`, `get_discover_drivers`, `get_local_drivers`, `get_connected_*`, `has_role`, `is_verified_driver`, dossier & vérification, `get_top10_drivers`.

Sécurité : RLS et GRANT explicites sur chaque nouvelle table ; lecture publique limitée aux données de vitrine des chauffeurs vérifiés, écriture réservée au propriétaire.

Sauvegarde : avant suppression, les données de courses/factures sont archivées dans un schéma `archive` (copie des tables) plutôt que détruites, afin de ne rien perdre.

## 8. Backend

- Nouvelles server functions : recherche/annuaire filtré, profil public complet, estimation indicative (calcul distance + grille tarifaire du chauffeur → fourchette), enregistrement des événements de profil, statistiques chauffeur.
- Suppression des server functions et endpoints liés aux courses, planning, disponibilités, factures et e-invoicing.
- Le trigger de notification push est réduit aux catégories conservées.

## 9. Frontend

- Refonte de l'accueil (hero « Votre réseau de chauffeurs VTC », CTA « Trouver un chauffeur » / « Je suis chauffeur »).
- Annuaire `/chauffeurs` avec filtres et cartes profil riches.
- Profil public restructuré : identité, véhicules, prestations, zones, tarifs, estimateur indicatif avec mention légale, bouton « Contacter le chauffeur ».
- Navigation client réduite à 3 onglets, navigation chauffeur réduite aux 5 entrées vitrine.
- Nettoyage de tout le vocabulaire de réservation dans l'UI et les métadonnées SEO.

## 10. Ordre d'exécution (application fonctionnelle à chaque étape)

1. Nouveau schéma additif (véhicules, prestations, liens, tarifs, statistiques) — rien n'est cassé.
2. Nouvelles pages publiques : accueil, annuaire, profil vitrine, estimateur indicatif, page vérification.
3. Nouvel espace chauffeur (vitrine, véhicules, tarifs, liens, QR, stats).
4. Nouvel espace client (réseau, découvrir, consultés, profil).
5. Retrait des routes, composants et libs de gestion de courses/factures.
6. Migration finale : archivage puis suppression des tables et fonctions devenues inutiles.
