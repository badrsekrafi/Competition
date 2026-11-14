import { VITAL_LIMITS } from "./constants.js";
import { clamp, parseTimestampMs, readNumber } from "./utils.js";

function trendPerSecond(history, key) {
  if (!Array.isArray(history)) return 0;
  const samples = history
    .map((sample) => ({
      time: parseTimestampMs(sample.time ?? sample.clientReceivedAt ?? sample.timestamp),
      value: readNumber(sample[key]),
    }))
    .filter((sample) => sample.time !== null && sample.value !== null && sample.value > 0)
    .slice(-8);

  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const seconds = Math.max(1, (last.time - first.time) / 1000);
  return (last.value - first.value) / seconds;
}

function projectVital(current, baseline, slope, lagSeconds, limits) {
  const source = current > 0 ? current : baseline;
  const projected = source + slope * lagSeconds;
  return clamp(projected, limits.min, limits.max);
}

export function projectVitals(telemetry, history, baseline, latency) {
  const lagSeconds = clamp(latency.ageMs / 1000, 0, 8);
  const observed = {
    heart: readNumber(telemetry?.heart) ?? 0,
    spo2: readNumber(telemetry?.spo2) ?? 0,
    respiration: readNumber(telemetry?.respiration) ?? 0,
    temperature: readNumber(telemetry?.temp) ?? 0,
  };
  const trends = {
    heart: trendPerSecond(history, "heart"),
    spo2: trendPerSecond(history, "spo2"),
    respiration: trendPerSecond(history, "respiration"),
    temperature: trendPerSecond(history, "temp"),
  };

  const corrected = {
    heart: projectVital(observed.heart, baseline.heart, trends.heart, lagSeconds, VITAL_LIMITS.heart),
    spo2: projectVital(observed.spo2, baseline.spo2, trends.spo2, lagSeconds, VITAL_LIMITS.spo2),
    respiration: projectVital(
      observed.respiration,
      baseline.respiration,
      trends.respiration,
      lagSeconds,
      VITAL_LIMITS.respiration,
    ),
    temperature: projectVital(
      observed.temperature,
      baseline.temperature,
      trends.temperature,
      lagSeconds,
      VITAL_LIMITS.temperature,
    ),
  };

  return { observed, corrected, trends, lagSeconds };
}
