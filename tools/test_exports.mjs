#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

globalThis.window = globalThis;
globalThis.document = { createElement() { return {}; }, body: { append() {} } };
for (const file of ["assets/js/pipeline-bundle.js", "assets/js/pipeline-runtime.js", "assets/js/data.js", "assets/js/exporters.js", "assets/js/workbook.js"]) {
  vm.runInThisContext(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { filename: file });
}

const project = LabFlowData.projects[0];
const options = {
  palette: "teal",
  user: LabFlowData.user,
  findings: LabFlowData.aiFindings,
  knowledge: LabFlowData.knowledge,
  experiments: LabFlowData.experiments,
  pipeline: LabFlowPipelines.chose,
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

const pipeline = LabFlowPipelines.chose;
const model = LabFlowExport.buildReportDocument(project, [], options);
assert.equal(model.solutionMeta.id, pipeline.resources.demo.process.solution_definitions[0].id);
assert.equal(model.stackMeta.id, pipeline.resources.demo.process.stack.id);
assert.deepEqual(model.stackLayers.map((item) => item.id), pipeline.resources.demo.process.stack.layers.map((item) => item.id));
assert.equal(model.qualityIssues.length, pipeline.resources.demo.results.quality_issues.length);
assert.ok(model.sourceEntries.some((item) => item.id === pipeline.resources.demo.results.source_files[0].file_name));
assert.equal(model.reviewRecord.review.review_id, pipeline.resources.demo.review.review.review_id);
for (const stepId of ["process", "experiment", "results", "review"]) {
  const gate = LabFlowPipelineRuntime.evaluateStep(pipeline, stepId);
  assert.equal(gate.step, stepId);
  assert.ok(Array.isArray(gate.schema));
  assert.equal(gate.schema.filter((item) => item.status === "error").length, 0);
}
assert.equal(LabFlowPipelineRuntime.evaluateStep(pipeline, "process").status, "ready");
assert.equal(LabFlowPipelineRuntime.evaluateStep(pipeline, "experiment").status, "warning");
assert.equal(LabFlowPipelineRuntime.evaluateStep(pipeline, "results").status, "blocked");
assert.equal(LabFlowPipelineRuntime.evaluateStep(pipeline, "review").status, "blocked");
const unknownValidatorPipeline = structuredClone(pipeline);
unknownValidatorPipeline.steps[0].completion.rules.push({id:"unknown-runtime-rule", validator:"not_implemented", severity:"error"});
assert.ok(LabFlowPipelineRuntime.evaluateStep(unknownValidatorPipeline, "process").errors > 0);
const missingSchemaPipeline = structuredClone(pipeline);
missingSchemaPipeline.steps[0].contract.schema_ref = "schemas.missing";
assert.ok(LabFlowPipelineRuntime.evaluateStep(missingSchemaPipeline, "process").schema.some((item) => item.status === "error"));

const output = "/tmp/labflow-export-test";
mkdirSync(output, { recursive: true });
const files = {
  "report.pdf": LabFlowExport.reportPdf(project, LabFlowData.demoDataset, options),
  "report.docx": LabFlowExport.reportDocx(project, LabFlowData.demoDataset, options),
  "report.xlsx": LabFlowExport.reportXlsx(project, LabFlowData.demoDataset, options),
  "report-latex.zip": LabFlowExport.reportLatexBundle(project, LabFlowData.demoDataset, options),
  "project.zip": LabFlowExport.bundle(project, LabFlowPipelines.chose, LabFlowData.demoDataset, false, options),
  "project-nomad.zip": LabFlowExport.bundle(project, LabFlowPipelines.chose, LabFlowData.demoDataset, true, options),
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
  if (name === "project.zip" || name === "project-nomad.zip") {
    for (const entry of ["pipeline/contract.json", "pipeline/resource-manifest.json", "scientific-report.pdf", "editable-report.docx", "analysis-workbook.xlsx", "scientific-report.tex", "linked-context.yaml"]) assert.match(packageText, new RegExp(entry.replace(".", "\\.")));
    assert.match(packageText, /labflow\.pipeline\.v1/);
    assert.match(packageText, /chose\.process\.chemistry/);
    assert.match(packageText, /resource_refs/);
  }
  if (name === "project-nomad.zip") {
    assert.match(packageText, /nomad\.yaml/);
    assert.match(packageText, /chose-perovskite-v1/);
    assert.match(packageText, /remote_submission: false/);
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
