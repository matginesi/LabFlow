'use strict';
const path=require('path'),fs=require('fs');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF,ctx){
  const root=ctx.root;
  LF.DataModel=LF.DataModel||{hydrate:function(x){return x;}};
  LF.State={state:{route:'experiment-import',ui:{route:'experiment-import'},experiment:null},ensureExperiment:function(){return this.state.experiment;}};
  delete require.cache[require.resolve(path.join(root,'assets/js/pages/shared.js'))];
  require(path.join(root,'assets/js/pages/shared.js'));

  t['page route order is one shared source for workflow and in-page navigation']=function(){
    assert(LF.PageShell.routes.map(function(x){return x.id;}),[
      'experiment-import','experiment-results','experiment-design','experiment-export','cabinet','documentation','logs','ui-kit','settings'
    ],'route order');
    const html=LF.PageShell.pageNavigation('experiment-design');
    if(!html.includes('data-route="experiment-results"')||!html.includes('<strong>Results</strong>'))throw new Error('Design previous route must be Results');
    if(!html.includes('data-route="experiment-export"')||!html.includes('<strong>Export</strong>'))throw new Error('Design next route must be Export');
  };

  t['navigation blocks experiment-only routes until a dataset exists']=function(){
    LF.State.state.experiment=null;
    const html=LF.PageShell.pageNavigation('experiment-import');
    if(!/data-route="experiment-results"[^>]*disabled/.test(html))throw new Error('Results must be disabled before import');
    LF.State.state.experiment={id:'exp_1',raw:{sourceArchive:{name:'raw.zip'}}};
    const ready=LF.PageShell.pageNavigation('experiment-import');
    if(/data-route="experiment-results"[^>]*disabled/.test(ready))throw new Error('Results must be enabled after import');
  };

  t['responsive contract keeps desktop sidebar persistent and phone navigation touch sized']=function(){
    const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
    if(!/\.app-shell\s*\{[\s\S]*?grid-template-columns:\s*var\(--sidebar-w\)\s+minmax\(0,\s*1fr\)/.test(css))throw new Error('Desktop shell must reserve a sidebar column');
    if(!/@media\s*\(max-width:\s*1100px\)[\s\S]*?\.sidebar\s*\{[\s\S]*?position:\s*fixed!important/.test(css))throw new Error('<=1100 sidebar must become off-canvas');
    if(!/\.page-nav-next\{[^}]*background:var\(--accent-soft\)/.test(css))throw new Error('Next navigation must receive a visible themed accent treatment');
    if(!/\.workflow-page-nav\{[^}]*position:sticky[^}]*top:0/.test(css))throw new Error('Workflow navigation must stay visible at the top of the main scroller');
    if(!/@media\s*\(max-width:\s*700px\)[\s\S]*?\.workflow-page-nav \.page-nav-position\{display:none\}[\s\S]*?\.workflow-page-nav \.page-nav-button\{[^}]*min-height:\s*48px/.test(css))throw new Error('Phone navigation must hide the center pill and keep touch-sized Previous/Next buttons');
  };


  t['Design runtime uses the shared workflow header so Previous and Next cannot disappear']=function(){
    const design=fs.readFileSync(path.join(root,'assets/js/pages/design-page.js'),'utf8');
    if(!design.includes("options.workflowHead?options.workflowHead('Design Experiment'"))throw new Error('Design must render the shared workflow header');
    if(!design.includes("'Complete with AI'"))throw new Error('Design must expose one completion action rather than a second Suggest missing step');
    if(!design.includes("'Retry inference'"))throw new Error('Design must expose Retry inference only after an exhausted attempt');
  };


  t['route and tab navigation start the selected workspace predictably']=function(){
    const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
    if(!app.includes("renderAtWorkspaceStart('.results-main-tabs')"))throw new Error('Results tab and mode switches must align the selected workspace to its start');
    if(!app.includes("renderAtWorkspaceStart('.settings-tabs')"))throw new Error('Settings section switches must align the selected workspace to its start');
    if(!app.includes("renderAtWorkspaceStart('.docs-workbench')"))throw new Error('Documentation topic switches must align the selected document workspace to its start');
    if(!app.includes("renderAtWorkspaceStart('.cabinet-filter-tabs')"))throw new Error('Cabinet kind switches must align the selected shelf workspace to its start');
    if(!app.includes("if(!renderedRoute||routeChanged)main.scrollTop=0"))throw new Error('route changes must start the destination page at the top');
    if(app.includes('nodes=[root]'))throw new Error('main document scroll must not be restored as local scroll memory');
    if(!app.includes("if(id==='experiment-results')return id+':'+String(ui.resultsTab||'overview')"))throw new Error('Results local scroll memory must be view-scoped');
    if(!app.includes("if(id==='documentation')return id+':'+String(ui.docsSlug||'')"))throw new Error('Documentation local scroll memory must be document-scoped');
    if(!/\.results-main-tabs\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/.test(css))throw new Error('Results main tabs must remain a stable sticky workspace anchor');
  };

  t['split workbenches respond to real workspace width instead of viewport only']=function(){
    const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
    if(!/\.main-area\{[\s\S]*?container-type:\s*inline-size/.test(css))throw new Error('main area must expose its real content width to responsive layouts');
    if(!/@container\s*\(max-width:1100px\)[\s\S]*?\.kb-workbench[\s\S]*?grid-template-columns:1fr!important/.test(css))throw new Error('KB catalogue/editor must stack when the actual workspace becomes narrow');
    if(!/@container\s*\(max-width:1100px\)[\s\S]*?\.settings-workspace-grid/.test(css))throw new Error('settings split panels must stack by actual workspace width');
  };

  t['Design reflows the workbench before shrinking scientific controls']=function(){
    const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
    if(!/@media\(max-width:980px\)[\s\S]*?\.design-active-strip\{grid-template-columns:minmax\(0,1fr\) auto/.test(css))throw new Error('Design active strip must simplify before phone widths');
    if(!/@media\(max-width:700px\)[\s\S]*?\.design-variant-cards\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(css))throw new Error('Design experiment cards must become a compact two-column grid on phone');
    if(!/@media\(max-width:700px\)[\s\S]*?\.design-active-strip\{grid-template-columns:1fr/.test(css))throw new Error('Design active strip must become one column on phone');
    if(!/@media\(max-width:430px\)[\s\S]*?\.design-page \.design-chem-grid\{grid-template-columns:1fr/.test(css))throw new Error('Design chemistry must become one column on narrow phones');
  };

  t['workflow navigation is rendered at the top only for the four primary pages']=function(){
    const shared=fs.readFileSync(path.join(root,'assets/js/pages/shared.js'),'utf8'),app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
    if(!shared.includes('return pageNavigation(route)+pageHead(title,subtitle,actions)+experimentStepper()'))throw new Error('workflow navigation must be the first workflow card');
    if(LF.PageShell.pageNavigation('settings')!=='')throw new Error('utility pages must not receive Previous/Next');
    if(app.includes('mountPageNavigation'))throw new Error('navigation must not be appended after page render');
    if(!app.includes("window.addEventListener('resize',syncMobileNav"))throw new Error('responsive navigation state must resync on resize');
  };
  return t;
};
