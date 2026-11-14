import { LATENCY_MODE } from "./constants.js";
import { modeLabel, qualityLabel } from "./labels.js";
import { clamp, median, parseTimestampMs, readNumber, round } from "./utils.js";

export function estimateSampleInterval(history) {
  const samples = Array.isArray(history)
    ? history
        .map((sample) => parseTimestampMs(sample.time ?? sample.clientReceivedAt ?? sample.timestamp))
        .filter((value) => value !== null)
        .slice(-8)
    : [];

  const intervals = [];
  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index] - samples[index - 1];
    if (delta > 100 && delta < 10000) intervals.push(delta);
  }
  return median(intervals);
}

export function estimateLatency(telemetry, history, nowMs) {
  if (telemetry?.sensorDataReady === false) {
    return {
      mode: LATENCY_MODE.WAITING,
      modeLabel: modeLabel(LATENCY_MODE.WAITING),
      ageMs: 0,
      ageSeconds: 0,
      transportLatencyMs: 0,
      sampleIntervalMs: estimateSampleInterval(history),
      packetGap: 0,
      loss: 0,
      quality: 0,
      qualityLabel: qualityLabel(0),
      transport: telemetry?.transport || telemetry?.dataSource || "waiting",
    };
  }

  const clientReceivedAt = parseTimestampMs(telemetry?.clientReceivedAt);
  const serverReceivedAt = parseTimestampMs(telemetry?.serverReceivedAt);
  const telemetryTimestamp = parseTimestampMs(telemetry?.timestamp);
  const sourceTimestamp = parseTimestampMs(
    telemetry?.sourceTimestamp ??
      telemetry?.raw?.sourceTimestamp ??
      telemetry?.raw?.sampleTimestamp ??
      telemetry?.raw?.timestamp,
  );
  const receivedAt = clientReceivedAt || serverReceivedAt || telemetryTimestamp || nowMs;
  const sampleIntervalMs = estimateSampleInterval(history);
  const receiveAgeMs = clamp(nowMs - receivedAt, 0, 60000);
  const transportLatencyMs =
    sourceTimestamp && receivedAt
      ? clamp(receivedAt - sourceTimestamp, 0, 60000)
      : receiveAgeMs;
  const ageMs = Math.max(receiveAgeMs, transportLatencyMs);

  const lastPacket = Array.isArray(history) && history.length
    ? readNumber(history[history.length - 1].packets)
    : null;
  const currentPacket = readNumber(telemetry?.packets);
  const packetGap = lastPacket !== null && currentPacket !== null
    ? Math.max(0, currentPacket - lastPacket)
    : 0;
  const loss = readNumber(telemetry?.loss) ?? 0;

  let mode = LATENCY_MODE.DIRECT;
  if (ageMs > 10000) mode = LATENCY_MODE.STALE;
  else if (ageMs > 5500) mode = LATENCY_MODE.DEGRADED;
  else if (ageMs > 1800 || packetGap > 2 || loss > 4) mode = LATENCY_MODE.COMPENSATED;

  const agePenalty = Math.max(0, ageMs - 900) / 115;
  const packetPenalty = packetGap > 2 ? Math.min(30, (packetGap - 1) * 7) : 0;
  const lossPenalty = clamp(loss * 3.5, 0, 28);
  const quality = clamp(Math.round(100 - agePenalty - packetPenalty - lossPenalty));

  return {
    mode,
    modeLabel: modeLabel(mode),
    ageMs: Math.round(ageMs),
    ageSeconds: round(ageMs / 1000, 1),
    receiveAgeMs: Math.round(receiveAgeMs),
    transportLatencyMs: Math.round(transportLatencyMs),
    sampleIntervalMs: Math.round(sampleIntervalMs),
    packetGap,
    loss,
    quality,
    qualityLabel: qualityLabel(quality),
    transport: telemetry?.transport || telemetry?.dataSource || "unknown",
  };
}
