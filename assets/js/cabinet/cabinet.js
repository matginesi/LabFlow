/*
 * Registry, validation, persistence and reuse semantics for laboratory reference resources.
 * Boundary: Cabinet is reference state; Design application delegates to DesignModel using detached values.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Core || !LF.Storage) throw new Error('cabinet.js requires LabFlow.Core and LabFlow.Storage.');
  const C = LF.Core;
  const Log = LF.Logger ? LF.Logger.scope('cabinet') : null;

  const LIMITS = Object.freeze({
    maxBackupChars: 2 * 1024 * 1024,
    maxItems: 1000,
    maxLayers: 100,
    maxTags: 50,
    maxName: 300,
    maxNotes: 4000,
    maxField: 2000,
    maxTag: 120
  });

  const FIELDS = Object.freeze({
    materialClass: { label: 'Class', type: 'text', placeholder: 'transport / absorber / electrode' },
    formula: { label: 'Formula / identifier', type: 'text', placeholder: 'SnO2 / FAI / DMSO' },
    purity: { label: 'Purity', type: 'text', placeholder: 'optional' },
    supplier: { label: 'Supplier', type: 'text', placeholder: 'optional' },
    catalogNumber: { label: 'Catalog no.', type: 'text', placeholder: 'optional' },
    chemicalRole: { label: 'Role', type: 'text', placeholder: 'solute / solvent / additive / reagent' },
    role: { label: 'Role', type: 'text', placeholder: 'absorber precursor / passivation' },
    solutes: { label: 'Solutes', type: 'text', placeholder: 'FAI, PbI2' },
    solvents: { label: 'Solvents', type: 'text', placeholder: 'DMF, DMSO' },
    concentration: { label: 'Composition / concentration', type: 'text', placeholder: 'optional' },
    additives: { label: 'Additives', type: 'text', placeholder: 'optional' },
    preparation: { label: 'Preparation', type: 'textarea', rows: 3, placeholder: 'Reusable preparation notes' },
    material: { label: 'Material', type: 'text', placeholder: 'glass / ITO / FTO' },
    treatment: { label: 'Treatment', type: 'text', placeholder: 'cleaning / plasma / UV ozone' },
    dimensions: { label: 'Dimensions', type: 'text', placeholder: 'optional' },
    layers: { label: 'Layers', type: 'array', itemType: 'cabinet_layer' },
    coating: { label: 'Coating / deposition', type: 'text', placeholder: 'spin coating / evaporation' },
    annealing: { label: 'Annealing', type: 'text', placeholder: 'qualitative or known recipe' },
    atmosphere: { label: 'Atmosphere', type: 'text', placeholder: 'air / N2 / glovebox' },
    instrumentType: { label: 'Type', type: 'text', placeholder: 'spin coater / evaporator / JV tester' },
    manufacturer: { label: 'Manufacturer', type: 'text', placeholder: 'optional' },
    model: { label: 'Model', type: 'text', placeholder: 'optional' },
    settings: { label: 'Default settings', type: 'text', placeholder: 'optional' },
    serialNumber: { label: 'Serial number', type: 'text', placeholder: 'optional' },
    firmware: { label: 'Firmware', type: 'text', placeholder: 'optional' },
    locationRef: { label: 'Location reference', type: 'text', placeholder: 'Workspace location ID or name' },
    acquisitionSoftwareRefs: { label: 'Acquisition software', type: 'csv', placeholder: 'Software IDs, comma separated' },
    vendor: { label: 'Vendor', type: 'text', placeholder: 'optional' },
    version: { label: 'Version', type: 'text', placeholder: 'optional' },
    instrumentRefs: { label: 'Instrument references', type: 'csv', placeholder: 'Instrument IDs, comma separated' },
    softwareRefs: { label: 'Software references', type: 'csv', placeholder: 'Software IDs, comma separated' },
    outputFormatRefs: { label: 'Output format references', type: 'csv', placeholder: 'File-format IDs, comma separated' },
    parallelCapacity: { label: 'Parallel capacity', type: 'text', placeholder: 'e.g. 8 cells / 4 channels' },
    extensions: { label: 'Extensions', type: 'csv', placeholder: '.txt, .csv' },
    mimeTypes: { label: 'MIME types', type: 'csv', placeholder: 'text/plain' },
    producerSoftwareRef: { label: 'Producer software', type: 'text', placeholder: 'Software ID or name' },
    encoding: { label: 'Encoding', type: 'text', placeholder: 'UTF-8' },
    delimiter: { label: 'Delimiter', type: 'text', placeholder: 'tab / comma / semicolon' },
    documentationRefs: { label: 'Format documentation', type: 'csv', placeholder: 'Document names or references' },
    parserStatus: { label: 'Parser status', type: 'text', placeholder: 'supported / planned / unknown' },
    parserId: { label: 'Parser ID', type: 'text', placeholder: 'optional' },
    parserVersion: { label: 'Parser version', type: 'text', placeholder: 'optional' },
    typicalFileSize: { label: 'Typical file size', type: 'text', placeholder: 'e.g. 250 KB' },
    typicalFilesPerRun: { label: 'Typical files per run', type: 'text', placeholder: 'e.g. 2' }
  });

  const KINDS = Object.freeze({
    material: {
      label: 'Material', plural: 'Materials', group: 'reference', icon: 'package-check',
      description: 'A material you want to reuse by name, formula or supplier reference.',
      fields: ['materialClass', 'formula', 'purity', 'supplier', 'catalogNumber'],
      summary: ['materialClass', 'formula', 'purity'],
      designTargets: ['layer'], directUse: false, requiredFields: [], requiredAny: []
    },
    chemical: {
      label: 'Chemical', plural: 'Chemicals', group: 'reference', icon: 'flask-conical',
      description: 'A reusable solute, solvent, additive or reagent reference.',
      fields: ['chemicalRole', 'formula', 'purity', 'supplier', 'catalogNumber'],
      summary: ['chemicalRole', 'formula', 'purity'],
      designTargets: [], directUse: false, requiredFields: [], requiredAny: []
    },
    solution: {
      label: 'Formulation', plural: 'Formulations', group: 'design', icon: 'flask-conical',
      description: 'A solution or precursor recipe you can apply to another Design.',
      fields: ['role', 'solutes', 'solvents', 'concentration', 'additives', 'preparation'],
      summary: ['solutes', 'solvents', 'concentration'],
      designTargets: ['solution'], directUse: true, requiredFields: [], requiredAny: ['solutes', 'solvents'], requiredAnyMessage: 'Add at least a solute or solvent.'
    },
    substrate: {
      label: 'Substrate', plural: 'Substrates', group: 'design', icon: 'panels-top-left',
      description: 'A substrate and its reusable preparation or treatment.',
      fields: ['material', 'treatment', 'dimensions'],
      summary: ['material', 'treatment'],
      designTargets: ['stack'], directUse: true, requiredFields: ['material'], requiredAny: [], requiredFieldMessages: { material: 'Substrate material is empty.' }
    },
    stack: {
      label: 'Device stack', plural: 'Device stacks', group: 'design', icon: 'panels-top-left',
      description: 'An ordered layer stack you can reuse in another device Design.',
      fields: ['layers'],
      summary: ['layers'],
      designTargets: ['stack'], directUse: true, requiredFields: [], requiredAny: [], validator: 'meaningful_layers'
    },
    protocol: {
      label: 'Process recipe', plural: 'Process recipes', group: 'design', icon: 'notebook-text',
      description: 'A reusable coating, annealing and atmosphere recipe.',
      fields: ['coating', 'annealing', 'atmosphere'],
      summary: ['coating', 'annealing', 'atmosphere'],
      designTargets: ['process'], directUse: true, requiredFields: [], requiredAny: ['coating', 'annealing', 'atmosphere', 'notes'], requiredAnyMessage: 'Add at least one process field.'
    },
    instrument: {
      label: 'Instrument', plural: 'Instruments', group: 'reference', icon: 'settings-2',
      description: 'A reusable instrument or device reference and its usual settings.',
      fields: ['instrumentType', 'manufacturer', 'model', 'serialNumber', 'firmware', 'locationRef', 'acquisitionSoftwareRefs', 'settings'],
      summary: ['manufacturer', 'model', 'instrumentType'],
      designTargets: [], directUse: false, requiredFields: [], requiredAny: []
    },
    software: {
      label: 'Acquisition software', plural: 'Acquisition software', group: 'infrastructure', icon: 'code-2',
      description: 'Software used to control instruments or acquire scientific data.',
      fields: ['vendor', 'version', 'instrumentRefs', 'outputFormatRefs'],
      summary: ['vendor', 'version'],
      designTargets: [], directUse: false, requiredFields: [], requiredAny: []
    },
    setup: {
      label: 'Measurement setup', plural: 'Measurement setups', group: 'infrastructure', icon: 'network',
      description: 'A reusable data-generating setup composed of instruments, software and a location.',
      fields: ['instrumentRefs', 'softwareRefs', 'locationRef', 'parallelCapacity', 'settings'],
      summary: ['parallelCapacity', 'locationRef'],
      designTargets: [], directUse: false, requiredFields: [], requiredAny: ['instrumentRefs', 'softwareRefs'],
      requiredAnyMessage: 'Add at least one instrument or acquisition software reference.'
    },
    file_format: {
      label: 'File format', plural: 'File formats', group: 'infrastructure', icon: 'file-code-2',
      description: 'A reusable output-format profile linking producer software, documentation and parser support.',
      fields: ['extensions', 'mimeTypes', 'producerSoftwareRef', 'instrumentRefs', 'encoding', 'delimiter', 'documentationRefs', 'parserStatus', 'parserId', 'parserVersion', 'typicalFileSize', 'typicalFilesPerRun'],
      summary: ['extensions', 'parserStatus', 'typicalFileSize'],
      designTargets: [], directUse: false, requiredFields: [], requiredAny: ['extensions', 'mimeTypes'],
      requiredAnyMessage: 'Add at least one extension or MIME type.'
    }
  });

  function clean(value) { return String(value == null ? '' : value).trim(); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function now() { return new Date().toISOString(); }

  function base(kind, seed) {
    seed = seed && typeof seed === 'object' ? seed : {};
    return Object.assign({
      id: seed.id || C.uid('cab'),
      kind: kind,
      name: '',
      tags: [],
      notes: '',
      createdAt: seed.createdAt || now(),
      updatedAt: seed.updatedAt || now()
    }, seed, { kind: kind });
  }

  function normalizeLayer(layer) {
    layer = layer && typeof layer === 'object' ? layer : {};
    return {
      id: layer.id || C.uid('cab-layer'),
      role: clean(layer.role || layer.layer),
      material: clean(layer.material || layer.name),
      thickness: clean(layer.thickness),
      process: clean(layer.process)
    };
  }

  function normalize(item) {
    item = item && typeof item === 'object' ? item : {};
    const kind = KINDS[item.kind] ? item.kind : 'material';
    const out = base(kind, item);
    out.name = clean(out.name);
    out.tags = arr(out.tags).map(clean).filter(Boolean);
    out.notes = clean(out.notes);
    out.createdAt = out.createdAt || now();
    out.updatedAt = out.updatedAt || out.createdAt;
    KINDS[kind].fields.forEach(function (field) {
      const def = FIELDS[field] || {};
      if (field === 'layers') out.layers = arr(out.layers).map(normalizeLayer);
      else if (def.type === 'csv') out[field] = Array.from(new Set((Array.isArray(out[field]) ? out[field] : clean(out[field]).split(',')).map(clean).filter(Boolean)));
      else out[field] = clean(out[field]);
    });
    if (kind === 'material' && !out.materialClass) out.materialClass = 'material';
    if (kind === 'chemical' && !out.chemicalRole) out.chemicalRole = 'chemical';
    return out;
  }

  function validate(item) {
    item = normalize(item);
    const issues = [], def = KINDS[item.kind] || {};
    if (!clean(item.name)) issues.push('Name is empty.');
    arr(def.requiredFields).forEach(function (field) {
      if (!clean(item[field])) issues.push(def.requiredFieldMessages && def.requiredFieldMessages[field] ||
        ((FIELDS[field] && FIELDS[field].label || field) + ' is empty.'));
    });
    if (arr(def.requiredAny).length && !def.requiredAny.some(function (field) { return clean(item[field]); })) {
      issues.push(def.requiredAnyMessage || ('Add at least one of: ' + def.requiredAny.map(function (field) {
        return FIELDS[field] && FIELDS[field].label || field;
      }).join(', ') + '.'));
    }
    if (def.validator === 'meaningful_layers' && !arr(item.layers).some(function (layer) {
      return clean(layer.role) || clean(layer.material);
    })) issues.push('Add at least one meaningful layer.');
    return issues;
  }

  function load() {
    const raw = LF.Storage.getCabinetState ? LF.Storage.getCabinetState() : { items: [] };
    return { items: arr(raw && raw.items).map(normalize), updatedAt: raw && raw.updatedAt || null };
  }

  let state = load();

  function persist() {
    state.items = state.items.map(normalize);
    if (state.items.length > LIMITS.maxItems) throw new Error('Lab Cabinet reached its browser limit of ' + LIMITS.maxItems + ' resources. Export or remove unused resources before adding more.');
    const encoded = JSON.stringify({ items: state.items });
    if (encoded.length > LIMITS.maxBackupChars) throw new Error('Lab Cabinet is too large for browser storage. Export the library and remove unused resources.');
    state.updatedAt = now();
    if (!LF.Storage.saveCabinetState || !LF.Storage.saveCabinetState(state)) throw new Error('Lab Cabinet could not be saved in browser storage.');
    return state;
  }

  function all() { return state.items.slice(); }
  function get(id) { return state.items.find(function (item) { return String(item.id) === String(id); }) || null; }

  function searchable(item) {
    const def = KINDS[item.kind] || { fields: [] };
    const values = [item.id, item.kind, item.name, item.tags, item.notes];
    def.fields.forEach(function (field) { values.push(item[field]); });
    return JSON.stringify(values).toLowerCase();
  }

  function score(item, query) {
    const q = clean(query).toLowerCase().slice(0, 6000);
    if (!q) return 1;
    const terms = Array.from(new Set(q.split(/[^a-z0-9à-ž_.+\-]+/i).filter(function (term) { return term.length > 1; }))).slice(0, 64);
    const title = clean(item.name).toLowerCase();
    const tags = arr(item.tags).map(function (tag) { return clean(tag).toLowerCase(); });
    const haystack = searchable(item);
    let value = title === q ? 30 : title.indexOf(q) >= 0 ? 16 : 0;
    terms.forEach(function (term) {
      if (title === term) value += 10;
      else if (title.indexOf(term) >= 0) value += 6;
      if (tags.includes(term)) value += 5;
      if (haystack.indexOf(term) >= 0) value += 1;
    });
    return value;
  }

  function search(query, options) {
    options = options || {};
    const kinds = Array.isArray(options.kinds) ? options.kinds : (options.kind && options.kind !== 'all' ? [options.kind] : []);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 100));
    const forAI = !!options.forAI;
    return all().map(function (item) { return { item: item, score: score(item, query) }; }).filter(function (entry) {
      if (kinds.length && !kinds.includes(entry.item.kind)) return false;
      if (forAI && validate(entry.item).length) return false;
      return !clean(query) || entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score || String(b.item.updatedAt || '').localeCompare(String(a.item.updatedAt || '')) || String(a.item.name).localeCompare(String(b.item.name));
    }).slice(0, limit).map(function (entry) { return entry.item; });
  }

  function list(kind, query) { return search(query, { kind: kind || 'all', limit: LIMITS.maxItems }); }

  function create(kind, seed) {
    if (!KINDS[kind]) throw new Error('Unknown Cabinet kind: ' + kind);
    const item = normalize(Object.assign({}, seed || {}, { kind: kind, id: C.uid('cab'), createdAt: now(), updatedAt: now() }));
    if (!item.name) item.name = 'New ' + KINDS[kind].label.toLowerCase();
    state.items.unshift(item);
    persist();
    if (Log) Log.info('item.created', { id: item.id, kind: item.kind, name: item.name });
    return item;
  }

  function update(id, patch) {
    const item = get(id);
    if (!item) throw new Error('Cabinet item not found.');
    Object.assign(item, clone(patch || {}), { updatedAt: now() });
    const normalized = normalize(item), index = state.items.indexOf(item);
    state.items[index] = normalized;
    persist();
    return normalized;
  }

  function remove(id) {
    const index = state.items.findIndex(function (item) { return String(item.id) === String(id); });
    if (index < 0) return false;
    const item = state.items.splice(index, 1)[0];
    persist();
    if (Log) Log.info('item.removed', { id: item.id, kind: item.kind });
    return true;
  }

  function duplicate(id) {
    const item = get(id);
    if (!item) throw new Error('Cabinet item not found.');
    const copy = clone(item);
    delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    copy.name = (item.name || KINDS[item.kind].label) + ' copy';
    return create(item.kind, copy);
  }

  function sourceRef(item) {
    return { type: 'cabinet_snapshot', cabinetId: item.id, cabinetKind: item.kind, cabinetName: item.name, capturedAt: now() };
  }

  function snapshot(id) {
    const item = typeof id === 'object' ? normalize(id) : get(id);
    return item ? { source: sourceRef(item), item: clone(item) } : null;
  }

  function signatureSolution(value) {
    value = value || {};
    return [value.role, value.solutes, value.solvents, value.concentration, value.additives].map(function (part) { return clean(part).toLowerCase(); }).join('|');
  }

  function solutionMeaningful(value) { return !!(value && [value.solutes, value.solvents].some(function (part) { return clean(part); })); }
  function processMeaningful(value) { return !!(value && [value.coating, value.annealing, value.atmosphere, value.notes].some(function (part) { return clean(part); })); }

    // Cabinet never owns Design mutation; reuse crosses the DesignModel boundary.
  function designModel() {
    if (!LF.DesignModel) throw new Error('LabFlow.DesignModel must be loaded before Cabinet resources can be applied to Design.');
    return LF.DesignModel;
  }

  function provenance(item, ref) {
    return { evidence: 'Lab Cabinet snapshot · ' + item.name, status: 'user_confirmed', confidence: 1, provenanceKind: 'cabinet_snapshot', sourceRef: ref };
  }

  function applyToDesign(exp, deviceId, itemId, options) {
    options = options || {};
    const item = get(itemId), DM = designModel();
    if (!item) throw new Error('Cabinet item not found.');
    const device = DM.device(exp, deviceId);
    if (!device) throw new Error('Design experiment not found.');
    const issues = validate(item);
    if (issues.length) throw new Error('Cabinet resource is incomplete: ' + issues.join(' '));
    const ref = sourceRef(item), meta = provenance(item, ref);
    let changed = 0;

    if (item.kind === 'solution') {
      if (!solutionMeaningful(item)) throw new Error('Cabinet solution needs a solute or solvent before it can be used in Design.');
      const signature = signatureSolution(item);
      let solution = DM.solutions(exp).find(function (candidate) {
        return candidate.cabinetRef && String(candidate.cabinetRef.cabinetId) === String(item.id) || (solutionMeaningful(candidate) && signatureSolution(candidate) === signature);
      });
      if (!solution) {
        solution = DM.createSolution(exp, {
          name: item.name, role: item.role, solutes: item.solutes, solvents: item.solvents,
          concentration: item.concentration, additives: item.additives, preparation: item.preparation,
          evidence: meta.evidence, status: meta.status, confidence: meta.confidence,
          provenanceKind: meta.provenanceKind, cabinetRef: ref
        }, deviceId);
        changed += 2; // The change count includes both the created solution and its explicit device link.
      } else if (!(device.solutionIds || []).includes(solution.id)) {
        DM.setDeviceSolutionLinked(exp, deviceId, solution.id, true);
        changed++;
      }
    } else if (item.kind === 'stack') {
      if (options.replace !== false || !(device.stack || []).length) {
        DM.replaceDeviceStack(exp, deviceId, item.layers, meta);
        changed += item.layers.length || 1;
      }
    } else if (item.kind === 'protocol') {
      const result = DM.mergeDeviceProcess(exp, deviceId, item, {
        replace: !!options.replaceProcess,
        evidence: meta.evidence,
        status: meta.status,
        provenanceKind: meta.provenanceKind,
        sourceRef: ref
      });
      changed += result.changed;
    } else if (item.kind === 'substrate') {
      const seed = { role: 'Substrate', material: item.material || item.name, process: item.treatment || '' };
      if (options.replaceSubstrate && (device.stack || []).length) DM.replaceDeviceLayer(exp, deviceId, 0, seed, meta);
      else DM.insertDeviceLayer(exp, deviceId, 0, seed, meta);
      changed++;
    } else if (item.kind === 'material') {
      const index = Number(options.layerIndex);
      if (!Number.isInteger(index) || !device.stack || !device.stack[index]) throw new Error('Choose a target stack layer before applying a material.');
      const next = item.name || item.formula;
      if (device.stack[index].material !== next || !device.stack[index].cabinetRef) {
        DM.replaceDeviceLayer(exp, deviceId, index, { material: next }, meta);
        changed++;
      }
    } else {
      throw new Error('This Cabinet item is not directly applicable to Design.');
    }

    if (changed) DM.markCabinetAssisted(exp, deviceId, ref);
    return { changed: changed, item: item, device: DM.device(exp, deviceId) };
  }

  function saveDesignSolution(exp, solutionId) {
    const solution = designModel().solution(exp, solutionId);
    if (!solution) throw new Error('Design solution not found.');
    if (!solutionMeaningful(solution)) throw new Error('Add a solute or solvent before saving this solution to Lab Cabinet.');
    return create('solution', {
      name: solution.name || 'Saved formulation', role: solution.role, solutes: solution.solutes,
      solvents: solution.solvents, concentration: solution.concentration, additives: solution.additives,
      preparation: solution.preparation, tags: ['from-design'], notes: 'Saved from LabFlow Design.'
    });
  }

  function saveDesignStack(exp, deviceId) {
    const device = designModel().device(exp, deviceId);
    if (!device) throw new Error('Design experiment not found.');
    if (!(device.stack || []).some(function (layer) { return clean(layer && layer.role) || clean(layer && layer.material); })) throw new Error('The selected experiment has no meaningful stack to save.');
    return create('stack', {
      name: (device.name || 'Experiment') + ' stack',
      layers: (device.stack || []).map(function (layer) { return { role: layer.role, material: layer.material, thickness: layer.thickness, process: layer.process }; }),
      tags: ['from-design'], notes: 'Saved from LabFlow Design.'
    });
  }

  function saveDesignProtocol(exp, deviceId) {
    const device = designModel().device(exp, deviceId);
    if (!device) throw new Error('Design experiment not found.');
    const process = device.process || {};
    if (!processMeaningful(process)) throw new Error('The selected experiment has no process information to save.');
    return create('protocol', {
      name: (device.name || 'Experiment') + ' process', coating: process.coating,
      annealing: process.annealing, atmosphere: process.atmosphere, notes: process.notes,
      tags: ['from-design']
    });
  }

  function matchProposal(proposal) {
    proposal = proposal && typeof proposal === 'object' ? proposal : {};
    const matches = [], cabinetSolutions = search('', { kind: 'solution', forAI: true }),
      cabinetStacks = search('', { kind: 'stack', forAI: true }), cabinetProtocols = search('', { kind: 'protocol', forAI: true });
    (proposal.solutions || []).forEach(function (solution, index) {
      if (!solutionMeaningful(solution)) return;
      const signature = signatureSolution(solution), name = clean(solution.name).toLowerCase();
      const item = cabinetSolutions.find(function (candidate) {
        return solutionMeaningful(candidate) && ((name && clean(candidate.name).toLowerCase() === name) || signatureSolution(candidate) === signature);
      });
      if (item) matches.push({ part: 'solution', proposalIndex: index, cabinetId: item.id, kind: item.kind, name: item.name });
    });
    const device = proposal.devices && proposal.devices[0] || {}, stack = device.stack || proposal.stack || [];
    const stackSignature = arr(stack).map(function (layer) { return clean(layer.material || layer.name).toLowerCase(); }).filter(Boolean).join('/');
    if (stackSignature) {
      const item = cabinetStacks.find(function (candidate) {
        return arr(candidate.layers).map(function (layer) { return clean(layer.material || layer.name).toLowerCase(); }).filter(Boolean).join('/') === stackSignature;
      });
      if (item) matches.push({ part: 'stack', proposalIndex: 0, cabinetId: item.id, kind: item.kind, name: item.name });
    }
    const process = device.process || proposal.process || {};
    if (processMeaningful(process)) {
      const processSignature = [process.coating, process.annealing, process.atmosphere].map(function (part) { return clean(part).toLowerCase(); }).join('|');
      const item = cabinetProtocols.find(function (candidate) {
        return [candidate.coating, candidate.annealing, candidate.atmosphere].map(function (part) { return clean(part).toLowerCase(); }).join('|') === processSignature;
      });
      if (item) matches.push({ part: 'process', proposalIndex: 0, cabinetId: item.id, kind: item.kind, name: item.name });
    }
    return matches;
  }

  function compactItem(item) {
    const out = { id: item.id, kind: item.kind, name: item.name, tags: item.tags };
    (KINDS[item.kind].fields || []).forEach(function (field) {
      if (field === 'layers') out.layers = item.layers.map(function (layer) { return { role: layer.role, material: layer.material, thickness: layer.thickness, process: layer.process }; });
      else if (item[field]) out[field] = item[field];
    });
    return out;
  }

  function compactForAI(kind, limit, query) {
    return search(query || '', { kind: kind || 'all', limit: Math.max(1, Number(limit) || 16), forAI: true }).map(compactItem);
  }

  function context(query, options) {
    options = options || {};
    const items = search(query || '', {
      kinds: options.kinds,
      kind: options.kind,
      limit: Math.max(1, Math.min(24, Number(options.limit) || 8)),
      forAI: true
    }).map(compactItem);
    return {
      items: items,
      note: 'Workspace reusable resources only. Cabinet entries are researcher-curated reusable snapshots, not evidence that the current experiment used them.',
      use_contract: 'Prefer exact compatible reuse. Otherwise treat Cabinet entries as optional context and keep any model-derived adaptation review-only.'
    };
  }

  function usage(exp, itemId) {
    const id = String(itemId || ''), out = { solutions: 0, layers: 0, stacks: 0, processes: 0, total: 0, experiments: [] }, used = new Set();
    if (!exp || !exp.design) return out;
    const DM = LF.DesignModel;
    const solutions = DM ? DM.solutions(exp) : (exp.design.solutions || []);
    const devices = DM ? DM.devices(exp) : (exp.design.devices || []);
    solutions.forEach(function (solution) { if (solution.cabinetRef && String(solution.cabinetRef.cabinetId) === id) out.solutions++; });
    devices.forEach(function (device) {
      let count = 0;
      if (device.stackSourceRef && String(device.stackSourceRef.cabinetId) === id) { out.stacks++; count++; }
      if (device.processSourceRef && String(device.processSourceRef.cabinetId) === id) { out.processes++; count++; }
      (device.stack || []).forEach(function (layer) { if (layer.cabinetRef && String(layer.cabinetRef.cabinetId) === id) { out.layers++; count++; } });
      (device.solutionIds || []).forEach(function (solutionId) {
        const solution = solutions.find(function (candidate) { return String(candidate.id) === String(solutionId); });
        if (solution && solution.cabinetRef && String(solution.cabinetRef.cabinetId) === id) count++;
      });
      if (count) used.add(device.id);
    });
    out.total = out.solutions + out.layers + out.stacks + out.processes;
    out.experiments = Array.from(used);
    return out;
  }

  function exportState() { return { kind: 'labflow_cabinet', exportedAt: now(), items: all().map(clone) }; }

  function validateImportPayload(parsed, rawChars) {
    if (rawChars > LIMITS.maxBackupChars) throw new Error('Cabinet JSON is too large for the browser (limit ' + Math.round(LIMITS.maxBackupChars / 1024 / 1024) + ' MB).');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Cabinet JSON is invalid.');
    const items = arr(parsed.items);
    if (!items.length) throw new Error('Cabinet JSON contains no resources.');
    if (items.length > LIMITS.maxItems) throw new Error('Cabinet JSON contains more than ' + LIMITS.maxItems + ' resources.');
    const seen = new Set();
    items.forEach(function (item, index) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Cabinet item ' + (index + 1) + ' must be an object.');
      const id = clean(item.id);
      if (id) { if (seen.has(id)) throw new Error('Cabinet JSON contains duplicate id "' + id + '".'); seen.add(id); }
      if (!KINDS[item.kind]) throw new Error('Cabinet item ' + (index + 1) + ' has an unknown kind.');
      if (clean(item.name).length > LIMITS.maxName) throw new Error('Cabinet item ' + (index + 1) + ' name is too long.');
      if (clean(item.notes).length > LIMITS.maxNotes) throw new Error('Cabinet item ' + (index + 1) + ' notes are too long.');
      const tags = arr(item.tags);
      if (tags.length > LIMITS.maxTags) throw new Error('Cabinet item ' + (index + 1) + ' has too many tags.');
      tags.forEach(function (tag) { if (clean(tag).length > LIMITS.maxTag) throw new Error('Cabinet item ' + (index + 1) + ' contains an oversized tag.'); });
      const layers = arr(item.layers);
      if (layers.length > LIMITS.maxLayers) throw new Error('Cabinet item ' + (index + 1) + ' has too many stack layers.');
      Object.keys(item).forEach(function (key) { if (typeof item[key] === 'string' && key !== 'notes' && clean(item[key]).length > LIMITS.maxField) throw new Error('Cabinet item ' + (index + 1) + ' field "' + key + '" is too long.'); });
      layers.forEach(function (layer) {
        if (!layer || typeof layer !== 'object' || Array.isArray(layer)) throw new Error('Cabinet item ' + (index + 1) + ' contains an invalid stack layer.');
        Object.keys(layer).forEach(function (key) { if (typeof layer[key] === 'string' && clean(layer[key]).length > LIMITS.maxField) throw new Error('Cabinet item ' + (index + 1) + ' contains an oversized layer field.'); });
      });
    });
    return items;
  }

  function importState(payload, mode) {
    let parsed = payload, rawChars = 0;
    if (typeof payload === 'string') {
      rawChars = payload.length;
      if (rawChars > LIMITS.maxBackupChars) throw new Error('Cabinet JSON is too large for the browser.');
      try { parsed = JSON.parse(payload); } catch (_error) { throw new Error('Cabinet JSON is invalid.'); }
    } else {
      try { rawChars = JSON.stringify(payload || {}).length; } catch (_error) { throw new Error('Cabinet JSON is invalid.'); }
    }
    const incoming = validateImportPayload(parsed, rawChars).map(normalize), next = mode === 'replace' ? [] : state.items.map(clone);
    mode = mode === 'replace' ? 'replace' : 'merge';
    const byId = new Map(next.map(function (item) { return [String(item.id), item]; }));
    incoming.forEach(function (item) {
      if (byId.has(String(item.id))) {
        const copy = clone(item); copy.id = C.uid('cab'); copy.name = (copy.name || KINDS[copy.kind].label) + ' imported'; next.push(normalize(copy));
      } else { next.push(item); byId.set(String(item.id), item); }
    });
    if (next.length > LIMITS.maxItems) throw new Error('Import would exceed the Lab Cabinet limit of ' + LIMITS.maxItems + ' resources.');
    const previous = state;
    state = { items: next, updatedAt: previous.updatedAt };
    try { persist(); } catch (error) { state = previous; throw error; }
    return { mode: mode, imported: incoming.length, total: state.items.length };
  }

  function reset(next) {
    state = { items: arr(next && next.items).map(normalize), updatedAt: next && next.updatedAt || null };
    persist();
    return state;
  }

  function registerStructures() {
    if (!LF.Structures) return;
    LF.Structures.defineFromExample('cabinet.layer', {
      owner: 'Cabinet', layer: 'workspace_reference', persistence: 'browser_local',
      description: 'One reusable layer definition inside a Cabinet stack.'
    }, normalizeLayer({ id: 'cab-layer-contract' }), { required: ['id', 'role', 'material'] });
    Object.keys(KINDS).forEach(function (kind) {
      const example = normalize({ id: 'cab-contract-' + kind, kind: kind, name: KINDS[kind].label });
      LF.Structures.defineFromExample('cabinet.item.' + kind, {
        owner: 'Cabinet', layer: 'workspace_reference', persistence: 'browser_local',
        description: KINDS[kind].description,
        variants: KINDS[kind].designTargets.slice()
      }, example, { required: ['id', 'kind', 'name', 'createdAt', 'updatedAt'] });
    });
    LF.Structures.defineFromExample('cabinet.state', {
      owner: 'Cabinet', layer: 'workspace_reference', persistence: 'browser_local',
      description: 'Browser-local reusable laboratory resource library.'
    }, { items: [], updatedAt: null }, { required: ['items'] });
    LF.Structures.defineFromExample('cabinet.context', {
      owner: 'Cabinet', layer: 'ai_context', persistence: 'runtime',
      description: 'Bounded Cabinet resources supplied to an AI context pack.'
    }, { items: [], note: '', use_contract: '' }, { required: ['items', 'note'] });
  }

  LF.Cabinet = {
    limits: function () { return clone(LIMITS); },
    kinds: function () { return clone(KINDS); },
    fields: function (kind) {
      const def = KINDS[kind];
      return def ? def.fields.map(function (name) { return Object.assign({ name: name }, clone(FIELDS[name] || { label: name, type: 'text' })); }) : [];
    },
    summaryFields: function (kind) { return KINDS[kind] ? KINDS[kind].summary.slice() : []; },
    all: all, list: list, search: search, get: get, create: create, update: update, remove: remove,
    duplicate: duplicate, validate: validate, normalize: normalize, snapshot: snapshot,
    applyToDesign: applyToDesign, saveDesignSolution: saveDesignSolution, saveDesignStack: saveDesignStack,
    saveDesignProtocol: saveDesignProtocol, matchProposal: matchProposal, compactForAI: compactForAI,
    context: context, usage: usage, exportState: exportState, importState: importState, reset: reset
  };

  registerStructures();
  if (Log) Log.info('ready', { items: state.items.length, kinds: Object.keys(KINDS) });
}());
