/*
 * Scientific workspace profile: institution, responsibilities, locations, acquisition context and Process definitions.
 * Boundary: Workspace describes the data-generating environment. ExperimentData remains the authoritative record of one experiment.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Core || !LF.Storage) throw new Error('workspace.js requires LabFlow.Core and LabFlow.Storage.');
  const C = LF.Core;
  const Log = LF.Logger ? LF.Logger.scope('workspace-profile') : null;
  const WORKSPACE_SCHEMA_VERSION = 1;
  const EXPERIMENT_SCHEMA_VERSION = 2;

  function now() { return new Date().toISOString(); }
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function obj(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function finiteOrNull(value) {
    if (value == null || clean(value) === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function stringList(value) {
    if (Array.isArray(value)) return Array.from(new Set(value.map(clean).filter(Boolean)));
    return Array.from(new Set(clean(value).split(/[\n,;]/).map(clean).filter(Boolean)));
  }
  function ensureId(value, prefix) { return clean(value) || C.uid(prefix); }

  function normalizeContact(value) {
    value = obj(value);
    return {
      id: ensureId(value.id, 'contact'),
      role: clean(value.role || 'other').toLowerCase().replace(/\s+/g, '_'),
      name: clean(value.name),
      email: clean(value.email),
      institution: clean(value.institution),
      notes: clean(value.notes)
    };
  }

  function normalizeLocation(value) {
    value = obj(value);
    return {
      id: ensureId(value.id, 'location'),
      name: clean(value.name),
      institution: clean(value.institution),
      site: clean(value.site),
      building: clean(value.building),
      laboratory: clean(value.laboratory),
      room: clean(value.room),
      notes: clean(value.notes)
    };
  }

  function normalizeStorage(value) {
    value = obj(value);
    const allowed = ['local_machine', 'network_share', 'institutional_storage', 'cloud', 'eln', 'repository', 'other'];
    const type = allowed.includes(clean(value.type)) ? clean(value.type) : 'other';
    return {
      id: ensureId(value.id, 'storage'),
      name: clean(value.name),
      type: type,
      locationHint: clean(value.locationHint),
      institution: clean(value.institution),
      backupPolicy: clean(value.backupPolicy),
      retentionPolicy: clean(value.retentionPolicy),
      notes: clean(value.notes)
    };
  }

  function normalizeQuantity(value, fallbackRole) {
    value = obj(value);
    const role = clean(value.role || fallbackRole || 'observable');
    return {
      id: ensureId(value.id || value.name, 'quantity').toLowerCase().replace(/[^a-z0-9_.-]+/g, '_'),
      name: clean(value.name || value.symbol || value.id),
      symbol: clean(value.symbol),
      description: clean(value.description),
      role: role,
      dataType: clean(value.dataType || 'number'),
      unit: clean(value.unit),
      allowedValues: stringList(value.allowedValues),
      range: obj(value.range),
      required: !!value.required,
      provenance: clean(value.provenance)
    };
  }

  function normalizeLinkage(value) {
    value = obj(value);
    const allowed = ['filename', 'directory', 'embedded_metadata', 'external_log', 'manual', 'hybrid', 'unknown'];
    const method = allowed.includes(clean(value.method)) ? clean(value.method) : 'unknown';
    return {
      method: method,
      rule: clean(value.rule),
      sourceField: clean(value.sourceField),
      evidencePaths: stringList(value.evidencePaths),
      confidence: finiteOrNull(value.confidence)
    };
  }

  function normalizeProcess(value) {
    value = obj(value);
    const kindAllowed = ['measurement', 'characterization', 'simulation', 'fabrication', 'other'];
    const kind = kindAllowed.includes(clean(value.kind)) ? clean(value.kind) : 'measurement';
    const metadataPolicy = obj(value.metadataPolicy);
    return {
      id: ensureId(value.id, 'process'),
      name: clean(value.name),
      kind: kind,
      description: clean(value.description),
      sampleTypes: stringList(value.sampleTypes),
      locationIds: stringList(value.locationIds),
      instrumentIds: stringList(value.instrumentIds),
      softwareIds: stringList(value.softwareIds),
      setupIds: stringList(value.setupIds),
      outputFormatIds: stringList(value.outputFormatIds),
      variables: arr(value.variables).map(function (item) { return normalizeQuantity(item, 'controlled_variable'); }),
      observables: arr(value.observables).map(function (item) { return normalizeQuantity(item, 'observable'); }),
      typicalFrequency: clean(value.typicalFrequency),
      typicalOutputSize: clean(value.typicalOutputSize),
      parallelCapacity: finiteOrNull(value.parallelCapacity),
      storageProfileIds: stringList(value.storageProfileIds),
      metadataPolicy: {
        metadataLocation: clean(metadataPolicy.metadataLocation),
        sampleLinkage: normalizeLinkage(metadataPolicy.sampleLinkage)
      },
      notes: clean(value.notes),
      createdAt: value.createdAt || now(),
      updatedAt: value.updatedAt || value.createdAt || now()
    };
  }

  function defaults(seed) {
    seed = obj(seed);
    const createdAt = seed.createdAt || now();
    return {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      id: ensureId(seed.id, 'workspace'),
      name: clean(seed.name || 'My laboratory workspace'),
      institution: clean(seed.institution),
      description: clean(seed.description),
      contacts: [],
      locations: [],
      storageProfiles: [],
      processes: [],
      createdAt: createdAt,
      updatedAt: seed.updatedAt || createdAt
    };
  }

  function normalize(value) {
    value = obj(value);
    const out = Object.assign(defaults(value), value);
    out.schemaVersion = WORKSPACE_SCHEMA_VERSION;
    out.id = ensureId(out.id, 'workspace');
    out.name = clean(out.name || 'My laboratory workspace');
    out.institution = clean(out.institution);
    out.description = clean(out.description);
    out.contacts = arr(out.contacts).map(normalizeContact);
    out.locations = arr(out.locations).map(normalizeLocation);
    out.storageProfiles = arr(out.storageProfiles).map(normalizeStorage);
    out.processes = arr(out.processes).map(normalizeProcess);
    out.createdAt = out.createdAt || now();
    out.updatedAt = out.updatedAt || out.createdAt;
    return out;
  }

  function rawStored() { return LF.Storage.getWorkspaceProfileState ? LF.Storage.getWorkspaceProfileState() : {}; }
  let profile = normalize(rawStored());

  function persist(next) {
    profile = normalize(next);
    profile.updatedAt = now();
    if (!LF.Storage.saveWorkspaceProfileState || !LF.Storage.saveWorkspaceProfileState(profile)) {
      throw new Error('Scientific Workspace profile could not be saved in browser storage.');
    }
    if (LF.State && LF.State.state) LF.State.state.workspace = clone(profile);
    return current();
  }

  function current() { return clone(profile); }
  function save(value) { return persist(Object.assign({}, profile, clone(value || {}))); }
  function reset(value) { return persist(normalize(value || {})); }
  function process(id) { return profile.processes.find(function (item) { return String(item.id) === String(id); }) || null; }

  function addProcess(seed) {
    const next = clone(profile), item = normalizeProcess(seed || {});
    if (!item.name) item.name = 'New scientific process';
    next.processes.push(item);
    persist(next);
    return clone(item);
  }

  function updateProcess(id, patch) {
    const next = clone(profile), index = next.processes.findIndex(function (item) { return String(item.id) === String(id); });
    if (index < 0) throw new Error('Workspace Process not found.');
    next.processes[index] = normalizeProcess(Object.assign({}, next.processes[index], clone(patch || {}), { updatedAt: now() }));
    persist(next);
    return clone(next.processes[index]);
  }

  function removeProcess(id) {
    const next = clone(profile), before = next.processes.length;
    next.processes = next.processes.filter(function (item) { return String(item.id) !== String(id); });
    if (next.processes.length === before) return false;
    persist(next);
    return true;
  }

  function setRoleContact(role, value) {
    role = clean(role).toLowerCase().replace(/\s+/g, '_');
    const next = clone(profile), index = next.contacts.findIndex(function (item) { return item.role === role; });
    const incoming = normalizeContact(Object.assign({}, index >= 0 ? next.contacts[index] : {}, value || {}, { role: role }));
    if (!incoming.name && !incoming.email && !incoming.notes) {
      if (index >= 0) next.contacts.splice(index, 1);
    } else if (index >= 0) next.contacts[index] = incoming;
    else next.contacts.push(incoming);
    return persist(next);
  }

  function roleContact(role) {
    const item = profile.contacts.find(function (contact) { return contact.role === role; });
    return item ? clone(item) : null;
  }

  function setLocationsFromNames(names) {
    const values = stringList(names), byName = new Map(profile.locations.map(function (item) { return [item.name.toLowerCase(), item]; }));
    const next = clone(profile);
    next.locations = values.map(function (name) {
      const existing = byName.get(name.toLowerCase());
      return normalizeLocation(existing ? existing : { name: name, institution: profile.institution });
    });
    return persist(next);
  }

  function setPrimaryStorage(seed) {
    const next = clone(profile);
    const existing = next.storageProfiles[0] || {};
    const storage = normalizeStorage(Object.assign({}, existing, seed || {}));
    if (!storage.name) storage.name = 'Primary laboratory storage';
    next.storageProfiles = [storage].concat(next.storageProfiles.slice(1));
    return persist(next);
  }

  function bindExperiment(exp, processId) {
    if (!exp || typeof exp !== 'object') return exp;
    exp.meta = exp.meta && typeof exp.meta === 'object' ? exp.meta : {};
    exp.meta.schemaVersion = Math.max(EXPERIMENT_SCHEMA_VERSION, Number(exp.meta.schemaVersion) || 0);
    if (!exp.meta.workspaceId) exp.meta.workspaceId = profile.id;
    if (!exp.meta.processId) {
      const selected = process(processId) || profile.processes[0] || null;
      if (selected) exp.meta.processId = selected.id;
    }
    return exp;
  }

  function snapshot(options) {
    options = options || {};
    const out = current();
    if (options.includeContacts !== true) {
      out.contacts = out.contacts.map(function (contact) {
        return { id: contact.id, role: contact.role, institution: contact.institution, notes: contact.notes };
      });
    }
    return out;
  }

  function readyPvSummary() {
    const w = current(), responsible = roleContact('data_responsible') || {}, parser = roleContact('parser_contact') || {}, contributor = roleContact('plugin_contributor') || {};
    return {
      contact: {
        institution: w.institution,
        dataResponsible: responsible,
        parserContact: parser,
        pluginContributor: contributor
      },
      processes: w.processes.map(function (item) {
        return {
          id: item.id, name: item.name, kind: item.kind, description: item.description,
          variables: item.variables, observables: item.observables, sampleTypes: item.sampleTypes,
          testLocations: item.locationIds, typicalFrequency: item.typicalFrequency,
          typicalOutputSize: item.typicalOutputSize, parallelCapacity: item.parallelCapacity,
          instruments: item.instrumentIds, acquisitionSoftware: item.softwareIds,
          outputFormats: item.outputFormatIds, storageProfiles: item.storageProfileIds,
          metadataPolicy: item.metadataPolicy
        };
      }),
      locations: w.locations,
      storageProfiles: w.storageProfiles
    };
  }

  function parseQuantityLines(text, role) {
    return clean(text).split(/\r?\n/).map(clean).filter(Boolean).map(function (line) {
      const parts = line.split('|').map(clean);
      return normalizeQuantity({ name: parts[0], unit: parts[1] || '', description: parts.slice(2).join(' | '), role: role }, role);
    });
  }

  function quantityLines(values) {
    return arr(values).map(function (item) {
      return [clean(item.name), clean(item.unit), clean(item.description)].filter(function (value, index) { return index < 2 || value; }).join(' | ');
    }).join('\n');
  }

  if (LF.Structures) {
    LF.Structures.defineFromExample('workspace.contact', {
      owner: 'Workspace', layer: 'workspace_context', persistence: 'browser_local',
      description: 'A role-based laboratory contact. Contact details are not scientific measurement evidence.'
    }, normalizeContact({ id: 'contact-contract', role: 'data_responsible' }), { required: ['id', 'role'] });
    LF.Structures.defineFromExample('workspace.location', {
      owner: 'Workspace', layer: 'workspace_context', persistence: 'browser_local',
      description: 'Reusable laboratory/test location referenced by Processes and infrastructure resources.'
    }, normalizeLocation({ id: 'location-contract' }), { required: ['id', 'name'] });
    LF.Structures.defineFromExample('workspace.storage-profile', {
      owner: 'Workspace', layer: 'workspace_context', persistence: 'browser_local',
      description: 'Descriptor for normal laboratory data storage. Credentials are never stored here.'
    }, normalizeStorage({ id: 'storage-contract' }), { required: ['id', 'type'] });
    LF.Structures.defineFromExample('workspace.quantity-definition', {
      owner: 'Workspace', layer: 'scientific_definition', persistence: 'browser_local',
      description: 'Definition of a controlled variable, condition, observable or derived observable.'
    }, normalizeQuantity({ id: 'quantity-contract', name: 'Quantity' }, 'observable'), { required: ['id', 'name', 'role'] });
    LF.Structures.defineFromExample('workspace.process', {
      owner: 'Workspace', layer: 'scientific_definition', persistence: 'browser_local',
      description: 'Reusable scientific data-generating Process definition, distinct from per-device fabrication Design.'
    }, normalizeProcess({ id: 'process-contract', name: 'Process' }), { required: ['id', 'name', 'kind', 'variables', 'observables'] });
    LF.Structures.defineFromExample('workspace.profile', {
      owner: 'Workspace', layer: 'workspace_context', persistence: 'browser_local',
      description: 'Scientific Workspace definition for institution, responsibilities, locations, storage and Processes.'
    }, normalize({ id: 'workspace-contract', name: 'Workspace' }), { required: ['schemaVersion', 'id', 'name', 'contacts', 'locations', 'storageProfiles', 'processes'] });
  }

  LF.Workspace = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    experimentSchemaVersion: EXPERIMENT_SCHEMA_VERSION,
    current: current, save: save, reset: reset, normalize: normalize,
    process: process, addProcess: addProcess, updateProcess: updateProcess, removeProcess: removeProcess,
    roleContact: roleContact, setRoleContact: setRoleContact, setLocationsFromNames: setLocationsFromNames,
    setPrimaryStorage: setPrimaryStorage, bindExperiment: bindExperiment, snapshot: snapshot,
    readyPvSummary: readyPvSummary, parseQuantityLines: parseQuantityLines, quantityLines: quantityLines
  };

  if (LF.State && LF.State.state) LF.State.state.workspace = current();
  if (!rawStored().id) {
    try { persist(profile); } catch (error) { if (Log) Log.warn('initial-save-failed', { error: error }); }
  }
  if (Log) Log.info('ready', { id: profile.id, institution: profile.institution, processes: profile.processes.length });
}());
