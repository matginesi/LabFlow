'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const results=fs.readFileSync(path.join(root,'assets/js/pages/results-page.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
  const settings=fs.readFileSync(path.join(root,'assets/js/ai/settings.js'),'utf8');
  const settingsPage=fs.readFileSync(path.join(root,'assets/js/pages/settings-page.js'),'utf8');
  const designPage=fs.readFileSync(path.join(root,'assets/js/pages/design-page.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const logs=fs.readFileSync(path.join(root,'assets/js/pages/logs-page.js'),'utf8');
  const logger=fs.readFileSync(path.join(root,'assets/js/logger.js'),'utf8');
  const state=fs.readFileSync(path.join(root,'assets/js/state.js'),'utf8');
  const reportExport=fs.readFileSync(path.join(root,'vendor/report-export/report-export.js'),'utf8');
  const uiKitInline=fs.readFileSync(path.join(root,'assets/js/pages/ui-kit-inline.js'),'utf8');

  t['PCE distribution has a compact diagnostic layout with bounded zoom']=function(){
    assert(results.includes('data-pce-zoom="in"'),true,'zoom in control');
    assert(results.includes('histogramStats'),true,'distribution statistics');
    assert(results.includes('chart-stat-median'),true,'median marker');
    assert(results.includes('S.state.pceDistributionZoom||1'),true,'zoom state');
    assert(css.includes('.overview-pce-panel'),true,'narrow PCE panel style');
  };

  t['Action checklist is height bounded and scrollable']=function(){
    assert(css.includes('max-height:148px'),true,'desktop checklist height');
    assert(css.includes('overflow-y:auto'),true,'checklist scroll');
    assert(css.includes('scrollbar-gutter:stable'),true,'stable scrollbar');
  };

  t['Action Totem commands remain tappable without horizontal overflow on phones']=function(){
    assert(html.includes('id="activityHeadActions" data-status="running"'),true,'lifecycle state hook');
    assert(css.includes('.activity-totem .activity-head-actions[data-status="error"] #activityRetry'),true,'error retry occupies primary row');
    assert(css.includes('min-height:36px!important'),true,'mobile touch target');
    assert(css.includes('overflow:visible!important'),true,'no command-strip scrolling');
  };

  t['Detect provider metadata uses the Action totem lifecycle']=function(){
    assert(settings.includes("title:'Detect model capabilities'"),true,'detect totem title');
    assert(settings.includes("stepId:'capability'"),true,'capability checkpoint');
    assert(settings.includes("activity.activityFinish({message:'Provider metadata detection completed.'"),true,'detect terminal totem');
  };

  t['Provider detection runs only from explicit Detect; connection test stays minimal']=function(){
    assert(settings.includes('function scheduleModelDetection(options)'),false,'no settings-open scheduler');
    assert(app.includes("e.target.id==='aiModel'||e.target.id==='aiEndpoint'"),false,'field changes do not contact provider');
    assert(settings.includes('await loadModels({silent:true})'),false,'connection test must not trigger model detection');
    assert(settingsPage.includes('Press Detect to read model capabilities and the catalogue when the provider exposes one.'),true,'shared Detect policy is visible');
    assert(settings.includes("Log.error('connection-test.failed'"),true,'connection failures are always logged');
    assert(settings.includes('python tools/serve_static.py'),false,'no Python server requirement in runtime guidance');
  };

  t['Provider settings expose portable thinking policy and rich connection diagnostics']=function(){
    assert(settingsPage.includes('id="aiThinkingMode"'),true,'thinking policy selector');
    assert(settingsPage.includes('Follow each Action (recommended)'),true,'Action-owned default');
    assert(settings.includes('## Connection diagnostics'),true,'rich connection diagnostics');
    assert(settings.includes('Successful provider round trip'),true,'round-trip metric');
    assert(settings.includes('Thinking request'),true,'applied thinking mode is reported');
  };

  t['Design proposal exposes a compact secondary confidence instrument']=function(){
    assert(designPage.includes('Proposal confidence'),true,'decision metric label');
    assert(designPage.includes('Secondary indicator: mean confidence across proposed fields only'),true,'metric limitation');
    assert(css.includes('.design-decision-dial'),true,'compact dial styling');
  };

  t['Report editor updates source immediately but debounces expensive preview work']=function(){
    assert(app.includes("LF.Report.setActiveMarkdown(S.state.experiment,e.target.value);markDraft('report');scheduleReportEditorPreview(e.target.value)"),true,'editor source updates on every input');
    assert(app.includes('window.setTimeout(function(){renderReportEditorPreview(markdown);},220)'),true,'preview and MathJax are debounced');
    assert(app.includes("syncActiveReportEditor('pdf-export')"),true,'PDF export synchronizes visible editor first');
    assert(app.includes("syncActiveReportEditor('before-ai-writing-help')"),true,'AI writing help synchronizes visible editor first');
  };

  t['Report figure selection is visual and selected figures are visible in preview']=function(){
    const reportPage=fs.readFileSync(path.join(root,'assets/js/pages/report-page.js'),'utf8');
    assert(reportPage.includes('figure-picker-preview'),true,'visual thumbnails in picker');
    assert(reportPage.includes('data-figure-picker-all="true"'),true,'select all control');
    assert(reportPage.includes('data-figure-picker-all="false"'),true,'select none control');
    assert(reportPage.includes('report-preview-figures-head'),true,'selected figures are visible in document preview');
    assert(css.includes('.figure-picker-tools'),true,'picker tools styling');
  };

  t['Report equations are compact in preview PDF and DOCX']=function(){
    assert(css.includes('.report-preview .math-display mjx-container[display="true"]{font-size:.86em!important}'),true,'compact preview equation scale');
    assert(reportExport.includes('scale=Math.min(1,430/w,82/h)'),true,'DOCX equations never upscale beyond their natural raster size');
    assert(reportExport.includes('maxW=Math.min(390'),true,'bounded PDF equation width');
    assert(reportExport.includes('maxH=42'),true,'compact PDF equation height');
    assert(reportExport.includes('Math.max(125'),false,'PDF no longer forces a huge minimum equation width');
  };

  t['Long-session navigation avoids unbounded DOM and log payload work']=function(){
    assert(app.includes('SCROLL_MEMORY_SELECTOR'),true,'bounded scroll-memory selector');
    assert(app.includes("main.querySelector('.math-display,.math-inline')"),true,'MathJax only when active page has math');
    assert(app.includes("LF.LogsPage.bind(main)"),true,'log details bound lazily');
    assert(logs.includes('RENDER_LIMIT=120'),true,'bounded visible logs');
    assert(logs.includes('log-lazy-detail'),true,'payload details are lazy');
    assert(logger.includes('MAX_LOG_STRING_CHARS = 60000'),true,'logger bounds giant payload strings');
    assert(state.includes('delete compact.outputs'),true,'old duplicated Action output history is compacted');
  };

  t['UI Kit renders inline in the host shell and is safe under file protocol']=function(){
    assert(app.includes('LF.UIKitInline.render'),true,'UI Kit uses inline renderer');
    assert(app.includes("document.querySelector('.ui-kit-frame')"),false,'no iframe dependency in app shell');
    assert(uiKitInline.includes('ui-kit-inline-host'),true,'inline catalog host exists');
    assert(uiKitInline.includes('id="documentation-pattern"'),true,'full catalog includes patterns after nested main elements');
    assert(uiKitInline.includes("root.querySelectorAll('[data-ui-kit-group]')"),true,'inline filters operate in host document');
    assert(html.includes('assets/js/pages/ui-kit-inline.js'),true,'inline catalog module is loaded');
    const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'ui-kit.html'),'utf8')).digest('hex');
    assert(uiKitInline.includes('sha256:'+sourceHash),true,'inline catalog is generated from current visual ground truth');
  };

  t['Action lifecycle updates do not rebuild the active page editor']=function(){
    assert(app.includes("if(reason!=='actionRun'&&reason!=='assistant')render()"),true,'actionRun and Assistant lifecycle must not trigger a full page render');
    assert(app.includes("if(reason!=='actionRun')scheduleWorkspaceSave"),true,'transient action lifecycle must not autosave the Working Copy');
  };

  t['Working Copy restores from IndexedDB and Reset is the explicit clear boundary']=function(){
    assert(app.includes('await LF.Storage.loadExperiment()'),true,'load persisted experiment');
    assert(app.includes("scheduleWorkspaceSave('draft:"),true,'draft autosave');
    assert(app.includes("persistWorkspace('pagehide')"),true,'pagehide persistence');
    assert(app.includes('LF.Storage.clearSavedExperiment'),true,'reset clears persistent workspace');
    assert(html.includes('class="button danger compact reset-session-button"'),true,'visible reset control');
  };
  return t;
};
