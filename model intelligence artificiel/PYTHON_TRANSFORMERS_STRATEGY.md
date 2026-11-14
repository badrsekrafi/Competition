# Strategie Python + Transformers pour gagner la competition

## Decision recommandee

Ne pas remplacer totalement le modele JavaScript. Le meilleur choix est une
architecture hybride:

```text
Dashboard React
  -> modele JS explicable et rapide comme fallback
  -> API Node telemetry
  -> Python AI service optionnel
  -> adapters Transformers / TabPFN / Chronos plus tard
```

Pourquoi:

- Le jury voit une architecture IA professionnelle.
- La demo reste stable si le service Python ou GPU n'est pas disponible.
- Les decisions restent explicables: score, confiance, evidence, forecast.
- On peut annoncer des modeles fondation sans bloquer le prototype.

## Modeles pertinents

1. Chronos-2 ou MOMENT pour prediction temporelle.
2. PaPaGei pour PPG / SpO2 / signaux optiques.
3. ECG-FM ou HuBERT-ECG pour ECG.
4. TabPFN pour fusion finale tabulaire si vous creez un dataset annote.
5. Regles NEWS2 + TCCC pour garder une logique medicale defendable.

## Sources primaires utiles

- MOMENT: https://github.com/moment-timeseries-foundation-model/moment
- Chronos-2: https://huggingface.co/amazon/chronos-2
- NormWear: https://github.com/Mobile-Sensing-and-UbiComp-Laboratory/NormWear
- PaPaGei: https://github.com/Nokia-Bell-Labs/papagei-foundation-model
- ECG-FM: https://github.com/bowang-lab/ECG-FM/
- HuBERT-ECG: https://github.com/Edoar-do/HuBERT-ECG
- TabPFN: https://github.com/PriorLabs/tabpfn
- NEWS2: https://www.england.nhs.uk/ourwork/clinical-policy/sepsis/nationalearlywarningscore/
- TCCC / CoTCCC: https://jts.health.mil/index.cfm/committees/cotccc

## Ce qu'il faut ajouter au code

Deja ajoute:

- `ai_service/service.py`: endpoint Python `/predict`.
- `ai_service/adapters/`: registry officiel des adapters Transformers/TabPFN.
- `AI_SERVICE_URL` dans `server/index.js`: enrichissement optionnel par Python.
- fallback JS intact dans `src/model.intelligence`.

Endpoints presentables:

- `GET /health`: etat du service Python.
- `GET /models`: liste Chronos/MOMENT/ECG/PPG/TabPFN avec status.
- `POST /predict`: decision IA exploitable par le dashboard.

Prochaine etape si vous avez temps:

- adapter Chronos/MOMENT pour forecast vital signs;
- adapter ECG-FM/HuBERT pour ECG wave;
- dataset local `training_data/` avec scenarios annotes;
- rapport d'evaluation: latency, packet loss, accuracy simulation.

## Pitch devant le jury

Phrase simple:

> Notre systeme ne depend pas d'un seul modele. Il combine une inference edge
> explicable, une couche Python compatible Transformers, une compensation des
> retards reseau et des regles medicales de triage. Si le modele lourd est
> indisponible, le systeme degrade proprement vers un modele local explicable.
