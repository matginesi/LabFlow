(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('parser');

  function rules() {
    const r = LF.PromptRegistry && LF.PromptRegistry.effectiveRules ? LF.PromptRegistry.effectiveRules() : {};
    Log.trace('rules.resolved', {hasRules:!!r,sections:Object.keys(r||{})});
    return r || {};
  }

  function basename(path) { return String(path || '').split('/').filter(Boolean).pop() || ''; }

  function classify(path) {
    const r = rules();
    const p = r.file_patterns || {};
    const n = basename(path);
    const low = n.toLowerCase();
    const eq = function(v){ return v && low === String(v).toLowerCase(); };
    const has = function(v){ return v && low.indexOf(String(v).toLowerCase()) >= 0; };
    if (eq(p.summary_fw_basename)) return 'summary-fw';
    if (eq(p.summary_rv_basename)) return 'summary-rv';
    if (eq(p.summary_basename)) return 'summary';
    if (has(p.jv_marker)) return 'jv';
    if (has(p.parameters_marker)) return 'parameters';
    if (has(p.tracking_marker)) return 'tracking';
    if (p.text_extension && low.endsWith(String(p.text_extension).toLowerCase())) return 'text';
    return 'unknown';
  }

  function parseNumber(v) {
    if (v == null) return null;
    const num = rules().numeric_format || {};
    let s = String(v).trim();
    if (num.decimal_comma_fallback === true) s = s.replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function canonicalSample(raw) {
    const n = (rules().normalization || {});
    let s = String(raw == null ? '' : raw);
    if (n.trim === true) s = s.trim();
    if (n.collapse_whitespace === true) s = s.replace(/\s+/g, ' ');
    if (n.normalize_separator_spacing === true) s = s.replace(/\s*([_-])\s*/g, '$1');
    return s || String(((rules().sample_identity||{}).unknown_label)||'');
  }

  function configuredRegex(pattern, flags) {
    if (!pattern) return null;
    try { return new RegExp(pattern, flags || 'i'); }
    catch (err) { Log.error('rules.regex-invalid', {pattern:pattern,flags:flags||'i',error:err}); return null; }
  }

  function isReference(sample) {
    const ident = rules().sample_identity || {};
    const token = String(ident.reference_token || '').trim();
    if (!token) return false;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('\\b'+escaped+'\\b','i').test(String(sample||''));
  }

  function sampleFromFilename(name, path) {
    const ident = rules().sample_identity || {};
    const b = basename(name || path);
    if (ident.fallback_to_filename === true) {
      const jvRe = configuredRegex(ident.jv_filename_sample_regex, 'i');
      const genericRe = configuredRegex(ident.generic_filename_sample_regex, 'i');
      let m = jvRe ? b.match(jvRe) : null;
      if (m && m[1] != null) return canonicalSample(m[1]);
      m = genericRe ? b.match(genericRe) : null;
      if (m && m[1] != null) return canonicalSample(m[1]);
    }
    if (ident.fallback_to_parent_directory === true) {
      const parts = String(path || '').split('/').filter(Boolean);
      const fromEnd = Number(ident.parent_directory_from_end);
      if (Number.isInteger(fromEnd) && fromEnd > 0 && parts.length >= fromEnd) return canonicalSample(parts[parts.length - fromEnd]);
    }
    return String(ident.unknown_label || '');
  }

  function groupFromSample(sample) {
    let s = canonicalSample(sample);
    const patterns = ((rules().grouping || {}).strip_patterns || []);
    patterns.forEach(function(pattern){
      const re=configuredRegex(pattern,'i');
      if(re) s=s.replace(re,'').trim();
    });
    return s || sample;
  }

  function parseSummary(text, direction) {
    const cfg = rules().summary_format || {};
    const cols = cfg.columns || {};
    const delimiter = cfg.delimiter;
    const headerPrefix = cfg.header_prefix;
    const minColumns = Number(cfg.min_columns);
    const end=Log.timer('summary.parse', {direction:direction,chars:String(text||'').length,configured:!!(delimiter&&headerPrefix&&Number.isInteger(minColumns))});
    if (!delimiter || !headerPrefix || !Number.isInteger(minColumns) || !Number.isInteger(cols.file)) {
      end({rows:0,error:'summary_format missing from Markdown policy'},'error');
      return [];
    }
    const lines = String(text || '').split(/\r?\n/);
    const out = [];
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(headerPrefix.trim())) { start = i + 1; break; }
    }
    if (start < 0) { end({rows:0,headerFound:false},'warn'); return out; }
    function value(parts,key){const idx=cols[key];return Number.isInteger(idx)?parseNumber(parts[idx]):null;}
    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const parts = line.split(delimiter);
      if (parts.length < minColumns) continue;
      out.push({
        file: String(parts[cols.file] == null ? '' : parts[cols.file]).trim(), direction: direction,
        voc:value(parts,'voc'), jsc:value(parts,'jsc'), vmpp:value(parts,'vmpp'), jmpp:value(parts,'jmpp'),
        pmpp:value(parts,'pmpp'), rs:value(parts,'rs'), rsh:value(parts,'rsh'), ff:value(parts,'ff'), eff:value(parts,'eff'),
        provenance: 'summary'
      });
    }
    end({rows:out.length,headerFound:true});
    return out;
  }

  function parseSections(text) {
    const cfg=rules().jv_format || {};
    const delimiter=cfg.delimiter;
    if(!delimiter) { Log.error('jv-format.metadata-missing',{field:'delimiter'}); return {}; }
    const meta = {};
    const lines = String(text || '').split(/\r?\n/);
    const skipPrefixes=Array.isArray(cfg.metadata_skip_prefixes)?cfg.metadata_skip_prefixes:[];
    const commentPrefixes=Array.isArray(cfg.metadata_comment_prefixes)?cfg.metadata_comment_prefixes:[];
    const sectionRe=configuredRegex(cfg.section_header_regex,'');
    let section = '';
    lines.forEach(function (line) {
      const t = line.trim();
      const sm = sectionRe ? t.match(sectionRe) : null;
      if (sm) { section = sm[1]; return; }
      if (!t || commentPrefixes.some(function(prefix){return t.startsWith(String(prefix));})) return;
      if (skipPrefixes.some(function(prefix){return String(line).startsWith(prefix);})) return;
      const parts = line.split(delimiter);
      if (parts.length >= 2) {
        const key = (section ? section + '.' : '') + parts[0].trim();
        meta[key] = parts.slice(1).join(delimiter).trim();
      }
    });
    return meta;
  }

  function parseJVFile(text, fileName, path) {
    const cfg=rules().jv_format || {};
    const cols=cfg.metric_columns || {};
    const curveCols=cfg.curve_columns || {};
    const delimiter=cfg.delimiter;
    const metricHeader=cfg.metric_header_prefix;
    const curveHeader=cfg.curve_header_prefix;
    const directions=Array.isArray(cfg.directions)?cfg.directions.map(function(x){return String(x).toUpperCase();}):[];
    const scanRows=Number(cfg.metric_scan_rows);
    const end=Log.timer('jv-file.parse', {file:fileName,path:path,chars:String(text||'').length,configured:!!(delimiter&&metricHeader&&curveHeader)});
    const lines = String(text || '').split(/\r?\n/);
    const meta = parseSections(text);
    let metricHeaderIndex = -1;
    let curveHeaderIndex = -1;
    if(delimiter&&metricHeader&&curveHeader){
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith(String(metricHeader).trim())) metricHeaderIndex = i;
        if (lines[i].trim().startsWith(String(curveHeader).trim())) { curveHeaderIndex = i; break; }
      }
    }
    const metrics = {};
    function metricValue(parts,key){const idx=cols[key];return Number.isInteger(idx)?parseNumber(parts[idx]):null;}
    if (metricHeaderIndex >= 0 && delimiter && Number.isInteger(scanRows) && Number.isInteger(cols.direction)) {
      for (let i = metricHeaderIndex + 1; i < Math.min(lines.length, metricHeaderIndex + 1 + scanRows); i++) {
        const parts = lines[i].split(delimiter);
        const dir = String(parts[cols.direction] || '').trim().toUpperCase();
        if (!directions.includes(dir)) continue;
        metrics[dir] = {
          file:fileName,direction:dir,
          voc:metricValue(parts,'voc'),jsc:metricValue(parts,'jsc'),vmpp:metricValue(parts,'vmpp'),jmpp:metricValue(parts,'jmpp'),
          pmpp:metricValue(parts,'pmpp'),rs:metricValue(parts,'rs'),rsh:metricValue(parts,'rsh'),ff:metricValue(parts,'ff'),eff:metricValue(parts,'eff'),
          provenance:'jv-file'
        };
      }
    }
    const curve = { fw: [], rv: [] };
    if (curveHeaderIndex >= 0 && delimiter) {
      for (let i = curveHeaderIndex + 1; i < lines.length; i++) {
        const parts=lines[i].split(delimiter);
        const vfw=Number.isInteger(curveCols.v_fw)?parseNumber(parts[curveCols.v_fw]):null;
        const jfw=Number.isInteger(curveCols.j_fw)?parseNumber(parts[curveCols.j_fw]):null;
        const vrv=Number.isInteger(curveCols.v_rv)?parseNumber(parts[curveCols.v_rv]):null;
        const jrv=Number.isInteger(curveCols.j_rv)?parseNumber(parts[curveCols.j_rv]):null;
        if(vfw!=null&&jfw!=null)curve.fw.push({x:vfw,y:jfw});
        if(vrv!=null&&jrv!=null)curve.rv.push({x:vrv,y:jrv});
      }
    }
    const ident = rules().sample_identity || {};
    const internalKey=ident.internal_device_key;
    const explicit = internalKey ? meta[internalKey] : null;
    let sample=String(ident.unknown_label || '');
    if (ident.prefer_internal_device === true && explicit) sample = canonicalSample(explicit);
    else sample = sampleFromFilename(fileName,path);
    const result={file:fileName,path:path,sample:sample,group:groupFromSample(sample),isRef:isReference(sample),meta:meta,metrics:metrics,curve:curve};
    end({sample:sample,group:result.group,isRef:result.isRef,metricDirections:Object.keys(metrics),fwPoints:curve.fw.length,rvPoints:curve.rv.length,metaKeys:Object.keys(meta).length});
    return result;
  }

  function parseAuxiliaryFile(text, fileName, path, type) {
    const all=rules(), cfg=(type==='parameters'?all.parameters_format:all.tracking_format)||{};
    const delimiter=cfg.delimiter||'\t', lines=String(text||'').split(/\r?\n/), meta={};
    const sectionRe=configuredRegex(cfg.section_header_regex||'^\\[(.+)\\]$','');
    const commentPrefixes=Array.isArray(cfg.metadata_comment_prefixes)?cfg.metadata_comment_prefixes:['##'];
    const dataMarkerRe=configuredRegex(cfg.data_marker_regex||'^##\\s*Data\\s*##$','i');
    let section='', dataStart=-1;
    for(let i=0;i<lines.length;i++){
      const raw=lines[i], t=raw.trim();
      if(dataMarkerRe&&dataMarkerRe.test(t)){dataStart=i+1;break;}
      const sm=sectionRe?t.match(sectionRe):null;if(sm){section=sm[1];continue;}
      if(!t||commentPrefixes.some(function(prefix){return t.startsWith(String(prefix));}))continue;
      const parts=raw.split(delimiter);if(parts.length>=2){const key=(section?section+'.':'')+parts[0].trim();meta[key]=parts.slice(1).join(delimiter).trim();}
    }
    let dataHeader='', rowCount=0;
    if(dataStart>=0){for(let i=dataStart;i<lines.length;i++){if(!lines[i].trim())continue;if(!dataHeader){dataHeader=lines[i].trim();continue;}if(lines[i].split(delimiter).length>=2)rowCount++;}}
    const internal=(all.sample_identity||{}).internal_device_key;
    const sample=canonicalSample((internal&&meta[internal])||sampleFromFilename(fileName,path));
    return {type:type,file:fileName,path:path,sample:sample,group:groupFromSample(sample),isRef:isReference(sample),meta:meta,dataColumns:dataHeader?dataHeader.split(delimiter).map(function(x){return x.trim();}):[],rowCount:rowCount};
  }

  function finding(severity, type, title, detail, target, evidence) {
    return { id: C.uid('finding'), severity: severity, type: type, title: title, detail: detail, target: target || '', evidence: evidence || [], status: 'open', source: 'deterministic' };
  }

  /**
   * Build a bounded, literal RAW-text sample for AI format inspection.
   * This records structure only: it does not classify unknown content or infer
   * scientific meaning. Every line remains associated with its verbatim path.
   */
  function formatEvidence(entry, text) {
    const lines=String(text||'').split(/\r?\n/),selected=[];
    function add(line){
      const value=String(line||'').trim();
      if(!value||selected.includes(value)||selected.length>=12)return;
      selected.push(value.slice(0,180));
    }
    lines.slice(0,8).forEach(add);
    lines.forEach(function(line){
      if(selected.length>=12)return;
      if(/^\s*(?:##|\[)|\t|;/.test(line)||/^(?:File|Filename|Scan|V_FW|Time\s*\()/i.test(line.trim()))add(line);
    });
    return {
      path:entry.path,
      detectedFamily:entry.type,
      extension:(entry.name.match(/\.[^.]+$/)||[''])[0].toLowerCase(),
      characters:String(text||'').length,
      lines:lines.length,
      delimiterCounts:{tabs:(text.match(/\t/g)||[]).length,semicolons:(text.match(/;/g)||[]).length,commas:(text.match(/,/g)||[]).length},
      replacementCharacters:(text.match(/�/g)||[]).length,
      rawLines:selected
    };
  }


  LF.Parser = { parseSummary, parseJVFile, parseAuxiliaryFile, canonicalSample, sampleFromFilename, groupFromSample, isReference, rules, basename, classify, formatEvidence };
}());
