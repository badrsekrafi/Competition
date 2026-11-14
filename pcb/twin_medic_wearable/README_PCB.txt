TWIN-MEDIC WEARABLE KICAD PROJECT
====================================

Generated files:
- twin_medic_wearable.kicad_pro
- twin_medic_wearable.kicad_sch
- twin_medic_wearable.kicad_pcb

Board concept:
- Wearable V1 ESP32 DevKit carrier board
- 85 mm x 55 mm rounded board outline
- 2-layer FR4, 1.2 mm target thickness
- Connectors for AD8232, MAX30102, MPU-9250/6500, 5 analog piezo modules
- Analog protection footprints: 1k series resistors, piezo pulldowns, filter capacitors
- I2C pullups included

Important:
- This is a first-pass PCB layout, ready to open and continue in KiCad.
- Check exact ESP32 DevKit pin order against your physical board before manufacturing.
- Keep sensors at 3.3V logic.
- Do not use as a certified medical device.
