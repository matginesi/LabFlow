'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF,ctx){
  const script=fs.readFileSync(path.join(ctx.root,'labflow_engine.sh'),'utf8');
  const settings=fs.readFileSync(path.join(ctx.root,'assets/js/pages/settings-page.js'),'utf8');
  t['llama.cpp launcher uses one same-machine mode for local LabFlow and GitHub Pages']=function(){
    assert(script.includes('CORS_ORIGINS="${LABFLOW_CORS_ORIGINS:-}"'),'default CORS must remain unset');
    assert(script.includes('same launcher supports local LabFlow and https://matginesi.github.io/LabFlow/'),'same-machine summary missing');
    assert(!script.includes('--github-pages'),'obsolete GitHub Pages mode must be removed');
    assert(script.includes('omit --cors-origin for automatic local + GitHub Pages support'),'multi-origin workaround missing');
  };
  t['GitHub Pages settings explain the local llama.cpp bridge']=function(){
    assert(settings.includes('GitHub Pages → local llama.cpp'),'GitHub Pages hint missing');
    assert(settings.includes('<code>./labflow_engine.sh</code>'),'plain launcher command missing');
    assert(settings.includes('data-copy-github-llama'),'copy control missing');
    assert(!settings.includes('./labflow_engine.sh --github-pages'),'obsolete special launcher mode remains');
  };
};
