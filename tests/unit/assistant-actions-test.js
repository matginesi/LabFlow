'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const assistant=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');
  const actionUi=fs.readFileSync(path.join(root,'assets/js/ai/action-ui.js'),'utf8');
  const context=fs.readFileSync(path.join(root,'assets/js/ai/context.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const design=fs.readFileSync(path.join(root,'assets/js/pages/design-page.js'),'utf8');
  const prompt=fs.readFileSync(path.join(root,'actions/assistant.chat/prompt.md'),'utf8');

  t['Assistant exposes a contextual Action launcher and slash commands']=function(){
    assert(html.includes('assistantActionsToggle')&&html.includes('assistantActionMenu'),'Action launcher exists');
    ['/design','/interpret','/compare','/resolve','/actions'].forEach(function(cmd){assert(assistant.includes("'"+cmd+"'"),cmd+' command exists');});
    assert(assistant.includes("lower.indexOf('/action ')===0"),'generic Action command exists');
    assert(assistant.includes("visibility==='public'"),'only researcher-visible Actions are offered');
  };
  t['Assistant Action palette applies canonical guards and current Design selection']=function(){
    assert(assistant.includes('LF.ActionGuards&&LF.ActionGuards.check'),'palette evaluates Action guards');
    assert(assistant.includes('state.selectedDesignDeviceId'),'Design Action uses current selected experiment');
    assert(assistant.includes("LF.ActionUI.run(id,'',{params:actionParams(id),fromAssistant:true})"),'palette routes through canonical ActionUI');
  };
  t['Action results and failures are visible in the Assistant conversation']=function(){
    assert(actionUi.includes('structured:structured'),'structured provider output is retained');
    assert(actionUi.includes('publishActionFailure'),'Action failures are published');
    assert(assistant.includes('chat-action-result markdown-view'),'Action summary renders inline');
    assert(assistant.includes('Structured Action output'),'raw structured output remains available in Details');
    assert(css.includes('.chat-action-result')&&css.includes('.chat-action-menu'),'Action result and launcher styles exist');
  };
  t['Assistant model receives the Action catalog and Design uses the denser workbench layout']=function(){
    assert(context.includes('available_actions=assistantActions(exp)'),'Action catalog is part of Assistant context');
    assert(context.includes('recent_actions=recentActionEvents(exp)'),'recent Action outcomes are separately available to later Assistant turns');
    assert(prompt.includes('Treat `available_actions` as the authoritative Action catalog'),'prompt uses Action catalog');
    assert(design.includes('design-top-grid'),'Design selector and active experiment share a compact top workbench');
    assert(css.includes('.design-page .design-top-grid'),'Design workbench layout is styled');
    assert(css.includes('.design-page .panel-head{min-height:40px!important'),'Design has route-local compact panel density');
  };
  return t;
};
