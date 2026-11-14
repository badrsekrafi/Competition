import { CHEST_ZONES, LEG_ZONES, LIMB_ZONES } from "./constants.js";
import { clamp, parseTimestampMs, round } from "./utils.js";

export function getStrongestPiezo(piezoSensors = []) {
  const sorted = [...piezoSensors].sort((a, b) => Number(b.intensity || 0) - Number(a.intensity || 0));
  return sorted[0] || { id: "none", label: "Aucune zone", intensity: 0, hit: false };
}

export function getImpactedZones(piezoSensors = []) {
  return piezoSensors.filter((sensor) => sensor.hit || Number(sensor.intensity || 0) >= 72);
}

export function classifyZone(zoneId) {
  if (LEG_ZONES.has(zoneId)) return "leg";
  if (LIMB_ZONES.has(zoneId)) return "limb";
  if (CHEST_ZONES.has(zoneId)) return "chest";
  return "unknown";
}

export function recentPiezoMemory(history, nowMs) {
  if (!Array.isArray(history)) {
    return { id: "none", label: "Aucune zone", intensity: 0, hit: false, ageSeconds: 0 };
  }

  let strongest = { id: "none", label: "Aucune zone", intensity: 0, hit: false, ageSeconds: 0 };
  history.slice(-10).forEach((sample) => {
    const sampleTime = parseTimestampMs(sample.time ?? sample.clientReceivedAt ?? sample.timestamp);
    if (!sampleTime) return;
    const ageSeconds = (nowMs - sampleTime) / 1000;
    if (ageSeconds < 0 || ageSeconds > 10) return;

    (sample.piezoSensors || []).forEach((sensor) => {
      const rawIntensity = Number(sensor.intensity || 0);
      const decayedIntensity = rawIntensity * clamp(1 - ageSeconds / 11, 0, 1);
      if (decayedIntensity > strongest.intensity) {
        strongest = {
          ...sensor,
          intensity: decayedIntensity,
          hit: Boolean(sensor.hit) || rawIntensity >= 72,
          ageSeconds: round(ageSeconds, 1),
        };
      }
    });
  });

  return strongest;
}
