import http from "node:http";
import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 8787);
const discoveryPort = Number(process.env.DISCOVERY_PORT || 8788);
const aiServiceUrl = process.env.AI_SERVICE_URL || "";

let latestTelemetry = null;
let latestReceivedAt = 0;
const clients = new Set();
let pendingCommand = null;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

function broadcast(event, data) {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => res.write(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 128 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function normalizeTelemetry(payload, receivedAt = Date.now()) {
  const receivedAtIso = new Date(receivedAt).toISOString();
  const gps = payload.gps || {};
  const piezo = payload.piezo || {};
  const piezoRaw = payload.piezoRaw || {};
  const piezoDelta = payload.piezoDelta || {};
  const ecgWave = Array.isArray(payload.ecgWave)
    ? payload.ecgWave.map(Number).filter((value) => Number.isFinite(value))
    : [];
  const max30102 = payload.max30102 || payload.max || {};
  const motion = payload.motion || payload.mpu || {};
  const accel = motion.accel || motion.accelerometer || {};
  const gyro = motion.gyro || motion.gyroscope || {};
  const latitude = Number(payload.latitude ?? payload.lat ?? gps.latitude ?? gps.lat ?? 0);
  const longitude = Number(payload.longitude ?? payload.lon ?? payload.lng ?? gps.longitude ?? gps.lon ?? gps.lng ?? 0);
  const altitude = Number(payload.altitude ?? gps.altitude ?? 0);
  const speedKmph = Number(payload.speedKmph ?? payload.speed_kmph ?? gps.speedKmph ?? gps.speed_kmph ?? gps.speed ?? 0);
  const satellites = Number(payload.satellites ?? gps.satellites ?? gps.sats ?? 0);
  const hdop = Number(payload.hdop ?? gps.hdop ?? 0);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

  return {
    deviceId: String(payload.deviceId || "twin-medic-esp32"),
    board: String(payload.board || payload.platform || "ESP32"),
    timestamp: payload.timestamp || receivedAtIso,
    sourceTimestamp: payload.sourceTimestamp || payload.sampleTimestamp || payload.timestamp || null,
    serverReceivedAt: receivedAt,
    transport: payload.transport || "api-bridge",
    ecg: Number(payload.ecg ?? 0),
    ecgWave,
    leadOff: Boolean(payload.leadOff),
    bpm: Number(payload.bpm ?? 0),
    bpmEcg: Number(payload.bpmEcg ?? payload.ecgBpm ?? 0),
    bpmOptical: Number(payload.bpmOptical ?? max30102.bpm ?? 0),
    temp: Number(payload.temp ?? payload.temperature ?? max30102.temperature ?? 0),
    spo2: Number(payload.spo2 ?? payload.spO2 ?? payload.oxygen ?? max30102.spo2 ?? 0),
    respiration: Number(payload.respiration ?? payload.respiratoryRate ?? payload.rpm ?? 0),
    gps: {
      latitude,
      longitude,
      altitude,
      speedKmph,
      satellites,
      hdop,
      valid: Boolean(payload.gpsValid ?? gps.valid ?? hasCoordinates),
    },
    piezo: {
      rightArm: Number(payload.piezoRightArm ?? payload.rightArm ?? piezo.rightArm ?? piezo.brasDroit ?? 0),
      leftArm: Number(payload.piezoLeftArm ?? payload.leftArm ?? piezo.leftArm ?? piezo.brasGauche ?? 0),
      rightLeg: Number(payload.piezoRightLeg ?? payload.rightLeg ?? piezo.rightLeg ?? piezo.piedDroit ?? piezo.jambeDroite ?? 0),
      leftLeg: Number(payload.piezoLeftLeg ?? payload.leftLeg ?? piezo.leftLeg ?? piezo.piedGauche ?? piezo.jambeGauche ?? 0),
      chest: Number(payload.piezoChest ?? payload.chest ?? piezo.chest ?? piezo.poitrine ?? piezo.torse ?? 0),
    },
    piezoRaw: {
      rightArm: Number(piezoRaw.rightArm ?? 0),
      leftArm: Number(piezoRaw.leftArm ?? 0),
      rightLeg: Number(piezoRaw.rightLeg ?? 0),
      leftLeg: Number(piezoRaw.leftLeg ?? 0),
      chest: Number(piezoRaw.chest ?? 0),
    },
    piezoDelta: {
      rightArm: Number(piezoDelta.rightArm ?? 0),
      leftArm: Number(piezoDelta.leftArm ?? 0),
      rightLeg: Number(piezoDelta.rightLeg ?? 0),
      leftLeg: Number(piezoDelta.leftLeg ?? 0),
      chest: Number(piezoDelta.chest ?? 0),
    },
    piezoCalibration: payload.piezoCalibration || {},
    max30102: {
      ir: Number(payload.ir ?? max30102.ir ?? 0),
      red: Number(payload.red ?? max30102.red ?? 0),
      fingerDetected: Boolean(payload.fingerDetected ?? max30102.fingerDetected),
      bpm: Number(payload.bpmOptical ?? max30102.bpm ?? 0),
      spo2: Number(payload.spo2 ?? payload.spO2 ?? max30102.spo2 ?? 0),
      temperature: Number(payload.temp ?? payload.temperature ?? max30102.temperature ?? 0),
    },
    motion: {
      accel: {
        x: Number(payload.accelX ?? payload.ax ?? accel.x ?? 0),
        y: Number(payload.accelY ?? payload.ay ?? accel.y ?? 0),
        z: Number(payload.accelZ ?? payload.az ?? accel.z ?? 0),
      },
      gyro: {
        x: Number(payload.gyroX ?? payload.gx ?? gyro.x ?? 0),
        y: Number(payload.gyroY ?? payload.gy ?? gyro.y ?? 0),
        z: Number(payload.gyroZ ?? payload.gz ?? gyro.z ?? 0),
      },
      accelMagnitude: Number(payload.accelMagnitude ?? motion.accelMagnitude ?? 0),
      gyroMagnitude: Number(payload.gyroMagnitude ?? motion.gyroMagnitude ?? 0),
    },
    battery: payload.battery == null ? null : Number(payload.battery),
    signal: Number(payload.signal ?? 0),
    packets: Number(payload.packets ?? payload.packetCount ?? 0),
    loss: Number(payload.loss ?? payload.packetLoss ?? 0),
    raw: payload,
  };
}

async function getPythonAiDecision(telemetry) {
  if (!aiServiceUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 350);
  try {
    const response = await fetch(`${aiServiceUrl.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telemetry }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.decision || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getPythonAiStatus() {
  if (!aiServiceUrl) {
    return {
      enabled: false,
      available: false,
      modelName: "",
      models: [],
      recommendedStack: [],
    };
  }

  const baseUrl = aiServiceUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    const response = await fetch(`${baseUrl}/models`, { signal: controller.signal });
    if (!response.ok) {
      return { enabled: true, available: false, models: [], recommendedStack: [] };
    }
    const payload = await response.json();
    return {
      enabled: true,
      available: true,
      modelName: payload.modelName || "",
      models: payload.models || [],
      recommendedStack: payload.recommendedStack || [],
    };
  } catch {
    return { enabled: true, available: false, models: [], recommendedStack: [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichTelemetryWithAi(telemetry) {
  const decision = await getPythonAiDecision(telemetry);
  if (!decision) return telemetry;
  return {
    ...telemetry,
    pythonAiDecision: decision,
  };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(distDir, requested));

  if (!filePath.startsWith(distDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      const indexPath = path.join(distDir, "index.html");
      fs.readFile(indexPath, (indexError, indexContent) => {
        if (indexError) {
          sendJson(res, 404, {
            error: "Build output not found. Run npm run build first, or use npm run dev with npm run dev:api.",
          });
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(indexContent);
      });
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".json": "application/json",
    }[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/command" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      pendingCommand = body.command;
      console.log(`Command queued for ESP32: ${pendingCommand}`);
      sendJson(res, 200, { ok: true, queued: pendingCommand });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/telemetry" && req.method === "POST") {
    try {
      const payload = JSON.parse(await readBody(req));
      const receivedAt = Date.now();
      latestTelemetry = await enrichTelemetryWithAi(normalizeTelemetry(payload, receivedAt));
      latestReceivedAt = receivedAt;
      broadcast("telemetry", latestTelemetry);
      sendJson(res, 200, {
        ok: true,
        receivedAt: new Date(latestReceivedAt).toISOString(),
        command: pendingCommand || ""
      });
      pendingCommand = null;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/status" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      connected: Boolean(latestTelemetry && Date.now() - latestReceivedAt < 10000),
      latestTelemetry,
      clients: clients.size,
      aiServiceEnabled: Boolean(aiServiceUrl),
    });
    return;
  }

  if (url.pathname === "/api/stream" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("event: ready\ndata: {\"ok\":true}\n\n");
    if (latestTelemetry) {
      res.write(`event: telemetry\ndata: ${JSON.stringify(latestTelemetry)}\n\n`);
    }
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (url.pathname === "/api/ai-status" && req.method === "GET") {
    sendJson(res, 200, await getPythonAiStatus());
    return;
  }

  serveStatic(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Twin-Medic telemetry server listening on http://0.0.0.0:${port}`);
  console.log("ESP32 telemetry endpoint: POST /api/telemetry");
});

const discoverySocket = dgram.createSocket("udp4");

discoverySocket.on("message", (message, remote) => {
  const text = message.toString("utf8").trim();
  if (text !== "TWIN_MEDIC_DISCOVER") return;

  const payload = Buffer.from(JSON.stringify({
    type: "TWIN_MEDIC_SERVER",
    port,
  }));

  discoverySocket.send(payload, remote.port, remote.address);
  console.log(`ESP32 discovery reply sent to ${remote.address}:${remote.port}`);
});

discoverySocket.bind(discoveryPort, "0.0.0.0", () => {
  discoverySocket.setBroadcast(true);
  console.log(`ESP32 auto-discovery listening on udp://0.0.0.0:${discoveryPort}`);
});
