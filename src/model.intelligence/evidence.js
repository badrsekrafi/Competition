import { clamp, normalizeRange } from "./utils.js";

export function buildEvidence({ strongestPiezo, piezoMemory, projected, baseline, latency }) {
  const piezoFreshness = latency
    ? clamp(1 - Math.max(0, latency.ageMs - 12000) / 18000, 0, 1)
    : 1;
  const freshStrongestPiezo = {
    ...strongestPiezo,
    intensity: Number(strongestPiezo.intensity || 0) * piezoFreshness,
    hit: Boolean(strongestPiezo.hit) && piezoFreshness > 0.35,
  };
  const activePiezo = Number(freshStrongestPiezo.intensity || 0) >= Number(piezoMemory.intensity || 0)
    ? freshStrongestPiezo
    : piezoMemory;

  const heartRise = projected.corrected.heart > 0 ? Math.max(0, projected.corrected.heart - baseline.heart) : 0;
  const spo2Drop = projected.corrected.spo2 > 0 ? Math.max(0, baseline.spo2 - projected.corrected.spo2) : 0;
  const respirationDelta = projected.corrected.respiration > 0
    ? Math.abs(projected.corrected.respiration - baseline.respiration)
    : 0;
  const temperatureDelta = projected.corrected.temperature > 0
    ? Math.max(0, projected.corrected.temperature - baseline.temperature)
    : 0;

  const piezoEvidence = Math.max(
    normalizeRange(Number(activePiezo.intensity || 0), 35, 95),
    activePiezo.hit ? 82 : 0,
  );
  const cardioEvidence = projected.corrected.heart > 0
    ? Math.max(
        normalizeRange(projected.corrected.heart, 105, 145),
        normalizeRange(heartRise, 10, 35),
      )
    : 0;
  const spo2Evidence = projected.corrected.spo2 > 0
    ? Math.max(
        normalizeRange(94 - projected.corrected.spo2, 0, 8),
        normalizeRange(spo2Drop, 2, 8),
      )
    : 0;
  const respirationEvidence = projected.corrected.respiration > 0
    ? Math.max(
        normalizeRange(projected.corrected.respiration, 22, 34),
        normalizeRange(respirationDelta, 5, 16),
      )
    : 0;
  const temperatureEvidence = projected.corrected.temperature > 0
    ? normalizeRange(temperatureDelta, 0.4, 2.2)
    : 0;

  return {
    activePiezo,
    heartRise,
    spo2Drop,
    respirationDelta,
    temperatureDelta,
    piezoEvidence,
    cardioEvidence,
    spo2Evidence,
    respirationEvidence,
    temperatureEvidence,
    rows: [
      { id: "piezo", label: "Piezo impact", value: Math.round(piezoEvidence) },
      { id: "cardio", label: "Cardio/ECG", value: Math.round(cardioEvidence) },
      { id: "spo2", label: "SpO2", value: Math.round(spo2Evidence) },
      { id: "respiration", label: "Respiration", value: Math.round(respirationEvidence) },
      { id: "temperature", label: "Temperature", value: Math.round(temperatureEvidence) },
    ],
  };
}
