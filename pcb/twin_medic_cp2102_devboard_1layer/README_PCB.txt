TWIN-MEDIC ESP32-WROOM-32 CP2102 DEVBOARD 1-LAYER CARRIER
=============================================================

This project is for the ready-made ESP32-WROOM-32 CP2102 development board, not the bare SMD WROOM module.

Design choices:
- 1-layer carrier/shield PCB
- Two 15-pin socket rows for a common 30-pin ESP32 DevKit V1 / CP2102 board
- No filter resistors
- No filter capacitors
- No piezo pulldown resistors
- Sensor connectors only

Critical warning:
Before ordering the PCB, compare the U1L/U1R pin order in KiCad with the silkscreen on your exact board. Some CP2102 ESP32 boards are 30-pin, others are 38-pin, and pin order can change by manufacturer.

Current assumed 30-pin mapping:
Left row: EN, GPIO36, GPIO39, GPIO34, GPIO35, GPIO32, GPIO33, GPIO25, GPIO26, GPIO27, GPIO14, GPIO12, GND, GPIO13, VIN
Right row: 3V3, GND, GPIO15, GPIO2, GPIO4, GPIO16, GPIO17, GPIO5, GPIO18, GPIO19, GPIO21, RX0, TX0, GPIO22, GPIO23

If your board has 19 pins per side, use the previous DevKit 38-pin project or ask to generate the 38-pin CP2102 version.
