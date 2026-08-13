# Corriger le parcours « Compléter mon dossier »

## Diagnostic confirmé
- Le formulaire existe déjà à `/pro/dossier/completer`, avec les huit étapes et la sauvegarde progressive.
- La route est bien générée, mais le flux repose sur une navigation impérative sans état d’erreur et le bouton n’impose pas `type="button"`.
- La garde utilise une liste de préfixes trop générale et ne formalise pas les statuts pré-validation ni les sous-routes autorisées.
- Le test navigateur authentifié est actuellement bloqué car la session de prévisualisation est déconnectée ; la reproduction publique confirme la redirection vers l’authentification.

## Modifications
1. **Route canonique du dossier**
   - Conserver l’URL équivalente existante `/pro/dossier/completer` pour ne pas casser les liens et l’architecture TanStack.
   - Confirmer qu’elle rend directement `DossierWizard`, avec métadonnées propres et écran d’erreur exploitable.

2. **CTA réellement navigable**
   - Relier le bouton principal à la route typée, avec `type="button"`.
   - Ajouter un état bref d’ouverture, une remise à zéro si la navigation échoue et le message « Impossible d’ouvrir votre dossier pour le moment. Réessayez. ».
   - Préserver la reprise intelligente vers la première correction, la dernière section commencée ou la première section incomplète.

3. **Garde chauffeur stricte**
   - Remplacer la liste implicite par des routes de pré-validation explicites incluant `/pro/dossier` et `/pro/dossier/completer/*`.
   - Normaliser `null`, `pending`, `not_verified` et anciennes variantes vers les états métier attendus, sans jamais les considérer comme validés.
   - Autoriser la consultation en `pending`/`under_review`, la correction pour les statuts modifiables, et maintenir le blocage de toutes les autres fonctions professionnelles.

4. **Chargement et persistance**
   - Rendre l’initialisation du dossier idempotente via l’upsert existant et garantir un état Identité utilisable même sans ligne de détails.
   - Conserver les règles d’accès privées existantes : propriétaire uniquement côté chauffeur, consultation admin selon les politiques actuelles, aucun accès public.

5. **Transition et ergonomie mobile**
   - Faire passer la sous-page par une transition latérale simple, indépendante de l’index des onglets.
   - Vérifier `pointer-events`, état `disabled`, bouton retour, absence d’overlay persistant et comportement tactile.

## Validation
- Vérifier la compilation et les erreurs console.
- Tester la route directe, le clic du CTA, l’URL, l’affichage Identité et le bouton retour sur formats iPhone et Android/PWA.
- Avec une session chauffeur active : saisir prénom/nom, enregistrer, recharger, vérifier la persistance puis reprendre à la bonne section ; tester aussi dossier absent, partiel, corrections demandées et absence de boucle de redirection.
