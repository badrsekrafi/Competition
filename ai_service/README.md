# Twin-Medic Python AI Service

This service adds a professional Python inference layer without making the
dashboard fragile. It can run today with the Python standard library, and later
receive real adapters for foundation models.

## Run

```bash
python ai_service/service.py --host 127.0.0.1 --port 8790
```

Then start the Node API with:

```bash
$env:AI_SERVICE_URL="http://127.0.0.1:8790"
npm run dev:api
```

The dashboard still works if the Python service is offline. In that case,
React uses the JavaScript model as a fallback.

## Endpoints

- `GET /health`
- `GET /models`
- `POST /predict`

Example body:

```json
{
  "telemetry": {
    "bpm": 118,
    "spo2": 91,
    "respiration": 27,
    "temp": 38.1,
    "piezo": { "rightLeg": 84 },
    "sourceTimestamp": "2026-06-11T09:40:00.000Z"
  }
}
```

## Why this architecture wins points

- Python service makes the AI layer credible and extensible.
- JavaScript fallback keeps the demo stable.
- The API exposes latency, confidence, forecast and evidence rows.
- Real Transformers can be added without rewriting the dashboard.

## Adapter registry

The service exposes a real model registry at:

```text
GET http://127.0.0.1:8790/models
```

It reports whether the optional model families are installed locally:

- Chronos-2 / MOMENT for time-series forecasting.
- ECG-FM / HuBERT-ECG for ECG representation.
- PaPaGei for PPG/MAX30102 representation.
- TabPFN for final tabular fusion.

During a demo, this is honest and useful: the service runs with the lightweight
fallback today, while showing exactly how heavier Transformer adapters plug in.
