# Débloquer la publication du site

## Ce que j'ai déjà vérifié

- La compilation de production réussit sans aucune erreur.
- Le build est petit (7,3 Mo, 240 fichiers) : très loin des limites de publication.
- Les scans de sécurité ne remontent aucun problème bloquant, mais deux d'entre eux sont marqués « pas à jour » (dernière analyse du 6 et du 9 août). Le contrôle qui autorise la publication relit l'état des scans au moment du clic : un scan périmé est la cause la plus probable du refus systématique.

## Plan d'action

1. Relancer une analyse de sécurité complète pour rafraîchir tous les scanners.
2. Relire les résultats. S'il apparaît une alerte critique, la corriger avant toute publication (et vous l'expliquer en clair).
3. Relancer la publication depuis l'outil de déploiement.
4. Si l'échec persiste, l'outil de publication nomme précisément la vérification qui bloque : je récupérerai ce détail et je corrigerai le point concerné, ou je vous indiquerai s'il s'agit d'un incident côté hébergement (rien à corriger dans le code).

## Détails techniques

- Aucun changement de code n'est prévu à ce stade : le projet compile et se déploie correctement en local.
- Étapes : `security--run_security_scan` → `security--get_scan_results` → `preview_ui--publish`.
- Si le retour de publication est `latest_commit_missing` ou une erreur d'infrastructure, aucune modification du projet ne la résoudra : il faudra réessayer un peu plus tard.
