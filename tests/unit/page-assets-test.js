'use strict';
const fs=require('fs'),path=require('path');
function assert(value,label){if(!value)throw new Error(label||'assertion failed');}
module.exports=function(t,LF,ctx){
  const root=ctx.root;
  t['every local script referenced by index.html exists']=function(){
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const scripts=Array.from(html.matchAll(/<script\s+src="([^"]+)"/g)).map(function(m){return m[1].replace(/\?v=[^?#]+$/,'');}).filter(function(src){return !/^https?:/i.test(src);});
    scripts.forEach(function(src){assert(fs.existsSync(path.join(root,src)),src+' is referenced by index.html but missing');});
    assert(scripts.includes('assets/js/export/nomad.js'),'NOMAD export module must use the current path');
    assert(scripts.includes('assets/js/pages/export-page.js'),'Export page module must use the current path');
    assert(!scripts.includes('assets/js/nomad/nomad.js'),'obsolete NOMAD module path must not remain');
    assert(!scripts.includes('assets/js/pages/nomad-page.js'),'obsolete NOMAD page path must not remain');
  };
  t['Export page registers the render API expected by app.js']=function(){
    const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
    const page=fs.readFileSync(path.join(root,'assets/js/pages/export-page.js'),'utf8');
    assert(app.includes("LF.ExportPage.render(S.state)"),'app must call ExportPage.render');
    assert(page.includes('LF.ExportPage={render:render};'),'Export page must register render');
  };
};
