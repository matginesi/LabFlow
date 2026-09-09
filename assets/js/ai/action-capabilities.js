(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};

  function state() {
    return LF.State && LF.State.state || {};
  }

  function experiment(opts) {
    return opts && opts.exp || state().experiment || {};
  }

  function effective(actionId) {
    if (LF.ActionRunner && LF.ActionRunner.effective) return LF.ActionRunner.effective(actionId);
    if (LF.ActionRegistry && LF.ActionRegistry.action) return LF.ActionRegistry.action(actionId);
    return null;
  }

  function currentRoute() {
    const s = state();
    return String(s.ui && s.ui.route || s.route || '');
  }

  function readPath(root, path) {
    return String(path || '')
      .split('.')
      .filter(Boolean)
      .reduce(function (value, key) {
        return value == null ? undefined : value[key];
      }, root);
  }

  function ui(definition) {
    return definition && definition.ui && typeof definition.ui === 'object'
      ? definition.ui
      : {};
  }

  function resolveParams(definition, explicitParams) {
    const resolved = {};
    const bindings = ui(definition).bindings;

    if (bindings && typeof bindings === 'object') {
      Object.keys(bindings).forEach(function (name) {
        const value = readPath(state(), bindings[name]);
        if (value !== undefined) resolved[name] = value;
      });
    }

    return Object.assign(resolved, explicitParams || {});
  }

  function command(definition) {
    const metadata = ui(definition);
    return String(metadata.command || ('/action ' + definition.id));
  }

  function recommended(definition, route) {
    const routes = ui(definition).routes;
    return Array.isArray(routes) && routes.indexOf(String(route || currentRoute())) >= 0;
  }

  function evaluate(actionId, opts) {
    opts = opts || {};

    const definition = effective(actionId);
    if (!definition) {
      return {
        id: actionId,
        status: 'unknown',
        available: false,
        reason: 'Unknown Action.',
        failures: [],
        params: {},
        recommended: false,
        command: '/action ' + actionId
      };
    }

    const resolvedParams = resolveParams(definition, opts.params);
    const failures = LF.ActionGuards && LF.ActionGuards.check
      ? LF.ActionGuards.check(definition, {
          exp: experiment(opts),
          params: resolvedParams,
          selection: opts.selection || null,
          userText: opts.userText || ''
        })
      : [];

    return {
      id: definition.id,
      title: definition.short_title || definition.title || definition.id,
      purpose: definition.purpose || '',
      category: definition.category || '',
      visibility: definition.visibility || 'internal',
      status: failures.length ? 'unavailable' : 'available',
      available: !failures.length,
      reason: failures.length ? String(failures[0].message || 'Action unavailable.') : '',
      failures: failures,
      params: resolvedParams,
      recommended: recommended(definition, opts.route),
      command: command(definition),
      definition: definition
    };
  }

  function catalog(opts) {
    opts = opts || {};
    const ids = LF.ActionRegistry && LF.ActionRegistry.actions ? LF.ActionRegistry.actions() : [];
    const items = ids
      .map(function (actionId) { return evaluate(actionId, opts); })
      .filter(function (item) {
        return item.definition && item.definition.visibility === 'public';
      });

    items.sort(function (a, b) {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      if (a.available !== b.available) return a.available ? -1 : 1;
      return String(a.title).localeCompare(String(b.title));
    });

    return items;
  }

  function assistantCatalog(opts) {
    return catalog(opts).map(function (item) {
      return {
        id: item.id,
        title: item.title,
        purpose: item.purpose,
        command: item.command,
        available: item.available,
        status: item.status,
        recommended: item.recommended,
        blocked_reason: item.reason
      };
    });
  }

  function attributes(actionId, opts) {
    const item = evaluate(actionId, opts);
    return {
      disabled: !item.available,
      title: item.available ? item.purpose : item.reason,
      'aria-disabled': item.available ? 'false' : 'true'
    };
  }

  function resolveCommand(text) {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();

    if (lower.indexOf('/action ') === 0) return raw.slice(8).trim();

    const match = catalog().find(function (item) {
      return String(item.command || '').toLowerCase() === lower;
    });
    return match ? match.id : '';
  }

  LF.ActionCapabilities = {
    evaluate: evaluate,
    catalog: catalog,
    assistantCatalog: assistantCatalog,
    params: function (actionId, explicitParams) {
      const definition = effective(actionId);
      return definition
        ? resolveParams(definition, explicitParams)
        : Object.assign({}, explicitParams || {});
    },
    command: function (actionId) {
      const definition = effective(actionId);
      return definition ? command(definition) : '/action ' + actionId;
    },
    resolveCommand: resolveCommand,
    attributes: attributes
  };
}());
