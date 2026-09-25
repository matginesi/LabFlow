'use strict';
/*
 * Browser Local model management UI contract: one card per model, card-scoped actions,
 * and no leftover stat-grid markup or CSS.
 */
const fs=require('fs');
const path=require('path');
function assert(value,expected,label){
  if(arguments.length===2){label=expected;expected=true;}
  if(value!==expected)throw new Error((label||'assertion failed')+' · '+String(value));
}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const page=fs.readFileSync(path.join(root,'assets/js/pages/settings-page.js'),'utf8');
  const controller=fs.readFileSync(path.join(root,'assets/js/controllers/settings-controller.js'),'utf8');
  const settings=fs.readFileSync(path.join(root,'assets/js/ai/settings.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/components.css'),'utf8');
  const kit=fs.readFileSync(path.join(root,'assets/js/pages/ui-kit-inline.js'),'utf8');

  t['Browser Local models render as cards with source and state']=function(){
    assert(page.includes("'<div class=\"browser-model-cards\">'"),true,'card grid');
    assert(page.includes('class="browser-model-card'),true,'card article');
    assert(page.includes('browser-model-card-head'),true,'card head with name and state badge');
    assert(page.includes('browser-model-card-meta'),true,'card meta line');
    assert(page.includes('browser-model-card-actions'),true,'card action row');
    assert(page.includes('Bundled\':(file?\'Uploaded file\':\'URL model\')'),true,'card source label');
    assert(page.includes("modelCardState(entry,active,state,inventory)"),true,'per-card state resolution');
  };

  t['Card actions are scoped to the model they act on']=function(){
    ['data-browser-local-use','data-browser-local-load','data-browser-local-download','data-browser-local-remove','data-browser-local-forget']
      .forEach(function(attribute){assert(page.includes(attribute),true,attribute+' rendered');});
    assert(controller.includes("e.target.closest('[data-browser-local-use],[data-browser-local-load],[data-browser-local-download],[data-browser-local-remove],[data-browser-local-forget]')"),true,'controller dispatches card actions');
    assert(controller.includes('if(entry.bundled!==true&&await LF.UI.confirmAction('),true,'bundled default cannot be forgotten');
    assert(controller.includes("if(String(settings.model)===String(entry.id)){settings.model=LF.BrowserLocal.defaultModel.id;"),true,'forgetting the active model falls back to the default');
  };

  t['The dense stat grid and its duplicate cache list are removed']=function(){
    assert(page.includes('browser-model-stats'),false,'no stat grid markup in the panel');
    assert(css.includes('.browser-model-stats'),false,'no leftover stat grid CSS');
    assert(page.includes('browserLocalCacheList'),false,'table-based cache list removed');
    assert(page.includes("id=\"browserLocalDownload\""),false,'per-id download button replaced by card action');
    assert(page.includes("id=\"browserLocalLoad\""),false,'per-id load button replaced by card action');
    assert(page.includes("id=\"browserLocalRemove\""),false,'per-id remove button replaced by card action');
    assert(settings.includes('browserLocalCache:'),false,'stale stat-id live updates removed');
    assert(settings.includes('browserLocalStage')&&settings.includes('browserLocalBadge'),true,'live progress updates stay');
  };

  t['Adding models and runtime switches stay in dedicated disclosures']=function(){
    assert(page.includes('<summary>Add a model <small>URL or local GGUF file</small></summary>'),true,'Add a model disclosure');
    assert(page.includes('<summary>Cache &amp; runtime</summary>'),true,'Cache & runtime disclosure');
    assert(page.includes('id="browserLocalModelUrl"')&&page.includes('id="browserLocalModelFile"'),true,'URL and local file inputs');
    assert(page.includes('id="browserLocalRefreshCache"')&&page.includes('id="browserLocalCheckModel"'),true,'cache refresh and compatibility controls');
  };

  t['Component CSS owns the card grid and the UI Kit mirrors it']=function(){
    assert(css.includes('.browser-model-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))'),true,'card grid CSS');
    assert(css.includes('.browser-model-card.selected'),true,'selected card accent');
    assert(css.includes('.browser-model-card-actions'),true,'card action layout');
    assert(kit.includes('browser-model-cards')&&kit.includes('browser-model-card'),true,'UI Kit shows the card pattern');
    assert(kit.includes('browser-model-stats'),false,'UI Kit no longer shows the removed stat grid');
  };
  t['A detached or stale model always reaches the blocking setup Totem']=function(){
    const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
    assert(app.includes("title:'Install local AI model'"),true,'blocking install Totem exists');
    assert(app.includes('shadeBlur:true'),true,'setup Totem keeps the blurred backdrop');
    assert(app.includes("if(!checked.cached&&selectedModel&&selectedModel.source==='file')"),true,'detached uploaded file branch');
    assert(app.includes("browser-local.detached-file"),true,'detached file is reported');
    assert(app.includes('return startBrowserLocal(forceDownload);'),true,'detached file falls back to the bundled model setup');
    assert(app.includes('settings.model=fallback;LF.Storage.saveAiSettings(settings);'),true,'a stale catalogue id falls back to the bundled model');
    assert(app.includes('if(!totemShown)openSetupTotem(ready,true);'),true,'a model that is not ready always opens the setup Totem');
    assert(app.includes('if(!totemShown&&LF.UI&&LF.UI.activityStart)openSetupTotem(LF.BrowserLocal.state(),true);'),true,'a startup failure still opens the setup Totem');
    assert(app.includes("stage:'Selected model unavailable'"),true,'an unavailable model opens the Totem with a retry');
    assert(app.includes('openSetupTotem(LF.BrowserLocal.state(),false);},300)'),true,'the setup Totem covers a slow cache/runtime check');
  };
  t['The setup Totem shows download speed and transferred bytes without opening Technical data']=function(){
    const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const feedback=fs.readFileSync(path.join(root,'assets/js/ui/feedback.js'),'utf8');
    assert(html.includes('id="activityPrimarySpeedItem"')&&html.includes('id="activityPrimaryTransferItem"'),true,'compact runtime row owns speed and transfer metrics');
    assert(html.indexOf('activityPrimaryTransferItem')<html.indexOf('activityTechnical'),true,'transfer metric sits outside the technical disclosure');
    assert(feedback.includes('transfer:text(input.transfer)')&&feedback.includes("'speed', 'transfer'"),true,'the shared Totem carries the transfer metric');
    assert(app.includes('speed:speed,transfer:transfer,details:details'),true,'the setup Totem publishes speed and transfer');
    assert(app.includes("const transfer=total>0?formatBrowserBytes(downloaded)+' / '+formatBrowserBytes(total)"),true,'transfer shows downloaded / total');
    assert(app.includes("Transferred:transfer||'—'")&&app.includes("Speed:speed||'—'"),true,'technical details repeat speed and transfer');
  };
  return t;
};
