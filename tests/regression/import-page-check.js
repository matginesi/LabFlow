'use strict';
/* Regression contract for the merged Upload & Review entry step. */
global.window=globalThis;
const path=require('path'),fs=require('fs'),root=path.resolve(__dirname,'../..');
global.localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){},clear:function(){}};
try{global.window.JSZip=require(path.join(root,'vendor','jszip','jszip.min.js'));}catch(_e){}
require(path.join(root,'assets/js/logger.js'));
require(path.join(root,'assets/js/core.js'));
require(path.join(root,'assets/js/ai/prompt-bundle.js'));
require(path.join(root,'assets/js/experiment/data-model.js'));
require(path.join(root,'assets/js/experiment/model.js'));
require(path.join(root,'assets/js/data/parser.js'));
require(path.join(root,'assets/js/data/importer.js'));
require(path.join(root,'assets/js/state.js'));
require(path.join(root,'assets/js/storage.js'));
require(path.join(root,'assets/js/data/analysis.js'));
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
  ok(!empty.includes('data-route="experiment-understand"'),'no separate Review route in stepper');
  ok(count(LF.PageShell.experimentStepper(),'class="step ' )===6,'workflow has six steps');
  const appSource=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8'),feedbackSource=fs.readFileSync(path.join(root,'assets/js/ui/feedback.js'),'utf8');
  ok(appSource.includes('workspace.fresh-session'),'each startup declares a fresh scientific session');
  ok(appSource.includes('clearSavedExperiment'),'startup clears any previously persisted ZIP Working Copy');
  ok(!appSource.includes('await LF.Storage.loadExperiment()'),'startup no longer restores an experiment automatically');
  ok(feedbackSource.includes('messageShade'),'confirmations use the LabFlow message totem');
  ok(!/window\.confirm|window\.alert/.test(appSource+feedbackSource),'no native browser confirmation/alert remains');

  const buf=fs.readFileSync(path.join(root,'TEST_DATA','01_PRECISO_PERFETTO_COMPLETO.zip'));
  const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  const exp=await LF.Importer.parseDataset(ab,'01_PRECISO_PERFETTO_COMPLETO.zip');
  LF.Analysis.analyze(exp);LF.ExperimentModel.ensureShape(exp,LF.State.state);LF.State.setExperiment(exp,ab);LF.State.setRoute('experiment-import');
  const receipt=LF.ImportPage.receipt(exp);
  ok(receipt.includes('SOURCE ARCHIVE'),'source receipt exists after import');
  ok(receipt.includes('RAW preserved'),'receipt states immutable RAW source');
  ok(receipt.includes('Replace ZIP'),'same first step can replace ZIP');

  let mergedOptions=null;
  LF.UnderstandPage={render:function(options){mergedOptions=options;return '<section id="merged-review">merged</section>';}};
  const rendered=LF.ImportPage.render(LF.State.state);
  ok(rendered.includes('merged-review'),'import route renders merged review workbench');
  ok(mergedOptions&&mergedOptions.merged===true,'merged mode is explicit');

  LF.State.setRoute('experiment-understand');
  ok(LF.State.state.route==='experiment-import','legacy Review route aliases to merged first step');
  console.log('merged Upload & Review regression: OK');
}
main().then(function(){process.exit(0);}).catch(function(err){console.error(err&&err.stack||err);process.exit(1);});
