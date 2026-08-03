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
  report: {
    title: "Mixed-Cation Validation Report",
    subtitle: "Editable local report test",
    executiveSummary: "The leading formulation remains FA0.90MA0.10.",
    objectives: project.objective,
    methodology: "Versioned preparation, mapped JV data and deterministic comparison.",
    conclusions: "S04 and S08 proceed to validation; S06 remains under review.",
    limitations: "Small demonstration cohort; no causal inference.",
    approval: "Pending researcher signature"
  }
};
const output = "/tmp/labflow-export-test";
mkdirSync(output, { recursive: true });
const files = {
  "report.docx": LabFlowExport.reportDocx(project, LabFlowData.demoDataset, options),
  "report.xlsx": LabFlowExport.reportXlsx(project, LabFlowData.demoDataset, options),
  "project.zip": LabFlowExport.bundle(project, LabFlowPipelines.chose, LabFlowData.demoDataset, false, options),
  "nomad-preview.zip": LabFlowExport.bundle(project, LabFlowPipelines.chose, LabFlowData.demoDataset, true, options)
  ,"generic-workbook.xlsx": LabFlowExport.genericWorkbook([
    { name: "Samples", rows: [["Sample", "PCE"], ["S08", "21.28"]] },
    { name: "Metadata", rows: [["Field", "Value"], ["Project", project.id]] },
    { name: "Review", rows: [["Status"], ["Pending"]] }
  ], "green")
  ,"generic-document.docx": LabFlowExport.genericDocx({ title: "Working note", subtitle: "Export test", body: "# Finding\nS08 remains the lead sample." }, "green")
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
  if (name === "report.docx") {
    assert.match(packageText, /TOC \\o/);
    assert.match(packageText, /Solution Review/);
    assert.match(packageText, /Stack Review/);
    assert.match(packageText, /Provenance &amp; Approval/);
    assert.match(packageText, /<w:sdt>/);
    assert.match(packageText, /report\.conclusions/);
    assert.match(packageText, /word\/settings\.xml/);
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
  if (name === "project.zip") {
    for (const entry of ["editable-report.docx", "analysis-workbook.xlsx", "linked-context.yaml"]) assert.match(packageText, new RegExp(entry.replace(".", "\\.")));
  }
}
console.log(output);
