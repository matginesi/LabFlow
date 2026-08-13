#!/usr/bin/env node
/* Regression checks for conservative parsing of local-model JSON output. */
'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const warnings = [];
const sandbox = {
  window: {LabFlow: {
    Core: {},
    Logger: {scope: function () { return {
      warn: function (event, data) { warnings.push({event:event, data:data}); },
      info: function () {},
      debug: function () {},
      timer: function () { return function () {}; }
    }; }}
  }},
  document: {},
  URL: URL,
  performance: {now: function () { return 0; }},
  console: console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('assets/js/ai/structured.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('assets/js/ai/assistant.js', 'utf8'), sandbox);

const parse = sandbox.window.LabFlow.StructuredOutput.parse;

assert.strictEqual(parse('{"status":"ok"}').value.status, 'ok');
assert.strictEqual(parse('Result:\n```json\n{"status":"ok"}\n```').value.status, 'ok');
assert.strictEqual(parse('Here it is: {"status":"ok"} done.').value.status, 'ok');
assert.strictEqual(parse('{"status":"ok", // local note\n"items":[1,2,],}').value.items.length, 2);
assert.strictEqual(parse('{"note":"line one\nline two"}').value.note, 'line one\nline two');
assert.strictEqual(parse('{"note":"keep ,} and https://local/path",}').value.note, 'keep ,} and https://local/path');
assert.strictEqual(parse(JSON.stringify('{"status":"ok"}')).value.status, 'ok');
assert.strictEqual(parse('{"status":"ok"').value, null);
assert.match(parse('{"status":"ok"').diagnosis, /truncated/i);
assert.strictEqual(parse("{'status':'ok'}").value, null);

console.log('Structured JSON parser: 9 cases passed; ' + warnings.length + ' expected failures logged.');
