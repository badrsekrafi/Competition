"""
Twin-Medic Python AI service.

This service is intentionally dependency-light so it can run during a demo.
It exposes a stable /predict API and keeps room for heavier Transformer
adapters without making the dashboard depend on GPU or internet access.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from adapters.registry import active_adapter_ids, adapter_summaries, recommended_stack


MODEL_NAME = "Python AI Service - Hybrid physiological risk model"


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return min(maximum, max(minimum, value))


def read_number(value: Any, fallback: float = 0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def parse_time_ms(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(text).timestamp() * 1000
        except ValueError:
            return None
    return None


def risk_label(score: float) -> str:
    if score >= 85:
        return "Critique"
    if score >= 70:
        return "Eleve"
    if score >= 45:
        return "Modere"
    return "Faible"


def mode_label(age_ms: float) -> str:
    if age_ms > 10000:
        return "Donnees anciennes"
    if age_ms > 5500:
        return "Mode degrade"
    if age_ms > 1800:
        return "Compensation retard"
    return "Temps quasi reel"


def calculate_latency(telemetry: dict[str, Any]) -> dict[str, Any]:
    now_ms = datetime.now(tz=timezone.utc).timestamp() * 1000
    received_at = (
        parse_time_ms(telemetry.get("clientReceivedAt"))
        or parse_time_ms(telemetry.get("serverReceivedAt"))
        or parse_time_ms(telemetry.get("timestamp"))
        or now_ms
    )
    source_at = (
        parse_time_ms(telemetry.get("sourceTimestamp"))
        or parse_time_ms(telemetry.get("sampleTimestamp"))
        or parse_time_ms(telemetry.get("raw", {}).get("timestamp") if isinstance(telemetry.get("raw"), dict) else None)
    )
    receive_age_ms = clamp(now_ms - received_at, 0, 60000)
    transport_latency_ms = clamp(received_at - source_at, 0, 60000) if source_at else receive_age_ms
    age_ms = max(receive_age_ms, transport_latency_ms)
    loss = read_number(telemetry.get("loss"), 0)
    quality = clamp(round(100 - max(0, age_ms - 900) / 115 - loss * 3.5))

    return {
        "modeLabel": mode_label(age_ms),
        "ageMs": round(age_ms),
        "ageSeconds": round(age_ms / 1000, 1),
        "receiveAgeMs": round(receive_age_ms),
        "transportLatencyMs": round(transport_latency_ms),
        "quality": quality,
        "loss": loss,
        "transport": telemetry.get("transport") or telemetry.get("dataSource") or "python-service",
    }


def strongest_piezo(telemetry: dict[str, Any]) -> dict[str, Any]:
    sensors = telemetry.get("piezoSensors") if isinstance(telemetry.get("piezoSensors"), list) else []
    if sensors:
        return max(sensors, key=lambda sensor: read_number(sensor.get("intensity"), 0))

    piezo = telemetry.get("piezo") if isinstance(telemetry.get("piezo"), dict) else {}
    labels = {
        "rightArm": "Bras droite",
        "leftArm": "Bras gauche",
        "rightLeg": "Pied droit",
        "leftLeg": "Pied gauche",
        "chest": "Poitrine",
    }
    if not piezo:
        return {"id": "none", "label": "Aucune zone", "intensity": 0, "hit": False}

    zone_id, value = max(piezo.items(), key=lambda item: read_number(item[1], 0))
    intensity = read_number(value, 0)
    return {
        "id": zone_id,
        "label": labels.get(zone_id, zone_id),
        "intensity": intensity,
        "hit": intensity >= 72,
    }


def zone_type(zone_id: str) -> str:
    if zone_id in {"rightLeg", "leftLeg"}:
        return "leg"
    if zone_id in {"rightArm", "leftArm"}:
        return "limb"
    if zone_id == "chest":
        return "chest"
    return "unknown"


def normalize(value: float, start: float, end: float) -> float:
    if end == start:
        return 0
    return clamp(((value - start) / (end - start)) * 100)


def build_recommendation(zone: str, strongest: dict[str, Any], score: float, latency: dict[str, Any]) -> dict[str, Any]:
    delay_prefix = "" if latency["modeLabel"] == "Temps quasi reel" else "Decision Python avec compensation retard; confirmer terrain. "
    if score < 45:
        return {
            "diagnosis": "Situation stable",
            "status": "Stable",
            "alertText": "Aucune anomalie critique detectee",
            "recommendation": f"{delay_prefix}Continuer monitoring et verifier la qualite reseau.",
            "recommendedActions": [
                "Continuer monitoring cardio, SpO2, temperature et piezo.",
                "Surveiller la latence et la perte de paquets.",
                "Garder JS model comme fallback si le service Python tombe.",
            ],
        }
    if zone == "leg":
        return {
            "diagnosis": f"Suspicion projectile membre inferieur ({strongest['label']})",
            "status": "Impact detecte",
            "alertText": f"Impact balistique detecte: {strongest['label']}",
            "recommendation": f"{delay_prefix}Verifier hemorragie, stabiliser, evacuer selon protocole medical.",
            "recommendedActions": [
                "Verifier visuellement la zone impactee.",
                "Controler hemorragie par personnel forme.",
                "Evacuation et surveillance SpO2/cardio continue.",
            ],
        }
    if zone == "chest":
        return {
            "diagnosis": "Suspicion impact thoracique",
            "status": "Impact critique",
            "alertText": "Impact thoracique detecte",
            "recommendation": f"{delay_prefix}Priorite evacuation et evaluation respiratoire.",
            "recommendedActions": [
                "Evaluer respiration, douleur thoracique et SpO2.",
                "Alerter equipe medicale.",
                "Evacuation rapide avec monitoring continu.",
            ],
        }
    return {
        "diagnosis": "Anomalie physiologique detectee",
        "status": "A surveiller",
        "alertText": "Anomalie multi-capteurs detectee",
        "recommendation": f"{delay_prefix}Verifier capteurs et combattant; escalader si le score augmente.",
        "recommendedActions": [
            "Verifier placement capteurs.",
            "Comparer piezo, cardio, SpO2 et respiration.",
            "Alerter equipe medicale si deterioration.",
        ],
    }


def predict(payload: dict[str, Any]) -> dict[str, Any]:
    telemetry = payload.get("telemetry") if isinstance(payload.get("telemetry"), dict) else payload
    patient = payload.get("patient") if isinstance(payload.get("patient"), dict) else {}
    latency = calculate_latency(telemetry)
    strongest = strongest_piezo(telemetry)
    zone = zone_type(strongest.get("id", "none"))

    heart = read_number(telemetry.get("heart") or telemetry.get("bpm"), 0)
    spo2 = read_number(telemetry.get("spo2"), 0)
    respiration = read_number(telemetry.get("respiration"), 0)
    temperature = read_number(telemetry.get("temp"), 0)

    piezo_evidence = max(normalize(read_number(strongest.get("intensity"), 0), 35, 95), 82 if strongest.get("hit") else 0)
    cardio_evidence = normalize(heart, 105, 145) if heart > 0 else 0
    spo2_evidence = normalize(94 - spo2, 0, 8) if spo2 > 0 else 0
    respiration_evidence = normalize(respiration, 22, 34) if respiration > 0 else 0
    temperature_evidence = normalize(temperature - 37.2, 0.4, 2.2) if temperature > 0 else 0
    fusion_bonus = (
        (10 if piezo_evidence > 55 and cardio_evidence > 45 else 0)
        + (14 if piezo_evidence > 55 and spo2_evidence > 35 else 0)
        + (18 if zone == "chest" and (spo2_evidence > 25 or respiration_evidence > 35) else 0)
    )
    stale_penalty = 10 if latency["ageMs"] > 10000 else 4 if latency["ageMs"] > 5500 else 0
    score = clamp(round(
        piezo_evidence * 0.33
        + cardio_evidence * 0.21
        + spo2_evidence * 0.22
        + respiration_evidence * 0.12
        + temperature_evidence * 0.05
        + fusion_bonus
        - stale_penalty
    ))
    forecast = {
        "now": score,
        "riskAt5Min": clamp(round(score + (8 if piezo_evidence > 55 else 0) + spo2_evidence * 0.03)),
        "riskAt10Min": clamp(round(score + (10 if piezo_evidence > 55 else 0) + spo2_evidence * 0.05)),
        "riskAt15Min": clamp(round(score + (12 if piezo_evidence > 55 else 0) + spo2_evidence * 0.08)),
    }
    confidence = clamp(round(34 + latency["quality"] * 0.34 + score * 0.24 + (8 if strongest.get("hit") else 0)))
    recommendation = build_recommendation(zone, strongest, score, latency)

    return {
        "modelName": MODEL_NAME,
        "engine": "python-hybrid-with-transformer-adapter-registry",
        "activeAdapters": active_adapter_ids(),
        "modelStack": adapter_summaries(),
        "patientId": patient.get("id", "patient-non-selectionne"),
        "patientName": " ".join(filter(None, [patient.get("firstName"), patient.get("lastName")])) or "Patient non selectionne",
        "anomalyDetected": score >= 55 or bool(strongest.get("hit")),
        "score": score,
        "riskLabel": risk_label(score),
        "confidence": confidence,
        "strongestPiezo": strongest,
        "impactedZones": [strongest] if strongest.get("hit") else [],
        "latency": latency,
        "evidenceRows": [
            {"id": "piezo", "label": "Piezo impact", "value": round(piezo_evidence)},
            {"id": "cardio", "label": "Cardio/ECG", "value": round(cardio_evidence)},
            {"id": "spo2", "label": "SpO2", "value": round(spo2_evidence)},
            {"id": "respiration", "label": "Respiration", "value": round(respiration_evidence)},
            {"id": "temperature", "label": "Temperature", "value": round(temperature_evidence)},
        ],
        "prediction": {
            "observedVitals": {"heart": heart, "spo2": spo2, "respiration": respiration, "temperature": temperature},
            "correctedVitals": {"heart": heart, "spo2": spo2, "respiration": respiration, "temperature": temperature},
            "forecast": forecast,
        },
        **recommendation,
        "explanation": (
            f"Python service: liaison {latency['modeLabel'].lower()} "
            f"({latency['ageSeconds']}s, qualite {latency['quality']}%). "
            f"Fusion piezo {round(piezo_evidence)}%, cardio {round(cardio_evidence)}%, "
            f"SpO2 {round(spo2_evidence)}%, respiration {round(respiration_evidence)}%. "
            f"Risque projete 15 min: {forecast['riskAt15Min']}/100."
        ),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "TwinMedicAI/0.1"

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(200, {
                "ok": True,
                "modelName": MODEL_NAME,
                "activeAdapters": active_adapter_ids(),
                "adapterCount": len(adapter_summaries()),
            })
            return
        if self.path == "/models":
            self._send_json(200, {
                "ok": True,
                "modelName": MODEL_NAME,
                "models": adapter_summaries(),
                "recommendedStack": recommended_stack(),
            })
            return
        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        if self.path != "/predict":
            self._send_json(404, {"ok": False, "error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            self._send_json(200, {"ok": True, "decision": predict(payload)})
        except Exception as exc:  # noqa: BLE001 - API boundary should report structured errors.
            self._send_json(400, {"ok": False, "error": str(exc)})


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Twin-Medic Python AI service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8790)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Twin-Medic Python AI service listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
