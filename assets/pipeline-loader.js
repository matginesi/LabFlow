/**
 * LabFlow Pipeline Loader
 * =======================
 *
 * Runtime adapter for the generated static Pipeline bundle.
 *
 * IMPORTANT ARCHITECTURE RULES
 * ----------------------------
 * 1. Pipeline YAML files remain the canonical, human-edited definitions.
 * 2. assets/pipeline-bundle.js is generated from YAML + step HTML and MUST NOT
 *    be edited by hand.
 * 3. The browser performs no fetch() here. This keeps LabFlow compatible with
 *    GitHub Pages and avoids file:// CORS errors during simple local previews.
 * 4. Keep this API tiny: app.js only needs IDs, load(), loadAll() and getCached().
 */
(() => {
  'use strict';

  const source = window.LabFlowPipelineBundle || {};
  const ids = Object.freeze(Object.keys(source));
  const cache = new Map();

  function normalize(id) {
    if (source[id]) return id;
    if (source.chose) return 'chose';
    return ids[0] || '';
  }

  async function load(id = 'chose') {
    const pipelineId = normalize(id);
    if (!pipelineId) throw new Error('No LabFlow Pipeline definitions are available');
    if (cache.has(pipelineId)) return cache.get(pipelineId);
    const pipeline = source[pipelineId];
    cache.set(pipelineId, pipeline);
    return pipeline;
  }

  async function loadAll() {
    const entries = await Promise.all(ids.map(async id => [id, await load(id)]));
    return Object.fromEntries(entries);
  }

  function getCached(id) {
    return cache.get(id) || null;
  }

  window.LabFlowPipelines = Object.freeze({ ids, load, loadAll, getCached });
})();
