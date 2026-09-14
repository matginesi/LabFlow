(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  let searchTimer=null;
  function message(text,type){if(LF.UI&&LF.UI.message)LF.UI.message(text,type||'info');}
  async function handleClick(e,ctx){
    const S=ctx.state,render=ctx.render,C=ctx.core;
    const pick=e.target.closest('[data-kb-entry]');if(pick){S.state.ui.settingsKnowledgeId=pick.dataset.kbEntry;render();return true;}
    if(e.target.closest('#kbAddEntry')){S.state.ui.settingsKnowledgeId='__new__';render();return true;}
    if(e.target.closest('#saveKbEntry')){const item=LF.KnowledgeBase.save(ctx.readForm());S.state.ui.settingsKnowledgeId=item.id;message(item.status==='active'?'Knowledge saved and available to AI.':'Knowledge draft saved.','success');render();return true;}
    if(e.target.closest('#duplicateKbEntry')){const btn=e.target.closest('#duplicateKbEntry'),id=btn.dataset.kbId||S.state.ui.settingsKnowledgeId,item=LF.KnowledgeBase.duplicate(id);S.state.ui.settingsKnowledgeId=item.id;message('Knowledge copied as a draft.','success');render();return true;}
    if(e.target.closest('#deleteKbEntry')){
const btn=e.target.closest('#deleteKbEntry'),id=btn.dataset.kbId||S.state.ui.settingsKnowledgeId,
      item=LF.KnowledgeBase.get(id);if(item&&await LF.UI.confirmAction('Delete “'+item.title+
      '” from the custom Knowledge Base?',{title:'Delete knowledge entry',confirmLabel:'Delete',danger:true})){
      LF.KnowledgeBase.remove(id);S.state.ui.settingsKnowledgeId='';message('Knowledge entry deleted.','success');render();
      }return true;}
    if(e.target.closest('#exportKb')){try{const out=await LF.KnowledgeBase.saveJsonlFile('custom');if(out&&!out.cancelled)message((out.mode==='file'?'Saved ':'Downloaded ')+(out.fileName||'LabFlow JSONL')+' · '+out.entries+' reference'+(out.entries===1?'':'s')+'.','success');}catch(err){message('JSONL could not be saved: '+(err.message||String(err)),'error');}return true;}
    if(e.target.closest('#downloadFullKb')){try{const payload=LF.KnowledgeBase.exportJsonl('all');C.downloadBlob(C.textBlob(payload,'application/x-ndjson;charset=utf-8'),'labflow-knowledge-library.jsonl');message('Full Knowledge Base downloaded as JSONL.','success');}catch(err){message('Knowledge Base download failed: '+(err.message||String(err)),'error');}return true;}
    if(e.target.closest('#importKb')){try{if(LF.KnowledgeBase.openJsonlFile){
const out=await LF.KnowledgeBase.openJsonlFile('merge');if(out&&!out.fallback){if(out.cancelled)return true;
      S.state.ui.settingsKnowledgeId='';render();
      message('Opened '+(out.fileName||'JSONL')+' · '+out.imported+' editable reference'+(out.imported===1?'':'s')+' loaded'+
      (out.skippedBuiltIn?' · '+out.skippedBuiltIn+' built-in duplicate'+(out.skippedBuiltIn===1?'':'s')+' ignored':'')+'.',
      'success');return true;}}const input=document.getElementById('kbImportFile');if(input)input.click();
      }catch(err){message('Knowledge Base import failed: '+(err.message||String(err)),'error');}return true;}
    if(e.target.closest('#resetKbCustom')){
if(await LF.UI.confirmAction('Clear every editable Knowledge Base reference from this browser? Save your JSONL first if you want to keep them.',
      {title:'Clear my Knowledge Base',confirmLabel:'Clear my references',danger:true})){LF.KnowledgeBase.resetCustom();
      S.state.ui.settingsKnowledgeId='';message('Your editable Knowledge Base is now empty.','success');render();}return true;
      }
    return false;
  }
  function handleChange(e,ctx){if(e.target.id!=='kbSettingsKind')return false;ctx.state.state.ui.settingsKnowledgeKind=e.target.value||'all';ctx.render();return true;}
  function handleInput(e,ctx){if(e.target.id!=='kbSettingsSearch')return false;ctx.state.state.ui.settingsKnowledgeQuery=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(function(){ctx.render();const input=document.getElementById('kbSettingsSearch');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}},150);return true;}
  async function handleFileChange(e,ctx){if(!e.target||e.target.id!=='kbImportFile')return false;
const file=e.target.files&&e.target.files[0];if(!file)return true;
    try{const limits=LF.KnowledgeBase.limits?LF.KnowledgeBase.limits():{},max=Number(limits.jsonlChars)||5*1024*1024;
    if(file.size>max)throw new Error('JSONL file exceeds the 5 MB browser limit.');
    const text=await file.text(),out=LF.KnowledgeBase.importJsonl(text,'merge');ctx.state.state.ui.settingsKnowledgeId='';
    ctx.render();message('Opened '+file.name+' · '+out.imported+' editable reference'+(out.imported===1?'':'s')+' loaded'+
    (out.skippedBuiltIn?' · '+out.skippedBuiltIn+' built-in duplicate'+(out.skippedBuiltIn===1?'':'s')+' ignored':'')+'.',
    'success');}catch(err){message('Knowledge Base import failed: '+(err.message||String(err)),'error');
    }finally{e.target.value='';}return true;}
  LF.KnowledgeController={handleClick,handleChange,handleInput,handleFileChange};
})();
