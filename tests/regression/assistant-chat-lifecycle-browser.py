#!/usr/bin/env python3
"""Navigation-free Chromium regression for the real Assistant lifecycle code.

Uses page.set_content() because this execution environment blocks localhost/file
navigation by browser policy. The production assistant.js is injected unchanged.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ASSISTANT_JS = (ROOT / "assets/js/ai/assistant.js").read_text()


def check(value, label):
    if not value:
        raise AssertionError(label)


HTML = """
<style>
#chatLog{height:260px;overflow-y:auto}.chat-body{overflow:visible}.chat-details{display:block}
</style>
<div id="assistantContext"></div><pre id="assistantContextPayload"></pre>
<div id="chatLog"></div><button id="chatJumpLatest" hidden>latest</button>
<textarea id="chatInput"></textarea><button id="chatSend">Send</button>
"""

STUBS = r"""
(() => {
  let uid=0;
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  window.LabFlow={
    Core:{
      uid:p=>(p||'id')+'_'+(++uid), cleanModelText:v=>String(v??''), escapeHtml:esc,
      markdown:s=>'<p>'+esc(String(s??'')).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')+'</p>',
      highlightCode:s=>esc(s), copyText:()=>{}
    },
    Logger:{scope:()=>({info:()=>{},warn:()=>{},error:()=>{},debug:()=>{}})},
    Icons:{icon:()=>''}, UI:{toast:()=>{}},
    Storage:{
      getAiSettings:()=>({provider:'test',endpoint:'local',model:'test-model'}),
      getApiKey:()=>''
    },
    AIProviders:{test:{keyRequired:false}},
    PageContext:{snapshot:()=>({route:'results'}),summary:()=> 'Results'},
    State:{
      state:{experiment:{id:'exp',meta:{sourceName:'test.zip'},derived:{chat:{conversation:[]}}},ui:{}},
      ensureDerived(exp){exp.derived=exp.derived||{};return exp.derived;},
      ensureExperiment(){return this.state.experiment;},
      notify(reason){ window.__notifyReasons.push(reason); if(reason!=='assistant') window.__globalRenders++; },
      setRoute(){}
    },
    ActionRunner:{isRunning:()=>false,cancel:()=>true}
  };
  window.__notifyReasons=[]; window.__globalRenders=0;
})();
"""

PENDING = r"""
(() => {
  window.__pending={};
  LabFlow.ActionRunner={
    isRunning:()=>false,
    run:(id,options)=>new Promise(resolve=>{__pending.options=options;__pending.resolve=resolve;}),
    cancel:()=>{__pending.resolve({status:'aborted',requestMeta:{}});return true;}
  };
})();
"""

with sync_playwright() as p:
    chromium = shutil.which('chromium') or shutil.which('chromium-browser')
    browser = p.chromium.launch(headless=True, executable_path=chromium) if chromium else p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 480, "height": 600})
    page.set_content(HTML)
    page.add_script_tag(content=STUBS)
    page.add_script_tag(content=ASSISTANT_JS)
    page.evaluate("LabFlow.Assistant.bind(); LabFlow.Assistant.render({forceBottom:true});")

    # First turn: one bubble, one spinner, stream into same bubble, clean finish.
    page.add_script_tag(content=PENDING)
    page.evaluate("() => { LabFlow.Assistant.sendChat('First question'); }")
    check(page.locator('.assistant-row').count()==1, 'first request must create one Assistant row')
    check(page.locator('.chat-spinner').count()==1, 'first request must show one spinner')
    first_id=page.locator('.assistant-row .chat-message').get_attribute('data-message-id')
    page.evaluate("__pending.options.onProgress({content:'**First answer**',reasoning:'hidden reasoning'})")
    check(page.locator('.chat-spinner').count()==0, 'first content must remove spinner')
    check(page.locator('.assistant-row .chat-message').get_attribute('data-message-id')==first_id, 'stream must reuse first Assistant row')
    page.evaluate("__pending.resolve({status:'done',result:'**First answer**',requestMeta:{chat:{provider:'test',model:'test-model',latencyMs:10}}})")
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator('.assistant-row').count()==1, 'first completion must not duplicate row')
    check(page.locator('.chat-spinner').count()==0, 'first completion must leave no spinner')
    check(not page.locator('#chatInput').is_disabled(), 'composer must re-enable after first turn')

    # Second turn: regression for the stuck-spinner/dead-chat bug.
    page.add_script_tag(content=PENDING)
    page.evaluate("() => { LabFlow.Assistant.sendChat('Second question'); }")
    check(page.locator('.assistant-row').count()==2, 'second request must create exactly one additional Assistant row')
    check(page.locator('.chat-spinner').count()==1, 'second request must show exactly one spinner')
    second_id=page.locator('.assistant-row .chat-message').last.get_attribute('data-message-id')
    page.evaluate("__pending.options.onProgress({content:'Second answer'})")
    check(page.locator('.chat-spinner').count()==0, 'second first content must remove spinner')
    page.evaluate("__pending.resolve({status:'done',result:'Second answer',requestMeta:{chat:{provider:'test',model:'test-model',latencyMs:8}}})")
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator('.assistant-row').count()==2, 'second completion must not duplicate row')
    check(page.locator('.assistant-row .chat-message').last.get_attribute('data-message-id')==second_id, 'second completion must retain message identity')
    check(page.locator('.chat-spinner').count()==0, 'second completion must leave no spinner')
    check('Second answer' in page.locator('.assistant-row').last.inner_text(), 'second answer must be visible')
    check(not page.locator('#chatInput').is_disabled(), 'composer must re-enable after second turn')

    # Error and abort must also clear transient state.
    page.evaluate("() => { LabFlow.ActionRunner={isRunning:()=>false,run:()=>Promise.resolve({status:'error',code:'TEST',message:'Provider failed',requestMeta:{}}),cancel:()=>true}; LabFlow.Assistant.sendChat('Fail'); }")
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator('.chat-spinner').count()==0, 'error must leave no spinner')
    check(page.locator('[data-retry-message]').count()==1, 'error must expose retry')

    page.add_script_tag(content=PENDING)
    page.evaluate("() => { LabFlow.Assistant.sendChat('Cancel'); }")
    page.evaluate("LabFlow.Assistant.cancel()")
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator('.chat-spinner').count()==0, 'abort must leave no spinner')

    check(page.evaluate("__globalRenders") == 0, 'Assistant notify must not request global page renders in the regression harness')
    check(page.evaluate("__notifyReasons.every(x=>x==='assistant')"), 'Assistant lifecycle must use assistant-scoped notifications')
    print('assistant lifecycle browser regression: OK (two turns + error + abort)')
    browser.close()
