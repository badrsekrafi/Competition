import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, Gauge, Radio, RotateCcw } from "lucide-react";

const PIEZO_ZONES = [
  { id: "rightArm", label: "Bras droite", pin: "GPIO35", aliases: ["rightArm", "piezoRightArm", "brasDroit", "brasDroite"] },
  { id: "leftArm", label: "Bras gauche", pin: "GPIO32", aliases: ["leftArm", "piezoLeftArm", "brasGauche"] },
  { id: "rightLeg", label: "Pied droit", pin: "GPIO33", aliases: ["rightLeg", "piezoRightLeg", "piedDroit", "jambeDroite"] },
  { id: "leftLeg", label: "Pied gauche", pin: "GPIO36", aliases: ["leftLeg", "piezoLeftLeg", "piedGauche", "jambeGauche"] },
  { id: "chest", label: "Poitrine", pin: "GPIO39", aliases: ["chest", "piezoChest", "poitrine", "torse"] },
];

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readPiezoValue(source, zone) {
  if (!source) return 0;
  for (const alias of zone.aliases) {
    const value = readNumber(source[alias]);
    if (value !== null) return value;
  }
  return 0;
}

function normalizeTelemetry(payload) {
  const raw = payload?.raw || {};
  const piezo = payload?.piezo || raw.piezo || raw;
  const piezoRaw = payload?.piezoRaw || raw.piezoRaw || {};
  const piezoDelta = payload?.piezoDelta || raw.piezoDelta || {};
  const piezoCalibration = payload?.piezoCalibration || raw.piezoCalibration || {};

  return {
    deviceId: payload?.deviceId || raw.deviceId || "ESP32",
    board: payload?.board || raw.board || "ESP32",
    timestamp: payload?.timestamp || new Date().toISOString(),
    packets: readNumber(payload?.packets ?? raw.packets ?? raw.packetCount) || 0,
    piezo: PIEZO_ZONES.reduce((result, zone) => {
      result[zone.id] = Math.max(0, Math.min(100, Math.round(readPiezoValue(piezo, zone))));
      return result;
    }, {}),
    piezoRaw: PIEZO_ZONES.reduce((result, zone) => {
      result[zone.id] = Math.round(readPiezoValue(piezoRaw, zone));
      return result;
    }, {}),
    piezoDelta: PIEZO_ZONES.reduce((result, zone) => {
      result[zone.id] = Math.round(readPiezoValue(piezoDelta, zone));
      return result;
    }, {}),
    piezoCalibration,
    raw: payload || null,
  };
}

function formatTime(value) {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function PiezoMeter({ zone, value, threshold, selected }) {
  const hit = value >= threshold;
  const level = value >= 70 ? "danger" : value >= 40 ? "warn" : "ok";

  return (
    <article className={`piezo-test-meter ${hit ? "hit" : ""} ${selected ? "selected" : ""}`}>
      <div className="piezo-test-meter-head">
        <div>
          <span>{zone.pin}</span>
          <strong>{zone.label}</strong>
        </div>
        <b className={level}>{hit ? "IMPACT" : level === "warn" ? "Mouvement" : "Repos"}</b>
      </div>
      <div className="piezo-test-value">
        <strong>{value}</strong>
        <span>%</span>
      </div>
      <div className="piezo-test-mini">
        <span>Raw {zone.raw}</span>
        <span>Delta {zone.delta}</span>
      </div>
      <div className="piezo-test-bar" aria-label={`${zone.label} ${value}%`}>
        <i style={{ width: `${value}%` }} />
        <em style={{ left: `${threshold}%` }} />
      </div>
    </article>
  );
}

export default function PiezoTestPage() {
  const selectedPiezoId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("sensor") || "";
  }, []);
  const [telemetry, setTelemetry] = useState(() => normalizeTelemetry(null));
  const [connection, setConnection] = useState("connecting");
  const [threshold, setThreshold] = useState(20);
  const [lastReceivedAt, setLastReceivedAt] = useState(null);
  const [customCmd, setCustomCmd] = useState("");
  const [cmdStatus, setCmdStatus] = useState("");

  const triggerCmd = async (command) => {
    try {
      setCmdStatus("Envoi...");
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (response.ok) {
        setCmdStatus(`Envoyé: ${command}`);
      } else {
        setCmdStatus("Erreur d'envoi");
      }
    } catch {
      setCmdStatus("Erreur réseau");
    }
    setTimeout(() => setCmdStatus(""), 3000);
  };

  useEffect(() => {
    let alive = true;
    let stream = null;
    let pollTimer = null;

    const applyTelemetry = (payload, connected = true) => {
      if (!alive) return;
      setTelemetry(normalizeTelemetry(payload));
      setConnection(connected ? "live" : "waiting");
      if (connected) setLastReceivedAt(Date.now());
    };

    const readStatus = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!alive) return;
        if (!response.ok) {
          setConnection("offline");
          return;
        }
        const status = await response.json();
        if (status.latestTelemetry) {
          applyTelemetry(status.latestTelemetry, Boolean(status.connected));
        } else {
          setConnection(status.connected ? "live" : "waiting");
        }
      } catch {
        if (alive) setConnection("offline");
      }
    };

    readStatus();

    if (typeof EventSource === "undefined") {
      pollTimer = window.setInterval(readStatus, 1000);
      return () => {
        alive = false;
        window.clearInterval(pollTimer);
      };
    }

    stream = new EventSource("/api/stream");
    stream.addEventListener("ready", () => {
      if (alive) setConnection((current) => (current === "live" ? current : "waiting"));
    });
    stream.addEventListener("telemetry", (event) => {
      try {
        applyTelemetry(JSON.parse(event.data), true);
      } catch {
        if (alive) setConnection("waiting");
      }
    });
    stream.onerror = () => {
      if (alive) setConnection((current) => (current === "live" ? "waiting" : "offline"));
    };

    return () => {
      alive = false;
      stream?.close();
    };
  }, []);

  const piezoValues = useMemo(
    () => PIEZO_ZONES.map((zone) => ({
      ...zone,
      value: telemetry.piezo[zone.id] || 0,
      raw: telemetry.piezoRaw[zone.id] || 0,
      delta: telemetry.piezoDelta[zone.id] || 0,
    })),
    [telemetry],
  );

  const strongest = piezoValues.reduce((best, zone) => (zone.value > best.value ? zone : best), piezoValues[0]);
  const selectedPiezo = piezoValues.find((zone) => zone.id === selectedPiezoId);
  const impactCount = piezoValues.filter((zone) => zone.value >= threshold).length;
  const connectionLabel = connection === "live" ? "Connecte" : connection === "waiting" ? "En attente" : "Hors ligne";

  return (
    <main className="piezo-test-page">
      <header className="piezo-test-header">
        <a href="/" aria-label="Retour dashboard">
          <ArrowLeft size={18} />
          Dashboard
        </a>
        <div>
          <span>ESP32 Piezo Lab</span>
          <h1>Test des 5 capteurs piezo</h1>
        </div>
        <strong className={`piezo-test-status ${connection}`}>{connectionLabel}</strong>
      </header>

      <section className="piezo-test-toolbar">
        <div>
          <Radio size={18} />
          <span>Carte</span>
          <strong>{telemetry.deviceId}</strong>
        </div>
        <div>
          <Activity size={18} />
          <span>Paquets</span>
          <strong>{telemetry.packets.toLocaleString("fr-FR")}</strong>
        </div>
        <div>
          <Gauge size={18} />
          <span>{selectedPiezo ? "Selection" : "Plus fort"}</span>
          <strong>
            {selectedPiezo
              ? `${selectedPiezo.label} ${selectedPiezo.value}%`
              : `${strongest?.label || "--"} ${strongest?.value || 0}%`}
          </strong>
        </div>
        <div>
          <AlertTriangle size={18} />
          <span>Impacts</span>
          <strong>{impactCount}/5</strong>
        </div>
      </section>

      <section className="piezo-test-controls">
        <label>
          <span>Seuil impact local: {threshold}%</span>
          <input
            min="10"
            max="100"
            type="range"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={() => setThreshold(20)}>
          <RotateCcw size={16} />
          Reset seuil
        </button>
        <p>Dernière réception : {lastReceivedAt ? formatTime(lastReceivedAt) : "aucune donnée reçue"}</p>
      </section>

      {/* Remote Calibration Console */}
      <section className="piezo-test-calibration-console widget-card">
        <div className="console-title">
          <span>Console de Calibration Physique (ESP32)</span>
          {cmdStatus && <span className="cmd-status-badge">{cmdStatus}</span>}
        </div>
        
        <div className="cal-buttons-row">
          <button type="button" className="cal-btn primary" onClick={() => triggerCmd("piezo zero")}>
            Auto-Zéro Physique (piezo zero)
          </button>
          <button type="button" className="cal-btn secondary" onClick={() => triggerCmd("piezo sensitive")}>
            Sensibilité Élevée
          </button>
          <button type="button" className="cal-btn secondary" onClick={() => triggerCmd("piezo scale all 450")}>
            Atténuation Moyenne (450)
          </button>
          <button type="button" className="cal-btn secondary" onClick={() => triggerCmd("piezo noise all 8")}>
            Filtre Bruit (8)
          </button>
          <button type="button" className="cal-btn danger" onClick={() => triggerCmd("piezo reset")}>
            Réinitialiser d'Usine
          </button>
        </div>

        <div className="cal-custom-row">
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
            Envoyer à l'ESP32
          </button>
        </div>
      </section>

      <section className="piezo-test-grid">
        {piezoValues.map((zone) => (
          <PiezoMeter key={zone.id} zone={zone} value={zone.value} threshold={threshold} selected={zone.id === selectedPiezoId} />
        ))}
      </section>

      <section className="piezo-test-raw">
        <div>
          <strong>JSON brut piezo</strong>
          <span>{formatTime(telemetry.timestamp)}</span>
        </div>
        <pre>{JSON.stringify(telemetry.raw?.piezo || telemetry.raw?.raw?.piezo || telemetry.piezo, null, 2)}</pre>
        <pre>{JSON.stringify({
          raw: telemetry.piezoRaw,
          delta: telemetry.piezoDelta,
          calibration: telemetry.piezoCalibration,
        }, null, 2)}</pre>
      </section>
    </main>
  );
}
