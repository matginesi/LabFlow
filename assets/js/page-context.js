(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  function cleanText(v){return String(v==null?'':v).replace(/%%LF(?:MD|CODE)[^%]*%%/g,'').replace(/\u0000LF(?:MD|CODE)[^\u0000]*\u0000/g,'').trim();}
  function clone(v){try{return JSON.parse(JSON.stringify(v||{}));}catch(_){return{};}}
  function state(){return LF.State&&LF.State.state&&LF.State.state.ui?LF.State.state.ui:null;}
  function publish(page,payload){const ui=state();if(!ui)return{};const ctx=Object.assign({page:String(page||''),view:'',selected:{},filters:{},visible:[],updatedAt:new Date().toISOString()},clone(payload));ctx.page=cleanText(ctx.page);ctx.view=cleanText(ctx.view);ui.pageContext=ctx;return ctx;}
  function clear(){const ui=state();if(ui)ui.pageContext={page:'',view:'',selected:{},filters:{},visible:[],updatedAt:new Date().toISOString()};}
  function snapshot(){const ui=state();return clone(ui&&ui.pageContext||{});}
  function summary(ctx){ctx=ctx||snapshot();const parts=[];if(ctx.page)parts.push(ctx.page);if(ctx.view)parts.push(ctx.view);const s=ctx.selected||{};['experiment','sample','measurement','group','finding','component','document','mapping'].forEach(function(k){if(s[k])parts.push(cleanText(s[k]));});return parts.filter(Boolean).join(' · ')||'Current page';}
  LF.PageContext={publish:publish,clear:clear,snapshot:snapshot,summary:summary,cleanText:cleanText};
}());
