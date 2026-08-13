(function () {
  'use strict';

  /*
   * LabFlow export module.
   *
   * RAW is immutable: `original` returns the pristine source bytes untouched.
   * `package` emits a canonical snapshot (manifest + working experiment.json +
   * per-file raw copies). `modified` emits the pristine RAW, the working
   * experiment.json (which carries patches and the review snapshot so reviews
   * survive a round-trip) and raw copies marked with the `.labflow` suffix.
   */
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core || {};
  const DM = LF.DataModel;
  const safeJson = C.safeJson || function (v, s) { return JSON.stringify(v, null, s); };

  function sourceArchive(exp) {
    return exp && exp.raw && exp.raw.sourceArchive;
  }

  function hasSource(exp) {
    return !!(sourceArchive(exp) instanceof ArrayBuffer) && sourceArchive(exp).byteLength > 0;
  }

  /*
   * Read the pristine bytes for every non-directory file of the source archive,
   * keyed by archive path. Lazily loads the archive from exp.raw.sourceArchive.
   */
  async function rawFileBytes(exp) {
    const arc = sourceArchive(exp);
    const out = {};
    if (!arc) return out;
    let zip = null;
    const selected = (exp.files || []).filter(function (f) { return f.path && !f.unreadable; });
    for (const f of selected) {
      try {
        if (!zip) zip = await JSZip.loadAsync(arc);
        const entry = zip.file(f.path);
        if (entry && !entry.dir) out[f.path] = await entry.async('arraybuffer');
      } catch (_err) {
        /* unreadable or missing entry: omit so the manifest stays the source of truth */
      }
    }
    return out;
  }

  function manifest(exp) {
    return {
      format: 'labflow-experiment',
      experimentId: exp.id,
      generatedAt: new Date().toISOString(),
      files: (exp.files || []).map(function (f) {
        return { path: f.path, sha256: f.sha256 || '', family: f.family || '', type: f.type || '' };
      })
    };
  }

  /*
   * Working experiment.json. `{rows:null}` emits entire block row arrays.
   * For a `modified` export the deterministic review snapshot and patch list
   * are embedded so the current Working Copy remains auditable.
   */
  function workingJSON(exp, includeReview) {
    const base = DM.toWorkingJSON(exp, { rows: null });
    if (!includeReview) return base;
    return Object.assign({}, base, {
      patches: (exp.patches || []).slice(),
      review: {
        derived: {
          measurements: exp.measurements || [],
          findings: exp.findings || [],
          analysis: exp.analysis || null
        },
        nomad: exp.nomad ? { validation: exp.nomad.validation || null, mappingPlan: exp.nomad.mappingPlan || null } : null
      }
    });
  }


  function canonicalSnapshot(exp) {
    const store = LF.CanonicalStore ? LF.CanonicalStore.ensure(exp) : null;
    function measurement(m) {
      return {
        id:m.id, file:m.path||m.file||'', sample:m.sample||'', rawSample:m.rawSample||'', group:m.group||'', isRef:!!m.isRef,
        fw:m.fw||null, rv:m.rv||null, meta:m.meta||{}, excluded:!!m.excluded, qualityStatus:m.qualityStatus||'', rankingEligible:!!m.rankingEligible,
        bestEff:m.bestEff, hysteresis:m.hysteresis, flags:m.flags||[], recoveries:m.recoveries||[]
      };
    }
    return {
      format:'labflow-canonical-v1', experiment:store&&store.experiment||{id:exp.id,name:exp.meta&&exp.meta.name||''}, revision:exp.sync&&exp.sync.revision||0,
      files:(exp.files||[]).map(function(f){return{id:f.id,path:f.path,name:f.name,family:f.family||'',type:f.type||'',sha256:f.sha256||''};}),
      samples:(exp.samples||[]).map(function(x){return{id:x.id,name:x.name,rawName:x.rawName||'',aliases:x.aliases||[],group:x.group||'',isRef:!!x.isRef,measurementIds:x.measurementIds||[]};}),
      measurements:(exp.measurements||[]).map(measurement), aliases:store&&store.aliases||[], relations:store&&store.relations||[], evidence:store&&store.evidence||[],
      findings:exp.findings||[], patches:exp.patches||[], design:exp.design||{}, analysis:exp.analysis||{}, provenance:exp.provenance||[]
    };
  }

  function buildBase(zip, exp, opts) {
    zip.file('manifest.json', safeJson(manifest(exp), 2));
    zip.file('experiment.json', safeJson(workingJSON(exp, opts && opts.modified), 2));
    zip.file('canonical.json', safeJson(canonicalSnapshot(exp), 2));
  }

  /* package: manifest.json + experiment.json + raw/<path> pristine copies */
  async function packageZip(exp, opts) {
    opts = opts || {};
    const zip = new JSZip();
    const raw = opts.modified ? {} : await rawFileBytes(exp);
    buildBase(zip, exp, opts);
    Object.keys(raw).forEach(function (path) {
      zip.file('raw/' + path, raw[path]);
    });
    return zip;
  }

  /* modified: pristine RAW + experiment.json(patches+review) + raw/<path>.labflow + patches.json */
  async function modifiedZip(exp, opts) {
    opts = opts || {};
    const zip = new JSZip();
    const raw = await rawFileBytes(exp);
    buildBase(zip, exp, { modified: true });
    zip.file('patches.json', safeJson({ format: 'labflow-patches', patches: exp.patches || [] }, 2));
    if (hasSource(exp)) zip.file('raw/source.zip', sourceArchive(exp));
    Object.keys(raw).forEach(function (path) {
      zip.file('raw/' + path + '.labflow', raw[path]);
    });
    return zip;
  }

  function blobFromZip(zip, type) {
    return zip.generateAsync({ type: type, compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  LF.Export = {
    /* The pristine source archive, byte for byte. */
    original: function (exp) {
      if (!hasSource(exp)) throw new Error('RAW source archive is unavailable.');
      return new Blob([sourceArchive(exp)], { type: 'application/zip' });
    },

    /* manifest.json + experiment.json + raw/<path> (pristine bytes). */
    package: function (exp, opts) {
      return packageZip(exp, opts).then(function (zip) { return blobFromZip(zip, 'blob'); });
    },

    /* RAW + experiment.json(patches+review) + raw/<path>.labflow + patches.json. */
    modified: function (exp, opts) {
      return modifiedZip(exp, opts).then(function (zip) { return blobFromZip(zip, 'blob'); });
    },

    fileName: function (exp, kind) {
      return (C.safeName ? C.safeName(exp.meta.name) : String(exp.meta.name || 'experiment')) + '_' + (kind || 'package') + '.zip';
    },

    _rawFileBytes: rawFileBytes,
    canonicalSnapshot: canonicalSnapshot
  };
})();
