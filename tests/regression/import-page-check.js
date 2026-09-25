'use strict';
/* Regression contract for the merged Upload & Review entry step. */
global.window=globalThis;
const path=require('path'),fs=require('fs'),root=path.resolve(__dirname,'../..');
global.localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){},clear:function(){}};
try{global.window.JSZip=require(path.join(root,'vendor','jszip','jszip.min.js'));}catch(_e){}
require(path.join(root,'assets/js/redact.js'));
require(path.join(root,'assets/js/logger.js'));
require(path.join(root,'assets/js/core.js'));
require(path.join(root,'assets/js/ai/prompt-bundle.js'));
require(path.join(root,'assets/js/experiment/domain-schema.js'));
require(path.join(root,'assets/js/experiment/data-model.js'));
require(path.join(root,'assets/js/experiment/action-data.js'));
require(path.join(root,'assets/js/experiment/derived-state.js'));
require(path.join(root,'assets/js/experiment/data-contracts.js'));
require(path.join(root,'assets/js/data/parser.js'));
require(path.join(root,'assets/js/data/importer.js'));
require(path.join(root,'assets/js/state.js'));
require(path.join(root,'assets/js/storage.js'));
require(path.join(root,'assets/js/experiment/canonical-store.js'));
require(path.join(root,'assets/js/data/analysis.js'));
require(path.join(root,'assets/js/data/analysis-summary.js'));
require(path.join(root,'assets/js/experiment/design-model.js'));
require(path.join(root,'assets/js/data/dataset-corrections.js'));
require(path.join(root,'assets/js/experiment/design-analysis.js'));
require(path.join(root,'assets/js/data/pipeline.js'));
require(path.join(root,'assets/js/pages/shared.js'));
require(path.join(root,'assets/js/pages/import-page.js'));

const LF=global.LabFlow;
function ok(value,label){if(!value)throw new Error(label);}
function count(haystack,needle){return String(haystack).split(needle).length-1;}

async function main(){
  LF.State.resetSession();
  const empty=LF.PageShell.needExperiment();
  ok(empty.includes('Upload &amp; Review')||empty.includes('Upload & Review'),'first step is Upload & Review');
  ok(empty.includes('Choose ZIP file'),'upload remains the entry gate');
  ok(empty.includes('data-dataset-drop'),'upload card is a drag and drop target');
  ok(empty.includes('upload-drop-hint')&&empty.includes('drag and drop'),'drop affordance is explained in the UI language');
  ok(empty.includes('data-open-dataset'),'explicit Choose ZIP file button remains');
  ok(count(LF.PageShell.experimentStepper(),'class="step ' )===4,'workflow has four steps');
  const appSource=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8'),feedbackSource=fs.readFileSync(path.join(root,'assets/js/ui/feedback.js'),'utf8'),appCss=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
  ok(appSource.includes('datasetDropTarget')&&appSource.includes('dragHasFiles'),'drag and drop handlers exist');
  ok(appSource.includes("e.dataTransfer.dropEffect='copy'"),'drag over marks the drop target');
  ok(appSource.includes('zone.classList.add(\'is-drop-target\')')&&appCss.includes('.upload-start-main.is-drop-target'),'drop hover state is owned by the shared stylesheet');
  ok(appSource.includes('importDataset(file)'),'dropped ZIP goes through the same import path');
  ok(appSource.includes('await LF.Storage.loadExperiment()'),'startup restores a persisted LabFlow Data when present');
  ok(appSource.includes("persistWorkspace('pagehide')"),'workspace is persisted when the app is closed/backgrounded');
  ok(appSource.includes('LF.Storage.clearSavedExperiment'),'Reset remains the explicit persisted-session clear boundary');
  ok(feedbackSource.includes('messageShade'),'confirmations use the LabFlow message totem');
  ok(!/window\.confirm|window\.alert/.test(appSource+feedbackSource),'no native browser confirmation/alert remains');
  ok(appSource.includes("const briefMode='deterministic'"),'import brief is deterministic');
  ok(!appSource.includes('analysis.enrich'),'import performs no automatic AI enrichment');
  ok(appSource.includes("refreshPipeline(exp,'import')"),'import runs the deterministic data pipeline');

  const buf=fs.readFileSync(path.join(root,'TEST_DATA','01_PRECISO_PERFETTO_COMPLETO.zip'));
  const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  const exp=await LF.Importer.parseDataset(ab,'01_PRECISO_PERFETTO_COMPLETO.zip');
  LF.State.setExperiment(exp,ab);LF.DataPipeline.refresh(exp,{reason:'regression-import'});LF.State.setRoute('experiment-import');
  const receipt=LF.ImportPage.receipt(exp);
  ok(/Source archive/i.test(receipt),'source receipt exists after import');
  ok(receipt.includes('Original preserved'),'receipt states immutable RAW source');

  let mergedOptions=null;
  LF.ReviewPanel={render:function(options){mergedOptions=options;return '<section id="merged-review">merged</section>';}};
  const rendered=LF.ImportPage.render(LF.State.state);
  ok(rendered.includes('merged-review'),'import route renders merged review workbench');
  const reviewPanelSource=fs.readFileSync(path.join(root,'assets/js/pages/review-panel.js'),'utf8');
  ok(reviewPanelSource.includes('Replace ZIP'),'same first step can replace ZIP');
  ok(mergedOptions&&mergedOptions.merged===true,'merged mode is explicit');

  LF.State.setRoute('experiment-import');
  ok(LF.State.state.ui.route==='experiment-import','Review stays on the merged Upload & Review route');
  console.log('merged Upload & Review regression: OK');
}
main().then(function(){process.exit(0);}).catch(function(err){console.error(err&&err.stack||err);process.exit(1);});
