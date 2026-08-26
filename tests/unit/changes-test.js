'use strict';
const fs=require('fs');
const path=require('path');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF,env){
  const root=env&&env.root||path.resolve(__dirname,'../..');
  const shared=fs.readFileSync(path.join(root,'assets/js/pages/shared.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
  const report=fs.readFileSync(path.join(root,'assets/js/pages/report-page.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const state=fs.readFileSync(path.join(root,'assets/js/state.js'),'utf8');
  t['Changes is no longer a workflow page']=function(){assert(fs.existsSync(path.join(root,'assets/js/pages/changes-page.js')),false,'Changes page module removed');assert(shared.includes('experiment-changes'),false,'workflow has no Changes step');assert(app.includes("route==='experiment-changes'"),false,'app has no Changes render branch');assert(report.includes('data-route="experiment-changes"'),false,'Report has no Review changes button');assert(html.includes('changes-page.js'),false,'Changes page is not loaded');};
  t['legacy saved Changes routes fall forward to NOMAD']=function(){assert(state.includes("if (route === 'experiment-changes') return 'experiment-nomad';"),true,'old saved route has a harmless compatibility redirect');};
  return t;
};
