import { LATENCY_MODE } from "./constants.js";

export function riskLabel(score) {
  if (score >= 85) return "Critique";
  if (score >= 70) return "Eleve";
  if (score >= 45) return "Modere";
  return "Faible";
}

export function qualityLabel(quality) {
  if (quality >= 82) return "Signal fiable";
  if (quality >= 58) return "Signal utilisable";
  if (quality >= 35) return "Signal retarde";
  return "Signal faible";
}

export function modeLabel(mode) {
  if (mode === LATENCY_MODE.DIRECT) return "Temps quasi reel";
  if (mode === LATENCY_MODE.COMPENSATED) return "Compensation retard";
  if (mode === LATENCY_MODE.DEGRADED) return "Mode degrade";
  if (mode === LATENCY_MODE.STALE) return "Donnees anciennes";
  return "En attente";
}
