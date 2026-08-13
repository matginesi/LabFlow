(function () {
  'use strict';

  /*
   * ZIP -> canonical ExperimentData importer.
   *
   * The importer owns the mechanics of reading a RAW ZIP (via JSZip), applying
   * the Markdown-driven ground truth (LF.Parser.rules), and producing the
   * canonical ExperimentData: files (identity by archive `path`, never
   * basename), entities, and blocks (table / series / key_value) carrying the
   * parsed scientific data. RAW bytes are immutable and retained verbatim.
   *
   * Deterministic semantics (naming, recovery, guardrails) live in the Markdown
   * policies and are consumed through LF.Parser. Nothing here infers or
   * interprets scientific meaning beyond the configured policy.
   *
   * The same canonical object owns both normalized blocks and the directly
   * rendered scientific collections. No alternate parser/model is maintained.
    */
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('importer');
  const P = LF.Parser;
  const DM = LF.DataModel;

  function basenamePath(path) { return String(path || '').split('/').filter(Boolean).pop() || ''; }

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
    return { id: C.uid('finding'), severity: severity, type: type, title: title, detail: detail, target: target || '', evidence: evidence || [], status: 'open', source: 'deterministic' };
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

  async function parseDataset(arrayBuffer, sourceName, onProgress) {
    const end = Log.timer('dataset.parse', { sourceName: sourceName, bytes: arrayBuffer && arrayBuffer.byteLength || 0 });
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
    const entries = Object.values(zip.files);
    const manifest = entries.map(function (f) {
      return { path: f.name, name: basenamePath(f.name), directory: !!f.dir, type: f.dir ? 'directory' : P.classify(f.name) };
    });
    const fileEntries = manifest.filter(function (x) { return !x.directory; });
    const typeCounts = manifest.reduce(function (acc, x) { acc[x.type] = (acc[x.type] || 0) + 1; return acc; }, {});
    Log.info('dataset.manifest', { entries: manifest.length, files: fileEntries.length, typeCounts: typeCounts });
    if (onProgress) onProgress({ stage: 'Inspecting manifest', progress: 0.10, files: fileEntries.length });

    const findings = [];
    const auxiliaryEvidence = [];

    /* Read every non-directory entry once: size, sha256 and (for text files)
       a decoded string used for format evidence and parsing. */
    const fileRecords = [];
    const textByPath = new Map();
    const bytesByPath = new Map();
    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      let bytes = null;
      try { bytes = await zip.file(entry.path).async('uint8array'); }
      catch (err) {
        Log.warn('dataset.read-failed', { path: entry.path, error: err });
        findings.push(finding('warning', 'parse', 'Could not read file', String(err.message || err), entry.path, [entry.path]));
      }
      let record = null;
      if (bytes) {
        bytesByPath.set(entry.path, bytes);
        const file = DM.addFile(exp, {
          path: entry.path, name: entry.name, extension: (entry.name.match(/\.[^.]+$/) || [''])[0].toLowerCase(),
          family: familyOf(entry.type), type: entry.type, size: bytes.byteLength, sha256: await sha256Hex(bytes), unreadable: false
        });
        fileRecords.push(file);
        record = file;
      } else {
        const file = DM.addFile(exp, { path: entry.path, name: entry.name, extension: (entry.name.match(/\.[^.]+$/) || [''])[0].toLowerCase(), family: familyOf(entry.type), type: entry.type, size: 0, sha256: '', unreadable: true });
        fileRecords.push(file);
        record = file;
      }
      if (/\.(?:txt|csv|tsv|md|json|ya?ml)$/i.test(entry.name)) {
        try { textByPath.set(entry.path, await zip.file(entry.path).async('string')); }
        catch (err) { Log.warn('dataset.text-read-failed', { path: entry.path, error: err }); }
      }
    }

    /* Format evidence: bounded literal RAW text lines for AI inspection. */
    const rawFormatEvidence = [];
    const textFiles = fileEntries.filter(function (entry) { return /\.(?:txt|csv|tsv|md|json|ya?ml)$/i.test(entry.name); }).slice(0, 64);
    for (let i = 0; i < textFiles.length; i++) {
      const entry = textFiles[i];
      const text = textByPath.get(entry.path);
      if (text != null) rawFormatEvidence.push(P.formatEvidence(entry, text));
    }
    Log.info('dataset.format-evidence', { files: rawFormatEvidence.length });

    const namingRegex = (function () {
      const pattern = ((r.naming_checks || {}).odd_spacing_regex);
      if (!pattern) return null;
      try { return new RegExp(pattern, 'i'); } catch (err) { Log.error('rules.regex-invalid', { pattern: pattern, error: err }); return null; }
    })();
    const nameOdd = namingRegex ? fileEntries.filter(function (x) { return namingRegex.test(x.name); }) : [];
    if (nameOdd.length) {
      Log.warn('dataset.naming-candidates', { count: nameOdd.length });
      findings.push(finding('warning', 'naming', 'Filename normalization candidates', nameOdd.length + ' files contain spacing patterns covered by the Markdown repair policy.', nameOdd[0].path, nameOdd.slice(0, 8).map(function (x) { return x.path; })));
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

    /* Path identity: a summary row references a source filename; resolve it to
       exactly one archive path. Duplicate basenames stay distinct and are not
       collapsed; ambiguity keeps the summary row as an orphan. */
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
    const sampleEntityById = new Map();

    function sampleEntity(sampleName, rawSample, group, isRef) {
      if (!sampleMap.has(sampleName)) {
        const ent = DM.addEntity(exp, { kind: 'sample', name: sampleName, rawName: rawSample || sampleName, isRef: !!isRef, group: group || '', meta: {} });
        sampleEntityById.set(ent.id, true);
        sampleMap.set(sampleName, { id: C.uid('sample'), name: sampleName, rawName: rawSample || sampleName, group: group, isRef: isRef, measurementIds: [] });
      }
      return sampleMap.get(sampleName);
    }

    function measureFromSummary(fileKey, path, fw, rv) {
      const sample = P.canonicalSample(P.sampleFromFilename ? P.sampleFromFilename(fileKey, path) : fileKey);
      const group = P.groupFromSample(sample);
      const isRef = P.isReference(sample);
      const s = sampleEntity(sample, fileKey, group, isRef);
      const m = { id: C.uid('m'), file: fileKey, path: path || '', rawSample: fileKey, sample: sample, sampleAliases: [fileKey], identitySource: 'filename', group: group, isRef: isRef, fw: fw, rv: rv, curve: { fw: [], rv: [] }, meta: {}, source: 'summary', excluded: false, recoveries: [] };
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

    /* JV files provide metrics, curves and recoveries; every file is its own
       measurement keyed by its full archive path. */
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
        const s = sampleEntity(sample, parsed.sample, group, isRef);
        m = { id: C.uid('m'), file: entry.name, path: entry.path, rawSample: parsed.sample, sample: sample, sampleAliases: [entry.name, parsed.sample].filter(Boolean), identitySource: parsed.sample!==unknownLabel?'jv-internal-device':'filename', group: group, isRef: isRef, fw: null, rv: null, curve: parsed.curve, meta: parsed.meta, source: 'jv-file', excluded: false, recoveries: [] };
        s.measurementIds.push(m.id);
        measurementMap.set(entry.path, m);
      }
      /* The individual JV file is the preferred source for device identity.
         Summary rows identify a measurement/file; they must not freeze the
         sample identity to a filename when the JV metadata contains a better
         `General info.Device` value. Original names remain provenance/aliases. */
      const parsedSample=P.canonicalSample(parsed.sample);
      if(parsed.sample!==unknownLabel&&parsedSample&&parsedSample!==m.sample){
        const previousSample=m.sample,group=P.groupFromSample(parsedSample),isRef=P.isReference(parsedSample),target=sampleEntity(parsedSample,parsed.sample,group,isRef);
        const previous=sampleMap.get(previousSample);if(previous)previous.measurementIds=previous.measurementIds.filter(function(id){return id!==m.id;});
        if(!target.measurementIds.includes(m.id))target.measurementIds.push(m.id);
        m.sample=parsedSample;m.group=group;m.isRef=isRef;m.rawSample=parsed.sample;
        m.identitySource='jv-internal-device';m.sampleAliases=Array.from(new Set([previousSample,m.file,parsed.sample].filter(Boolean)));
      }
      m.path = entry.path;
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

    /* Auxiliary Parameters / Tracking evidence becomes canonical blocks. */
    const auxiliaryFiles = fileEntries.filter(function (x) { return x.type === 'parameters' || x.type === 'tracking'; });
    for (let i = 0; i < auxiliaryFiles.length; i++) {
      const entry = auxiliaryFiles[i];
      if (onProgress) onProgress({ stage: 'Reading experiment evidence', progress: 0.89 + (auxiliaryFiles.length ? 0.06 * i / auxiliaryFiles.length : 0), current: i + 1, total: auxiliaryFiles.length, path: entry.path });
      const text = textByPath.get(entry.path);
      if (text == null) { findings.push(finding('warning', 'parse', 'Could not read ' + entry.type + ' evidence', 'Text content unavailable.', entry.path, [entry.path])); continue; }
      let aux;
      try { aux = P.parseAuxiliaryFile(text, entry.name, entry.path, entry.type); }
      catch (err) { Log.warn('dataset.aux-parse-failed', { path: entry.path, error: err }); findings.push(finding('warning', 'parse', 'Could not read ' + entry.type + ' evidence', String(err.message || err), entry.path, [entry.path])); continue; }
      auxiliaryEvidence.push(aux);
    }

    if (onProgress) onProgress({ stage: 'Building canonical measurements', progress: 0.96 });
    const measurements = Array.from(measurementMap.values());
    if (!measurements.length) findings.push(finding('danger', 'no-measurements', 'No JV measurements parsed', 'Neither configured summaries nor individual JV fallback produced usable measurements.', 'root', []));

    /* ---- canonical blocks ---- */
    const directionCounters = { fw: {}, rv: {} };
    function jvName(sample, direction, kind) { return sample + ' ' + direction + ' ' + kind; }
    function entityKey(name) {
      const ent = exp.entities.find(function (e) { return e.kind === 'sample' && e.name === name; });
      return ent ? ent.id : null;
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
        entities: [entityKey(sample)].filter(Boolean),
        schema: { columns: METRIC_COLUMNS.map(function (c) { return { name: c.name, unit: c.unit }; }) },
        data: { header: METRIC_KEYS.slice(), rows: [row] }, metadata: {}
      });
      return id;
    }
    function addCurveBlock(filePath, sample, direction, points) {
      return DM.addBlock(exp, {
        type: 'series', family: 'jv', name: jvName(sample, direction.toUpperCase(), 'curve'), direction: direction,
        file: { id: fileIdOf(filePath), path: filePath, locator: null },
        entities: [entityKey(sample)].filter(Boolean),
        schema: { columns: [{ name: 'v', unit: 'V' }, { name: 'j', unit: 'mA/cm²' }] },
        data: { header: ['v', 'j'], rows: (points || []).map(function (pt) { return { v: pt.x, j: pt.y }; }) }, metadata: {}
      });
    }

    /* Summary table blocks are built straight from the parsed summary rows. */
    if (fwSummary.length) {
      const file = exp.files.find(function (f) { return f.type === 'summary-fw'; });
      DM.addBlock(exp, {
        type: 'table', family: 'summary', name: 'JV Summary FW', direction: 'fw',
        file: { id: file ? file.id : '', path: file ? file.path : '', locator: { header: 'File' } },
        entities: [], schema: { columns: SUMMARY_COLUMNS.map(function (c) { return { name: c.name, unit: c.unit || null }; }) },
        data: { header: SUMMARY_KEYS.slice(), rows: fwSummary.map(function (row) { const out = { file: row.file }; METRIC_KEYS.forEach(function (k) { out[k] = row[k]; }); return out; }) }, metadata: {}
      });
    }
    if (rvSummary.length) {
      const file = exp.files.find(function (f) { return f.type === 'summary-rv'; });
      DM.addBlock(exp, {
        type: 'table', family: 'summary', name: 'JV Summary RV', direction: 'rv',
        file: { id: file ? file.id : '', path: file ? file.path : '', locator: { header: 'File' } },
        entities: [], schema: { columns: SUMMARY_COLUMNS.map(function (c) { return { name: c.name, unit: c.unit || null }; }) },
        data: { header: SUMMARY_KEYS.slice(), rows: rvSummary.map(function (row) { const out = { file: row.file }; METRIC_KEYS.forEach(function (k) { out[k] = row[k]; }); return out; }) }, metadata: {}
      });
    }

    /* Per-measurement metric and curve blocks from the canonical measurements. */
    measurements.forEach(function (m) {
      if (m.fw) addMetricBlock(m.path, m.sample, 'fw', m.fw, { header: 'Scan', row: 0 });
      if (m.rv) addMetricBlock(m.path, m.sample, 'rv', m.rv, { header: 'Scan', row: 1 });
      if (m.curve && m.curve.fw && m.curve.fw.length) addCurveBlock(m.path, m.sample, 'fw', m.curve.fw);
      if (m.curve && m.curve.rv && m.curve.rv.length) addCurveBlock(m.path, m.sample, 'rv', m.curve.rv);
    });

    /* Auxiliary key_value (metadata) and table (time series) blocks. */
    auxiliaryEvidence.forEach(function (aux) {
      const family = aux.type === 'tracking' ? 'tracking' : 'parameters';
      const fileId = fileIdOf(aux.path);
      const sampleId = entityKey(aux.sample);
      const metaPairs = Object.keys(aux.meta || {}).map(function (key) { return { key: key, value: String(aux.meta[key] == null ? '' : aux.meta[key]) }; });
      if (metaPairs.length) {
        DM.addBlock(exp, {
          type: 'key_value', family: family, name: basenamePath(aux.path) + ' metadata',
          file: { id: fileId, path: aux.path, locator: null }, entities: (sampleId ? [sampleId] : []),
          schema: { columns: [{ name: 'key' }, { name: 'value' }] },
          data: { header: ['key', 'value'], rows: metaPairs }, metadata: {}
        });
      }
      if (aux.dataColumns && aux.dataColumns.length && aux.rowCount > 0) {
        DM.addBlock(exp, {
          type: 'table', family: family, name: basenamePath(aux.path) + ' series',
          file: { id: fileId, path: aux.path, locator: null }, entities: (sampleId ? [sampleId] : []),
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
    exp.samples = Array.from(sampleMap.values());
    exp.measurements = measurements;
    exp.auxiliaryEvidence = auxiliaryEvidence;
    exp.findings = findings;
    exp.patches = exp.patches || [];
    if (onProgress) onProgress({ stage: 'Import complete', progress: 1 });
    end({
      experimentId: exp.id, name: exp.meta.name, files: fileEntries.length,
      samples: exp.samples.length, measurements: exp.measurements.length,
      blocks: exp.blocks.length, findings: exp.findings.length,
      summaryFW: fwSummary.length, summaryRV: rvSummary.length, jvFiles: jvFiles.length
    }, 'info');
    return exp;
  }

  LF.Importer = { parseDataset: parseDataset };
}());
