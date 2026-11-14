# Model intelligence artificiel - demarche Twin-Medic

Ce dossier documente la demarche IA utilisee dans Twin-Medic. Le but n'est pas
de remplacer un medecin, mais de produire une aide a la decision: detection,
prediction courte duree, score de risque et recommandation terrain.

## 1. Probleme traite

Le systeme recoit des donnees capteurs depuis ESP32: ECG/AD8232, MAX30102,
temperature, IMU, piezo et GPS. Dans la pratique, les paquets ne sont pas
toujours parfaitement temps reel: il peut y avoir du retard, du jitter, des
paquets sautes ou un passage par bridge/API/UDP. Un modele trop strict donne
alors des faux diagnostics parce qu'il croit que la derniere valeur est
instantanee.

La version actuelle du modele est donc flexible:

- elle mesure la fraicheur de la donnee;
- elle estime la qualite du signal;
- elle compense le retard avec l'historique recent;
- elle baisse la confiance si les paquets sont anciens ou instables;
- elle affiche ces informations dans l'interface.

## 2. Architecture recommandee

Architecture cible pour un prototype professionnel:

```text
Capteurs ESP32
  -> nettoyage et synchronisation temporelle
  -> fenetre historique courte
  -> compensation retard / perte de paquets
  -> extraction features
  -> fusion IA explicable
  -> score de risque
  -> forecast 5 / 10 / 15 min
  -> dashboard + recommandations
```

Architecture avancee possible plus tard:

```text
NormWear              -> representation globale wearable
ECG-FM / HuBERT-ECG   -> analyse ECG
PaPaGei / Pulse-PPG   -> analyse PPG / SpO2
MOMENT / Chronos      -> prediction serie temporelle
Isolation Forest      -> detection anomalie
XGBoost / TabPFN      -> fusion finale et score
Regles NEWS2 / TCCC   -> protocole propose
```

Dans ce repo, `src/MODELE_IA.js` implemente une version JavaScript locale,
explicable et rapide, adaptee au prototype sans backend ML lourd.

## 3. Pipeline implemente dans MODELE_IA.js

### Etape A - Baseline patient

Le modele construit une baseline a partir des dernieres mesures:

- frequence cardiaque;
- SpO2;
- respiration;
- temperature.

Si l'historique est insuffisant, il utilise une baseline par defaut.

### Etape B - Analyse du retard

Le module calcule:

- `ageSeconds`: age de la derniere mesure recue;
- `packetGap`: saut entre paquets;
- `loss`: perte declaree;
- `quality`: qualite du signal de 0 a 100;
- `modeLabel`: temps quasi reel, compensation retard, mode degrade ou donnees anciennes.

Cette logique rend le modele plus robuste quand la transmission n'est pas
parfaitement real-time.

### Etape C - Compensation temporelle

Si la donnee est retardee, le modele regarde la pente des dernieres valeurs et
projette une valeur corrigee:

```text
valeur_corrigee = valeur_observee + tendance_recente * retard
```

La compensation est limitee pour eviter les extrapolations dangereuses.

### Etape D - Fusion multi-capteurs

Le modele calcule des preuves normalisees:

- preuve piezo impact;
- preuve cardio/ECG;
- preuve SpO2;
- preuve respiration;
- preuve temperature.

Ensuite il applique une fusion ponderee avec bonus si plusieurs capteurs
confirment le meme evenement.

### Etape E - Score et forecast

Le resultat contient:

- `score`: risque actuel 0-100;
- `riskLabel`: faible, modere, eleve, critique;
- `confidence`: confiance du modele;
- `forecast.riskAt5Min`;
- `forecast.riskAt10Min`;
- `forecast.riskAt15Min`.

### Etape F - Recommandation

La recommandation reste encadree: le modele propose une action de triage ou de
surveillance, mais la decision finale doit rester humaine.

## 4. Liaison avec l'interface graphique

Les resultats du modele sont injectes dans la telemetry enrichie:

```text
telemetry.aiDecision
telemetry.modelLatency
telemetry.dataQuality
telemetry.forecastRisk
telemetry.predictedVitals
telemetry.evidenceRows
```

L'interface utilise ces champs pour afficher:

- le risque actuel;
- la confiance;
- le mode de latence;
- la qualite signal;
- le risque projete a 15 minutes;
- les barres d'evidence piezo/cardio/SpO2/respiration/temperature.

## 5. Limites actuelles

Cette version est un moteur IA heuristique explicable. Elle est utile pour une
demo et pour structurer le projet, mais elle ne remplace pas un modele entraine
sur donnees medicales reelles. Pour une version recherche/production, il faut:

- collecter des donnees terrain annotees;
- calibrer les capteurs;
- entrainer ou fine-tuner les modeles specialises;
- valider medicalement les seuils;
- tracer toutes les decisions pour audit.

## 6. Fichiers lies

- `src/MODELE_IA.js`: pipeline IA flexible.
- `src/App.jsx`: liaison telemetry -> modele -> dashboard.
- `server/index.js`: metadata de reception cote API/bridge.
