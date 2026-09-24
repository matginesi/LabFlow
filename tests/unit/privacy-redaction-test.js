'use strict';
/*
 * Privacy/security regression suite for centralized redaction, diagnostic export
 * safety, scientific-data preservation and untrusted-path handling.
 */
require('../../assets/js/redact.js');
require('../../assets/js/core.js');
require('../../assets/js/logger.js');
require('../../assets/js/experiment/domain-schema.js');
require('../../assets/js/experiment/data-model.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}
function assertMatch(value, re, label) {
  if (!re.test(String(value))) throw new Error((label || 'assert') + ': expected match ' + re + ' in ' + value);
}
function assertNoMatch(value, re, label) {
  if (re.test(String(value))) throw new Error((label || 'assert') + ': unexpected match ' + re + ' in ' + value);
}

module.exports = function (t, LF) {
  t['logging sanitizer redacts credentials but keeps diagnostic metadata'] = function () {
    const out = LF.Logger.sanitize({
      provider: 'openrouter',
      endpoint: 'https://user:secret@api.example.test/v1?apikey=abc123def456',
      status: 401,
      authorization: 'Bearer sk-abcdefghijklmnop',
      error: { name: 'TypeError', message: 'authorization failed', code: 'E_AUTH', stack: 'TypeError: authorization failed\n  at x' }
    });
    assert(out.provider, 'openrouter', 'provider preserved');
    assert(out.status, 401, 'http status preserved');
    assert(out.authorization, '[redacted]', 'authorization key redacted');
    assert(out.error.name, 'TypeError', 'error type preserved');
    assert(out.error.code, 'E_AUTH', 'error code preserved');
    assertNoMatch(out.endpoint, /user:secret@/, 'URL userinfo redacted');
    assertNoMatch(out.endpoint, /apikey=abc123def456/, 'query credential redacted');
    assertNoMatch(JSON.stringify(out), /sk-abcdefghijklmnop/, 'credential value redacted');
  };

  t['logger redacts direct personal identifiers at buffer time'] = function () {
    const out = LF.Logger.sanitize({
      email: 'ada@example.test',
      contact: { role: 'data_responsible', name: 'Ada Researcher', email: 'ada@example.test', id: 'contact_1' },
      institution: 'Example Institute',
      experimentId: 'exp_1'
    });
    assert(out.email, '[redacted]', 'top-level email');
    assert(out.contact.name, '[redacted]', 'contact name');
    assert(out.contact.email, '[redacted]', 'contact email');
    assert(out.contact.role, 'data_responsible', 'role preserved');
    assert(out.institution, 'Example Institute', 'non-identifying institution preserved');
    assert(out.experimentId, 'exp_1', 'experiment id preserved');
  };

  t['diagnostic export is privacy-safe by default and keeps failure evidence'] = async function () {
    const captured = [], original = LF.Core.downloadBlob, savedLocation = global.location;
    global.location = { protocol: 'https:', host: 'example.test', pathname: '/' };
    LF.Core.downloadBlob = function (blob, name) { captured.push({ blob: blob, name: name }); };
    try {
      LF.Logger.clear();
      LF.Logger.error('ai', 'request.failed', {
        status: 401,
        provider: 'openrouter',
        providerCode: 'AUTH',
        contact: { name: 'Ada Researcher', email: 'ada@example.test' },
        messages: [{ role: 'user', content: 'My unpublished question with ada@example.test' }],
        providerResponse: 'token sk-or-v1-abcdefghijklmnopqrstuvwx rejected'
      });
      LF.Logger.downloadDiagnostics();
    } finally {
      LF.Core.downloadBlob = original;
      if (savedLocation === undefined) delete global.location; else global.location = savedLocation;
    }
    assert(captured.length, 1, 'one diagnostic bundle');
    const text = await captured[0].blob.text();
    assertNoMatch(text, /sk-or-v1-abcdefghijklmnopqrstuvwx/, 'api key not exported');
    assertNoMatch(text, /ada@example\.test/, 'email not exported');
    assertNoMatch(text, /unpublished question/, 'prompt content not exported');
    assertNoMatch(text, /Ada Researcher/, 'contact name not exported');
    assertMatch(text, /401/, 'HTTP status preserved');
    assertMatch(text, /request\.failed/, 'event name preserved');
    assertMatch(text, /"providerCode": ?"AUTH"/, 'provider error code preserved');
    assertMatch(text, /privacy-safe/, 'bundle declares its redaction profile');
  };

  t['backup profile stays restorable while excluding credentials'] = function () {
    const out = LF.Redact.sanitize({
      contact: { name: 'Ada Researcher', email: 'ada@example.test' },
      apiKey: 'sk-or-v1-abcdefghijklmnopqrstuvwx',
      nomadToken: 'nomad-secret'
    }, LF.Redact.profile('backup'));
    assert(out.contact.name, 'Ada Researcher', 'backup keeps contact name');
    assert(out.contact.email, 'ada@example.test', 'backup keeps contact email');
    assert(out.apiKey, '[redacted]', 'backup excludes api key');
    assert(out.nomadToken, '[redacted]', 'backup excludes nomad token');
  };

  t['shareable and diagnostic profiles preserve scientific data'] = function () {
    const payload = {
      measurements: [{ id: 'm1', bestEff: 21.3, sample: 'S1', technique: 'jv' }],
      files: [{ path: 'cell01/jv_0001.txt', size: 1204, sha256: 'a'.repeat(64) }],
      design: { stack: [{ role: 'ETL', material: 'SnO2', thickness: '30 nm' }] },
      samples: [{ name: 'S1', position: 'A1' }]
    };
    ['shareable', 'diagnostic'].forEach(function (name) {
      const out = LF.Redact.sanitize(payload, LF.Redact.profile(name));
      assert(out, payload, name + ' keeps scientific values');
    });
  };

  t['free-text redaction applies to nested personal fields but not scientific descriptions'] = function () {
    const out = LF.Redact.sanitize({
      contact: { name: 'Ada', notes: 'call me on the usual number' },
      remarks: { additional: 'private remark' },
      measured: { description: 'Current-voltage characterization of photovoltaic devices' },
      notes: 'lab notebook free text'
    }, LF.Redact.profile('shareable'));
    assert(out.contact.name, '[redacted]', 'contact name');
    assert(out.contact.notes, '[redacted]', 'contact notes');
    assert(out.remarks.additional, '[redacted]', 'free-text remarks');
    assert(out.notes, '[redacted]', 'free-text notes');
    assert(out.measured.description, 'Current-voltage characterization of photovoltaic devices', 'scientific description preserved');
  };

  t['shareable projections treat correction authorship as personal but keep provenance'] = function () {
    const out = LF.Redact.sanitize({
      patches: [{ patchType: 'block_value', reason: 'Reconstructed from the applied patch.', reviewedBy: 'Ada Researcher', evidence: ['Applied patch metadata'] }]
    }, LF.Redact.profile('shareable'));
    assert(out.patches[0].reviewedBy, '[redacted]', 'reviewedBy redacted');
    assert(out.patches[0].reason, 'Reconstructed from the applied patch.', 'scientific reason preserved');
    assert(out.patches[0].evidence, ['Applied patch metadata'], 'provenance evidence preserved');
  };

  t['prototype-walking field paths are rejected before any write'] = function () {
    assert(LF.Core.safePathSegments('__proto__.polluted'), null, '__proto__ rejected');
    assert(LF.Core.safePathSegments('a.constructor.b'), null, 'constructor rejected');
    assert(LF.Core.safePathSegments('a.prototype.b'), null, 'prototype rejected');
    assert(LF.Core.safePathSegments('data.rows.0.value'), ['data', 'rows', '0', 'value'], 'safe path preserved');
    const exp = LF.DataModel.create({ sourceName: 'x.zip' });
    const block = LF.DataModel.addBlock(exp, { type: 'table', family: 'jv', name: 'B', schema: { columns: [{ name: 'v' }] }, data: { header: ['v'], rows: [{ v: 1 }] }, metadata: {} });
    LF.DataModel.addPatch(exp, { patchType: 'block_value', target: { kind: 'block', id: block.id }, operation: 'set', field: '__proto__.polluted', to: 7, status: 'applied' });
    LF.DataModel.getEffectiveBlock(exp, block.id);
    assert(({}).polluted, undefined, 'Object.prototype not polluted');
    assert(Array.isArray(Object.prototype.rows), false, 'Object.prototype.rows not injected');
  };

  t['spreadsheet formula triggers are neutralized while numbers stay numeric'] = function () {
    assert(LF.Core.csvEscape('=cmd|calc'), "'=cmd|calc", 'equals formula guarded');
    assert(LF.Core.csvEscape('@SUM(A1)'), "'@SUM(A1)", 'at formula guarded');
    assert(LF.Core.csvEscape('-1.25'), '-1.25', 'negative number preserved');
    assert(LF.Core.csvEscape('-cmd'), "'-cmd", 'negative text guarded');
    assert(LF.Core.csvEscape('a,b'), '"a,b"', 'comma still quoted');
  };

  t['markdown escaping keeps placeholders literal and raw HTML inert'] = function () {
    const html = LF.Core.markdown('use `$&` here');
    assertNoMatch(html, /@@LFPROTECTED/, 'no placeholder leak');
    assertMatch(html, /<code>/, 'code span preserved');
    assertNoMatch(LF.Core.markdown('<script>alert(1)</script>'), /<script/i, 'raw HTML escaped');
    assertNoMatch(LF.Core.markdown('[x](javascript:alert(1))'), /javascript:/i, 'unsafe URL dropped');
  };
};
