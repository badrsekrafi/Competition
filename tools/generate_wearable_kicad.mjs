import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rootDir = path.resolve("pcb", "twin_medic_wearable");
fs.mkdirSync(rootDir, { recursive: true });

const projectName = "twin_medic_wearable";
const pcbPath = path.join(rootDir, `${projectName}.kicad_pcb`);
const schPath = path.join(rootDir, `${projectName}.kicad_sch`);
const proPath = path.join(rootDir, `${projectName}.kicad_pro`);
const readmePath = path.join(rootDir, "README_PCB.txt");

function uuid() {
  return crypto.randomUUID();
}

const nets = [
  "",
  "GND",
  "3V3",
  "VIN_5V",
  "BAT+",
  "EN",
  "GPIO0_BOOT",
  "GPIO34_ECG_OUT",
  "GPIO25_ECG_LOP",
  "GPIO26_ECG_LOM",
  "GPIO35_PIEZO_RA",
  "GPIO32_PIEZO_LA",
  "GPIO33_PIEZO_RL",
  "GPIO36_PIEZO_LL",
  "GPIO39_PIEZO_CHEST",
  "GPIO21_SDA",
  "GPIO22_SCL",
  "GPIO16_GPS_RX",
  "GPIO17_GPS_TX",
  "ECG_OUT_RAW",
  "PIEZO_RA_AO",
  "PIEZO_LA_AO",
  "PIEZO_RL_AO",
  "PIEZO_LL_AO",
  "PIEZO_CHEST_AO",
  "MAX_INT",
  "MPU_INT",
];

const netId = Object.fromEntries(nets.map((name, index) => [name, index]));

function n(name) {
  if (!name) return "";
  return `(net ${netId[name]} "${name}")`;
}

function property(name, value, x, y, layer = "F.Fab", hide = false) {
  return `\t\t(property "${name}" "${value}"
\t\t\t(at ${x} ${y} 0)
\t\t\t${hide ? "(unlocked yes)\n\t\t\t" : ""}(layer "${layer}")
\t\t\t${hide ? "(hide yes)\n\t\t\t" : ""}(uuid "${uuid()}")
\t\t\t(effects
\t\t\t\t(font
\t\t\t\t\t(size 1 1)
\t\t\t\t\t(thickness 0.15)
\t\t\t\t)
\t\t\t)
\t\t)`;
}

function fpLine(x1, y1, x2, y2, layer = "F.SilkS", width = 0.12) {
  return `\t\t(fp_line
\t\t\t(start ${x1} ${y1})
\t\t\t(end ${x2} ${y2})
\t\t\t(stroke (width ${width}) (type solid))
\t\t\t(layer "${layer}")
\t\t\t(uuid "${uuid()}")
\t\t)`;
}

function footprintHeader({ ref, value, x, y, pins, pitch = 2.54, orientation = "vertical", rotation = 0 }) {
  const vertical = orientation === "vertical";
  const fpName = `Connector_PinHeader_2.54mm:PinHeader_1x${String(pins.length).padStart(2, "0")}_P2.54mm_${vertical ? "Vertical" : "Horizontal"}`;
  const w = vertical ? 3.2 : (pins.length - 1) * pitch + 3.2;
  const h = vertical ? (pins.length - 1) * pitch + 3.2 : 3.2;
  const lines = [
    `(footprint "${fpName}"`,
    `\t(layer "F.Cu")`,
    `\t(uuid "${uuid()}")`,
    `\t(at ${x} ${y} ${rotation})`,
    property("Reference", ref, 0, -2.8, "F.SilkS"),
    property("Value", value, 0, h, "F.Fab"),
    property("Datasheet", "", 0, 0, "F.Fab", true),
    property("Description", "", 0, 0, "F.Fab", true),
    `\t(path "/${uuid()}")`,
    `\t(attr through_hole)`,
    fpLine(-1.6, -1.6, w - 1.6, -1.6),
    fpLine(w - 1.6, -1.6, w - 1.6, h - 1.6),
    fpLine(w - 1.6, h - 1.6, -1.6, h - 1.6),
    fpLine(-1.6, h - 1.6, -1.6, -1.6),
  ];

  pins.forEach((pin, index) => {
    const px = vertical ? 0 : index * pitch;
    const py = vertical ? index * pitch : 0;
    const shape = index === 0 ? "rect" : "oval";
    const net = pin.net ? `\n\t\t\t${n(pin.net)}` : "";
    lines.push(`\t(pad "${index + 1}" thru_hole ${shape}
\t\t(at ${px} ${py} 0)
\t\t(size 1.7 1.7)
\t\t(drill 1)
\t\t(layers "*.Cu" "*.Mask")${net}
\t\t(pinfunction "${pin.fn || pin.name || `P${index + 1}`}")
\t\t(pintype "${pin.type || "passive"}")
\t\t(uuid "${uuid()}")
\t)`);
  });

  lines.push(`)`);
  return lines.join("\n");
}

function footprintR({ ref, value, x, y, net1, net2, rotation = 0 }) {
  return `(footprint "Resistor_SMD:R_0805_2012Metric"
\t(layer "F.Cu")
\t(uuid "${uuid()}")
\t(at ${x} ${y} ${rotation})
${property("Reference", ref, 0, -1.8, "F.SilkS")}
${property("Value", value, 0, 1.8, "F.Fab")}
${property("Datasheet", "", 0, 0, "F.Fab", true)}
${property("Description", "", 0, 0, "F.Fab", true)}
\t(path "/${uuid()}")
\t(attr smd)
${fpLine(-1.6, -0.9, 1.6, -0.9)}
${fpLine(-1.6, 0.9, 1.6, 0.9)}
\t(pad "1" smd roundrect
\t\t(at -0.95 0 ${rotation})
\t\t(size 1 1.35)
\t\t(layers "F.Cu" "F.Paste" "F.Mask")
\t\t(roundrect_rratio 0.2)
\t\t${n(net1)}
\t\t(pinfunction "1")
\t\t(pintype "passive")
\t\t(uuid "${uuid()}")
\t)
\t(pad "2" smd roundrect
\t\t(at 0.95 0 ${rotation})
\t\t(size 1 1.35)
\t\t(layers "F.Cu" "F.Paste" "F.Mask")
\t\t(roundrect_rratio 0.2)
\t\t${n(net2)}
\t\t(pinfunction "2")
\t\t(pintype "passive")
\t\t(uuid "${uuid()}")
\t)
)`;
}

function footprintC({ ref, value, x, y, net1, net2, rotation = 0 }) {
  return `(footprint "Capacitor_SMD:C_0805_2012Metric"
\t(layer "F.Cu")
\t(uuid "${uuid()}")
\t(at ${x} ${y} ${rotation})
${property("Reference", ref, 0, -1.8, "F.SilkS")}
${property("Value", value, 0, 1.8, "F.Fab")}
${property("Datasheet", "", 0, 0, "F.Fab", true)}
${property("Description", "", 0, 0, "F.Fab", true)}
\t(path "/${uuid()}")
\t(attr smd)
${fpLine(-1.6, -0.9, 1.6, -0.9)}
${fpLine(-1.6, 0.9, 1.6, 0.9)}
\t(pad "1" smd roundrect
\t\t(at -0.95 0 ${rotation})
\t\t(size 1 1.35)
\t\t(layers "F.Cu" "F.Paste" "F.Mask")
\t\t(roundrect_rratio 0.2)
\t\t${n(net1)}
\t\t(pinfunction "1")
\t\t(pintype "passive")
\t\t(uuid "${uuid()}")
\t)
\t(pad "2" smd roundrect
\t\t(at 0.95 0 ${rotation})
\t\t(size 1 1.35)
\t\t(layers "F.Cu" "F.Paste" "F.Mask")
\t\t(roundrect_rratio 0.2)
\t\t${n(net2)}
\t\t(pinfunction "2")
\t\t(pintype "passive")
\t\t(uuid "${uuid()}")
\t)
)`;
}

function mountingHole(ref, x, y) {
  return `(footprint "MountingHole:MountingHole_2.7mm_M2.5"
\t(layer "F.Cu")
\t(uuid "${uuid()}")
\t(at ${x} ${y})
${property("Reference", ref, 0, -3, "F.SilkS")}
${property("Value", "M2.5", 0, 3, "F.Fab")}
\t(attr exclude_from_pos_files exclude_from_bom)
\t(pad "" np_thru_hole circle
\t\t(at 0 0)
\t\t(size 4.8 4.8)
\t\t(drill 2.7)
\t\t(layers "*.Cu" "*.Mask")
\t\t(uuid "${uuid()}")
\t)
)`;
}

function grLine(x1, y1, x2, y2, layer = "Edge.Cuts", width = 0.1) {
  return `\t(gr_line
\t\t(start ${x1} ${y1})
\t\t(end ${x2} ${y2})
\t\t(stroke (width ${width}) (type solid))
\t\t(layer "${layer}")
\t\t(uuid "${uuid()}")
\t)`;
}

function grArc(start, mid, end, layer = "Edge.Cuts", width = 0.1) {
  return `\t(gr_arc
\t\t(start ${start[0]} ${start[1]})
\t\t(mid ${mid[0]} ${mid[1]})
\t\t(end ${end[0]} ${end[1]})
\t\t(stroke (width ${width}) (type solid))
\t\t(layer "${layer}")
\t\t(uuid "${uuid()}")
\t)`;
}

function grText(text, x, y, size = 1.4, layer = "F.SilkS", justify = "") {
  const escaped = text.replace(/"/g, "'");
  return `\t(gr_text "${escaped}"
\t\t(at ${x} ${y} 0)
\t\t(layer "${layer}")
\t\t(uuid "${uuid()}")
\t\t(effects
\t\t\t(font (size ${size} ${size}) (thickness ${Math.max(0.12, size * 0.12).toFixed(2)}))
\t\t\t${justify ? `(justify ${justify})` : ""}
\t\t)
\t)`;
}

function segment(x1, y1, x2, y2, net, layer = "F.Cu", width = 0.25) {
  return `\t(segment
\t\t(start ${x1} ${y1})
\t\t(end ${x2} ${y2})
\t\t(width ${width})
\t\t(layer "${layer}")
\t\t(net ${netId[net]})
\t\t(uuid "${uuid()}")
\t)`;
}

const espLeftPins = [
  { name: "3V3", net: "3V3", type: "power_in" },
  { name: "EN", net: "EN" },
  { name: "GPIO36", net: "GPIO36_PIEZO_LL" },
  { name: "GPIO39", net: "GPIO39_PIEZO_CHEST" },
  { name: "GPIO34", net: "GPIO34_ECG_OUT" },
  { name: "GPIO35", net: "GPIO35_PIEZO_RA" },
  { name: "GPIO32", net: "GPIO32_PIEZO_LA" },
  { name: "GPIO33", net: "GPIO33_PIEZO_RL" },
  { name: "GPIO25", net: "GPIO25_ECG_LOP" },
  { name: "GPIO26", net: "GPIO26_ECG_LOM" },
  { name: "GPIO27" },
  { name: "GPIO14" },
  { name: "GPIO12" },
  { name: "GND", net: "GND", type: "power_in" },
  { name: "GPIO13" },
  { name: "SD2" },
  { name: "SD3" },
  { name: "CMD" },
  { name: "VIN", net: "VIN_5V", type: "power_in" },
];

const espRightPins = [
  { name: "GND", net: "GND", type: "power_in" },
  { name: "GPIO23" },
  { name: "GPIO22", net: "GPIO22_SCL" },
  { name: "TX0" },
  { name: "RX0" },
  { name: "GPIO21", net: "GPIO21_SDA" },
  { name: "GND", net: "GND", type: "power_in" },
  { name: "GPIO19" },
  { name: "GPIO18" },
  { name: "GPIO5" },
  { name: "GPIO17", net: "GPIO17_GPS_TX" },
  { name: "GPIO16", net: "GPIO16_GPS_RX" },
  { name: "GPIO4" },
  { name: "GPIO0", net: "GPIO0_BOOT" },
  { name: "GPIO2" },
  { name: "GPIO15" },
  { name: "SD1" },
  { name: "SD0" },
  { name: "CLK" },
];

const footprints = [];

footprints.push(footprintHeader({
  ref: "U1L",
  value: "ESP32_DEVKIT_LEFT_SOCKET",
  x: 40,
  y: 14,
  pins: espLeftPins.map((p) => ({ ...p, fn: p.name })),
}));

footprints.push(footprintHeader({
  ref: "U1R",
  value: "ESP32_DEVKIT_RIGHT_SOCKET",
  x: 65,
  y: 14,
  pins: espRightPins.map((p) => ({ ...p, fn: p.name })),
}));

footprints.push(footprintHeader({
  ref: "J1",
  value: "LIPO_BAT",
  x: 19,
  y: 14,
  pins: [
    { name: "BAT+", fn: "BAT+", net: "BAT+", type: "power_in" },
    { name: "GND", fn: "GND", net: "GND", type: "power_in" },
  ],
  orientation: "horizontal",
}));

footprints.push(footprintHeader({
  ref: "J2",
  value: "CHARGER_5V_IN",
  x: 27,
  y: 61,
  pins: [
    { name: "VIN", fn: "VIN_5V", net: "VIN_5V", type: "power_in" },
    { name: "GND", fn: "GND", net: "GND", type: "power_in" },
  ],
  orientation: "horizontal",
}));

footprints.push(footprintHeader({
  ref: "J3",
  value: "AD8232_ECG",
  x: 88,
  y: 15,
  pins: [
    { fn: "3V3", net: "3V3", type: "power_out" },
    { fn: "GND", net: "GND", type: "power_out" },
    { fn: "OUT_RAW", net: "ECG_OUT_RAW" },
    { fn: "LO+", net: "GPIO25_ECG_LOP" },
    { fn: "LO-", net: "GPIO26_ECG_LOM" },
    { fn: "SDN_NC" },
  ],
}));

footprints.push(footprintHeader({
  ref: "J4",
  value: "MAX30102_I2C",
  x: 88,
  y: 34,
  pins: [
    { fn: "3V3", net: "3V3", type: "power_out" },
    { fn: "GND", net: "GND", type: "power_out" },
    { fn: "SDA", net: "GPIO21_SDA" },
    { fn: "SCL", net: "GPIO22_SCL" },
  ],
}));

footprints.push(footprintHeader({
  ref: "J5",
  value: "MPU9250_6500_I2C",
  x: 88,
  y: 48,
  pins: [
    { fn: "3V3", net: "3V3", type: "power_out" },
    { fn: "GND", net: "GND", type: "power_out" },
    { fn: "SDA", net: "GPIO21_SDA" },
    { fn: "SCL", net: "GPIO22_SCL" },
    { fn: "INT", net: "MPU_INT" },
  ],
}));

const piezoConnectors = [
  ["J6", "PIEZO_RIGHT_ARM", 15, 20, "PIEZO_RA_AO"],
  ["J7", "PIEZO_LEFT_ARM", 15, 29, "PIEZO_LA_AO"],
  ["J8", "PIEZO_RIGHT_LEG", 15, 38, "PIEZO_RL_AO"],
  ["J9", "PIEZO_LEFT_LEG", 15, 47, "PIEZO_LL_AO"],
  ["J10", "PIEZO_CHEST", 15, 56, "PIEZO_CHEST_AO"],
];

for (const [ref, value, x, y, aoNet] of piezoConnectors) {
  footprints.push(footprintHeader({
    ref,
    value,
    x,
    y,
    pins: [
      { fn: "3V3", net: "3V3", type: "power_out" },
      { fn: "GND", net: "GND", type: "power_out" },
      { fn: "AO", net: aoNet },
    ],
  }));
}

const analogProtection = [
  ["R1", "1k", 29, 24.2, "ECG_OUT_RAW", "GPIO34_ECG_OUT"],
  ["R2", "1k", 29, 26.7, "PIEZO_RA_AO", "GPIO35_PIEZO_RA"],
  ["R3", "1k", 29, 29.2, "PIEZO_LA_AO", "GPIO32_PIEZO_LA"],
  ["R4", "1k", 29, 31.8, "PIEZO_RL_AO", "GPIO33_PIEZO_RL"],
  ["R5", "1k", 29, 19.1, "PIEZO_LL_AO", "GPIO36_PIEZO_LL"],
  ["R6", "1k", 29, 21.6, "PIEZO_CHEST_AO", "GPIO39_PIEZO_CHEST"],
];

for (const [ref, value, x, y, net1, net2] of analogProtection) {
  footprints.push(footprintR({ ref, value, x, y, net1, net2 }));
}

const pulldowns = [
  ["R7", "1M", 35, 26.7, "GPIO35_PIEZO_RA", "GND"],
  ["R8", "1M", 35, 29.2, "GPIO32_PIEZO_LA", "GND"],
  ["R9", "1M", 35, 31.8, "GPIO33_PIEZO_RL", "GND"],
  ["R10", "1M", 35, 19.1, "GPIO36_PIEZO_LL", "GND"],
  ["R11", "1M", 35, 21.6, "GPIO39_PIEZO_CHEST", "GND"],
];

for (const [ref, value, x, y, net1, net2] of pulldowns) {
  footprints.push(footprintR({ ref, value, x, y, net1, net2 }));
}

const filters = [
  ["C1", "10nF", 24, 20, "GPIO34_ECG_OUT", "GND", 0],
  ["C2", "100nF", 24, 24, "GPIO35_PIEZO_RA", "GND", 0],
  ["C3", "100nF", 24, 28, "GPIO32_PIEZO_LA", "GND", 0],
  ["C4", "100nF", 24, 32, "GPIO33_PIEZO_RL", "GND", 0],
  ["C5", "100nF", 24, 36, "GPIO36_PIEZO_LL", "GND", 0],
  ["C6", "100nF", 24, 40, "GPIO39_PIEZO_CHEST", "GND", 0],
  ["C7", "100nF", 73, 22, "3V3", "GND", 0],
  ["C8", "10uF", 73, 25, "3V3", "GND", 0],
];

for (const [ref, value, x, y, net1, net2, rotation] of filters) {
  footprints.push(footprintC({ ref, value, x, y, net1, net2, rotation }));
}

footprints.push(footprintR({ ref: "R12", value: "4.7k", x: 75, y: 29, net1: "3V3", net2: "GPIO21_SDA" }));
footprints.push(footprintR({ ref: "R13", value: "4.7k", x: 75, y: 32, net1: "3V3", net2: "GPIO22_SCL" }));
footprints.push(mountingHole("H1", 30, 13.2));
footprints.push(mountingHole("H2", 82, 16));
footprints.push(mountingHole("H3", 34, 59));
footprints.push(mountingHole("H4", 82, 59));

const boardGraphics = [
  grLine(15, 10, 90, 10),
  grArc([90, 10], [93.535, 11.465], [95, 15]),
  grLine(95, 15, 95, 60),
  grArc([95, 60], [93.535, 63.535], [90, 65]),
  grLine(90, 65, 15, 65),
  grArc([15, 65], [11.465, 63.535], [10, 60]),
  grLine(10, 60, 10, 15),
  grArc([10, 15], [11.465, 11.465], [15, 10]),
  grText("TWIN-MEDIC WEARABLE PCB V1", 33, 11.8, 1.2),
  grText("ANTENNA KEEP CLEAR", 45, 63, 1.1),
  grText("3.3V SENSORS ONLY", 68, 12, 1.0),
  grText("GPIO36/39 INPUT ONLY", 68, 14.4, 0.9),
  grText("PIEZO", 12, 18, 0.8, "F.SilkS", "left"),
  grText("ECG", 84, 13, 0.8),
  grText("I2C", 85, 32, 0.8),
];

const guideGraphics = [
  grLine(10, 35, 95, 35, "Dwgs.User", 0.08),
  grLine(52.5, 10, 52.5, 65, "Dwgs.User", 0.08),
  grText("Body side: insulate before wearing", 22, 63, 0.8, "Cmts.User", "left"),
];

const roughRoutes = [];

const pcb = `(kicad_pcb
\t(version 20241229)
\t(generator "codex")
\t(generator_version "1.0")
\t(general
\t\t(thickness 1.2)
\t\t(legacy_teardrops no)
\t)
\t(paper "A4")
\t(title_block
\t\t(title "Twin-Medic Wearable ESP32 Carrier PCB")
\t\t(date "2026-06-07")
\t\t(rev "V1")
\t\t(company "Twin-Medic")
\t\t(comment 1 "Wearable carrier board: ESP32 DevKit, AD8232, MAX30102, MPU, 5 piezo sensors")
\t\t(comment 2 "Prototype only. Battery operation and insulation required for body-connected testing.")
\t)
\t(layers
\t\t(0 "F.Cu" signal "top_copper")
\t\t(2 "B.Cu" signal "bottom_copper")
\t\t(9 "F.Adhes" user "F.Adhesive")
\t\t(11 "B.Adhes" user "B.Adhesive")
\t\t(13 "F.Paste" user)
\t\t(15 "B.Paste" user)
\t\t(5 "F.SilkS" user "F.Silkscreen")
\t\t(7 "B.SilkS" user "B.Silkscreen")
\t\t(1 "F.Mask" user)
\t\t(3 "B.Mask" user)
\t\t(17 "Dwgs.User" user "User.Drawings")
\t\t(19 "Cmts.User" user "User.Comments")
\t\t(21 "Eco1.User" user "User.Eco1")
\t\t(23 "Eco2.User" user "User.Eco2")
\t\t(25 "Edge.Cuts" user)
\t\t(27 "Margin" user)
\t\t(31 "F.CrtYd" user "F.Courtyard")
\t\t(29 "B.CrtYd" user "B.Courtyard")
\t\t(35 "F.Fab" user)
\t\t(33 "B.Fab" user)
\t)
\t(setup
\t\t(stackup
\t\t\t(layer "F.SilkS" (type "Top Silk Screen"))
\t\t\t(layer "F.Paste" (type "Top Solder Paste"))
\t\t\t(layer "F.Mask" (type "Top Solder Mask") (thickness 0.01))
\t\t\t(layer "F.Cu" (type "copper") (thickness 0.035))
\t\t\t(layer "dielectric 1" (type "core") (thickness 1.13) (material "FR4") (epsilon_r 4.5) (loss_tangent 0.02))
\t\t\t(layer "B.Cu" (type "copper") (thickness 0.035))
\t\t\t(layer "B.Mask" (type "Bottom Solder Mask") (thickness 0.01))
\t\t\t(layer "B.Paste" (type "Bottom Solder Paste"))
\t\t\t(layer "B.SilkS" (type "Bottom Silk Screen"))
\t\t\t(copper_finish "None")
\t\t\t(dielectric_constraints no)
\t\t)
\t\t(pad_to_mask_clearance 0)
\t\t(allow_soldermask_bridges_in_footprints no)
\t\t(tenting front back)
\t\t(pcbplotparams
\t\t\t(layerselection 0x00000000_00000000_00001030_ffffffff)
\t\t\t(plot_on_all_layers_selection 0x00000000_00000000_00000000_00000000)
\t\t\t(disableapertmacros no)
\t\t\t(usegerberextensions no)
\t\t\t(usegerberattributes yes)
\t\t\t(usegerberadvancedattributes yes)
\t\t\t(creategerberjobfile yes)
\t\t\t(svgprecision 6)
\t\t\t(plotframeref no)
\t\t\t(mode 1)
\t\t\t(useauxorigin no)
\t\t\t(pdf_metadata yes)
\t\t\t(outputdirectory "gerbers")
\t\t)
\t)
${nets.map((name, index) => `\t(net ${index} "${name}")`).join("\n")}

${footprints.map((fp) => fp.replace(/^/gm, "\t")).join("\n\n")}

${boardGraphics.join("\n")}

${guideGraphics.join("\n")}

${roughRoutes.join("\n")}

\t(embedded_fonts no)
)`;

function schText(text, x, y, size = 1.27) {
  return `\t(text "${text.replace(/"/g, "'")}"
\t\t(exclude_from_sim no)
\t\t(at ${x} ${y} 0)
\t\t(effects
\t\t\t(font (size ${size} ${size}))
\t\t\t(justify left bottom)
\t\t)
\t\t(uuid "${uuid()}")
\t)`;
}

const sch = `(kicad_sch
\t(version 20250114)
\t(generator "codex")
\t(generator_version "1.0")
\t(uuid "${uuid()}")
\t(paper "A4")
\t(title_block
\t\t(title "Twin-Medic Wearable ESP32 Carrier PCB")
\t\t(date "2026-06-07")
\t\t(rev "V1")
\t\t(company "Twin-Medic")
\t)
\t(lib_symbols)
${[
  ["TWIN-MEDIC WEARABLE PCB V1 - CONNECTOR NET SUMMARY", 20, 25, 1.5],
  ["ESP32 DevKit carrier. Open PCB file for placed footprints and board outline.", 20, 33, 1.1],
  ["ECG: AD8232 OUT=GPIO34, LO+=GPIO25, LO-=GPIO26.", 20, 42, 1.1],
  ["Piezo AO: RightArm=GPIO35, LeftArm=GPIO32, RightLeg=GPIO33, LeftLeg=GPIO36, Chest=GPIO39.", 20, 50, 1.1],
  ["I2C: MAX30102 + MPU on SDA=GPIO21 and SCL=GPIO22 with 4.7k pullups.", 20, 58, 1.1],
  ["Analog protection: 1k series, 1M piezo pulldown, 10nF/100nF filters.", 20, 66, 1.1],
  ["Power: 3.3V sensors only. Do not feed 5V analog output to ESP32 ADC pins.", 20, 74, 1.1],
  ["Safety: prototype only. Use battery power and insulation for body-connected testing.", 20, 82, 1.1],
].map(([text, x, y, size]) => schText(text, x, y, size)).join("\n")}
\t(sheet_instances
\t\t(path "/"
\t\t\t(page "1")
\t\t)
\t)
\t(embedded_fonts no)
)`;

const pro = {
  board: {
    design_settings: {
      defaults: {
        board_outline_line_width: 0.1,
        copper_line_width: 0.2,
        copper_text_size_h: 1.5,
        copper_text_size_v: 1.5,
        copper_text_thickness: 0.3,
        other_line_width: 0.1,
        silk_line_width: 0.12,
        silk_text_size_h: 1,
        silk_text_size_v: 1,
        silk_text_thickness: 0.15,
        zones: { min_clearance: 0.25 },
      },
      meta: { version: 2 },
      rule_severities: {
        clearance: "error",
        copper_edge_clearance: "error",
        invalid_outline: "error",
        track_width: "error",
        unconnected_items: "warning",
      },
    },
    layer_presets: [],
    viewports: [],
  },
  boards: [],
  cvpcb: { equivalence_files: [] },
  erc: { erc_exclusions: [], meta: { version: 0 }, pin_map: [], rule_severities: {} },
  libraries: {
    pinned_footprint_libs: [],
    pinned_symbol_libs: [],
  },
  meta: {
    filename: `${projectName}.kicad_pro`,
    version: 1,
  },
  net_settings: {
    classes: [
      {
        bus_width: 12,
        clearance: 0.25,
        diff_pair_gap: 0.25,
        diff_pair_via_gap: 0.25,
        diff_pair_width: 0.2,
        line_style: 0,
        microvia_diameter: 0.3,
        microvia_drill: 0.1,
        name: "Default",
        pcb_color: "rgba(0, 0, 0, 0.000)",
        schematic_color: "rgba(0, 0, 0, 0.000)",
        track_width: 0.25,
        via_diameter: 0.8,
        via_drill: 0.4,
        wire_width: 6,
      },
      {
        bus_width: 12,
        clearance: 0.25,
        diff_pair_gap: 0.25,
        diff_pair_via_gap: 0.25,
        diff_pair_width: 0.2,
        line_style: 0,
        microvia_diameter: 0.3,
        microvia_drill: 0.1,
        name: "Power",
        pcb_color: "rgba(255, 0, 0, 0.000)",
        schematic_color: "rgba(255, 0, 0, 0.000)",
        track_width: 0.5,
        via_diameter: 0.9,
        via_drill: 0.45,
        wire_width: 6,
      },
    ],
    meta: { version: 3 },
    net_colors: null,
    netclass_assignments: null,
    netclass_patterns: [],
  },
  pcbnew: { last_paths: { gencad: "", idf: "", netlist: "", specctra_dsn: "", step: "", vrml: "" }, page_layout_descr_file: "" },
  schematic: { annotate_start_num: 0, drawing: { default_line_thickness: 6, default_text_size: 50 }, legacy_lib_dir: "", page_layout_descr_file: "" },
  sheets: [[uuid(), ""]],
  text_variables: {},
};

const readme = `TWIN-MEDIC WEARABLE KICAD PROJECT
====================================

Generated files:
- ${projectName}.kicad_pro
- ${projectName}.kicad_sch
- ${projectName}.kicad_pcb

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
`;

fs.writeFileSync(pcbPath, pcb, "utf8");
fs.writeFileSync(schPath, sch, "utf8");
fs.writeFileSync(proPath, JSON.stringify(pro, null, 2), "utf8");
fs.writeFileSync(readmePath, readme, "utf8");

console.log(`Generated KiCad project at ${rootDir}`);
