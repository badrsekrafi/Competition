/*
  Twin-Medic ESP32 telemetry node

  Hardware:
  - ESP32 DevKit
  - 5 piezo impact sensors on ADC1 pins
  - AD8232 ECG module
  - GY-MAX30102 pulse oximeter module
  - MPU-9250 or MPU-6500 IMU for accelerometer/gyroscope data

  Arduino libraries:
  - ESP32 board package
  - SparkFun MAX3010x Pulse and Proximity Sensor Library

  Notes:
  - Use ADC1 pins for analog sensors because ESP32 ADC2 conflicts with WiFi.
  - The SpO2 estimate below is for prototype/dashboard visualization only. Calibrate
    or replace with a validated algorithm before any real medical use.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiUdp.h>
#include <Preferences.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

const char* WIFI_SSID = "iPhone";
const char* WIFI_PASSWORD = "baderrsk";

// Fallback only. The ESP32 first tries UDP auto-discovery, so this usually
// does not need to change when the phone hotspot gives the laptop a new IP.
const char* FALLBACK_SERVER_URL = "http://172.20.10.2:8787/api/telemetry";
const char* DEVICE_ID = "twin-medic-esp32";
const uint16_t DISCOVERY_PORT = 8788;

const uint8_t I2C_SDA_PIN = 21;
const uint8_t I2C_SCL_PIN = 22;

const uint8_t ECG_PIN = 34;
const uint8_t LEAD_OFF_PLUS_PIN = 25;
const uint8_t LEAD_OFF_MINUS_PIN = 26;

const uint8_t PIEZO_RIGHT_ARM_PIN = 35;
const uint8_t PIEZO_LEFT_ARM_PIN = 32;
const uint8_t PIEZO_RIGHT_LEG_PIN = 33;
const uint8_t PIEZO_LEFT_LEG_PIN = 36;
const uint8_t PIEZO_CHEST_PIN = 39;

const uint8_t MPU_ADDR = 0x68;
const uint8_t PIEZO_SENSOR_COUNT = 5;
const uint8_t PIEZO_CAL_VERSION = 3;
const uint8_t ECG_WAVE_SAMPLE_COUNT = 64;
const uint8_t DEFAULT_PIEZO_HIT_THRESHOLD = 20;
const uint16_t DEFAULT_PIEZO_NOISE_FLOOR = 2;
const uint16_t DEFAULT_PIEZO_FULL_SCALE_DELTA = 350;
const float DEFAULT_PIEZO_GAIN = 3.0f;

struct PiezoCalibration {
  const char* id;
  const char* label;
  uint8_t pin;
  uint16_t idleRaw;
  uint16_t noiseFloor;
  uint16_t fullScaleDelta;
  float gain;
};

PiezoCalibration piezoCal[PIEZO_SENSOR_COUNT] = {
  { "rightArm", "Bras droite", PIEZO_RIGHT_ARM_PIN, 0, DEFAULT_PIEZO_NOISE_FLOOR, DEFAULT_PIEZO_FULL_SCALE_DELTA, DEFAULT_PIEZO_GAIN },
  { "leftArm", "Bras gauche", PIEZO_LEFT_ARM_PIN, 0, DEFAULT_PIEZO_NOISE_FLOOR, DEFAULT_PIEZO_FULL_SCALE_DELTA, DEFAULT_PIEZO_GAIN },
  { "rightLeg", "Pied droit", PIEZO_RIGHT_LEG_PIN, 0, DEFAULT_PIEZO_NOISE_FLOOR, DEFAULT_PIEZO_FULL_SCALE_DELTA, DEFAULT_PIEZO_GAIN },
  { "leftLeg", "Pied gauche", PIEZO_LEFT_LEG_PIN, 0, DEFAULT_PIEZO_NOISE_FLOOR, DEFAULT_PIEZO_FULL_SCALE_DELTA, DEFAULT_PIEZO_GAIN },
  { "chest", "Poitrine", PIEZO_CHEST_PIN, 0, DEFAULT_PIEZO_NOISE_FLOOR, DEFAULT_PIEZO_FULL_SCALE_DELTA, DEFAULT_PIEZO_GAIN },
};

uint8_t piezoHitThreshold = DEFAULT_PIEZO_HIT_THRESHOLD;

MAX30105 max30102;
WiFiUDP discoveryUdp;
Preferences piezoPrefs;

bool maxReady = false;
bool mpuReady = false;
String serverUrl = "";
unsigned long lastPostAt = 0;
unsigned long packetCount = 0;
String serialLine = "";
uint16_t piezoLatchedRaw[PIEZO_SENSOR_COUNT] = { 0, 0, 0, 0, 0 };
uint16_t piezoLatchedDelta[PIEZO_SENSOR_COUNT] = { 0, 0, 0, 0, 0 };

unsigned long lastEcgPeakTime = 0;
float ecgBaseline = 2048.0;
float ecgPeakLevel = 80.0;
float ecgThreshold = 50.0;
float ecgBpm = 0.0;
bool ecgAboveThreshold = false;
bool ecgLeadOff = false;
unsigned long ecgLeadOffStartTime = 0;
uint16_t ecgWaveSamples[ECG_WAVE_SAMPLE_COUNT] = {};
uint8_t ecgWaveIndex = 0;
uint8_t ecgWaveFilled = 0;

unsigned long lastEcgSampleTime = 0;

unsigned long lastOpticalBeatAt = 0;
float opticalBpm = 0.0;

struct MotionData {
  float ax = 0;
  float ay = 0;
  float az = 0;
  float gx = 0;
  float gy = 0;
  float gz = 0;
};

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  unsigned long startAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAt < 15000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected. USB serial JSON still active.");
  }
}

String findJsonNumber(const String& text, const String& key, const String& fallback) {
  int keyIndex = text.indexOf("\"" + key + "\"");
  if (keyIndex < 0) return fallback;
  int colonIndex = text.indexOf(':', keyIndex);
  if (colonIndex < 0) return fallback;

  int start = colonIndex + 1;
  while (start < text.length() && (text[start] == ' ' || text[start] == '\t')) {
    start++;
  }

  int end = start;
  while (end < text.length() && isDigit(text[end])) {
    end++;
  }

  if (end <= start) return fallback;
  return text.substring(start, end);
}

String findJsonString(const String& text, const String& key, const String& fallback) {
  int keyIndex = text.indexOf("\"" + key + "\"");
  if (keyIndex < 0) return fallback;
  int colonIndex = text.indexOf(':', keyIndex);
  if (colonIndex < 0) return fallback;

  int quoteStart = text.indexOf('"', colonIndex);
  if (quoteStart < 0) return fallback;
  int quoteEnd = text.indexOf('"', quoteStart + 1);
  if (quoteEnd < 0) return fallback;

  return text.substring(quoteStart + 1, quoteEnd);
}

bool discoverServer() {
  if (WiFi.status() != WL_CONNECTED) return false;

  discoveryUdp.stop();
  if (!discoveryUdp.begin(0)) {
    Serial.println("Discovery UDP begin failed");
    return false;
  }

  IPAddress broadcastIp = WiFi.localIP();
  IPAddress subnetMask = WiFi.subnetMask();
  for (uint8_t i = 0; i < 4; i++) {
    broadcastIp[i] = broadcastIp[i] | uint8_t(~subnetMask[i]);
  }

  Serial.print("Searching Twin-Medic server on ");
  Serial.print(broadcastIp);
  Serial.print(":");
  Serial.println(DISCOVERY_PORT);

  for (uint8_t attempt = 0; attempt < 5; attempt++) {
    discoveryUdp.beginPacket(broadcastIp, DISCOVERY_PORT);
    discoveryUdp.print("TWIN_MEDIC_DISCOVER");
    discoveryUdp.endPacket();

    unsigned long waitStart = millis();
    while (millis() - waitStart < 800) {
      int packetSize = discoveryUdp.parsePacket();
      if (packetSize <= 0) {
        delay(20);
        continue;
      }

      char buffer[180];
      int length = discoveryUdp.read(buffer, sizeof(buffer) - 1);
      if (length <= 0) continue;
      buffer[length] = '\0';

      String response = String(buffer);
      if (response.indexOf("TWIN_MEDIC_SERVER") < 0) continue;

      String portText = findJsonNumber(response, "port", "8787");
      IPAddress serverIp = discoveryUdp.remoteIP();
      serverUrl = "http://" + serverIp.toString() + ":" + portText + "/api/telemetry";

      Serial.print("Twin-Medic server discovered: ");
      Serial.println(serverUrl);
      discoveryUdp.stop();
      return true;
    }
  }

  discoveryUdp.stop();
  Serial.println("Twin-Medic auto-discovery failed");
  return false;
}

void writeMpuRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

bool initMpu() {
  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) return false;

  writeMpuRegister(0x6B, 0x00);  // Wake from sleep.
  delay(100);
  writeMpuRegister(0x1B, 0x00);  // Gyro +/-250 dps.
  writeMpuRegister(0x1C, 0x00);  // Accel +/-2 g.
  return true;
}

MotionData readMotion() {
  MotionData data;
  if (!mpuReady) return data;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return data;
  if (Wire.requestFrom(MPU_ADDR, uint8_t(14)) != 14) return data;

  int16_t rawAx = Wire.read() << 8 | Wire.read();
  int16_t rawAy = Wire.read() << 8 | Wire.read();
  int16_t rawAz = Wire.read() << 8 | Wire.read();
  Wire.read();
  Wire.read();
  int16_t rawGx = Wire.read() << 8 | Wire.read();
  int16_t rawGy = Wire.read() << 8 | Wire.read();
  int16_t rawGz = Wire.read() << 8 | Wire.read();

  data.ax = rawAx / 16384.0;
  data.ay = rawAy / 16384.0;
  data.az = rawAz / 16384.0;
  data.gx = rawGx / 131.0;
  data.gy = rawGy / 131.0;
  data.gz = rawGz / 131.0;
  return data;
}

void processEcgSample(int raw, bool loState) {
  unsigned long now = millis();

  // Détection électrodes déconnectées
  if (loState) {
    if (ecgLeadOffStartTime == 0) {
      ecgLeadOffStartTime = now;
    }
    if (now - ecgLeadOffStartTime > 500) {  // LEAD_OFF_CONFIRM_MS
      ecgLeadOff = true;
    }
  } else {
    ecgLeadOff = false;
    ecgLeadOffStartTime = 0;
  }

  // Ignorer valeurs ADC parasites
  if (raw < 20 || raw > 4070) {
    if (ecgLeadOff) {
      ecgBpm = 0;
    }
    return;
  }

  // Filtre ligne de base
  ecgBaseline = 0.995 * ecgBaseline + 0.005 * raw;
  float filtered = raw - ecgBaseline;

  // On garde seulement les pics positifs
  float signal = filtered;
  if (signal < 0) {
    signal = 0;
  }

  // Seuil automatique
  if (signal > ecgPeakLevel) {
    ecgPeakLevel = signal;
  } else {
    ecgPeakLevel = ecgPeakLevel * 0.999;
  }

  ecgThreshold = ecgPeakLevel * 0.70;  // THRESHOLD_FACTOR

  // Limites du seuil
  if (ecgThreshold < 60) {
    ecgThreshold = 60;
  }
  if (ecgThreshold > 1200) {
    ecgThreshold = 1200;
  }

  // Calcul BPM seulement si électrodes connectées
  if (!ecgLeadOff) {
    if (signal > ecgThreshold && !ecgAboveThreshold && (now - lastEcgPeakTime > 500)) {  // REFRACTORY_MS
      unsigned long interval = now - lastEcgPeakTime;

      // min 500 (120 bpm), max 1500 (40 bpm)
      if (lastEcgPeakTime > 0 && interval >= 500 && interval <= 1500) {
        float newBpm = 60000.0 / interval;

        // Accepter uniquement BPM réaliste
        if (newBpm >= 40 && newBpm <= 120) {
          if (ecgBpm == 0) {
            ecgBpm = newBpm;
          } else {
            // Lissage du BPM
            ecgBpm = 0.80 * ecgBpm + 0.20 * newBpm;
          }
        }
      }
      lastEcgPeakTime = now;
      ecgAboveThreshold = true;
    }

    // Réarmement après descente du signal
    if (signal < ecgThreshold * 0.45) {
      ecgAboveThreshold = false;
    }

    // Si aucun battement pendant 4 secondes
    if (lastEcgPeakTime > 0 && now - lastEcgPeakTime > 4000) {
      ecgBpm = 0;
    }
  } else {
    ecgAboveThreshold = false;
    ecgBpm = 0;
  }
}

float updateOpticalBpm(long irValue) {
  if (!maxReady || irValue < 50000) {
    opticalBpm = 0.0;
    return opticalBpm;
  }

  if (checkForBeat(irValue)) {
    unsigned long now = millis();
    if (lastOpticalBeatAt > 0) {
      float instantBpm = 60000.0 / float(now - lastOpticalBeatAt);
      if (instantBpm >= 40.0 && instantBpm <= 190.0) {
        opticalBpm = opticalBpm == 0.0 ? instantBpm : opticalBpm * 0.72 + instantBpm * 0.28;
      }
    }
    lastOpticalBeatAt = now;
  }

  if (lastOpticalBeatAt > 0 && millis() - lastOpticalBeatAt > 4500) {
    opticalBpm = 0.0;
  }

  return opticalBpm;
}

float estimateSpo2(long redValue, long irValue) {
  if (!maxReady || irValue < 50000 || redValue <= 0) return 0.0;
  float ratio = float(redValue) / float(irValue);
  return constrain(110.0 - 25.0 * ratio, 70.0, 100.0);
}

String piezoKey(const char* prefix, uint8_t index) {
  return String(prefix) + String(index);
}

int findPiezoIndex(String target) {
  target.trim();
  target.toLowerCase();
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    String id = String(piezoCal[i].id);
    id.toLowerCase();
    if (target == id || target == String(i)) return i;
  }
  return -1;
}

void savePiezoCalibration(uint8_t index) {
  if (index >= PIEZO_SENSOR_COUNT) return;
  piezoPrefs.putUShort(piezoKey("idle", index).c_str(), piezoCal[index].idleRaw);
  piezoPrefs.putUShort(piezoKey("noise", index).c_str(), piezoCal[index].noiseFloor);
  piezoPrefs.putUShort(piezoKey("scale", index).c_str(), piezoCal[index].fullScaleDelta);
  piezoPrefs.putFloat(piezoKey("gain", index).c_str(), piezoCal[index].gain);
}

void savePiezoThreshold() {
  piezoPrefs.putUChar("threshold", piezoHitThreshold);
}

void applyDefaultPiezoSensitivity(bool keepIdle = true) {
  piezoHitThreshold = DEFAULT_PIEZO_HIT_THRESHOLD;
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    if (!keepIdle) piezoCal[i].idleRaw = 0;
    piezoCal[i].noiseFloor = DEFAULT_PIEZO_NOISE_FLOOR;
    piezoCal[i].fullScaleDelta = DEFAULT_PIEZO_FULL_SCALE_DELTA;
    piezoCal[i].gain = DEFAULT_PIEZO_GAIN;
    savePiezoCalibration(i);
  }
  savePiezoThreshold();
  piezoPrefs.putUChar("calVersion", PIEZO_CAL_VERSION);
}

void loadPiezoCalibration() {
  piezoPrefs.begin("piezo-cal", false);
  uint8_t storedVersion = piezoPrefs.getUChar("calVersion", 0);
  piezoHitThreshold = piezoPrefs.getUChar("threshold", DEFAULT_PIEZO_HIT_THRESHOLD);
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    piezoCal[i].idleRaw = piezoPrefs.getUShort(piezoKey("idle", i).c_str(), piezoCal[i].idleRaw);
    piezoCal[i].noiseFloor = piezoPrefs.getUShort(piezoKey("noise", i).c_str(), piezoCal[i].noiseFloor);
    piezoCal[i].fullScaleDelta = piezoPrefs.getUShort(piezoKey("scale", i).c_str(), piezoCal[i].fullScaleDelta);
    piezoCal[i].gain = piezoPrefs.getFloat(piezoKey("gain", i).c_str(), piezoCal[i].gain);
    if (piezoCal[i].fullScaleDelta < 20) piezoCal[i].fullScaleDelta = 20;
    if (piezoCal[i].gain <= 0.0f) piezoCal[i].gain = 1.0f;
  }
  if (storedVersion != PIEZO_CAL_VERSION) {
    applyDefaultPiezoSensitivity(true);
  }
}

void setupPiezoInputs() {
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    pinMode(piezoCal[i].pin, INPUT);
    analogSetPinAttenuation(piezoCal[i].pin, ADC_11db);
  }
}

uint16_t readPiezoPeakDelta(uint8_t index, uint16_t* rawPeakOut = nullptr) {
  if (index >= PIEZO_SENSOR_COUNT) return 0;

  uint16_t rawPeak = 0;
  uint16_t deltaPeak = 0;
  const uint8_t sampleCount = 24;

  for (uint8_t sample = 0; sample < sampleCount; sample++) {
    uint16_t raw = analogRead(piezoCal[index].pin);
    uint16_t delta = raw > piezoCal[index].idleRaw
                       ? raw - piezoCal[index].idleRaw
                       : piezoCal[index].idleRaw - raw;

    if (raw > rawPeak) rawPeak = raw;
    if (delta > deltaPeak) deltaPeak = delta;
    delayMicroseconds(250);
  }

  if (rawPeakOut) *rawPeakOut = rawPeak;
  return deltaPeak;
}

int piezoPercentFromDelta(uint8_t index, uint16_t deltaPeak) {
  if (deltaPeak <= piezoCal[index].noiseFloor) return 0;

  float adjusted = float(deltaPeak - piezoCal[index].noiseFloor);
  float percent = (adjusted / float(piezoCal[index].fullScaleDelta)) * 100.0f * piezoCal[index].gain;
  if (percent < 0.0f) percent = 0.0f;
  if (percent > 100.0f) percent = 100.0f;
  return int(percent + 0.5f);
}

int piezoPercent(uint8_t index, uint16_t* rawPeakOut = nullptr, uint16_t* deltaPeakOut = nullptr) {
  uint16_t deltaPeak = readPiezoPeakDelta(index, rawPeakOut);
  if (deltaPeakOut) *deltaPeakOut = deltaPeak;
  return piezoPercentFromDelta(index, deltaPeak);
}

void samplePiezoSensors() {
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    uint16_t raw = analogRead(piezoCal[i].pin);
    uint16_t delta = raw > piezoCal[i].idleRaw
                       ? raw - piezoCal[i].idleRaw
                       : piezoCal[i].idleRaw - raw;

    if (raw > piezoLatchedRaw[i]) piezoLatchedRaw[i] = raw;
    if (delta > piezoLatchedDelta[i]) piezoLatchedDelta[i] = delta;
  }
}

void consumePiezoLatch(int values[], uint16_t rawPeaks[], uint16_t deltaPeaks[]) {
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    rawPeaks[i] = piezoLatchedRaw[i];
    deltaPeaks[i] = piezoLatchedDelta[i];
    values[i] = piezoPercentFromDelta(i, deltaPeaks[i]);
    piezoLatchedRaw[i] = 0;
    piezoLatchedDelta[i] = 0;
  }
}

void printPiezoHelp() {
  Serial.println("Piezo calibration commands:");
  Serial.println("  piezo show");
  Serial.println("  piezo zero                 -> calibrate idle baseline for all sensors");
  Serial.println("  piezo sens all 1.5          -> increase sensitivity for all sensors");
  Serial.println("  piezo sens leftArm 2.0      -> set one sensor gain");
  Serial.println("  piezo scale all 2000        -> lower value = more sensitive");
  Serial.println("  piezo noise all 12          -> ignore small noise");
  Serial.println("  piezo threshold 20          -> impact threshold in percent");
  Serial.println("  piezo sensitive             -> apply very sensitive defaults");
  Serial.println("  piezo reset                 -> factory defaults");
  Serial.println("Sensor ids: rightArm, leftArm, rightLeg, leftLeg, chest");
}

void printPiezoCalibration() {
  Serial.println("Piezo calibration:");
  Serial.print("threshold=");
  Serial.println(piezoHitThreshold);
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    uint16_t rawPeak = 0;
    uint16_t deltaPeak = 0;
    int percent = piezoPercent(i, &rawPeak, &deltaPeak);
    Serial.print(piezoCal[i].id);
    Serial.print(" pin=");
    Serial.print(piezoCal[i].pin);
    Serial.print(" raw=");
    Serial.print(rawPeak);
    Serial.print(" delta=");
    Serial.print(deltaPeak);
    Serial.print(" pct=");
    Serial.print(percent);
    Serial.print(" idle=");
    Serial.print(piezoCal[i].idleRaw);
    Serial.print(" noise=");
    Serial.print(piezoCal[i].noiseFloor);
    Serial.print(" scale=");
    Serial.print(piezoCal[i].fullScaleDelta);
    Serial.print(" gain=");
    Serial.println(piezoCal[i].gain, 2);
  }
}

void autoZeroPiezo() {
  Serial.println("Piezo auto-zero: do not touch sensors for 2 seconds...");
  const uint16_t samples = 320;
  uint32_t sums[PIEZO_SENSOR_COUNT] = { 0, 0, 0, 0, 0 };
  uint16_t mins[PIEZO_SENSOR_COUNT] = { 4095, 4095, 4095, 4095, 4095 };
  uint16_t maxs[PIEZO_SENSOR_COUNT] = { 0, 0, 0, 0, 0 };

  for (uint16_t sample = 0; sample < samples; sample++) {
    for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
      uint16_t raw = analogRead(piezoCal[i].pin);
      sums[i] += raw;
      if (raw < mins[i]) mins[i] = raw;
      if (raw > maxs[i]) maxs[i] = raw;
    }
    delay(6);
  }

  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    piezoCal[i].idleRaw = uint16_t(sums[i] / samples);
    uint16_t idleNoise = maxs[i] - mins[i];
    piezoCal[i].noiseFloor = idleNoise + 2;
    if (piezoCal[i].noiseFloor < DEFAULT_PIEZO_NOISE_FLOOR) {
      piezoCal[i].noiseFloor = DEFAULT_PIEZO_NOISE_FLOOR;
    }
    savePiezoCalibration(i);
  }

  Serial.println("Piezo auto-zero saved.");
  printPiezoCalibration();
}

void resetPiezoCalibration() {
  piezoPrefs.clear();
  for (uint8_t i = 0; i < PIEZO_SENSOR_COUNT; i++) {
    piezoCal[i].idleRaw = 0;
  }
  applyDefaultPiezoSensitivity(false);
  Serial.println("Piezo calibration reset.");
  printPiezoCalibration();
}

void applyPiezoFloatSetting(String target, float value, char setting) {
  bool all = target == "all";
  int index = all ? 0 : findPiezoIndex(target);
  if (!all && index < 0) {
    Serial.println("Unknown piezo sensor. Use: rightArm, leftArm, rightLeg, leftLeg, chest, all");
    return;
  }

  uint8_t start = all ? 0 : index;
  uint8_t end = all ? PIEZO_SENSOR_COUNT : index + 1;
  for (uint8_t i = start; i < end; i++) {
    if (setting == 'g') piezoCal[i].gain = constrain(value, 0.1f, 8.0f);
    savePiezoCalibration(i);
  }
  printPiezoCalibration();
}

void applyPiezoIntSetting(String target, uint16_t value, char setting) {
  bool all = target == "all";
  int index = all ? 0 : findPiezoIndex(target);
  if (!all && index < 0) {
    Serial.println("Unknown piezo sensor. Use: rightArm, leftArm, rightLeg, leftLeg, chest, all");
    return;
  }

  uint8_t start = all ? 0 : index;
  uint8_t end = all ? PIEZO_SENSOR_COUNT : index + 1;
  for (uint8_t i = start; i < end; i++) {
    if (setting == 's') piezoCal[i].fullScaleDelta = constrain(value, 20, 4095);
    if (setting == 'n') piezoCal[i].noiseFloor = constrain(value, 0, 1000);
    savePiezoCalibration(i);
  }
  printPiezoCalibration();
}

void processSerialCommand(String command) {
  command.trim();
  if (command.length() == 0) return;

  String lower = command;
  lower.toLowerCase();

  if (lower == "piezo help" || lower == "help") {
    printPiezoHelp();
    return;
  }

  if (lower == "piezo show" || lower == "piezo") {
    printPiezoCalibration();
    return;
  }

  if (lower == "piezo zero") {
    autoZeroPiezo();
    return;
  }

  if (lower == "piezo reset") {
    resetPiezoCalibration();
    return;
  }

  if (lower == "piezo sensitive") {
    applyDefaultPiezoSensitivity(true);
    Serial.println("Very sensitive piezo defaults applied.");
    printPiezoCalibration();
    return;
  }

  if (lower.startsWith("piezo threshold ")) {
    int value = lower.substring(16).toInt();
    piezoHitThreshold = constrain(value, 1, 100);
    savePiezoThreshold();
    printPiezoCalibration();
    return;
  }

  if (lower.startsWith("piezo sens ") || lower.startsWith("piezo scale ") || lower.startsWith("piezo noise ")) {
    int commandEnd = lower.indexOf(' ', 6);
    int targetEnd = lower.indexOf(' ', commandEnd + 1);
    if (commandEnd < 0 || targetEnd < 0) {
      printPiezoHelp();
      return;
    }

    String action = lower.substring(6, commandEnd);
    String target = lower.substring(commandEnd + 1, targetEnd);
    String valueText = lower.substring(targetEnd + 1);

    if (action == "sens") {
      applyPiezoFloatSetting(target, valueText.toFloat(), 'g');
      return;
    }

    if (action == "scale") {
      applyPiezoIntSetting(target, uint16_t(valueText.toInt()), 's');
      return;
    }

    if (action == "noise") {
      applyPiezoIntSetting(target, uint16_t(valueText.toInt()), 'n');
      return;
    }
  }

  Serial.println("Unknown command.");
  printPiezoHelp();
}

void handleSerialCommands() {
  while (Serial.available() > 0) {
    char c = char(Serial.read());
    if (c == '\r') continue;
    if (c == '\n') {
      processSerialCommand(serialLine);
      serialLine = "";
      continue;
    }

    if (serialLine.length() < 120) {
      serialLine += c;
    }
  }
}

String jsonFloat(float value, int decimals) {
  if (isnan(value) || isinf(value)) return "0";
  return String(value, decimals);
}

void recordEcgWaveSample(uint16_t sample) {
  ecgWaveSamples[ecgWaveIndex] = sample;
  ecgWaveIndex = (ecgWaveIndex + 1) % ECG_WAVE_SAMPLE_COUNT;
  if (ecgWaveFilled < ECG_WAVE_SAMPLE_COUNT) {
    ecgWaveFilled += 1;
  }
}

String makeEcgWaveJson() {
  String wave = "[";
  uint8_t count = ecgWaveFilled;
  uint8_t start = (ecgWaveIndex + ECG_WAVE_SAMPLE_COUNT - count) % ECG_WAVE_SAMPLE_COUNT;

  for (uint8_t i = 0; i < count; i++) {
    if (i > 0) wave += ",";
    wave += String(ecgWaveSamples[(start + i) % ECG_WAVE_SAMPLE_COUNT]);
  }

  wave += "]";
  return wave;
}

// Global variables to hold the latest high-frequency samples
int currentEcgSample = 0;
long currentIrValue = 0;
long currentRedValue = 0;
float currentSensorTemp = 0.0;
MotionData currentMotion;

String makeTelemetryJson() {
  // Read low-frequency data here, but use globals for high-frequency data
  bool fingerDetected = currentIrValue > 50000;
  float selectedBpm = opticalBpm > 0 ? opticalBpm : ecgBpm;
  float spo2 = estimateSpo2(currentRedValue, currentIrValue);

  float accelMagnitude = sqrt(currentMotion.ax * currentMotion.ax + currentMotion.ay * currentMotion.ay + currentMotion.az * currentMotion.az);
  float gyroMagnitude = sqrt(currentMotion.gx * currentMotion.gx + currentMotion.gy * currentMotion.gy + currentMotion.gz * currentMotion.gz);

  int piezoValues[PIEZO_SENSOR_COUNT];
  uint16_t piezoRaw[PIEZO_SENSOR_COUNT];
  uint16_t piezoDelta[PIEZO_SENSOR_COUNT];
  consumePiezoLatch(piezoValues, piezoRaw, piezoDelta);

  packetCount += 1;

  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"board\":\"ESP32\",";
  payload += "\"packets\":" + String(packetCount) + ",";
  payload += "\"ecg\":" + String(currentEcgSample) + ",";
  payload += "\"ecgWave\":" + makeEcgWaveJson() + ",";
  payload += "\"leadOff\":" + String(ecgLeadOff ? "true" : "false") + ",";
  payload += "\"bpm\":" + jsonFloat(selectedBpm, 1) + ",";
  payload += "\"bpmEcg\":" + jsonFloat(ecgBpm, 1) + ",";
  payload += "\"bpmOptical\":" + jsonFloat(opticalBpm, 1) + ",";
  payload += "\"spo2\":" + jsonFloat(spo2, 1) + ",";
  payload += "\"temp\":" + jsonFloat(currentSensorTemp, 1) + ",";
  payload += "\"respiration\":0,";
  payload += "\"gpsValid\":false,";
  payload += "\"latitude\":0,";
  payload += "\"longitude\":0,";
  payload += "\"max30102\":{";
  payload += "\"ir\":" + String(currentIrValue) + ",";
  payload += "\"red\":" + String(currentRedValue) + ",";
  payload += "\"fingerDetected\":" + String(fingerDetected ? "true" : "false") + ",";
  payload += "\"bpm\":" + jsonFloat(opticalBpm, 1) + ",";
  payload += "\"spo2\":" + jsonFloat(spo2, 1) + ",";
  payload += "\"temperature\":" + jsonFloat(currentSensorTemp, 1);
  payload += "},";
  payload += "\"motion\":{";
  payload += "\"accel\":{\"x\":" + jsonFloat(currentMotion.ax, 3) + ",\"y\":" + jsonFloat(currentMotion.ay, 3) + ",\"z\":" + jsonFloat(currentMotion.az, 3) + "},";
  payload += "\"gyro\":{\"x\":" + jsonFloat(currentMotion.gx, 2) + ",\"y\":" + jsonFloat(currentMotion.gy, 2) + ",\"z\":" + jsonFloat(currentMotion.gz, 2) + "},";
  payload += "\"accelMagnitude\":" + jsonFloat(accelMagnitude, 3) + ",";
  payload += "\"gyroMagnitude\":" + jsonFloat(gyroMagnitude, 2);
  payload += "},";
  payload += "\"piezo\":{";
  payload += "\"rightArm\":" + String(piezoValues[0]) + ",";
  payload += "\"leftArm\":" + String(piezoValues[1]) + ",";
  payload += "\"rightLeg\":" + String(piezoValues[2]) + ",";
  payload += "\"leftLeg\":" + String(piezoValues[3]) + ",";
  payload += "\"chest\":" + String(piezoValues[4]) + ",";
  payload += "\"rightArmHit\":" + String(piezoValues[0] >= piezoHitThreshold ? "true" : "false") + ",";
  payload += "\"leftArmHit\":" + String(piezoValues[1] >= piezoHitThreshold ? "true" : "false") + ",";
  payload += "\"rightLegHit\":" + String(piezoValues[2] >= piezoHitThreshold ? "true" : "false") + ",";
  payload += "\"leftLegHit\":" + String(piezoValues[3] >= piezoHitThreshold ? "true" : "false") + ",";
  payload += "\"chestHit\":" + String(piezoValues[4] >= piezoHitThreshold ? "true" : "false");
  payload += "},";
  payload += "\"piezoRaw\":{";
  payload += "\"rightArm\":" + String(piezoRaw[0]) + ",";
  payload += "\"leftArm\":" + String(piezoRaw[1]) + ",";
  payload += "\"rightLeg\":" + String(piezoRaw[2]) + ",";
  payload += "\"leftLeg\":" + String(piezoRaw[3]) + ",";
  payload += "\"chest\":" + String(piezoRaw[4]);
  payload += "},";
  payload += "\"piezoDelta\":{";
  payload += "\"rightArm\":" + String(piezoDelta[0]) + ",";
  payload += "\"leftArm\":" + String(piezoDelta[1]) + ",";
  payload += "\"rightLeg\":" + String(piezoDelta[2]) + ",";
  payload += "\"leftLeg\":" + String(piezoDelta[3]) + ",";
  payload += "\"chest\":" + String(piezoDelta[4]);
  payload += "},";
  payload += "\"piezoCalibration\":{";
  payload += "\"threshold\":" + String(piezoHitThreshold) + ",";
  payload += "\"rightArm\":{\"idle\":" + String(piezoCal[0].idleRaw) + ",\"noise\":" + String(piezoCal[0].noiseFloor) + ",\"scale\":" + String(piezoCal[0].fullScaleDelta) + ",\"gain\":" + jsonFloat(piezoCal[0].gain, 2) + "},";
  payload += "\"leftArm\":{\"idle\":" + String(piezoCal[1].idleRaw) + ",\"noise\":" + String(piezoCal[1].noiseFloor) + ",\"scale\":" + String(piezoCal[1].fullScaleDelta) + ",\"gain\":" + jsonFloat(piezoCal[1].gain, 2) + "},";
  payload += "\"rightLeg\":{\"idle\":" + String(piezoCal[2].idleRaw) + ",\"noise\":" + String(piezoCal[2].noiseFloor) + ",\"scale\":" + String(piezoCal[2].fullScaleDelta) + ",\"gain\":" + jsonFloat(piezoCal[2].gain, 2) + "},";
  payload += "\"leftLeg\":{\"idle\":" + String(piezoCal[3].idleRaw) + ",\"noise\":" + String(piezoCal[3].noiseFloor) + ",\"scale\":" + String(piezoCal[3].fullScaleDelta) + ",\"gain\":" + jsonFloat(piezoCal[3].gain, 2) + "},";
  payload += "\"chest\":{\"idle\":" + String(piezoCal[4].idleRaw) + ",\"noise\":" + String(piezoCal[4].noiseFloor) + ",\"scale\":" + String(piezoCal[4].fullScaleDelta) + ",\"gain\":" + jsonFloat(piezoCal[4].gain, 2) + "}";
  payload += "},";
  payload += "\"battery\":100,";
  payload += "\"signal\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  payload += "}";

  return payload;
}

void postTelemetry(const String& payload) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  if (WiFi.status() != WL_CONNECTED) return;
  if (serverUrl.length() == 0 && !discoverServer()) {
    serverUrl = String(FALLBACK_SERVER_URL);
    Serial.print("Using fallback server: ");
    Serial.println(serverUrl);
  }

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(payload);

  Serial.print("POST ");
  Serial.println(statusCode);

  if (statusCode == 200) {
    String response = http.getString();
    String cmd = findJsonString(response, "command", "");
    if (cmd.length() > 0) {
      Serial.print("Executing received command: ");
      Serial.println(cmd);
      processSerialCommand(cmd);
    }
  }
  http.end();

  if (statusCode <= 0 || statusCode >= 500) {
    serverUrl = "";
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  loadPiezoCalibration();

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  setupPiezoInputs();

  pinMode(LEAD_OFF_PLUS_PIN, INPUT);
  pinMode(LEAD_OFF_MINUS_PIN, INPUT);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(400000);

  maxReady = max30102.begin(Wire, I2C_SPEED_FAST);
  if (maxReady) {
    max30102.setup(0x1F, 4, 2, 100, 411, 4096);
    max30102.setPulseAmplitudeRed(0x24);
    max30102.setPulseAmplitudeIR(0x24);
    max30102.setPulseAmplitudeGreen(0);
  }

  mpuReady = initMpu();
  connectWifi();
  discoverServer();

  Serial.print("{\"status\":\"ready\",\"deviceId\":\"");
  Serial.print(DEVICE_ID);
  Serial.print("\",\"max30102\":");
  Serial.print(maxReady ? "true" : "false");
  Serial.print(",\"mpu\":");
  Serial.print(mpuReady ? "true" : "false");
  Serial.println("}");
  printPiezoHelp();
}

void loop() {
  samplePiezoSensors();
  handleSerialCommands();

  unsigned long now = millis();

  // HIGH-FREQUENCY SAMPLING (approx 200Hz for ECG)
  if (now - lastEcgSampleTime >= 5) {
    lastEcgSampleTime = now;
    currentEcgSample = analogRead(ECG_PIN);
    recordEcgWaveSample(currentEcgSample);
    bool loState = digitalRead(LEAD_OFF_PLUS_PIN) == HIGH || digitalRead(LEAD_OFF_MINUS_PIN) == HIGH;
    processEcgSample(currentEcgSample, loState);
  }

  if (maxReady) {
    // max30102.getIR() may block slightly to wait for a sample, which perfectly paces the loop
    currentIrValue = max30102.getIR();
    currentRedValue = max30102.getRed();
    updateOpticalBpm(currentIrValue);
    currentSensorTemp = max30102.readTemperature();
  }

  if (mpuReady) {
    currentMotion = readMotion();
  }

  // 1Hz JSON TELEMETRY EMISSION
  if (millis() - lastPostAt >= 1000) {
    lastPostAt = millis();
    String payload = makeTelemetryJson();
    Serial.println(payload);
    postTelemetry(payload);
  }

  delay(6);
}
