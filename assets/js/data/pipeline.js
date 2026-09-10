(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Core) throw new Error('LabFlow.Core must be loaded before data/pipeline.js.');

  LF.Core.requireModules('DataPipeline', [
    'Logger',
    'DataModel',
    'DataContracts',
    'DatasetCorrections',
    'Analysis',
    'CanonicalStore',
    'DesignModel',
    'DesignAnalysis',
    'AnalysisSummary',
    'ExperimentBrief'
  ]);

  const Log = LF.Logger.scope('pipeline');
  const REGISTRY = [];

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function clock() {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  function revision(exp) {
    return Number(exp && exp.sync && exp.sync.revision || 0);
  }

  function register(spec) {
    if (arguments.length > 1) {
      throw new Error('DataPipeline.register accepts one stage specification object.');
    }
    if (!spec || !spec.id || typeof spec.run !== 'function') {
      throw new Error('Pipeline stage requires id and run.');
    }
    if (REGISTRY.some(function (item) { return item.id === spec.id; })) {
      throw new Error('Duplicate pipeline stage: ' + spec.id);
    }

    const row = Object.assign({
      description: '',
      after: [],
      reads: [],
      writes: [],
      phase: 'transform'
    }, spec);
    row.after = arr(row.after).map(String);
    row.reads = arr(row.reads).map(String);
    row.writes = arr(row.writes).map(String);
    REGISTRY.push(row);
    return row;
  }

  function ordered() {
    const byId = new Map(REGISTRY.map(function (item) { return [item.id, item]; }));
    const out = [];
    const done = new Set();
    const visiting = new Set();

    function visit(stage) {
      if (done.has(stage.id)) return;
      if (visiting.has(stage.id)) throw new Error('Pipeline dependency cycle at ' + stage.id);
      visiting.add(stage.id);
      stage.after.forEach(function (id) {
        const dependency = byId.get(id);
        if (!dependency) throw new Error('Pipeline stage ' + stage.id + ' depends on missing stage ' + id);
        visit(dependency);
      });
      visiting.delete(stage.id);
      done.add(stage.id);
      out.push(stage);
    }

    REGISTRY.forEach(visit);
    return out;
  }

  function publicStage(stage) {
    return {
      id: stage.id,
      phase: stage.phase,
      after: stage.after.slice(),
      reads: stage.reads.slice(),
      writes: stage.writes.slice(),
      description: stage.description
    };
  }

  function stages() {
    return ordered().map(publicStage);
  }

  function runStage(stage, exp, ctx) {
    const start = clock();
    ctx.currentStage = stage.id;
    const result = stage.run(exp, ctx) || null;
    ctx.stages.push({
      id: stage.id,
      status: 'done',
      durationMs: Math.round((clock() - start) * 10) / 10,
      restartFrom: result && result.restartFrom || ''
    });
    return result;
  }

  function refresh(exp, opts) {
    opts = opts || {};
    if (!exp) throw new Error('DataPipeline.refresh requires ExperimentData.');

    LF.DataModel.hydrate(exp);
    const sequence = ordered();
    const maxRestarts = Math.max(0, Number(opts.maxRestarts == null ? 2 : opts.maxRestarts));
    const ctx = {
      reason: opts.reason || 'refresh',
      revision: revision(exp),
      stages: [],
      startedAt: new Date().toISOString(),
      validation: null,
      currentStage: '',
      restarts: 0
    };

    Log.info('refresh.start', {
      experimentId: exp.id,
      revision: ctx.revision,
      reason: ctx.reason,
      stages: sequence.length
    });

    try {
      let index = 0;
      while (index < sequence.length) {
        const result = runStage(sequence[index], exp, ctx);
        if (result && result.restartFrom) {
          const target = sequence.findIndex(function (stage) {
            return stage.id === result.restartFrom;
          });
          if (target < 0) {
            const error = new Error('Pipeline restart target does not exist: ' + result.restartFrom);
            error.code = 'PIPELINE_RESTART_INVALID';
            throw error;
          }

          ctx.restarts += 1;
          if (ctx.restarts > maxRestarts) {
            const error = new Error('Pipeline exceeded bounded restart limit (' + maxRestarts + ').');
            error.code = 'PIPELINE_RESTART_LIMIT';
            throw error;
          }

          Log.info('refresh.restart', {
            experimentId: exp.id,
            from: sequence[index].id,
            to: result.restartFrom,
            restart: ctx.restarts
          });
          index = target;
          continue;
        }
        index += 1;
      }

      ctx.status = 'ready';
      ctx.validation = LF.DataContracts.validate(exp);
      if (!ctx.validation.ok) {
        const error = new Error('ExperimentData failed final pipeline validation.');
        error.code = 'DATA_CONTRACT_INVALID';
        error.validation = ctx.validation;
        throw error;
      }

      ctx.endedAt = new Date().toISOString();
      exp.pipeline = {
        status: 'ready',
        sourceRevision: revision(exp),
        reason: ctx.reason,
        restarts: ctx.restarts,
        plan: stages(),
        executions: ctx.stages.slice(),
        validation: ctx.validation,
        updatedAt: ctx.endedAt
      };

      Log.info('refresh.end', {
        experimentId: exp.id,
        revision: revision(exp),
        executions: ctx.stages.length,
        restarts: ctx.restarts,
        warnings: ctx.validation.warnings.length
      });
      return exp.pipeline;
    } catch (error) {
      ctx.status = 'error';
      ctx.endedAt = new Date().toISOString();
      exp.pipeline = {
        status: 'error',
        sourceRevision: revision(exp),
        reason: ctx.reason,
        restarts: ctx.restarts,
        plan: stages(),
        executions: ctx.stages.slice(),
        validation: ctx.validation || error.validation || null,
        error: {
          code: error.code || 'PIPELINE_FAILED',
          message: error.message || String(error),
          stage: ctx.currentStage || ''
        },
        updatedAt: ctx.endedAt
      };
      Log.error('refresh.failed', {
        experimentId: exp.id,
        stage: ctx.currentStage || '',
        error: error
      });
      throw error;
    }
  }

  function status(exp) {
    return exp && exp.pipeline || {
      status: 'not_run',
      sourceRevision: revision(exp),
      restarts: 0,
      plan: stages(),
      executions: []
    };
  }

  register({
    id: 'normalize',
    phase: 'normalize',
    reads: ['labflow-data'],
    writes: ['labflow-data.shape'],
    run: function (exp) {
      LF.DataModel.hydrate(exp);
    },
    description: 'Normalize LabFlow Data through the single DomainSchema.'
  });

  register({
    id: 'link',
    phase: 'normalize',
    after: ['normalize'],
    reads: ['measurements', 'auxiliaryEvidence'],
    writes: ['experiments', 'samples', 'runs', 'measurements.links'],
    run: function (exp) {
      LF.DatasetCorrections.rebuildSamples(exp);
    },
    description: 'Rebuild Experiment → Sample → Run → Measurement links and backlinks.'
  });

  register({
    id: 'validate-structure',
    phase: 'gate',
    after: ['link'],
    reads: ['domain graph'],
    writes: ['pipeline.validation'],
    run: function (exp, ctx) {
      ctx.validation = LF.DataContracts.assert(exp);
    },
    description: 'Fail closed before scientific analysis if domain invariants are inconsistent.'
  });

  register({
    id: 'analyze',
    phase: 'derive',
    after: ['validate-structure'],
    reads: ['measurements', 'analysisSettings'],
    writes: ['analysis', 'measurement derived metrics', 'findings'],
    run: function (exp) {
      LF.Analysis.analyze(exp);
    },
    description: 'Calculate deterministic JV metrics, rankings and quality flags.'
  });

  register({
    id: 'index',
    phase: 'derive',
    after: ['analyze'],
    reads: ['domain', 'analysis', 'findings'],
    writes: ['canonical'],
    run: function (exp) {
      LF.CanonicalStore.build(exp);
    },
    description: 'Build deterministic read indexes, aliases, relations and evidence links.'
  });

  register({
    id: 'review',
    phase: 'review',
    after: ['index'],
    reads: ['canonical', 'findings'],
    writes: ['datasetAnalysis'],
    run: function (exp) {
      exp.datasetAnalysis = LF.DatasetCorrections.analysis(exp, revision(exp));
    },
    description: 'Build deterministic Review findings, safe fixes and semantic ambiguities.'
  });

  register({
    id: 'auto-cleanup',
    phase: 'review',
    after: ['review'],
    reads: ['datasetAnalysis'],
    writes: ['autoCleanup', 'patches'],
    run: function (exp) {
      LF.DatasetCorrections.prepareAutomaticSafeFixes(exp);
    },
    description: 'Detect mechanically provable cleanup and keep it pending for explicit researcher acceptance.'
  });

  register({
    id: 'project-design',
    phase: 'derive',
    after: ['auto-cleanup'],
    reads: ['experiments', 'samples', 'auxiliaryEvidence', 'design'],
    writes: ['design', 'designAnalysis'],
    run: function (exp) {
      LF.DesignModel.ensure(exp);
      exp.designAnalysis = LF.DesignAnalysis.build(exp, revision(exp));
    },
    description: 'Project source evidence into Design using stable domain IDs without overwriting researcher values.'
  });

  register({
    id: 'summarize',
    phase: 'derive',
    after: ['project-design'],
    reads: ['analysis', 'design', 'findings'],
    writes: ['analysisSummary', 'experimentBrief'],
    run: function (exp) {
      exp.analysisSummary = LF.AnalysisSummary.ensure(exp);
      exp.experimentBrief = LF.ExperimentBrief.ensure(exp);
    },
    description: 'Build deterministic reusable Results statistics and Experiment Brief.'
  });

  register({
    id: 'validate-final',
    phase: 'gate',
    after: ['summarize'],
    reads: ['labflow-data', 'design'],
    writes: ['pipeline.validation'],
    run: function (exp, ctx) {
      ctx.validation = LF.DataContracts.assert(exp);
    },
    description: 'Validate the complete current domain and Design projection after all deterministic stages.'
  });

  LF.DataPipeline = {
    register: register,
    refresh: refresh,
    status: status,
    stages: stages
  };
}());
