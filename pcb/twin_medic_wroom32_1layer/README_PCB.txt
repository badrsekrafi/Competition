TWIN-MEDIC ESP32-WROOM-32 1-LAYER PCB
===========================================

This project is a simplified single-sided PCB for the user's available parts:
- ESP32-WROOM-32 bare module
- One copper layer only: F.Cu
- No analog filter resistors/capacitors
- No piezo pulldown resistors
- No onboard regulator or USB-UART

Generated files:
- twin_medic_wroom32_1layer.kicad_pro
- twin_medic_wroom32_1layer.kicad_sch
- twin_medic_wroom32_1layer.kicad_pcb

Important build rules:
1. Feed the board with clean regulated 3.3V only.
2. Do not connect a LiPo battery directly to 3V3.
3. Use an external 3.3V USB-TTL adapter for programming.
4. Connect EN to 3V3 with J11 to run.
5. Pull IO0 to GND with J12 while resetting/power-cycling to upload.
6. If your MAX30102/MPU modules do not include I2C pullups, the I2C bus may not work.
7. GPIO36 and GPIO39 can float more easily without pulldowns; expect more noise.

This is a prototype layout and must be reviewed in KiCad before manufacturing.
