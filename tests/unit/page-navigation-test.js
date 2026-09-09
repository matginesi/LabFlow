'use strict';
const path=require('path'),fs=require('fs');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF,ctx){
  const root=ctx.root;
  LF.DataModel=LF.DataModel||{hydrate:function(x){return x;}};
  LF.State={state:{route:'experiment-import',experiment:null},ensureExperiment:function(){return this.state.experiment;}};
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
    if(!/@media\s*\(max-width:\s*700px\)[\s\S]*?\.page-nav-button\s*\{[^}]*min-height:\s*46px/.test(css))throw new Error('Phone page navigation must keep touch-sized buttons');
  };

  t['workflow navigation is rendered at the top only for the four primary pages']=function(){
    const shared=fs.readFileSync(path.join(root,'assets/js/pages/shared.js'),'utf8'),app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
    if(!shared.includes('return pageHead(title,subtitle,actions)+pageNavigation(route)+experimentStepper()'))throw new Error('workflow navigation must be part of the top workflow header');
    if(LF.PageShell.pageNavigation('settings')!=='')throw new Error('utility pages must not receive Previous/Next');
    if(app.includes('mountPageNavigation'))throw new Error('navigation must not be appended after page render');
    if(!app.includes("window.addEventListener('resize',syncMobileNav"))throw new Error('responsive navigation state must resync on resize');
  };
  return t;
};
