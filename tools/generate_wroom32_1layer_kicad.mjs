import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const projectName = "twin_medic_wroom32_1layer";
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
  "EN",
  "GPIO0_BOOT",
  "U0RXD",
  "U0TXD",
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

function net(name) {
  return name ? `(net ${netId[name]} "${name}")` : "";
}

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

function padSmd(num, x, y, w, h, netName, fn, roundrect = true) {
  return `\t\t(pad "${num}" smd ${roundrect ? "roundrect" : "rect"}
\t\t\t(at ${x} ${y} 0)
\t\t\t(size ${w} ${h})
\t\t\t(layers "F.Cu" "F.Paste" "F.Mask")
\t\t\t${roundrect ? "(roundrect_rratio 0.18)\n\t\t\t" : ""}${net(netName)}
\t\t\t(pinfunction "${fn}")
\t\t\t(pintype "bidirectional")
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
  const libName = `Connector_PinHeader_2.54mm:PinHeader_1x${String(pins.length).padStart(2, "0")}_P2.54mm_${horizontal ? "Horizontal" : "Vertical"}`;
  const w = horizontal ? (pins.length - 1) * pitch + 3.2 : 3.2;
  const h = horizontal ? 3.2 : (pins.length - 1) * pitch + 3.2;
  const body = [
    `(footprint "${libName}"`,
    `\t(layer "F.Cu")`,
    `\t(uuid "${uuid()}")`,
    `\t(at ${x} ${y})`,
    prop("Reference", ref, 0, -2.8, "F.SilkS"),
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

const leftPins = [
  ["1", "GND", "GND"],
  ["2", "3V3", "3V3"],
  ["3", "EN", "EN"],
  ["4", "GPIO36", "GPIO36_PIEZO_LL"],
  ["5", "GPIO39", "GPIO39_PIEZO_CHEST"],
  ["6", "GPIO34", "GPIO34_ECG_OUT"],
  ["7", "GPIO35", "GPIO35_PIEZO_RA"],
  ["8", "GPIO32", "GPIO32_PIEZO_LA"],
  ["9", "GPIO33", "GPIO33_PIEZO_RL"],
  ["10", "GPIO25", "GPIO25_ECG_LOP"],
  ["11", "GPIO26", "GPIO26_ECG_LOM"],
  ["12", "GPIO27", ""],
  ["13", "GPIO14", ""],
  ["14", "GPIO12", ""],
  ["15", "GND", "GND"],
  ["16", "GPIO13", ""],
  ["17", "SD2", ""],
  ["18", "SD3", ""],
  ["19", "CMD", ""],
];

const rightPins = [
  ["20", "CLK", ""],
  ["21", "SD0", ""],
  ["22", "SD1", ""],
  ["23", "GPIO15", ""],
  ["24", "GPIO2", ""],
  ["25", "GPIO0", "GPIO0_BOOT"],
  ["26", "GPIO4", ""],
  ["27", "GPIO16", "GPIO16_GPS_RX"],
  ["28", "GPIO17", "GPIO17_GPS_TX"],
  ["29", "GPIO5", ""],
  ["30", "GPIO18", ""],
  ["31", "GPIO19", ""],
  ["32", "NC", ""],
  ["33", "GPIO21", "GPIO21_SDA"],
  ["34", "RXD0", "U0RXD"],
  ["35", "TXD0", "U0TXD"],
  ["36", "GPIO22", "GPIO22_SCL"],
  ["37", "GPIO23", ""],
  ["38", "GND", "GND"],
];

function esp32Wroom(x, y) {
  const body = [
    `(footprint "RF_Module:ESP32-WROOM-32_Custom_1Layer"`,
    `\t(layer "F.Cu")`,
    `\t(uuid "${uuid()}")`,
    `\t(at ${x} ${y})`,
    prop("Reference", "U1", 0, -15.4, "F.SilkS"),
    prop("Value", "ESP32-WROOM-32", 0, 15.2, "F.Fab"),
    prop("Datasheet", "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf", 0, 0, "F.Fab", true),
    prop("Description", "ESP32-WROOM-32 module, single-sided prototype carrier footprint", 0, 0, "F.Fab", true),
    `\t(path "/${uuid()}")`,
    `\t(attr smd)`,
    fpLine(-9, -12.75, 9, -12.75),
    fpLine(9, -12.75, 9, 12.75),
    fpLine(9, 12.75, -9, 12.75),
    fpLine(-9, 12.75, -9, -12.75),
    fpLine(-9, -12.75, 9, -12.75, "F.Fab", 0.1),
    fpLine(-9, -12.75, -9, 12.75, "F.Fab", 0.1),
    fpLine(9, -12.75, 9, 12.75, "F.Fab", 0.1),
    fpLine(-9, 12.75, 9, 12.75, "F.Fab", 0.1),
    fpLine(-9, -12.75, 9, -12.75, "Cmts.User", 0.08),
    fpLine(9, -12.75, 9, -7, "Cmts.User", 0.08),
    fpLine(9, -7, -9, -7, "Cmts.User", 0.08),
    fpLine(-9, -7, -9, -12.75, "Cmts.User", 0.08),
  ];

  leftPins.forEach(([num, name, netName], index) => {
    const py = -11.43 + index * 1.27;
    body.push(padSmd(num, -9.4, py, 1.3, 0.8, netName, name));
  });

  rightPins.forEach(([num, name, netName], index) => {
    const py = 11.43 - index * 1.27;
    body.push(padSmd(num, 9.4, py, 1.3, 0.8, netName, name));
  });

  body.push(`\t\t(fp_text user "ANTENNA KEEP OUT"
\t\t\t(at 0 -9.8 0)
\t\t\t(layer "Cmts.User")
\t\t\t(uuid "${uuid()}")
\t\t\t(effects (font (size 0.9 0.9) (thickness 0.12)))
\t\t)`);
  body.push(")");
  return body.join("\n");
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

function segment(x1, y1, x2, y2, netName, width = 0.25) {
  return `\t(segment
\t\t(start ${x1} ${y1})
\t\t(end ${x2} ${y2})
\t\t(width ${width})
\t\t(layer "F.Cu")
\t\t(net ${netId[netName]})
\t\t(uuid "${uuid()}")
\t)`;
}

const footprints = [
  esp32Wroom(50, 25),
  pinHeader({
    ref: "J1",
    value: "PWR_3V3_IN",
    x: 9,
    y: 55,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
    ],
  }),
  pinHeader({
    ref: "J2",
    value: "UART_PROGRAM",
    x: 71,
    y: 55,
    pins: [
      { fn: "GND", net: "GND" },
      { fn: "3V3", net: "3V3" },
      { fn: "EN", net: "EN" },
      { fn: "IO0", net: "GPIO0_BOOT" },
      { fn: "RXD0", net: "U0RXD" },
      { fn: "TXD0", net: "U0TXD" },
    ],
  }),
  pinHeader({
    ref: "J3",
    value: "AD8232_ECG",
    x: 9,
    y: 10,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "OUT", net: "GPIO34_ECG_OUT" },
      { fn: "LO+", net: "GPIO25_ECG_LOP" },
      { fn: "LO-", net: "GPIO26_ECG_LOM" },
    ],
  }),
  pinHeader({
    ref: "J4",
    value: "MAX30102",
    x: 73,
    y: 14,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "SDA", net: "GPIO21_SDA" },
      { fn: "SCL", net: "GPIO22_SCL" },
    ],
  }),
  pinHeader({
    ref: "J5",
    value: "MPU9250_6500",
    x: 73,
    y: 22,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "SDA", net: "GPIO21_SDA" },
      { fn: "SCL", net: "GPIO22_SCL" },
      { fn: "INT", net: "MPU_INT" },
    ],
  }),
  pinHeader({
    ref: "J6",
    value: "PIEZO_RIGHT_ARM",
    x: 9,
    y: 25,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO35_PIEZO_RA" },
    ],
  }),
  pinHeader({
    ref: "J7",
    value: "PIEZO_LEFT_ARM",
    x: 9,
    y: 31,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO32_PIEZO_LA" },
    ],
  }),
  pinHeader({
    ref: "J8",
    value: "PIEZO_RIGHT_LEG",
    x: 9,
    y: 37,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO33_PIEZO_RL" },
    ],
  }),
  pinHeader({
    ref: "J9",
    value: "PIEZO_LEFT_LEG",
    x: 9,
    y: 43,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO36_PIEZO_LL" },
    ],
  }),
  pinHeader({
    ref: "J10",
    value: "PIEZO_CHEST",
    x: 9,
    y: 49,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "GND", net: "GND" },
      { fn: "AO", net: "GPIO39_PIEZO_CHEST" },
    ],
  }),
  pinHeader({
    ref: "J11",
    value: "RUN_EN_JUMPER",
    x: 73,
    y: 42,
    pins: [
      { fn: "3V3", net: "3V3" },
      { fn: "EN", net: "EN" },
    ],
  }),
  pinHeader({
    ref: "J12",
    value: "BOOT_IO0_GND",
    x: 73,
    y: 47,
    pins: [
      { fn: "IO0", net: "GPIO0_BOOT" },
      { fn: "GND", net: "GND" },
    ],
  }),
  mountingHole("H1", 30, 8),
  mountingHole("H2", 87, 8),
  mountingHole("H3", 8, 62),
  mountingHole("H4", 87, 62),
];

const board = [
  grLine(8, 5, 87, 5),
  grArc([87, 5], [92.657, 7.343], [95, 13]),
  grLine(95, 13, 95, 62),
  grArc([95, 62], [92.657, 67.657], [87, 70]),
  grLine(87, 70, 8, 70),
  grArc([8, 70], [2.343, 67.657], [0, 62]),
  grLine(0, 62, 0, 13),
  grArc([0, 13], [2.343, 7.343], [8, 5]),
  grText("TWIN-MEDIC WROOM32 1-LAYER", 25, 7.2, 1.05),
  grText("NO FILTERS / NO PASSIVES", 29, 68.3, 0.95),
  grText("3.3V INPUT ONLY", 70, 52, 0.8),
  grText("GPIO36/39 INPUT ONLY", 69, 38.5, 0.75),
  grText("ANTENNA KEEP CLEAR", 41, 14.6, 0.8, "Cmts.User"),
  grLine(41, 12.25, 59, 12.25, "Cmts.User", 0.08),
  grLine(59, 12.25, 59, 18, "Cmts.User", 0.08),
  grLine(59, 18, 41, 18, "Cmts.User", 0.08),
  grLine(41, 18, 41, 12.25, "Cmts.User", 0.08),
];

const routedSignals = [
  // Intentionally empty for V2-1L. The project keeps the full ratsnest so the
  // unavoidable single-layer crossings can be solved manually with placement
  // tweaks or insulated wire jumpers.
];

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
\t\t(title "Twin-Medic ESP32-WROOM-32 1-Layer Wearable PCB")
\t\t(date "2026-06-07")
\t\t(rev "V2-1L")
\t\t(company "Twin-Medic")
\t\t(comment 1 "Single top copper prototype: ESP32-WROOM-32, no analog filters/passives")
\t\t(comment 2 "Requires external clean regulated 3.3V supply")
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

${footprints.map((item) => item.replace(/^/gm, "\t")).join("\n\n")}

${board.join("\n")}

${routedSignals.join("\n")}

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
\t\t(title "Twin-Medic ESP32-WROOM-32 1-Layer PCB")
\t\t(date "2026-06-07")
\t\t(rev "V2-1L")
\t)
\t(lib_symbols)
${[
  ["TWIN-MEDIC ESP32-WROOM-32 1-LAYER PCB", 20, 25, 1.5],
  ["This version removes all filter resistors/capacitors and uses direct sensor connector wiring.", 20, 34, 1.1],
  ["Power input must be regulated 3.3V. Do not connect LiPo directly to 3V3.", 20, 42, 1.1],
  ["EN is available on RUN_EN_JUMPER and UART_PROGRAM. Connect EN to 3V3 to run.", 20, 50, 1.1],
  ["For upload: pull GPIO0 to GND, reset/power-cycle, then use 3.3V USB-TTL on U0RXD/U0TXD.", 20, 58, 1.1],
  ["ECG: OUT=GPIO34, LO+=GPIO25, LO-=GPIO26.", 20, 66, 1.1],
  ["Piezo AO: RA=35, LA=32, RL=33, LL=36, CHEST=39.", 20, 74, 1.1],
  ["I2C modules: MAX30102 and MPU use SDA=21, SCL=22. If modules do not have pullups, I2C may fail.", 20, 82, 1.1],
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
        copper_line_width: 0.25,
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
        track_width: 0.25,
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

const readme = `TWIN-MEDIC ESP32-WROOM-32 1-LAYER PCB
===========================================

This project is a simplified single-sided PCB for the user's available parts:
- ESP32-WROOM-32 bare module
- One copper layer only: F.Cu
- No analog filter resistors/capacitors
- No piezo pulldown resistors
- No onboard regulator or USB-UART

Generated files:
- ${projectName}.kicad_pro
- ${projectName}.kicad_sch
- ${projectName}.kicad_pcb

Important build rules:
1. Feed the board with clean regulated 3.3V only.
2. Do not connect a LiPo battery directly to 3V3.
3. Use an external 3.3V USB-TTL adapter for programming.
4. Connect EN to 3V3 with J11 to run.
5. Pull IO0 to GND with J12 while resetting/power-cycling to upload.
6. If your MAX30102/MPU modules do not include I2C pullups, the I2C bus may not work.
7. GPIO36 and GPIO39 can float more easily without pulldowns; expect more noise.

This is a prototype layout and must be reviewed in KiCad before manufacturing.
`;

fs.writeFileSync(pcbPath, pcb, "utf8");
fs.writeFileSync(schPath, sch, "utf8");
fs.writeFileSync(proPath, JSON.stringify(pro, null, 2), "utf8");
fs.writeFileSync(readmePath, readme, "utf8");

console.log(`Generated KiCad project at ${rootDir}`);
