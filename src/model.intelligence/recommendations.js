import { LATENCY_MODE } from "./constants.js";

export function buildRecommendation({ zoneType, strongestPiezo, score, latency }) {
  const delayPrefix = latency.mode === LATENCY_MODE.DIRECT
    ? ""
    : "Decision calculee avec compensation de retard; confirmer l'etat sur le terrain. ";

  if (score < 45) {
    return {
      diagnosis: "Situation stable",
      status: latency.mode === LATENCY_MODE.STALE ? "Signal retarde" : "Stable",
      alertText: latency.mode === LATENCY_MODE.STALE ? "Signal capteur ancien" : "Aucune anomalie critique detectee",
      recommendation:
        `${delayPrefix}Continuer la surveillance et garder la liaison capteurs active.`,
      recommendedActions: [
        "Continuer monitoring cardio, SpO2, temperature et piezo.",
        "Verifier la qualite reseau si la latence augmente.",
        "Garder le combattant selectionne dans Patients NFC.",
      ],
    };
  }

  if (zoneType === "leg") {
    return {
      diagnosis: `Suspicion projectile membre inferieur (${strongestPiezo.label})`,
      status: "Impact detecte",
      alertText: `Impact balistique detecte: ${strongestPiezo.label}`,
      recommendation:
        `${delayPrefix}Priorite: verifier hemorragie. Si saignement massif confirme, appliquer le protocole medical terrain et evacuer.`,
      recommendedActions: [
        "Verifier visuellement la plaie et le saignement.",
        "Si hemorragie massive: garrot tactique par personnel forme, puis noter l'heure.",
        "Evacuation medicale et surveillance SpO2/cardio en continu.",
      ],
    };
  }

  if (zoneType === "limb") {
    return {
      diagnosis: `Suspicion impact balistique membre (${strongestPiezo.label})`,
      status: "Impact detecte",
      alertText: `Impact balistique detecte: ${strongestPiezo.label}`,
      recommendation:
        `${delayPrefix}Immobiliser le membre, verifier hemorragie, compression directe si necessaire, evacuation vers equipe medicale.`,
      recommendedActions: [
        "Localiser l'impact et verifier hemorragie.",
        "Compression directe / pansement compressif si saignement.",
        "Surveiller augmentation cardio et baisse SpO2.",
      ],
    };
  }

  if (zoneType === "chest") {
    return {
      diagnosis: "Suspicion impact thoracique",
      status: "Impact critique",
      alertText: "Impact thoracique detecte",
      recommendation:
        `${delayPrefix}Priorite evacuation. Surveiller detresse respiratoire et SpO2. Appliquer protocole thoracique par personnel forme.`,
      recommendedActions: [
        "Evaluer respiration, douleur thoracique et SpO2.",
        "Alerter equipe medicale pour prise en charge thoracique.",
        "Evacuation rapide avec monitoring continu.",
      ],
    };
  }

  return {
    diagnosis: "Anomalie physiologique detectee",
    status: "A surveiller",
    alertText: "Anomalie multi-capteurs detectee",
    recommendation:
      `${delayPrefix}Verifier le combattant, confirmer les signaux capteurs et declencher evaluation medicale.`,
    recommendedActions: [
      "Verifier placement capteurs et etat du combattant.",
      "Comparer piezo, cardio, SpO2 et respiration.",
      "Alerter equipe medicale si le score augmente.",
    ],
  };
}
