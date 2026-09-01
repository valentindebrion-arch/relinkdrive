# ReLink Connect

Crée une application web SaaS responsive appelée provisoirement « Relink ».

Le nom et l’identité de marque sont provisoires et devront pouvoir être modifiés facilement plus tard.

1. Vision du produit

Relink est un outil post-course destiné aux chauffeurs VTC indépendants.

Ce n’est pas une plateforme de mise en relation comme Uber, Bolt ou Heetch. Il n’existe aucune recherche publique de chauffeurs, aucune carte permettant de commander un véhicule inconnu et aucune attribution automatique des demandes.

Le service intervient après une première course réalisée entre un chauffeur et un passager.

Après une course, le chauffeur présente son QR code personnel ou transmet son lien. Le client ouvre alors la page du chauffeur et peut l’ajouter à son carnet privé de chauffeurs de confiance.

Lors d’un futur besoin de transport, le client peut envoyer une demande uniquement à un chauffeur qu’il a déjà ajouté.

Un client qui n’a ajouté aucun chauffeur ne peut pas réserver de course et ne peut pas rechercher de chauffeur sur la plateforme.

Relink ne prélève aucune commission sur les courses. Le modèle économique sera basé sur un abonnement payé par les chauffeurs.

Promesse principale :

« La course se termine. La relation commence. »

Promesse destinée aux chauffeurs :

« Conduisez. Fidélisez. Relink gère le reste. »

2. Objectif du MVP

Construire un MVP réellement fonctionnel démontrant ce parcours :

Un chauffeur crée son compte.

Il complète son entreprise, son profil, son véhicule et ses documents.

Un administrateur vérifie et valide son compte.

Une fois validé, le chauffeur obtient une page personnelle, un lien et un QR code.

Un client ouvre le lien ou scanne le QR code.

Il consulte la fiche du chauffeur.

Il crée un compte ou se connecte.

Il ajoute volontairement le chauffeur à son carnet.

Il peut ensuite lui envoyer une demande de trajet.

Le chauffeur reçoit et traite la demande.

Il accepte, refuse ou propose une modification et un tarif.

Le client valide la proposition.

La course apparaît dans les plannings.

Le chauffeur peut partager sa position pendant la prise en charge et la course.

L’administrateur peut superviser la course active.

Une fois la course terminée, le chauffeur génère une facture.

Les statistiques et le CRM sont automatiquement actualisés.

La priorité absolue est de rendre ce parcours fonctionnel de bout en bout.

3. Types de comptes

Créer quatre rôles sécurisés :

Client

Chauffeur

Administrateur

Super administrateur

Les autorisations doivent être contrôlées côté serveur et pas seulement dans l’interface.

Un utilisateur ne doit pouvoir accéder qu’aux informations autorisées par son rôle.

4. Espace chauffeur

Créer un tableau de bord professionnel avec la navigation suivante :

Vue d’ensemble

Demandes

Planning

Clients

Courses

Factures

Mon entreprise

Mon véhicule

Mon QR code

Activité

Assistant

Paramètres

Tableau de bord

Afficher :

demandes à traiter ;

courses prévues aujourd’hui ;

prochaine course ;

chiffre d’affaires du mois ;

nombre de clients fidélisés ;

factures en attente ;

alertes concernant le véhicule ou les documents ;

aperçu du planning ;

raccourci vers le QR code.

Profil professionnel

Prévoir les informations suivantes :

prénom et nom ;

photo ;

nom commercial ;

téléphone ;

adresse e-mail ;

adresse professionnelle ;

ville et zone d’activité ;

présentation ;

langues parlées ;

services proposés ;

numéro SIRET ;

numéro de carte professionnelle ;

informations légales de facturation.

Véhicule

Prévoir :

marque ;

modèle ;

année ;

couleur ;

immatriculation ;

nombre de passagers ;

capacité de bagages ;

photo ;

kilométrage ;

date du prochain entretien ;

assurance et date d’expiration ;

contrôle technique et date d’expiration ;

équipements disponibles ;

siège enfant ;

chargeurs ;

bouteilles d’eau ;

animaux acceptés ;

accessibilité.

Vérification du chauffeur

Créer les statuts suivants :

Profil incomplet

En attente de vérification

Vérifié

Correction demandée

Refusé

Suspendu

Le chauffeur doit pouvoir transmettre :

pièce d’identité ;

permis de conduire ;

carte professionnelle VTC ;

numéro SIRET et justificatif d’entreprise ;

carte grise ;

assurance ;

contrôle technique ;

autres justificatifs nécessaires.

Le chauffeur peut découvrir son espace avant validation, mais il ne peut pas activer sa page, partager son QR code ou recevoir de demandes réelles avant d’avoir été validé par un administrateur.

Afficher clairement les documents manquants, refusés ou arrivant à expiration.

5. Page personnelle et QR code

Chaque chauffeur validé possède une URL unique, par exemple :

/chauffeur/prenom-identifiant

Cette page est principalement destinée à être ouverte sur smartphone après une course.

Afficher :

photo du chauffeur ;

prénom ;

nom commercial ;

véhicule ;

photo du véhicule ;

langues ;

services ;

équipements ;

zone d’activité ;

présentation ;

bouton « Ajouter à mes chauffeurs ».

Le bouton « Demander un trajet » n’est disponible que si le client a déjà ajouté ce chauffeur.

Créer une page permettant au chauffeur :

d’afficher son QR code ;

de le télécharger ;

de copier son lien ;

de partager son lien ;

de prévisualiser sa page.

6. CRM chauffeur

Créer une liste contenant uniquement les clients ayant volontairement ajouté le chauffeur.

Afficher pour chaque client :

nom ;

coordonnées autorisées ;

date d’ajout ;

statut ;

nombre de courses ;

dernière course ;

prochaine course ;

chiffre d’affaires généré ;

adresses favorites ;

préférences ;

notes privées ;

historique des demandes.

Utiliser les statuts CRM :

Nouveau

Actif

Régulier

Inactif

Les notes privées ne doivent jamais être visibles par le client.

7. Demandes et courses

Le client peut renseigner :

adresse de départ ;

adresse d’arrivée ;

date ;

heure ;

nombre de passagers ;

nombre de bagages ;

aller simple ou aller-retour ;

type de trajet ;

besoins particuliers ;

commentaire ;

moyen de contact préféré.

Le chauffeur peut :

accepter ;

refuser ;

proposer une autre heure ;

proposer un prix ;

ajouter un message ;

confirmer la réservation.

Créer les statuts suivants :

Nouvelle demande

À étudier

Proposition envoyée

En attente du client

Confirmée

Chauffeur en approche

Chauffeur arrivé

Client à bord

Course en cours

Terminée

Annulée

Refusée

Conserver l’historique des changements de statut.

8. Planning

Créer des affichages :

Jour

Semaine

Mois

Permettre au chauffeur :

d’ajouter une course manuellement ;

de modifier une course ;

d’identifier les conflits ;

de bloquer une indisponibilité ;

de consulter les détails ;

de démarrer et terminer une course.

Préparer l’architecture pour une future synchronisation avec Google Calendar, Apple Calendar ou Outlook, sans développer obligatoirement ces intégrations dans le MVP.

9. Facturation

Permettre de générer une facture depuis une course terminée.

Inclure :

informations légales du chauffeur ;

informations du client ;

numéro de facture ;

date ;

trajet ;

description ;

montant hors taxes ;

TVA si applicable ;

montant total ;

statut de paiement.

Actions :

Générer

Prévisualiser

Télécharger en PDF

Envoyer au client

Marquer comme payée

Si le véritable export PDF est trop complexe pour cette première version, créer une facture imprimable propre et professionnelle.

10. Assistant intelligent

Créer un espace « Assistant » dans le tableau de bord chauffeur.

Pour le MVP, utiliser les informations de la base de données et des règles simples pour afficher des suggestions comme :

« Vous avez deux demandes à traiter. »

« Deux courses présentent un conflit horaire. »

« Trois factures sont encore impayées. »

« Ce client n’a pas réservé depuis trois mois. »

« Votre assurance arrive bientôt à expiration. »

« Vous devriez prévoir l’entretien du véhicule. »

Préparer l’architecture pour intégrer ultérieurement une véritable IA capable d’aider à :

organiser le planning ;

préparer les propositions ;

envoyer des rappels ;

suivre les clients ;

créer les factures ;

résumer l’activité.

11. Espace client

L’espace client doit rester volontairement simple.

Navigation :

Mes chauffeurs

Mes demandes

Mes trajets

Mes factures

Mes adresses

Mon profil

Le client ne doit jamais pouvoir accéder à un catalogue ou à un moteur de recherche de chauffeurs.

S’il n’a ajouté aucun chauffeur, afficher :

« Vous n’avez pas encore ajouté de chauffeur. Pour ajouter un chauffeur de confiance, scannez son QR code ou ouvrez le lien qu’il vous a transmis. »

Mes chauffeurs

Afficher uniquement les chauffeurs ajoutés grâce à leur QR code ou leur lien.

Pour chaque chauffeur :

photo ;

prénom ;

entreprise ;

véhicule ;

zone ;

voir le profil ;

demander un trajet.

Un client peut ajouter plusieurs chauffeurs, mais uniquement après avoir ouvert le lien personnel de chacun.

La relation entre le client et le chauffeur doit être enregistrée dans la base de données avant que le client puisse envoyer une demande.

12. Espace administrateur

L’administration constitue le centre de pilotage interne de Relink.

Navigation :

Vue d’ensemble

Vérifications

Chauffeurs

Clients

Courses en direct

Toutes les courses

Carte

Factures

Signalements

Statistiques

Notifications

Journal d’activité

Paramètres

Tableau de bord administrateur

Afficher :

total des chauffeurs ;

chauffeurs vérifiés ;

chauffeurs en attente ;

chauffeurs actifs ;

chauffeurs suspendus ;

total des clients ;

nouveaux clients ;

connexions client-chauffeur ;

demandes reçues ;

courses confirmées ;

courses en cours ;

courses terminées ;

courses annulées ;

QR codes scannés ;

factures générées ;

activité globale.

Ajouter des graphiques par jour, semaine et mois.

Validation des chauffeurs

Créer une fiche complète permettant à l’administrateur :

de consulter le profil ;

de consulter l’entreprise ;

de voir le véhicule ;

de visualiser les documents ;

de valider chaque document ;

de demander une correction ;

d’ajouter une note interne ;

d’accepter le chauffeur ;

de refuser avec un motif ;

de suspendre ou réactiver le compte.

Afficher les dates d’expiration et générer des alertes.

Gestion des clients

Créer les statuts :

Actif

E-mail non vérifié

Téléphone non vérifié

Restreint

Suspendu

Supprimé

Permettre à l’administrateur :

de consulter le profil ;

de voir les chauffeurs ajoutés ;

de consulter les demandes et courses ;

de consulter les signalements ;

de restreindre ou suspendre le compte ;

d’anonymiser ou supprimer les données lorsque nécessaire.

L’administrateur ne doit jamais pouvoir voir le mot de passe.

13. Courses en direct et géolocalisation

Créer un écran réservé aux administrateurs affichant les courses actives.

Pour chaque course :

chauffeur ;

client ;

véhicule ;

départ ;

destination ;

statut ;

horaire prévu ;

heure réelle de départ ;

durée estimée ;

dernière position connue ;

heure de dernière actualisation ;

alertes éventuelles.

Règles de géolocalisation

Ne jamais suivre continuellement tous les utilisateurs.

Le chauffeur partage sa position lorsqu’il :

active volontairement son statut de service ;

se dirige vers une course ;

réalise une course.

Le partage associé à une course s’arrête automatiquement lorsque la course est terminée ou annulée.

Le client peut partager sa position pour préciser son point de prise en charge, uniquement avec son consentement explicite.

Afficher la date de la dernière actualisation.

Protéger les données et limiter leur durée de conservation conformément aux principes du RGPD.

Pour le MVP, si la géolocalisation en temps réel complète est trop complexe, créer un système de démonstration clairement identifié comme simulé.

14. Carte administrateur

Créer une carte de supervision pouvant afficher, selon les autorisations :

chauffeurs en service ;

chauffeurs en approche ;

courses en cours ;

clients ayant volontairement partagé leur position ;

zones d’activité.

Utiliser des marqueurs différents pour :

Chauffeur actif

Chauffeur en approche

Course en cours

Client en attente

Position ancienne

Incident

Ajouter des filtres par :

rôle ;

statut ;

ville ;

zone ;

course active ;

date de dernière position.

Ne jamais afficher la position d’un utilisateur n’ayant pas activé un partage autorisé.

15. Signalements

Créer une gestion des incidents et signalements :

problème pendant une course ;

comportement inapproprié ;

erreur de facturation ;

compte suspect ;

document expiré ;

problème de sécurité ;

demande liée aux données personnelles.

Statuts :

Nouveau

En cours

En attente

Résolu

Fermé

La fiche doit contenir :

type ;

utilisateur concerné ;

course associée ;

priorité ;

description ;

administrateur responsable ;

historique ;

résolution.

16. Statistiques

Créer des filtres :

Aujourd’hui

7 jours

30 jours

Mois en cours

Période personnalisée

Ville

Zone

Mesurer principalement le tunnel suivant :

QR code scanné → profil consulté → chauffeur ajouté → première demande → proposition acceptée → course terminée → nouvelle course avec le même chauffeur.

Afficher :

taux de conversion du QR code ;

nombre de chauffeurs ajoutés ;

taux d’ajout ;

taux de première demande ;

taux de confirmation ;

taux d’annulation ;

taux de récurrence ;

nombre moyen de clients par chauffeur ;

nombre moyen de chauffeurs par client ;

fréquence de réservation ;

chauffeurs les plus actifs ;

zones les plus actives ;

chiffre d’affaires déclaré ;

panier moyen.

17. Journal d’activité

Enregistrer les actions sensibles :

validation ou refus d’un chauffeur ;

consultation ou validation d’un document ;

suspension d’un compte ;

modification d’une course ;

traitement d’un signalement ;

modification des rôles ;

modification des paramètres.

Afficher :

date et heure ;

administrateur ;

action ;

ressource concernée ;

ancienne valeur ;

nouvelle valeur ;

motif.

18. Notifications

Prévoir des notifications lorsque :

une demande est reçue ;

une proposition est envoyée ;

une course est confirmée ;

une course approche ;

une facture est disponible ;

un chauffeur attend une validation ;

un document va expirer ;

un incident est signalé ;

une activité anormale est détectée.

Pour le MVP, utiliser des notifications internes et préparer l’architecture pour l’e-mail, les SMS et WhatsApp.

19. Base de données

Créer une structure cohérente contenant au minimum :

users

driver_profiles

client_profiles

admin_profiles

companies

vehicles

verification_documents

document_reviews

driver_client_connections

ride_requests

rides

ride_status_history

live_locations

invoices

client_addresses

driver_notes

reports

notifications

audit_logs

analytics_events

La table driver_client_connections est fondamentale.

Elle doit confirmer qu’un client a volontairement ajouté un chauffeur avant qu’une demande puisse lui être envoyée.

20. Sécurité et confidentialité

Appliquer des règles d’accès strictes :

un chauffeur voit uniquement ses clients et son activité ;

un client voit uniquement ses chauffeurs ;

un client ne contacte qu’un chauffeur déjà ajouté ;

un administrateur accède uniquement aux fonctions autorisées ;

les documents sont protégés ;

les notes privées restent invisibles au client ;

les positions sont protégées et temporaires ;

les actions sensibles sont journalisées ;

les mots de passe ne sont jamais accessibles ;

les comptes et données doivent pouvoir être anonymisés ;

les consentements doivent être enregistrés.

Ne pas prétendre importer automatiquement les données d’Uber, Bolt ou Heetch.

21. Design

Créer une interface moderne, rassurante et professionnelle.

Utiliser temporairement :

fond blanc ou gris très clair ;

textes gris anthracite ;

couleur principale verte, moderne et technologique ;

cartes légèrement arrondies ;

ombres discrètes ;

typographie très lisible ;

navigation claire ;

excellente expérience mobile.

L’espace chauffeur doit ressembler à un logiciel SaaS de gestion.

L’espace client doit être très simple et rassurant.

L’administration doit être plus dense, structurée et adaptée à la supervision.

22. Données de démonstration

Créer :

un chauffeur vérifié avec un profil complet ;

deux chauffeurs en attente ;

un chauffeur avec un document expiré ;

plusieurs véhicules ;

plusieurs clients ;

plusieurs connexions client-chauffeur ;

des demandes avec différents statuts ;

des courses passées et futures ;

deux courses simulées en direct ;

des factures ;

des signalements ;

des notifications ;

des statistiques réalistes.

23. Ordre de construction

Construire le projet dans cet ordre :

Authentification et rôles

Base de données et règles de sécurité

Inscription et vérification du chauffeur

Profil chauffeur, lien et QR code

Ajout du chauffeur par le client

Connexion client-chauffeur

Demande de transport

Traitement et confirmation

Planning et suivi de la course

Facturation

Administration et validation

Courses en direct et carte

Statistiques

Signalements et journal d’activité

Assistant et automatisations simples

Toutes les fonctionnalités du parcours principal doivent être connectées à la base de données.

Ne pas produire uniquement une maquette avec des boutons inactifs.

24. Contraintes négatives à respecter

Ne pas créer :

une copie d’Uber ;

une marketplace de chauffeurs ;

un catalogue public ;

un moteur de recherche de chauffeurs ;

une carte publique montrant les chauffeurs disponibles ;

un système de mise en concurrence ;

une attribution automatique à un chauffeur inconnu ;

une commission sur les courses ;

une géolocalisation permanente ;

une interface noir et or ;

une esthétique de chauffeur de luxe ;

des fonctionnalités fictives présentées comme opérationnelles ;

des boutons sans action dans le parcours principal ;

une IA complexe ou coûteuse pendant le MVP.

Avant de développer, analyse le projet, crée une architecture claire et vérifie que chaque rôle possède uniquement les autorisations nécessaires.

En cas de choix secondaire, privilégie toujours la solution la plus simple, sécurisée, évolutive et économique en crédits.

Commence par créer le socle fonctionnel du MVP. N’essaie pas de construire toutes les intégrations avancées en une seule génération si cela risque de fragiliser le parcours principal.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://relinkdrive.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0a557f28-6d76-49a6-8ccb-45eeb9c28573).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
