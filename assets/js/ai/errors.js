(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  function retryAfterMs(headers){if(!headers||typeof headers.get!=='function')return 0;const raw=String(headers.get('retry-after')||'').trim();if(!raw)return 0;const seconds=Number(raw);if(Number.isFinite(seconds)&&seconds>=0)return Math.round(seconds*1000);const when=Date.parse(raw);return Number.isFinite(when)?Math.max(0,when-Date.now()):0;}
  function contextOverflowDetails(text,message){
const raw=String(text||'')+' '+String(message||''),lower=raw.toLowerCase();
    if(lower.indexOf('exceed_context_size_error')<0&&lower.indexOf('exceeds the available context size')<0&&
    lower.indexOf('context length exceeded')<0)return null;
    const prompt=raw.match(/(?:n_prompt_tokens["']?\s*[:=]\s*|request \()([0-9]{2,})\s*(?:tokens)?/i),
    ctx=raw.match(/(?:n_ctx["']?\s*[:=]\s*|context size \()([0-9]{2,})/i),http=raw.match(/returned\s+(4\d\d)\s*:/i);
    return{promptTokens:prompt?Number(prompt[1]):null,contextWindow:ctx?Number(ctx[1]):null,
    httpStatus:http?Number(http[1]):null};}
  function limitInfo(status,code,message){
const c=String(code||''),m=String(message||'').toLowerCase(),http=Number(status)||0;
    if(http===429){if(/(?:quota|balance|credit|billing|daily|weekly|monthly|usage limit|plan limit|exhausted)/i.test(m))return{
    limited:true,retryable:false,kind:'quota',label:'Provider quota exhausted'};
    return{limited:true,retryable:true,kind:'rate_limit',label:'API rate limit reached'};
    }return{limited:false,retryable:false,kind:'',label:''};}
  function parseProviderError(text,status,requestId,headers,providerId){let code='',message='',providerType='';
try{const obj=JSON.parse(text||'{}'),e=obj.error||obj;code=String(e.code||obj.code||'');
    message=String(e.message||obj.message||'');providerType=String(e.type||obj.type||'');
    }catch(_){message=String(text||'').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,
    ' ').trim().slice(0,420);}providerId=String(providerId||'');
    const overflow=contextOverflowDetails(text,message),effectiveStatus=Number(status)||overflow&&overflow.httpStatus||0,
    limit=overflow?{limited:false,retryable:false,kind:'',label:''}
    :limitInfo(effectiveStatus,code,message),
    label=overflow?'Model context exceeded':limit.limited?limit.label:effectiveStatus?'AI request failed ('+effectiveStatus+
    ')':'AI request failed',hint=LF.AIDiagnostics?LF.AIDiagnostics.statusHint(effectiveStatus,code,message):'';
    const err=new Error(label+(overflow&&overflow.promptTokens&&
    overflow.contextWindow?' · '+overflow.promptTokens+' input tokens > '+overflow.contextWindow+' context tokens':'')+
    (!overflow&&code?' · '+code:'')+(message?' · '+message:'')+hint);err.status=effectiveStatus;err.providerId=providerId;
    err.code=overflow?'MODEL_CONTEXT_LENGTH':'';err.providerCode=code;err.providerType=providerType;
    err.providerMessage=message;err.providerResponse=String(text||'').slice(0,12000);err.requestId=requestId||'';
    err.retryAfterMs=retryAfterMs(headers);err.isProvider=true;err.isNetwork=false;err.rateLimited=limit.limited;
    err.rateLimitKind=limit.kind;err.rateLimitRetryable=limit.retryable;if(overflow){err.promptTokens=overflow.promptTokens;
    err.contextWindow=overflow.contextWindow;err.isContextOverflow=true;}return err;}
  function isRateLimitError(err){if(!err)return false;if(err.rateLimited===true)return true;return limitInfo(err.status,err.providerCode,err.providerMessage||err.message).limited;}
  LF.AITransportErrors={retryAfterMs,contextOverflowDetails,limitInfo,parseProviderError,isRateLimitError};
})();
