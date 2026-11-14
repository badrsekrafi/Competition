import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  Bell,
  Brain,
  Box,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  Eye,
  Grid2X2,
  HeartPulse,
  MapPin,
  Moon,
  Radio,
  Shield,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  UserRound,
  Wifi,
  X,
} from "lucide-react";
import referenceImage from "../WhatsApp Image 2026-05-29 at 11.09.09 AM.jpeg";
import twinBodyImage from "./twin-medic-body.png";
import { applyModeleIA } from "./MODELE_IA.js";
import PiezoTestPage from "./PiezoTestPage.jsx";

const refBg = {
  "--reference-image": `url("${referenceImage}")`,
};

const twinBodyBg = {
  "--twin-body-image": `url("${twinBodyImage}")`,
};

const navItems = [
  { key: "global", label: "Vue globale", icon: Grid2X2, target: "dashboard" },
  { key: "sensors", label: "Capteurs", icon: Radio, target: "sensors" },
  { key: "patients", label: "Patients NFC", icon: UserRound, target: "patients" },
  { key: "twin", label: "Jumeau 3D", icon: Box, target: "patient" },
  { key: "prediction", label: "Prédictions IA", icon: Brain, target: "prediction" },
  { key: "recommendations", label: "Recommandations", icon: ShieldCheck, target: "recommendations" },
  { key: "history", label: "Historique", icon: Clock3, target: "comparison" },
];

const featureCards = [
  { key: "twin", icon: UserRound, title: "Jumeau Numérique", detail: "Représentation fidèle en temps réel" },
  { key: "prediction", icon: Brain, title: "IA Prédictive", detail: "Anticipe et aide à la décision" },
  { key: "sensors", icon: Activity, title: "Monitoring Temps Réel", detail: "Données fiables via ESP32" },
  { key: "recommendations", icon: ShieldCheck, title: "Système de Recommandation", detail: "Actions concrètes et sécurisées" },
];

const recommendationRows = [
  {
    id: "surveillance",
    icon: Eye,
    title: "Surveillance renforcée",
    detail: "Augmenter la fréquence de suivi et rester vigilant.",
    applied: "Surveillance renforcée activée",
    num: 1,
    tone: "blue",
  },
  {
    id: "constants",
    icon: Stethoscope,
    title: "Contrôle des constantes",
    detail: "Vérifier régulièrement la FC, SpO2, TA et température.",
    applied: "Contrôle automatique des constantes lancé",
    num: 2,
    tone: "green",
  },
  {
    id: "evacuation",
    icon: Ambulance,
    title: "Préparer évacuation si aggravation",
    detail: "Préparer les moyens d'évacuation rapide si les signes s'aggravent.",
    applied: "Pré-alerte d'évacuation préparée",
    num: 3,
    tone: "orange",
  },
];

function makeRecommendationRows(aiDecision) {
  if (!aiDecision?.recommendedActions?.length) return recommendationRows;

  const icons = [AlertTriangle, Stethoscope, Ambulance];
  const tones = aiDecision.anomalyDetected ? ["orange", "green", "blue"] : ["blue", "green", "orange"];

  return aiDecision.recommendedActions.slice(0, 3).map((action, index) => ({
    id: `ai-${index}-${aiDecision.score}`,
    icon: icons[index] || ShieldCheck,
    title: action,
    detail: index === 0 ? aiDecision.diagnosis : "Fusion IA: piezo + cardio + SpO2 + respiration.",
    applied: `Action IA ${index + 1} confirmee`,
    num: index + 1,
    tone: tones[index] || "blue",
  }));
}

const horizons = [30, 60, 90];

const PIEZO_IMPACT_THRESHOLD = 72;
const SENSOR_CHART_SAMPLE_LIMIT = 72;
const NORMAL_BODY_TEMPERATURE_RANGE = { min: 36.5, max: 37.8 };
const VALID_BODY_SENSOR_TEMPERATURE_RANGE = { min: 10, max: 60 };

const piezoSensorZones = [
  { id: "rightArm", label: "Bras droite", shortLabel: "BRAS D", className: "right-arm", pin: "GPIO35", aliases: ["rightArm", "brasDroit", "brasDroite", "armRight"] },
  { id: "leftArm", label: "Bras gauche", shortLabel: "BRAS G", className: "left-arm", pin: "GPIO32", aliases: ["leftArm", "brasGauche", "armLeft"] },
  { id: "rightLeg", label: "Pied droit", shortLabel: "PIED D", className: "right-leg", pin: "GPIO33", aliases: ["rightLeg", "piedDroit", "jambeDroite", "legRight"] },
  { id: "leftLeg", label: "Pied gauche", shortLabel: "PIED G", className: "left-leg", pin: "GPIO36", aliases: ["leftLeg", "piedGauche", "jambeGauche", "legLeft"] },
  { id: "chest", label: "Poitrine", shortLabel: "POITRINE", className: "chest", pin: "GPIO39", aliases: ["chest", "poitrine", "torse"] },
];

const hardwarePinout = {
  board: "ESP32 DevKit",
  piezo: piezoSensorZones.map(({ id, label, pin }) => ({ id, label, pin, type: "Piezo / vibration" })),
  ecg: { id: "ecg", label: "AD8232 OUT / LO+ / LO-", pin: "GPIO34 / GPIO25 / GPIO26", type: "ECG" },
  max30102: { id: "max30102", label: "GY-MAX30102", pin: "I2C SDA21 / SCL22", type: "SpO2 + BPM" },
  motion: { id: "motion", label: "MPU-9250 / MPU-6500", pin: "I2C SDA21 / SCL22", type: "Accel + gyro" },
};

const defaultSimulationRanges = {
  heart: { label: "Frequence cardiaque", unit: "bpm", min: 82, max: 112, step: 1 },
  temp: { label: "Temperature", unit: "C", min: 36.6, max: 38.2, step: 0.1 },
  respiration: { label: "Frequence respiratoire", unit: "rpm", min: 14, max: 26, step: 1 },
  spo2: { label: "SpO2 MAX30102", unit: "%", min: 94, max: 99, step: 1 },
  piezo: { label: "Vibration piezo", unit: "%", min: 5, max: 32, step: 1 },
};

const defaultPatients = [
  {
    id: "PAT-ESP32-01",
    nfcId: "04-A3-9C-21",
    firstName: "Ahmed",
    lastName: "Sala",
    heightCm: "176",
    weightKg: "74",
    bloodType: "O+",
    diseases: "Asthme leger, hypertension surveillee",
    lastConsultation: "2026-05-24",
    careResult: "Constantes stables, suivi cardio recommande.",
  },
  {
    id: "PAT-2026-02",
    nfcId: "7B-19-44-F0",
    firstName: "Meriem",
    lastName: "Ben Ali",
    heightCm: "164",
    weightKg: "62",
    bloodType: "A+",
    diseases: "Diabete type 2, allergie penicilline",
    lastConsultation: "2026-05-18",
    careResult: "Glycemie controlee, prochain bilan dans 30 jours.",
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function computeBmi(heightCm, weightKg) {
  const height = Number(heightCm) / 100;
  const weight = Number(weightKg);
  if (!height || !weight || height <= 0 || weight <= 0) return "";
  return (weight / (height * height)).toFixed(1);
}

function createEmptyPatient() {
  return {
    id: `PAT-${Date.now().toString().slice(-6)}`,
    nfcId: "",
    firstName: "",
    lastName: "",
    heightCm: "",
    weightKg: "",
    bloodType: "",
    diseases: "",
    lastConsultation: new Date().toISOString().slice(0, 10),
    careResult: "",
  };
}

function loadStoredPatients() {
  if (typeof window === "undefined") return defaultPatients;
  try {
    const stored = window.localStorage.getItem("twin-medic-patients");
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultPatients;
  } catch {
    return defaultPatients;
  }
}

function normalizePatientCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sanitizeSimulationRanges(value) {
  return Object.fromEntries(
    Object.entries(defaultSimulationRanges).map(([key, defaults]) => {
      const incoming = value?.[key] || {};
      const min = readNumber(incoming.min);
      const max = readNumber(incoming.max);
      const nextMin = min !== null ? min : defaults.min;
      const nextMax = max !== null ? max : defaults.max;
      return [
        key,
        {
          ...defaults,
          min: Math.min(nextMin, nextMax),
          max: Math.max(nextMin, nextMax),
        },
      ];
    }),
  );
}

function loadSimulationRanges() {
  if (typeof window === "undefined") return defaultSimulationRanges;
  try {
    const stored = window.localStorage.getItem("twin-medic-simulation-ranges");
    return sanitizeSimulationRanges(stored ? JSON.parse(stored) : defaultSimulationRanges);
  } catch {
    return defaultSimulationRanges;
  }
}

function pseudoRandom(seed) {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function valueInRange(range, tick, seed, decimals = 0) {
  const min = readNumber(range?.min) ?? 0;
  const max = readNumber(range?.max) ?? min;
  const ratio = Math.abs(pseudoRandom(tick * 0.91 + seed * 2.47));
  const value = min + ratio * (max - min);
  return decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
}

function makeZeroPiezoPayload() {
  return Object.fromEntries(piezoSensorZones.map((zone) => [zone.id, 0]));
}

function hasFreshSensorValues(telemetry) {
  const raw = telemetry?.raw || {};
  const piezoSource = telemetry?.piezo || raw.piezo || raw;
  const hasVitals = [
    telemetry?.bpm,
    telemetry?.ecg,
    telemetry?.temp,
    telemetry?.temperature,
    telemetry?.spo2,
    telemetry?.max30102?.ir,
    telemetry?.motion?.gyroMagnitude,
    telemetry?.respiration,
    telemetry?.respiratoryRate,
    raw.bpm,
    raw.ecg,
    raw.temp,
    raw.temperature,
    raw.spo2,
    raw.max30102?.ir,
    raw.motion?.gyroMagnitude,
    raw.respiration,
    raw.respiratoryRate,
  ].some((value) => value !== null && value !== undefined);

  return hasVitals || piezoSensorZones.some((zone) => readPiezoValue(piezoSource, zone) !== null);
}

function readPiezoValue(source, zone) {
  if (!source) return null;
  const direct = readNumber(source[zone.id]);
  if (direct !== null) return direct;
  for (const alias of zone.aliases) {
    const value = readNumber(source[alias]);
    if (value !== null) return value;
  }
  return null;
}

function makePiezoSensors(tick, incomingPiezo = null, simulationRanges = defaultSimulationRanges) {
  return piezoSensorZones.map((zone, index) => {
    const rawValue = readPiezoValue(incomingPiezo, zone);
    const idleValue = valueInRange(simulationRanges?.piezo || defaultSimulationRanges.piezo, tick, index + 18);
    const intensity = clamp(Math.round(rawValue ?? idleValue), 0, 100);
    const hitFlag = Boolean(incomingPiezo?.[`${zone.id}Hit`] || incomingPiezo?.[`${zone.id}Impact`]);
    const hit = hitFlag || intensity >= PIEZO_IMPACT_THRESHOLD;

    return {
      ...zone,
      intensity,
      hit,
      status: hit ? "Impact" : intensity > 45 ? "Choc leger" : "OK",
    };
  });
}

function useDashboardFit() {
  const [fit, setFit] = useState(() => {
    if (typeof window === "undefined") return { x: 1, y: 1 };
    return {
      x: window.innerWidth / 1280,
      y: window.innerHeight / 720,
    };
  });

  useEffect(() => {
    const updateFit = () => {
      setFit({
        x: window.innerWidth / 1280,
        y: window.innerHeight / 720,
      });
    };

    updateFit();
    window.addEventListener("resize", updateFit);
    return () => window.removeEventListener("resize", updateFit);
  }, []);

  return fit;
}

function makeSeriesPath(series, width = 126, height = 54, fixedMin = null, fixedMax = null) {
  const values = (series || []).map(readNumber).filter((value) => value !== null);
  const centerY = height / 2;

  if (!values.length) {
    return `M0,${centerY.toFixed(1)} L${width},${centerY.toFixed(1)}`;
  }

  const rawMin = fixedMin ?? Math.min(...values);
  const rawMax = fixedMax ?? Math.max(...values);
  let min = rawMin;
  let max = rawMax;

  if (max - min < 1) {
    const pad = Math.max(1, Math.abs(max || 0) * 0.02);
    min -= pad;
    max += pad;
  }

  const top = Math.max(4, height * 0.18);
  const bottom = height - top;
  const drawable = bottom - top;
  const plotValues = values.length === 1 ? [values[0], values[0]] : values;
  const points = plotValues.map((value, index) => {
    const x = plotValues.length === 1 ? width : (index / (plotValues.length - 1)) * width;
    const ratio = (value - min) / (max - min || 1);
    const y = bottom - clamp(ratio, 0, 1) * drawable;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M${points.join(" L")}`;
}

function makeCompactSignalPath(history, telemetry, sensorId, width = 126, height = 54) {
  return makeSeriesPath(getSensorChartSeries(history, telemetry, sensorId), width, height);
}

function makeSensorWave(history, telemetry, sensorId) {
  return makeCompactSignalPath(history, telemetry, sensorId, 110, 34);
}

function formatSignalNumber(value) {
  const number = readNumber(value);
  if (number === null) return "--";
  if (Math.abs(number) >= 1000 || Number.isInteger(number)) return Math.round(number).toLocaleString("fr-FR");
  if (Math.abs(number) < 10) return number.toFixed(2);
  return number.toFixed(1);
}

function findPiezoSensor(telemetry, piezoId) {
  return (telemetry?.piezoSensors || []).find((sensor) => sensor.id === piezoId) || null;
}

function readSensorChartValue(telemetry, sensorId) {
  if (!telemetry || !sensorId) return null;

  if (sensorId === "heart") {
    return readNumber(telemetry.ecg) ?? readNumber(telemetry.heart);
  }

  if (sensorId === "spo2") {
    const ir = readNumber(telemetry.max30102?.ir);
    return ir !== null && ir > 0 ? ir : readNumber(telemetry.spo2);
  }

  if (sensorId === "motion") {
    return readNumber(telemetry.motion?.gyroMagnitude) ?? readNumber(telemetry.motion?.accelMagnitude);
  }

  if (sensorId === "gps") {
    return readNumber(telemetry.speed) ?? readNumber(telemetry.lat);
  }

  if (sensorId === "temp") {
    return readNumber(telemetry.temp);
  }

  if (sensorId.startsWith("piezo-")) {
    const piezoId = sensorId.replace("piezo-", "");
    const delta = readNumber(telemetry.piezoDelta?.[piezoId]);
    const rawPiezo = readNumber(telemetry.piezo?.[piezoId]);
    const sensor = findPiezoSensor(telemetry, piezoId);
    return delta ?? rawPiezo ?? readNumber(sensor?.intensity);
  }

  return null;
}

function getSensorChartUnit(sensorId, telemetry) {
  if (sensorId === "heart") return "ADC ECG";
  if (sensorId === "spo2") return readNumber(telemetry?.max30102?.ir) > 0 ? "IR" : "%";
  if (sensorId === "motion") return "dps";
  if (sensorId === "gps") return "m/s";
  if (sensorId === "temp") return "C";
  if (sensorId?.startsWith("piezo-")) return "delta ADC";
  return "";
}

function getSensorChartSeries(history, telemetry, sensorId) {
  if (sensorId === "heart" && Array.isArray(telemetry?.ecgWave) && telemetry.ecgWave.length > 1) {
    return telemetry.ecgWave.map(readNumber).filter((value) => value !== null).slice(-SENSOR_CHART_SAMPLE_LIMIT);
  }

  const values = (history || [])
    .map((sample) => readSensorChartValue(sample, sensorId))
    .filter((value) => value !== null);
  const current = readSensorChartValue(telemetry, sensorId);
  const series = current === null ? values : [...values, current];
  return series.slice(-SENSOR_CHART_SAMPLE_LIMIT);
}

function makeSensorSignal(series, width = 420, height = 148) {
  const values = (series || []).map(readNumber).filter((value) => value !== null);
  const centerY = height / 2;

  if (!values.length) {
    return {
      path: `M0,${centerY.toFixed(1)} L${width},${centerY.toFixed(1)}`,
      current: "--",
      min: "--",
      max: "--",
      samples: 0,
      stable: true,
    };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  let min = rawMin;
  let max = rawMax;

  if (max - min < 1) {
    const pad = Math.max(1, Math.abs(max || 0) * 0.02);
    min -= pad;
    max += pad;
  }

  const top = 14;
  const bottom = height - 14;
  const drawable = bottom - top;
  const plotValues = values.length === 1 ? [values[0], values[0]] : values;
  const points = plotValues.map((value, index) => {
    const x = plotValues.length === 1 ? width : (index / (plotValues.length - 1)) * width;
    const ratio = (value - min) / (max - min || 1);
    const y = bottom - clamp(ratio, 0, 1) * drawable;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return {
    path: `M${points.join(" L")}`,
    current: formatSignalNumber(values[values.length - 1]),
    min: formatSignalNumber(rawMin),
    max: formatSignalNumber(rawMax),
    samples: values.length,
    stable: rawMin === rawMax,
  };
}

function comparisonY(value, min = 40, max = 120) {
  const ratio = (normalizeRisklessNumber(value, min) - min) / (max - min || 1);
  return 110 - clamp(ratio, 0, 1) * 92;
}

function normalizeRisklessNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function makeComparisonPolyline(values, startX = 35, endX = 336, min = 40, max = 120) {
  const safeValues = (values || []).map(readNumber).filter((value) => value !== null);
  if (!safeValues.length) return "";

  const plotValues = safeValues.length === 1 ? [safeValues[0], safeValues[0]] : safeValues;
  return plotValues.map((value, index) => {
    const x = startX + (index / (plotValues.length - 1)) * (endX - startX);
    return `${x.toFixed(1)},${comparisonY(value, min, max).toFixed(1)}`;
  }).join(" ");
}

function collectComparisonValues(history = [], telemetry = null) {
  const realValues = [];
  const twinValues = [];

  (history || []).slice(-24).forEach((sample) => {
    const real = readNumber(sample?.heart);
    const twin = readNumber(sample?.predictedVitals?.heart ?? sample?.correctedVitals?.heart ?? sample?.simulatedHeart);
    if (real !== null && real > 0) realValues.push(real);
    if (twin !== null && twin > 0) twinValues.push(twin);
  });

  const currentReal = readNumber(telemetry?.heart);
  const currentTwin = readNumber(telemetry?.predictedVitals?.heart ?? telemetry?.aiDecision?.prediction?.correctedVitals?.heart);
  if (currentReal !== null && currentReal > 0) realValues.push(currentReal);
  if (currentTwin !== null && currentTwin > 0) twinValues.push(currentTwin);

  return {
    real: realValues.slice(-16),
    twin: (twinValues.length ? twinValues : realValues).slice(-16),
  };
}

function makeComparisonPoints(history = [], telemetry = null) {
  const values = collectComparisonValues(history, telemetry);
  const combined = [...values.real, ...values.twin];
  const min = combined.length ? Math.min(40, Math.floor(Math.min(...combined) / 10) * 10) : 40;
  const max = combined.length ? Math.max(120, Math.ceil(Math.max(...combined) / 10) * 10) : 120;

  return {
    real: makeComparisonPolyline(values.real, 35, 336, min, max),
    twin: makeComparisonPolyline(values.twin, 35, 336, min, max),
    min,
    mid: Math.round((min + max) / 2),
    max,
  };
}

function computeTwinDrift(telemetry) {
  const observed = telemetry?.aiDecision?.prediction?.observedVitals || {};
  const corrected = telemetry?.aiDecision?.prediction?.correctedVitals || {};
  const pairs = [
    ["heart", 180],
    ["spo2", 100],
    ["respiration", 45],
    ["temperature", 42],
  ]
    .map(([key, scale]) => {
      const observedValue = readNumber(observed[key]);
      const correctedValue = readNumber(corrected[key]);
      if (observedValue === null || correctedValue === null || observedValue <= 0) return null;
      return Math.abs(correctedValue - observedValue) / scale;
    })
    .filter((value) => value !== null);

  if (!pairs.length) return "0.0";
  const drift = pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
  return (drift * 100).toFixed(1);
}

function formatHistorySampleTime(sample, fallback = new Date()) {
  const sampleTime = readNumber(sample?.time);
  if (sampleTime !== null && sampleTime > 0) return formatTime(new Date(sampleTime));
  return formatTelemetryTime(sample?.sourceTimestamp || sample?.clientReceivedAt || fallback);
}

function makeTelemetryEvents(telemetry, history = []) {
  const currentTone = telemetry.risk >= 70 ? "alert" : telemetry.risk >= 45 ? "watch" : "stable";
  const events = [
    [
      telemetry.time,
      `Score IA ${telemetry.risk}/100 - ${telemetry.aiDecision?.diagnosis || telemetry.status}`,
      currentTone,
    ],
  ];

  if (telemetry.impactDetected && telemetry.impactZones?.length) {
    events.push([
      telemetry.time,
      `Impact capteur: ${telemetry.impactZones.join(", ")}`,
      "alert",
    ]);
  }

  (history || []).slice(-4).reverse().forEach((sample) => {
    const heart = readNumber(sample.heart);
    const spo2 = readNumber(sample.spo2);
    const risk = readNumber(sample.risk);
    const packets = readNumber(sample.packets);
    const tone = risk >= 70 ? "alert" : risk >= 45 ? "watch" : "stable";
    const parts = [
      packets !== null ? `pkt ${Math.round(packets)}` : null,
      heart !== null ? `FC ${Math.round(heart)} bpm` : null,
      spo2 !== null ? `SpO2 ${Math.round(spo2)}%` : null,
      risk !== null ? `risque ${Math.round(risk)}/100` : null,
    ].filter(Boolean);

    if (parts.length) {
      events.push([formatHistorySampleTime(sample, telemetry.time), parts.join(" - "), tone]);
    }
  });

  return events.slice(0, 5);
}

function riskY(value) {
  return clamp(78 - clamp(Number(value) || 0, 0, 100) * 0.58, 16, 78);
}

function normalizeRisk(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, 0, 100) : fallback;
}

function makeFallbackRiskSeries(currentRisk) {
  const current = normalizeRisk(currentRisk);
  const pressure = current >= 75 ? 22 : current >= 45 ? 14 : 8;
  return [0.95, 0.72, 0.5, 0.32, 0.16, 0].map((ratio) => (
    normalizeRisk(Math.round(current - pressure * ratio))
  ));
}

function makePolyline(values, startX, endX) {
  const safeValues = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  return safeValues.map((value, index) => {
    const x = startX + (index / (safeValues.length - 1)) * (endX - startX);
    return `${x.toFixed(1)},${riskY(value).toFixed(1)}`;
  }).join(" ");
}

function downsampleRiskValues(values, targetCount = 8) {
  if (values.length <= targetCount) return values;
  return Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex = Math.round((index / (targetCount - 1)) * (values.length - 1));
    return values[sourceIndex];
  });
}

function collectObservedRiskValues(riskHistory = [], currentRisk = 0) {
  const current = normalizeRisk(currentRisk);
  const values = riskHistory
    .map((entry) => {
      const risk = normalizeRisk(entry?.risk ?? entry?.aiScore ?? entry?.forecastRisk?.now, NaN);
      const startupPlaceholder =
        risk <= 5 &&
        Number(entry?.packets || 0) === 0 &&
        Number(entry?.heart || 0) === 0 &&
        Number(entry?.spo2 || 0) === 0;
      return startupPlaceholder ? NaN : risk;
    })
    .filter(Number.isFinite);

  if (!values.length) {
    return makeFallbackRiskSeries(current);
  }

  const last = values[values.length - 1];
  const withCurrent = Math.abs(last - current) > 0.5 ? [...values, current] : values;
  const recentWindow = withCurrent.slice(-30);

  if (recentWindow.length >= 6) {
    return downsampleRiskValues(recentWindow, 8);
  }

  const first = recentWindow[0];
  const padding = makeFallbackRiskSeries(first).slice(0, 6 - recentWindow.length);
  return [...padding, ...recentWindow];
}

function buildPredictedRiskValues(aiDecision = null, currentRisk = 0) {
  const current = normalizeRisk(currentRisk);
  const forecast = aiDecision?.prediction?.forecast;

  if (!forecast) {
    const drift = current >= 70 ? 3 : current >= 45 ? 5 : 7;
    return [current, current + drift, current + drift * 1.45, current + drift * 1.8]
      .map((value) => normalizeRisk(Math.round(value)));
  }

  const rawTargets = [
    forecast.riskAt5Min,
    forecast.riskAt10Min,
    forecast.riskAt15Min,
  ].map((value) => normalizeRisk(value, current));

  let previous = current;
  const shapedTargets = rawTargets.map((target) => {
    const shaped = clamp(target, previous - 12, previous + 18);
    previous = shaped;
    return Math.round(shaped);
  });

  return [current, ...shapedTargets];
}

function makeRiskPoints(tick, appliedCount, aiDecision = null, currentRisk = 0, riskHistory = []) {
  const observedValues = collectObservedRiskValues(riskHistory, currentRisk);
  const predictedValues = buildPredictedRiskValues(aiDecision, currentRisk);

  return {
    observed: makePolyline(observedValues, 27, 170),
    predicted: makePolyline(predictedValues, 170, 305),
  };
}

function makeTelemetry(tick, appliedActions, mapZoom, alertAcknowledged, simulationRanges = defaultSimulationRanges) {
  const appliedCount = appliedActions.length;
  const ranges = sanitizeSimulationRanges(simulationRanges);
  const heart = clamp(valueInRange(ranges.heart, tick, 1) - appliedCount, ranges.heart.min, ranges.heart.max);
  const temp = clamp(valueInRange(ranges.temp, tick, 2, 1) - appliedCount * 0.04, ranges.temp.min, ranges.temp.max);
  const respiration = clamp(valueInRange(ranges.respiration, tick, 3), ranges.respiration.min, ranges.respiration.max);
  const spo2 = clamp(valueInRange(ranges.spo2, tick, 4), ranges.spo2.min, ranges.spo2.max);
  const lat = 36.8065 + Math.sin(tick * 0.08) * 0.0007;
  const lon = 10.1815 + Math.cos(tick * 0.075) * 0.0007;
  const piezoSensors = makePiezoSensors(tick, null, ranges);
  const impactDetected = piezoSensors.some((sensor) => sensor.hit);
  const impactZones = piezoSensors.filter((sensor) => sensor.hit).map((sensor) => sensor.label);
  const baseRisk = clamp(Math.round(28 + Math.sin(tick * 0.22) * 6 - appliedCount * 4 - (alertAcknowledged ? 2 : 0)), 8, 43);
  const risk = impactDetected ? Math.max(baseRisk, 82) : baseRisk;
  const status = impactDetected ? "Impact detecte" : risk > 36 ? "À surveiller" : "Stable";
  const riskLabel = impactDetected ? "Eleve" : risk > 36 ? "Modéré" : "Faible";

  return {
    heart,
    hrv: Math.round(42 + Math.sin(tick * 0.4) * 4),
    temp,
    lat,
    lon,
    altitude: Math.round(23 + Math.sin(tick * 0.18) * 2),
    pressure: `${120 + Math.round(Math.sin(tick * 0.25) * 3)} / ${78 + Math.round(Math.cos(tick * 0.21) * 2)}`,
    respiration: Math.round(respiration),
    spo2: Math.round(spo2),
    signal: Math.round(54 + Math.sin(tick * 0.27) * 4),
    battery: clamp(Math.round(87 - (tick % 24) * 0.12), 78, 87),
    packets: 12485 + tick * 7,
    loss: (0.2 + Math.abs(Math.sin(tick * 0.33)) * 0.08).toFixed(1),
    drift: (8.6 + Math.sin(tick * 0.2) * 1.2 - appliedCount * 0.5).toFixed(1),
    risk,
    riskLabel,
    status,
    confidence: clamp(Math.round(82 + appliedCount * 3 + Math.sin(tick * 0.16) * 2), 80, 94),
    aiConfidence: clamp(Math.round(86 + appliedCount * 2 + Math.cos(tick * 0.15) * 2), 83, 95),
    piezoSensors,
    impactDetected,
    impactZones,
    piezoThreshold: PIEZO_IMPACT_THRESHOLD,
    speed: (0.8 + Math.abs(Math.sin(tick * 0.19)) * 0.5).toFixed(1),
    precision: clamp(3.2 - (mapZoom - 1) * 0.35 + Math.sin(tick * 0.11) * 0.08, 1.8, 3.4).toFixed(1),
    time: formatTime(),
    gpsSource: "simulation",
    gpsValid: false,
    gpsSatellites: 0,
    gpsHdop: null,
    hardwareStatus: "waiting",
    dataSource: "simulation",
    sensorDataReady: true,
    pinout: hardwarePinout,
    spo2Source: "simulation",
    pcGpsStatus: "idle",
    deviceId: "ESP32 Twin-Medic",
  };
}

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readTemperatureNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function isValidBodySensorTemperature(value) {
  return (
    value !== null &&
    value >= VALID_BODY_SENSOR_TEMPERATURE_RANGE.min &&
    value <= VALID_BODY_SENSOR_TEMPERATURE_RANGE.max
  );
}

function readHardwareTemperature(telemetry) {
  const raw = telemetry?.raw || {};
  const max30102 = telemetry?.max30102 || raw.max30102 || {};
  const candidates = [
    telemetry?.temp,
    telemetry?.temperature,
    telemetry?.dht10,
    telemetry?.dht10Temp,
    telemetry?.dht10Temperature,
    telemetry?.dhtTemperature,
    telemetry?.bodyTemperature,
    raw.temp,
    raw.temperature,
    raw.dht10,
    raw.dht10Temp,
    raw.dht10Temperature,
    raw.dhtTemperature,
    raw.bodyTemperature,
    max30102.temperature,
  ];

  for (const candidate of candidates) {
    const value = readTemperatureNumber(candidate);
    if (isValidBodySensorTemperature(value)) return value;
  }

  return null;
}

function makeNormalBodyTemperatureFallback(tick) {
  return valueInRange(NORMAL_BODY_TEMPERATURE_RANGE, tick, 31, 1);
}

function formatTelemetryTime(value) {
  if (!value) return formatTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? formatTime() : formatTime(date);
}

function mergeHardwareTelemetry(simulated, hardwareTelemetry, hardwareStatus, pcLocation, pcGpsStatus, simulationMode) {
  if (simulationMode) {
    return {
      ...simulated,
      hardwareStatus: "simulation",
      clientReceivedAt: Date.now(),
      sourceTimestamp: new Date().toISOString(),
      transport: "simulation",
      gpsSource: "simulation",
      gpsValid: true,
      gpsSatellites: 8,
      tempSource: "simulation",
      temperatureFallback: false,
    };
  }

  const gps = hardwareTelemetry?.gps || {};
  const latitude = readNumber(gps.latitude);
  const longitude = readNumber(gps.longitude);
  const pcLatitude = readNumber(pcLocation?.latitude);
  const pcLongitude = readNumber(pcLocation?.longitude);
  const hardwareReceivedAt = readNumber(hardwareTelemetry?.clientReceivedAt);
  const hardwareConnected = hardwareStatus === "real" || hardwareStatus === "live";
  const hardwareFresh = hardwareConnected && hasFreshSensorValues(hardwareTelemetry);
  const hasRealGps =
    hardwareConnected &&
    Boolean(gps.valid) &&
    latitude !== null &&
    longitude !== null &&
    latitude !== 0 &&
    longitude !== 0;
  const hasPcGps =
    pcGpsStatus === "live" &&
    pcLatitude !== null &&
    pcLongitude !== null &&
    (pcLatitude !== 0 || pcLongitude !== 0);
  const bpm = hardwareFresh ? readNumber(hardwareTelemetry?.bpm) : null;
  const battery = hardwareFresh ? readNumber(hardwareTelemetry?.battery) : null;
  const altitude = readNumber(gps.altitude);
  const speedKmph = readNumber(gps.speedKmph);
  const hdop = readNumber(gps.hdop);
  const satellites = readNumber(gps.satellites);
  const hardwareTemp = hardwareFresh ? readHardwareTemperature(hardwareTelemetry) : null;
  const temperatureFallback = hardwareTemp === null;
  const displayedTemp = temperatureFallback ? makeNormalBodyTemperatureFallback(simulated.packets) : hardwareTemp;
  const max30102 = hardwareFresh ? hardwareTelemetry?.max30102 || hardwareTelemetry?.raw?.max30102 || {} : {};
  const motion = hardwareFresh ? hardwareTelemetry?.motion || hardwareTelemetry?.raw?.motion || hardwareTelemetry?.raw?.mpu || {} : {};
  const hardwareSpo2 = hardwareFresh ? readNumber(hardwareTelemetry?.spo2 ?? max30102?.spo2 ?? hardwareTelemetry?.raw?.spo2 ?? hardwareTelemetry?.raw?.spO2) : null;
  const hardwareRespiration = hardwareFresh ? readNumber(hardwareTelemetry?.respiration ?? hardwareTelemetry?.respiratoryRate ?? hardwareTelemetry?.raw?.respiration ?? hardwareTelemetry?.raw?.respiratoryRate) : null;
  const pcAltitude = readNumber(pcLocation?.altitude);
  const pcSpeed = readNumber(pcLocation?.speed);
  const pcAccuracy = readNumber(pcLocation?.accuracy);
  const hardwareTime = hardwareFresh ? formatTelemetryTime(hardwareTelemetry.timestamp) : simulated.time;
  const pcTime = pcLocation ? formatTelemetryTime(pcLocation.timestamp) : simulated.time;
  const time = hasRealGps ? hardwareTime : hasPcGps ? pcTime : hardwareFresh ? hardwareTime : formatTime();
  const incomingPiezo = hardwareFresh
    ? hardwareTelemetry?.piezo || hardwareTelemetry?.raw?.piezo || hardwareTelemetry?.raw
    : null;
  const incomingPiezoRaw = hardwareFresh ? hardwareTelemetry?.piezoRaw || hardwareTelemetry?.raw?.piezoRaw || {} : {};
  const incomingPiezoDelta = hardwareFresh ? hardwareTelemetry?.piezoDelta || hardwareTelemetry?.raw?.piezoDelta || {} : {};
  const incomingPiezoCalibration = hardwareFresh ? hardwareTelemetry?.piezoCalibration || hardwareTelemetry?.raw?.piezoCalibration || {} : {};
  const incomingEcgWave = hardwareFresh && Array.isArray(hardwareTelemetry?.ecgWave || hardwareTelemetry?.raw?.ecgWave)
    ? (hardwareTelemetry.ecgWave || hardwareTelemetry.raw.ecgWave).map(readNumber).filter((value) => value !== null)
    : [];
  const piezoSensors = incomingPiezo
    ? makePiezoSensors(simulated.packets, incomingPiezo)
    : makePiezoSensors(0, makeZeroPiezoPayload());
  const impactDetected = piezoSensors.some((sensor) => sensor.hit);
  const impactZones = piezoSensors.filter((sensor) => sensor.hit).map((sensor) => sensor.label);
  const hardwarePackets = hardwareFresh ? readNumber(hardwareTelemetry?.packets ?? hardwareTelemetry?.packetCount) : null;
  const hardwareLoss = hardwareFresh ? readNumber(hardwareTelemetry?.loss ?? hardwareTelemetry?.packetLoss) : null;
  const sensorDataReady = hardwareFresh;

  return {
    ...simulated,
    heart: hardwareFresh && bpm !== null && bpm > 0 ? Math.round(bpm) : 0,
    hrv: hardwareFresh && readNumber(hardwareTelemetry?.hrv) !== null ? Math.round(readNumber(hardwareTelemetry?.hrv)) : 0,
    temp: displayedTemp,
    tempSource: temperatureFallback ? "normal-fallback" : "dht10",
    temperatureFallback,
    spo2: hardwareFresh && hardwareSpo2 !== null && hardwareSpo2 > 0 ? Math.round(hardwareSpo2) : 0,
    spo2Source: hardwareFresh && hardwareSpo2 !== null && hardwareSpo2 > 0 ? "max30102" : "waiting",
    respiration: hardwareFresh && hardwareRespiration !== null && hardwareRespiration > 0 ? Math.round(hardwareRespiration) : 0,
    pressure: hardwareFresh ? hardwareTelemetry?.pressure || hardwareTelemetry?.bloodPressure || "-- / --" : "-- / --",
    battery: battery !== null ? clamp(Math.round(battery), 0, 100) : 0,
    signal: hardwareFresh && readNumber(hardwareTelemetry?.signal) !== null ? Math.round(readNumber(hardwareTelemetry?.signal)) : 0,
    packets: hardwarePackets !== null ? Math.round(hardwarePackets) : hardwareFresh ? simulated.packets : 0,
    loss: hardwareLoss !== null ? hardwareLoss.toFixed(1) : hardwareFresh ? "0.0" : "0.0",
    drift: hardwareFresh ? simulated.drift : "0.0",
    lat: hasRealGps ? latitude : hasPcGps ? pcLatitude : 0,
    lon: hasRealGps ? longitude : hasPcGps ? pcLongitude : 0,
    altitude: hasRealGps && altitude !== null ? Math.round(altitude) : hasPcGps && pcAltitude !== null ? Math.round(pcAltitude) : 0,
    speed: hasRealGps && speedKmph !== null ? (speedKmph / 3.6).toFixed(1) : hasPcGps && pcSpeed !== null ? pcSpeed.toFixed(1) : "0.0",
    precision: hasRealGps && hdop !== null && hdop > 0 ? clamp(hdop * 1.2, 1.2, 25).toFixed(1) : hasPcGps && pcAccuracy !== null ? clamp(pcAccuracy, 1, 2000).toFixed(1) : "0.0",
    time,
    gpsSource: hasRealGps ? "real" : hasPcGps ? "pc" : "waiting",
    gpsValid: hasRealGps || hasPcGps,
    gpsSatellites: hasRealGps && satellites !== null ? Math.round(satellites) : 0,
    gpsHdop: hasRealGps && hdop !== null ? hdop : null,
    hardwareStatus: hardwareConnected ? hardwareStatus : "waiting",
    dataSource: hardwareFresh ? "esp32" : "waiting",
    sensorDataReady,
    clientReceivedAt: hardwareReceivedAt || 0,
    serverReceivedAt: hardwareTelemetry?.serverReceivedAt || null,
    sourceTimestamp: hardwareTelemetry?.sourceTimestamp || hardwareTelemetry?.timestamp || hardwareTelemetry?.raw?.timestamp || null,
    transport: hardwareTelemetry?.transport || (hardwareStatus === "live" ? "web-serial" : "api-bridge"),
    backendAiDecision: hardwareTelemetry?.pythonAiDecision || hardwareTelemetry?.backendAiDecision || null,
    pcGpsStatus,
    deviceId: hardwareFresh ? hardwareTelemetry?.deviceId || simulated.deviceId : simulated.deviceId,
    board: hardwareTelemetry?.board || hardwareTelemetry?.raw?.board || hardwarePinout.board,
    ecg: hardwareFresh ? readNumber(hardwareTelemetry?.ecg ?? hardwareTelemetry?.raw?.ecg) ?? 0 : 0,
    ecgWave: incomingEcgWave,
    leadOff: hardwareFresh ? Boolean(hardwareTelemetry?.leadOff ?? hardwareTelemetry?.raw?.leadOff) : false,
    max30102: {
      ...max30102,
      temperature: displayedTemp,
    },
    motion,
    piezoRaw: incomingPiezoRaw,
    piezoDelta: incomingPiezoDelta,
    piezoCalibration: incomingPiezoCalibration,
    piezoSensors,
    impactDetected,
    impactZones,
    risk: impactDetected ? 82 : 0,
    riskLabel: impactDetected ? "Eleve" : "Faible",
    status: sensorDataReady ? (impactDetected ? "Impact detecte" : "Stable") : "En attente capteurs",
    confidence: sensorDataReady ? 72 : 0,
    aiConfidence: sensorDataReady ? 72 : 0,
  };
}

function osmZoomFromControl(mapZoom) {
  return clamp(14 + Math.round((mapZoom - 1) * 5), 14, 18);
}

function makeOsmTiles(latitude, longitude, zoom, width = 329, height = 139) {
  const tileSize = 256;
  const maxLat = 85.05112878;
  const lat = clamp(latitude, -maxLat, maxLat);
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const scale = 2 ** zoom;
  const centerX = ((lon + 180) / 360) * scale * tileSize;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const centerY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale * tileSize;
  const startX = Math.floor((centerX - width / 2) / tileSize);
  const endX = Math.floor((centerX + width / 2) / tileSize);
  const startY = Math.floor((centerY - height / 2) / tileSize);
  const endY = Math.floor((centerY + height / 2) / tileSize);
  const tiles = [];

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= scale) continue;
      const wrappedX = ((x % scale) + scale) % scale;
      const server = ["a", "b", "c"][Math.abs(x + y) % 3];
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        left: Math.round(x * tileSize - (centerX - width / 2)),
        top: Math.round(y * tileSize - (centerY - height / 2)),
        url: `https://${server}.tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
      });
    }
  }

  return tiles;
}

function MiniTrend({ path, tone = "green" }) {
  return (
    <svg className={`mini-trend ${tone}`} viewBox="0 0 126 54" aria-hidden="true">
      <path d={`${path} L126 54 L0 54 Z`} className="trend-fill" />
      <path d={path} className="trend-line" />
    </svg>
  );
}

function CardTrend({ card, telemetry }) {
  if (card.className === "state") {
    return (
      <div className="risk-line">
        <span>Niveau de risque</span>
        <b><i /> {telemetry.riskLabel}</b>
      </div>
    );
  }

  return (
    <>
      <div className="metric-divider" />
      <div className="metric-meta">
        <span>{card.metaLabel}</span>
        <b>{card.metaValue}</b>
      </div>
      <MiniTrend path={card.path} tone={card.className === "gps" ? "blue" : "green"} />
    </>
  );
}

function VitalCard({ card, telemetry, selectedMetric, onSelect }) {
  const Icon = card.icon;

  return (
    <button
      className={`vital-card ${card.className} ${selectedMetric === card.className ? "selected" : ""}`}
      onClick={() => onSelect(card)}
      type="button"
    >
      <div className="card-label">
        <Icon size={21} />
        <span>{card.label}</span>
      </div>
      <div className="vital-value">
        <strong>{card.value}</strong>
        {card.unit && <em>{card.unit}</em>}
      </div>
      {card.second && (
        <div className="vital-second">
          <strong>{card.second}</strong>
          <em>{card.secondUnit}</em>
        </div>
      )}
      <CardTrend card={card} telemetry={telemetry} />
    </button>
  );
}

function SensorRow({ item, selectedSensor, onSelect }) {
  const Icon = item.icon;

  return (
    <button className={`sensor-row ${item.state || ""} ${selectedSensor === item.id ? "selected" : ""}`} onClick={() => onSelect(item)} type="button">
      <Icon size={17} className={`sensor-icon ${item.color}`} />
      <span>{item.name}</span>
      <b>{item.value}</b>
      <svg viewBox="0 0 110 34" className={`sensor-wave ${item.color}`} aria-hidden="true">
        <path d={item.wave} />
      </svg>
      <em><i /> {item.state === "impact" ? "Impact" : "En ligne"}</em>
    </button>
  );
}

function ComparisonChart({ telemetry, sensorHistory }) {
  const points = makeComparisonPoints(sensorHistory, telemetry);

  return (
    <svg className="comparison-chart" viewBox="0 0 342 132" aria-label="Comparaison réel vs jumeau IA corrigé">
      <g className="grid">
        {[0, 1, 2, 3, 4].map((row) => <line key={`h-${row}`} x1="35" y1={18 + row * 23} x2="336" y2={18 + row * 23} />)}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => <line key={`v-${col}`} x1={42 + col * 42} y1="12" x2={42 + col * 42} y2="114" />)}
      </g>
      <g className="axis">
        <text x="4" y="21">{points.max}</text>
        <text x="8" y="69">{points.mid}</text>
        <text x="12" y="117">{points.min}</text>
        <text x="42" y="130">-24s</text>
        <text x="141" y="130">-12s</text>
        <text x="286" y="130">actuel</text>
      </g>
      <polyline className="real-line" points={points.real} />
      <polyline className="sim-line" points={points.twin} />
    </svg>
  );
}

function RiskChart({ tick, appliedCount, telemetry, riskHistory }) {
  const points = makeRiskPoints(tick, appliedCount, telemetry?.aiDecision, telemetry?.risk, riskHistory);

  return (
    <svg className="risk-chart" viewBox="0 0 315 104" aria-hidden="true">
      <g className="grid">
        {[0, 1, 2].map((row) => <line key={`risk-h-${row}`} x1="27" y1={16 + row * 28} x2="310" y2={16 + row * 28} />)}
        {[0, 1, 2, 3, 4].map((col) => <line key={`risk-v-${col}`} x1={42 + col * 62} y1="8" x2={42 + col * 62} y2="87" />)}
      </g>
      <g className="axis">
        <text x="0" y="18">100</text>
        <text x="7" y="48">50</text>
        <text x="12" y="78">0</text>
        <text x="35" y="101">10:20</text>
        <text x="104" y="101">10:35</text>
        <text x="178" y="101">10:50</text>
        <text x="252" y="101">11:20</text>
      </g>
      <polyline className="risk-observed" points={points.observed} />
      <polyline className="risk-predicted" points={points.predicted} />
    </svg>
  );
}

function formatLatencySeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0.0s";
  return `${number.toFixed(1)}s`;
}

function AiLatencyStrip({ aiDecision }) {
  const latency = aiDecision?.latency || {};
  const forecast = aiDecision?.prediction?.forecast || {};

  return (
    <div className="ai-latency-strip">
      <span>{latency.modeLabel || "Mode IA"}</span>
      <b>{formatLatencySeconds(latency.ageSeconds)}</b>
      <span>Qualite {latency.quality ?? 0}%</span>
      <span>R+15 {forecast.riskAt15Min ?? aiDecision?.score ?? 0}</span>
    </div>
  );
}

function AiEvidenceBars({ aiDecision }) {
  const rows = aiDecision?.evidenceRows || [];
  if (!rows.length) return null;

  return (
    <div className="ai-evidence-bars">
      {rows.slice(0, 5).map((row) => (
        <div className="ai-evidence-row" key={row.id}>
          <span>{row.label}</span>
          <i><b style={{ width: `${clamp(row.value, 0, 100)}%` }} /></i>
          <strong>{row.value}%</strong>
        </div>
      ))}
    </div>
  );
}

function AiForecastGrid({ aiDecision }) {
  const latency = aiDecision?.latency || {};
  const forecast = aiDecision?.prediction?.forecast || {};
  const corrected = aiDecision?.prediction?.correctedVitals || {};
  const adapterCount = Array.isArray(aiDecision?.modelStack) ? aiDecision.modelStack.length : 0;
  const activeAdapterCount = Array.isArray(aiDecision?.activeAdapters) ? aiDecision.activeAdapters.length : 0;
  const engineLabel = aiDecision?.engine?.includes("python")
    ? "Python registry"
    : "JS fallback";

  return (
    <div className="ai-forecast-grid">
      <div><span>Mode</span><strong>{latency.modeLabel || "IA"}</strong></div>
      <div><span>Latence</span><strong>{formatLatencySeconds(latency.ageSeconds)}</strong></div>
      <div><span>Qualite</span><strong>{latency.quality ?? 0}%</strong></div>
      <div><span>Risque 15 min</span><strong>{forecast.riskAt15Min ?? aiDecision?.score ?? 0}/100</strong></div>
      <div><span>FC corrigee</span><strong>{Math.round(corrected.heart || 0)} bpm</strong></div>
      <div><span>SpO2 corrigee</span><strong>{Math.round(corrected.spo2 || 0)}%</strong></div>
      <div><span>Moteur</span><strong>{engineLabel}</strong></div>
      <div><span>Adapters</span><strong>{activeAdapterCount}/{adapterCount || "JS"}</strong></div>
    </div>
  );
}

function makeModelReadout(aiDecision) {
  const stack = Array.isArray(aiDecision?.modelStack) ? aiDecision.modelStack : [];
  const activeAdapters = new Set(Array.isArray(aiDecision?.activeAdapters) ? aiDecision.activeAdapters : []);

  if (stack.length) {
    return stack.map((modelName) => ({
      label: modelName,
      active: activeAdapters.size ? activeAdapters.has(modelName) : modelName === aiDecision?.modelName,
    }));
  }

  return [
    {
      label: aiDecision?.modelName || "Fusion capteurs JS",
      active: true,
    },
    {
      label: aiDecision?.engine || "local-js",
      active: false,
    },
  ];
}

function PatientPanel({ telemetry, patient, appliedActions, alertAcknowledged, onAcknowledge, onApplyAction, activeNav }) {
  const piezoSensors = telemetry.piezoSensors || [];
  const recommendationDisplayRows = makeRecommendationRows(telemetry.aiDecision);
  const combatantLabel = patient ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() : "Aucun combattant";
  const impactText = telemetry.impactDetected
    ? telemetry.aiDecision?.alertText || `Impact balistique detecte: ${telemetry.impactZones.join(", ")}`
    : alertAcknowledged ? "Alerte vérifiée" : "Alerte légère détectée";
  const twinMetrics = [
    { key: "heart", label: "DA9AT EL 9ALB", value: telemetry.heart, unit: "bpm", icon: HeartPulse },
    { key: "temp", label: "TEMPERATURE", value: telemetry.temp.toFixed(1), unit: "°C", icon: Thermometer },
    { key: "respiration", label: "FREQUENCE RESP.", value: telemetry.respiration, unit: "rpm", icon: Activity },
    { key: "spo2", label: "SpO2 MAX30102", value: telemetry.spo2, unit: "%", icon: Activity },
    { key: "state", label: "ETAT GENERAL", value: telemetry.status, unit: "", icon: ShieldCheck },
  ];

  return (
    <section className={`panel patient-panel ${activeNav === "twin" ? "focus-panel" : ""}`}>
      <div className="panel-header">
        <h2>JUMEAU NUMÉRIQUE DU PATIENT</h2>
        <span><i /> EN TEMPS RÉEL</span>
      </div>
      <div className="body-scan" style={twinBodyBg} aria-label="Patient body scan">
        <div className="twin-pulse-ring" />
        {twinMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className={`twin-overlay-metric ${metric.key}`} key={metric.key}>
              <Icon size={13} />
              <span>{metric.label}</span>
              <strong>{metric.value}<em>{metric.unit}</em></strong>
            </div>
          );
        })}
        <div className={`impact-alert-strip ${telemetry.impactDetected ? "danger" : ""}`}>
          {telemetry.impactDetected ? "IMPACT PIEZO" : "PIEZO ARMES"} · {piezoSensors.length}/5 capteurs
        </div>
        <div className="combatant-chip">
          <span>COMBATTANT</span>
          <strong>{combatantLabel || "Non selectionne"}</strong>
        </div>
        {piezoSensors.map((sensor) => (
          <div className={`piezo-sensor-marker ${sensor.className} ${sensor.hit ? "hit" : ""}`} key={sensor.id}>
            <i />
            <span>{sensor.shortLabel}</span>
            <strong>{sensor.hit ? "IMPACT" : `${sensor.intensity}%`}</strong>
          </div>
        ))}
      </div>
      <div className={`intervention-box ${activeNav === "recommendations" ? "focus-panel" : ""}`}>
        <h3>RECOMMANDATION D'INTERVENTION</h3>
        <button className={`mild-alert ${telemetry.impactDetected ? "impact" : alertAcknowledged ? "acknowledged" : ""}`} onClick={onAcknowledge} type="button">
          {alertAcknowledged && !telemetry.impactDetected ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {impactText}
        </button>
        <div className="rec-list">
          {recommendationDisplayRows.map((row) => {
            const Icon = row.icon;
            const applied = appliedActions.includes(row.id);

            return (
              <button
                className={`rec-row ${row.tone} ${applied ? "applied" : ""}`}
                key={row.id}
                onClick={() => onApplyAction(row)}
                type="button"
              >
                <div className="rec-icon"><Icon size={22} /></div>
                <div>
                  <strong>{applied ? row.applied : row.title}</strong>
                  <p>{row.detail}</p>
                </div>
                <b>{applied ? "✓" : row.num}</b>
              </button>
            );
          })}
        </div>
        <div className="confidence"><ShieldCheck size={18} /> Confiance : {telemetry.confidence}%</div>
      </div>
    </section>
  );
}

function SensorsPanel({ sensors, telemetry, selectedSensor, onSelectSensor, activeNav }) {
  const sensorsOk = (telemetry.hardwareStatus === "real" || telemetry.hardwareStatus === "live") && telemetry.packets > 0 && telemetry.loss < 5;
  return (
    <section className={`panel sensors-panel ${activeNav === "sensors" ? "focus-panel" : ""}`}>
      <div className="panel-header">
        <h2>FLUX ESP32 – DONNÉES CAPTEURS</h2>
        <span className="active-flow"><i /> Flux actif</span>
        <span className={`sensor-status ${sensorsOk ? "ok" : "error"}`} style={{ marginLeft: "1rem" }}>
          {sensorsOk ? "Capteurs fonctionnent correctement" : "Capteurs en erreur"}
        </span>
      </div>
      <div className="sensor-table">
        {sensors.map((item) => (
          <SensorRow item={item} key={item.id} selectedSensor={selectedSensor} onSelect={onSelectSensor} />
        ))}
      </div>
      <div className="sensor-footer">
        <span>Fréquence d'envoi : 1 Hz</span>
        <span>Paquets reçus : {telemetry.packets.toLocaleString("fr-FR")}</span>
        <span>Perte : {telemetry.loss}%</span>
      </div>
    </section>
  );
}

function ComparisonPanel({ telemetry, sensorHistory, activeNav }) {
  const drift = computeTwinDrift(telemetry);

  return (
    <section className={`panel comparison-panel ${activeNav === "history" ? "focus-panel" : ""}`}>
      <div className="panel-header comparison-title">
        <h2>COMPARAISON RÉEL VS JUMEAU IA</h2>
        <div className="legend"><span className="real" /> Réel capteurs<span className="sim" /> Jumeau IA corrigé</div>
      </div>
      <div className="drift-badge">Dérive IA<br /><strong>{drift}%</strong></div>
      <ComparisonChart telemetry={telemetry} sensorHistory={sensorHistory} />
    </section>
  );
}

function PredictionPanel({ telemetry, tick, horizon, appliedCount, onCycleHorizon, activeNav, riskHistory }) {
  const riskLeft = `${clamp(telemetry.risk, 0, 100)}%`;
  const aiDecision = telemetry.aiDecision;

  return (
    <section className={`panel prediction-panel ${activeNav === "prediction" ? "focus-panel" : ""}`}>
      <div className="panel-header">
        <h2>PRÉDICTION IA – ÉVOLUTION PHYSIOLOGIQUE</h2>
        <button aria-label="Changer horizon IA" onClick={onCycleHorizon} type="button">Horizon : {horizon} min <ChevronDown size={13} /></button>
      </div>
      <div className="risk-summary">
        <strong>{telemetry.risk}</strong><span>/100</span><b>Risque {telemetry.riskLabel.toLowerCase()}</b>
      </div>
      <div className="risk-scale">
        <i style={{ left: riskLeft }} />
      </div>
      <div className="risk-axis"><span>0</span><span>50</span><span>100</span></div>
      <AiLatencyStrip aiDecision={aiDecision} />
      <div className="evolution-head">
        <span>Évolution du score de risque</span>
        <b><i className="observed" /> Observé</b>
        <b><i className="predicted" /> Prédit (IA)</b>
      </div>
      <RiskChart tick={tick} appliedCount={appliedCount} telemetry={telemetry} riskHistory={riskHistory} />
      <div className="model-foot">
        <span>{aiDecision?.modelName || "Modèle IA : Fusion capteurs"}</span>
        <span>Confiance : {telemetry.aiConfidence}%</span>
        <b style={{ "--confidence": `${telemetry.aiConfidence}%` }} />
      </div>
    </section>
  );
}

function GpsPanel({ telemetry, mapZoom, onZoom, activeNav }) {
  const osmZoom = osmZoomFromControl(mapZoom);
  const tiles = useMemo(() => makeOsmTiles(telemetry.lat, telemetry.lon, osmZoom), [telemetry.lat, telemetry.lon, osmZoom]);
  const gpsBadgeLabel =
    telemetry.gpsSource === "real" || telemetry.gpsSource === "pc"
      ? "GPS actif"
      : telemetry.pcGpsStatus === "blocked"
        ? "Signal GPS faible"
        : "Recherche GPS";
  const sourceLabel =
    telemetry.gpsSource === "real" || telemetry.gpsSource === "pc"
      ? "Localisation en direct"
      : telemetry.pcGpsStatus === "blocked"
        ? "Signal GPS faible"
        : "Recherche GPS";
  const precisionLabel = telemetry.gpsSatellites > 0 ? `${telemetry.precision} m / ${telemetry.gpsSatellites} sat` : `${telemetry.precision} m`;

  return (
    <section className={`panel gps-panel ${activeNav === "global" ? "" : ""}`}>
      <div className="panel-header">
        <h2>LOCALISATION GPS EN DIRECT</h2>
        <span className="updated">Dernière mise à jour : {telemetry.time}</span>
      </div>
      <div className="map-crop">
        <div className="osm-tile-layer" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              alt=""
              className="osm-tile"
              decoding="async"
              key={tile.key}
              loading="lazy"
              referrerPolicy="no-referrer"
              src={tile.url}
              style={{ left: tile.left, top: tile.top }}
            />
          ))}
        </div>
        <span className={`gps-source-badge ${telemetry.gpsSource}`}>{gpsBadgeLabel}</span>
        <div className="map-pin"><MapPin size={36} fill="#2d8cff" /></div>
        <div className="gps-coordinate-strip">
          Lat {telemetry.lat.toFixed(6)} / Lon {telemetry.lon.toFixed(6)}
        </div>
        <a
          className="map-attribution"
          href={`https://www.openstreetmap.org/?mlat=${telemetry.lat}&mlon=${telemetry.lon}#map=${osmZoom}/${telemetry.lat}/${telemetry.lon}`}
          rel="noreferrer"
          target="_blank"
        >
          © OSM
        </a>
        <div className="zoom-controls">
          <button aria-label="Zoomer la carte GPS" onClick={() => onZoom(0.25)} type="button">+</button>
          <button aria-label="Dézoomer la carte GPS" onClick={() => onZoom(-0.25)} type="button">−</button>
        </div>
      </div>
      <div className="gps-stats">
        <div><span>Source position</span><strong>{sourceLabel}</strong></div>
        <div><span>Vitesse</span><strong>{telemetry.speed} m/s</strong></div>
        <div><span>Précision</span><strong>{precisionLabel}</strong></div>
      </div>
    </section>
  );
}

function Sidebar({ activeNav, telemetry, onNavigate }) {
  const esp32ConnectionLabel = telemetry.hardwareStatus === "simulation" ? "Mode Simulé" : (telemetry.hardwareStatus === "real" || telemetry.hardwareStatus === "live") ? "Connecté" : "Déconnecté";
  const esp32ConnectionClass = telemetry.hardwareStatus === "simulation" ? "waiting" : (telemetry.hardwareStatus === "real" || telemetry.hardwareStatus === "live") ? "real" : "offline";

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="logo-mark" style={refBg} />
        <div>
          <strong>TWIN-MEDIC</strong>
          <span>CRM DefHack 2026</span>
        </div>
      </div>
      <nav className="nav-menu">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button className={activeNav === item.key ? "active" : ""} key={item.key} onClick={() => onNavigate(item)} type="button">
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <button className="device-card" onClick={() => onNavigate({ key: "sensors", label: "ESP32", target: "sensors" })} type="button">
        <div className="device-head">
          <strong>ESP32</strong>
          <span className={esp32ConnectionClass}>{esp32ConnectionLabel}<i /></span>
        </div>
        <div className="device-line"><span>Connexion</span><b>USB / WiFi</b></div>
        <div className="device-line"><span>Bauds / API</span><b className="green">115200 / 8787</b></div>
        <div className="device-line"><span>Batterie</span><b><i className="battery" /> {telemetry.battery}%</b></div>
        <div className="battery-bar"><i style={{ width: `${telemetry.battery}%` }} /></div>
        <div className="device-line sync"><span>Dernière synchro</span><b>{telemetry.time}</b></div>
      </button>
      <button className="footer-chip" onClick={() => onNavigate({ key: "global", label: "Accueil CRM DefHack", target: "dashboard" })} type="button">
        <div><Shield size={22} /></div>
        <span>CRM DefHack 2026<br /><b>Twin-Medic</b></span>
      </button>
    </aside>
  );
}

function Topbar({
  unreadCount,
  notificationsOpen,
  helpOpen,
  profileOpen,
  onToggleNotifications,
  onToggleHelp,
  onToggleProfile,
  isAuthenticated,
  loggedInUser,
}) {
  return (
    <header className="topbar">
      <div className="title-block">
        <h1>Twin-Medic – Dashboard de Jumeau Numérique</h1>
        <p>ESP32&nbsp;&nbsp;•&nbsp;&nbsp;AD8232&nbsp;&nbsp;•&nbsp;&nbsp;MAX30102&nbsp;&nbsp;•&nbsp;&nbsp;MPU-9250/6500</p>
      </div>
      <div className="top-actions">
        <span className="system-ok"><i /> Système opérationnel</span>
        <button aria-label="Ouvrir notifications" className={notificationsOpen ? "active" : ""} onClick={onToggleNotifications} type="button">
          <Bell size={20} />
          {unreadCount > 0 && <b>{unreadCount}</b>}
        </button>
        <button aria-label="Ouvrir aide" className={helpOpen ? "active" : ""} onClick={onToggleHelp} type="button"><CircleHelp size={20} /></button>
        <button aria-label="Ouvrir profil médecin" className={`profile-button ${profileOpen ? "active" : ""}`} onClick={onToggleProfile} type="button">
          <span className="doctor-avatar" style={refBg} />
          <span className="doctor-name"><strong>{loggedInUser || "Dr. Ahmed SALA"}</strong><small>{isAuthenticated ? "Connecté" : "Non Connecté"}</small></span>
          <ChevronDown size={18} className="chevron" />
        </button>
      </div>
    </header>
  );
}

function BottomStrip({ activeNav, onNavigate }) {
  return (
    <div className="bottom-strip">
      {featureCards.map((card) => {
        const Icon = card.icon;
        return (
          <button className={activeNav === card.key ? "active" : ""} key={card.key} onClick={() => onNavigate(card)} type="button">
            <div><Icon size={25} /></div>
            <span><strong>{card.title}</strong><small>{card.detail}</small></span>
          </button>
        );
      })}
    </div>
  );
}

function NotificationPanel({ notifications, onClear, onClose }) {
  return (
    <div className="popover notification-popover">
      <div className="popover-head">
        <strong>Notifications</strong>
        <button aria-label="Fermer notifications" onClick={onClose} type="button"><X size={14} /></button>
      </div>
      {notifications.map((item) => (
        <p key={item}>{item}</p>
      ))}
      <button className="mini-action" onClick={onClear} type="button">Marquer comme lu</button>
    </div>
  );
}

function HelpPanel({ onClose }) {
  return (
    <div className="popover help-popover">
      <div className="popover-head">
        <strong>Aide rapide</strong>
        <button aria-label="Fermer aide" onClick={onClose} type="button"><X size={14} /></button>
      </div>
      <p>Cliquez les cartes vitales pour inspecter une mesure.</p>
      <p>Utilisez les recommandations pour réduire le risque simulé.</p>
      <p>Le bouton horizon change la fenêtre de prédiction IA.</p>
    </div>
  );
}

function ProfilePanel({ nightBoost, onToggleNight, onExport, onClose, isAuthenticated, onLogout, onOpenAuth }) {
  return (
    <div className="popover profile-popover">
      <div className="popover-head">
        <strong>Session médicale</strong>
        <button aria-label="Fermer profil" onClick={onClose} type="button"><X size={14} /></button>
      </div>
      {isAuthenticated ? (
        <button className="menu-action" onClick={onLogout} type="button"><UserRound size={14} /> Déconnexion</button>
      ) : (
        <>
          <button className="menu-action" onClick={() => onOpenAuth("login")} type="button"><UserRound size={14} /> Login</button>
          <button className="menu-action" onClick={() => onOpenAuth("signup")} type="button"><Shield size={14} /> Sign up</button>
        </>
      )}
      <button className="menu-action" onClick={onToggleNight} type="button"><Moon size={14} /> {nightBoost ? "Mode standard" : "Mode nuit renforcé"}</button>
      <button className="menu-action" onClick={onExport} type="button"><Download size={14} /> Exporter session</button>
    </div>
  );
}

function AuthWidget({ mode, setMode, onClose, onSubmit, error, setError, username, setUsername, password, setPassword }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(username, password, mode);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-widget-box">
        <div className="auth-header">
          <h2>{mode === "login" ? "Login" : "Sign Up"}</h2>
          <button onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-field">
            <label>Addresse</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: Ahmed SALA" required />
          </div>
          <div className="auth-field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ex: admin" required />
          </div>
          <button className="auth-submit" type="submit">{mode === "login" ? "Se connecter" : "S'inscrire"}</button>
          <p className="auth-switch">
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
              {mode === "login" ? "Pas de compte? S'inscrire" : "Déjà un compte? Se connecter"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

function WidgetShell({ activeNav, title, subtitle, icon: Icon, onBack, children }) {
  return (
    <section className={`route-widget ${activeNav}-widget`}>
      <div className="route-header">
        <div className="route-title">
          <div><Icon size={29} /></div>
          <span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
        </div>
        <div className="route-actions">
          <span><i /> Widget actif</span>
          <button onClick={onBack} type="button">Retour vue globale</button>
        </div>
      </div>
      {children}
    </section>
  );
}

function SensorsWidget({ sensors, telemetry, sensorHistory, selectedSensor, onSelectSensor, onBack, onAction, simulationMode }) {
  const currentSensor = sensors.find((sensor) => sensor.id === selectedSensor) || sensors[0];
  const [customCmd, setCustomCmd] = useState("");
  const signal = makeSensorSignal(getSensorChartSeries(sensorHistory, telemetry, currentSensor.id));
  const signalUnit = getSensorChartUnit(currentSensor.id, telemetry);

  const piezoId = currentSensor.id.startsWith("piezo-") ? currentSensor.id.replace("piezo-", "") : null;
  const cal = telemetry.piezoCalibration || {};
  const threshold = cal.threshold ?? 20;
  const sensorCal = piezoId ? (cal[piezoId] || { idle: 0, noise: 2, scale: 350, gain: 3.0 }) : null;

  const triggerCmd = (command) => {
    onAction(`Commande envoyée : ${command}`, `esp32-cmd:${command}`);
  };

  return (
    <WidgetShell
      activeNav="sensors"
      title="Capteurs"
      subtitle="Flux ESP32, calibration, santé des modules et télémétrie brute"
      icon={Radio}
      onBack={onBack}
    >
      <div className="widget-grid sensors-view">
        <article className="widget-card sensor-console">
          <div className="widget-card-head">
            <strong>Modules connectés</strong>
            <span>{sensors.length} en ligne</span>
          </div>
          <div className="sensor-command-list">
            {sensors.map((sensor) => {
              const Icon = sensor.icon;
              return (
                <button className={selectedSensor === sensor.id ? "active" : ""} key={sensor.id} onClick={() => onSelectSensor(sensor)} type="button">
                  <Icon size={20} />
                  <span><strong>{sensor.name}</strong><small>{sensor.value}</small></span>
                  <i />
                </button>
              );
            })}
          </div>
        </article>

        <article className="widget-card sensor-detail">
          <div className="widget-card-head">
            <strong>{currentSensor.name}</strong>
            <span>USB 115200 • API 8787</span>
          </div>
          <div className="signal-preview">
            <svg viewBox="0 0 420 148" aria-hidden="true">
              <g className="grid">
                {[0, 1, 2, 3].map((row) => <line key={row} x1="0" y1={22 + row * 31} x2="420" y2={22 + row * 31} />)}
                {[0, 1, 2, 3, 4, 5].map((col) => <line key={col} x1={35 + col * 70} y1="4" x2={35 + col * 70} y2="137" />)}
              </g>
              <path d={signal.path} />
            </svg>
            <div className="signal-stats">
              <span>Valeur <strong>{signal.current}</strong>{signalUnit && <em>{signalUnit}</em>}</span>
              <span>Min <strong>{signal.min}</strong></span>
              <span>Max <strong>{signal.max}</strong></span>
              <span>{signal.samples} samples</span>
              {signal.stable && <b>signal stable</b>}
            </div>
          </div>
          <div className="sensor-actions">
            <button onClick={() => triggerCmd("piezo zero")} type="button">Auto-Zéro (Calibrer)</button>
            <button onClick={() => onAction("Test de connexion USB lancé", "test-usb")} type="button">Tester connexion</button>
            <button 
              onClick={() => onAction("Mode simulation basculé", "toggle-simulation")} 
              type="button"
              className={simulationMode ? "active" : ""}
            >
              {simulationMode ? "Arrêter Simulation" : "Activer Simulation"}
            </button>
            <button onClick={() => triggerCmd("piezo sensitive")} type="button">Mode Sensible</button>
            <button onClick={() => triggerCmd("piezo reset")} type="button">Reset Usine</button>
          </div>

          <div className="calibration-console-box">
            <div className="console-title">
              <span>Console de Calibration Physique (ESP32)</span>
            </div>
            
            <div className="calibration-metrics">
              <div className="cal-metric">
                <span className="cal-metric-lbl">Seuil Impact</span>
                <strong className="cal-metric-val">{threshold}%</strong>
              </div>
              {sensorCal && (
                <>
                  <div className="cal-metric">
                    <span className="cal-metric-lbl">Base Idle ({piezoId})</span>
                    <strong className="cal-metric-val">{sensorCal.idle}</strong>
                  </div>
                  <div className="cal-metric">
                    <span className="cal-metric-lbl">Bruit (Noise)</span>
                    <strong className="cal-metric-val">{sensorCal.noise}</strong>
                  </div>
                  <div className="cal-metric">
                    <span className="cal-metric-lbl">Échelle (Scale)</span>
                    <strong className="cal-metric-val">{sensorCal.scale}</strong>
                  </div>
                  <div className="cal-metric">
                    <span className="cal-metric-lbl">Gain (Sensibilité)</span>
                    <strong className="cal-metric-val">{sensorCal.gain}x</strong>
                  </div>
                </>
              )}
            </div>

            <div className="quick-presets">
              <span className="section-label">Sensibilité globale :</span>
              <div className="preset-buttons">
                <button onClick={() => triggerCmd("piezo threshold 15")} type="button">Seuil 15% (Sensible)</button>
                <button onClick={() => triggerCmd("piezo threshold 25")} type="button">Seuil 25% (Normal)</button>
                <button onClick={() => triggerCmd("piezo threshold 35")} type="button">Seuil 35% (Sourd)</button>
                <button onClick={() => triggerCmd("piezo noise all 8")} type="button">Filtre Bruit (8)</button>
              </div>
            </div>

            <div className="custom-command-row">
              <input
                type="text"
                placeholder="Entrez une commande (ex: piezo sens leftArm 2.5)"
                value={customCmd}
                onChange={(e) => setCustomCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customCmd.trim()) {
                    triggerCmd(customCmd.trim());
                    setCustomCmd("");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customCmd.trim()) {
                    triggerCmd(customCmd.trim());
                    setCustomCmd("");
                  }
                }}
              >
                Envoyer
              </button>
            </div>
          </div>
        </article>

        <article className="widget-card telemetry-matrix">
          <div className="widget-card-head">
            <strong>Télémétrie brute</strong>
            <span>{telemetry.time}</span>
          </div>
          <div className="matrix-grid">
            <div><span>BPM</span><strong>{telemetry.heart}</strong></div>
            <div><span>Respiration</span><strong>{telemetry.respiration} rpm</strong></div>
            <div><span>SpO2 MAX30102</span><strong>{telemetry.spo2}%</strong></div>
            <div><span>ECG AD8232</span><strong>{telemetry.leadOff ? "LO off" : telemetry.ecg || 0}</strong></div>
            <div><span>IR MAX30102</span><strong>{telemetry.max30102?.ir || 0}</strong></div>
            <div><span>Gyro</span><strong>{Number(telemetry.motion?.gyroMagnitude || 0).toFixed(1)} dps</strong></div>
            <div><span>Accel</span><strong>{Number(telemetry.motion?.accelMagnitude || 0).toFixed(2)} g</strong></div>
            <div><span>Temp. DHT10</span><strong>{telemetry.temp.toFixed(1)} °C</strong></div>
            <div><span>GPS lat</span><strong>{telemetry.lat.toFixed(5)}</strong></div>
            <div><span>GPS lon</span><strong>{telemetry.lon.toFixed(5)}</strong></div>
            <div><span>Paquets</span><strong>{telemetry.packets.toLocaleString("fr-FR")}</strong></div>
            <div><span>Perte</span><strong>{telemetry.loss}%</strong></div>
          </div>
          <div className="pinout-panel">
            <div className="pinout-title">
              <strong>Pinout ESP32</strong>
              <span>{telemetry.dataSource === "simulation" ? "simulation" : telemetry.sensorDataReady ? "reel" : "attente"}</span>
            </div>
            <div className="pinout-grid">
              {hardwarePinout.piezo.map((sensor) => (
                <div key={sensor.id}>
                  <span>{sensor.label}</span>
                  <strong>{sensor.pin}</strong>
                </div>
              ))}
              {[hardwarePinout.ecg, hardwarePinout.max30102, hardwarePinout.motion].map((sensor) => (
                <div key={sensor.id}>
                  <span>{sensor.label}</span>
                  <strong>{sensor.pin}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
    </WidgetShell>
  );
}

function SimulationConfigWidget({ ranges, onChange, onReset, onClose }) {
  const updateRange = (key, field, value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    onChange((current) => sanitizeSimulationRanges({
      ...current,
      [key]: {
        ...current[key],
        [field]: number,
      },
    }));
  };

  return (
    <div className="simulation-config-overlay" role="dialog" aria-label="Configuration simulation">
      <div className="simulation-config-panel">
        <div className="simulation-config-head">
          <div>
            <strong>Mode simulation actif</strong>
            <span>Choisir les intervalles aleatoires avant la demonstration</span>
          </div>
          <button aria-label="Fermer configuration simulation" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <div className="simulation-range-grid">
          {Object.entries(ranges).map(([key, range]) => (
            <div className="simulation-range-row" key={key}>
              <label>
                <span>{range.label}</span>
                <strong>{range.min} - {range.max} {range.unit}</strong>
              </label>
              <div>
                <input
                  aria-label={`${range.label} minimum`}
                  min="0"
                  onChange={(event) => updateRange(key, "min", event.target.value)}
                  step={range.step}
                  type="number"
                  value={range.min}
                />
                <input
                  aria-label={`${range.label} maximum`}
                  min="0"
                  onChange={(event) => updateRange(key, "max", event.target.value)}
                  step={range.step}
                  type="number"
                  value={range.max}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="simulation-config-actions">
          <button onClick={onReset} type="button">Reset</button>
          <button onClick={onClose} type="button">Appliquer</button>
        </div>
      </div>
    </div>
  );
}

function PatientsWidget({ patients, activePatientId, onSelectPatient, onSavePatient, onNfcRead, onBack, onAction }) {
  const selectedPatient = patients.find((patient) => patient.id === activePatientId) || patients[0] || null;
  const [form, setForm] = useState(() => selectedPatient || createEmptyPatient());
  const [nfcInput, setNfcInput] = useState("");
  const [nfcMessage, setNfcMessage] = useState("Lecteur NFC pret");
  const bmi = computeBmi(form.heightCm, form.weightKg);

  useEffect(() => {
    if (selectedPatient) setForm(selectedPatient);
  }, [selectedPatient?.id, patients]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitPatient = (event) => {
    event.preventDefault();
    const cleaned = {
      ...form,
      id: form.id.trim() || createEmptyPatient().id,
      nfcId: form.nfcId.trim().toUpperCase(),
      bmi,
    };
    onSavePatient(cleaned);
    setForm(cleaned);
    setNfcMessage(`Fiche ${cleaned.id} enregistree`);
  };

  const selectFromNfc = (value) => {
    const code = value.trim();
    if (!code) return;
    const found = onNfcRead(code);
    setNfcMessage(found ? `Patient selectionne: ${code}` : `Badge inconnu: ${code}`);
    setNfcInput("");
  };

  const startWebNfc = async () => {
    if (!("NDEFReader" in window)) {
      setNfcMessage("Web NFC indisponible: utilisez le champ ID/NFC");
      onAction("Lecteur NFC manuel actif");
      return;
    }

    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      setNfcMessage("Approchez le badge NFC du lecteur");
      reader.onreading = (event) => {
        const decoder = new TextDecoder();
        const recordText = Array.from(event.message.records || [])
          .map((record) => {
            try {
              return record.data ? decoder.decode(record.data) : "";
            } catch {
              return "";
            }
          })
          .find(Boolean);
        selectFromNfc(event.serialNumber || recordText || "");
      };
    } catch {
      setNfcMessage("NFC bloque par le navigateur: utilisez la saisie manuelle");
    }
  };

  const newPatient = () => {
    const patient = createEmptyPatient();
    setForm(patient);
    onAction("Nouveau dossier patient pret");
  };

  return (
    <WidgetShell
      activeNav="patients"
      title="Patients NFC"
      subtitle="Dossiers medicaux, identifiants NFC et selection rapide du patient"
      icon={UserRound}
      onBack={onBack}
    >
      <div className="widget-grid patients-view">
        <article className="widget-card patient-index-card">
          <div className="widget-card-head">
            <strong>Selection NFC</strong>
            <span>{patients.length} fiches</span>
          </div>
          <div className="nfc-reader">
            <Radio size={27} />
            <strong>{nfcMessage}</strong>
            <small>Scanner NFC ou taper l'ID du badge</small>
          </div>
          <div className="nfc-input-row">
            <input
              aria-label="ID badge NFC"
              onChange={(event) => setNfcInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") selectFromNfc(nfcInput);
              }}
              placeholder="04-A3-9C-21"
              value={nfcInput}
            />
            <button onClick={() => selectFromNfc(nfcInput)} type="button">OK</button>
          </div>
          <button className="nfc-scan-button" onClick={startWebNfc} type="button">Scanner NFC</button>
          <div className="patient-list">
            {patients.map((patient) => (
              <button className={patient.id === selectedPatient?.id ? "active" : ""} key={patient.id} onClick={() => onSelectPatient(patient.id)} type="button">
                <span>{patient.id}</span>
                <strong>{patient.firstName || "Prenom"} {patient.lastName || "Nom"}</strong>
                <small>NFC {patient.nfcId || "non assigne"}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="widget-card patient-form-card">
          <div className="widget-card-head">
            <strong>Coordonnees patient</strong>
            <span>BMI {bmi || "--"}</span>
          </div>
          <form className="patient-form" onSubmit={submitPatient}>
            <label><span>ID patient</span><input value={form.id} onChange={(event) => updateField("id", event.target.value)} /></label>
            <label><span>ID badge NFC</span><input value={form.nfcId} onChange={(event) => updateField("nfcId", event.target.value)} /></label>
            <label><span>Nom</span><input value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} /></label>
            <label><span>Prenom</span><input value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} /></label>
            <label><span>Taille (cm)</span><input inputMode="decimal" value={form.heightCm} onChange={(event) => updateField("heightCm", event.target.value)} /></label>
            <label><span>Poids (kg)</span><input inputMode="decimal" value={form.weightKg} onChange={(event) => updateField("weightKg", event.target.value)} /></label>
            <label><span>Groupe sanguin</span><input value={form.bloodType} onChange={(event) => updateField("bloodType", event.target.value)} /></label>
            <label><span>BMI</span><input readOnly value={bmi || ""} /></label>
            <label className="wide"><span>Dossier medical / maladies</span><textarea value={form.diseases} onChange={(event) => updateField("diseases", event.target.value)} /></label>
            <label><span>Derniere consultation</span><input type="date" value={form.lastConsultation} onChange={(event) => updateField("lastConsultation", event.target.value)} /></label>
            <label className="wide"><span>Resultat du soin</span><textarea value={form.careResult} onChange={(event) => updateField("careResult", event.target.value)} /></label>
            <div className="patient-form-actions">
              <button type="submit">Enregistrer fiche</button>
              <button onClick={newPatient} type="button">Nouveau dossier</button>
            </div>
          </form>
        </article>

        <article className="widget-card medical-summary-card">
          <div className="widget-card-head">
            <strong>Dossier actif</strong>
            <span>{selectedPatient?.bloodType || form.bloodType || "--"}</span>
          </div>
          <div className="medical-id-card">
            <UserRound size={32} />
            <strong>{form.firstName || "Prenom"} {form.lastName || "Nom"}</strong>
            <span>{form.id}</span>
          </div>
          <div className="medical-summary-grid">
            <div><span>Taille</span><strong>{form.heightCm || "--"} cm</strong></div>
            <div><span>Poids</span><strong>{form.weightKg || "--"} kg</strong></div>
            <div><span>BMI</span><strong>{bmi || "--"}</strong></div>
            <div><span>NFC</span><strong>{form.nfcId || "--"}</strong></div>
          </div>
          <div className="medical-notes">
            <span>Maladies</span>
            <p>{form.diseases || "Aucune information medicale renseignee."}</p>
            <span>Derniere consultation</span>
            <p>{form.lastConsultation || "--"}</p>
            <span>Resultat du soin</span>
            <p>{form.careResult || "Aucun resultat ajoute."}</p>
          </div>
        </article>
      </div>
    </WidgetShell>
  );
}

function TwinWidget({ telemetry, twinLayer, setTwinLayer, onBack, onAction }) {
  const layers = ["Anatomie", "Perfusion", "Respiration", "Risque"];
  const piezoSensors = telemetry.piezoSensors || [];
  const twinMetrics = [
    { key: "heart", label: "DA9AT EL 9ALB", value: telemetry.heart, unit: "bpm", icon: HeartPulse },
    { key: "temp", label: "TEMPERATURE", value: telemetry.temp.toFixed(1), unit: "°C", icon: Thermometer },
    { key: "respiration", label: "FREQUENCE RESP.", value: telemetry.respiration, unit: "rpm", icon: Activity },
    { key: "spo2", label: "SpO2 MAX30102", value: telemetry.spo2, unit: "%", icon: Activity },
    { key: "state", label: "ETAT GENERAL", value: telemetry.status, unit: "", icon: ShieldCheck },
  ];

  return (
    <WidgetShell
      activeNav="twin"
      title="Jumeau 3D"
      subtitle="Exploration du patient numérique, couches physiologiques et état global"
      icon={Box}
      onBack={onBack}
    >
      <div className="widget-grid twin-view">
        <article className="widget-card twin-viewport">
          <div className="widget-card-head">
            <strong>Modèle patient</strong>
            <span>{twinLayer}</span>
          </div>
          <div className={`body-scan-large twin-body-with-overlays ${twinLayer.toLowerCase()}`} style={twinBodyBg}>
            <div className="twin-pulse-ring" />
            {twinMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div className={`twin-overlay-metric ${metric.key}`} key={metric.key}>
                  <Icon size={13} />
                  <span>{metric.label}</span>
                  <strong>{metric.value}<em>{metric.unit}</em></strong>
                </div>
              );
            })}
            <div className={`impact-alert-strip ${telemetry.impactDetected ? "danger" : ""}`}>
              {telemetry.impactDetected ? "IMPACT PIEZO" : "PIEZO ARMES"} · {piezoSensors.length}/5 capteurs
            </div>
            {piezoSensors.map((sensor) => (
              <div className={`piezo-sensor-marker ${sensor.className} ${sensor.hit ? "hit" : ""}`} key={sensor.id}>
                <i />
                <span>{sensor.shortLabel}</span>
                <strong>{sensor.hit ? "IMPACT" : `${sensor.intensity}%`}</strong>
              </div>
            ))}
          </div>
          <div className="layer-controls">
            {layers.map((layer) => (
              <button className={twinLayer === layer ? "active" : ""} key={layer} onClick={() => { setTwinLayer(layer); onAction(`Couche ${layer} activée`); }} type="button">
                {layer}
              </button>
            ))}
          </div>
        </article>

        <article className="widget-card twin-status-card">
          <div className="widget-card-head">
            <strong>État physiologique</strong>
            <span>{telemetry.status}</span>
          </div>
          <div className="twin-metrics">
            <div><HeartPulse size={18} /><span>DA9AT EL 9ALB</span><strong>{telemetry.heart} bpm</strong></div>
            <div><Thermometer size={18} /><span>TEMPERATURE</span><strong>{telemetry.temp.toFixed(1)} °C</strong></div>
            <div><Activity size={18} /><span>FREQUENCE RESP.</span><strong>{telemetry.respiration} rpm</strong></div>
            <div><Activity size={18} /><span>SpO2 MAX30102</span><strong>{telemetry.spo2} %</strong></div>
            <div><ShieldCheck size={18} /><span>ETAT GENERAL</span><strong>{telemetry.status}</strong></div>
            <div><Shield size={18} /><span>Risque</span><strong>{telemetry.risk}/100</strong></div>
          </div>
          <div className="sensor-actions">
            <button onClick={() => onAction("Rotation du jumeau relancée")} type="button">Rotation</button>
            <button onClick={() => onAction("Capture 3D sauvegardée")} type="button">Capture</button>
          </div>
        </article>
      </div>
    </WidgetShell>
  );
}

function PredictionWidget({ telemetry, tick, horizon, horizons, setHorizonIndex, appliedCount, onBack, onAction, riskHistory }) {
  const aiDecision = telemetry.aiDecision;
  const modelReadout = makeModelReadout(aiDecision);

  return (
    <WidgetShell
      activeNav="prediction"
      title="Prédictions IA"
      subtitle="Simulation court terme, modèle actif et estimation du risque"
      icon={Brain}
      onBack={onBack}
    >
      <div className="widget-grid prediction-view">
        <article className="widget-card prediction-hero">
          <div className="risk-big">
            <strong>{telemetry.risk}</strong>
            <span>/100</span>
            <b>Risque {telemetry.riskLabel.toLowerCase()}</b>
          </div>
          <div className="risk-scale widget-scale"><i style={{ left: `${telemetry.risk}%` }} /></div>
          <RiskChart tick={tick} appliedCount={appliedCount} telemetry={telemetry} riskHistory={riskHistory} />
        </article>

        <article className="widget-card model-card">
          <div className="widget-card-head">
            <strong>Modèle actif</strong>
            <span>{telemetry.aiConfidence}%</span>
          </div>
          <div className="model-buttons model-readout">
            {modelReadout.map((model) => (
              <span className={`model-chip ${model.active ? "active" : ""}`} key={model.label}>
                {model.label}
              </span>
            ))}
          </div>
          <div className="horizon-buttons">
            {horizons.map((item, index) => (
              <button className={horizon === item ? "active" : ""} key={item} onClick={() => { setHorizonIndex(index); onAction(`Horizon ${item} minutes`); }} type="button">
                {item} min
              </button>
            ))}
          </div>
          {aiDecision && (
            <div className="ai-pipeline-card">
              <strong>{aiDecision.diagnosis}</strong>
              <p>{aiDecision.explanation}</p>
              <AiForecastGrid aiDecision={aiDecision} />
              <AiEvidenceBars aiDecision={aiDecision} />
              <small>{aiDecision.recommendation}</small>
            </div>
          )}
        </article>
      </div>
    </WidgetShell>
  );
}

function RecommendationsWidget({ telemetry, appliedActions, alertAcknowledged, onAcknowledge, onApplyAction, onBack, onAction }) {
  const recommendationDisplayRows = makeRecommendationRows(telemetry.aiDecision);
  const aiAlertText = telemetry.aiDecision?.alertText || (alertAcknowledged ? "Alerte vérifiée" : "Alerte légère détectée");

  return (
    <WidgetShell
      activeNav="recommendations"
      title="Recommandations"
      subtitle="Actions médicales classées, suivi d'application et niveau de confiance"
      icon={ShieldCheck}
      onBack={onBack}
    >
      <div className="widget-grid recommendations-view">
        <article className="widget-card recommendation-board">
          <div className="widget-card-head">
            <strong>Plan d'intervention</strong>
            <span>Confiance {telemetry.confidence}%</span>
          </div>
          <button className={`mild-alert ${telemetry.aiDecision?.anomalyDetected ? "impact" : alertAcknowledged ? "acknowledged" : ""}`} onClick={onAcknowledge} type="button">
            {alertAcknowledged && !telemetry.aiDecision?.anomalyDetected ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {aiAlertText}
          </button>
          {telemetry.aiDecision && (
            <div className="ai-recommendation-card">
              <strong>{telemetry.aiDecision.diagnosis}</strong>
              <p>{telemetry.aiDecision.recommendation}</p>
            </div>
          )}
          <div className="large-rec-list">
            {recommendationDisplayRows.map((row) => {
              const Icon = row.icon;
              const applied = appliedActions.includes(row.id);
              return (
                <button className={`rec-row ${row.tone} ${applied ? "applied" : ""}`} key={row.id} onClick={() => onApplyAction(row)} type="button">
                  <div className="rec-icon"><Icon size={24} /></div>
                  <div>
                    <strong>{applied ? row.applied : row.title}</strong>
                    <p>{row.detail}</p>
                  </div>
                  <b>{applied ? "✓" : row.num}</b>
                </button>
              );
            })}
          </div>
        </article>

        <article className="widget-card escalation-card">
          <div className="widget-card-head">
            <strong>Escalade</strong>
            <span>{appliedActions.length}/3 actions</span>
          </div>
          <div className="escalation-steps">
            <button onClick={() => onAction("Équipe médicale alertée")} type="button">Alerter équipe médicale</button>
            <button onClick={() => onAction("Canal radio sécurisé ouvert")} type="button">Ouvrir canal radio</button>
            <button onClick={() => onAction("Évacuation préparée")} type="button">Préparer évacuation</button>
          </div>
        </article>
      </div>
    </WidgetShell>
  );
}

function HistoryWidget({ telemetry, sensorHistory, onBack, onAction }) {
  const events = makeTelemetryEvents(telemetry, sensorHistory);

  return (
    <WidgetShell
      activeNav="history"
      title="Historique"
      subtitle="Chronologie des mesures, alertes, synchronisations et actions"
      icon={Clock3}
      onBack={onBack}
    >
      <div className="widget-grid history-view">
        <article className="widget-card history-chart-card">
          <div className="widget-card-head">
            <strong>Comparaison temporelle</strong>
            <span>{telemetry.time}</span>
          </div>
          <ComparisonChart telemetry={telemetry} sensorHistory={sensorHistory} />
          <div className="sensor-actions">
            <button onClick={() => onAction("Filtre alertes appliqué")} type="button">Filtrer alertes</button>
            <button onClick={() => onAction("Historique exporté")} type="button">Exporter historique</button>
          </div>
        </article>

        <article className="widget-card timeline-card">
          <div className="widget-card-head">
            <strong>Journal des événements</strong>
            <span>{events.length} entrées</span>
          </div>
          <div className="timeline-list">
            {events.map(([time, text, tone]) => (
              <button className={tone} key={`${time}-${text}`} onClick={() => onAction(text)} type="button">
                <span>{time}</span>
                <strong>{text}</strong>
              </button>
            ))}
          </div>
        </article>
      </div>
    </WidgetShell>
  );
}

function ActiveWidget({
  activeNav,
  sensors,
  telemetry,
  sensorHistory,
  selectedSensor,
  onSelectSensor,
  patients,
  activePatientId,
  onSelectPatient,
  onSavePatient,
  onNfcRead,
  onBack,
  onAction,
  twinLayer,
  setTwinLayer,
  tick,
  horizon,
  horizons,
  setHorizonIndex,
  appliedActions,
  riskHistory,
  alertAcknowledged,
  onAcknowledge,
  onApplyAction,
  simulationMode,
}) {
  if (activeNav === "sensors") {
    return <SensorsWidget sensors={sensors} telemetry={telemetry} sensorHistory={sensorHistory} selectedSensor={selectedSensor} onSelectSensor={onSelectSensor} onBack={onBack} onAction={onAction} simulationMode={simulationMode} />;
  }

  if (activeNav === "patients") {
    return (
      <PatientsWidget
        patients={patients}
        activePatientId={activePatientId}
        onSelectPatient={onSelectPatient}
        onSavePatient={onSavePatient}
        onNfcRead={onNfcRead}
        onBack={onBack}
        onAction={onAction}
      />
    );
  }

  if (activeNav === "twin") {
    return <TwinWidget telemetry={telemetry} twinLayer={twinLayer} setTwinLayer={setTwinLayer} onBack={onBack} onAction={onAction} />;
  }

  if (activeNav === "prediction") {
    return (
      <PredictionWidget
        telemetry={telemetry}
        tick={tick}
        horizon={horizon}
        horizons={horizons}
        setHorizonIndex={setHorizonIndex}
        appliedCount={appliedActions.length}
        riskHistory={riskHistory}
        onBack={onBack}
        onAction={onAction}
      />
    );
  }

  if (activeNav === "recommendations") {
    return (
      <RecommendationsWidget
        telemetry={telemetry}
        appliedActions={appliedActions}
        alertAcknowledged={alertAcknowledged}
        onAcknowledge={onAcknowledge}
        onApplyAction={onApplyAction}
        onBack={onBack}
        onAction={onAction}
      />
    );
  }

  if (activeNav === "history") {
    return <HistoryWidget telemetry={telemetry} sensorHistory={sensorHistory} onBack={onBack} onAction={onAction} />;
  }

  return null;
}

function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/piezo-test") {
    return <PiezoTestPage />;
  }

  const dashboardFit = useDashboardFit();
  const [tick, setTick] = useState(0);
  const [activeNav, setActiveNav] = useState("global");
  const [selectedMetric, setSelectedMetric] = useState("heart");
  const [selectedSensor, setSelectedSensor] = useState("heart");
  const [horizonIndex, setHorizonIndex] = useState(1);
  const [mapZoom, setMapZoom] = useState(1);
  const [appliedActions, setAppliedActions] = useState([]);
  const [alertAcknowledged, setAlertAcknowledged] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nightBoost, setNightBoost] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [twinLayer, setTwinLayer] = useState("Perfusion");
  const [patients, setPatients] = useState(loadStoredPatients);
  const [activePatientId, setActivePatientId] = useState(() => loadStoredPatients()[0]?.id || "PAT-ESP32-01");
  const [hardwareTelemetry, setHardwareTelemetry] = useState(null);
  const [hardwareStatus, setHardwareStatus] = useState("connecting");
  const [activeSerialPort, setActiveSerialPort] = useState(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationRanges, setSimulationRanges] = useState(loadSimulationRanges);
  const [simulationConfigOpen, setSimulationConfigOpen] = useState(false);
  const [pcLocation, setPcLocation] = useState(null);
  const [pcGpsStatus, setPcGpsStatus] = useState("checking");
  const [toast, setToast] = useState("Connexion ESP32");
  const telemetryHistoryRef = useRef([]);
  const pushToast = (message) => setToast(message);

  // Auth states
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    try {
      const stored = window.localStorage.getItem("twin-medic-users");
      return stored ? JSON.parse(stored) : [{ username: "Ahmed SALA", password: "admin" }];
    } catch {
      return [{ username: "Ahmed SALA", password: "admin" }];
    }
  });
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [showAuthWidget, setShowAuthWidget] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    window.localStorage.setItem("twin-medic-users", JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  const handleAuthSubmit = (username, password, mode) => {
    if (mode === "login") {
      const user = registeredUsers.find(u => u.username === username && u.password === password);
      if (user) {
        setIsAuthenticated(true);
        setLoggedInUser(username);
        setShowAuthWidget(false);
        setAuthError("");
        pushToast(`Connecté en tant que ${username}`);
      } else {
        setAuthError("Addresse ou mot de passe incorrect.");
      }
    } else {
      // Sign up
      const exists = registeredUsers.some(u => u.username === username);
      if (exists) {
        setAuthError("Cet utilisateur existe déjà.");
      } else {
        const newUser = { username, password };
        setRegisteredUsers(prev => [...prev, newUser]);
        setIsAuthenticated(true);
        setLoggedInUser(username);
        setShowAuthWidget(false);
        setAuthError("");
        pushToast(`Compte créé ! Connecté en tant que ${username}`);
      }
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => setTick((current) => current + 1), 1200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    window.localStorage.setItem("twin-medic-simulation-ranges", JSON.stringify(simulationRanges));
  }, [simulationRanges]);

  useEffect(() => {
    window.localStorage.setItem("twin-medic-patients", JSON.stringify(patients));
    if (!patients.some((patient) => patient.id === activePatientId)) {
      setActivePatientId(patients[0]?.id || "");
    }
  }, [patients, activePatientId]);

  useEffect(() => {
    let stream;
    let alive = true;

    const applyIncomingTelemetry = (payload, connected = true) => {
      if (!alive) return;
      setHardwareTelemetry({ ...payload, clientReceivedAt: connected ? Date.now() : 0 });
      setHardwareStatus(connected ? "live" : "waiting");
    };

    const readInitialStatus = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!alive) return;
        if (!response.ok) {
          setHardwareStatus("offline");
          return;
        }
        const status = await response.json();
        if (status.latestTelemetry) {
          applyIncomingTelemetry(status.latestTelemetry, Boolean(status.connected));
        } else {
          setHardwareStatus(status.connected ? "live" : "waiting");
        }
      } catch {
        if (alive) setHardwareStatus("offline");
      }
    };

    readInitialStatus();

    if (typeof EventSource === "undefined") {
      setHardwareStatus("offline");
      return () => {
        alive = false;
      };
    }

    stream = new EventSource("/api/stream");
    stream.addEventListener("ready", () => {
      if (!alive) return;
      setHardwareStatus((current) => (current === "live" ? current : "waiting"));
    });
    stream.addEventListener("telemetry", (event) => {
      try {
        applyIncomingTelemetry(JSON.parse(event.data));
      } catch {
        if (alive) setHardwareStatus("waiting");
      }
    });
    stream.onerror = () => {
      if (!alive) return;
      setHardwareStatus((current) => (current === "live" ? "waiting" : "offline"));
    };

    return () => {
      alive = false;
      stream?.close();
    };
  }, []);

  useEffect(() => {
    if ("serial" in navigator) {
      navigator.serial.getPorts().then((ports) => {
        if (ports.length > 0 && !activeSerialPort) {
          setActiveSerialPort(ports[0]);
        }
      });
      const onConnect = (e) => {
        if (!activeSerialPort) {
          setActiveSerialPort(e.target);
        }
      };
      const onDisconnect = (e) => {
        if (activeSerialPort === e.target) {
          setActiveSerialPort(null);
          setHardwareStatus("waiting");
          setToast("Carte ESP32 déconnectée");
        }
      };
      navigator.serial.addEventListener("connect", onConnect);
      navigator.serial.addEventListener("disconnect", onDisconnect);
      return () => {
        navigator.serial.removeEventListener("connect", onConnect);
        navigator.serial.removeEventListener("disconnect", onDisconnect);
      };
    }
  }, [activeSerialPort]);

  useEffect(() => {
    if (!activeSerialPort) return;
    let reader;
    let keepReading = true;

    async function readLoop() {
      try {
        await activeSerialPort.open({ baudRate: 115200 });
      } catch (err) {
        if (err.name !== "InvalidStateError") {
          setToast("Erreur d'ouverture du port série. Déjà ouvert ?");
          return;
        }
      }
      
      setHardwareStatus("live");
      setToast("Connexion Série établie (115200 bauds)");

      try {
        while (activeSerialPort.readable && keepReading) {
          const textDecoder = new TextDecoderStream();
          const readableStreamClosed = activeSerialPort.readable.pipeTo(textDecoder.writable);
          reader = textDecoder.readable.getReader();
          let buffer = "";
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                buffer += value;
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                      const payload = JSON.parse(trimmed);
                      if (payload.status === "ready") continue;
                      
                      setHardwareTelemetry({
                        timestamp: payload.timestamp || new Date().toISOString(),
                        sourceTimestamp: payload.sourceTimestamp || payload.sampleTimestamp || payload.timestamp || null,
                        transport: "web-serial",
                        deviceId: payload.deviceId,
                        board: payload.board,
                        bpm: payload.bpm,
                        ecg: payload.ecg,
                        ecgWave: payload.ecgWave,
                        leadOff: payload.leadOff,
                        bpmEcg: payload.bpmEcg ?? payload.ecgBpm,
                        bpmOptical: payload.bpmOptical,
                        temp: payload.temp ?? payload.temperature ?? payload.dht10 ?? payload.dht10Temp ?? payload.dht10Temperature ?? payload.dhtTemperature ?? payload.bodyTemperature,
                        spo2: payload.spo2 ?? payload.spO2,
                        respiration: payload.respiration ?? payload.respiratoryRate ?? payload.rpm,
                        battery: payload.battery,
                        signal: payload.signal,
                        packets: payload.packets ?? payload.packetCount,
                        loss: payload.loss ?? payload.packetLoss,
                        clientReceivedAt: Date.now(),
                        gps: {
                          valid: payload.gps?.valid ?? payload.gpsValid,
                          latitude: payload.gps?.latitude ?? payload.latitude,
                          longitude: payload.gps?.longitude ?? payload.longitude,
                          altitude: payload.gps?.altitude ?? payload.altitude,
                          speedKmph: payload.gps?.speedKmph ?? payload.speedKmph,
                          satellites: payload.gps?.satellites ?? payload.satellites,
                          hdop: payload.gps?.hdop ?? payload.hdop,
                        },
                        max30102: payload.max30102 || {
                          ir: payload.ir,
                          red: payload.red,
                          fingerDetected: payload.fingerDetected,
                          bpm: payload.bpmOptical,
                          spo2: payload.spo2 ?? payload.spO2,
                          temperature: payload.temp ?? payload.temperature ?? payload.dht10 ?? payload.dht10Temp ?? payload.dht10Temperature ?? payload.dhtTemperature ?? payload.bodyTemperature,
                        },
                        motion: payload.motion || payload.mpu || {
                          accel: {
                            x: payload.accelX ?? payload.ax,
                            y: payload.accelY ?? payload.ay,
                            z: payload.accelZ ?? payload.az,
                          },
                          gyro: {
                            x: payload.gyroX ?? payload.gx,
                            y: payload.gyroY ?? payload.gy,
                            z: payload.gyroZ ?? payload.gz,
                          },
                          accelMagnitude: payload.accelMagnitude,
                          gyroMagnitude: payload.gyroMagnitude,
                        },
                        piezo: payload.piezo || {
                          rightArm: payload.piezoRightArm,
                          leftArm: payload.piezoLeftArm,
                          rightLeg: payload.piezoRightLeg,
                          leftLeg: payload.piezoLeftLeg,
                          chest: payload.piezoChest,
                        },
                        piezoRaw: payload.piezoRaw,
                        piezoDelta: payload.piezoDelta,
                        piezoCalibration: payload.piezoCalibration,
                        raw: payload,
                      });
                      setHardwareStatus("live");
                    } catch (e) {}
                  }
                }
              }
            }
          } catch (err) {
            // handle error
          } finally {
            reader.releaseLock();
          }
        }
      } catch (e) {}
    }

    readLoop();

    return () => {
      keepReading = false;
      if (reader) {
        reader.cancel().catch(() => {});
      }
    };
  }, [activeSerialPort]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPcGpsStatus("unavailable");
      return undefined;
    }

    let active = true;
    const options = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 12000,
    };
    const handlePosition = (position) => {
      if (!active) return;
      setPcLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        speed: position.coords.speed,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
      setPcGpsStatus("live");
    };
    const handleError = () => {
      if (active) setPcGpsStatus("blocked");
    };

    setPcGpsStatus("requesting");
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, options);
    const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, options);

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === activePatientId) || patients[0] || null,
    [patients, activePatientId],
  );
  const simulatedTelemetry = useMemo(
    () => makeTelemetry(tick, appliedActions, mapZoom, alertAcknowledged, simulationRanges),
    [tick, appliedActions, mapZoom, alertAcknowledged, simulationRanges],
  );
  const rawTelemetry = useMemo(
    () => mergeHardwareTelemetry(simulatedTelemetry, hardwareTelemetry, hardwareStatus, pcLocation, pcGpsStatus, simulationMode),
    [simulatedTelemetry, hardwareTelemetry, hardwareStatus, pcLocation, pcGpsStatus, simulationMode],
  );
  const telemetry = useMemo(
    () => applyModeleIA(rawTelemetry, selectedPatient, telemetryHistoryRef.current),
    [rawTelemetry, selectedPatient],
  );
  useEffect(() => {
    telemetryHistoryRef.current = [
      ...telemetryHistoryRef.current.slice(-29),
      {
        heart: rawTelemetry.heart,
        ecg: rawTelemetry.ecg,
        spo2: rawTelemetry.spo2,
        respiration: rawTelemetry.respiration,
        temp: rawTelemetry.temp,
        speed: rawTelemetry.speed,
        max30102: rawTelemetry.max30102,
        motion: rawTelemetry.motion,
        piezo: Object.fromEntries((rawTelemetry.piezoSensors || []).map((sensor) => [sensor.id, sensor.intensity])),
        piezoRaw: rawTelemetry.piezoRaw,
        piezoDelta: rawTelemetry.piezoDelta,
        piezoSensors: rawTelemetry.piezoSensors,
        packets: rawTelemetry.packets,
        clientReceivedAt: rawTelemetry.clientReceivedAt,
        sourceTimestamp: rawTelemetry.sourceTimestamp,
        transport: rawTelemetry.transport,
        risk: telemetry.risk,
        riskLabel: telemetry.riskLabel,
        aiScore: telemetry.aiDecision?.score,
        aiConfidence: telemetry.aiConfidence,
        forecastRisk: telemetry.forecastRisk,
        predictedVitals: telemetry.predictedVitals,
        correctedVitals: telemetry.aiDecision?.prediction?.correctedVitals,
        simulatedHeart: simulatedTelemetry.heart,
        simulatedSpo2: simulatedTelemetry.spo2,
        simulatedRespiration: simulatedTelemetry.respiration,
        simulatedTemp: simulatedTelemetry.temp,
        time: Date.now(),
      },
    ];
  }, [rawTelemetry, telemetry.risk, telemetry.riskLabel, telemetry.aiDecision?.score, telemetry.aiConfidence, telemetry.forecastRisk, telemetry.predictedVitals, telemetry.aiDecision?.prediction?.correctedVitals, simulatedTelemetry]);
  const horizon = horizons[horizonIndex];
  const sensorHistory = telemetryHistoryRef.current;

  const metricCards = useMemo(() => [
    {
      className: "heart",
      icon: HeartPulse,
      label: "FRÉQUENCE CARDIAQUE",
      value: telemetry.heart,
      unit: "bpm",
      metaLabel: "Variabilité (HRV)",
      metaValue: `${telemetry.hrv} ms`,
      path: makeCompactSignalPath(sensorHistory, telemetry, "heart"),
    },
    {
      className: "gps",
      icon: MapPin,
      label: "POSITION GPS",
      value: `${telemetry.lat.toFixed(4)}°`,
      second: `${telemetry.lon.toFixed(4)}°`,
      unit: "N",
      secondUnit: "E",
      metaLabel: "Altitude",
      metaValue: `${telemetry.altitude} m`,
      path: makeCompactSignalPath(sensorHistory, telemetry, "gps"),
    },
    {
      className: "temp",
      icon: Thermometer,
      label: "TEMPÉRATURE CORPORELLE",
      value: telemetry.temp.toFixed(1),
      unit: "°C",
      metaLabel: "Source",
      metaValue: telemetry.tempSource === "simulation" ? "Simulation" : "DHT10 actif",
      path: makeCompactSignalPath(sensorHistory, telemetry, "temp"),
    },
    {
      className: "state",
      icon: Shield,
      label: "ÉTAT DU PATIENT",
      value: telemetry.status,
      metaLabel: "Niveau de risque",
      metaValue: telemetry.riskLabel,
    },
  ], [telemetry, tick, sensorHistory]);

  const sensors = useMemo(() => [
    { id: "heart", icon: HeartPulse, name: "ECG AD8232 (GPIO34)", value: telemetry.leadOff ? "Electrodes off" : `${telemetry.heart} bpm`, color: "red", wave: makeSensorWave(sensorHistory, telemetry, "heart") },
    { id: "spo2", icon: Activity, name: "GY-MAX30102 SpO2 / pouls", value: `${telemetry.spo2}% • IR ${telemetry.max30102?.ir || 0}`, color: "green", wave: makeSensorWave(sensorHistory, telemetry, "spo2") },
    { id: "motion", icon: Activity, name: "MPU-9250 / MPU-6500 gyro", value: `${Number(telemetry.motion?.gyroMagnitude || 0).toFixed(1)} dps`, color: "blue", wave: makeSensorWave(sensorHistory, telemetry, "motion") },
    { id: "gps", icon: Radio, name: "GPS NEO-6M", value: `${telemetry.lat.toFixed(4)} N, ${telemetry.lon.toFixed(4)} E`, color: "green", wave: makeSensorWave(sensorHistory, telemetry, "gps") },
    { id: "temp", icon: Thermometer, name: "Température DHT10", value: `${telemetry.temp.toFixed(1)} °C`, color: "orange", wave: makeSensorWave(sensorHistory, telemetry, "temp") },
    ...(telemetry.piezoSensors || []).map((sensor, index) => ({
      id: `piezo-${sensor.id}`,
      icon: AlertTriangle,
      name: `Piezo ${sensor.label} (${sensor.pin})`,
      value: sensor.hit ? `IMPACT ${sensor.intensity}%` : `${sensor.intensity}% - ${sensor.status}`,
      color: sensor.hit ? "red" : "blue",
      state: sensor.hit ? "impact" : "",
      wave: makeSensorWave(sensorHistory, telemetry, `piezo-${sensor.id}`),
    })),
  ], [telemetry, tick, sensorHistory]);

  const notifications = [
    telemetry.impactDetected ? `Impact piezo: ${telemetry.impactZones.join(", ")}` : `Alerte légère FC ${telemetry.heart} bpm`,
    `GPS synchronisé à ${telemetry.time}`,
    `Prédiction recalculée horizon ${horizon} min`,
  ];

  const sendCommandToEsp32 = async (command) => {
    if (activeSerialPort) {
      try {
        if (activeSerialPort.writable) {
          const encoder = new TextEncoder();
          const writer = activeSerialPort.writable.getWriter();
          await writer.write(encoder.encode(command + "\n"));
          writer.releaseLock();
          pushToast(`Commande envoyée USB: ${command}`);
          return true;
        }
      } catch (err) {
        console.error("Web Serial write error:", err);
      }
    }
    
    try {
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (response.ok) {
        pushToast(`Commande envoyée WiFi/Bridge: ${command}`);
        return true;
      } else {
        pushToast("Erreur lors de l'envoi de la commande");
      }
    } catch (err) {
      console.error("API send error:", err);
      pushToast("Impossible de contacter le serveur de télémétrie");
    }
    return false;
  };

  const handleWidgetAction = async (msg, type) => {
    if (type?.startsWith("esp32-cmd:")) {
      const command = type.replace("esp32-cmd:", "");
      await sendCommandToEsp32(command);
      return;
    }
    if (type === "test-usb" && "serial" in navigator) {
      try {
        const port = await navigator.serial.requestPort();
        setActiveSerialPort(port);
      } catch (err) {
        pushToast("Connexion USB annulée ou échouée");
      }
      return;
    }
    if (type === "toggle-simulation") {
      setSimulationMode((prev) => {
        const next = !prev;
        setSimulationConfigOpen(next);
        pushToast(next ? "Mode simulation activé" : "Mode simulation désactivé");
        return next;
      });
      return;
    }
    if (type === "open-simulation-config") {
      setSimulationConfigOpen(true);
      pushToast("Configuration simulation ouverte");
      return;
    }
    pushToast(msg);
  };

  const handleNavigate = (item) => {
    setActiveNav(item.key);
    pushToast(`${item.label || item.title} ouvert`);
  };

  const handleBackGlobal = () => {
    setActiveNav("global");
    pushToast("Vue globale ouverte");
  };

  const handleMetricSelect = (card) => {
    setSelectedMetric(card.className);
    pushToast(`${card.label} inspectée`);
  };

  const handleSensorSelect = (item) => {
    if (item.id?.startsWith("piezo-") && typeof window !== "undefined") {
      const piezoId = item.id.replace("piezo-", "");
      window.location.href = `/piezo-test?sensor=${encodeURIComponent(piezoId)}`;
      return;
    }

    setSelectedSensor(item.id);
    setActiveNav("sensors");
    pushToast(`${item.name} sélectionné`);
  };

  const handleSelectPatient = (patientId) => {
    setActivePatientId(patientId);
    setActiveNav("patients");
    const patient = patients.find((item) => item.id === patientId);
    pushToast(patient ? `${patient.firstName} ${patient.lastName} selectionne` : "Patient selectionne");
  };

  const handleSavePatient = (patient) => {
    const savedPatient = {
      ...patient,
      id: patient.id.trim(),
      nfcId: patient.nfcId.trim().toUpperCase(),
    };
    setPatients((current) => {
      const exists = current.some((item) => item.id === savedPatient.id);
      return exists ? current.map((item) => (item.id === savedPatient.id ? savedPatient : item)) : [...current, savedPatient];
    });
    setActivePatientId(savedPatient.id);
    pushToast(`Fiche ${savedPatient.id} enregistree`);
  };

  const handleNfcRead = (code) => {
    const normalized = normalizePatientCode(code);
    const patient = patients.find((item) => (
      normalizePatientCode(item.id) === normalized ||
      normalizePatientCode(item.nfcId) === normalized
    ));
    setActiveNav("patients");
    if (!patient) {
      pushToast(`Badge NFC ${code} inconnu`);
      return false;
    }
    setActivePatientId(patient.id);
    pushToast(`${patient.firstName} ${patient.lastName} selectionne par NFC`);
    return true;
  };

  const handleApplyAction = (row) => {
    setAppliedActions((current) => current.includes(row.id) ? current : [...current, row.id]);
    setActiveNav("recommendations");
    pushToast(row.applied);
  };

  const handleAcknowledge = () => {
    setAlertAcknowledged(true);
    setUnreadCount((current) => Math.max(0, current - 1));
    pushToast("Alerte légère vérifiée");
  };

  const handleCycleHorizon = () => {
    setHorizonIndex((current) => (current + 1) % horizons.length);
    pushToast(`Horizon IA changé`);
  };

  const handleZoom = (delta) => {
    const nextZoom = clamp(Number((mapZoom + delta).toFixed(2)), 1, 1.75);
    setMapZoom(nextZoom);
    pushToast(`Zoom GPS ${Math.round(nextZoom * 100)}%`);
  };

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      telemetry,
      appliedActions,
      horizon,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "twin-medic-session.json";
    link.click();
    URL.revokeObjectURL(url);
    pushToast("Session exportée");
  };

  return (
    <div className={`stage ${nightBoost ? "night-boost" : ""}`}>
      <div
        className="dashboard-frame"
        style={{
          "--dashboard-scale-x": dashboardFit.x.toFixed(4),
          "--dashboard-scale-y": dashboardFit.y.toFixed(4),
        }}
      >
        <div className="dashboard">
        <Sidebar activeNav={activeNav} telemetry={telemetry} onNavigate={handleNavigate} />
        <Topbar
          unreadCount={unreadCount}
          notificationsOpen={notificationsOpen}
          helpOpen={helpOpen}
          profileOpen={profileOpen}
          onToggleNotifications={() => {
            setNotificationsOpen((current) => !current);
            setHelpOpen(false);
            setProfileOpen(false);
          }}
          onToggleHelp={() => {
            setHelpOpen((current) => !current);
            setNotificationsOpen(false);
            setProfileOpen(false);
          }}
          onToggleProfile={() => {
            setProfileOpen((current) => !current);
            setNotificationsOpen(false);
            setHelpOpen(false);
          }}
          isAuthenticated={isAuthenticated}
          loggedInUser={loggedInUser}
        />
        {activeNav === "global" ? (
          <>
            <PatientPanel
              telemetry={telemetry}
              patient={selectedPatient}
              appliedActions={appliedActions}
              alertAcknowledged={alertAcknowledged}
              onAcknowledge={handleAcknowledge}
              onApplyAction={handleApplyAction}
              activeNav={activeNav}
            />
            <div className="vitals-row">
              {metricCards.map((card) => (
                <VitalCard key={card.label} card={card} telemetry={telemetry} selectedMetric={selectedMetric} onSelect={handleMetricSelect} />
              ))}
            </div>
            <SensorsPanel sensors={sensors} telemetry={telemetry} selectedSensor={selectedSensor} onSelectSensor={handleSensorSelect} activeNav={activeNav} />
            <ComparisonPanel telemetry={telemetry} sensorHistory={sensorHistory} activeNav={activeNav} />
            <PredictionPanel
              telemetry={telemetry}
              tick={tick}
              horizon={horizon}
              appliedCount={appliedActions.length}
              onCycleHorizon={handleCycleHorizon}
              activeNav={activeNav}
              riskHistory={telemetryHistoryRef.current}
            />
            <GpsPanel telemetry={telemetry} mapZoom={mapZoom} onZoom={handleZoom} activeNav={activeNav} />
            <BottomStrip activeNav={activeNav} onNavigate={handleNavigate} />
          </>
        ) : (
          <ActiveWidget
            activeNav={activeNav}
            sensors={sensors}
            telemetry={telemetry}
            sensorHistory={telemetryHistoryRef.current}
            selectedSensor={selectedSensor}
            onSelectSensor={handleSensorSelect}
            patients={patients}
            activePatientId={activePatientId}
            onSelectPatient={handleSelectPatient}
            onSavePatient={handleSavePatient}
            onNfcRead={handleNfcRead}
            onBack={handleBackGlobal}
            onAction={handleWidgetAction}
            simulationMode={simulationMode}
            twinLayer={twinLayer}
            setTwinLayer={setTwinLayer}
            tick={tick}
            horizon={horizon}
            horizons={horizons}
            setHorizonIndex={setHorizonIndex}
            appliedActions={appliedActions}
            riskHistory={telemetryHistoryRef.current}
            alertAcknowledged={alertAcknowledged}
            onAcknowledge={handleAcknowledge}
            onApplyAction={handleApplyAction}
          />
        )}

        {notificationsOpen && (
          <NotificationPanel
            notifications={notifications}
            onClear={() => {
              setUnreadCount(0);
              setNotificationsOpen(false);
              pushToast("Notifications marquées comme lues");
            }}
            onClose={() => setNotificationsOpen(false)}
          />
        )}
        {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
        {profileOpen && (
          <ProfilePanel
            nightBoost={nightBoost}
            onToggleNight={() => {
              setNightBoost((current) => !current);
              pushToast(nightBoost ? "Mode standard activé" : "Mode nuit renforcé activé");
            }}
            onExport={handleExport}
            onClose={() => setProfileOpen(false)}
            isAuthenticated={isAuthenticated}
            onLogout={() => {
              setIsAuthenticated(false);
              setLoggedInUser(null);
              setProfileOpen(false);
              pushToast("Déconnecté");
            }}
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setShowAuthWidget(true);
              setProfileOpen(false);
            }}
          />
        )}
        {showAuthWidget && (
          <AuthWidget 
            mode={authMode} 
            setMode={setAuthMode}
            onClose={() => setShowAuthWidget(false)}
            onSubmit={handleAuthSubmit}
            error={authError}
            setError={setAuthError}
            username={authUsername}
            setUsername={setAuthUsername}
            password={authPassword}
            setPassword={setAuthPassword}
          />
        )}
        {simulationMode && simulationConfigOpen && (
          <SimulationConfigWidget
            ranges={simulationRanges}
            onChange={setSimulationRanges}
            onReset={() => {
              setSimulationRanges(defaultSimulationRanges);
              pushToast("Intervalles simulation reinitialises");
            }}
            onClose={() => setSimulationConfigOpen(false)}
          />
        )}
          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>
    </div>
  );
}

export default App;
