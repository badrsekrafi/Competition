import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const projectName = "twin_medic_cp2102_devboard_1layer";
const rootDir = path.resolve("pcb", projectName);
fs.mkdirSync(rootDir, { recursive: true });

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
  "EN",
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
  "MPU_INT",
];

const netId = Object.fromEntries(nets.map((name, index) => [name, index]));
const net = (name) => (name ? `(net ${netId[name]} "${name}")` : "");

function prop(name, value, x, y, layer = "F.Fab", hide = false) {
  return `\t\t(property "${name}" "${value}"
\t\t\t(at ${x} ${y} 0)
\t\t\t${hide ? "(unlocked yes)\n\t\t\t" : ""}(layer "${layer}")
\t\t\t${hide ? "(hide yes)\n\t\t\t" : ""}(uuid "${uuid()}")
\t\t\t(effects (font (size 1 1) (thickness 0.15)))
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

function padTh(num, x, y, netName, fn, shape = "oval") {
  return `\t\t(pad "${num}" thru_hole ${shape}
\t\t\t(at ${x} ${y} 0)
\t\t\t(size 1.7 1.7)
\t\t\t(drill 1)
\t\t\t(layers "*.Cu" "*.Mask")
\t\t\t${net(netName)}
\t\t\t(pinfunction "${fn}")
\t\t\t(pintype "passive")
\t\t\t(uuid "${uuid()}")
\t\t)`;
}

function pinHeader({ ref, value, x, y, pins, orientation = "horizontal" }) {
  const pitch = 2.54;
  const horizontal = orientation === "horizontal";
  const lib = `Connector_PinHeader_2.54mm:PinHeader_1x${String(pins.length).padStart(2, "0")}_P2.54mm_${horizontal ? "Horizontal" : "Vertical"}`;
  const w = horizontal ? (pins.length - 1) * pitch + 3.2 : 3.2;
  const h = horizontal ? 3.2 : (pins.length - 1) * pitch + 3.2;
  const body = [
    `(footprint "${lib}"`,
    `\t(layer "F.Cu")`,
    `\t(uuid "${uuid()}")`,
    `\t(at ${x} ${y})`,
    prop("Reference", ref, 0, -2.7, "F.SilkS"),
    prop("Value", value, 0, h, "F.Fab"),
    prop("Datasheet", "", 0, 0, "F.Fab", true),
    prop("Description", "", 0, 0, "F.Fab", true),
    `\t(path "/${uuid()}")`,
    `\t(attr through_hole)`,
    fpLine(-1.6, -1.6, w - 1.6, -1.6),
    fpLine(w - 1.6, -1.6, w - 1.6, h - 1.6),
    fpLine(w - 1.6, h - 1.6, -1.6, h - 1.6),
    fpLine(-1.6, h - 1.6, -1.6, -1.6),
  ];

  pins.forEach((pin, index) => {
    body.push(padTh(
      String(index + 1),
      horizontal ? index * pitch : 0,
      horizontal ? 0 : index * pitch,
      pin.net,
      pin.fn || pin.net || `P${index + 1}`,
      index === 0 ? "rect" : "oval",
    ));
  });

  body.push(")");
  return body.join("\n");
}

function mountingHole(ref, x, y) {
  return `(footprint "MountingHole:MountingHole_2.7mm_M2.5"
\t(layer "F.Cu")
\t(uuid "${uuid()}")
\t(at ${x} ${y})
${prop("Reference", ref, 0, -2, "F.SilkS")}
${prop("Value", "M2.5", 0, 3, "F.Fab", true)}
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

function grText(text, x, y, size = 1, layer = "F.SilkS", justify = "") {
  return `\t(gr_text "${text.replace(/"/g, "'")}"
\t\t(at ${x} ${y} 0)
\t\t(layer "${layer}")
\t\t(uuid "${uuid()}")
\t\t(effects
\t\t\t(font (size ${size} ${size}) (thickness ${Math.max(0.1, size * 0.12).toFixed(2)}))
\t\t\t${justify ? `(justify ${justify})` : ""}
\t\t)
\t)`;
}

function segment(x1, y1, x2, y2, netName, width = 0.28) {
  return `\t(segment
\t\t(start ${x1} ${y1})
\t\t(end ${x2} ${y2})
\t\t(width ${width})
\t\t(layer "F.Cu")
\t\t(net ${netId[netName]})
\t\t(uuid "${uuid()}")
\t)`;
}

// Common 30-pin ESP32-WROOM-32 CP2102 DevKit V1 style.
// Verify against the exact board silkscreen before manufacturing.
const leftRow = [
  { fn: "EN", net: "EN" },
  { fn: "VP/GPIO36", net: "GPIO36_PIEZO_LL" },
  { fn: "VN/GPIO39", net: "GPIO39_PIEZO_CHEST" },
  { fn: "GPIO34", net: "GPIO34_ECG_OUT" },
  { fn: "GPIO35", net: "GPIO35_PIEZO_RA" },
  { fn: "GPIO32", net: "GPIO32_PIEZO_LA" },
  { fn: "GPIO33", net: "GPIO33_PIEZO_RL" },
  { fn: "GPIO25", net: "GPIO25_ECG_LOP" },
  { fn: "GPIO26", net: "GPIO26_ECG_LOM" },
  { fn: "GPIO27" },
  { fn: "GPIO14" },
  { fn: "GPIO12" },
  { fn: "GND", net: "GND" },
  { fn: "GPIO13" },
  { fn: "VIN", net: "VIN_5V" },
];

const rightRow = [
  { fn: "3V3", net: "3V3" },
  { fn: "GND", net: "GND" },
  { fn: "GPIO15" },
  { fn: "GPIO2" },
  { fn: "GPIO4" },
  { fn: "GPIO16/RX2", net: "GPIO16_GPS_RX" },
  { fn: "GPIO17/TX2", net: "GPIO17_GPS_TX" },
  { fn: "GPIO5" },
  { fn: "GPIO18" },
  { fn: "GPIO19" },
  { fn: "GPIO21", net: "GPIO21_SDA" },
  { fn: "RX0" },
  { fn: "TX0" },
  { fn: "GPIO22", net: "GPIO22_SCL" },
  { fn: "GPIO23" },
];

const carrier = [
  pinHeader({
    ref: "U1L",
    value: "ESP32_WROOM32_CP2102_LEFT_15",
    x: 41,
    y: 16,
    pins: leftRow,
    orientation: "vertical",
  }),
  pinHeader({
    ref: "U1R",
    value: "ESP32_WROOM32_CP2102_RIGHT_15",
    x: 66.4,
    y: 16,
    pins: rightRow,
    orientation: "vertical",
  }),
];

const connectors = [
  pinHeader({
    ref: "J1",
    value: "AD8232_ECG",
    x: 7,
    y: 13,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "OUT", net: "GPIO34_ECG_OUT" },
      { fn: "LO+", net: "GPIO25_ECG_LOP" },
      { fn: "LO-", net: "GPIO26_ECG_LOM" },
    ],
  }),
  pinHeader({
    ref: "J2",
    value: "PIEZO_RIGHT_ARM",
    x: 7,
    y: 23,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO35_PIEZO_RA" },
    ],
  }),
  pinHeader({
    ref: "J3",
    value: "PIEZO_LEFT_ARM",
    x: 7,
    y: 29,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO32_PIEZO_LA" },
    ],
  }),
  pinHeader({
    ref: "J4",
    value: "PIEZO_RIGHT_LEG",
    x: 7,
    y: 35,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO33_PIEZO_RL" },
    ],
  }),
  pinHeader({
    ref: "J5",
    value: "PIEZO_LEFT_LEG",
    x: 7,
    y: 41,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO36_PIEZO_LL" },
    ],
  }),
  pinHeader({
    ref: "J6",
    value: "PIEZO_CHEST",
    x: 7,
    y: 47,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO39_PIEZO_CHEST" },
    ],
  }),
  pinHeader({
    ref: "J7",
    value: "MAX30102_I2C",
    x: 75,
    y: 23,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "SDA", net: "GPIO21_SDA" },
      { fn: "SCL", net: "GPIO22_SCL" },
    ],
  }),
  pinHeader({
    ref: "J8",
    value: "MPU9250_6500_I2C",
    x: 75,
    y: 32,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "SDA", net: "GPIO21_SDA" },
      { fn: "SCL", net: "GPIO22_SCL" },
      { fn: "INT", net: "MPU_INT" },
    ],
  }),
  pinHeader({
    ref: "J9",
    value: "PWR_AUX_FROM_DEVBOARD",
    x: 75,
    y: 48,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "VIN", net: "VIN_5V" },
    ],
  }),
];

const holes = [
  mountingHole("H1", 19, 10),
  mountingHole("H2", 88, 10),
  mountingHole("H3", 19, 62),
  mountingHole("H4", 88, 62),
];

const graphics = [
  grLine(6, 6, 100, 6),
  grArc([100, 6], [105.657, 8.343], [108, 14]),
  grLine(108, 14, 108, 62),
  grArc([108, 62], [105.657, 67.657], [100, 70]),
  grLine(100, 70, 6, 70),
  grArc([6, 70], [0.343, 67.657], [-2, 62]),
  grLine(-2, 62, -2, 14),
  grArc([-2, 14], [0.343, 8.343], [6, 6]),
  grText("TWIN-MEDIC CP2102 DEVBOARD 1-LAYER", 26, 8.3, 1.0),
  grText("ESP32-WROOM-32 CP2102 SOCKET", 36, 60, 0.9),
  grText("NO FILTERS / NO PASSIVES", 36, 67.7, 0.9),
  grText("VERIFY YOUR 30-PIN BOARD SILKSCREEN", 29, 11.3, 0.75),
  grText("USB SIDE", 50, 13, 0.8, "Cmts.User"),
  grText("SENSOR SIDE", 7, 57, 0.8, "Cmts.User", "left"),
];

// V3 keeps the board unrouted on purpose. In a strict 1-layer board, several
// signal paths may require connector movement or insulated wire jumpers. KiCad
// will show the ratsnest from these net assignments for manual routing.
const routes = [];

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
\t\t(title "Twin-Medic ESP32-WROOM-32 CP2102 DevBoard 1-Layer Carrier")
\t\t(date "2026-06-07")
\t\t(rev "V3-CP2102-1L")
\t\t(company "Twin-Medic")
\t\t(comment 1 "For ESP32-WROOM-32 CP2102 development board, common 30-pin DevKit socket")
\t\t(comment 2 "Single-sided carrier, no filter resistors/capacitors")
\t)
\t(layers
\t\t(0 "F.Cu" signal "top_copper")
\t\t(2 "B.Cu" signal "unused_bottom_copper")
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
\t\t\t(layerselection 0x00000000_00000000_00000000_00000011)
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

${[...carrier, ...connectors, ...holes].map((item) => item.replace(/^/gm, "\t")).join("\n\n")}

${graphics.join("\n")}

${routes.join("\n")}

\t(embedded_fonts no)
)`;

function schText(text, x, y, size = 1.1) {
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
\t\t(title "Twin-Medic CP2102 DevBoard 1-Layer Carrier")
\t\t(date "2026-06-07")
\t\t(rev "V3-CP2102-1L")
\t)
\t(lib_symbols)
${[
  ["TWIN-MEDIC ESP32-WROOM-32 CP2102 DEVELOPMENT BOARD CARRIER", 18, 25, 1.45],
  ["Target: common 30-pin ESP32 DevKit V1 / ESP32-WROOM-32 CP2102 board.", 18, 34, 1.1],
  ["This is a 1-layer carrier/shield PCB: the CP2102 board plugs into two 15-pin female socket rows.", 18, 42, 1.1],
  ["No filter resistors/capacitors are used, per request. Sensor AO lines go directly to ESP32 ADC pins.", 18, 50, 1.1],
  ["Piezo: RA=GPIO35, LA=GPIO32, RL=GPIO33, LL=GPIO36, CHEST=GPIO39.", 18, 58, 1.1],
  ["AD8232: OUT=GPIO34, LO+=GPIO25, LO-=GPIO26.", 18, 66, 1.1],
  ["I2C: MAX30102 + MPU on SDA=GPIO21 and SCL=GPIO22.", 18, 74, 1.1],
  ["Before fabrication: compare U1L/U1R pin order with your exact CP2102 board silkscreen.", 18, 82, 1.1],
].map(([text, x, y, size]) => schText(text, x, y, size)).join("\n")}
\t(sheet_instances
\t\t(path "/" (page "1"))
\t)
\t(embedded_fonts no)
)`;

const pro = {
  board: {
    design_settings: {
      defaults: {
        board_outline_line_width: 0.1,
        copper_line_width: 0.28,
        other_line_width: 0.1,
        silk_line_width: 0.12,
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
  },
  boards: [],
  cvpcb: { equivalence_files: [] },
  erc: { erc_exclusions: [], meta: { version: 0 }, pin_map: [], rule_severities: {} },
  libraries: { pinned_footprint_libs: [], pinned_symbol_libs: [] },
  meta: { filename: `${projectName}.kicad_pro`, version: 1 },
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
        track_width: 0.28,
        via_diameter: 0.8,
        via_drill: 0.4,
        wire_width: 6,
      },
    ],
    meta: { version: 3 },
    net_colors: null,
    netclass_assignments: null,
    netclass_patterns: [],
  },
  pcbnew: { last_paths: {}, page_layout_descr_file: "" },
  schematic: { annotate_start_num: 0, drawing: { default_line_thickness: 6, default_text_size: 50 }, legacy_lib_dir: "", page_layout_descr_file: "" },
  sheets: [[uuid(), ""]],
  text_variables: {},
};

const readme = `TWIN-MEDIC ESP32-WROOM-32 CP2102 DEVBOARD 1-LAYER CARRIER
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
`;

fs.writeFileSync(pcbPath, pcb, "utf8");
fs.writeFileSync(schPath, sch, "utf8");
fs.writeFileSync(proPath, JSON.stringify(pro, null, 2), "utf8");
fs.writeFileSync(readmePath, readme, "utf8");

console.log(`Generated KiCad project at ${rootDir}`);
