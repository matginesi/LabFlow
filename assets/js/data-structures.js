/*
 * Descriptive catalog for cross-module structures, ownership and persistence metadata.
 * Boundary: Document shapes only; real owners keep defaults, validation, storage and mutation semantics.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const DEFINITIONS = Object.create(null);

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof ArrayBuffer) return 'arraybuffer';
    const type = typeof value;
    return type === 'object' ? 'object' : type;
  }

  function normalizeField(name, field) {
    field = isObject(field) ? field : { type: String(field || 'unknown') };
    return {
      name: String(name || ''),
      type: String(field.type || 'unknown'),
      required: !!field.required,
      nullable: !!field.nullable,
      relation: field.relation ? String(field.relation) : '',
      itemType: field.itemType ? String(field.itemType) : '',
      owner: field.owner ? String(field.owner) : '',
      layer: field.layer ? String(field.layer) : '',
      persistence: field.persistence ? String(field.persistence) : '',
      description: String(field.description || ''),
      enum: Array.isArray(field.enum) ? field.enum.slice() : null
    };
  }

  function fieldsFromExample(example, options) {
    options = options || {};
    const required = new Set(Array.isArray(options.required) ? options.required : []);
    const relations = isObject(options.relations) ? options.relations : {};
    const descriptions = isObject(options.descriptions) ? options.descriptions : {};
    const out = {};
    Object.keys(isObject(example) ? example : {}).forEach(function (key) {
      const value = example[key];
      let itemType = '';
      if (Array.isArray(value) && value.length) itemType = typeOf(value[0]);
      out[key] = {
        type: typeOf(value),
        itemType: itemType,
        required: required.has(key),
        relation: relations[key] || '',
        description: descriptions[key] || ''
      };
    });
    return out;
  }

  function define(id, spec) {
    id = String(id || '').trim();
    if (!id) throw new Error('Data structure id is required.');
    if (DEFINITIONS[id]) throw new Error('Duplicate data structure definition: ' + id);
    spec = isObject(spec) ? spec : {};
    const fields = {};
    Object.keys(isObject(spec.fields) ? spec.fields : {}).forEach(function (name) {
      fields[name] = normalizeField(name, spec.fields[name]);
    });
    DEFINITIONS[id] = {
      id: id,
      owner: String(spec.owner || 'unknown'),
      layer: String(spec.layer || 'runtime'),
      persistence: String(spec.persistence || 'runtime'),
      description: String(spec.description || ''),
      fields: fields,
      variants: Array.isArray(spec.variants) ? spec.variants.slice() : [],
      notes: Array.isArray(spec.notes) ? spec.notes.slice() : []
    };
    return describe(id);
  }

  function defineFromExample(id, spec, example, options) {
    spec = Object.assign({}, spec || {});
    spec.fields = fieldsFromExample(example, options || {});
    return define(id, spec);
  }

  function describe(id) {
    const definition = DEFINITIONS[String(id || '')];
    return definition ? clone(definition) : null;
  }

  function list(filter) {
    filter = filter || {};
    return Object.keys(DEFINITIONS).sort().map(describe).filter(function (definition) {
      if (filter.owner && definition.owner !== filter.owner) return false;
      if (filter.layer && definition.layer !== filter.layer) return false;
      if (filter.persistence && definition.persistence !== filter.persistence) return false;
      return true;
    });
  }

  function validateCatalog() {
    const errors = [];
    list().forEach(function (definition) {
      if (!definition.owner) errors.push(definition.id + ': owner is missing');
      if (!definition.layer) errors.push(definition.id + ': layer is missing');
      if (!definition.persistence) errors.push(definition.id + ': persistence is missing');
      Object.keys(definition.fields).forEach(function (name) {
        const field = definition.fields[name];
        if (!field.type) errors.push(definition.id + '.' + name + ': type is missing');
      });
    });
    return { ok: errors.length === 0, errors: errors, count: Object.keys(DEFINITIONS).length };
  }

  LF.Structures = {
    define: define,
    defineFromExample: defineFromExample,
    describe: describe,
    list: list,
    fieldsFromExample: fieldsFromExample,
    validate: validateCatalog
  };
}());
