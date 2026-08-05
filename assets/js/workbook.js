(function () {
  "use strict";
  const E = window.LabFlowExport;
  const Log = window.LabFlowLogger?.child("workbook") || {debug(){},info(){},warn(){},error(){},time(){return () => {};}};
  const asArray = (value) => Array.isArray(value) ? value : [];
  const deepGet = (value, path, fallback = undefined) => {
    const keys = Array.isArray(path) ? path : String(path || "").split(".").filter(Boolean);
    let current = value;
    for (const key of keys) {
      if (current == null || typeof current !== "object" || !(key in current)) return fallback;
      current = current[key];
    }
    return current == null ? fallback : current;
  };
  const pipelineResource = (pipeline, group, key, fallback = {}) => deepGet(pipeline, ["resources", group, key], fallback);
  const quantityText = (value, fallback = "—") => value && typeof value === "object" && value.value != null
    ? `${value.value}${value.unit ? ` ${value.unit}` : ""}`
    : (value == null || value === "" ? fallback : String(value));
  const titleCase = (value) => String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const unique = (values) => [...new Set(values.filter((value) => value != null && String(value).trim()))];
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
  const pdfAscii = (value) => String(value ?? "")
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[·•]/g, "|")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/([\\()])/g, "\\$1");
  const pdfRgb = (hex) => {
    const value = String(hex || "000000").replace("#", "");
    return [0, 2, 4].map((index) => (parseInt(value.slice(index, index + 2), 16) / 255).toFixed(3)).join(" ");
  };
  const pdfTextWidth = (value, size, bold = false) => pdfAscii(value).length * size * (bold ? 0.56 : 0.50);
  const pdfWrap = (value, width, size, bold = false, maxLines = 99) => {
    const words = pdfAscii(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && pdfTextWidth(candidate, size, bold) > width) { lines.push(line); line = word; }
      else line = candidate;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/\s+\S*$/, "")}...`;
      return clipped;
    }
    return lines.length ? lines : [""];
  };
  function buildReportDocument(project, data, options = {}) {
    Log.debug("report-model.build", { projectId: project?.id, rows: data?.length || 0 });
    const pipeline = options.pipeline || window.LabFlowPipelines?.chose || {};
    const processRecord = options.processRecord || pipelineResource(pipeline, "demo", "process", {});
    const experimentRecord = options.experimentRecord || pipelineResource(pipeline, "demo", "experiment", {});
    const resultsRecord = options.resultsRecord || pipelineResource(pipeline, "demo", "results", {});
    const reviewRecord = options.reviewRecord || pipelineResource(pipeline, "demo", "review", {});
    const reportDefaults = reviewRecord.report?.defaults || {};
    const report = { ...reportDefaults, ...(options.report || {}) };
    const rows = asArray(data).length
      ? asArray(data).map((row) => ({ ...row }))
      : asArray(resultsRecord.normalized_records).map((row) => ({ ...row }));
    const defaultSections = asArray(reviewRecord.report?.section_catalog)
      .filter((item) => item.enabled_by_default !== false)
      .map((item) => item.id);
    const sections = Array.isArray(report.sections) ? [...report.sections] : (defaultSections.length ? defaultSections : ["summary", "methods", "results", "ai", "conclusions", "provenance"]);
    const best = rows.length ? [...rows].sort((a, b) => Number(b.pce || 0) - Number(a.pce || 0))[0] : {};
    const mean = {};
    ["voc", "jsc", "ff", "pce", "stability", "hysteresis"].forEach((key) => {
      mean[key] = rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0;
    });
    const metricDefinitions = asArray(reviewRecord.overview?.chart_metrics);
    const allowedMetrics = metricDefinitions.map((item) => item.id);
    const metric = allowedMetrics.includes(report.chartMetric) ? report.chartMetric : (allowedMetrics[0] || "pce");
    const metricDefinition = metricDefinitions.find((item) => item.id === metric) || {label:titleCase(metric), suffix:"", decimals:2};
    const metricValues = rows.map((row) => Number(row[metric] || 0));
    const padding = metric === "pce" ? 0.5 : 1;
    const minValue = metricValues.length ? Math.min(...metricValues) - padding : 0;
    const maxValue = metricValues.length ? Math.max(...metricValues) + padding : 1;

    const solutionDefinitions = asArray(processRecord.solution_definitions);
    const solutionDefinition = options.solutionDefinition || solutionDefinitions[0] || {};
    const solution = asArray(solutionDefinition.components).map((component) => [
      component.name || "—",
      component.role || component.phase || "—",
      component.amount || "—",
      component.share || "—"
    ]);
    const solventComponents = asArray(solutionDefinition.components).filter((component) => component.phase === "solvent");
    const solutionMeta = {
      id: solutionDefinition.id || "—",
      version: solutionDefinition.version || 1,
      label: solutionDefinition.id ? `${solutionDefinition.id}/v${solutionDefinition.version || 1}` : "Solution definition",
      name: solutionDefinition.name || "Solution definition",
      concentration: quantityText(solutionDefinition.target_concentration),
      volume: quantityText(solutionDefinition.reference_volume),
      solventRatio: solutionDefinition.solvent_ratio || "—",
      status: titleCase(solutionDefinition.status || "draft")
    };

    const stack = processRecord.stack || {};
    const stackLayers = asArray(options.stackLayers).length ? asArray(options.stackLayers) : asArray(stack.layers);
    const stackMeta = {
      id: stack.id || "—",
      version: stack.version || 1,
      label: stack.id ? `${stack.id}/v${stack.version || 1}` : "Stack definition",
      architecture: stack.architecture || "—"
    };

    const rawFindings = asArray(options.findings).length ? asArray(options.findings) : asArray(reviewRecord.findings);
    const statusMap = {accepted:"accepted", needs_revision:"review", proposed:"action", rejected:"review"};
    const findings = rawFindings.map((item) => ({
      score: Number(item.score) || 0,
      title: item.title || item.statement || "Untitled finding",
      detail: item.detail || item.statement || "",
      evidence: item.evidence || item.evidence_label || asArray(item.evidence_refs).join(" · ") || "No evidence linked",
      status: item.status || statusMap[item.review_status] || "review",
      type: item.type || "observation",
      id: item.id || item.finding_id || ""
    }));

    const experimentCoverage = asArray(reviewRecord.report?.experiment_coverage);
    const experiments = (experimentCoverage.length ? experimentCoverage : asArray(options.experiments))
      .filter((item) => !item.project || item.project === project.id);
    const qualityIssues = asArray(options.qualityIssues).length ? asArray(options.qualityIssues) : asArray(resultsRecord.quality_issues);
    const quality = qualityIssues.slice(0, 3).map((item) => [String(item.severity || "information").toUpperCase(), item.title || item.detail || "Quality issue"]);
    const sourceFiles = asArray(resultsRecord.source_files);
    const sources = unique([
      ...sourceFiles.map((item) => item.file_name),
      processRecord.process?.stable_label,
      solutionMeta.label,
      stackMeta.label,
      resultsRecord.result_set?.result_set_id
    ]);
    const sourceEntries = [
      ...sourceFiles.map((item) => ({id:item.file_name, detail:`${item.measurement_type || "Scientific source"} · ${item.rows || 0} rows`})),
      ...(processRecord.process?.stable_label ? [{id:processRecord.process.stable_label, detail:"Versioned process definition"}] : []),
      ...(solutionDefinition.id ? [{id:solutionMeta.label, detail:"Versioned solution definition"}] : []),
      ...(stack.id ? [{id:stackMeta.label, detail:"Versioned device architecture"}] : [])
    ];
    const provenanceManifest = asArray(reviewRecord.provenance_manifest);
    const openIssueCount = qualityIssues.filter((item) => ["error", "warning"].includes(item.severity)).length;
    const preparedBatches = asArray(experimentRecord.batches);
    const process = processRecord.process || {};
    const review = reviewRecord.review || {};

    return {
      project,
      pipeline,
      processRecord,
      experimentRecord,
      resultsRecord,
      reviewRecord,
      process,
      review,
      report,
      rows,
      sections,
      sectionSet: new Set(sections),
      best,
      mean,
      metric,
      metricLabel: metricDefinition.label || titleCase(metric),
      metricSuffix: metricDefinition.suffix || "",
      metricDecimals: Number.isInteger(metricDefinition.decimals) ? metricDefinition.decimals : 2,
      minValue,
      maxValue,
      metricRange: maxValue - minValue || 1,
      findings,
      experiments,
      knowledgeCount: asArray(options.knowledge).length,
      solutionDefinitions,
      solutionDefinition,
      solution,
      solventComponents,
      solutionMeta,
      preparedBatches,
      stack,
      stackLayers,
      stackMeta,
      qualityIssues,
      quality,
      sourceFiles,
      sourceEntries,
      sources,
      provenanceManifest,
      exportManifest: reviewRecord.export_manifest || {},
      openIssueCount
    };
  }

  class ReportPdfPage {
    constructor(palette, number, title, report) {
      this.commands = [];
      this.palette = palette;
      this.number = number;
      this.report = report;
      this.accent = pdfRgb(palette.strong || palette.hex);
      this.dark = pdfRgb(palette.dark);
      this.text = "0.12 0.16 0.22";
      this.muted = "0.38 0.43 0.51";
      this.rule = "0.83 0.86 0.90";
      this.soft = "0.96 0.97 0.98";
      this.white = "1 1 1";
      this.rect(0, 0, 595, 842, this.white);
      if (number > 1) this.runningHeader(title);
    }
    y(top, size = 0) { return 842 - top - size; }
    rect(x, top, width, height, fill, stroke = null, lineWidth = 0.6) {
      const y = 842 - top - height;
      if (fill) this.commands.push(`${fill} rg ${x} ${y} ${width} ${height} re f`);
      if (stroke) this.commands.push(`${stroke} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S`);
    }
    line(x1, top1, x2, top2, colour = this.rule, width = 0.7) {
      this.commands.push(`${colour} RG ${width} w ${x1} ${842 - top1} m ${x2} ${842 - top2} l S`);
    }
    textAt(value, x, top, size = 9, font = "F1", colour = this.text, align = "left") {
      const safe = pdfAscii(value);
      let tx = x;
      if (align !== "left") {
        const width = pdfTextWidth(safe, size, font === "F2");
        if (align === "right") tx -= width;
        if (align === "center") tx -= width / 2;
      }
      this.commands.push(`${colour} rg BT /${font} ${size} Tf ${tx.toFixed(2)} ${this.y(top, size).toFixed(2)} Td (${safe}) Tj ET`);
    }
    wrapped(value, x, top, width, size = 9, leading = 12, font = "F1", colour = this.text, maxLines = 99) {
      const lines = pdfWrap(value, width, size, font === "F2", maxLines);
      lines.forEach((line, index) => this.textAt(line, x, top + index * leading, size, font, colour));
      return top + lines.length * leading;
    }
    circle(cx, topCenter, radius, fill, stroke = null, lineWidth = 0.6) {
      const cy = 842 - topCenter;
      const k = radius * 0.5522847498;
      const path = `${cx + radius} ${cy} m ${cx + radius} ${cy + k} ${cx + k} ${cy + radius} ${cx} ${cy + radius} c ${cx - k} ${cy + radius} ${cx - radius} ${cy + k} ${cx - radius} ${cy} c ${cx - radius} ${cy - k} ${cx - k} ${cy - radius} ${cx} ${cy - radius} c ${cx + k} ${cy - radius} ${cx + radius} ${cy - k} ${cx + radius} ${cy} c`;
      if (fill) this.commands.push(`${fill} rg ${path} f`);
      if (stroke) this.commands.push(`${stroke} RG ${lineWidth} w ${path} S`);
    }
    brandMark(x, top, scale = 1, light = false) {
      const ink = light ? this.white : this.dark;
      const flow = this.accent;
      this.line(x + 9 * scale, top + 2 * scale, x + 20 * scale, top + 2 * scale, ink, 2.1 * scale);
      this.line(x + 12 * scale, top + 3 * scale, x + 12 * scale, top + 11 * scale, ink, 1.6 * scale);
      this.line(x + 17 * scale, top + 3 * scale, x + 17 * scale, top + 11 * scale, ink, 1.6 * scale);
      this.line(x + 12 * scale, top + 11 * scale, x + 5 * scale, top + 25 * scale, ink, 1.8 * scale);
      this.line(x + 17 * scale, top + 11 * scale, x + 24 * scale, top + 25 * scale, ink, 1.8 * scale);
      this.line(x + 5 * scale, top + 25 * scale, x + 24 * scale, top + 25 * scale, ink, 1.8 * scale);
      this.line(x + 8 * scale, top + 20 * scale, x + 21 * scale, top + 20 * scale, flow, 1.5 * scale);
      this.circle(x + 14.5 * scale, top + 15.5 * scale, 1.7 * scale, flow);
      this.circle(x + 10 * scale, top + 20 * scale, 1.35 * scale, flow);
      this.circle(x + 19 * scale, top + 20 * scale, 1.35 * scale, flow);
    }
    section(index, eyebrow, title, top, meta = "") {
      this.textAt(`${String(index).padStart(2, "0")}  |  ${eyebrow.toUpperCase()}`, 38, top, 7, "F2", this.accent);
      this.textAt(title, 38, top + 14, 16, "F2", this.dark);
      if (meta) this.textAt(meta, 547, top + 17, 7.5, "F1", this.muted, "right");
      this.line(38, top + 38, 547, top + 38, this.rule, 0.7);
      return top + 50;
    }
    excluded(name, top) {
      this.rect(38, top, 509, 54, this.soft, this.rule);
      this.textAt(`${name} EXCLUDED BY THE AUTHOR`, 50, top + 14, 8.5, "F2", this.dark);
      this.textAt("Enable the section in the Report Composer to include it in every output.", 50, top + 31, 7.5, "F1", this.muted);
      return top + 66;
    }
    runningHeader(title) {
      this.textAt(`LABFLOW  |  ${this.report.reportCode || "REPORT"}`, 38, 22, 7.5, "F2", this.accent);
      this.textAt(title, 547, 22, 7.5, "F2", this.dark, "right");
      this.line(38, 38, 547, 38, this.accent, 1.2);
    }
    footer(left) {
      this.line(38, 815, 547, 815, this.rule, 0.6);
      this.textAt(left, 38, 821, 6.7, "F1", this.muted);
      this.textAt(`${String(this.number).padStart(2, "0")} / 04`, 547, 821, 7.4, "F2", this.accent, "right");
    }
  }
  function drawKpis(page, model, top) {
    const cards = [
      ["BEST PCE", `${Number(model.best.pce || 0).toFixed(2)}%`, model.best.sample || "-"],
      ["MEAN PCE", `${model.mean.pce.toFixed(2)}%`, `${model.rows.length} samples`],
      ["STABILITY", `${Number(model.best.stability || 0).toFixed(0)}%`, "best retained"],
      ["MEAN VOC", `${model.mean.voc.toFixed(2)} V`, "cohort"],
      ["OPEN ISSUES", "3", "quality review"]
    ];
    const gap = 6;
    const width = (509 - gap * 4) / 5;
    cards.forEach(([label, value, detail], index) => {
      const x = 38 + index * (width + gap);
      page.rect(x, top, width, 62, index === 0 ? "0.93 0.97 0.98" : page.soft, page.rule);
      page.rect(x, top, width, 3, page.accent);
      page.textAt(label, x + 8, top + 12, 6.5, "F2", page.muted);
      page.textAt(value, x + 8, top + 27, 14, "F2", index === 0 ? page.accent : page.dark);
      page.textAt(detail, x + 8, top + 48, 6.5, "F1", page.muted);
    });
    return top + 74;
  }
  function drawSimpleTable(page, rows, headers, widths, top, options = {}) {
    const x = options.x || 38;
    const headerHeight = options.headerHeight || 22;
    const rowHeight = options.rowHeight || 19;
    const fontSize = options.fontSize || 7;
    const total = widths.reduce((sum, width) => sum + width, 0);
    page.rect(x, top, total, headerHeight, page.dark);
    let cursor = x;
    headers.forEach((header, index) => {
      page.textAt(header, cursor + 5, top + 7, options.headerFontSize || 6.3, "F2", page.white);
      cursor += widths[index];
    });
    rows.forEach((row, rowIndex) => {
      const y = top + headerHeight + rowIndex * rowHeight;
      page.rect(x, y, total, rowHeight, rowIndex % 2 ? page.soft : page.white, page.rule, 0.35);
      let cellX = x;
      row.forEach((value, columnIndex) => {
        const align = options.numeric?.includes(columnIndex) ? "right" : "left";
        const tx = align === "right" ? cellX + widths[columnIndex] - 5 : cellX + 5;
        page.textAt(value, tx, y + 6, fontSize, columnIndex === 0 ? "F2" : "F1", columnIndex === options.highlightColumn ? page.accent : page.text, align);
        cellX += widths[columnIndex];
      });
    });
    return top + headerHeight + rows.length * rowHeight;
  }
  function pageOne(model, palette) {
    const { report, project, sectionSet } = model;
    const page = new ReportPdfPage(palette, 1, "", report);
    page.rect(0, 0, 595, 190, page.dark);
    page.rect(0, 0, 8, 190, page.accent);
    page.brandMark(38, 24, 1.15, true);
    page.textAt("LabFlow", 76, 29, 15, "F2", page.white);
    page.textAt(`${(report.reportType || "Scientific project report").toUpperCase()}  |  ${report.reportCode || project.id}`, 76, 50, 7.2, "F2", page.accent);
    const titleLines = pdfWrap(report.title || project.name, 450, 25, true, 2);
    titleLines.forEach((line, index) => page.textAt(line, 38, 82 + index * 29, 25, "F2", page.white));
    const subtitleTop = 88 + titleLines.length * 29;
    page.wrapped(report.subtitle || "Scientific project report", 38, subtitleTop, 430, 10.5, 14, "F1", "0.82 0.87 0.93", 2);
    page.textAt(`${report.laboratory || "Laboratory"}  |  ${report.author || project.owner || "Author"}`, 38, 166, 7.8, "F1", "0.76 0.82 0.90");
    page.textAt(report.reportDate || "", 547, 28, 7.5, "F1", "0.76 0.82 0.90", "right");
    page.textAt(report.approval || "Pending approval", 547, 166, 7.5, "F2", page.white, "right");
    page.rect(38, 207, 509, 29, page.soft, page.rule);
    page.textAt("KEYWORDS", 49, 217, 6.5, "F2", page.accent);
    page.textAt(report.keywords || "", 104, 217, 7.3, "F1", page.muted);
    let top = page.section(1, "Executive snapshot", "Decision-ready project summary", 254, project.id);
    if (sectionSet.has("summary")) {
      top = page.wrapped(report.executiveSummary || project.objective, 38, top, 509, 9.4, 13.2, "F1", page.text, 6) + 7;
      page.rect(38, top, 509, 68, page.soft, page.rule);
      page.textAt("RESEARCH OBJECTIVES", 50, top + 12, 6.8, "F2", page.accent);
      page.wrapped(report.objectives || project.objective, 50, top + 29, 485, 8.1, 11.2, "F1", page.text, 3);
      top += 80;
      top = drawKpis(page, model, top);
      page.rect(38, top, 509, 40, page.white, page.rule);
      page.textAt("PROJECT", 49, top + 9, 6.2, "F2", page.accent);
      page.textAt(project.id, 49, top + 22, 7.6, "F2", page.dark);
      page.textAt("PIPELINE", 190, top + 9, 6.2, "F2", page.accent);
      page.textAt(project.pipeline || "-", 190, top + 22, 7.6, "F2", page.dark);
      page.textAt("EVIDENCE", 330, top + 9, 6.2, "F2", page.accent);
      page.textAt(`${project.files || 0} files | ${project.measurements || 0} measurements | ${project.findings || 0} findings`, 330, top + 22, 7.1, "F2", page.dark);
    } else page.excluded("Executive Summary", top);
    page.footer(`${report.organisation || "Organisation"}  |  Generated from the current Report Composer state`);
    return page.commands.join("\n");
  }
  function pageTwo(model, palette) {
    const { report, sectionSet, stackLayers, experiments, quality, solutionDefinition, solutionMeta, solventComponents, stackMeta } = model;
    const page = new ReportPdfPage(palette, 2, "MATERIALS, PROCESS AND EXPERIMENT COVERAGE", report);
    let top = page.section(2, "Materials & process", "Traceable preparation and device architecture", 60, `${experiments.length} experiments`);
    if (!sectionSet.has("methods")) {
      page.excluded("Materials, Process & Experiments", top);
      page.footer(`${report.author || "Author"} | ${report.reportDate || ""} | Generated from Composer`);
      return page.commands.join("\n");
    }
    top = page.wrapped(report.methodology || "", 38, top, 509, 8.8, 12, "F1", page.text, 5) + 10;
    page.rect(38, top, 247, 157, page.soft, page.rule);
    page.textAt(`SOLUTION REVIEW  |  ${solutionMeta.label}`.toUpperCase(), 49, top + 12, 7.5, "F2", page.dark);
    const solvents = solventComponents.slice(0, 2);
    const solventShares = solvents.map((item) => Number(String(item.share || "").match(/[\d.]+/)?.[0] || 0));
    const shareTotal = solventShares.reduce((sum, value) => sum + value, 0) || solvents.length || 1;
    if (solvents.length) {
      let cursor = 49;
      solvents.forEach((item, index) => {
        const width = 220 * ((solventShares[index] || 1) / shareTotal);
        page.rect(cursor, top + 34, width, 15, index === 0 ? page.accent : "0.20 0.44 0.76");
        if (width > 36) page.textAt(`${item.name} ${item.share || ""}`.trim(), cursor + 5, top + 38, 5.8, "F2", page.white);
        cursor += width;
      });
    } else {
      page.rect(49, top + 34, 220, 15, page.accent);
      page.textAt(solutionMeta.solventRatio, 54, top + 38, 6.1, "F2", page.white);
    }
    [["Recipe", solutionMeta.name], ["Volume", solutionMeta.volume], ["Concentration", solutionMeta.concentration], ["Status", solutionMeta.status]].forEach(([label, value], index) => {
      page.textAt(label.toUpperCase(), 49, top + 64 + index * 20, 6.1, "F2", page.muted);
      page.textAt(String(value || "—").slice(0, 28), 115, top + 64 + index * 20, 7.1, "F2", page.dark);
    });
    page.rect(300, top, 247, 157, page.soft, page.rule);
    page.textAt(`STACK REVIEW  |  ${stackMeta.label}`.toUpperCase(), 311, top + 12, 7.5, "F2", page.dark);
    stackLayers.slice(0, 5).forEach((layer, index) => {
      const y = top + 35 + index * 21;
      page.rect(311, y, 225, 17, index === 2 ? page.accent : page.white, page.rule);
      page.textAt(layer.material || "—", 318, y + 5, 7, "F2", index === 2 ? page.white : page.dark);
      page.textAt(layer.thickness || "—", 529, y + 5, 6.7, "F1", index === 2 ? page.white : page.muted, "right");
    });
    page.textAt(`${stackMeta.architecture} reference architecture`, 311, top + 145, 6.3, "F1", page.muted);
    top += 171;
    if (report.includeExperiments && experiments.length) {
      page.textAt("EXPERIMENT COVERAGE", 38, top, 7, "F2", page.accent);
      top += 15;
      const gap = 7, width = (509 - gap * 2) / 3;
      experiments.slice(0, 3).forEach((experiment, index) => {
        const x = 38 + index * (width + gap);
        page.rect(x, top, width, 78, page.white, page.rule);
        page.textAt(experiment.id || "—", x + 9, top + 10, 7, "F2", page.accent);
        page.wrapped(asArray(experiment.samples).join(" | "), x + 9, top + 27, width - 18, 7.1, 9, "F2", page.dark, 2);
        page.wrapped(`${experiment.process || "-"} | ${experiment.annealing?.value ?? "-"}${experiment.annealing?.unit || " unit missing"} | ${experiment.measurements || 0} measurements`, x + 9, top + 49, width - 18, 6.2, 8, "F1", page.muted, 3);
      });
      top += 91;
    }
    if (report.includeQualityReview && quality.length) {
      page.textAt("DATA-QUALITY REVIEW", 38, top, 7, "F2", page.accent);
      top += 14;
      const gap = 6, width = (509 - gap * 2) / 3;
      quality.slice(0, 3).forEach(([label, detail], index) => {
        const x = 38 + index * (width + gap);
        page.rect(x, top, width, 52, page.soft, page.rule);
        page.textAt(label, x + 8, top + 10, 6.8, "F2", label === "ERROR" ? "0.76 0.18 0.20" : page.accent);
        page.wrapped(detail, x + 8, top + 25, width - 16, 6.5, 8.5, "F1", page.muted, 3);
      });
    }
    page.footer(`${report.author || "Author"} | ${report.reportDate || ""} | Generated from the current Report Composer state`);
    return page.commands.join("\n");
  }

  function pageThree(model, palette) {
    const { report, rows, sectionSet, metric, metricLabel, metricSuffix, minValue, metricRange } = model;
    const page = new ReportPdfPage(palette, 3, "COMPLETE RESULTS AND MEASUREMENT RECORD", report);
    let top = page.section(3, "Complete results", "Device performance and source-aligned data", 60, `${rows.length} samples | 9 fields`);
    if (!sectionSet.has("results")) {
      page.excluded("Results & Data", top);
      page.footer(`Researcher-reviewed data | ${report.approval || "Pending approval"}`);
      return page.commands.join("\n");
    }
    page.rect(38, top, 509, 178, page.soft, page.rule);
    page.textAt(`${metricLabel.toUpperCase()} BY SAMPLE`, 50, top + 13, 8.2, "F2", page.dark);
    page.textAt("Complete included cohort | deterministic snapshot", 50, top + 29, 6.7, "F1", page.muted);
    rows.forEach((row, index) => {
      const y = top + 50 + index * 15;
      const value = Number(row[metric] || 0);
      const ratio = Math.max(0.02, Math.min(1, (value - minValue) / metricRange));
      page.textAt(row.sample, 50, y, 6.6, "F2", page.dark);
      page.rect(82, y + 1, 365, 7, "0.88 0.90 0.93");
      page.rect(82, y + 1, 365 * ratio, 7, page.accent);
      page.textAt(`${value.toFixed(2)}${metricSuffix}`, 530, y, 6.8, "F2", page.dark, "right");
    });
    top += 192;
    if (report.includeFullTable) {
      const tableRows = rows.map((row) => [row.sample, row.formulation, row.batch, Number(row.voc).toFixed(2), Number(row.jsc).toFixed(1), Number(row.ff).toFixed(1), Number(row.pce).toFixed(2), `${Number(row.stability).toFixed(0)}%`, `${Number(row.hysteresis).toFixed(1)}%`]);
      top = drawSimpleTable(page, tableRows, ["SAMPLE", "FORMULATION", "BATCH", "VOC", "JSC", "FF", "PCE", "STAB.", "HYST."], [40, 82, 42, 45, 45, 43, 45, 50, 57], top, { fontSize: 5.7, headerFontSize: 5.5, rowHeight: 19, numeric: [3,4,5,6,7,8], highlightColumn: 6 });
      top += 14;
    }
    page.rect(38, top, 509, 92, page.soft, page.rule);
    page.textAt("RESEARCHER INTERPRETATION", 50, top + 12, 7, "F2", page.accent);
    page.wrapped(report.resultsNarrative || "", 50, top + 30, 485, 8.1, 11.5, "F1", page.text, 5);
    page.footer(`Researcher-reviewed data | ${report.approval || "Pending approval"}`);
    return page.commands.join("\n");
  }
  function pageFour(model, palette) {
    const { report, sectionSet, findings, project, sources, knowledgeCount } = model;
    const page = new ReportPdfPage(palette, 4, "FINDINGS, RESEARCHER DECISION AND PROVENANCE", report);
    let top = page.section(4, "Evidence-linked findings", "Advisory review with explicit boundaries", 60, `${findings.length} findings`);
    if (sectionSet.has("ai")) {
      const cols = 2, gap = 7, width = (509 - gap) / cols;
      const itemHeight = 68;
      findings.slice(0, 6).forEach((finding, index) => {
        const col = index % cols, row = Math.floor(index / cols);
        const x = 38 + col * (width + gap), y = top + row * (itemHeight + 6);
        page.rect(x, y, width, itemHeight, page.soft, page.rule);
        page.rect(x, y, 3, itemHeight, page.accent);
        page.textAt(String(finding.score ?? "-"), x + 10, y + 9, 11.5, "F2", page.accent);
        page.textAt(String(finding.status || "review").toUpperCase(), x + width - 8, y + 10, 5.8, "F2", page.muted, "right");
        page.wrapped(finding.title || "Finding", x + 10, y + 25, width - 20, 7, 8.6, "F2", page.dark, 2);
        page.wrapped(finding.detail || "", x + 10, y + 43, width - 20, 6.1, 7.5, "F1", page.text, 2);
        if (report.includeEvidence) page.textAt(`${finding.evidence || "Evidence pending"} | Simulated AI`, x + 10, y + 59, 5.2, "F3", page.muted);
      });
      top += Math.ceil(Math.min(findings.length, 6) / 2) * (itemHeight + 6) + 2;
    } else top = page.excluded("Evidence-Linked Findings", top);
    top = page.section(5, "Researcher decision", "Interpretation and scientific boundaries", top, report.approval || "Pending approval");
    if (sectionSet.has("conclusions")) {
      const gap = 7, width = (509 - gap * 2) / 3;
      [["DISCUSSION", report.discussion], ["CONCLUSIONS", report.conclusions], ["LIMITATIONS", report.limitations]].forEach(([label, value], index) => {
        const x = 38 + index * (width + gap);
        page.rect(x, top, width, 82, page.soft, page.rule);
        page.textAt(label, x + 8, top + 10, 6.5, "F2", page.accent);
        page.wrapped(value || "", x + 8, top + 26, width - 16, 6.2, 8.1, "F1", page.text, 6);
      });
      top += 94;
    } else top = page.excluded("Discussion, Conclusions & Limitations", top);
    if (sectionSet.has("custom")) {
      page.rect(38, top, 509, 52, page.soft, page.rule);
      page.rect(38, top, 3, 52, page.accent);
      page.textAt(report.customTitle || "Custom author section", 50, top + 10, 7, "F2", page.accent);
      page.wrapped(report.customBody || "No custom text entered.", 50, top + 27, 485, 6.8, 8.7, "F1", page.text, 2);
      top += 62;
    }
    top = page.section(sectionSet.has("custom") ? 7 : 6, "Provenance & approval", "Evidence classes and final state", top);
    if (sectionSet.has("provenance")) {
      const prov = [["RAW", "Local source-aligned measurements"], ["CALCULATED", "Deterministic KPI and comparisons"], ["RESEARCHER", "Objectives, interpretation and approval"], ["AI", "Simulated advisory findings requiring review"]];
      prov.forEach(([label, detail], index) => {
        const col = index % 2, row = Math.floor(index / 2), width = 250, x = 38 + col * 259, y = top + row * 30;
        page.rect(x, y, width, 25, page.soft, page.rule);
        page.textAt(label, x + 7, y + 8, 6.1, "F2", page.accent);
        page.textAt(detail, x + 58, y + 8, 5.8, "F1", page.muted);
      });
      top += 64;
      if (report.includeSourceAppendix) {
        page.rect(38, top, 509, 42, page.soft, page.rule);
        page.textAt("SOURCE APPENDIX", 49, top + 9, 6.2, "F2", page.accent);
        page.textAt(sources.join(" | "), 49, top + 22, 6, "F1", page.muted);
        page.textAt(`${project.files || 0} project files | ${project.measurements || 0} measurements | ${knowledgeCount} linked knowledge items`, 49, top + 33, 6, "F1", page.muted);
        top += 50;
      }
      page.rect(38, top, 509, 29, page.white, page.rule);
      page.textAt("APPROVAL STATE", 49, top + 9, 6.2, "F2", page.muted);
      page.textAt(report.approval || "Pending researcher approval", 536, top + 9, 6.8, "F2", page.dark, "right");
    } else page.excluded("Provenance & Approval", top);
    page.footer(`${report.laboratory || "Laboratory"} | ${report.reportCode || project.id} | Generated from the current Report Composer state`);
    return page.commands.join("\n");
  }
  function reportPdfRaw(project, data, options = {}) {
    const finish = Log.time("pdf.build", { projectId: project?.id, rows: data?.length || 0 });
    const model = buildReportDocument(project, data, options);
    const palette = E.palettes[options.palette] || E.palettes.blue;
    const streams = [pageOne(model, palette), pageTwo(model, palette), pageThree(model, palette), pageFour(model, palette)];
    const encoder = new TextEncoder();
    const objects = [];
    const add = (value) => { objects.push(value); return objects.length; };
    const catalogRef = add("");
    const pagesRef = add("");
    const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const font3 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");
    const pageRefs = [];
    streams.forEach((stream) => {
      const bytes = encoder.encode(stream);
      const streamRef = add(`<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream`);
      pageRefs.push(add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R /F3 ${font3} 0 R >> >> /Contents ${streamRef} 0 R >>`));
    });
    const cleanInfo = (value) => pdfAscii(value).replace(/\\([\\()])/g, "$1");
    const infoRef = add(`<< /Title (${pdfSafeInfo(cleanInfo(model.report.title || project.name))}) /Author (${pdfSafeInfo(cleanInfo(model.report.author || project.owner || ""))}) /Subject (${pdfSafeInfo(cleanInfo(model.report.reportType || "LabFlow scientific report"))}) /Creator (LabFlow Report Composer) /Producer (LabFlow Unified Report Composer PDF Engine v2) >>`);
    objects[catalogRef - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R /PageLayout /OneColumn >>`;
    objects[pagesRef - 1] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] >>`;
    const chunks = [encoder.encode("%PDF-1.7\n%LabFlow\n")];
    const offsets = [0];
    let offset = chunks[0].length;
    objects.forEach((body, index) => {
      const chunk = encoder.encode(`${index + 1} 0 obj\n${body}\nendobj\n`);
      offsets.push(offset); chunks.push(chunk); offset += chunk.length;
    });
    const xrefOffset = offset;
    const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R /Info ${infoRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(encoder.encode(xref));
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(total); let cursor = 0;
    chunks.forEach((chunk) => { output.set(chunk, cursor); cursor += chunk.length; });
    finish({ bytes: output.length, pages: streams.length });
    return output;
  }
  const pdfSafeInfo = (value) => String(value || "").replace(/([\\()])/g, "\\$1");
  function workbookRaw(project, data, options = {}) {
    const palette = E.palettes[options.palette] || E.palettes.blue;
    const model = buildReportDocument(project, data, options);
    const { report, rows, findings, best, solutionDefinitions, preparedBatches, stackLayers, qualityIssues, provenanceManifest, process, stackMeta, resultsRecord, review } = model;
    const rawLastRow = Math.max(2, rows.length + 1);
    const bestSample = best.sample || "—";
    const meanPce = rows.length ? Number((rows.reduce((sum, item) => sum + Number(item.pce || 0), 0) / rows.length).toFixed(2)) : 0;
    const definitionsById = new Map(solutionDefinitions.map((item) => [item.id, item]));
    const solutionRows = preparedBatches.length
      ? preparedBatches.map((batch) => {
          const definitionId = String(batch.definition || "").split("/")[0];
          const definition = definitionsById.get(definitionId) || {};
          return [batch.id || "—", batch.definition || "—", definition.name || "—", definition.target_concentration ? quantityText(definition.target_concentration) : "—", batch.prepared || "—", batch.operator || "—", titleCase(batch.status || "draft")];
        })
      : solutionDefinitions.map((definition) => [definition.id || "—", `${definition.id || "—"}/v${definition.version || 1}`, definition.name || "—", quantityText(definition.target_concentration), quantityText(definition.reference_volume), "Definition", titleCase(definition.status || "draft")]);
    const stackRows = stackLayers.map((layer, index) => [index + 1, layer.id || "—", layer.material || "—", layer.thickness || "—", layer.function || layer.role || "—", layer.process || "—", layer.producer || "—"]);
    const analysisRows = findings.map((item) => [item.id || "—", titleCase(item.type), item.title, item.detail, item.evidence, item.status]);
    const provenanceRows = provenanceManifest.map((item) => [titleCase(item.class), item.label || "—", item.evidence || "—", item.class === "researcher" ? project.owner : "LabFlow contract", item.class === "ai" ? "Human review required" : "Preserved"]);
    const sourceCount = asArray(resultsRecord.source_files).length;
    const sheets = [
      ["Dashboard", [["LABFLOW ANALYSIS WORKBOOK", "VALUE", "CONTEXT"], ["Project", report.title || project.name, project.id], ["Pipeline contract", `${model.pipeline.name || project.pipeline} v${model.pipeline.version || "—"}`, model.pipeline.schema_version || "—"], ["Process snapshot", process.stable_label || process.process_id || "—", "versioned source"], ["Result set", resultsRecord.result_set?.result_set_id || "—", `${sourceCount} source files`], ["Best PCE", `=MAX('Raw Data'!G2:G${rawLastRow})`, bestSample], ["Mean PCE", `=AVERAGE('Raw Data'!G2:G${rawLastRow})`, `${rows.length} samples`], ["PCE standard deviation", `=STDEV('Raw Data'!G2:G${rawLastRow})`, "sample dispersion"], ["Best stability", `=MAX('Raw Data'!H2:H${rawLastRow})`, `${bestSample} · % retained`], ["Mean hysteresis", `=AVERAGE('Raw Data'!I2:I${rawLastRow})`, "%"], ["Approved findings", findings.filter((item) => item.status === "accepted").length, "researcher-controlled"], ["Open quality issues", model.openIssueCount, "preserved in export"], ["Approval", report.approval || review.approval_state || "Pending researcher approval", "human decision"], ["EDITING LEGEND", "Pale amber = editable input", "Pale green = calculated formula"], ["Recalculation", "Automatic on open", "Charts and summaries follow Raw Data"]], [30, 48, 34], {formulas:true, showGridLines:false}],
      ["Project", [["FIELD", "VALUE"], ["Project ID", project.id], ["Project name", project.name], ["Pipeline", project.pipeline], ["Pipeline version", model.pipeline.version || "—"], ["Process", process.stable_label || "—"], ["Stack", stackMeta.label], ["Owner", project.owner], ["Status", project.status], ["Progress (%)", project.progress], ["Objective", project.objective], ["Report title", report.title || project.name], ["Report subtitle", report.subtitle || "Scientific project report"], ["Executive summary", report.executiveSummary || project.objective], ["Methodology", report.methodology || "Structured preparation, mapped measurements and deterministic analysis."], ["Conclusions", report.conclusions || "Pending researcher conclusion."], ["Limitations", report.limitations || "No limitations entered."], ["Approval", report.approval || review.approval_state || "Pending researcher approval"]], [24, 90], {editable:true, editableColumns:[2]}],
      ["Solutions", [["BATCH ID", "DEFINITION", "RECIPE", "CONCENTRATION", "PREPARED", "OPERATOR", "STATUS"], ...solutionRows], [16, 18, 34, 18, 16, 24, 16], {editable:true}],
      ["Stack", [["ORDER", "LAYER ID", "MATERIAL", "THICKNESS", "FUNCTION", "PROCESS", "PRODUCER"], ...stackRows], [10, 14, 24, 16, 28, 20, 18], {editable:true}],
      ["Raw Data", [["SAMPLE", "FORMULATION", "BATCH", "VOC (V)", "JSC (mA/cm²)", "FF (%)", "PCE (%)", "STABILITY (%)", "HYSTERESIS (%)"], ...rows.map((item) => [item.sample, item.formulation, item.batch, item.voc, item.jsc, item.ff, item.pce, item.stability, item.hysteresis])], [12, 24, 12, 12, 16, 12, 12, 16, 18], {editable:true}],
      ["Processed Data", [["SAMPLE", "NORMALIZED PCE", "PCE DELTA VS MEAN", "OUTLIER FLAG", "INCLUDED IN REPORT", "RESULT SET", "SOURCE FILE"], ...rows.map((item, index) => [item.sample, `='Raw Data'!G${index + 2}/MAX('Raw Data'!$G$2:$G$${rawLastRow})`, `='Raw Data'!G${index + 2}-AVERAGE('Raw Data'!$G$2:$G$${rawLastRow})`, `=IF('Raw Data'!G${index + 2}<18,"Review","No")`, "Yes", item.result_set_id || resultsRecord.result_set?.result_set_id || "—", item.source_file || "—"])], [12, 18, 20, 16, 22, 22, 30], {formulas:true, editable:true, editableColumns:[5]}],
      ["Analysis", [["FINDING ID", "TYPE", "TITLE", "RESULT", "EVIDENCE", "REPORT STATUS"], ...analysisRows, ["SUMMARY", "Deterministic", "Mean PCE", `${meanPce}%`, resultsRecord.result_set?.result_set_id || "—", "Included"]], [16, 18, 34, 60, 30, 18]],
      ["AI Findings", [["SCORE", "FINDING", "DETAIL", "EVIDENCE", "STATUS", "ORIGIN"], ...findings.map((item) => [item.score, item.title, item.detail, item.evidence, item.status, item.type === "ai_suggestion" ? "Simulated AI" : "Review record"])], [12, 38, 70, 28, 16, 18]],
      ["Provenance", [["EVIDENCE CLASS", "SOURCE / CONTROL", "EVIDENCE RECORD", "OWNER", "STATUS"], ...provenanceRows, ...qualityIssues.map((item) => [titleCase(item.severity), item.title || "Quality issue", item.evidence || item.id || "—", item.source || "Validation", "Open issue"])], [20, 46, 34, 24, 20]],
      ["Export Manifest", [["FILE / SHEET", "PURPOSE", "FORMAT", "PALETTE"], ["Dashboard", "Decision overview", "Worksheet", palette.name], ["Project", "Project and pipeline contract metadata", "Worksheet", palette.name], ["Solutions", "Batch and versioned recipe records", "Worksheet", palette.name], ["Stack", "Versioned device architecture", "Worksheet", palette.name], ["Raw Data", "Source-aligned values", "Worksheet", palette.name], ["Processed Data", "Derived values with source identity", "Worksheet", palette.name], ["Analysis", "Evidence-linked review findings", "Worksheet", palette.name], ["AI Findings", "Advisory output with human state", "Worksheet", palette.name], ["Provenance", "Evidence lineage and open issues", "Worksheet", palette.name], ["Export Manifest", "Workbook inventory", "Worksheet", palette.name]], [28, 48, 18, 22]]
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
      ...sheets.map(([name, sheetRows, widths, config], index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheet(sheetRows, widths, config?.filter !== false, config || {}) }))
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
  const wordParagraph = (label, style = "BodyText") => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${wordRun(label)}</w:p>`;
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
    const model = buildReportDocument(project, data, options);
    const { report, sectionSet: sections, findings, best, rows, solution, solutionMeta, stackLayers, stackMeta, experiments, qualityIssues, provenanceManifest, sourceEntries } = model;
    const mean = (key) => Number(model.mean[key] || 0).toFixed(2);
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
      content += sectionHeading("01", "Executive Snapshot", "decision-ready project summary") + editable("Executive summary", report.executiveSummary || project.objective, "report.executiveSummary") + editable("Research objectives", report.objectives || project.objective, "report.objectives") + infoTable([["BEST PCE",`${Number(best.pce || 0).toFixed(2)}% / ${best.sample || "—"}`],["MEAN PCE",`${mean("pce")}%`],["BEST STABILITY",`${best.stability || 0}%`],["MEAN VOC",`${mean("voc")} V`],["OPEN ISSUES",String(model.openIssueCount)]]);
    }
    content += pageBreak();
    if (sections.has("methods")) {
      content += sectionHeading("02", "Materials, Process and Experiments", "traceable preparation") + editable("Methodology", report.methodology || "Structured preparation, mapped measurements and deterministic analysis.", "report.methodology") + paragraph(`Solution Review / ${solutionMeta.label}`,"Heading2") + tableXml([["Component","Function","Quantity","Composition"],...solution],[1500,3600,1800,2500],{fontSize:"17"}) + paragraph(`Device Stack / ${stackMeta.label}`,"Heading2") + tableXml([["Order","Material","Function","Thickness"],...stackLayers.map((layer,index)=>[String(index + 1).padStart(2,"0"),layer.material || "—",layer.function || layer.role || "—",layer.thickness || "—"])],[900,2500,4200,1800],{fontSize:"17"});
      if (report.includeExperiments !== false) content += paragraph("Experiment Coverage","Heading2") + tableXml([["Experiment","Samples","Process","Measurements","Status"],...experiments.map((item)=>[item.id || "—",asArray(item.samples).join("–"),item.process || "—",item.measurements || 0,titleCase(item.status || "review")])],[1300,1600,3000,1700,1800],{fontSize:"17"});
      if (report.includeQualityReview !== false) content += paragraph("Data-quality review","Heading2") + tableXml([["Severity","Issue","Evidence"],...qualityIssues.slice(0,6).map((item)=>[titleCase(item.severity),item.title || item.detail || "—",item.evidence || item.id || "—"])],[1300,3500,4600],{fontSize:"17"});
    }
    content += pageBreak();
    if (sections.has("results")) {
      content += sectionHeading("03", "Complete Results", "source-aligned measurements") + paragraph(`${{pce:"PCE",stability:"Stability",hysteresis:"Hysteresis"}[report.chartMetric] || "PCE"} performance overview`,"Heading2") + tableXml([["Sample","Formulation","PCE (%)","Stability (%)","Hysteresis (%)"],...rows.map((item)=>[item.sample,item.formulation,item.pce,item.stability,item.hysteresis])],[1100,3100,1700,1800,1700],{fontSize:"17",numericColumns:[2,3,4]});
      if (report.includeFullTable !== false) {
        content += paragraph("Complete measurement table","Heading2") + tableXml([["Sample","Formulation","Batch","Voc (V)","Jsc","FF (%)","PCE (%)"],...rows.map((item)=>[item.sample,item.formulation,item.batch,item.voc,item.jsc,item.ff,item.pce])],[900,2450,900,1050,1200,1200,1700],{fontSize:"15",numericColumns:[3,4,5,6]}) + spacer(60) + tableXml([["Sample","Stability (%)","Hysteresis (%)"],...rows.map((item)=>[item.sample,item.stability,item.hysteresis])],[2200,3600,3600],{fontSize:"17",numericColumns:[1,2]});
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
      content += sectionHeading(sections.has("custom") ? "07" : "06", "Provenance and Approval", "evidence classes and final state") + tableXml([["Evidence class","Origin","Control"],...provenanceManifest.map((item)=>[titleCase(item.class),item.label || "—",item.evidence || "—"])],[1800,4100,3500],{fontSize:"17"});
      if (report.includeSourceAppendix !== false) content += paragraph("Source appendix","Heading2") + paragraph(sourceEntries.map((item)=>`${item.id} - ${item.detail}`).join("; ") || "No source records declared.","SmallText");
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


  function latexEscape(value) {
    const replacements = {
      "\\": "\\textbackslash{}",
      "&": "\\&",
      "%": "\\%",
      "$": "\\$",
      "#": "\\#",
      "_": "\\_",
      "{": "\\{",
      "}": "\\}",
      "~": "\\textasciitilde{}",
      "^": "\\textasciicircum{}"
    };
    return String(value ?? "")
      .replace(/[\\&%$#_{}~^]/g, (character) => replacements[character])
      .replace(/\n+/g, "\\par ");
  }

  function latexReportSource(project, data, options = {}) {
    const model = buildReportDocument(project, data, options);
    const { report, rows, sectionSet, best, mean, findings, experiments, stackLayers } = model;
    const palette = E.palettes[options.palette] || E.palettes.blue;
    const accent = palette.strong || palette.hex;
    const dark = palette.dark;
    const tex = [];
    const pushSection = (title, body) => { tex.push(`\\section{${latexEscape(title)}}`, body); };
    tex.push(String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[a4paper,margin=16mm,headheight=15pt,footskip=18pt]{geometry}
\usepackage{microtype}
\usepackage{xcolor}
\usepackage{booktabs,tabularx,array,longtable}
\usepackage{siunitx}
\usepackage{fancyhdr,lastpage}
\usepackage{hyperref}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
\definecolor{LabAccent}{HTML}{${accent}}
\definecolor{LabDark}{HTML}{${dark}}
\definecolor{LabSoft}{HTML}{F3F6F8}
\hypersetup{colorlinks=true,linkcolor=LabAccent,urlcolor=LabAccent,pdftitle={${latexEscape(report.title || project.name)}},pdfauthor={${latexEscape(report.author || project.owner)}}}
\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt}
\renewcommand{\arraystretch}{1.16}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\textcolor{LabAccent}{\textbf{LABFLOW}}}
\fancyhead[R]{\small ${latexEscape(report.reportCode || project.id)}}
\fancyfoot[L]{\scriptsize ${latexEscape(report.organisation || "LabFlow")} · ${latexEscape(report.approval || "Pending approval")}}
\fancyfoot[R]{\scriptsize Page \thepage\ of \pageref{LastPage}}
\renewcommand{\headrulewidth}{0.4pt}
\renewcommand{\footrulewidth}{0.4pt}
\newcommand{\metric}[3]{\begin{minipage}[t]{0.18\linewidth}\textcolor{LabAccent}{\scriptsize\bfseries #1}\\[-1pt]{\Large\bfseries #2}\\[-1pt]{\scriptsize #3}\end{minipage}}
\begin{document}
\begin{titlepage}
\color{LabDark}
{\small\bfseries\textcolor{LabAccent}{LABFLOW · SCIENTIFIC REPORT}}\par
\vspace{22mm}
{\Huge\bfseries ${latexEscape(report.title || project.name)}\par}
\vspace{3mm}
{\Large\color{LabAccent}${latexEscape(report.subtitle || report.reportType || "Scientific project report")}\par}
\vspace{14mm}
\begin{tabularx}{\linewidth}{@{}>{\bfseries}lX@{}}
Project & ${latexEscape(project.id)}\\
Report code & ${latexEscape(report.reportCode || project.id)}\\
Author & ${latexEscape(report.author || project.owner)}\\
Laboratory & ${latexEscape(report.laboratory || "Laboratory")}\\
Organisation & ${latexEscape(report.organisation || "Organisation")}\\
Date & ${latexEscape(report.reportDate || new Date().toISOString().slice(0,10))}\\
Approval & ${latexEscape(report.approval || "Pending researcher approval")}\\
Keywords & ${latexEscape(report.keywords || "")}\\
\end{tabularx}
\vfill
\colorbox{LabSoft}{\parbox{0.95\linewidth}{\small This document is generated from the current LabFlow Report Composer state. Sections, author text, data selections and evidence follow the same canonical report model used by the live preview and native PDF.}}
\end{titlepage}`);
    if (sectionSet.has("summary")) {
      pushSection("Executive Summary", `${latexEscape(report.executiveSummary)}\n\n\\textbf{Research objectives.} ${latexEscape(report.objectives)}\n\n\\begin{center}\n\\metric{BEST PCE}{${Number(best.pce || 0).toFixed(2)}\\%}{${latexEscape(best.sample || "—")}}\n\\hfill\\metric{MEAN PCE}{${mean.pce.toFixed(2)}\\%}{${rows.length} samples}\n\\hfill\\metric{BEST STABILITY}{${Number(best.stability || 0).toFixed(0)}\\%}{retained}\n\\hfill\\metric{MEAN VOC}{${mean.voc.toFixed(2)} V}{cohort}\n\\end{center}`);
    }
    if (sectionSet.has("methods")) {
      const solutionRows=model.solution.map((row)=>row.map(latexEscape).join(" & ")+" \\\\").join("\n");
      const stackRows=stackLayers.map((layer,index)=>`${index+1} & ${latexEscape(layer.material)} & ${latexEscape(layer.function || layer.role || "")} & ${latexEscape(layer.thickness)} & ${latexEscape(layer.process || "—")} \\\\`).join("\n");
      const expRows=experiments.map((item)=>`${latexEscape(item.id)} & ${latexEscape((item.samples || []).join(", "))} & ${latexEscape(item.process || "—")} & ${latexEscape(item.annealing ? `${item.annealing.value}${item.annealing.unit || ""}` : "—")} & ${latexEscape(item.measurements || "—")} \\\\`).join("\n");
      pushSection("Materials, Process and Experiments", `${latexEscape(report.methodology)}\n\n\\subsection{Solution composition}\n\\begin{tabularx}{\\linewidth}{@{}lXXX@{}}\\toprule Component & Function & Quantity & Composition \\\\ \\midrule\n${solutionRows}\n\\bottomrule\\end{tabularx}\n\n\\subsection{Device stack}\n\\begin{tabularx}{\\linewidth}{@{}rXXXX@{}}\\toprule Layer & Material & Function & Thickness & Process \\\\ \\midrule\n${stackRows}\n\\bottomrule\\end{tabularx}\n${report.includeExperiments ? `\\subsection{Experiment coverage}\n\\begin{tabularx}{\\linewidth}{@{}lXXXX@{}}\\toprule Experiment & Samples & Process & Annealing & Measurements \\\\ \\midrule\n${expRows}\n\\bottomrule\\end{tabularx}` : ""}`);
    }
    if (sectionSet.has("results")) {
      const metric = model.metric;
      const coords=rows.map((row,index)=>`(${index+1},${Number(row[metric] || 0)})`).join(" ");
      const labels=rows.map((row,index)=>`${index+1}/${latexEscape(row.sample)}`).join(",");
      const tableRows=rows.map((row)=>`${latexEscape(row.sample)} & ${latexEscape(row.formulation)} & ${latexEscape(row.batch)} & ${Number(row.voc).toFixed(2)} & ${Number(row.jsc).toFixed(1)} & ${Number(row.ff).toFixed(1)} & ${Number(row.pce).toFixed(2)} & ${Number(row.stability).toFixed(0)} & ${Number(row.hysteresis).toFixed(1)} \\\\`).join("\n");
      pushSection("Results and Data", `${latexEscape(report.resultsNarrative)}\n${report.includeChart !== false ? `\\begin{center}\\begin{tikzpicture}\\begin{axis}[width=0.95\\linewidth,height=58mm,ymajorgrids=true,grid style={gray!18},xlabel={Sample},ylabel={${latexEscape(model.metricLabel)} (${latexEscape(model.metricSuffix)})},xtick={1,...,${rows.length}},xticklabels={${rows.map((row)=>latexEscape(row.sample)).join(",")}},tick label style={font=\\scriptsize},label style={font=\\small},bar width=8pt,ybar,fill=LabAccent,draw=LabAccent]\\addplot coordinates {${coords}};\\end{axis}\\end{tikzpicture}\\end{center}` : ""}\n${report.includeFullTable ? `\\scriptsize\\begin{longtable}{@{}lllrrrrrr@{}}\\toprule Sample & Formulation & Batch & Voc & Jsc & FF & PCE & Stability & Hyst. \\\\ \\midrule\\endhead\n${tableRows}\n\\bottomrule\\end{longtable}\\normalsize` : ""}`);
    }
    if (sectionSet.has("ai")) {
      const items=findings.map((item)=>`\\item \\textbf{${latexEscape(item.title)}} — ${latexEscape(item.detail)} \\textit{Evidence: ${latexEscape(item.evidence)}; status: ${latexEscape(item.status)}}`).join("\n");
      pushSection("Evidence-Linked Findings", `\\begin{itemize}\n${items}\n\\end{itemize}\n\\textit{AI-assisted findings are advisory and remain separate from researcher-authored conclusions.}`);
    }
    if (sectionSet.has("conclusions")) {
      pushSection("Discussion, Conclusions and Limitations", `\\subsection{Discussion}\n${latexEscape(report.discussion)}\n\\subsection{Conclusions}\n${latexEscape(report.conclusions)}\n\\subsection{Limitations}\n${latexEscape(report.limitations)}`);
    }
    if (sectionSet.has("custom")) pushSection(report.customTitle || "Additional Researcher Notes", latexEscape(report.customBody));
    if (sectionSet.has("provenance")) {
      pushSection("Provenance and Approval", `\\begin{tabularx}{\\linewidth}{@{}>{\\bfseries}lX@{}}\\toprule Data class & Source and control \\\\ \\midrule Raw measurements & Source files remain immutable and linked to sample identifiers.\\\\ Processed results & Deterministic transformations and grouped statistics.\\\\ Model/AI output & Model, dataset, prompt, tools and review state remain explicit.\\\\ Report state & Generated from the current Composer draft.\\\\ Approval & ${latexEscape(report.approval || "Pending researcher approval")}\\\\ \\bottomrule\\end{tabularx}\n\\vspace{6mm}\n\\textbf{Sources:} ${model.sources.map(latexEscape).join("; ")}.`);
    }
    tex.push("\\end{document}");
    return tex.join("\n\n") + "\n";
  }

  function latexReportBundleRaw(project, data, options = {}) {
    const source = latexReportSource(project, data, options);
    const readme = `# LabFlow LaTeX report package\n\nThis package is generated from the same Report Composer state used by the live preview and native PDF.\n\nCompile with:\n\n    latexmk -pdf scientific-report.tex\n\nOr run ./compile.sh on a system with TeX Live, latexmk and pgfplots installed.\nNo remote service is contacted.\n`;
    const compile = `#!/usr/bin/env sh\nset -eu\nlatexmk -pdf -interaction=nonstopmode -halt-on-error scientific-report.tex\n`;
    return E.zipBytes([
      {name:"scientific-report.tex",data:source},
      {name:"measurements.csv",data:E.csv(data || [])},
      {name:"README.md",data:readme},
      {name:"compile.sh",data:compile}
    ]);
  }

  Log.info("module.ready", { reportModel: true, pdf: true, docx: true, xlsx: true, latex: true });
  E.workbookRaw = workbookRaw;
  E.genericWorkbookRaw = genericWorkbookRaw;
  E.genericWorkbook = (sheets, palette) => new Blob([genericWorkbookRaw(sheets, palette)], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  E.genericDocxRaw = genericDocxRaw;
  E.genericDocx = (input, palette) => new Blob([genericDocxRaw(input, palette)], {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  E.buildReportDocument = buildReportDocument;
  E.reportPdfRaw = reportPdfRaw;
  E.reportPdf = (project, data, options = {}) => new Blob([reportPdfRaw(project, data, options)], { type: "application/pdf" });
  E.editableDocxRaw = editableDocxRaw;
  E.reportDocx = (project, data, options) => new Blob([editableDocxRaw(project, data, options)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  E.reportXlsx = (project, data, options) => new Blob([workbookRaw(project, data, options)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  E.reportLatexSource = latexReportSource;
  E.reportLatexBundle = (project, data, options = {}) => new Blob([latexReportBundleRaw(project, data, options)], { type: "application/zip" });
  E.bundle = (project, pipeline, data, nomad = false, options = {}) => {
    const resourceGroups = Object.fromEntries(Object.entries(pipeline?.resources || {}).map(([group, resources]) => [group, Object.keys(resources || {})]));
    const resourceManifest = {
      schema_version: "labflow.pipeline-resource-manifest.v1",
      pipeline_id: pipeline?.id || "unknown",
      pipeline_version: pipeline?.version || "unknown",
      source_refs: pipeline?.resource_refs || {},
      embedded_resource_groups: resourceGroups,
      note: "The full build-time-resolved pipeline contract is stored in pipeline/contract.json."
    };
    const packageManifest = [
      "LabFlow portable project package",
      "Generated locally in the browser.",
      `Pipeline: ${pipeline?.id || "unknown"} ${pipeline?.version || ""}`.trim(),
      `Pipeline schema: ${pipeline?.schema_version || "legacy-navigation-only"}`,
      "Includes the resolved pipeline contract, resource manifest, structured measurements, native PDF, editable DOCX, analysis workbook, LaTeX report source and linked knowledge.",
      "Source files and open quality issues remain explicit; NOMAD output is a readiness preview only."
    ].join("\n") + "\n";
    const files = [
      { name: "project.yaml", data: E.projectYaml(project, pipeline) },
      { name: "pipeline/contract.json", data: E.pipelineContractJson(pipeline) },
      { name: "pipeline/resource-manifest.json", data: JSON.stringify(resourceManifest, null, 2) + "\n" },
      { name: "data/measurements.jsonl", data: E.jsonl(project, data) },
      { name: "data/measurements.csv", data: E.csv(data) },
      { name: "report/scientific-report.pdf", data: reportPdfRaw(project, data, options) },
      { name: "report/editable-report.docx", data: editableDocxRaw(project, data, options) },
      { name: "report/analysis-workbook.xlsx", data: workbookRaw(project, data, options) },
      { name: "report/scientific-report.tex", data: latexReportSource(project, data, options) },
      { name: "knowledge/linked-context.yaml", data: (options.knowledge || []).map((item) => `- id: ${item.id}\n  type: "${item.type}"\n  title: "${item.title.replace(/"/g, '\\"')}"\n  status: "${item.status}"`).join("\n") + "\n" },
      { name: "MANIFEST.txt", data: packageManifest }
    ];
    if (nomad) files.push(
      { name: "nomad.yaml", data: E.nomadYaml(project, pipeline) },
      { name: "NOMAD_VALIDATION.txt", data: "Preview only. Confirm inferred units, open quality issues and incomplete metadata before upload. Remote submission is disabled in this POC.\n" }
    );
    return new Blob([E.zipBytes(files)], { type: "application/zip" });
  };
})();
