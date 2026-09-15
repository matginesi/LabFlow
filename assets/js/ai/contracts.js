/*
 * Register Action, provider and settings structures in the cross-module structure catalog.
 * Boundary: Metadata mirrors owner contracts and never becomes a parallel runtime model.
 */
(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Structures || !LF.ActionRegistry) return;

  LF.Structures.define('action.definition', {
    owner: 'ActionRegistry', layer: 'workflow_definition', persistence: 'source_generated',
    description: 'Generated declarative Action contract: target, context, result, effects, guards and execution steps.',
    variants: LF.ActionRegistry.actions(),
    fields: {
      id: { type: 'string', required: true }, title: { type: 'string', required: true },
      short_title: { type: 'string' }, category: { type: 'string', required: true },
      role: { type: 'string' }, visibility: { type: 'string', required: true },
      purpose: { type: 'string', required: true }, strategy: { type: 'string' },
      policies: { type: 'array' }, contract: { type: 'object', required: true },
      execution: { type: 'object', required: true }, ui: { type: 'object' }
    }
  });

  LF.ActionRegistry.actions().forEach(function (id) {
    const def = LF.ActionRegistry.action(id);
    LF.Structures.defineFromExample('action.definition.' + id, {
      owner: 'ActionRegistry', layer: 'workflow_definition', persistence: 'source_generated',
      description: def.purpose || def.title || id,
      notes: [
        'Effect mode: ' + String(def.contract && def.contract.effect && def.contract.effect.mode || ''),
        'Context profile: ' + String(def.contract && def.contract.context && def.contract.context.profile || '')
      ]
    }, def, { required: ['id', 'title', 'category', 'visibility', 'contract', 'execution'] });
  });

  Object.keys(LF.ActionRegistry.schemas || {}).forEach(function (id) {
    const schema = LF.ActionRegistry.schema(id) || {};
    LF.Structures.defineFromExample('action.output-schema.' + id, {
      owner: 'ActionRegistry', layer: 'llm_output_contract', persistence: 'source_generated',
      description: String(schema.title || id) + ' structured-output schema.'
    }, schema, { required: ['id', 'type'] });
  });
}());
