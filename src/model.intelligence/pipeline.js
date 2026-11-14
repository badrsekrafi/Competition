import { CHEST_ZONES, LATENCY_MODE, LEG_ZONES, MODEL_NAME } from "./constants.js";
import { getBaseline } from "./baseline.js";
import { buildEvidence } from "./evidence.js";
import { forecastRisk } from "./forecast.js";
import { estimateLatency } from "./latency.js";
import { riskLabel } from "./labels.js";
import { classifyZone, getImpactedZones, getStrongestPiezo, recentPiezoMemory } from "./piezo.js";
import { projectVitals } from "./projection.js";
import { buildRecommendation } from "./recommendations.js";
import { clamp, round } from "./utils.js";
import { waitingDecision } from "./waitingDecision.js";

export function runModeleIA({ telemetry, patient, history = [] }) {
  if (telemetry?.sensorDataReady === false) {
    return waitingDecision(patient);
  }

  const nowMs = Date.now();
  const baseline = getBaseline(history);
  const latency = estimateLatency(telemetry, history, nowMs);
  const projected = projectVitals(telemetry, history, baseline, latency);
  const piezoSensors = telemetry?.piezoSensors || [];
  const currentStrongestPiezo = getStrongestPiezo(piezoSensors);
  const piezoMemory = recentPiezoMemory(history, nowMs);
  const evidence = buildEvidence({
    strongestPiezo: currentStrongestPiezo,
    piezoMemory,
    projected,
    baseline,
    latency,
  });
  const strongestPiezo = evidence.activePiezo;
  const impactedZones = getImpactedZones(piezoSensors);
  if (strongestPiezo.id !== "none" && strongestPiezo.intensity >= 72 && !impactedZones.some((zone) => zone.id === strongestPiezo.id)) {
    impactedZones.push(strongestPiezo);
  }
  const zoneType = classifyZone(strongestPiezo.id);

  const fusionBonus =
    (evidence.piezoEvidence > 55 && evidence.cardioEvidence > 45 ? 10 : 0) +
    (evidence.piezoEvidence > 55 && evidence.spo2Evidence > 35 ? 14 : 0) +
    (LEG_ZONES.has(strongestPiezo.id) && evidence.piezoEvidence > 55 && (evidence.cardioEvidence > 35 || evidence.spo2Evidence > 25) ? 12 : 0) +
    (CHEST_ZONES.has(strongestPiezo.id) && (evidence.spo2Evidence > 25 || evidence.respirationEvidence > 35) ? 18 : 0);

  const diseases = String(patient?.diseases || "").toLowerCase();
  const patientRisk =
    diseases.includes("asthme") && zoneType === "chest" ? 6 :
    diseases.includes("hypertension") && evidence.cardioEvidence > 40 ? 4 :
    diseases.includes("diabete") && evidence.temperatureEvidence > 35 ? 3 :
    0;

  const stalePenalty = latency.mode === LATENCY_MODE.STALE ? 10 : latency.mode === LATENCY_MODE.DEGRADED ? 4 : 0;
  const score = clamp(Math.round(
    evidence.piezoEvidence * 0.33 +
    evidence.cardioEvidence * 0.21 +
    evidence.spo2Evidence * 0.22 +
    evidence.respirationEvidence * 0.12 +
    evidence.temperatureEvidence * 0.05 +
    fusionBonus +
    patientRisk -
    stalePenalty,
  ));

  const anomalyDetected = score >= 55 || impactedZones.length > 0;
  const recommendation = buildRecommendation({ zoneType, strongestPiezo, score, latency });
  const forecast = forecastRisk(score, evidence, latency);
  const confidence = clamp(Math.round(
    32 +
    latency.quality * 0.36 +
    score * 0.24 +
    (impactedZones.length ? 8 : 0) -
    (latency.mode === LATENCY_MODE.STALE ? 14 : 0),
  ));

  return {
    modelName: MODEL_NAME,
    patientId: patient?.id || "patient-non-selectionne",
    patientName: patient ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() : "Patient non selectionne",
    anomalyDetected,
    score,
    riskLabel: riskLabel(score),
    confidence,
    strongestPiezo,
    impactedZones,
    latency,
    evidenceRows: evidence.rows,
    prediction: {
      observedVitals: {
        heart: round(projected.observed.heart, 1),
        spo2: round(projected.observed.spo2, 1),
        respiration: round(projected.observed.respiration, 1),
        temperature: round(projected.observed.temperature, 1),
      },
      correctedVitals: {
        heart: round(projected.corrected.heart, 1),
        spo2: round(projected.corrected.spo2, 1),
        respiration: round(projected.corrected.respiration, 1),
        temperature: round(projected.corrected.temperature, 1),
      },
      trends: {
        heart: round(projected.trends.heart, 2),
        spo2: round(projected.trends.spo2, 2),
        respiration: round(projected.trends.respiration, 2),
        temperature: round(projected.trends.temperature, 3),
      },
      lagSeconds: round(projected.lagSeconds, 1),
      forecast,
    },
    features: {
      baseline,
      piezoEvidence: Math.round(evidence.piezoEvidence),
      cardioEvidence: Math.round(evidence.cardioEvidence),
      spo2Evidence: Math.round(evidence.spo2Evidence),
      respirationEvidence: Math.round(evidence.respirationEvidence),
      temperatureEvidence: Math.round(evidence.temperatureEvidence),
      heartRise: round(evidence.heartRise, 1),
      spo2Drop: round(evidence.spo2Drop, 1),
      fusionBonus,
      patientRisk,
      dataQuality: latency.quality,
      stalePenalty,
      piezoMemorySeconds: round(piezoMemory.ageSeconds || 0, 1),
    },
    diagnosis: recommendation.diagnosis,
    status: recommendation.status,
    alertText: recommendation.alertText,
    recommendation: recommendation.recommendation,
    recommendedActions: recommendation.recommendedActions,
    explanation:
      `Liaison ${latency.modeLabel.toLowerCase()} (${latency.ageSeconds}s, qualite ${latency.quality}%). ` +
      `Fusion: piezo ${Math.round(evidence.piezoEvidence)}%, cardio ${Math.round(evidence.cardioEvidence)}%, ` +
      `SpO2 ${Math.round(evidence.spo2Evidence)}%, respiration ${Math.round(evidence.respirationEvidence)}%. ` +
      `Risque projete 15 min: ${forecast.riskAt15Min}/100.`,
  };
}

function isBackendDecision(decision) {
  return (
    decision &&
    Number.isFinite(Number(decision.score)) &&
    Array.isArray(decision.evidenceRows) &&
    decision.prediction?.forecast
  );
}

export function applyModeleIA(telemetry, patient, history = []) {
  const backendDecision = telemetry?.backendAiDecision || telemetry?.pythonAiDecision;
  const decision = isBackendDecision(backendDecision)
    ? backendDecision
    : runModeleIA({ telemetry, patient, history });
  const finalRisk = Math.max(Number(telemetry.risk || 0), decision.score);
  const finalAnomaly = decision.anomalyDetected || Boolean(telemetry.impactDetected);
  const finalZones = decision.impactedZones?.length
    ? decision.impactedZones.map((zone) => zone.label)
    : telemetry.impactZones || [];

  return {
    ...telemetry,
    aiDecision: decision,
    risk: finalRisk,
    riskLabel: riskLabel(finalRisk),
    status: finalAnomaly ? decision.status : decision.status || telemetry.status,
    confidence: Math.max(Number(telemetry.confidence || 0), decision.confidence - 5),
    aiConfidence: decision.confidence,
    impactDetected: finalAnomaly,
    impactZones: finalZones,
    aiRecommendation: decision.recommendation,
    aiRecommendedActions: decision.recommendedActions,
    modelLatency: decision.latency,
    dataQuality: decision.latency?.quality ?? 0,
    forecastRisk: decision.prediction?.forecast,
    predictedVitals: decision.prediction?.correctedVitals,
    evidenceRows: decision.evidenceRows,
  };
}
