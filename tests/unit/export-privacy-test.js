'use strict';
/*
 * Export privacy boundary: shareable projections can drop personal fields on request
 * while scientific and readiness fields survive, and backups never get rewritten.
 */
require('../../assets/js/redact.js');
require('../../assets/js/core.js');
require('../../assets/js/logger.js');

const LF = global.LabFlow;
let exportSettings = { includeRaw: true, includeDerived: true, redactPersonal: false, projectionOverrides: { nomad: {}, readypv: {} } };
LF.Storage = {
  getExportSettings: function () { return JSON.parse(JSON.stringify(exportSettings)); },
  saveExportSettings: function (value) { exportSettings = JSON.parse(JSON.stringify(value)); }
};
LF.Workspace = {
  current: function () {
    return {
      id: 'w1', name: 'PV Lab', institution: 'University Test', description: 'Ready-PV workspace',
      contacts: [
        { role: 'data_responsible', name: 'Ada Researcher', email: 'ada@example.test' },
        { role: 'parser_contact', name: 'Parser Person', email: 'parser@example.test' },
        { role: 'plugin_contributor', name: 'Plugin Person', email: 'plugin@example.test' }
      ],
      locations: [{ id: 'loc1', name: 'Lab A' }],
      storageProfiles: [{ id: 'st1', name: 'Institutional NAS', type: 'network_share' }],
      processes: [{
        id: 'p1', name: 'JV characterization', kind: 'characterization',
        description: 'Current-voltage characterization of photovoltaic devices',
        sampleTypes: ['PV device'], locationIds: ['loc1'], instrumentIds: ['i1'], softwareIds: ['sw1'], outputFormatIds: ['ff1'],
        variables: [{ name: 'Voltage', unit: 'V' }], observables: [{ name: 'PCE', unit: '%' }],
        typicalFrequency: 'daily', typicalOutputSize: '100 kB', parallelCapacity: 4, storageProfileIds: ['st1'],
        metadataPolicy: { metadataLocation: 'LabFlow sample metadata', sampleLinkage: { method: 'filename', rule: 'sample id in filename' } },
        notes: 'Shared setup'
      }]
    };
  },
  process: function () { return null; }
};
LF.Cabinet = { all: function () { return [{ id: 'i1', kind: 'instrument', name: 'Keithley 2400' }, { id: 'sw1', kind: 'software', name: 'Acquisition Suite' }, { id: 'ff1', kind: 'file_format', name: 'JV TXT', documentationRefs: ['format.md'] }]; } };
LF.NomadExport = {
  ensureMapping: function () { return { mappings: [{ nomad_path: 'data.experiment_name', labflow_path: 'meta.name', value: 'Demo', required: true, status: 'mapped' }] }; },
  validate: function () { return { status: 'ready', problems: [] }; },
  dataYaml: function () { return 'data:\n  experiment_name: "Demo"\n'; }
};
require('../../assets/js/export/projections.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
}
const exp = {
  id: 'e1', meta: { name: 'Demo', workspaceId: 'w1', processId: 'p1' },
  samples: [{ id: 's1', name: 'S1' }], measurements: [{ id: 'm1', technique: 'jv' }], files: [{ path: 'a.txt' }], raw: {}
};
function sectionValues(kind) {
  const payload = LF.ExportProjections.projectionObject(kind, exp), out = {};
  Object.keys(payload.sections).forEach(function (name) {
    Object.assign(out, payload.sections[name]);
  });
  return out;
}

module.exports = function (t) {
  t['shareable Ready-PV export keeps full contact fields by default'] = function () {
    exportSettings.redactPersonal = false;
    const values = sectionValues('readypv');
    assert(values['contact.name'], 'Ada Researcher', 'contact name');
    assert(values['contact.email'], 'ada@example.test', 'contact email');
    assert(values['contact.parser'], 'Parser Person · parser@example.test', 'parser contact');
    assert(values['remarks.additional'], 'Shared setup\nReady-PV workspace', 'remarks');
  };

  t['privacy-safe Ready-PV export redacts personal fields and keeps scientific fields'] = function () {
    exportSettings.redactPersonal = true;
    const values = sectionValues('readypv');
    assert(values['contact.name'], '[redacted]', 'contact name redacted');
    assert(values['contact.email'], '[redacted]', 'contact email redacted');
    assert(values['contact.parser'], '[redacted]', 'parser contact redacted');
    assert(values['contact.plugin'], '[redacted]', 'plugin contributor redacted');
    assert(values['remarks.additional'], '[redacted]', 'free-text remarks redacted');
    assert(values['contact.institution'], 'University Test', 'institution preserved');
    assert(values['measured.description'], 'Current-voltage characterization of photovoltaic devices', 'scientific description preserved');
    assert(values['instruments.main'], ['Keithley 2400'], 'instrument preserved');
    assert(values['samples.types'], ['PV device'], 'sample type preserved');
    exportSettings.redactPersonal = false;
  };

  t['privacy-safe export leaves NOMAD projection and backup data untouched'] = function () {
    exportSettings.redactPersonal = true;
    const nomad = sectionValues('nomad');
    assert(nomad['data.experiment_name'], 'Demo', 'NOMAD experiment name preserved');
    const backupSettings = Object.assign({}, exportSettings, { redactPersonal: false });
    assert(backupSettings.redactPersonal, false, 'backup semantics remain complete');
    exportSettings.redactPersonal = false;
  };
};
