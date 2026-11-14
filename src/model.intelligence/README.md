# model.intelligence

Structure modulaire du moteur IA Twin-Medic.

## Modules

- `constants.js`: seuils, baseline et modes de latence.
- `utils.js`: fonctions numeriques partagees.
- `labels.js`: labels de risque, qualite et mode reseau.
- `baseline.js`: baseline patient depuis l'historique.
- `latency.js`: calcul age paquet, packet gap, perte et qualite.
- `projection.js`: compensation temporelle des constantes vitales.
- `piezo.js`: classification et memoire recente des impacts.
- `evidence.js`: extraction des preuves capteurs.
- `forecast.js`: projection du risque 5 / 10 / 15 min.
- `recommendations.js`: recommandations tactiques explicables.
- `waitingDecision.js`: sortie standard quand les capteurs ne sont pas prets.
- `pipeline.js`: orchestration complete du modele.
- `index.js`: point d'entree public du dossier.

`../MODELE_IA.js` reste un adaptateur pour garder l'import existant dans
l'interface React.
