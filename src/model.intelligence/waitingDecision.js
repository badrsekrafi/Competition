import { DEFAULT_BASELINE, LATENCY_MODE, MODEL_NAME } from "./constants.js";
import { modeLabel, qualityLabel } from "./labels.js";

export function waitingDecision(patient) {
  return {
    modelName: MODEL_NAME,
    patientId: patient?.id || "patient-non-selectionne",
    patientName: patient ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() : "Patient non selectionne",
    anomalyDetected: false,
    score: 0,
    riskLabel: "Faible",
    confidence: 0,
    strongestPiezo: { id: "none", label: "Aucune zone", intensity: 0, hit: false },
    impactedZones: [],
    latency: {
      mode: LATENCY_MODE.WAITING,
      modeLabel: modeLabel(LATENCY_MODE.WAITING),
      ageMs: 0,
      ageSeconds: 0,
      quality: 0,
      qualityLabel: qualityLabel(0),
      packetGap: 0,
      loss: 0,
      transport: "waiting",
    },
    evidenceRows: [
      { id: "piezo", label: "Piezo impact", value: 0 },
      { id: "cardio", label: "Cardio/ECG", value: 0 },
      { id: "spo2", label: "SpO2", value: 0 },
      { id: "respiration", label: "Respiration", value: 0 },
    ],
    prediction: {
      observedVitals: { heart: 0, spo2: 0, respiration: 0, temperature: 0 },
      correctedVitals: DEFAULT_BASELINE,
      trends: { heart: 0, spo2: 0, respiration: 0, temperature: 0 },
      lagSeconds: 0,
      forecast: { now: 0, riskAt5Min: 0, riskAt10Min: 0, riskAt15Min: 0 },
    },
    features: {
      baseline: DEFAULT_BASELINE,
      piezoEvidence: 0,
      cardioEvidence: 0,
      spo2Evidence: 0,
      respirationEvidence: 0,
      temperatureEvidence: 0,
      dataQuality: 0,
      fusionBonus: 0,
      patientRisk: 0,
    },
    diagnosis: "En attente capteurs ESP32",
    status: "En attente capteurs",
    alertText: "Aucune valeur ESP32 recue",
    recommendation: "Connecter la carte ESP32 ou activer le mode simulation pour generer des donnees de test.",
    recommendedActions: [
      "Verifier le cablage USB et le baudrate 115200.",
      "Verifier l'API telemetry ou le bridge serie.",
      "Activer la simulation uniquement pour la demonstration.",
    ],
    explanation: "Pipeline IA suspendu: aucune donnee capteur reelle disponible et simulation desactivee.",
  };
}
