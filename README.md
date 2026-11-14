# Twin-Medic

Prototype for the CRM DefHACK 2026 Twin-Medic challenge.

Twin-Medic is a field-oriented digital twin dashboard for military medical monitoring. It simulates live combatant biometrics, forecasts short-term deterioration, compares observed and predicted curves, and recommends medical interventions.

## Features

- Live patient digital twin with six biometric streams
- Hardware mode for ESP32 + AD8232 ECG + 5 piezo sensors + GY-MAX30102 + MPU-9250/6500 telemetry
- Scenario simulation for heat stress, hemorrhage, respiratory distress, infection onset, and baseline patrol
- Fifteen-minute prediction horizon
- Risk score and operational triage band
- Deviation alerts comparing current state against forecasted state
- Recommendation engine for fluids, cooling, oxygen, hemorrhage control, screening, and evacuation
- Architecture and five-minute pitch views aligned with the CRM DefHACK scoring criteria

## Run

For simulator-only development:

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

For live ESP32 telemetry, run the API server and the dashboard in two terminals:

```bash
npm run dev:api
```

```bash
npm run dev
```

The ESP32 discovers the laptop automatically and posts JSON telemetry to:

```text
http://AUTO_DISCOVERED_LAPTOP_IP:8787/api/telemetry
```

## Optional Python AI service

For a more professional AI architecture, Twin-Medic can run an optional Python
inference service. The dashboard remains stable if this service is offline
because the modular JavaScript model is still used as a fallback.

Terminal 1:

```bash
npm run dev:ai
```

Terminal 2:

```powershell
$env:AI_SERVICE_URL="http://127.0.0.1:8790"
npm run dev:api
```

Terminal 3:

```bash
npm run dev
```

The Python service exposes:

```text
GET  http://127.0.0.1:8790/health
GET  http://127.0.0.1:8790/models
POST http://127.0.0.1:8790/predict
```

The Node API also exposes a proxy-style AI status endpoint for the dashboard or
for a jury demo:

```text
GET http://127.0.0.1:8787/api/ai-status
```

It currently provides a dependency-light hybrid risk model and is structured so
Transformer adapters such as MOMENT, Chronos, ECG-FM, PaPaGei or TabPFN can be
added without rewriting the React interface.

## ESP32 Hardware

Firmware sketch:

```text
firmware/twin_medic_esp32/twin_medic_esp32.ino
```

Default wiring:

| Module | Signal | ESP32 |
| --- | --- | --- |
| AD8232 | OUT | GPIO34 |
| AD8232 | LO+ | GPIO25 |
| AD8232 | LO- | GPIO26 |
| AD8232 | 3.3V | 3V3 |
| AD8232 | GND | GND |
| Piezo bras droit | Analog | GPIO35 |
| Piezo bras gauche | Analog | GPIO32 |
| Piezo jambe/pied droit | Analog | GPIO33 |
| Piezo jambe/pied gauche | Analog | GPIO36 |
| Piezo poitrine | Analog | GPIO39 |
| GY-MAX30102 | SDA | GPIO21 |
| GY-MAX30102 | SCL | GPIO22 |
| GY-MAX30102 | VIN | 3V3 |
| GY-MAX30102 | GND | GND |
| MPU-9250 / MPU-6500 | SDA | GPIO21 |
| MPU-9250 / MPU-6500 | SCL | GPIO22 |
| MPU-9250 / MPU-6500 | VCC | 3V3 |
| MPU-9250 / MPU-6500 | GND | GND |

Important: power analog piezo vibration modules from 3.3V when using ESP32 ADC inputs. Do not feed a 5V analog output into the ESP32. ADC1 pins are more reliable for analog sensors because ESP32 ADC2 can conflict with WiFi. Add suitable resistor/protection conditioning if you use bare piezo discs; analog modules usually include conditioning circuitry. The MAX30102 SpO2 value in the demo firmware is a prototype estimate and needs calibration for serious use.

In the sketch, edit only the WiFi credentials:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

The ESP32 discovers the laptop server automatically over UDP port 8788, then posts telemetry to HTTP port 8787. Start `npm run dev:api` before powering the ESP32. If discovery fails, the sketch uses `FALLBACK_SERVER_URL` only as a backup.

Arduino IDE setup:

- Board: ESP32 Dev Module or your exact ESP32 board
- Library: SparkFun MAX3010x Pulse and Proximity Sensor Library
- I2C bus: SDA GPIO21, SCL GPIO22
- Serial monitor: 115200

## Piezo calibration

Open the Arduino Serial Monitor at 115200 baud and set line ending to "Newline". The calibration is saved in ESP32 flash memory.

Useful commands:

```text
piezo show
piezo zero
piezo sensitive
piezo sens all 1.5
piezo sens leftArm 2.0
piezo scale all 350
piezo noise all 2
piezo threshold 20
piezo reset
```

Calibration workflow:

1. Keep all piezo sensors untouched.
2. Send `piezo zero`.
3. Tap one sensor and watch `/piezo-test`.
4. If values are too low, increase sensitivity with `piezo sens SENSOR_ID 4.0` or lower scale with `piezo scale SENSOR_ID 250`.
5. If values are too noisy at rest, increase noise with `piezo noise SENSOR_ID 10`.

Sensor IDs: `rightArm`, `leftArm`, `rightLeg`, `leftLeg`, `chest`.

The firmware is configured for very high sensitivity by default: threshold `20%`, gain `3.0`, scale `350`, noise `2`. It samples the analog piezo module outputs continuously and sends the strongest peak once per second, so short vibration pulses are not missed.

## Build

```bash
npm run build
```

The production files are emitted to `dist/`.
