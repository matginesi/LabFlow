'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const assistant=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');
  const actionUi=fs.readFileSync(path.join(root,'assets/js/ai/action-ui.js'),'utf8');
  const capabilities=fs.readFileSync(path.join(root,'assets/js/ai/action-capabilities.js'),'utf8');
  const context=fs.readFileSync(path.join(root,'assets/js/ai/context.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const design=fs.readFileSync(path.join(root,'assets/js/pages/design-page.js'),'utf8');
  const prompt=fs.readFileSync(path.join(root,'actions/assistant.chat/prompt.md'),'utf8');

  t['Assistant exposes one global Action catalog with manifest-defined commands']=function(){
    assert(html.includes('assistantActionsToggle')&&html.includes('assistantActionMenu'),'Action launcher exists');
    assert(!html.includes('assistantQuickActions')&&!assistant.includes('renderQuickActions'),'redundant always-visible Action strip is removed');
    assert(assistant.includes('LF.ActionCapabilities&&LF.ActionCapabilities.resolveCommand'),'Assistant resolves commands through capability catalog');
    assert(!assistant.includes("const aliases={'/design'"),'slash command aliases are not duplicated in Assistant');
    ['design.infer','results.interpret','results.compare','dataset.resolve-ambiguities'].forEach(function(id){const d=JSON.parse(fs.readFileSync(path.join(root,'actions',id,'action.json'),'utf8'));assert(d.ui&&/^\//.test(d.ui.command),id+' declares one slash command');assert(Array.isArray(d.ui.routes)&&d.ui.routes.length,id+' declares recommended routes');});
  };
  t['Assistant palette and ActionUI share one canonical availability service']=function(){
    assert(assistant.includes('LF.ActionCapabilities&&LF.ActionCapabilities.catalog'),'palette uses capability catalog');
    assert(context.includes('LF.ActionCapabilities.assistantCatalog'),'Assistant context uses the same catalog');
    assert(/LF\.ActionGuards\s*&&\s*LF\.ActionGuards\.check/.test(capabilities),'capability service evaluates canonical guards once');
    const runBlock=actionUi.slice(actionUi.indexOf('function run(id,userText,opts,retry){'),actionUi.indexOf('function bind(){'));assert(runBlock.indexOf('capability&&!capability.available')<runBlock.indexOf('LF.UI.activityStart'),'preflight happens before progress UI');
  };
  t['Action results and failures are visible in the Assistant conversation']=function(){
    assert(actionUi.includes('structured:structured'),'structured provider output is retained');
    assert(actionUi.includes('publishActionFailure'),'Action failures are published');
    assert(assistant.includes('chat-action-result markdown-view'),'Action summary renders inline');
    assert(assistant.includes('Structured Action output'),'raw structured output remains available in Details');
    assert(css.includes('.chat-action-result')&&css.includes('.chat-action-menu'),'Action result and launcher styles exist');
  };
  t['Assistant model receives the Action catalog and Design uses the denser workbench layout']=function(){
    assert(context.includes('action_catalog=actionCatalog(exp)'),'Action catalog is part of Assistant context');
    assert(context.includes('action_outputs=LF.ActionData'),'persisted Action outputs use the owner API in Assistant context');
    assert(context.includes('recent_actions=recentActionEvents(exp)'),'recent Action outcomes are separately available to later Assistant turns');
    assert(prompt.includes('Treat `action_catalog` as the authoritative Action catalog'),'prompt uses Action catalog');
    assert(design.includes('design-experiment-workbench'),'Design selector and active experiment share one compact workbench');
    assert(design.includes('design-active-strip'),'active experiment is a compact strip rather than a duplicate panel');
    assert(!design.includes('SELECTED EXPERIMENT'),'legacy selected-experiment hero is removed');
    assert(css.includes('.design-active-strip'),'compact active-experiment strip is styled');
    assert(css.includes('.design-page .panel-head{min-height:44px!important'),'Design has readable route-local panel density');
  };
  return t;
};
