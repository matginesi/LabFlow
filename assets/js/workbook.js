(function () {
  "use strict";
  const E = window.LabFlowExport;
  const xml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
  const column = (number) => {
    let result = "";
    while (number) { number -= 1; result = String.fromCharCode(65 + number % 26) + result; number = Math.floor(number / 26); }
    return result;
  };
  const cell = (value, row, col, style = 0) => typeof value === "number"
    ? `<c r="${column(col)}${row}" s="${style}"><v>${value}</v></c>`
    : typeof value === "string" && value.startsWith("=")
      ? `<c r="${column(col)}${row}" s="${style}"><f>${xml(value.slice(1))}</f></c>`
      : `<c r="${column(col)}${row}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
  const row = (values, index, header = false, config = {}) => `<row r="${index}"${header ? ' ht="24" customHeight="1"' : ''}>${values.map((value, col) => {
    let style = header ? 2 : index % 2 ? 0 : 1;
    if (!header && config.editable && (!config.editableColumns || config.editableColumns.includes(col + 1))) style = 3;
    if (!header && config.formulas && typeof value === "string" && value.startsWith("=")) style = 4;
    return cell(value, index, col + 1, style);
  }).join("")}</row>`;
  const sheet = (rows, widths = [], filter = true, config = {}) => {
    const widthXml = widths.length ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>` : "";
    const last = column(Math.max(...rows.map((values) => values.length), 1));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="${config.showGridLines === false ? 0 : 1}"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews>${widthXml}<sheetFormatPr defaultRowHeight="18"/><sheetData>${rows.map((values, index) => row(values, index + 1, index === 0, config)).join("")}</sheetData>${filter && rows.length > 1 ? `<autoFilter ref="A1:${last}${rows.length}"/>` : ""}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  };
  const pdfSafe = (value) => String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1");
  const pdfRgb = (hex) => [0, 2, 4].map((index) => (parseInt(hex.slice(index, index + 2), 16) / 255).toFixed(3)).join(" ");
  const pdfText = (value, x, y, size = 10, bold = false, colour = "0.12 0.16 0.22") => `${colour} rg BT /F${bold ? 2 : 1} ${size} Tf ${x} ${y} Td (${pdfSafe(value)}) Tj ET`;
  const pdfLines = (value, width = 82) => {
    const words = pdfSafe(value).split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => { const next = line ? `${line} ${word}` : word; if (next.length > width && line) { lines.push(line); line = word; } else line = next; });
    if (line) lines.push(line);
    return lines;
  };
  function editablePdfRaw(project, data, options = {}) {
    const encoder = new TextEncoder();
    const palette = E.palettes[options.palette] || E.palettes.blue;
    const accent = pdfRgb(palette.hex);
    const dark = pdfRgb(palette.dark);
    const report = options.report || {};
    const sections = new Set(report.sections || ["summary", "methods", "results", "ai", "conclusions", "provenance"]);
    const chartMetric = ["pce", "stability", "hysteresis"].includes(report.chartMetric) ? report.chartMetric : "pce";
    const chartMeta = {pce:["PCE", "%"], stability:["STABILITY", "%"], hysteresis:["HYSTERESIS", "%"]}[chartMetric];
    const findings = options.findings || [];
    const best = data.reduce((current, item) => current.pce > item.pce ? current : item);
    const mean = (key) => data.reduce((sum, item) => sum + Number(item[key] || 0), 0) / Math.max(1, data.length);
    const pages = [];
    const fields = [];
    const addField = (page, name, value, rect, config = {}) => {
      fields.push({ page, name, value: pdfSafe(value), rect, multiline: Boolean(config.multiline), size: config.size || 8, align: config.align || 0 });
    };
    const linesAt = (commands, value, x, y, width = 82, size = 9, leading = 12, colour = "0.12 0.16 0.22", maxLines = 99) => {
      const lines = pdfLines(value, width).slice(0, maxLines);
      lines.forEach((line, index) => commands.push(pdfText(line, x, y - index * leading, size, false, colour)));
    };
    const rect = (commands, x, y, width, height, fill, stroke = null, lineWidth = 0.7) => {
      commands.push(`${fill} rg ${x} ${y} ${width} ${height} re f`);
      if (stroke) commands.push(`${stroke} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S`);
    };
    const frame = (number, title) => [
      "1 1 1 rg 0 0 595 842 re f",
      `${dark} rg 0 806 595 36 re f`,
      `${accent} rg 0 806 8 36 re f`,
      pdfText("LABFLOW", 38, 819, 9, true, "1 1 1"),
      pdfText(title, 104, 819, 9, true, "0.82 0.87 0.93"),
      pdfText(report.reportCode || project.id, 455, 819, 8, false, "0.75 0.82 0.90"),
      pdfText(`Page ${number} of 4`, 500, 22, 7, false, "0.38 0.43 0.51"),
      `${accent} rg 38 40 509 2 re f`
    ];

    let commands = [
      "1 1 1 rg 0 0 595 842 re f",
      `${dark} rg 0 552 595 290 re f`,
      `${accent} rg 0 552 11 290 re f`,
      pdfText(`LABFLOW / ${(report.reportType || "Scientific project report").toUpperCase()} / ${report.reportCode || project.id}`, 48, 790, 9, true, accent),
      pdfText(report.title || project.name, 48, 738, 25, true, "1 1 1"),
      pdfText(report.subtitle || "Scientific project report", 48, 706, 11, false, "0.80 0.86 0.93")
    ];
    linesAt(commands, sections.has("summary") ? (report.executiveSummary || project.objective) : "Executive Summary excluded by the report author.", 48, 666, 72, 9.5, 14, "0.88 0.92 0.97", 6);
    commands.push(pdfText(`${report.laboratory || options.user?.laboratory || "Laboratory"} | ${report.author || options.user?.name || project.owner} | ${report.reportDate || ""}`, 48, 576, 8.5, false, "0.76 0.82 0.90"), pdfText(`Keywords: ${report.keywords || ""}`, 48, 560, 7, false, "0.68 0.76 0.86"));
    const kpis = [
      ["BEST PCE", `${best.pce.toFixed(2)}%`, best.sample],
      ["MEAN PCE", `${mean("pce").toFixed(2)}%`, `${data.length} samples`],
      ["STABILITY", `${best.stability}%`, "best retained"],
      ["MEAN VOC", `${mean("voc").toFixed(2)} V`, "cohort"],
      ["OPEN ISSUES", "3", "quality review"]
    ];
    kpis.forEach(([label, value, detail], index) => {
      const x = 38 + index * 103;
      rect(commands, x, 458, 96, 70, index === 0 ? "0.93 0.97 0.98" : "0.96 0.97 0.99", "0.84 0.87 0.91");
      commands.push(`${accent} rg ${x} 525 96 3 re f`, pdfText(label, x + 8, 505, 6.5, true, "0.32 0.38 0.46"), pdfText(value, x + 8, 480, 15, true, index === 0 ? accent : "0.12 0.16 0.22"), pdfText(detail, x + 8, 466, 6.5, false, "0.38 0.43 0.51"));
    });
    commands.push(pdfText("EDITABLE REPORT IDENTITY", 38, 420, 8, true, accent), pdfText("Title", 48, 394, 7, true), pdfText("Author / laboratory", 48, 344, 7, true), pdfText("Approval state", 304, 344, 7, true), pdfText("Executive summary", 48, 289, 7, true));
    addField(0, "report.title", report.title || project.name, [48, 360, 547, 388], { size: 10 });
    addField(0, "report.author", `${report.author || options.user?.name || project.owner} | ${report.laboratory || options.user?.laboratory || "Laboratory"}`, [48, 310, 292, 338], { size: 7 });
    addField(0, "report.approval", report.approval || "Pending researcher approval", [304, 310, 547, 338], { size: 7 });
    addField(0, "report.executive_summary", sections.has("summary") ? (report.executiveSummary || project.objective) : "Executive Summary excluded by the report author.", [48, 150, 547, 282], { multiline: true, size: 8.5 });
    rect(commands, 38, 75, 509, 48, "0.95 0.97 0.99");
    commands.push(pdfText("PROJECT", 48, 108, 6.5, true, accent), pdfText(project.id, 48, 91, 9, true), pdfText("PIPELINE", 190, 108, 6.5, true, accent), pdfText(project.pipeline, 190, 91, 9, true), pdfText("EVIDENCE", 330, 108, 6.5, true, accent), pdfText(`${project.files} files | ${project.measurements} measurements | ${project.findings} findings`, 330, 91, 8, true));
    commands.push(pdfText("Page 1 of 4", 500, 22, 7, false, "0.38 0.43 0.51"), `${accent} rg 38 40 509 2 re f`);
    pages.push(commands.join("\n"));

    commands = frame(2, "MATERIALS, PROCESS AND EXPERIMENT COVERAGE");
    if (sections.has("methods")) {
    commands.push(pdfText("Research context", 38, 770, 17, true), pdfText("Objectives", 38, 742, 7, true, accent), pdfText("Methodology", 38, 632, 7, true, accent));
    addField(1, "report.objectives", report.objectives || project.objective, [38, 654, 547, 731], { multiline: true, size: 8.5 });
    addField(1, "report.methodology", report.methodology || "Structured preparation, mapped JV measurements and deterministic comparative analysis.", [38, 544, 547, 621], { multiline: true, size: 8.5 });
    if (report.includeQualityReview !== false) commands.push(pdfText("QUALITY REVIEW: 1 error | 2 warnings | causal interpretation remains blocked until provenance is complete", 38, 526, 6.5, true, accent));
    commands.push(pdfText("Solution composition | SOL-B04", 38, 512, 12, true, accent));
    const solution = [["DMF", "Primary solvent", "1.60 mL", "80% v/v"], ["DMSO", "Co-solvent", "0.40 mL", "20% v/v"], ["FAI", "A-site solute", "365.3 mg", "90 mol%"], ["MAI", "A-site solute", "39.7 mg", "10 mol%"], ["PbI2", "Lead halide", "1152.5 mg", "1.00 eq"]];
    rect(commands, 38, 468, 509, 22, dark);
    ["COMPONENT", "FUNCTION", "QUANTITY", "COMPOSITION"].forEach((label, index) => commands.push(pdfText(label, [46, 145, 345, 442][index], 476, 6.5, true, "1 1 1")));
    solution.forEach((item, index) => {
      const rowY = 445 - index * 24;
      if (index % 2 === 0) rect(commands, 38, rowY, 509, 22, "0.96 0.97 0.99");
      commands.push(pdfText(item[0], 46, rowY + 8, 7.5, true, accent), pdfText(item[1], 145, rowY + 8, 7.2), pdfText(item[2], 345, rowY + 8, 7.2, true), pdfText(item[3], 442, rowY + 8, 7.2));
    });
    commands.push(pdfText("Device stack | STK-003/v2", 38, 310, 12, true, accent));
    const stack = [["05", "Au", "Back contact", "80 nm"], ["04", "Spiro-OMeTAD", "Hole transport", "180 nm"], ["03", "FA/MA perovskite", "Photoactive absorber", "540 nm"], ["02", "SnO2", "Electron transport", "32 nm"], ["01", "Glass / FTO", "Substrate + front contact", "2.2 mm"]];
    stack.forEach((item, index) => {
      const rowY = 278 - index * 29;
      rect(commands, 38, rowY, 509, 25, index === 2 ? accent : index % 2 ? "0.92 0.94 0.97" : "0.96 0.97 0.99");
      const colour = index === 2 ? "1 1 1" : "0.12 0.16 0.22";
      commands.push(pdfText(item[0], 48, rowY + 9, 7, true, index === 2 ? "1 1 1" : accent), pdfText(item[1], 82, rowY + 9, 8, true, colour), pdfText(item[2], 270, rowY + 9, 7, false, colour), pdfText(item[3], 478, rowY + 9, 7, true, colour));
    });
    commands.push(pdfText("Experiment coverage", 38, 120, 12, true, accent));
    [["EXP-041", "S01-S03", "100 C / 30 min", "6 measurements", "Reviewed"], ["EXP-052", "S04-S05", "105 C / 25 min", "4 measurements", "Reviewed"], ["EXP-067", "S06-S08", "100 / unit missing", "24 imported", "Review"]].forEach((item, index) => {
      const rowY = 88 - index * 19;
      commands.push(pdfText(item[0], 38, rowY, 7, true, accent), pdfText(item[1], 105, rowY, 7), pdfText(item[2], 185, rowY, 7), pdfText(item[3], 330, rowY, 7), pdfText(item[4], 470, rowY, 7, true));
    });
    } else {
      commands.push(pdfText("Materials, Process & Experiments", 38, 770, 17, true), pdfText("Section excluded by the report author.", 38, 742, 9, false, "0.38 0.43 0.51"));
    }
    pages.push(commands.join("\n"));

    commands = frame(3, "COMPLETE RESULTS AND MEASUREMENT RECORD");
    if (sections.has("results")) {
    commands.push(pdfText("Complete JV result table", 38, 770, 17, true), pdfText("Every displayed source-aligned value remains editable in this exported copy.", 38, 748, 7.5, false, "0.38 0.43 0.51"));
    if (report.includeFullTable !== false) {
    const positions = [38, 74, 158, 193, 238, 291, 336, 384, 452];
    const widths = [34, 82, 33, 43, 51, 43, 46, 66, 95];
    const keys = ["sample", "formulation", "batch", "voc", "jsc", "ff", "pce", "stability", "hysteresis"];
    const labels = ["SAMPLE", "FORMULATION", "BATCH", "VOC", "JSC", "FF", "PCE", "STABILITY", "HYSTERESIS"];
    rect(commands, 38, 708, 509, 24, dark);
    labels.forEach((label, index) => commands.push(pdfText(label, positions[index] + 3, 716, index === 1 ? 5.6 : 5.8, true, "1 1 1")));
    data.forEach((item, index) => {
      const rowY = 678 - index * 31;
      const values = [item.sample, item.formulation, item.batch, item.voc, item.jsc, item.ff, item.pce, item.stability, item.hysteresis];
      values.forEach((value, colIndex) => addField(2, `measurements.${index + 1}.${keys[colIndex]}`, value, [positions[colIndex], rowY, positions[colIndex] + widths[colIndex], rowY + 27], { size: colIndex === 1 ? 5.7 : 6.5, align: colIndex >= 3 ? 1 : 0 }));
    });
    } else {
      commands.push(pdfText("Complete measurement table excluded by the author.", 38, 708, 8, false, "0.38 0.43 0.51"));
    }
    commands.push(pdfText(`${chartMeta[0]} comparison`, 38, 414, 12, true, accent), pdfText("All samples | export-time deterministic snapshot", 150, 414, 7, false, "0.38 0.43 0.51"));
    const chartPadding = chartMetric === "pce" ? 0.5 : 1;
    const minPce = Math.min(...data.map((item) => Number(item[chartMetric]))) - chartPadding;
    const maxPce = Math.max(...data.map((item) => Number(item[chartMetric]))) + chartPadding;
    const rangePce = maxPce - minPce || 1;
    data.forEach((item, index) => {
      const barY = 379 - index * 25;
      const barWidth = Math.max(10, ((Number(item[chartMetric]) - minPce) / rangePce) * 365);
      rect(commands, 82, barY, 365, 12, "0.92 0.94 0.97");
      rect(commands, 82, barY, barWidth, 12, accent);
      commands.push(pdfText(item.sample, 38, barY + 3, 7, true), pdfText(`${Number(item[chartMetric]).toFixed(2)}${chartMeta[1]}`, 465, barY + 3, 7, true));
    });
    const stats = [["MEAN PCE", `${mean("pce").toFixed(2)}%`], ["MEAN VOC", `${mean("voc").toFixed(2)} V`], ["MEAN FF", `${mean("ff").toFixed(1)}%`], ["BEST STABILITY", `${best.stability}%`]];
    stats.forEach(([label, value], index) => {
      const x = 38 + index * 128;
      rect(commands, x, 95, 117, 55, index === 0 ? "0.93 0.97 0.98" : "0.96 0.97 0.99", "0.84 0.87 0.91");
      commands.push(pdfText(label, x + 8, 130, 6.5, true, accent), pdfText(value, x + 8, 108, 13, true));
    });
    linesAt(commands, report.resultsNarrative || `Leader: ${best.sample} at ${best.pce.toFixed(2)}% PCE. No row is silently excluded from the report.`, 38, 70, 100, 7.2, 9, "0.38 0.43 0.51", 3);
    } else {
      commands.push(pdfText("Results & Data", 38, 770, 17, true), pdfText("Section excluded by the report author.", 38, 742, 9, false, "0.38 0.43 0.51"));
    }
    pages.push(commands.join("\n"));

    commands = frame(4, "FINDINGS, RESEARCHER DECISION AND PROVENANCE");
    commands.push(pdfText("Evidence-linked findings", 38, 770, 17, true), pdfText("Simulated AI remains advisory and separate from researcher-authored conclusions.", 38, 748, 7.5, false, "0.38 0.43 0.51"));
    let findingY = 714;
    if (sections.has("ai")) findings.forEach((finding, index) => {
      rect(commands, 38, findingY - 38, 509, 44, index % 2 ? "0.97 0.98 0.99" : "0.94 0.97 0.98");
      commands.push(`${accent} rg 38 ${findingY - 38} 4 44 re f`, pdfText(String(finding.score), 50, findingY - 9, 11, true, accent), pdfText(finding.title, 90, findingY - 5, 8, true), pdfText(report.includeEvidence === false ? `Status: ${finding.status}` : `Evidence: ${finding.evidence} | Status: ${finding.status}`, 90, findingY - 28, 6.5, false, "0.38 0.43 0.51"));
      findingY -= 50;
    });
    else commands.push(pdfText("Evidence-Linked Findings excluded by the report author.", 38, 700, 8, false, "0.38 0.43 0.51"));
    if (sections.has("custom")) {
      commands.push(pdfText(`CUSTOM AUTHOR SECTION | ${report.customTitle || "Additional researcher notes"}`, 38, 542, 7, true, accent));
      addField(3, "report.custom_author_section", report.customBody || "No custom text entered.", [38, 470, 547, 530], { multiline: true, size: 7.5 });
    }
    if (sections.has("conclusions")) {
    commands.push(pdfText("EDITABLE RESEARCHER DECISION", 38, 450, 8, true, accent), pdfText("Conclusions", 38, 426, 7, true), pdfText("Limitations", 38, 298, 7, true), pdfText("Approval / signature state", 38, 184, 7, true));
    addField(3, "report.conclusions", report.conclusions || "Pending researcher conclusion.", [38, 316, 547, 416], { multiline: true, size: 8.5 });
    addField(3, "report.limitations", report.limitations || "No limitations entered.", [38, 202, 547, 288], { multiline: true, size: 8.5 });
    addField(3, "report.approval_final", report.approval || "Pending researcher approval", [38, 151, 547, 177], { size: 8 });
    linesAt(commands, report.discussion || "", 310, 426, 45, 6.8, 9, "0.38 0.43 0.51", 4);
    } else commands.push(pdfText("Discussion, Conclusions & Limitations excluded by the report author.", 38, 430, 8, false, "0.38 0.43 0.51"));
    if (sections.has("provenance")) {
    commands.push(pdfText("PROVENANCE CLASSES", 38, 125, 7, true, accent));
    [["RAW", "Local source-aligned measurements"], ["CALCULATED", "Deterministic KPI and comparisons"], ["RESEARCHER", "Objectives, conclusions and approval"], ["AI", "Simulated advice requiring review"]].forEach(([label, detail], index) => {
      const x = 38 + (index % 2) * 256;
      const y = 98 - Math.floor(index / 2) * 30;
      rect(commands, x, y, 248, 25, "0.96 0.97 0.99");
      commands.push(pdfText(label, x + 8, y + 9, 6.5, true, accent), pdfText(detail, x + 70, y + 9, 6.5));
    });
    if (report.includeSourceAppendix !== false) commands.push(pdfText("SOURCES: batch_B03_forward.csv | process_metadata.yaml | SOL-B04 | STK-003/v2", 38, 47, 6.2, false, "0.38 0.43 0.51"));
    } else commands.push(pdfText("Provenance & Approval excluded by the report author.", 38, 110, 8, false, "0.38 0.43 0.51"));
    pages.push(commands.join("\n"));

    const objects = [];
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
    let objectId = 5;
    const pageIds = pages.map(() => objectId++);
    const contentIds = pages.map(() => objectId++);
    const fieldIds = fields.map(() => objectId++);
    const appearanceIds = fields.map(() => objectId++);
    fields.forEach((field, index) => {
      const [x0, y0, x1, y1] = field.rect;
      const width = x1 - x0;
      const height = y1 - y0;
      const inset = 4;
      const approxChars = Math.max(5, Math.floor((width - inset * 2) / (field.size * 0.52)));
      const lines = field.multiline ? pdfLines(field.value, approxChars).slice(0, Math.max(1, Math.floor((height - 8) / (field.size + 3)))) : [field.value];
      const appearance = [`0.985 0.990 0.996 rg 0 0 ${width} ${height} re f`, `${accent} RG 0.65 w 0.5 0.5 ${width - 1} ${height - 1} re S`];
      lines.forEach((line, lineIndex) => {
        const lineWidth = line.length * field.size * 0.52;
        const tx = field.align === 1 ? Math.max(inset, (width - lineWidth) / 2) : inset;
        appearance.push(pdfText(line, tx, height - field.size - 5 - lineIndex * (field.size + 3), field.size));
      });
      const stream = appearance.join("\n");
      objects[appearanceIds[index]] = `<< /Type /XObject /Subtype /Form /BBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
      objects[fieldIds[index]] = `<< /Type /Annot /Subtype /Widget /FT /Tx /T (${pdfSafe(field.name)}) /TU (${pdfSafe(field.name)}) /V (${field.value}) /DV (${field.value}) /Rect [${field.rect.join(" ")}] /P ${pageIds[field.page]} 0 R /F 4 /Ff ${field.multiline ? 4096 : 0} /Q ${field.align} /DA (/F1 ${field.size} Tf 0.12 0.16 0.22 rg) /MK << /BC [${accent}] /BG [0.985 0.990 0.996] >> /BS << /W 0.65 /S /S >> /AP << /N ${appearanceIds[index]} 0 R >> >>`;
    });
    pages.forEach((content, index) => {
      const annotations = fields.map((field, fieldIndex) => field.page === index ? `${fieldIds[fieldIndex]} 0 R` : "").filter(Boolean);
      objects[pageIds[index]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R${annotations.length ? ` /Annots [${annotations.join(" ")}]` : ""} >>`;
      objects[contentIds[index]] = `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`;
    });
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    objects[1] = `<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [${fieldIds.map((id) => `${id} 0 R`).join(" ")}] /DR << /Font << /F1 3 0 R /F2 4 0 R >> >> /DA (/F1 8 Tf 0.12 0.16 0.22 rg) /NeedAppearances false >> >>`;
    let pdf = "%PDF-1.7\n%LabFlow-compact-fillable\n";
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = encoder.encode(pdf).length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = encoder.encode(pdf).length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return encoder.encode(pdf);
  }

  function workbookRaw(project, data, options = {}) {
    const palette = E.palettes[options.palette] || E.palettes.blue;
    const findings = options.findings || [];
    const report = options.report || {};
    const best = data.reduce((current, item) => current.pce > item.pce ? current : item);
    const mean = Number((data.reduce((sum, item) => sum + item.pce, 0) / data.length).toFixed(2));
    const sheets = [
      ["Dashboard", [["LABFLOW ANALYSIS WORKBOOK", "VALUE", "CONTEXT"], ["Project", report.title || project.name, project.id], ["Best PCE", "=MAX('Raw Data'!G2:G9)", best.sample], ["Mean PCE", "=AVERAGE('Raw Data'!G2:G9)", `${data.length} samples`], ["PCE standard deviation", "=STDEV('Raw Data'!G2:G9)", "sample dispersion"], ["Best stability", "=MAX('Raw Data'!H2:H9)", `${best.sample} · % retained`], ["Mean hysteresis", "=AVERAGE('Raw Data'!I2:I9)", "%"], ["Approved findings", findings.filter((item) => item.status === "accepted").length, "researcher-controlled"], ["Approval", report.approval || "Pending researcher approval", "human decision"], ["EDITING LEGEND", "Pale amber = editable input", "Pale green = calculated formula"], ["Recalculation", "Automatic on open", "Charts and summaries follow Raw Data"]], [30, 44, 32], {formulas:true, showGridLines:false}],
      ["Project", [["FIELD", "VALUE"], ["Project ID", project.id], ["Project name", project.name], ["Pipeline", project.pipeline], ["Owner", project.owner], ["Status", project.status], ["Progress (%)", project.progress], ["Objective", project.objective], ["Report title", report.title || project.name], ["Report subtitle", report.subtitle || "Scientific project report"], ["Executive summary", report.executiveSummary || project.objective], ["Methodology", report.methodology || "Structured preparation, mapped measurements and deterministic analysis."], ["Conclusions", report.conclusions || "Pending researcher conclusion."], ["Limitations", report.limitations || "No limitations entered."], ["Approval", report.approval || "Pending researcher approval"]], [24, 90], {editable:true, editableColumns:[2]}],
      ["Solutions", [["SOLUTION ID", "RECIPE", "CONCENTRATION", "SOLVENT", "VOLUME", "STATUS"], ["SOL-B01", "FA/MA reference", "1.25 mol/L", "DMF:DMSO 4:1", "2.0 mL", "Reviewed"], ["SOL-B02", "FA/MA reference", "1.25 mol/L", "DMF:DMSO 4:1", "2.5 mL", "Reviewed"], ["SOL-B03", "FA/MA variant", "1.30 mol/L", "DMF:DMSO 4:1", "1.5 mL", "Review"]], [16, 24, 18, 20, 14, 14], {editable:true}],
      ["Stack", [["ORDER", "MATERIAL", "THICKNESS", "FUNCTION", "PROCESS"], [1, "Glass / FTO", "2.2 mm", "Substrate", "Cleaning"], [2, "SnO₂", "32 nm", "Electron transport", "Spin coat"], [3, "FA/MA perovskite", "540 nm", "Absorber", "Anti-solvent"], [4, "Spiro-OMeTAD", "180 nm", "Hole transport", "Spin coat"], [5, "Au", "80 nm", "Back contact", "Evaporation"]], [10, 24, 16, 24, 18], {editable:true}],
      ["Raw Data", [["SAMPLE", "FORMULATION", "BATCH", "VOC (V)", "JSC (mA/cm²)", "FF (%)", "PCE (%)", "STABILITY (%)", "HYSTERESIS (%)"], ...data.map((item) => [item.sample, item.formulation, item.batch, item.voc, item.jsc, item.ff, item.pce, item.stability, item.hysteresis])], [12, 24, 12, 12, 16, 12, 12, 16, 18], {editable:true}],
      ["Processed Data", [["SAMPLE", "NORMALIZED PCE", "PCE DELTA VS MEAN", "OUTLIER FLAG", "INCLUDED IN REPORT"], ...data.map((item, index) => [item.sample, `='Raw Data'!G${index + 2}/MAX('Raw Data'!$G$2:$G$9)`, `='Raw Data'!G${index + 2}-AVERAGE('Raw Data'!$G$2:$G$9)`, `=IF('Raw Data'!G${index + 2}<18,"Review","No")`, "Yes"])], [12, 18, 20, 16, 22], {formulas:true, editable:true, editableColumns:[5]}],
      ["Analysis", [["METHOD", "RESULT", "TYPE", "REPORT STATUS"], ["Descriptive statistics", `Mean PCE ${mean}%`, "Deterministic", "Included"], ["Trend", `${best.formulation} leads`, "Deterministic", "Included"], ["Outlier review", "S06 requires process review", "Deterministic", "Included"], ["Correlation preview", "Stability inversely associated with hysteresis", "Deterministic", "Included"], ["Batch comparison", "Formulation effect exceeds batch effect", "Deterministic", "Included"]], [28, 62, 18, 18]],
      ["AI Findings", [["SCORE", "FINDING", "DETAIL", "EVIDENCE", "STATUS", "ORIGIN"], ...findings.map((item) => [item.score, item.title, item.detail, item.evidence, item.status, "Simulated AI"] )], [12, 38, 70, 28, 16, 18]],
      ["Provenance", [["ENTITY", "SOURCE", "TRANSFORMATION", "OWNER", "STATUS"], ["Measurements", "12 local instrument files", "Mapped to JV summary", project.owner, "Reviewed"], ["Processed data", "Raw Data sheet", "Normalization + grouped statistics", project.owner, "Deterministic"], ["AI findings", "Project + approved KB", "Fixed local demonstration rules", "LabFlow POC", "Simulated"], ["Conclusions", "Approved results + human notes", "Editable report builder", project.owner, report.approval || "Pending"]], [24, 38, 42, 24, 18]],
      ["Export Manifest", [["FILE / SHEET", "PURPOSE", "FORMAT", "PALETTE"], ["Dashboard", "Decision overview", "Worksheet", palette.name], ["Project", "Project metadata", "Worksheet", palette.name], ["Solutions", "Preparation records", "Worksheet", palette.name], ["Stack", "Device architecture", "Worksheet", palette.name], ["Raw Data", "Source-aligned values", "Worksheet", palette.name], ["Processed Data", "Derived values", "Worksheet", palette.name], ["Analysis", "Deterministic results", "Worksheet", palette.name], ["AI Findings", "Simulated advisory output", "Worksheet", palette.name], ["Provenance", "Evidence lineage", "Worksheet", palette.name], ["Export Manifest", "Workbook inventory", "Worksheet", palette.name]], [28, 42, 18, 22]]
    ];
    const styleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/><color rgb="FF273448"/></font><font><b/><sz val="10"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F7FA"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${palette.strong}"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F7EE"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD7DEE8"/></left><right style="thin"><color rgb="FFD7DEE8"/></right><top style="thin"><color rgb="FFD7DEE8"/></top><bottom style="thin"><color rgb="FFD7DEE8"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fillId="2" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fillId="4" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fillId="5" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const types = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
    const workbook = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
    const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    return E.zipBytes([
      { name: "[Content_Types].xml", data: types },
      { name: "_rels/.rels", data: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: workbook },
      { name: "xl/_rels/workbook.xml.rels", data: rels },
      { name: "xl/styles.xml", data: styleXml },
      ...sheets.map(([name, rows, widths, config], index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheet(rows, widths, config?.filter !== false, config || {}) }))
    ]);
  }

  function genericWorkbookRaw(inputSheets, paletteId = "blue") {
    const palette = E.palettes[paletteId] || E.palettes.blue;
    const usedNames = new Set();
    const sheets = inputSheets.map((input, index) => {
      const base = String(input.name || `Sheet ${index + 1}`).replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31) || `Sheet ${index + 1}`;
      let name = base; let suffix = 2;
      while (usedNames.has(name)) name = `${base.slice(0, 27)} ${suffix++}`;
      usedNames.add(name);
      const rows = input.rows?.length ? input.rows.map((values) => values.map((value) => {
        const trimmed = String(value ?? "").trim();
        return trimmed !== "" && Number.isFinite(Number(trimmed)) ? Number(trimmed) : value;
      })) : [[""]];
      const columnCount = Math.max(...rows.map((values) => values.length), 1);
      return [name, rows, Array.from({length:columnCount}, () => 18)];
    });
    const styleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/><color rgb="FF273448"/></font><font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F7FA"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${palette.strong}"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD7DEE8"/></left><right style="thin"><color rgb="FFD7DEE8"/></right><top style="thin"><color rgb="FFD7DEE8"/></top><bottom style="thin"><color rgb="FFD7DEE8"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fillId="2" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const types = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
    const workbook = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
    const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    return E.zipBytes([
      {name:"[Content_Types].xml",data:types},
      {name:"_rels/.rels",data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
      {name:"xl/workbook.xml",data:workbook},{name:"xl/_rels/workbook.xml.rels",data:rels},{name:"xl/styles.xml",data:styleXml},
      ...sheets.map(([,rows,widths],index) => ({name:`xl/worksheets/sheet${index + 1}.xml`,data:sheet(rows,widths)}))
    ]);
  }

  const wordRun = (value, properties = "") => `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
  const wordParagraph = (value, style = "BodyText") => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${wordRun(value)}</w:p>`;
  const wordEditable = (label, value, tag) => `${wordParagraph(label, "Heading2")}<w:sdt><w:sdtPr><w:alias w:val="${xml(label)}"/><w:tag w:val="${xml(tag)}"/><w:text w:multiLine="1"/></w:sdtPr><w:sdtContent><w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="FFF3D6"/><w:spacing w:before="100" w:after="180"/><w:ind w:left="120" w:right="120"/></w:pPr>${wordRun(value)}</w:p></w:sdtContent></w:sdt>`;
  const wordTable = (rows, accent) => `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${Array.from({length:Math.max(...rows.map((values) => values.length), 1)}, () => '<w:gridCol w:w="1200"/>').join("")}</w:tblGrid>${rows.map((values, rowIndex) => `<w:tr>${values.map((value) => `<w:tc><w:tcPr>${rowIndex === 0 ? `<w:shd w:val="clear" w:color="auto" w:fill="${accent}"/>` : ""}</w:tcPr><w:p>${wordRun(value, rowIndex === 0 ? '<w:b/><w:color w:val="FFFFFF"/>' : "")}</w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  const wordPageBreak = () => `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  const wordToc = () => `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Update this field in Word to refresh the table of contents.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
  function genericDocxRaw(input, paletteId = "blue") {
    const palette = E.palettes[paletteId] || E.palettes.blue;
    const body = String(input.body || "").split(/\r?\n/).map((line) => {
      const heading = line.match(/^(#{1,2})\s+(.+)$/);
      return wordParagraph(heading ? heading[2] : line || " ", heading ? (heading[1].length === 1 ? "Heading1" : "Heading2") : "BodyText");
    }).join("");
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${wordParagraph(input.title || "Untitled document","Title")}${wordParagraph(input.subtitle || "LabFlow working document","Subtitle")}${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/><w:color w:val="273448"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="${palette.dark}"/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="${palette.strong}"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:color w:val="${palette.strong}"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:color w:val="${palette.dark}"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;
    return E.zipBytes([
      {name:"[Content_Types].xml",data:`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`},
      {name:"_rels/.rels",data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
      {name:"word/document.xml",data:document},{name:"word/styles.xml",data:styles},
      {name:"word/_rels/document.xml.rels",data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`}
    ]);
  }
  function editableDocxRaw(project, data, options = {}) {
    const palette = E.palettes[options.palette] || E.palettes.blue;
    const report = options.report || {};
    const sections = new Set(report.sections || ["summary", "methods", "results", "ai", "conclusions", "provenance"]);
    const findings = options.findings || [];
    const best = data.reduce((current, item) => current.pce > item.pce ? current : item);
    const mean = (key) => (data.reduce((sum, item) => sum + Number(item[key] || 0), 0) / Math.max(1, data.length)).toFixed(2);
    const accent = palette.strong;
    const dark = palette.dark;
    const soft = "EEF4F5";
    const line = "D6DEE8";
    const body = "273448";
    const muted = "667085";
    const author = report.author || options.user?.name || project.owner;
    const laboratory = report.laboratory || options.user?.laboratory || "Laboratory";
    const organisation = report.organisation || options.user?.organisation || "Organisation";
    const textRun = (value, properties = "") => `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
    const paragraph = (value, style = "BodyText", properties = "", runProperties = "") => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${properties}</w:pPr>${textRun(value, runProperties)}</w:p>`;
    const spacer = (after = 90) => `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr></w:p>`;
    const pageBreak = () => `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    const editable = (label, value, tag) => `${paragraph(label, "FieldLabel")}<w:sdt><w:sdtPr><w:alias w:val="${xml(label)}"/><w:tag w:val="${xml(tag)}"/><w:text w:multiLine="1"/></w:sdtPr><w:sdtContent><w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="FFF8E8"/><w:spacing w:before="100" w:after="160"/><w:ind w:left="150" w:right="150"/><w:pbdr><w:left w:val="single" w:sz="14" w:space="5" w:color="${accent}"/></w:pbdr></w:pPr>${textRun(value || " ", `<w:color w:val="${body}"/>`)}</w:p></w:sdtContent></w:sdt>`;
    const cellXml = (value, width, config = {}) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${config.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${config.fill}"/>` : ""}<w:tcMar><w:top w:w="75" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="75" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar><w:vAlign w:val="${config.valign || "center"}"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/>${config.align ? `<w:jc w:val="${config.align}"/>` : ""}</w:pPr>${textRun(value, `${config.bold ? "<w:b/>" : ""}${config.colour ? `<w:color w:val="${config.colour}"/>` : ""}${config.size ? `<w:sz w:val="${config.size}"/>` : ""}`)}</w:p></w:tc>`;
    const tableXml = (rows, widths, config = {}) => `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="${line}"/><w:left w:val="single" w:sz="4" w:color="${line}"/><w:bottom w:val="single" w:sz="4" w:color="${line}"/><w:right w:val="single" w:sz="4" w:color="${line}"/><w:insideH w:val="single" w:sz="3" w:color="${line}"/><w:insideV w:val="single" w:sz="3" w:color="${line}"/></w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="75" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="75" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${rows.map((values, rowIndex) => `<w:tr>${rowIndex === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ""}${values.map((value, colIndex) => cellXml(String(value ?? ""), widths[colIndex], rowIndex === 0 ? {fill:accent,bold:true,colour:"FFFFFF",size:"17"} : {fill:rowIndex % 2 === 0 ? "F7F9FB" : "FFFFFF",size:config.fontSize || "17",align:config.numericColumns?.includes(colIndex) ? "right" : "left",valign:"top"})).join("")}</w:tr>`).join("")}</w:tbl>`;
    const infoTable = (items) => tableXml([items.map(([label]) => label), items.map(([,value]) => value)], Array(items.length).fill(Math.floor(9400 / items.length)), {fontSize:"18"});
    const sectionHeading = (index, title, detail = "") => `<w:tbl><w:tblPr><w:tblW w:w="9400" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:bottom w:val="single" w:sz="12" w:color="${accent}"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="900"/><w:gridCol w:w="8500"/></w:tblGrid><w:tr>${cellXml(index,900,{fill:accent,bold:true,colour:"FFFFFF",size:"18",align:"center"})}${cellXml(`${title}${detail ? ` | ${detail}` : ""}`,8500,{bold:true,colour:dark,size:"24"})}</w:tr></w:tbl>${spacer(80)}`;
    const cover = `<w:tbl><w:tblPr><w:tblW w:w="9400" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9400"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="9400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${dark}"/><w:tcMar><w:top w:w="700" w:type="dxa"/><w:left w:w="600" w:type="dxa"/><w:bottom w:w="700" w:type="dxa"/><w:right w:w="600" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(`LABFLOW / ${(report.reportType || "Scientific project report").toUpperCase()}`,"CoverEyebrow","",`<w:b/><w:color w:val="${accent}"/><w:sz w:val="20"/>`)}${paragraph(report.title || project.name,"CoverTitle","",'<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="48"/>')}${paragraph(report.subtitle || "Scientific project report","CoverSubtitle","",'<w:color w:val="D8E2EE"/><w:sz w:val="25"/>')}${spacer(180)}${paragraph(`${report.reportCode || project.id}  |  ${report.reportDate || ""}`,"CoverMeta","",'<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/>')}${paragraph(`${author}  |  ${laboratory}`,"CoverMeta","",'<w:color w:val="D8E2EE"/><w:sz w:val="18"/>')}${paragraph(report.approval || "Pending researcher approval","CoverMeta","",`<w:b/><w:color w:val="${accent}"/><w:sz w:val="18"/>`)}</w:tc></w:tr></w:tbl>${spacer(150)}${paragraph(`Keywords: ${report.keywords || ""}`,"SmallText")}`;
    let content = cover;
    if (sections.has("summary")) {
      content += sectionHeading("01", "Executive Snapshot", "decision-ready project summary") + editable("Executive summary", report.executiveSummary || project.objective, "report.executiveSummary") + editable("Research objectives", report.objectives || project.objective, "report.objectives") + infoTable([["BEST PCE",`${best.pce.toFixed(2)}% / ${best.sample}`],["MEAN PCE",`${mean("pce")}%`],["BEST STABILITY",`${best.stability}%`],["MEAN VOC",`${mean("voc")} V`],["OPEN ISSUES","3"]]);
    }
    content += pageBreak();
    if (sections.has("methods")) {
      content += sectionHeading("02", "Materials, Process and Experiments", "traceable preparation") + editable("Methodology", report.methodology || "Structured preparation, mapped measurements and deterministic analysis.", "report.methodology") + paragraph("Solution Review / SOL-B04","Heading2") + tableXml([["Component","Function","Quantity","Composition"],["DMF","Primary solvent","1.60 mL","80% v/v"],["DMSO","Co-solvent","0.40 mL","20% v/v"],["FAI","A-site solute","365.3 mg","90 mol%"],["MAI","A-site solute","39.7 mg","10 mol%"],["PbI2","Lead halide","1152.5 mg","1.00 eq"]],[1500,3600,1800,2500],{fontSize:"17"}) + paragraph("Device Stack / STK-003 v2","Heading2") + tableXml([["Order","Material","Function","Thickness"],["05","Au","Back contact","80 nm"],["04","Spiro-OMeTAD","Hole transport","180 nm"],["03","FA/MA perovskite","Photoactive absorber","540 nm"],["02","SnO2","Electron transport","32 nm"],["01","Glass / FTO","Substrate + front contact","2.2 mm"]],[900,2500,4200,1800],{fontSize:"17"});
      if (report.includeExperiments !== false) content += paragraph("Experiment Coverage","Heading2") + tableXml([["Experiment","Samples","Process","Measurements","Status"],["EXP-041","S01-S03","100 C / 30 min","6","Reviewed"],["EXP-052","S04-S05","105 C / 25 min","4","Reviewed"],["EXP-067","S06-S08","100 / unit missing","24","Review"]],[1300,1600,3000,1700,1800],{fontSize:"17"});
      if (report.includeQualityReview !== false) content += paragraph("Data-quality review","Heading2") + tableXml([["Severity","Issue","Effect"],["Error","Device count mismatch","Resolve before final interpretation"],["Warning","Annealing unit missing","Comparison retained with caveat"],["Warning","Solution provenance incomplete","Causal inference blocked"]],[1300,3500,4600],{fontSize:"17"});
    }
    content += pageBreak();
    if (sections.has("results")) {
      content += sectionHeading("03", "Complete Results", "source-aligned measurements") + paragraph(`${{pce:"PCE",stability:"Stability",hysteresis:"Hysteresis"}[report.chartMetric] || "PCE"} performance overview`,"Heading2") + tableXml([["Sample","Formulation","PCE (%)","Stability (%)","Hysteresis (%)"],...data.map((item)=>[item.sample,item.formulation,item.pce,item.stability,item.hysteresis])],[1100,3100,1700,1800,1700],{fontSize:"17",numericColumns:[2,3,4]});
      if (report.includeFullTable !== false) {
        content += paragraph("Complete measurement table","Heading2") + tableXml([["Sample","Formulation","Batch","Voc (V)","Jsc","FF (%)","PCE (%)"],...data.map((item)=>[item.sample,item.formulation,item.batch,item.voc,item.jsc,item.ff,item.pce])],[900,2450,900,1050,1200,1200,1700],{fontSize:"15",numericColumns:[3,4,5,6]}) + spacer(60) + tableXml([["Sample","Stability (%)","Hysteresis (%)"],...data.map((item)=>[item.sample,item.stability,item.hysteresis])],[2200,3600,3600],{fontSize:"17",numericColumns:[1,2]});
      }
      content += editable("Researcher interpretation", report.resultsNarrative || `${best.sample} is the current leader at ${best.pce}% PCE.`, "report.resultsNarrative");
    }
    content += pageBreak();
    if (sections.has("ai")) {
      content += sectionHeading("04", "Evidence-Linked Findings", "advisory review") + paragraph("AI-assisted findings are simulated and remain separate from researcher conclusions.","Callout") + tableXml([["Score","Finding","Detail","Evidence","Status"],...findings.map((item)=>[item.score,item.title,item.detail,report.includeEvidence === false ? "Hidden by author" : item.evidence,item.status])],[800,2100,3000,2500,1000],{fontSize:"15"});
    }
    if (sections.has("conclusions")) {
      content += sectionHeading("05", "Researcher Decision", "interpretation and boundaries") + editable("Discussion", report.discussion || "", "report.discussion") + editable("Conclusions", report.conclusions || "Pending researcher conclusion.", "report.conclusions") + editable("Limitations", report.limitations || "No limitations entered.", "report.limitations");
    }
    if (sections.has("custom")) content += sectionHeading("06", report.customTitle || "Custom Author Section") + editable(report.customTitle || "Custom author section", report.customBody || "No custom text entered.", "report.customBody");
    if (sections.has("provenance")) {
      content += sectionHeading(sections.has("custom") ? "07" : "06", "Provenance and Approval", "evidence classes and final state") + tableXml([["Evidence class","Origin","Control"],["Raw","Local measurement files","Preserved"],["Calculated","Deterministic transformations","Reproducible"],["Researcher","Objectives, interpretation and approval","Human authored"],["AI","Local demonstration rules","Researcher review"]],[1800,4100,3500],{fontSize:"17"});
      if (report.includeSourceAppendix !== false) content += paragraph("Source appendix","Heading2") + paragraph("batch_B03_forward.csv - source-aligned JV measurements; process_metadata.yaml - process metadata; SOL-B04 - reviewed solution snapshot; STK-003/v2 - versioned device architecture.","SmallText");
      content += editable("Approval / signature state", report.approval || "Pending researcher approval", "report.approval");
    }
    content += `<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="650" w:right="700" w:bottom="700" w:left="700" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>`;
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${content}</w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos"/><w:sz w:val="19"/><w:color w:val="${body}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="90" w:line="255" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="100" w:line="265" w:lineRule="auto"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:before="180" w:after="90"/></w:pPr><w:rPr><w:b/><w:color w:val="${accent}"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="150" w:after="70"/></w:pPr><w:rPr><w:b/><w:color w:val="${dark}"/><w:sz w:val="23"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="FieldLabel"><w:name w:val="Field Label"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="100" w:after="45"/></w:pPr><w:rPr><w:b/><w:color w:val="${accent}"/><w:sz w:val="17"/><w:caps/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Callout"><w:name w:val="Callout"/><w:basedOn w:val="BodyText"/><w:pPr><w:shd w:val="clear" w:fill="${soft}"/><w:ind w:left="160" w:right="160"/><w:spacing w:before="100" w:after="120"/></w:pPr><w:rPr><w:color w:val="${muted}"/><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="SmallText"><w:name w:val="Small Text"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="${muted}"/><w:sz w:val="16"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CoverEyebrow"><w:name w:val="Cover Eyebrow"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="CoverTitle"><w:name w:val="Cover Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="180" w:after="60"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="CoverSubtitle"><w:name w:val="Cover Subtitle"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="CoverMeta"><w:name w:val="Cover Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="45"/></w:pPr></w:style></w:styles>`;
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:tbl><w:tblPr><w:tblW w:w="9400" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="6" w:color="${accent}"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4700"/><w:gridCol w:w="4700"/></w:tblGrid><w:tr>${cellXml("LABFLOW",4700,{bold:true,colour:accent,size:"18"})}${cellXml(`${report.reportCode || project.id}  |  ${report.reportType || "Scientific project report"}`,4700,{colour:muted,size:"16",align:"right"})}</w:tr></w:tbl></w:hdr>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${line}"/></w:pBdr></w:pPr>${textRun(`${organisation}  |  ${report.approval || "Pending approval"}  |  Page `,`<w:color w:val="${muted}"/><w:sz w:val="15"/>`)}<w:r><w:rPr><w:color w:val="${accent}"/><w:b/><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
    return E.zipBytes([
      { name: "[Content_Types].xml", data: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
      { name: "word/document.xml", data: document }, { name: "word/styles.xml", data: styles }, { name: "word/header1.xml", data: header }, { name: "word/footer1.xml", data: footer },
      { name: "word/settings.xml", data: `<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` },
      { name: "docProps/core.xml", data: `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(report.title || project.name)}</dc:title><dc:creator>${xml(author)}</dc:creator><dc:subject>${xml(report.reportType || "LabFlow scientific report")}</dc:subject><dc:description>Professional editable LabFlow report generated from the current Report Composer state.</dc:description><cp:keywords>${xml(report.keywords || "")}</cp:keywords></cp:coreProperties>` },
      { name: "docProps/app.xml", data: `<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LabFlow</Application><Company>${xml(organisation)}</Company></Properties>` },
      { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>` }
    ]);
  }

  E.workbookRaw = workbookRaw;
  E.genericWorkbookRaw = genericWorkbookRaw;
  E.genericWorkbook = (sheets, palette) => new Blob([genericWorkbookRaw(sheets, palette)], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  E.genericDocxRaw = genericDocxRaw;
  E.genericDocx = (input, palette) => new Blob([genericDocxRaw(input, palette)], {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  E.editablePdfRaw = editablePdfRaw;
  E.reportPdf = (project, data, options) => new Blob([editablePdfRaw(project, data, options)], { type: "application/pdf" });
  E.editableDocxRaw = editableDocxRaw;
  E.reportDocx = (project, data, options) => new Blob([editableDocxRaw(project, data, options)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  E.reportXlsx = (project, data, options) => new Blob([workbookRaw(project, data, options)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  E.bundle = (project, pipeline, data, nomad = false, options = {}) => {
    const files = [
      { name: "project.yaml", data: E.projectYaml(project, pipeline) },
      { name: "data/measurements.jsonl", data: E.jsonl(project, data) },
      { name: "data/measurements.csv", data: E.csv(data) },
      { name: "report/scientific-report.pdf", data: editablePdfRaw(project, data, options) },
      { name: "report/editable-report.docx", data: editableDocxRaw(project, data, options) },
      { name: "report/analysis-workbook.xlsx", data: workbookRaw(project, data, options) },
      { name: "knowledge/linked-context.yaml", data: (options.knowledge || []).map((item) => `- id: ${item.id}\n  type: "${item.type}"\n  title: "${item.title.replace(/"/g, '\\"')}"\n  status: "${item.status}"`).join("\n") + "\n" },
      { name: "MANIFEST.txt", data: "LabFlow portable project package\nGenerated locally in the browser.\nIncludes structured data, native PDF, editable DOCX, analysis workbook and linked knowledge.\n" }
    ];
    if (nomad) files.push({ name: "nomad.yaml", data: E.nomadYaml(project) }, { name: "NOMAD_VALIDATION.txt", data: "Preview only. Confirm inferred units and complete missing metadata before upload.\n" });
    return new Blob([E.zipBytes(files)], { type: "application/zip" });
  };
})();
