(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;

  /*
   * Logs is a read-only projection of the already-redacted Logger buffer.
   * Collection, redaction, export and clearing are owned outside this renderer.
   */

  function filters() {
    const state = LF.State.state;
    state.logFilters = Object.assign({level:'all', category:'all', query:'', scope:'all'}, state.logFilters || {});
    return state.logFilters;
  }

  function categoryOf(entry) {
    if (entry.level === 'ERROR' || entry.event.indexOf('failed') >= 0 || entry.event.indexOf('error') >= 0) return 'errors';
    if (entry.scope === 'ai' && /^request\.|^response\./.test(entry.event)) return 'api';
    if (/^ui\.|^route\.|navigation/.test(entry.scope + '.' + entry.event)) return 'ui';
    if (/parser|analysis|experiment|design|report|nomad|dataset/.test(entry.scope + '.' + entry.event)) return 'data';
    return 'runtime';
  }

  function boundedSearchText(value, budget, depth, out) {
    budget=budget==null?12000:budget;depth=depth||0;out=out||[];
    if(budget<=0||depth>5||value==null)return out;
    if(typeof value==='string'){const part=value.slice(0,Math.min(value.length,budget));out.push(part);return out;}
    if(typeof value==='number'||typeof value==='boolean'){out.push(String(value));return out;}
    if(Array.isArray(value)){for(let i=0;i<Math.min(value.length,40)&&out.join(' ').length<budget;i++)boundedSearchText(value[i],budget-out.join(' ').length,depth+1,out);return out;}
    if(typeof value==='object'){const keys=Object.keys(value).slice(0,60);for(let i=0;i<keys.length&&out.join(' ').length<budget;i++){out.push(keys[i]);boundedSearchText(value[keys[i]],budget-out.join(' ').length,depth+1,out);}return out;}
    return out;
  }
  function matches(entry, active) {
    if (active.level !== 'all' && String(entry.level).toLowerCase() !== active.level) return false;
    if (active.scope !== 'all' && entry.scope !== active.scope) return false;
    if (active.category !== 'all' && categoryOf(entry) !== active.category) return false;
    if (!active.query) return true;
    const haystack = [entry.ts, entry.level, entry.scope, entry.event, entry.route, entry.experimentId].concat(boundedSearchText(entry.data,12000)).join(' ').toLowerCase();
    return haystack.includes(active.query.toLowerCase());
  }

  function badge(level) {
    const type = level === 'ERROR' ? 'danger' : level === 'WARN' ? 'warning' : level === 'INFO' ? 'info' : '';
    return '<span class="badge '+type+'">'+C.escapeHtml(level)+'</span>';
  }

  function value(value, fallback) { return value == null || value === '' ? (fallback || '—') : String(value); }
  const RENDER_LIMIT=120,PAYLOAD_PREVIEW_CHARS=4200;
  function pretty(valueToPrint) {
    if (typeof valueToPrint === 'string') {
      try { return JSON.stringify(JSON.parse(valueToPrint), null, 2); } catch (_) { return valueToPrint; }
    }
    return C.safeJson(valueToPrint, 2);
  }
  function preview(valueToPrint,maxChars){const full=pretty(valueToPrint),limit=Math.max(600,Number(maxChars)||PAYLOAD_PREVIEW_CHARS);if(full.length<=limit)return{full:full,text:full,truncated:false};const head=Math.floor(limit*.78),tail=Math.floor(limit*.18);return{full:full,text:full.slice(0,head)+'\n… [bounded UI preview · download JSONL for complete payload] …\n'+full.slice(-tail),truncated:true};}
  function codeBlock(title, content, tone) {
    if (content == null || content === '') return '';const p=preview(content,PAYLOAD_PREVIEW_CHARS);
    return '<section class="log-payload '+(tone || '')+'"><header><strong>'+C.escapeHtml(title)+'</strong><span>'+C.escapeHtml(p.full.length+' chars'+(p.truncated?' · preview':''))+'</span></header><pre>'+C.escapeHtml(p.text)+'</pre></section>';
  }
  function fact(label, content) {
    return '<div><dt>'+C.escapeHtml(label)+'</dt><dd>'+C.escapeHtml(value(content))+'</dd></div>';
  }

  function entrySummary(entry) {
    const data=entry.data||{},error=data.error||{};
    return value(data.message || error.message || data.providerMessage || data.status && 'HTTP '+data.status || data.response && data.response.status && 'HTTP '+data.response.status || data.label, 'Structured event');
  }

  function entryDetail(entry) {
    const data=entry.data||{},request=data.request||{},response=data.response||{},error=data.error||{};
    const requestBody=request.body != null ? request.body : data.body;
    const responseBody=response.body != null ? response.body : (typeof response === 'string' ? response : data.providerResponse);
    const status=data.status || response.status;
    return '<div class="log-detail-body">'+
      '<dl class="log-facts">'+fact('Sequence','#'+value(entry.seq))+fact('Timestamp',entry.ts)+fact('Session',entry.sessionId)+fact('Route',entry.route)+fact('Experiment',entry.experimentId)+fact('Duration',data.elapsedMs != null ? data.elapsedMs+' ms' : '')+fact('HTTP',status ? status+' '+value(response.statusText,'') : '')+fact('Request ID',data.requestId || response.requestId || data.requestLogId)+'</dl>'+
      (error.message || data.message || data.providerMessage ? '<div class="log-error-message"><strong>Message</strong><span>'+C.escapeHtml(value(error.message || data.message || data.providerMessage))+'</span></div>' : '')+
      '<div class="log-payload-grid">'+codeBlock('Request headers',request.headers)+codeBlock('Request body / messages',requestBody)+codeBlock('Response headers',response.headers)+codeBlock('Provider response',responseBody,status >= 400 ? 'danger' : '')+codeBlock('Error and cause',error, 'danger')+codeBlock('Complete event data',data)+'</div></div>';
  }

  function lazyDetail(kind,id,className) { return '<div class="'+(className||'log-detail-body')+' log-lazy-detail" data-log-detail-kind="'+C.escapeHtml(kind)+'" data-log-detail-id="'+C.escapeHtml(id)+'"><div class="meta">Open to load bounded diagnostic payload.</div></div>'; }
  function entryRow(entry) {
    const data=entry.data||{},id=String(entry.id||entry.seq);
    return '<tr data-log-entry="'+C.escapeHtml(id)+'"><td class="mono log-time"><strong>'+C.escapeHtml(new Date(entry.ts).toLocaleTimeString())+'</strong><span>'+C.escapeHtml(entry.ts)+'</span></td><td>'+badge(entry.level)+'</td><td><span class="mono">'+C.escapeHtml(entry.scope)+'</span><small>'+C.escapeHtml(categoryOf(entry))+'</small></td><td><details class="log-detail"><summary><span><strong>'+C.escapeHtml(entry.event)+'</strong><small>'+C.escapeHtml(entrySummary(entry))+'</small></span><span class="log-summary-meta">'+C.escapeHtml(data.elapsedMs != null ? data.elapsedMs+' ms' : '#'+value(entry.seq))+'</span></summary>'+lazyDetail('event',id)+'</details></td></tr>';
  }

  function apiTransactions(entries) {
    const map={};
    entries.slice().reverse().forEach(function(entry){
      const id=entry.data&&entry.data.requestLogId;
      if(!id)return;
      const tx=map[id]||(map[id]={id:id,start:null,end:null,parsed:null,failed:null,rejected:null});
      if(entry.event==='request.start')tx.start=entry;
      else if(entry.event==='request.end')tx.end=entry;
      else if(entry.event==='response.parsed')tx.parsed=entry;
      else if(entry.event==='request.failed')tx.failed=entry;
      else if(entry.event==='response.rejected')tx.rejected=entry;
    });
    return Object.keys(map).map(function(id){return map[id];}).sort(function(a,b){return String((b.start||b.end||b.failed||b.rejected).ts).localeCompare(String((a.start||a.end||a.failed||a.rejected).ts));});
  }

  function transactionDetail(tx) {
    const start=tx.start&&tx.start.data||{},end=tx.end&&tx.end.data||{},failed=tx.failed&&tx.failed.data||{},rejected=tx.rejected&&tx.rejected.data||{},parsed=tx.parsed&&tx.parsed.data||{};
    const response=end.response||failed.response||{},status=failed.status||rejected.status||response.status||0,duration=failed.elapsedMs||rejected.elapsedMs||end.elapsedMs,state=tx.failed?'Failed':tx.rejected?'Rejected response':tx.end?'Completed':'Waiting',usage=rejected.usage||parsed.usage||null,rawResponse=rejected.response&&rejected.response.body||response.body||response;
    return '<dl class="log-facts">'+fact('Correlation ID',tx.id)+fact('Provider request ID',failed.requestId||rejected.requestId||response.requestId||parsed.requestId)+fact('Model',start.provider&&start.provider.model||rejected.model||parsed.model)+fact('Status',state+(status?' · HTTP '+status:''))+fact('Duration',duration?duration+' ms':'')+fact('Finish reason',rejected.finishReason||parsed.finishReason)+fact('Category',rejected.category)+fact('Tokens',usage?C.safeJson(usage,0):'')+'</dl><div class="log-payload-grid">'+codeBlock('Headers sent',start.request&&start.request.headers||failed.request&&failed.request.headers)+codeBlock('Request body / messages',start.request&&start.request.body||failed.request&&failed.request.body)+codeBlock('Response headers',response.headers)+codeBlock('Raw provider response',rawResponse,tx.failed||tx.rejected?'danger':'')+codeBlock('Failure detail',failed.error||failed.providerMessage||rejected.error,'danger')+codeBlock('Parsed metadata',parsed)+'</div>';
  }
  function transactionCard(tx) {
    const start=tx.start&&tx.start.data||{},end=tx.end&&tx.end.data||{},failed=tx.failed&&tx.failed.data||{},rejected=tx.rejected&&tx.rejected.data||{},response=end.response||failed.response||{},status=failed.status||rejected.status||response.status||0,duration=failed.elapsedMs||rejected.elapsedMs||end.elapsedMs,state=tx.failed?'Failed':tx.rejected?'Rejected response':tx.end?'Completed':'Waiting',tone=tx.failed||tx.rejected?'danger':tx.end?'success':'info';
    return '<details class="api-transaction"><summary><span class="badge '+tone+'">'+state+'</span><span class="api-transaction-name"><strong>'+C.escapeHtml(value(start.label||failed.label,'Provider call'))+'</strong><small>'+C.escapeHtml(value(start.method||failed.method,'POST')+' · '+value(start.endpoint||failed.endpoint||rejected.endpoint))+'</small></span><span class="api-transaction-stats">'+(status?'HTTP '+status:'')+(duration?' · '+duration+' ms':'')+'</span></summary>'+lazyDetail('transaction',tx.id,'api-transaction-body')+'</details>';
  }

  function errorCard(entry) {
    const id=String(entry.id||entry.seq);
    return '<details class="log-error-card"><summary>'+badge(entry.level)+'<span><strong>'+C.escapeHtml(entry.scope+' · '+entry.event)+'</strong><small>'+C.escapeHtml(entrySummary(entry))+'</small></span><time>'+C.escapeHtml(new Date(entry.ts).toLocaleTimeString())+'</time></summary>'+lazyDetail('error',id)+'</details>';
  }

  function metric(label,number,sub) { return '<div class="metric"><div class="metric-label">'+label+'</div><div class="metric-value">'+number+'</div><div class="metric-sub">'+sub+'</div></div>'; }

  /** Render metrics, correlated provider calls, errors and filtered events. */
  function render() {
    const active=filters(),all=LF.Logger.entries().slice().reverse();
    const scopes=Array.from(new Set(all.map(function(entry){return entry.scope;}))).sort();
    const matched=all.filter(function(entry){return matches(entry,active);}),visible=matched.slice(0,RENDER_LIMIT);
    const errors=all.filter(function(entry){return entry.level==='ERROR';});
    const warnings=all.filter(function(entry){return entry.level==='WARN';}).length;
    const transactions=apiTransactions(all),failedCalls=transactions.filter(function(tx){return !!(tx.failed||tx.rejected);}).length;
    const durations=transactions.map(function(tx){return Number((tx.failed&&tx.failed.data.elapsedMs)||(tx.end&&tx.end.data.elapsedMs));}).filter(Number.isFinite);
    const avg=durations.length?Math.round(durations.reduce(function(sum,n){return sum+n;},0)/durations.length):0;
    const levelButtons=['all','error','warn','info','debug','trace'].map(function(level){return '<button type="button" class="button compact '+(active.level===level?'primary':'')+'" data-log-level="'+level+'">'+(level==='all'?'All levels':level.toUpperCase())+'</button>';}).join('');
    const categoryButtons=[['all','Everything'],['api','API'],['errors','Errors'],['ui','UI'],['data','Data']].map(function(item){return '<button type="button" class="button compact '+(active.category===item[0]?'primary':'')+'" data-log-category="'+item[0]+'">'+item[1]+'</button>';}).join('');
    const scopeOptions=['<option value="all">All scopes</option>'].concat(scopes.map(function(scope){return '<option value="'+C.escapeHtml(scope)+'" '+(active.scope===scope?'selected':'')+'>'+C.escapeHtml(scope)+'</option>';})).join('');
    const environment=LF.Logger.environmentSnapshot();

    return '<section class="page logs-page">'+
      '<div class="page-head"><div><h1 class="h1">Logs & diagnostics</h1><div class="meta">Bounded local diagnostic trace of runtime events and provider transactions. Credentials are redacted and oversized payloads are clipped before storage.</div></div><div class="spacer"></div><div class="toolbar"><button type="button" class="button" id="refreshLogs">Refresh</button><button type="button" class="button primary" id="downloadDiagnostics">Diagnostic bundle</button><button type="button" class="button" id="downloadLogs">JSONL</button><button type="button" class="button danger" id="clearLogs">Clear</button></div></div>'+
      '<div class="metric-grid logs-metrics">'+metric('Events',all.length,'buffered this session')+metric('Errors',errors.length,'with stack and cause')+metric('Warnings',warnings,'handled anomalies')+metric('API calls',transactions.length,failedCalls+' failed')+metric('Avg latency',avg?avg+' ms':'—',durations.length+' measured calls')+metric('Visible',matched.length,visible.length<matched.length?'latest '+visible.length+' rendered':'after active filters')+'</div>'+
      '<section class="panel logs-health"><div class="panel-head"><div><h2 class="h2">Runtime snapshot</h2><div class="meta mono">'+C.escapeHtml(environment.sessionId)+'</div></div><div class="spacer"></div><span class="badge '+(environment.browser.online?'success':'danger')+'">'+(environment.browser.online?'Online':'Offline')+'</span></div><dl class="log-facts">'+fact('Started',environment.startedAt)+fact('Route',environment.app.route)+fact('Protocol',environment.page.protocol)+fact('Viewport',environment.viewport.width+' × '+environment.viewport.height)+fact('Browser language',environment.browser.language)+fact('Buffer level',environment.logging.level.toUpperCase())+'</dl></section>'+
      '<section class="logs-dashboard-grid"><div class="panel"><div class="panel-head"><div><h2 class="h2">Provider transactions</h2><div class="meta">Request and response joined by correlation ID</div></div><div class="spacer"></div><span class="badge info">'+transactions.length+' calls</span></div><div class="logs-focus-list">'+(transactions.length?transactions.slice(0,8).map(transactionCard).join(''):'<div class="empty compact-empty">No provider calls in this session.</div>')+'</div></div><div class="panel"><div class="panel-head"><div><h2 class="h2">Recent errors</h2><div class="meta">Message, provider body, stack and cause</div></div><div class="spacer"></div><span class="badge danger">'+errors.length+'</span></div><div class="logs-focus-list">'+(errors.length?errors.slice(0,8).map(errorCard).join(''):'<div class="empty compact-empty">No errors recorded.</div>')+'</div></div></section>'+
      '<section class="panel logs-workbench"><div class="panel-head logs-filter-head"><div><h2 class="h2">Event stream</h2><div class="meta">Newest first · UI renders at most '+RENDER_LIMIT+' rows; JSONL exports the buffered bounded trace</div></div><div class="spacer"></div><label class="sr-only" for="logScopeFilter">Scope</label><select class="select compact-select" id="logScopeFilter">'+scopeOptions+'</select><label class="sr-only" for="logSearch">Search logs</label><input class="input log-search" id="logSearch" type="search" autocomplete="off" placeholder="Search message, request ID, endpoint…" value="'+C.escapeHtml(active.query)+'"></div><div class="logs-filter-row"><div class="logs-levels" aria-label="Filter by level">'+levelButtons+'</div><div class="logs-levels" aria-label="Filter by category">'+categoryButtons+'</div></div><div class="table-wrap logs-table-wrap"><table class="data-table logs-table"><thead><tr><th>Time</th><th>Level</th><th>Scope</th><th>Event, message & payload</th></tr></thead><tbody>'+(visible.length?visible.map(entryRow).join(''):'<tr><td colspan="4"><div class="empty compact-empty">No log entries match these filters.</div></td></tr>')+'</tbody></table></div></section></section>';
  }

  function hydrateLazyDetail(host){
    if(!host||host.dataset.logHydrated==='1')return;const kind=host.dataset.logDetailKind,id=host.dataset.logDetailId,entries=LF.Logger.entries();let html='<div class="empty compact-empty">Diagnostic payload is no longer available.</div>';
    if(kind==='transaction'){const tx=apiTransactions(entries).find(function(x){return String(x.id)===String(id);});if(tx)html=transactionDetail(tx);}
    else{const entry=entries.find(function(x){return String(x.id||x.seq)===String(id);});if(entry)html=entryDetail(entry);}
    host.innerHTML=html;host.dataset.logHydrated='1';
  }
  function bind(root){
    if(!root||!root.querySelectorAll)return;root.querySelectorAll('details').forEach(function(details){const lazy=details.querySelector(':scope > .log-lazy-detail');if(!lazy)return;details.addEventListener('toggle',function(){if(details.open)hydrateLazyDetail(lazy);},{passive:true});if(details.open)hydrateLazyDetail(lazy);});
  }

  /** Update the level filter; the app decides when to render again. */
  function setLevel(level){filters().level=level||'all';}
  /** Update the diagnostic category filter. */
  function setCategory(category){filters().category=category||'all';}
  /** Update the logger namespace filter. */
  function setScope(scope){filters().scope=scope||'all';}
  /** Update the case-insensitive full-text filter. */
  function setQuery(query){filters().query=String(query||'');}

  LF.LogsPage={render:render,bind:bind,setLevel:setLevel,setCategory:setCategory,setScope:setScope,setQuery:setQuery};
}());
