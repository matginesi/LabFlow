/*
 * Shared deterministic utilities, escaping/Markdown helpers, IDs and runtime dependency assertions.
 * Boundary: Remain domain-agnostic; feature ownership belongs to dedicated modules.
 */
(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function downloadBlob(blob, filename) {
    if (LF.Logger) LF.Logger.info('core','download.start',{filename:filename,bytes:blob&&blob.size||0,type:blob&&blob.type||''});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    if (LF.Logger) LF.Logger.debug('core','download.started',{filename:filename});
  }

  function textBlob(text, type) {
    return new Blob([text], { type: type || 'text/plain;charset=utf-8' });
  }

  function fmt(value, digits) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(digits == null ? 2 : digits);
  }

  function bytes(n) {
    if (!Number.isFinite(Number(n))) return '—';
    n = Number(n);
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function safeJson(value, space) {
    return JSON.stringify(value, function (key, v) {
      if (v instanceof ArrayBuffer) return undefined;
      if (ArrayBuffer.isView(v)) return Array.from(v);
      return v;
    }, space == null ? 2 : space);
  }

  function highlightCode(code, lang) {
    const raw=String(code==null?'':code), language=String(lang||'').toLowerCase();
    if(language==='json'){
      const re=/"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}\[\],:]/g;
      let out='',last=0,m;
      while((m=re.exec(raw))){out+=escapeHtml(raw.slice(last,m.index));const t=m[0];let cls='tok-punct';if(t[0]==='"')cls=/^"(?:\\.|[^"\\])*"$/.test(t)&&/^\s*:/.test(raw.slice(re.lastIndex))?'tok-json-key':'tok-string';else if(/^-?\d/.test(t))cls='tok-number';else if(/^(true|false|null)$/.test(t))cls='tok-key';out+='<span class="'+cls+'">'+escapeHtml(t)+'</span>';last=re.lastIndex;}
      return out+escapeHtml(raw.slice(last));
    }
    let out=escapeHtml(raw);
    if (/^(js|javascript|ts|typescript|python|py|c|cpp|java|bash|sh)$/i.test(language)) {
      out = out.replace(/\b(true|false|null|undefined|const|let|var|function|return|if|else|for|while|class|new|async|await|try|catch|throw|import|from|def|in|and|or|not|struct|int|float|double|void|char)\b/g, '<span class="tok-key">$1</span>');
      out = out.replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="tok-number">$1</span>');
    }
    return out;
  }

  function safeMarkdownUrl(url) {
    const raw = String(url || '').trim();
    return /^(https?:\/\/|mailto:|#)/i.test(raw) ? raw : '';
  }

  function markdownInline(text) {
    let src = String(text || '');
    const protectedHtml = [];
    function protect(html) { const token='@@LFPROTECTED'+protectedHtml.length+'@@'; protectedHtml.push(html); return token; }


    src = src.replace(/\\\(([^\n]+?)\\\)/g, function(_m,math){ return protect('<span class="math-inline">\\('+escapeHtml(math)+'\\)</span>'); });
    src = src.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, function(_m,prefix,math){ return prefix+protect('<span class="math-inline">\\('+escapeHtml(math)+'\\)</span>'); });
    src = src.replace(/`([^`]+)`/g, function(_m,code){ return protect('<code>'+escapeHtml(code)+'</code>'); });
    src = src.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function(_m,label,href){ const safe=safeMarkdownUrl(href); return safe?protect('<a href="'+escapeHtml(safe)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(label)+'</a>'):label; });
    let out=escapeHtml(src);
    out=out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/__([^_]+)__/g,'<strong>$1</strong>')
      .replace(/~~([^~]+)~~/g,'<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_(?!_)/g,'$1<em>$2</em>');
    protectedHtml.forEach(function(html,i){out=out.replace('@@LFPROTECTED'+i+'@@',function(){return html;});});
    return out;
  }

  function markdown(text) {
    const source=String(text||'').replace(/\r\n/g,'\n');
    const codeBlocks=[],mathBlocks=[];
    let protectedSource=source.replace(/```([^\n]*)\n([\s\S]*?)```/g,function(_m,lang,code){
      const token='@@LFCODE_'+codeBlocks.length+'@@';
      const escaped=highlightCode(code.replace(/\n$/,''),String(lang||'').trim());
      const normalizedLang=String(lang||'').trim().toLowerCase();
      const shellClass=normalizedLang==='json'?'code-shell json-shell':'code-shell';
      codeBlocks.push('<div class="'+shellClass+'"><div class="code-toolbar"><span>'+escapeHtml(String(lang||'code').trim()||'code')+'</span><button class="button ghost compact" type="button" data-copy-code>Copy code</button></div><pre class="code-block"><code data-lang="'+escapeHtml(String(lang||'').trim())+'">'+escaped+'</code></pre></div>');
      return token;
    });
    protectedSource=protectedSource.replace(/\$\$([\s\S]*?)\$\$/g,function(_m,math){const token='@@LFMATH_'+mathBlocks.length+'@@';mathBlocks.push(String(math||'').trim());return token;}).replace(/\\\[([\s\S]*?)\\\]/g,function(_m,math){const token='@@LFMATH_'+mathBlocks.length+'@@';mathBlocks.push(String(math||'').trim());return token;});
    const lines=protectedSource.split('\n'), out=[];
    let listType=null;
    function closeList(){if(listType){out.push('</'+listType+'>');listType=null;}}
    function splitTable(line){return line.trim().replace(/^\||\|$/g,'').split('|').map(function(x){return x.trim();});}
    for(let i=0;i<lines.length;i++){
      const raw=lines[i], line=raw.trimEnd();
      if(!line.trim()){closeList();continue;}
      const tok=line.trim().match(/^@@LFCODE_(\d+)@@$/); if(tok){closeList();out.push(codeBlocks[Number(tok[1])]);continue;}
      const mathTok=line.trim().match(/^@@LFMATH_(\d+)@@$/); if(mathTok){closeList();const math=mathBlocks[Number(mathTok[1])]||'';out.push('<div class="math-display" data-latex="'+escapeHtml(math)+'">\\['+escapeHtml(math)+'\\]</div>');continue;}
      if(/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)){closeList();out.push('<hr>');continue;}
      const h=line.match(/^(#{1,6})\s+(.+)$/); if(h){closeList();const level=Math.min(6,h[1].length);out.push('<h'+level+'>'+markdownInline(h[2])+'</h'+level+'>');continue;}
      if(line.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
        closeList();const head=splitTable(line);i+=1;const rows=[];
        while(i+1<lines.length&&lines[i+1].includes('|')&&lines[i+1].trim()){i+=1;rows.push(splitTable(lines[i]));}
        out.push('<div class="md-table-wrap"><table><thead><tr>'+head.map(function(x){return '<th>'+markdownInline(x)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+head.map(function(_x,j){return '<td>'+markdownInline(r[j]||'')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>');continue;
      }
      const bullet=line.match(/^\s*[-*+]\s+(.+)$/); if(bullet){if(listType!=='ul'){closeList();listType='ul';out.push('<ul>');}out.push('<li>'+markdownInline(bullet[1])+'</li>');continue;}
      const num=line.match(/^\s*\d+[.)]\s+(.+)$/); if(num){if(listType!=='ol'){closeList();listType='ol';out.push('<ol>');}out.push('<li>'+markdownInline(num[1])+'</li>');continue;}
      const quote=line.match(/^>\s?(.*)$/); if(quote){closeList();out.push('<blockquote>'+markdownInline(quote[1])+'</blockquote>');continue;}
      closeList();out.push('<p>'+markdownInline(line)+'</p>');
    }
    closeList(); return out.join('');
  }

  function jsonBlock(value, compact) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value, null, compact ? 2 : 2);
    const highlighted = highlightCode(raw, 'json');
    return '<div class="code-shell json-shell '+(compact?'compact-json':'')+'"><div class="code-toolbar"><span>json</span><button class="button ghost compact" type="button" data-copy-code>Copy code</button></div><pre class="code-block json-highlight"><code data-lang="json">'+highlighted+'</code></pre></div>';
  }

  function copyText(text) {
    const value=String(text == null ? '' : text);
    if (!value) return false;
    try {
      const ta=document.createElement('textarea'); ta.value=value; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; ta.style.pointerEvents='none';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,ta.value.length); const ok=document.execCommand('copy'); ta.remove(); return !!ok;
    } catch (_err) { return false; }
  }

  function csvEscape(value) {
    const s = String(value == null ? '' : value);
    // Untrusted archive labels can start with a spreadsheet formula trigger; numeric values must stay numeric.
    const numeric = s !== '' && Number.isFinite(Number(s));
    const guarded = /^[=@\t\r]/.test(s) || (!numeric && /^[+\-]/.test(s)) ? "'" + s : s;
    return /[",\n]/.test(guarded) ? '"' + guarded.replace(/"/g, '""') + '"' : guarded;
  }

  const UNSAFE_PATH_SEGMENT = /^(?:__proto__|prototype|constructor)$/;
  // Dotted field paths come from stored/AI proposals; reject prototype-walking segments before any write.
  function safePathSegments(path) {
    const segments = String(path == null ? '' : path).split('.').filter(function (segment) { return segment !== ''; });
    if (!segments.length) return null;
    return segments.some(function (segment) { return UNSAFE_PATH_SEGMENT.test(segment); }) ? null : segments;
  }

  function normalizeSpace(s) {
    return String(s || '').trim().replace(/\s+/g, ' ');
  }


  function splitModelReasoning(text) {
    let source = String(text == null ? '' : text);
    const reasoning = [];
    let changed = false;
    const tag = '(?:think|thinking|analysis|reasoning)';
    const complete = new RegExp('<(' + tag.slice(3, -1) + ')\\b[^>]*>([\\s\\S]*?)<\\/\\1>', 'gi');
    source = source.replace(complete, function (_whole, _name, inner) {
      const value = String(inner || '').trim();
      if (value) reasoning.push(value);
      changed = true;
      return '\n';
    });
    const opener = new RegExp('<' + tag + '\\b[^>]*>', 'i');
    const open = opener.exec(source);
    if (open) {
      const tail = source.slice(open.index + open[0].length).replace(new RegExp('<\\/' + tag + '>\\s*$', 'i'), '').trim();
      if (tail) reasoning.push(tail);
      source = source.slice(0, open.index);
      changed = true;
    }
    const closers = new RegExp('<\\/' + tag + '>', 'gi');
    const stripped = source.replace(closers, '\n');
    if (stripped !== source) changed = true;
    source = stripped.replace(/\n[ \t]*\n+/g, '\n').trim();
    return { content: source, reasoning: reasoning.join('\n\n').trim(), changed: changed };
  }

  function cleanModelText(text) {
    let out = splitModelReasoning(text).content;

    out = out
      .replace(/%%LF(?:MD|CODE)[^%]*%%\s+tool/gi, 'LabFlow read tool')
      .replace(/\u0000LF(?:MD|CODE)[^\u0000]*\u0000\s+tool/gi, 'LabFlow read tool')
      .replace(/%%LF(?:MD|CODE)[^%]*%%/gi, '')
      .replace(/\u0000LF(?:MD|CODE)[^\u0000]*\u0000/gi, '')
      .replace(/@@LF(?:PROTECTED|CODE|MATH)_?\d+@@/gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n[ \t]+/g, '\n');
    return out.trim();
  }

  function safeName(s) {
    return String(s || 'experiment').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'experiment';
  }


  function modelDisplayName(providerId, model) {
    const raw=String(model==null?'':model).trim();
    const localProviders=new Set(['ollama','lmstudio','llamacpp']);
    if(!localProviders.has(String(providerId||'').toLowerCase())||!raw)return raw;
    return raw.replace(/\\/g,'/').split('/').filter(Boolean).pop()||raw;
  }

    // Classic scripts make load order implicit; fail fast instead of allowing a partially initialized feature.
  function requireModules(owner, names) {
    const missing = (Array.isArray(names) ? names : [names]).filter(function (name) {
      return !LF[name];
    });
    if (!missing.length) return true;
    throw new Error(
      String(owner || 'LabFlow module') +
      ' requires LabFlow.' + missing.join(', LabFlow.') +
      ' to be loaded first.'
    );
  }


  function bindFieldLabels(root) {
    const scope=root||document;
    scope.querySelectorAll('.field').forEach(function(field,index){
      const label=field.querySelector(':scope > label');
      const control=field.querySelector(':scope > input, :scope > select, :scope > textarea');
      if(!label||!control||label.htmlFor||control.getAttribute('aria-label')||control.getAttribute('aria-labelledby'))return;
      if(!control.id){
        const slug=normalizeSpace(label.textContent).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'control';
        control.id='lf-field-'+slug+'-'+index;
      }
      label.htmlFor=control.id;
    });
  }

  LF.Core = { uid, escapeHtml, downloadBlob, textBlob, fmt, bytes, safeJson, highlightCode, markdown, jsonBlock, copyText, csvEscape, normalizeSpace, splitModelReasoning, cleanModelText, safeName, modelDisplayName, requireModules, bindFieldLabels, safePathSegments };
}());
