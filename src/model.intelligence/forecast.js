import { clamp } from "./utils.js";

export function forecastRisk(score, evidence, latency) {
  const physiologicalPressure =
    evidence.cardioEvidence * 0.20 +
    evidence.spo2Evidence * 0.28 +
    evidence.respirationEvidence * 0.18 +
    evidence.temperatureEvidence * 0.08;
  const impactPressure = evidence.piezoEvidence > 55 ? 8 : 0;
  const uncertaintyPressure = latency.quality < 55 ? 6 : 0;

  return {
    now: score,
    riskAt5Min: clamp(Math.round(score + physiologicalPressure * 0.08 + impactPressure)),
    riskAt10Min: clamp(Math.round(score + physiologicalPressure * 0.14 + impactPressure + uncertaintyPressure)),
    riskAt15Min: clamp(Math.round(score + physiologicalPressure * 0.20 + impactPressure + uncertaintyPressure)),
  };
}
