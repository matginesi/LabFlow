#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

globalThis.window = globalThis;
globalThis.document = { createElement() { return {}; }, body: { append() {} } };
for (const file of ["assets/js/data.js", "assets/js/pipeline-bundle.js", "assets/js/exporters.js", "assets/js/workbook.js"]) {
  vm.runInThisContext(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { filename: file });
}

const project = LabFlowData.projects[0];
const options = {
  palette: "teal",
  user: LabFlowData.user,
  findings: LabFlowData.aiFindings,
  knowledge: LabFlowData.knowledge,
  experiments: LabFlowData.experiments,
  report: {
    title: "Mixed-Cation Validation Report",
    subtitle: "Editable local report test",
    reportType: "Scientific project report",
    reportCode: "PRJ-2026-014-R01",
    keywords: "perovskite, mixed-cation, validation",
    author: LabFlowData.user.name,
    laboratory: LabFlowData.user.laboratory,
    organisation: LabFlowData.user.organisation,
    reportDate: "2026-08-03",
    executiveSummary: "The leading formulation remains FA0.90MA0.10.",
    objectives: project.objective,
    methodology: "Versioned preparation, mapped JV data and deterministic comparison.",
    resultsNarrative: "S08 remains the current performance leader.",
    discussion: "The current cohort supports validation but not causal inference.",
    conclusions: "S04 and S08 proceed to validation; S06 remains under review.",
    limitations: "Small demonstration cohort; no causal inference.",
    customTitle: "Additional notes",
    customBody: "The author requested one additional validation run.",
    approval: "Pending researcher signature",
    chartMetric: "pce",
    includeFullTable: true,
    includeExperiments: true,
    includeEvidence: true,
    includeSourceAppendix: true,
    includeQualityReview: true,
    sections: ["summary", "methods", "results", "ai", "conclusions", "custom", "provenance"]
  }
};
const output = "/tmp/labflow-export-test";
mkdirSync(output, { recursive: true });
const files = {
  "report.pdf": LabFlowExport.reportPdf(project, LabFlowData.demoDataset, options),
  "report.docx": LabFlowExport.reportDocx(project, LabFlowData.demoDataset, options),
  "report.xlsx": LabFlowExport.reportXlsx(project, LabFlowData.demoDataset, options),
  "report-latex.zip": LabFlowExport.reportLatexBundle(project, LabFlowData.demoDataset, options),
  "project.zip": LabFlowExport.bundle(project, LabFlowPipelines.chose, LabFlowData.demoDataset, false, options),
  "generic-workbook.xlsx": LabFlowExport.genericWorkbook([
    { name: "Samples", rows: [["Sample", "PCE"], ["S08", "21.28"]] },
    { name: "Metadata", rows: [["Field", "Value"], ["Project", project.id]] },
    { name: "Review", rows: [["Status"], ["Pending"]] }
  ], "green"),
  "generic-document.docx": LabFlowExport.genericDocx({ title: "Working note", subtitle: "Export test", body: "# Finding\nS08 remains the lead sample." }, "green")
};
for (const [name, blob] of Object.entries(files)) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  writeFileSync(`${output}/${name}`, bytes);
  const packageText = new TextDecoder().decode(bytes);
  if (name === "generic-workbook.xlsx") {
    assert.match(packageText, /xl\/worksheets\/sheet3\.xml/);
    assert.match(packageText, /name="Review"/);
  }
  if (name === "generic-document.docx") {
    assert.match(packageText, /word\/document\.xml/);
    assert.match(packageText, /Working note/);
  }
  if (name === "report.pdf") {
    assert.match(packageText, /%PDF-1\.7/);
    assert.match(packageText, /LabFlow Unified Report Composer PDF Engine v2/);
    assert.match(packageText, /Mixed-Cation Validation Report/);
    assert.match(packageText, /Additional notes/);
    assert.match(packageText, /batch_B03_forward\.csv/);
    assert.doesNotMatch(packageText, /editablePdfRaw|EDITABLE REPORT IDENTITY/);
  }
  if (name === "report-latex.zip") {
    assert.match(packageText, /scientific-report\.tex/);
    assert.match(packageText, /measurements\.csv/);
    assert.match(packageText, /\\documentclass/);
    assert.match(packageText, /\\usepackage\{pgfplots\}/);
    assert.match(packageText, /Mixed-Cation Validation Report/);
    assert.match(packageText, /Additional notes/);
    assert.match(packageText, /Page \\thepage/);
  }
  if (name === "report.docx") {
    assert.match(packageText, /Solution Review/);
    assert.match(packageText, /Device Stack/);
    assert.match(packageText, /Provenance and Approval/);
    assert.match(packageText, /Additional notes/);
    assert.match(packageText, /<w:sdt>/);
    assert.match(packageText, /report\.conclusions/);
    assert.match(packageText, /word\/settings\.xml/);
    assert.match(packageText, /CoverTitle/);
  }
  if (name === "project.zip") {
    for (const entry of ["scientific-report.pdf", "editable-report.docx", "analysis-workbook.xlsx", "scientific-report.tex", "linked-context.yaml"]) assert.match(packageText, new RegExp(entry.replace(".", "\\.")));
  }
  if (name === "report.xlsx") {
    for (const sheet of ["Dashboard", "Project", "Solutions", "Stack", "Raw Data", "Processed Data", "Analysis", "AI Findings", "Provenance", "Export Manifest"]) assert.match(packageText, new RegExp(`name="${sheet}"`));
    assert.match(packageText, /<f>MAX\(&apos;Raw Data&apos;!G2:G9\)<\/f>/);
    assert.match(packageText, /fullCalcOnLoad="1"/);
    assert.match(packageText, /<pane ySplit="1"/);
    assert.match(packageText, /<autoFilter/);
    assert.match(packageText, /FFFFF3D6/);
    assert.match(packageText, /FFE8F7EE/);
  }
}
const workbookSource = readFileSync(new URL("../assets/js/workbook.js", import.meta.url), "utf8");
assert.doesNotMatch(workbookSource, /editablePdfRaw|pdfText\(|65 fillable|foreignObject|report-pdf-staging/);
assert.match(workbookSource, /reportPdfRaw/);
assert.match(workbookSource, /buildReportDocument/);
assert.match(workbookSource, /latexReportSource/);
assert.match(workbookSource, /reportLatexBundle/);
console.log(output);
