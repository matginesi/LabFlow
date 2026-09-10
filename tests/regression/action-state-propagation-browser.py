#!/usr/bin/env python3
"""Regression for Action proposal acceptance and downstream canonical state."""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("LABFLOW_TEST_BASE_URL", "http://127.0.0.1:8765")
FIXTURE = Path("TEST_DATA/02_ROVINATO_SPORCO_TASKS.zip").resolve()


def main() -> int:
    with sync_playwright() as playwright:
        browser_path = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
        browser = playwright.chromium.launch(headless=True, executable_path=browser_path) if browser_path else playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(BASE_URL, wait_until="networkidle")
        page.locator("#datasetInput").set_input_files(str(FIXTURE))
        page.wait_for_function("LabFlow.State.state.experiment.measurements.length > 1")
        page.evaluate("LabFlow.UI.activityHide()")

        prepared = page.evaluate(
            """async () => {
              const LF=LabFlow,exp=LF.State.state.experiment;
              window.__canonicalExperiment=exp;
              const candidates=exp.measurements.filter(m=>m.rankingEligible);
              const source=candidates.find(m=>exp.measurements.some(other=>other.id!==m.id&&other.sampleId===m.sampleId))||candidates[0]||exp.measurements[0];
              const targetExperiment=exp.experiments.find(item=>item.id!==source.experimentId);
              if(!source||!targetExperiment)throw new Error('Fixture needs two groups and one measurement.');
              const finding=LF.DataModel.addRecord(exp,'finding',{type:'group-mapping',severity:'warning',title:'Group mapping needs review',detail:'Regression fixture ambiguity',target:source.group,measurementId:source.id,status:'open',source:'deterministic',evidence:['regression']});
              LF.DataModel.touch(exp,'dataset');LF.DerivedState.invalidate(exp,'dataset');LF.DataPipeline.refresh(exp,{reason:'regression-prepare'});
              const raw=exp.raw.sourceArchive;
              const rawHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw))).map(x=>x.toString(16).padStart(2,'0')).join('');
              window.__actionRegression={measurementId:source.id,sampleId:source.sampleId,oldGroup:source.group,newGroup:targetExperiment.name,findingId:finding.id,rawHash,revision:exp.sync.revision};
              return window.__actionRegression;
            }"""
        )

        action_result = page.evaluate(
            """() => {
              const LF=LabFlow,exp=LF.State.state.experiment,r=window.__actionRegression;
              const stored=LF.ActionSteps['dataset.store-corrections']({exp,sourceRevision:exp.sync.revision,lastResult:{summary:'Validated regression proposal',proposals:[{finding_id:r.findingId,patch_type:'group_mapping',target:r.measurementId,before:r.oldGroup,after:r.newGroup,reason:'Regression evidence resolves group',evidence:['regression'],requires_human_review:true}],unresolved:[]}});
              const proposal=LF.ActionData.proposal(exp,'dataset.resolve-ambiguities').proposals[0];
              const before=exp.measurement(r.measurementId).group;
              const committed=LF.DatasetCorrections.commitProposals(exp,proposal,'ai',{actionId:'dataset.resolve-ambiguities',reason:'browser-regression'});
              const siblings=exp.measurements.filter(m=>m.sampleId===r.sampleId);
              return {stored,before,committed,groups:siblings.map(m=>m.group),experimentIds:siblings.map(m=>m.experimentId),sameObject:exp===window.__canonicalExperiment,currentRevision:exp.sync.revision,pipelineRevision:exp.pipeline.sourceRevision};
            }"""
        )
        assert action_result["stored"]["proposals"] == 1
        assert action_result["before"] == prepared["oldGroup"]
        assert action_result["committed"]["committed"] is True
        assert action_result["committed"]["changed"] >= 1
        assert action_result["sameObject"] is True
        assert set(action_result["groups"]) == {prepared["newGroup"]}
        assert action_result["currentRevision"] == action_result["pipelineRevision"]

        exclusion = page.evaluate(
            """() => {
              const LF=LabFlow,exp=LF.State.state.experiment,r=window.__actionRegression,m=exp.measurement(r.measurementId);
              const eligibleBefore=exp.analysis.summary.eligibleCount;
              const out=LF.DatasetCorrections.commitProposals(exp,{patch_type:'exclude_measurement',target:m.id,before:false,after:true,reason:'Regression exclusion',evidence:['researcher acceptance']},'user',{actionId:'review.exclude-measurement',reason:'browser-regression-exclusion'});
              const compare=LF.ContextBuilder.pack('results_compare',{exp,params:{groups:[m.group],metric:'eff',direction:'both',eligibleOnly:false}}),activeGroupCount=exp.measurements.filter(item=>!item.excluded&&item.group===m.group).length;
              const nomad=LF.NomadExport.buildMapping(exp);
              const ids=(nomad.mappings.find(x=>x.nomad_path==='data.measurement_ids')||{}).value||[];
              const revision=exp.sync.revision,patches=exp.patches.length;let noOpCode='';try{LF.DatasetCorrections.commitProposals(exp,{patch_type:'exclude_measurement',target:m.id,before:true,after:true,reason:'Duplicate exclusion'},'user',{actionId:'review.exclude-measurement'});}catch(error){noOpCode=error.code||'';}
              return {out,excluded:m.excluded,eligible:m.rankingEligible,eligibleBefore,eligibleAfter:exp.analysis.summary.eligibleCount,compareCount:(compare.groups[0]||{}).measurements||0,activeGroupCount,nomadContains:ids.includes(m.id),noOpCode,noOpRevisionStable:exp.sync.revision===revision,noOpPatchStable:exp.patches.length===patches};
            }"""
        )
        assert exclusion["out"]["committed"] is True
        assert exclusion["excluded"] is True and exclusion["eligible"] is False
        assert exclusion["eligibleAfter"] == exclusion["eligibleBefore"] - 1
        assert exclusion["compareCount"] == exclusion["activeGroupCount"]
        assert exclusion["nomadContains"] is False
        assert exclusion["noOpCode"] == "DATA_MUTATION_NOOP"
        assert exclusion["noOpRevisionStable"] is True and exclusion["noOpPatchStable"] is True

        page.evaluate("LabFlow.State.state.ui.resultsTab='all'; LabFlow.State.state.ui.resultsDataMode='all'; LabFlow.State.setRoute('experiment-results')")
        page.wait_for_timeout(100)
        measurement_id = prepared["measurementId"]
        assert page.locator(f'[data-measurement-row="{measurement_id}"]').count() == 0
        page.locator('[data-results-data-mode="excluded"]').click()
        page.wait_for_timeout(80)
        assert page.locator(f'[data-measurement-row="{measurement_id}"]').count() == 1
        assert "Excluded" in page.locator(f'[data-measurement-row="{measurement_id}"]').inner_text()
        page.evaluate("LabFlow.State.setRoute('experiment-design')")
        page.wait_for_timeout(60)
        page.evaluate("LabFlow.State.state.ui.resultsTab='all'; LabFlow.State.state.ui.resultsDataMode='all'; LabFlow.State.setRoute('experiment-results')")
        page.wait_for_timeout(80)
        assert page.locator(f'[data-measurement-row="{measurement_id}"]').count() == 0

        persisted = page.evaluate(
            """async () => {
              const LF=LabFlow,exp=LF.State.state.experiment,r=window.__actionRegression;
              const blob=await LF.Export.save(exp),zip=await JSZip.loadAsync(await blob.arrayBuffer());
              const saved=JSON.parse(await zip.file('experiment.json').async('string'));
              const source=await zip.file('raw/source.zip').async('arraybuffer');
              const sourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',source))).map(x=>x.toString(16).padStart(2,'0')).join('');
              await LF.Storage.saveExperiment(exp,LF.State.state.ui);
              const restored=await LF.Storage.loadExperiment();
              return {savedExcluded:saved.measurements.find(m=>m.id===r.measurementId).excluded,restoredExcluded:restored.experiment.measurements.find(m=>m.id===r.measurementId).excluded,sourceHash,rawHash:r.rawHash,patches:saved.patches.length};
            }"""
        )
        assert persisted["savedExcluded"] is True
        assert persisted["restoredExcluded"] is True
        assert persisted["sourceHash"] == persisted["rawHash"]
        assert persisted["patches"] >= 2

        browser.close()
    print(json.dumps({"status": "ok", "groupAction": action_result, "exclusion": exclusion, "persistence": persisted}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
