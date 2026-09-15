/*
 * Materialize a RAW ZIP into canonical source evidence and initial ExperimentData records.
 * Boundary: Keep RAW bytes and path identity immutable; deterministic lifecycle work continues in DataPipeline.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('importer');
  const P = LF.Parser;
  const DM = LF.DataModel;
  const DS = LF.DomainSchema;
  const DEFAULT_IMPORT_LIMITS = Object.freeze({maxCompressedBytes:128*1024*1024,maxUncompressedBytes:512*1024*1024,maxEntryBytes:128*1024*1024,maxTextEntryBytes:16*1024*1024,maxFiles:5000,maxCompressionRatio:100});
  function importLimits(){const custom=window.LABFLOW_IMPORT_LIMITS&&typeof window.LABFLOW_IMPORT_LIMITS==='object'?window.LABFLOW_IMPORT_LIMITS:{};return Object.assign({},DEFAULT_IMPORT_LIMITS,custom);}
  function limitError(message,details){const error=new Error(message);error.code='IMPORT_RESOURCE_LIMIT';error.details=details||{};return error;}

  const ZipMetadataAdapter={
    sizes:function(file){
      const data=file&&file._data||{},u=Number(data.uncompressedSize),c=Number(data.compressedSize);
      return{known:Number.isFinite(u)&&u>=0&&Number.isFinite(c)&&c>=0,uncompressed:Number.isFinite(u)&&u>=0?u:0,compressed:Number.isFinite(c)&&c>=0?c:0};
    }
  };
  function preflightArchive(zip,compressedBytes){
    const limits=importLimits();
    const entries=Object.values(zip.files||{}).filter(function(file){return file&&!file.dir;});
    if(entries.length>limits.maxFiles){
      throw limitError('This ZIP contains too many files for a browser import.',{
        files:entries.length,
        limit:limits.maxFiles
      });
    }

    let total=0;
    entries.forEach(function(file){
      const sizes=ZipMetadataAdapter.sizes(file);
      const name=String(file.name||'file');
      if(!sizes.known){
        throw limitError(
          'ZIP size metadata is unavailable for '+name+'. Import stopped because LabFlow cannot verify the archive safely.',
          {path:name,metadata:'unavailable'}
        );
      }
      total+=sizes.uncompressed;
      if(sizes.uncompressed>limits.maxEntryBytes){
        throw limitError('A file inside the ZIP is too large to import safely: '+name,{
          path:name,bytes:sizes.uncompressed,limit:limits.maxEntryBytes
        });
      }
      const isText=/\.(?:txt|csv|tsv|md|json|ya?ml)$/i.test(name);
      if(isText&&sizes.uncompressed>limits.maxTextEntryBytes){
        throw limitError('A text file inside the ZIP is too large to parse safely: '+name,{
          path:name,bytes:sizes.uncompressed,limit:limits.maxTextEntryBytes
        });
      }
      const ratio=sizes.compressed>0?sizes.uncompressed/sizes.compressed:0;
      if(ratio>limits.maxCompressionRatio){
        throw limitError(
          'This ZIP contains an unusually compressed file and was stopped before extraction: '+name,
          {path:name,ratio:ratio,limit:limits.maxCompressionRatio}
        );
      }
    });

    if(total>limits.maxUncompressedBytes){
      throw limitError('The uncompressed ZIP is too large for a browser import.',{
        bytes:total,limit:limits.maxUncompressedBytes
      });
    }
    Log.info('dataset.import-budget',{
      compressedBytes:compressedBytes,
      uncompressedBytes:total,
      files:entries.length,
      limits:limits
    });
    return{files:entries.length,uncompressedBytes:total};
  }
  function extractionBudget(limits){let total=0;
return{account:function(path,bytes,isText){const n=Math.max(0,Number(bytes)||0);
    if(n>limits.maxEntryBytes)throw limitError('A file expanded beyond the safe per-file limit: '+path,{
    path:path,bytes:n,limit:limits.maxEntryBytes});
    if(isText&&n>limits.maxTextEntryBytes)throw limitError('A text file expanded beyond the safe parsing limit: '+path,{
    path:path,bytes:n,limit:limits.maxTextEntryBytes});total+=n;
    if(total>limits.maxUncompressedBytes)throw limitError('ZIP extraction exceeded the safe browser memory budget.',{
    path:path,bytes:total,limit:limits.maxUncompressedBytes});return n;},total:function(){return total;}};}
  async function extractBytes(zip,path,budget,isText){const file=zip.file(path);if(!file)throw new Error('ZIP entry not found: '+path);const bytes=await file.async('uint8array');budget.account(path,bytes.byteLength,!!isText);return bytes;}
  function bytesToText(bytes){return typeof TextDecoder!=='undefined'?new TextDecoder('utf-8').decode(bytes):Array.from(bytes||[]).map(function(b){return String.fromCharCode(b);}).join('');}
  async function extractText(zip,path,budget){return bytesToText(await extractBytes(zip,path,budget,true));}
  function exactArrayBuffer(bytes){return bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes.buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}

  function basenamePath(path) { return String(path || '').split('/').filter(Boolean).pop() || ''; }


  function parentPath(path) {
    const parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length < 2) return '';
    parts.pop();
    return parts.join('/');
  }

  function runLabel(path) { return basenamePath(parentPath(path)); }

  function measurementSequence(fileName) {
    const match = basenamePath(fileName).match(/^(\d+)_/);
    return match ? Number(match[1]) : null;
  }

  function hierarchyForSample(sampleName) {
    if (P.sampleHierarchy) return P.sampleHierarchy(sampleName);
    const sample = P.canonicalSample(sampleName);
    const experiment = P.groupFromSample(sample);
    return { sample: sample, experiment: experiment, position: '', cell: '', matched: false };
  }

    // Reconstruct archive-encoded acquisition structure; a measurement file is not promoted to an experiment.
  function buildAcquisitionHierarchy(samples, measurements, auxiliaryEvidence) {
    const experimentMap = new Map(), runMap = new Map(), sampleByName = new Map();

    function ensureExperiment(name, isRef) {
      const key = String(name || '').trim() || 'Unknown experiment';
      if (!experimentMap.has(key)) {
        experimentMap.set(key, DS.create('experiment', { name: key, isRef: !!isRef, sampleIds: [], sampleNames: [], runIds: [], measurementIds: [] }));
      }
      const experiment = experimentMap.get(key);
      experiment.isRef = experiment.isRef || !!isRef;
      return experiment;
    }

    samples.forEach(function (sample) {
      const h = hierarchyForSample(sample.name);
      sample.name = h.sample;
      sample.group = h.experiment;
      sample.experiment = h.experiment;
      sample.position = h.position || '';
      sample.cell = h.cell || '';
      sample.runIds = Array.isArray(sample.runIds) ? sample.runIds : [];
      sample.measurementIds = Array.isArray(sample.measurementIds) ? sample.measurementIds : [];
      const experiment = ensureExperiment(h.experiment, sample.isRef);
      sample.experimentId = experiment.id;
      if (!experiment.sampleIds.includes(sample.id)) experiment.sampleIds.push(sample.id);
      if (!experiment.sampleNames.includes(sample.name)) experiment.sampleNames.push(sample.name);
      sampleByName.set(sample.name, sample);
    });

    function ensureRun(path, sampleName) {
      const dir = parentPath(path);
      const sample = sampleByName.get(P.canonicalSample(sampleName));
      if (!dir || !sample) return null;
      const key = sample.id + '|' + dir;
      if (!runMap.has(key)) {
        const run = DS.create('run', { path: dir, label: runLabel(path), sampleId: sample.id, sample: sample.name, experimentId: sample.experimentId, experiment: sample.experiment, measurementIds: [], evidencePaths: [] });
        runMap.set(key, run);
        if (!sample.runIds.includes(run.id)) sample.runIds.push(run.id);
        const experiment = experimentMap.get(sample.experiment);
        if (experiment && !experiment.runIds.includes(run.id)) experiment.runIds.push(run.id);
      }
      return runMap.get(key);
    }

    measurements.forEach(function (measurement) {
      const sample = sampleByName.get(P.canonicalSample(measurement.sample));
      if (!sample) return;
      measurement.sampleId = sample.id;
      measurement.group = sample.experiment;
      measurement.experiment = sample.experiment;
      measurement.experimentId = sample.experimentId;
      measurement.position = sample.position;
      measurement.cell = sample.cell;
      measurement.sequence = measurementSequence(measurement.rawFile || measurement.file || measurement.path);
      const run = ensureRun(measurement.path, sample.name);
      measurement.runId = run ? run.id : null;
      if (run && !run.measurementIds.includes(measurement.id)) run.measurementIds.push(measurement.id);
      const experiment = experimentMap.get(sample.experiment);
      if (experiment && !experiment.measurementIds.includes(measurement.id)) experiment.measurementIds.push(measurement.id);
    });

    (auxiliaryEvidence || []).forEach(function (aux) {
      const h = hierarchyForSample(aux.sample);
      aux.sample = h.sample;
      aux.group = h.experiment;
      aux.experiment = h.experiment;
      aux.position = h.position || '';
      aux.cell = h.cell || '';
      const sample = sampleByName.get(h.sample);
      if (!sample) return;
      aux.sampleId = sample.id;
      aux.experimentId = sample.experimentId;
      const run = ensureRun(aux.path, sample.name);
      aux.runId = run ? run.id : null;
      if (run && aux.path && !run.evidencePaths.includes(aux.path)) run.evidencePaths.push(aux.path);
    });

    return {
      experiments: Array.from(experimentMap.values()).sort(function (a, b) { return a.name.localeCompare(b.name); }),
      runs: Array.from(runMap.values()).sort(function (a, b) { return a.path.localeCompare(b.path); })
    };
  }

  async function sha256Hex(bytes) {
    if (!bytes || !globalThis.crypto || !crypto.subtle || !crypto.subtle.digest) return '';
    try {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (err) {
      Log.warn('importer.sha256-unavailable', { error: err });
      return '';
    }
  }

  function familyOf(type) {
    if (type === 'summary-fw' || type === 'summary-rv' || type === 'summary') return 'summary';
    if (type === 'jv') return 'jv';
    if (type === 'parameters') return 'parameters';
    if (type === 'tracking') return 'tracking';
    return null;
  }

  function finding(severity, type, title, detail, target, evidence) {
    return DS.create('finding', { severity: severity, type: type, title: title, detail: detail, target: target || '', evidence: evidence || [], status: 'open', source: 'deterministic' });
  }

  const METRIC_COLUMNS = [{ name: 'voc', unit: 'V' }, { name: 'jsc', unit: 'mA/cm²' }, { name: 'vmpp', unit: 'V' }, { name: 'jmpp', unit: 'mA/cm²' }, { name: 'pmpp', unit: 'mW/cm²' }, { name: 'rs', unit: 'Ohm' }, { name: 'rsh', unit: 'Ohm' }, { name: 'ff', unit: '%' }, { name: 'eff', unit: '%' }];
  const METRIC_KEYS = METRIC_COLUMNS.map(function (c) { return c.name; });
  const SUMMARY_COLUMNS = [{ name: 'file' }].concat(METRIC_COLUMNS);
  const SUMMARY_KEYS = SUMMARY_COLUMNS.map(function (c) { return c.name; });

  function metricRow(directionMetrics) {
    const row = {};
    METRIC_KEYS.forEach(function (key) {
      row[key] = directionMetrics && directionMetrics[key] != null ? directionMetrics[key] : null;
    });
    return row;
  }


  async function restoreLabFlowSave(zip, sourceName, onProgress, budget) {
    const marker=zip.file('labflow.json'),dataFile=zip.file('experiment.json');
    if(!marker||!dataFile)return null;
    let info=null;try{info=JSON.parse(await extractText(zip,'labflow.json',budget));}catch(_err){return null;}
    if(!info||info.format!=='labflow-save')return null;
    if(onProgress)onProgress({stage:'Restoring LabFlow ZIP',progress:0.2});
    const data=JSON.parse(await extractText(zip,'experiment.json',budget));
    if(String(info.experimentId||'')!==String(data.id||'')){
      const error=new Error('LabFlow save integrity check failed: experiment identity does not match the manifest.');error.code='LABFLOW_SAVE_INTEGRITY';throw error;
    }
    const exp=DM.restore(data),rawFile=zip.file('raw/source.zip'),declaredIncluded=!!(info.source&&info.source.included);
    if(declaredIncluded&&!rawFile){const error=new Error('LabFlow save integrity check failed: the manifest declares RAW data but raw/source.zip is missing.');error.code='LABFLOW_SAVE_INTEGRITY';throw error;}
    if(!declaredIncluded&&rawFile){const error=new Error('LabFlow save integrity check failed: raw/source.zip is present but not declared by the manifest.');error.code='LABFLOW_SAVE_INTEGRITY';throw error;}
    exp.raw=exp.raw||{};
    if(rawFile){
      const rawBytes=await extractBytes(zip,'raw/source.zip',budget,false),rawBuffer=exactArrayBuffer(rawBytes),actualSha=await sha256Hex(rawBuffer),manifestSha=String(info.source&&info.source.sha256||'').toLowerCase(),experimentSha=String(exp.raw.sha256||'').toLowerCase();
      if(!manifestSha||!experimentSha||!actualSha||actualSha!==manifestSha||actualSha!==experimentSha){const error=new Error('LabFlow save integrity check failed: RAW SHA-256 does not match the manifest and experiment provenance.');error.code='LABFLOW_SAVE_INTEGRITY';error.details={actual:actualSha,manifest:manifestSha,experiment:experimentSha};throw error;}
      exp.raw.sourceArchive=rawBuffer;
    }else exp.raw.sourceArchive=null;
    exp.meta=exp.meta||{};exp.meta.importMethod='labflow-save';
    if(onProgress)onProgress({stage:'LabFlow ZIP restored',progress:1});
    Log.info('dataset.labflow-save-restored',{sourceName:sourceName,experimentId:exp.id,revision:exp.sync&&exp.sync.revision||0,measurements:(exp.measurements||[]).length,rawIncluded:!!rawFile,integrityVerified:!!rawFile});
    return exp;
  }

  async function parseDataset(arrayBuffer, sourceName, onProgress) {
    const end = Log.timer('dataset.parse', { sourceName: sourceName, bytes: arrayBuffer && arrayBuffer.byteLength || 0 });
    const limits=importLimits(),compressedBytes=arrayBuffer&&arrayBuffer.byteLength||0;
    if(compressedBytes>limits.maxCompressedBytes){const err=limitError('This ZIP is too large for a browser import.',{bytes:compressedBytes,limit:limits.maxCompressedBytes});end({error:err},'error');throw err;}
    if (!window.JSZip) { const err = new Error('JSZip is not available.'); end({ error: err }, 'error'); throw err; }
    if (!P || !DM) { const err = new Error('Parser or DataModel is not available.'); end({ error: err }, 'error'); throw err; }
    const r = P.rules();
    const recovery = r.recovery || {};
    const directionLabels = ((r.summary_format || {}).direction_labels || {});
    const fwDirection = String(directionLabels.fw || '');
    const rvDirection = String(directionLabels.rv || '');
    const unknownLabel = String(((r.sample_identity || {}).unknown_label) || '');

    const zipSha = await sha256Hex(arrayBuffer);
    const exp = DM.create({ bytes: arrayBuffer, sourceName: sourceName });

    if (onProgress) onProgress({ stage: 'Opening ZIP', progress: 0.03 });
    const zip = await JSZip.loadAsync(arrayBuffer);
    preflightArchive(zip,compressedBytes);
    const budget=extractionBudget(limits);
    const restored=await restoreLabFlowSave(zip,sourceName,onProgress,budget);
    if(restored){end({datasetId:restored.id,name:restored.meta&&restored.meta.name,restored:true,measurements:(restored.measurements||[]).length},'info');return restored;}
    const entries = Object.values(zip.files);
    const manifest = entries.map(function (f) {
      return DS.create('manifest_entry', { path: f.name, name: basenamePath(f.name), directory: !!f.dir, type: f.dir ? 'directory' : P.classify(f.name) });
    });
    const fileEntries = manifest.filter(function (x) { return !x.directory; });
    const typeCounts = manifest.reduce(function (acc, x) { acc[x.type] = (acc[x.type] || 0) + 1; return acc; }, {});
    Log.info('dataset.manifest', { entries: manifest.length, files: fileEntries.length, typeCounts: typeCounts });
    if (onProgress) onProgress({ stage: 'Inspecting manifest', progress: 0.10, files: fileEntries.length });

    const findings = [];
    const auxiliaryEvidence = [];

    const fileRecords = [];
    const textByPath = new Map();
    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      let bytes = null;
      try { bytes = await extractBytes(zip,entry.path,budget,/\.(?:txt|csv|tsv|md|json|ya?ml)$/i.test(entry.name)); }
      catch (err) {
        Log.warn('dataset.read-failed', { path: entry.path, error: err });
        findings.push(finding('warning', 'parse', 'Could not read file', String(err.message || err), entry.path, [entry.path]));
      }
      let record = null;
      if (bytes) {
        const canonicalName = P.canonicalFileName ? P.canonicalFileName(entry.name) : entry.name;
        const file = DM.addFile(exp, {
          path: entry.path, rawPath: entry.path, name: canonicalName, rawName: entry.name, canonicalName: canonicalName,
          canonicalPath: P.canonicalFilePath ? P.canonicalFilePath(entry.path) : entry.path,
          extension: (entry.name.match(/\.[^.]+$/) || [''])[0].toLowerCase(),
          family: familyOf(entry.type), type: entry.type, size: bytes.byteLength, sha256: await sha256Hex(bytes), unreadable: false
        });
        fileRecords.push(file);
        record = file;
      } else {
        const canonicalName = P.canonicalFileName ? P.canonicalFileName(entry.name) : entry.name;
        const file = DM.addFile(exp, { path: entry.path, rawPath: entry.path, name: canonicalName, rawName: entry.name, canonicalName: canonicalName, canonicalPath: P.canonicalFilePath ? P.canonicalFilePath(entry.path) : entry.path, extension: (entry.name.match(/\.[^.]+$/) || [''])[0].toLowerCase(), family: familyOf(entry.type), type: entry.type, size: 0, sha256: '', unreadable: true });
        fileRecords.push(file);
        record = file;
      }
      if (/\.(?:txt|csv|tsv|md|json|ya?ml)$/i.test(entry.name) && bytes) {
        try { const text=bytesToText(bytes);textByPath.set(entry.path,text); }
        catch (err) { Log.warn('dataset.text-read-failed', { path: entry.path, error: err }); }
      }
    }


        // Prompt/debug format evidence is bounded; complete RAW text remains local source evidence.
    const rawFormatEvidence = [];
    const textFiles = fileEntries.filter(function (entry) { return /\.(?:txt|csv|tsv|md|json|ya?ml)$/i.test(entry.name); }).slice(0, 64);
    for (let i = 0; i < textFiles.length; i++) {
      const entry = textFiles[i];
      const text = textByPath.get(entry.path);
      if (text != null) rawFormatEvidence.push(DS.create('format_evidence', P.formatEvidence(entry, text)));
    }
    Log.info('dataset.format-evidence', { files: rawFormatEvidence.length });

    const namingRegex = (function () {
      const pattern = ((r.naming_checks || {}).odd_spacing_regex);
      if (!pattern) return null;
      try { return new RegExp(pattern, 'i'); } catch (err) { Log.error('rules.regex-invalid', { pattern: pattern, error: err }); return null; }
    })();
    const nameOdd = namingRegex ? fileEntries.filter(function (x) { return namingRegex.test(x.name); }) : [];
    const normalizedNames = fileRecords.filter(function (f) { return String(f.rawName || f.name) !== String(f.name || ''); });
    if (nameOdd.length || normalizedNames.length) {
      Log.info('dataset.naming-normalized', { candidates: nameOdd.length, normalized: normalizedNames.length, examples: normalizedNames.slice(0, 4).map(function(f){return {raw:f.rawName,canonical:f.name};}) });
    }
    const enc = r.encoding_checks || {};
    const replacement = String(enc.replacement_character || '');
    textByPath.forEach(function (text, path) {
      if (replacement && text.includes(replacement)) findings.push(finding(enc.severity || 'info', 'encoding', 'Encoding replacement character detected', 'A replacement character configured by the Markdown policy was found in labels; numeric tokens may still be parseable.', path, [path]));
    });

    function findByType(type) { return fileEntries.find(function (x) { return x.type === type; }); }
    const fwFile = findByType('summary-fw');
    const rvFile = findByType('summary-rv');
    let fwSummary = [], rvSummary = [];
    if (fwFile && recovery.use_summary_files !== false) {
      const txt = textByPath.get(fwFile.path);
      if (txt != null) fwSummary = P.parseSummary(txt, fwDirection);
      Log.info('dataset.summary-fw', { path: fwFile.path, rows: fwSummary.length });
    }
    if (rvFile && recovery.use_summary_files !== false) {
      const txt = textByPath.get(rvFile.path);
      if (txt != null) rvSummary = P.parseSummary(txt, rvDirection);
      Log.info('dataset.summary-rv', { path: rvFile.path, rows: rvSummary.length });
    }
    if (!fwFile || !rvFile) {
      findings.push(finding('warning', 'missing-summary', 'JV summary pair incomplete', 'The Markdown recovery policy allows individual JV fallback when available.', 'root', [fwFile && fwFile.path, rvFile && rvFile.path].filter(Boolean)));
    }

    const jvFiles = recovery.use_individual_jv_fallback === false ? [] : fileEntries.filter(function (x) { return x.type === 'jv'; });
    const duplicateJvNames = new Map();
    jvFiles.forEach(function (entry) {
      const paths = duplicateJvNames.get(entry.name) || [];
      paths.push(entry.path);
      duplicateJvNames.set(entry.name, paths);
    });
    duplicateJvNames.forEach(function (paths, name) {
      if (paths.length > 1) findings.push(finding('warning', 'duplicate-filename', 'Duplicate filename across paths', 'Multiple JV files share the basename "' + name + '"; full archive paths preserve their distinct identities.', paths[0], paths));
    });
    function resolveSummaryPath(fileKey) {
      const matches = jvFiles.filter(function (f) { return f.name === fileKey; });
      if (matches.length === 1) return matches[0].path;
      if (matches.length > 1) {
        findings.push(finding('warning', 'duplicate-filename', 'Duplicate filename across paths', 'Multiple archive files share the basename "' + fileKey + '"; summary rows are not merged automatically and each file stays a distinct measurement.', matches[0].path, matches.map(function (f) { return f.path; })));
        return null;
      }
      return null;
    }

    const fwMap = new Map(fwSummary.map(function (m) { return [m.file, m]; }));
    const rvMap = new Map(rvSummary.map(function (m) { return [m.file, m]; }));
    const measurementMap = new Map();
    const sampleMap = new Map();

    function sampleRecord(sampleName, rawSample, group, isRef) {
      const h = hierarchyForSample(sampleName), key = h.sample, experiment = h.experiment || group || key;
      if (!sampleMap.has(key)) {
        sampleMap.set(key, DS.create('sample', { name: key, rawName: rawSample || sampleName, isRef: !!isRef, group: experiment, experiment: experiment, position: h.position || '', cell: h.cell || '', meta: {} }));
      }
      return sampleMap.get(key);
    }

    function measureFromSummary(fileKey, path, fw, rv) {
      const sample = P.canonicalSample(P.sampleFromFilename ? P.sampleFromFilename(fileKey, path) : fileKey);
      const group = P.groupFromSample(sample);
      const isRef = P.isReference(sample);
      const s = sampleRecord(sample, fileKey, group, isRef);
      const canonicalFile = P.canonicalFileName ? P.canonicalFileName(fileKey) : fileKey;
      const m = DS.create('measurement', { file: canonicalFile, rawFile: fileKey, path: path || '', rawSample: fileKey, sample: sample, sampleAliases: Array.from(new Set([fileKey, canonicalFile].filter(Boolean))), identitySource: 'filename', group: group, isRef: isRef, fw: fw, rv: rv, curve: { fw: [], rv: [] }, meta: {}, source: 'summary', excluded: false, recoveries: [] });
      s.measurementIds.push(m.id);
      return m;
    }

    const summaryNames = new Set([].concat(fwSummary.map(function (x) { return x.file; }), rvSummary.map(function (x) { return x.file; })));
    summaryNames.forEach(function (fileKey) {
      const fw = fwMap.get(fileKey) || null;
      const rv = rvMap.get(fileKey) || null;
      const key = resolveSummaryPath(fileKey);
      const m = measureFromSummary(fileKey, key, fw, rv);
      if (key) {
        m.source = 'summary';
        measurementMap.set(key, m);
      } else {
        measurementMap.set('summary:' + fileKey, m);
      }
      if ((!fw || !rv) && recovery.keep_partial_measurements !== false) findings.push(finding('warning', 'direction-pair', 'FW/RV summary pair incomplete', 'One scan direction is missing from summary data.', fileKey, [fileKey]));
    });

    for (let i = 0; i < jvFiles.length; i++) {
      const entry = jvFiles[i];
      if (onProgress) onProgress({ stage: 'Parsing JV files', progress: 0.18 + (jvFiles.length ? 0.70 * i / jvFiles.length : 0), current: i + 1, total: jvFiles.length, path: entry.path });
      const text = textByPath.get(entry.path);
      if (text == null) continue;
      let parsed;
      try { parsed = P.parseJVFile(text, entry.name, entry.path); }
      catch (err) {
        Log.error('dataset.jv-parse-failed', { path: entry.path, error: err });
        findings.push(finding('danger', 'parse', 'Could not parse JV file', String(err.message || err), entry.path, [entry.path]));
        continue;
      }
      let m = measurementMap.get(entry.path);
      if (!m) {
        const sample = P.canonicalSample(parsed.sample != null && parsed.sample !== unknownLabel ? parsed.sample : P.sampleFromFilename ? P.sampleFromFilename(entry.name, entry.path) : entry.name);
        const group = P.groupFromSample(sample);
        const isRef = P.isReference(sample);
        const s = sampleRecord(sample, parsed.sample, group, isRef);
        const canonicalFile = P.canonicalFileName ? P.canonicalFileName(entry.name) : entry.name;
        m = DS.create('measurement', { file: canonicalFile, rawFile: entry.name, path: entry.path,
rawSample: parsed.sample, sample: sample, sampleAliases: Array.from(new Set([entry.name, canonicalFile,
          parsed.sample].filter(Boolean))), identitySource: parsed.sample!==unknownLabel?'jv-internal-device':'filename',
          group: group, isRef: isRef, fw: null, rv: null, curve: parsed.curve, meta: parsed.meta, source: 'jv-file',
          excluded: false, recoveries: [] });
        s.measurementIds.push(m.id);
        measurementMap.set(entry.path, m);
      }

      const parsedSample=P.canonicalSample(parsed.sample);
      if(parsed.sample!==unknownLabel&&parsedSample&&parsedSample!==m.sample){
        const previousSample=m.sample,group=P.groupFromSample(parsedSample),isRef=P.isReference(parsedSample),target=sampleRecord(parsedSample,parsed.sample,group,isRef);
        const previous=sampleMap.get(previousSample);if(previous)previous.measurementIds=previous.measurementIds.filter(function(id){return id!==m.id;});
        if(!target.measurementIds.includes(m.id))target.measurementIds.push(m.id);
        m.sample=parsedSample;m.group=group;m.isRef=isRef;m.rawSample=parsed.sample;
        m.identitySource='jv-internal-device';m.sampleAliases=Array.from(new Set([previousSample,m.file,parsed.sample].filter(Boolean)));
      }
      m.path = entry.path;
      m.rawFile = m.rawFile || entry.name;
      m.file = P.canonicalFileName ? P.canonicalFileName(entry.name) : entry.name;
      m.sampleAliases = Array.from(new Set((m.sampleAliases||[]).concat([entry.name,m.file]).filter(Boolean)));
      m.meta = parsed.meta;
      m.curve = parsed.curve;
      const parsedFw = fwDirection ? parsed.metrics[String(fwDirection).toUpperCase()] : null;
      const parsedRv = rvDirection ? parsed.metrics[String(rvDirection).toUpperCase()] : null;
      if (!m.fw && parsedFw) { m.fw = parsedFw; m.recoveries.push({ field: 'forward metrics', source: entry.path, method: 'individual_jv_fallback' }); }
      if (!m.rv && parsedRv) { m.rv = parsedRv; m.recoveries.push({ field: 'reverse metrics', source: entry.path, method: 'individual_jv_fallback' }); }
      if (m.sample === unknownLabel && parsed.sample !== unknownLabel) {
        const sample = P.canonicalSample(parsed.sample);
        const group = P.groupFromSample(sample);
        const isRef = P.isReference(sample);
        m.sample = sample; m.group = group; m.isRef = isRef; m.rawSample = parsed.sample;
      }
    }
    Log.info('dataset.jv-fallback', { enabled: recovery.use_individual_jv_fallback !== false, count: jvFiles.length });


    const auxiliaryFiles = fileEntries.filter(function (x) { return x.type === 'parameters' || x.type === 'tracking'; });
    for (let i = 0; i < auxiliaryFiles.length; i++) {
      const entry = auxiliaryFiles[i];
      if (onProgress) onProgress({ stage: 'Reading experiment evidence', progress: 0.89 + (auxiliaryFiles.length ? 0.06 * i / auxiliaryFiles.length : 0), current: i + 1, total: auxiliaryFiles.length, path: entry.path });
      const text = textByPath.get(entry.path);
      if (text == null) { findings.push(finding('warning', 'parse', 'Could not read ' + entry.type + ' evidence', 'Text content unavailable.', entry.path, [entry.path])); continue; }
      let aux;
      try { aux = P.parseAuxiliaryFile(text, entry.name, entry.path, entry.type); }
      catch (err) { Log.warn('dataset.aux-parse-failed', { path: entry.path, error: err }); findings.push(finding('warning', 'parse', 'Could not read ' + entry.type + ' evidence', String(err.message || err), entry.path, [entry.path])); continue; }
      auxiliaryEvidence.push(DS.create('auxiliary_evidence', aux));
    }

    if (onProgress) onProgress({ stage: 'Building canonical measurements', progress: 0.96 });
    const measurements = Array.from(measurementMap.values());
    const samples = Array.from(sampleMap.values()).filter(function (sample) { return (sample.measurementIds || []).length > 0; });
    const hierarchy = buildAcquisitionHierarchy(samples, measurements, auxiliaryEvidence);
    if (!measurements.length) findings.push(finding('danger', 'no-measurements', 'No JV measurements parsed', 'Neither configured summaries nor individual JV fallback produced usable measurements.', 'root', []));


    function jvName(sample, direction, kind) { return sample + ' ' + direction + ' ' + kind; }
    function sampleKey(name) {
      const sample = samples.find(function (s) { return s.name === name; });
      return sample ? sample.id : null;
    }
    function fileIdOf(path) {
      const f = exp.files.find(function (x) { return x.path === path; });
      return f ? f.id : '';
    }
    function addMetricBlock(filePath, sample, direction, metrics, locator) {
      const row = metricRow(metrics);
      const id = DM.addBlock(exp, {
        type: 'table', family: 'jv', name: jvName(sample, direction.toUpperCase(), 'metrics'), direction: direction,
        file: { id: fileIdOf(filePath), path: filePath, locator: locator || null },
        refs: [sampleKey(sample) ? {kind:'sample',id:sampleKey(sample)} : null].filter(Boolean),
        schema: { columns: METRIC_COLUMNS.map(function (c) { return { name: c.name, unit: c.unit }; }) },
        data: { header: METRIC_KEYS.slice(), rows: [row] }, metadata: {}
      });
      return id;
    }
    function addCurveBlock(filePath, sample, direction, points) {
      return DM.addBlock(exp, {
        type: 'series', family: 'jv', name: jvName(sample, direction.toUpperCase(), 'curve'), direction: direction,
        file: { id: fileIdOf(filePath), path: filePath, locator: null },
        refs: [sampleKey(sample) ? {kind:'sample',id:sampleKey(sample)} : null].filter(Boolean),
        schema: { columns: [{ name: 'v', unit: 'V' }, { name: 'j', unit: 'mA/cm²' }] },
        data: { header: ['v', 'j'], rows: (points || []).map(function (pt) { return { v: pt.x, j: pt.y }; }) }, metadata: {}
      });
    }


    if (fwSummary.length) {
      const file = exp.files.find(function (f) { return f.type === 'summary-fw'; });
      DM.addBlock(exp, {
        type: 'table', family: 'summary', name: 'JV Summary FW', direction: 'fw',
        file: { id: file ? file.id : '', path: file ? file.path : '', locator: { header: 'File' } },
        refs: [], schema: { columns: SUMMARY_COLUMNS.map(function (c) { return { name: c.name, unit: c.unit || null }; }) },
        data: { header: SUMMARY_KEYS.slice(), rows: fwSummary.map(function (row) { const out = { file: row.file }; METRIC_KEYS.forEach(function (k) { out[k] = row[k]; }); return out; }) }, metadata: {}
      });
    }
    if (rvSummary.length) {
      const file = exp.files.find(function (f) { return f.type === 'summary-rv'; });
      DM.addBlock(exp, {
        type: 'table', family: 'summary', name: 'JV Summary RV', direction: 'rv',
        file: { id: file ? file.id : '', path: file ? file.path : '', locator: { header: 'File' } },
        refs: [], schema: { columns: SUMMARY_COLUMNS.map(function (c) { return { name: c.name, unit: c.unit || null }; }) },
        data: { header: SUMMARY_KEYS.slice(), rows: rvSummary.map(function (row) { const out = { file: row.file }; METRIC_KEYS.forEach(function (k) { out[k] = row[k]; }); return out; }) }, metadata: {}
      });
    }


    measurements.forEach(function (m) {
      if (m.fw) addMetricBlock(m.path, m.sample, 'fw', m.fw, { header: 'Scan', row: 0 });
      if (m.rv) addMetricBlock(m.path, m.sample, 'rv', m.rv, { header: 'Scan', row: 1 });
      if (m.curve && m.curve.fw && m.curve.fw.length) addCurveBlock(m.path, m.sample, 'fw', m.curve.fw);
      if (m.curve && m.curve.rv && m.curve.rv.length) addCurveBlock(m.path, m.sample, 'rv', m.curve.rv);
    });


    auxiliaryEvidence.forEach(function (aux) {
      const family = aux.type === 'tracking' ? 'tracking' : 'parameters';
      const fileId = fileIdOf(aux.path);
      const sampleId = sampleKey(aux.sample);
      const metaPairs = Object.keys(aux.meta || {}).map(function (key) { return { key: key, value: String(aux.meta[key] == null ? '' : aux.meta[key]) }; });
      if (metaPairs.length) {
        DM.addBlock(exp, {
          type: 'key_value', family: family, name: basenamePath(aux.path) + ' metadata',
          file: { id: fileId, path: aux.path, locator: null }, refs: (sampleId ? [{kind:'sample',id:sampleId}] : []),
          schema: { columns: [{ name: 'key' }, { name: 'value' }] },
          data: { header: ['key', 'value'], rows: metaPairs }, metadata: {}
        });
      }
      if (aux.dataColumns && aux.dataColumns.length && aux.rowCount > 0) {
        DM.addBlock(exp, {
          type: 'table', family: family, name: basenamePath(aux.path) + ' series',
          file: { id: fileId, path: aux.path, locator: null }, refs: (sampleId ? [{kind:'sample',id:sampleId}] : []),
          schema: { columns: aux.dataColumns.map(function (c) { return { name: c, unit: null }; }) },
          data: { header: aux.dataColumns.slice(), rows: [] }, metadata: { rowCount: aux.rowCount }
        });
      }
    });

    const rootName = (fileEntries[0] && fileEntries[0].path.split('/')[0]) || (sourceName || 'Experiment').replace(/\.zip$/i, '');
    exp.meta.name = rootName;
    exp.meta.sourceSize = arrayBuffer.byteLength;
    exp.raw.sha256 = zipSha;

    exp.manifest = manifest;
    exp.rawFormatEvidence = rawFormatEvidence;
    exp.experiments = hierarchy.experiments;
    exp.samples = samples;
    exp.runs = hierarchy.runs;
    exp.measurements = measurements;
    exp.auxiliaryEvidence = auxiliaryEvidence;
    exp.findings = findings;
    exp.patches = exp.patches || [];
    DM.normalize(exp);
    if (onProgress) onProgress({ stage: 'Import complete', progress: 1 });
    end({
      datasetId: exp.id, name: exp.meta.name, files: fileEntries.length,
      experiments: exp.experiments.length, samples: exp.samples.length, runs: exp.runs.length, measurements: exp.measurements.length,
      blocks: exp.blocks.length, findings: exp.findings.length,
      summaryFW: fwSummary.length, summaryRV: rvSummary.length, jvFiles: jvFiles.length
    }, 'info');
    return exp;
  }

  LF.Importer = { parseDataset: parseDataset, importLimits: importLimits, zipEntrySizes: function(file){return ZipMetadataAdapter.sizes(file);} };
}());
