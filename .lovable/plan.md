# Corriger le message « internal server error » sur le site publié

## Ce que j'ai vérifié

J'ai testé le site publié (relinkdriver.lovable.app) page par page : accueil, connexion, espace client, espace chauffeur, modération, fiche chauffeur publique, plan du site, manifeste et service worker. **Toutes répondent normalement (code 200)**, et les journaux du serveur ainsi que ceux de l'authentification ne contiennent aucune erreur serveur sur la dernière heure. Le backend est en bon état.

Autrement dit, l'erreur n'est pas reproductible côté serveur en ce moment. La cause la plus probable est un **décalage de version** : le navigateur (ou l'app installée sur l'écran d'accueil) garde en mémoire l'ancienne page et tente de charger des fichiers d'une version qui n'existe plus après une nouvelle publication. Le résultat est une page brute d'erreur, affichée sur fond noir par le mode sombre du téléphone. Cette hypothèse reste à confirmer.

## Plan

### 1. Confirmer le diagnostic
- Republier la dernière version (le site publié est en retard sur les modifications récentes).
- Sur le téléphone : fermer l'app installée, vider les données du site, recharger. Si l'erreur disparaît, le diagnostic est confirmé.
- Si l'erreur persiste, relever l'URL exacte affichée dans la barre d'adresse au moment de l'erreur : elle indiquera précisément quelle requête échoue.

### 2. Rendre l'app résistante aux nouvelles publications
- Ajouter une récupération automatique : si le chargement d'un morceau de l'application échoue (fichier d'une version périmée), l'app recharge la page une seule fois automatiquement au lieu d'afficher une erreur.
- Marquer une version dans le service worker de notifications et purger l'ancien enregistrement à chaque nouvelle version, pour éviter qu'un service worker obsolète reste actif.

### 3. Rendre l'erreur lisible et francophone
- Traduire et habiller la page d'erreur de secours aux couleurs Relink (fond clair, logo, message en français, boutons « Réessayer » et « Retour à l'accueil »), au lieu du message technique anglais actuel.
- Journaliser l'erreur d'origine pour qu'elle apparaisse dans les journaux si le cas se reproduit.

### 4. Vérification
- Nouveau passage sur toutes les routes publiées après republication.
- Test d'un rechargement forcé sur mobile avec l'app installée.

## Détails techniques

- `src/lib/error-page.ts` : refonte du HTML de secours (français + charte Relink). Le fichier reste sans dépendance.
- `src/routes/__root.tsx` : dans `errorComponent`, détection des erreurs de type `Failed to fetch dynamically imported module` / `Importing a module script failed` → `location.reload()` protégé par un drapeau `sessionStorage` pour éviter toute boucle.
- `public/sw-push.js` : ajout d'une constante `SW_VERSION`; `src/lib/push.ts` compare la version enregistrée et réenregistre le service worker si elle diffère.
- Aucun changement de schéma de base de données ni de logique métier.
