import { DEFAULT_BASELINE } from "./constants.js";
import { average, readNumber } from "./utils.js";

export function getBaseline(history) {
  const samples = Array.isArray(history) ? history.slice(-18) : [];

  return {
    heart: average(samples.map((sample) => readNumber(sample.heart)), DEFAULT_BASELINE.heart),
    spo2: average(samples.map((sample) => readNumber(sample.spo2)), DEFAULT_BASELINE.spo2),
    respiration: average(samples.map((sample) => readNumber(sample.respiration)), DEFAULT_BASELINE.respiration),
    temperature: average(samples.map((sample) => readNumber(sample.temp)), DEFAULT_BASELINE.temperature),
  };
}
