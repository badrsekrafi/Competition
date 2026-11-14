export const MODEL_NAME = "MODELE IA - Fusion flexible avec compensation retard";

export const DEFAULT_BASELINE = {
  heart: 92,
  spo2: 97,
  respiration: 18,
  temperature: 37.2,
};

export const VITAL_LIMITS = {
  heart: { min: 35, max: 190 },
  spo2: { min: 70, max: 100 },
  respiration: { min: 0, max: 45 },
  temperature: { min: 32, max: 42 },
};

export const LIMB_ZONES = new Set(["rightLeg", "leftLeg", "rightArm", "leftArm"]);
export const LEG_ZONES = new Set(["rightLeg", "leftLeg"]);
export const CHEST_ZONES = new Set(["chest"]);

export const LATENCY_MODE = {
  DIRECT: "direct",
  COMPENSATED: "compensated",
  DEGRADED: "degraded",
  STALE: "stale",
  WAITING: "waiting",
};
