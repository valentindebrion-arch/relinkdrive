# Parcours obligatoire de validation du compte chauffeur

## Ce qui existe déjà (à réutiliser, sans logique parallèle)

- `driver_profiles.verification_status` : `incomplete | pending | verified | changes_requested | rejected | suspended` — c'est déjà la source de vérité, elle sera étendue, pas remplacée.
- `verification_documents` (+ `document_reviews`) avec statuts `pending | approved | rejected | expired`, bucket privé `documents`, et un trigger qui empêche déjà le chauffeur de modifier les champs admin.
- `get_public_driver_page`, `get_connected_driver_profiles`, `is_verified_driver` : fonctions serveur qui filtrent déjà la visibilité publique.
- `requireRoles` (`src/lib/role-guard.ts`) : garde de route unique appliquée à `/pro`, `/espace`, `/admin`.
- Page `Vérification` existante (dépôt de documents) et écran admin `Vérification des chauffeurs`.

## Correspondance des statuts demandés

| Demandé | Dans ReLink |
|---|---|
| incomplete | `incomplete` |
| submitted | `pending` (renommé côté libellé « Dossier envoyé ») |
| under_review | `under_review` (nouveau) |
| changes_requested | `changes_requested` |
| approved | `verified` (= seul état actif) |
| rejected | `rejected` |
| suspended | `suspended` |
| expired_documents | `expired_documents` (nouveau) |

Règle unique partout, base et interface : **compte actif ⟺ `verification_status = 'verified'`**.

---

## Livraison en 4 étapes

### Étape 1 — Socle base de données et blocage serveur
- Ajout des statuts `under_review` et `expired_documents` ; champs `submitted_at`, `approved_at`, `approved_by`, `suspended_at`, `suspension_reason` sur `driver_profiles`.
- Table `driver_onboarding_requirements` calculée : fonction serveur `driver_dossier_state(driver)` qui renvoie, par section (Identité, Permis, Carte VTC, Entreprise, Assurances, Véhicule, Fiscalité), l'état (`à compléter / complet / à vérifier / validé / correction / expiré`), les pièces manquantes et le pourcentage réel.
- Fonctions serveur : `submit_driver_dossier()` (revalide tout côté serveur, passe en `pending`), `admin_review_document()`, `admin_decide_driver()` (valide/corrige/refuse/suspend, exige un motif, écrit dans `audit_logs` et `document_reviews`).
- Trigger : le chauffeur ne peut jamais écrire `verified` lui-même ; le remplacement d'un document validé le repasse en `pending` et le dossier en `under_review`.
- Toutes les fonctions métier existantes (création de demande, connexion client-chauffeur, disponibilité, tarifs, facture) ajoutent le contrôle `verification_status = 'verified'` — y compris `get_public_driver_page`, `get_connected_driver_profiles`, la carte et la recherche client.
- Expiration : job quotidien qui passe en `expired_documents` les chauffeurs dont une pièce obligatoire est échue, et notifie à J‑60, J‑30, J‑7 via `notifications`.

### Étape 2 — Écran « Statut du compte » et garde d'accès chauffeur
- Nouvelle route `/pro/dossier` (remplace `/pro/verification`) : écran principal tant que le compte n'est pas validé — message d'activation non punitif, progression par section, pièces manquantes, motifs de correction, bouton « Envoyer mon dossier pour vérification » désactivé tant qu'il manque une pièce, avec récapitulatif et confirmation.
- Formulaire complet des sections demandées (identité, permis, carte VTC + REVTC, entreprise, assurances, véhicule) branché sur les tables existantes `driver_profiles`, `companies`, `vehicles`, `verification_documents`.
- Extension de `requireRoles` en `requireDriverAccess` : lit le statut réel côté serveur à chaque chargement de route `/pro/*` et redirige vers `/pro/dossier` sauf pour dossier, aide, légal, déconnexion.
- Menu chauffeur réduit avant validation (Mon dossier / Aide / Déconnexion) avec aperçu grisé non cliquable et message « Votre espace professionnel sera disponible après validation de votre dossier. »

### Étape 3 — QR code, lien direct, visibilité client
- Le QR code n'est plus généré côté navigateur : une fonction serveur ne renvoie sa valeur que si le compte est `verified`. Avant validation, `/pro/qr` n'affiche ni image, ni URL, ni bouton de téléchargement.
- `/chauffeur/$slug` : page neutre « Ce profil chauffeur n'est pas disponible. » pour tout statut ≠ `verified`, sans nom, photo, véhicule ni motif ; `noindex` et absence du sitemap.
- Carte, recherche, favoris, sélection dans une nouvelle demande : filtrage serveur sur `verified`. Un favori d'un chauffeur suspendu/expiré reste visible dans le carnet mais non réservable, avec une information neutre. Aucune course, facture ou historique n'est supprimé.

### Étape 4 — Espace administrateur
- Rubrique « Chauffeurs à vérifier » avec files : nouveaux, en cours, corrections attendues, validés, refusés, suspendus, documents proches de l'expiration.
- Fiche dossier : identité, progression, date d'envoi, liste des pièces avec URL signée courte durée, statut par élément, historique des décisions.
- Validation document par document (Valider / Demander une correction / Refuser) avec motif obligatoire et choix de motifs pré-rédigés ; le chauffeur ne voit que le motif communicable, jamais les notes internes.
- « Valider le compte chauffeur » actif seulement quand tous les éléments obligatoires sont validés, avec confirmation, re-vérification serveur, enregistrement de l'admin et de la date, puis activation des fonctions et notification au chauffeur.
- Suspension et réactivation d'un compte validé avec motif, date et historique.

## Détails techniques

- Statuts ajoutés à l'énumération `verification_status` par migration (les valeurs existantes sont conservées).
- Toute la logique de décision vit dans des fonctions `security definer` appelées via des `createServerFn` ; aucune règle d'accès n'est laissée au seul navigateur, les politiques RLS restent en place.
- Les documents restent dans le bucket privé `documents`, ouverts uniquement par URL signée de courte durée, jamais téléchargés automatiquement.
- Chaque action (dépôt, remplacement, consultation admin, validation, correction, refus, suspension, réactivation, expiration) est tracée dans `audit_logs` avec acteur, horodatage, section concernée et motif — sans jamais journaliser le contenu des documents.
- Les règles tarifaires, les comptes clients et le moteur de course ne sont pas modifiés.

## Vérification

Parcours testés bout en bout : compte neuf, dossier vide/partiel/complet non envoyé, envoyé, en vérification, correction, nouvel envoi, refus, validation, suspension, réactivation, document expiré ; tentatives de contournement par URL directe (`/pro/planning`, `/pro/qr`, `/chauffeur/slug`), accès aux documents par un autre chauffeur, et rendu mobile Safari/Chrome.
