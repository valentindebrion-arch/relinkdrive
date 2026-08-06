# Corriger l'ajout d'un chauffeur au carnet client

## Cause confirmée

La règle d'ajout dans `driver_client_connections` vérifie que le chauffeur est bien vérifié en allant lire la table des profils chauffeurs. Or, depuis le durcissement de sécurité, un client ne peut lire le profil d'un chauffeur **que s'il est déjà connecté à lui**. Résultat : un cercle vicieux — impossible d'ajouter un chauffeur, la vérification échoue et l'ajout est refusé avec « new row violates row-level security policy ».

(Vérifié : la règle d'insertion contient un `EXISTS` sur `driver_profiles`, et les règles de lecture de `driver_profiles` sont limitées au propriétaire, aux admins et aux clients déjà connectés.)

## Correction

Une migration de base de données :

1. Créer une fonction de contrôle interne `public.is_verified_driver(uuid)` (SECURITY DEFINER, search_path figé) qui renvoie simplement vrai/faux selon que le chauffeur est vérifié — sans exposer aucune donnée du profil.
2. Remplacer la règle d'ajout `conn_insert_client` par une version qui utilise cette fonction : le client doit s'ajouter lui-même (`client_id = auth.uid()`) et le chauffeur ciblé doit être vérifié.
3. Réserver l'exécution de cette fonction aux comptes connectés (`authenticated`), pas à `anon`.

Aucune donnée sensible n'est rendue lisible : la fonction ne renvoie qu'un booléen.

## Vérification

- Rejouer le parcours : scan du QR → connexion/inscription client → « Ajouter à mes chauffeurs », et confirmer que la ligne de connexion est bien créée.
- Vérifier que la page publique et le reste des règles restent inchangés, puis relancer le contrôle de sécurité.

Aucun changement de code front n'est nécessaire.
