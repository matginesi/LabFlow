(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Core || !LF.DomainSchema || !LF.ActionData || !LF.CanonicalStore || !LF.DesignModel) {
    throw new Error(
      'design-analysis.js requires LabFlow.Core, DomainSchema, ActionData, CanonicalStore and DesignModel.'
    );
  }

  function compact(value) {
    return LF.CanonicalStore.compact(value, 420);
  }

  function norm(value) {
    return String(
      value == null
        ? ''
        : (value && typeof value === 'object' && !Array.isArray(value)
          ? (value.value != null ? value.value : (value.id || value.path || value.name || ''))
          : value)
    ).trim().replace(/\\/g, '/').replace(/\s+/g, ' ').toLowerCase();
  }

  /*
   * DesignAnalysis owns deterministic analysis and application of AI Design
   * proposals. It does not call providers and it does not render UI.
   */
  function designAnalysis(exp,revision){
    LF.CanonicalStore.ensure(exp);
    const devices=LF.DesignModel.devices(exp),solutions=LF.DesignModel.solutions(exp),source=LF.DesignModel.evidenceSummary(exp)||{};
    function gaps(d){return LF.DesignModel.missingDomains(exp,d);}
    const items=(exp.samples||[]).map(function(s){const d=devices.find(function(x){return(x.sampleIds||[]).includes(s.id);})||null,unknown=gaps(d),ev=LF.CanonicalStore.evidence(exp,{record_ids:[s.id],limit:24});return{sample:{id:s.id,name:s.name,group:s.group||'',isRef:!!s.isRef},currentDevice:d?compact(d):null,evidenceIds:ev.map(function(e){return e.id;}),designEvidenceIds:ev.filter(function(e){return /design|stack|precursor|solution|anneal|coating|atmosphere/i.test([e.fact,e.summary].join(' '));}).map(function(e){return e.id;}),unknownFields:unknown};});
    const deviceRows=devices.map(function(d){const linked=(d.solutionIds||[]).map(function(id){return solutions.find(function(s){return String(s.id)===String(id);});}).filter(Boolean);return{id:d.id,name:d.name||'',group:d.group||'',sampleIds:(d.sampleIds||[]).slice(),sampleNames:(d.sampleNames||[]).slice(),status:d.status||'',known:{stackLayers:(d.stack||[]).length,solutions:linked.length},unknownFields:gaps(d),sourceEvidence:!!(d.status==='raw_evidence'||/Recovered from source/.test(String(d.evidence||'')))};});
    const unresolved=items.filter(function(x){return x.unknownFields.length;});
    return{generatedAt:new Date().toISOString(),sourceRevision:Number(revision)||0,summary:{samples:items.length,devices:devices.length,solutions:solutions.length,sourceDesignRecords:Number(source.sourceRecords||0),samplesCoveredBySource:Number(source.samplesCovered||0),unresolvedSamples:unresolved.length,unknownFields:unresolved.reduce(function(n,x){return n+x.unknownFields.length;},0)},devices:deviceRows,samples:items};
  }

  function looksQuantitative(value){
    const v=String(value==null?'':value).trim();if(!v)return false;
    if(/^[-+]?\d+(?:[.,]\d+)?$/.test(v))return true;
    if(/(?:^|[\s(])[-+]?\d+(?:[.,]\d+)?\s*[:/]\s*\d+(?:[.,]\d+)?(?:$|[\s),])/i.test(v))return true;
    return /(?:^|[\s(])[-+]?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?\s*(?:°\s*C|°C|C\b|K\b|ms\b|s\b|sec\b|seconds?\b|min\b|minutes?\b|h\b|hours?\b|rpm\b|rps\b|nm\b|µm\b|um\b|mm\b|cm\b|mL\b|µL\b|uL\b|mg\b|kg\b|g\b|mM\b|M\b|mol\b|wt%|vol%|%|torr\b|Pa\b|kPa\b|mbar\b|bar\b|psi\b|Hz\b|kHz\b|MHz\b|mV\b|V\b|mA\b|A\b|mW\b|W\b)/i.test(v);
  }
  function canonicalDesignSource(item,inherited){let raw=String(item&&item.provenance_kind||item&&item.provenanceKind||item&&item.source||inherited||'').toLowerCase().trim();const evidence=String(item&&item.evidence||'').trim();if(raw==='raw_evidence'||raw==='source'||raw==='evidence'||raw==='mixed')raw=evidence?'experiment':'model_inference';if(raw==='knowledge_reference')return /(?:^|[\s,;])KB:[A-Za-z0-9._:-]+/.test(evidence)?'knowledge_reference':'model_inference';return raw==='experiment'?'experiment':'model_inference';}
  function designConfidence(item,field){const map=item&&item.field_confidence&&typeof item.field_confidence==='object'?item.field_confidence:{},raw=Object.prototype.hasOwnProperty.call(map,field)?Number(map[field]):Number(item&&item.confidence);return Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):null;}
  function fieldDecision(item,field){return(item&&Array.isArray(item.field_decisions)?item.field_decisions:[]).find(function(x){return String(x&&x.field||'')===String(field);})||null;}
  function autoApplyAllowed(item,field,value,inherited,manual){if(value==null||String(value).trim()==='')return false;if(manual)return true;const decision=fieldDecision(item,field);if(decision)return decision.auto_apply===true;const source=canonicalDesignSource(item,inherited),confidence=designConfidence(item,field),supported=source==='experiment'&&!!String(item&&item.evidence||'').trim(),hasSource=!!String(item&&item.provenance_kind||item&&item.provenanceKind||inherited||'').trim();if(source==='knowledge_reference')return false;if(confidence==null)return!!supported||!hasSource;return confidence>=0.75&&(!looksQuantitative(value)||supported);}
  function sanitizeDesignProposal(proposal){const stats={reviewOnlyQuantities:0,modelOnlyItems:0,knowledgeItems:0,autoApply:0,review:0,unresolved:(proposal.unknowns||[]).length};function annotate(item,fields,inheritedSource){if(!item||typeof item!=='object')return;const directEvidence=String(item.evidence||'').trim(),declared=canonicalDesignSource(item,inheritedSource),source=declared==='experiment'&&directEvidence?'experiment':declared==='knowledge_reference'?'knowledge_reference':'model_inference';if(source==='model_inference')stats.modelOnlyItems++;if(source==='knowledge_reference')stats.knowledgeItems++;item.provenance_kind=source;item.field_decisions=[];(fields||[]).forEach(function(entry){const field=typeof entry==='string'?entry:entry.field,value=typeof entry==='string'?item[field]:entry.value;if(value==null||String(value).trim()==='')return;const confidence=designConfidence(item,field),quantitative=looksQuantitative(value),supported=source==='experiment'&&!!directEvidence,autoApply=source==='knowledge_reference'?false:(confidence!=null&&confidence>=0.75&&(!quantitative||supported)),decision={field:field,value:String(value),source:source,confidence:confidence,auto_apply:autoApply,quantitative:quantitative,applied:false,skipped:''};item.field_decisions.push(decision);if(autoApply)stats.autoApply++;else{stats.review++;if(quantitative&&!supported)stats.reviewOnlyQuantities++;}});}
    (proposal.solutions||[]).forEach(function(item){annotate(item,['name','role','solutes','solvents','concentration','additives','preparation']);});
    (proposal.devices||[]).forEach(function(device){const process=device.process||{};annotate(device,[{field:'solutions',value:(device.solution_names||[]).join(', ')},{field:'coating',value:process.coating},{field:'annealing',value:process.annealing},{field:'atmosphere',value:process.atmosphere},{field:'notes',value:process.notes}]);(device.stack||[]).forEach(function(layer){annotate(layer,['role','material','thickness','process'],device.provenance_kind);});});
    proposal.applicationSummary={auto_apply_count:stats.autoApply,review_count:stats.review,unresolved_count:stats.unresolved};return stats;
  }
  function designApplicationSummary(proposal){const out={auto_apply_count:0,auto_applied_count:0,review_count:0,unresolved_count:(proposal&&proposal.unknowns||[]).length};function add(item){(item&&item.field_decisions||[]).forEach(function(d){if(d.skipped==='existing')return;if(d.applied)out.auto_applied_count++;else if(d.auto_apply)out.auto_apply_count++;else out.review_count++;});}(proposal&&proposal.solutions||[]).forEach(add);(proposal&&proposal.devices||[]).forEach(function(d){add(d);(d.stack||[]).forEach(add);});return out;}
  function applicableDesignFields(proposal,unknownFields){
    const wanted=new Set((unknownFields||[]).map(function(x){return String(x).toLowerCase();})),device=proposal&&proposal.devices&&proposal.devices[0]||{},solutions=proposal&&proposal.solutions||[],fields=[];
    /* The Action already targets one selected experiment. A useful chemistry
       proposal does not need the model to repeat a device→solution linkage just
       to pass validation; the deterministic store/apply step owns that target. */
    if(wanted.has('solutions')&&solutions.some(function(sol){return[sol&&sol.solutes,sol&&sol.solvents].some(function(v){return String(v||'').trim();});}))fields.push('solutions');
    if(wanted.has('stack')){const assessment=LF.DesignModel.stackAssessment(device.stack||[]);if(assessment&&assessment.complete)fields.push('stack');}
    const process=device.process||proposal&&proposal.process||{};if(wanted.has('process')&&[process.coating,process.annealing,process.atmosphere,process.notes].some(function(v){return String(v||'').trim();}))fields.push('process');
    return fields;
  }

  function markDesignDecision(item, field, state) {
    const decision = fieldDecision(item, field);
    if (!decision) return;
    if (state === 'applied') {
      decision.applied = true;
      decision.skipped = '';
    } else if (state) {
      decision.skipped = state;
    }
  }

  function decisionsComplete(item, fields) {
    const wanted = new Set(fields || []);
    const list = (item && item.field_decisions || []).filter(function (decision) {
      return !wanted.size || wanted.has(decision.field);
    });
    return list.length > 0 && list.every(function (decision) {
      return decision.applied || decision.skipped === 'existing';
    });
  }

  function fillMissing(target, source, fields, sourceItem, inheritedProvenance, manual) {
    let changed = 0;
    fields.forEach(function (field) {
      const current = target[field];
      const next = source[field];
      if (current != null && String(current).trim() !== '') {
        markDesignDecision(sourceItem || source, field, 'existing');
        return;
      }
      if (!autoApplyAllowed(sourceItem || source, field, next, inheritedProvenance, manual)) return;
      LF.DesignModel.setInferenceField(target, field, next);
      markDesignDecision(sourceItem || source, field, 'applied');
      changed++;
    });
    return changed;
  }

  function fillMetadata(target, source) {
    let changed = 0;
    ['evidence', 'confidence', 'provenance_kind', 'reason'].forEach(function (field) {
      const targetField = field === 'provenance_kind' ? 'provenanceKind' : field;
      const current = target[targetField];
      const next = source[field];
      if ((current == null || String(current).trim() === '') && next != null && String(next).trim() !== '') {
        LF.DesignModel.setInferenceField(target, field, next);
        changed++;
      }
    });
    return changed;
  }

  function fillProcessMissing(device, source, fields, sourceItem, inheritedProvenance, manual) {
    let changed = 0;
    const process = device.process || {};
    fields.forEach(function (field) {
      const current = process[field];
      const next = source[field];
      if (current != null && String(current).trim() !== '') {
        markDesignDecision(sourceItem || source, field, 'existing');
        return;
      }
      if (!autoApplyAllowed(sourceItem || source, field, next, inheritedProvenance, manual)) return;
      LF.DesignModel.setInferenceProcessField(device, field, next);
      markDesignDecision(sourceItem || source, field, 'applied');
      changed++;
    });
    return changed;
  }

  function activeDesignProposal(exp, targetId) {
    const preferred = String(
      targetId || LF.State && LF.State.state && LF.State.state.ui.selectedDesignDeviceId || ''
    );
    const direct = preferred && LF.ActionData.proposal(exp, 'design.infer', preferred);
    if (direct) return direct;
    const map = LF.ActionData.proposals(exp, 'design.infer');
    const first = Object.keys(map || {})[0];
    return first ? map[first] : null;
  }

  function proposalDeviceTarget(exp, src, proposal) {
    const targetId = String(proposal && proposal.targetDeviceId || '');
    const names = (src.sample_names || []).map(String);
    let target = targetId ? LF.DesignModel.device(exp, targetId) : null;

    if (!target) {
      target = LF.DesignModel.devices(exp).find(function (device) {
        return names.some(function (name) { return (device.sampleNames || []).includes(name); });
      }) || LF.DesignModel.devices(exp).find(function (device) {
        return String(device.name || '').toLowerCase() === String(src.name || '').toLowerCase();
      });
    }

    if (!target) {
      const sampleIds = (exp.samples || []).filter(function (sample) {
        return names.includes(sample.name);
      }).map(function (sample) { return sample.id; });
      target = LF.DesignModel.createInferredDevice(exp, {
        sampleIds: sampleIds,
        sampleNames: names.slice(),
        solutionIds: [],
        stack: [],
        process: { coating: '', annealing: '', atmosphere: '', notes: '' }
      });
    }
    return target;
  }

  function designSolutionTarget(exp, src) {
    const fields = ['role', 'solutes', 'solvents', 'concentration', 'additives'];
    const name = norm(src && src.name);
    const solutions = LF.DesignModel.solutions(exp);

    function compatible(solution) {
      for (let index = 0; index < fields.length; index++) {
        const current = norm(solution && solution[fields[index]]);
        const proposed = norm(src && src[fields[index]]);
        if (current && proposed && current !== proposed) return false;
      }
      return true;
    }

    let target = solutions.find(function (solution) {
      return name && norm(solution.name) === name && compatible(solution);
    });
    if (!target) {
      const scientific = fields.some(function (field) { return norm(src && src[field]); });
      if (scientific) {
        target = solutions.find(function (solution) {
          return compatible(solution) && fields.some(function (field) {
            return norm(solution && solution[field]) && norm(solution[field]) === norm(src && src[field]);
          });
        });
      }
    }
    return target || null;
  }

  const appliedSolutionTargets = new WeakMap();

  function applyDesignSolution(exp, src, manual, strictTarget) {
    const fields = ['name', 'role', 'solutes', 'solvents', 'concentration', 'additives', 'preparation'];
    const name = norm(src && src.name);
    const key = norm((src && src.name || '') + '|' + (src && src.role || ''));
    let target = strictTarget
      ? designSolutionTarget(exp, src)
      : LF.DesignModel.solutions(exp).find(function (solution) {
        return (name && norm(solution.name) === name) ||
          norm((solution.name || '') + '|' + (solution.role || '')) === key;
      });
    let created = false;

    if (!target) {
      target = LF.DesignModel.createInferredSolution(exp);
      created = true;
    }

    let changed = fillMissing(target, src, fields, src, null, manual);
    if (changed) changed += fillMetadata(target, src);
    if (!changed && created) LF.DesignModel.removeSolution(exp, target.id);
    if (target && target.id) appliedSolutionTargets.set(src, target.id);

    if (changed) {
      LF.DesignModel.markInferenceApplied(target);
      src.applied = decisionsComplete(src, fields);
      src.appliedSome = true;
      src.decision = src.applied ? 'accepted' : 'pending';
    }
    return changed;
  }

  function applyDesignStack(target, src, manual) {
    const proposed = src.stack || [];
    const current = (target.stack || []).slice();
    let changed = 0;
    if (!proposed.length) return changed;

    const partial = !LF.DesignModel.stackAssessment(current).complete && proposed.length >= 3;
    if (partial) {
      const remaining = current.slice();
      const merged = [];
      proposed.forEach(function (sourceLayer) {
        const material = String(sourceLayer.material || '').trim().toLowerCase();
        const role = String(sourceLayer.role || '').trim().toLowerCase();
        let index = remaining.findIndex(function (layer) {
          return material && String(layer.material || '').trim().toLowerCase() === material;
        });
        if (index < 0) {
          index = remaining.findIndex(function (layer) {
            return role && String(layer.role || '').trim().toLowerCase() === role;
          });
        }
        const layer = index >= 0
          ? remaining.splice(index, 1)[0]
          : LF.DesignModel.createInferredLayer({
            provenanceKind: sourceLayer.provenance_kind || src.provenance_kind || 'model_inference'
          });
        const before = changed;
        changed += fillMissing(
          layer,
          sourceLayer,
          ['role', 'material', 'thickness', 'process'],
          sourceLayer,
          src.provenance_kind,
          manual
        );
        if (changed > before) {
          changed += fillMissing(
            layer,
            sourceLayer,
            ['evidence', 'reason'],
            sourceLayer,
            src.provenance_kind,
            manual
          );
        }
        if (index >= 0 || changed > before) merged.push(layer);
      });
      if (merged.length) {
        LF.DesignModel.replaceInferenceStack(target, merged.concat(remaining));
        changed++;
      }
      return changed;
    }

    proposed.forEach(function (sourceLayer, index) {
      let layer = current[index];
      let created = false;
      if (!layer) {
        layer = LF.DesignModel.createInferredLayer({
          provenanceKind: sourceLayer.provenance_kind || src.provenance_kind || 'model_inference'
        });
        current.push(layer);
        created = true;
      }
      const before = changed;
      changed += fillMissing(
        layer,
        sourceLayer,
        ['role', 'material', 'thickness', 'process'],
        sourceLayer,
        src.provenance_kind,
        manual
      );
      if (changed > before) {
        changed += fillMissing(
          layer,
          sourceLayer,
          ['evidence', 'reason'],
          sourceLayer,
          src.provenance_kind,
          manual
        );
      }
      if (created && changed === before) current.pop();
    });
    LF.DesignModel.replaceInferenceStack(target, current);
    return changed;
  }

  function applyDesignDevice(exp, src, part, manual, proposal) {
    const target = proposalDeviceTarget(exp, src, proposal);
    const names = (src.sample_names || []).map(String);
    const sampleIds = (exp.samples || []).filter(function (sample) {
      return names.includes(sample.name);
    }).map(function (sample) { return sample.id; });
    let changed = 0;

    LF.DesignModel.mergeInferenceSamples(target, sampleIds, names, exp);

    if (part === 'all' || part === 'identity') {
      changed += fillMissing(target, src, ['name', 'group'], src, null, manual);
      if (changed) changed += fillMissing(target, src, ['evidence', 'confidence', 'reason'], src, null, manual);
      if (!target.provenanceKind && src.provenance_kind) {
        LF.DesignModel.setInferenceField(target, 'provenance_kind', src.provenance_kind);
        changed++;
      }
    }

    if (part === 'all' || part === 'solutions') {
      const ids = [];
      (src.solution_names || []).forEach(function (name) {
        const proposalSolution = proposal && (proposal.solutions || []).find(function (solution) {
          return norm(solution && solution.name) === norm(name);
        });
        const mappedId = proposalSolution && appliedSolutionTargets.get(proposalSolution);
        const mapped = mappedId && LF.DesignModel.solution(exp, mappedId);
        const targetSolution = mapped || proposalSolution && designSolutionTarget(exp, proposalSolution);

        if (targetSolution && !ids.includes(targetSolution.id)) {
          ids.push(targetSolution.id);
        } else if (!proposalSolution) {
          const matches = LF.DesignModel.solutions(exp).filter(function (solution) {
            return norm(solution.name) === norm(name);
          });
          if (matches.length === 1 && !ids.includes(matches[0].id)) ids.push(matches[0].id);
        }
      });
      ids.forEach(function (id) {
        if (LF.DesignModel.linkInferredSolution(target, id)) changed++;
      });
      if (ids.length) markDesignDecision(src, 'solutions', 'applied');
    }

    if (part === 'all' || part === 'process') {
      changed += fillProcessMissing(
        target,
        src.process || {},
        ['coating', 'annealing', 'atmosphere', 'notes'],
        src,
        null,
        manual
      );
    }
    if (part === 'all' || part === 'stack') changed += applyDesignStack(target, src, manual);

    if (changed) {
      LF.DesignModel.markInferenceApplied(target);
      if (part === 'all') {
        src.applied = decisionsComplete(src);
        src.decision = src.applied ? 'accepted' : 'pending';
      }
      src.appliedParts = src.appliedParts || {};
      const partFields = part === 'process'
        ? ['coating', 'annealing', 'atmosphere', 'notes']
        : part === 'solutions' ? ['solutions'] : [];
      src.appliedParts[part] = part === 'stack'
        ? (src.stack || []).every(function (layer) { return decisionsComplete(layer); })
        : decisionsComplete(src, partFields);
    }
    return changed;
  }

  function markReviewing(exp) {
    LF.DesignModel.setDesignStatus(exp, 'reviewing');
  }

  function applyOneDesign(exp, kind, index, part, targetId) {
    const proposal = activeDesignProposal(exp, targetId);
    if (!proposal) throw new Error('No AI design proposal is available.');
    let changed = 0;
    if (kind === 'solution') {
      const source = (proposal.solutions || [])[index];
      if (!source) throw new Error('Design solution proposal not found.');
      changed = applyDesignSolution(exp, source, true);
    } else {
      const source = (proposal.devices || [])[index];
      if (!source) throw new Error('Design device proposal not found.');
      changed = applyDesignDevice(exp, source, part || 'all', true, proposal);
    }
    if (!changed) {
      throw new Error('The proposed values are already present or protected by researcher-entered values.');
    }
    markReviewing(exp);
    return { changed: changed, summary: designApplicationSummary(proposal) };
  }

  function applyAllDesign(exp, targetId) {
    const proposal = activeDesignProposal(exp, targetId);
    if (!proposal) throw new Error('No AI design proposal is available.');
    let changed = 0;
    let items = 0;

    (proposal.solutions || []).forEach(function (source) {
      if (source.applied) return;
      const count = applyDesignSolution(exp, source, false);
      changed += count;
      if (count) items++;
    });

    (proposal.devices || []).forEach(function (source) {
      const parts = source.appliedParts || {};
      if (source.solution_names && source.solution_names.length && !parts.solutions) {
        const count = applyDesignDevice(exp, source, 'solutions', false, proposal);
        changed += count;
        if (count) items++;
      }
      if (source.process && Object.keys(source.process).some(function (key) {
        return String(source.process[key] == null ? '' : source.process[key]).trim() !== '';
      }) && !parts.process) {
        const count = applyDesignDevice(exp, source, 'process', false, proposal);
        changed += count;
        if (count) items++;
      }
      if (source.stack && source.stack.length && !parts.stack) {
        const count = applyDesignDevice(exp, source, 'stack', false, proposal);
        changed += count;
        if (count) items++;
      }
    });

    markReviewing(exp);
    const summary = designApplicationSummary(proposal);
    proposal.applicationSummary = summary;
    return {
      changed: changed,
      items: items,
      autoApplied: summary.auto_applied_count,
      review: summary.review_count,
      unresolved: summary.unresolved_count
    };
  }

  function applyAllDesignProposals(exp) {
    const map = LF.ActionData.proposals(exp, 'design.infer');
    const ids = Object.keys(map || {});
    let changed = 0;
    let items = 0;
    let proposals = 0;
    ids.forEach(function (id) {
      const proposal = map[id];
      if (!proposal) return;
      const out = applyAllDesign(exp, id);
      if (out.changed) {
        changed += out.changed;
        items += out.items || 0;
        proposals++;
      }
    });
    markReviewing(exp);
    return { changed: changed, items: items, proposals: proposals, totalProposals: ids.length };
  }

  function acceptDesignProposal(exp, deviceId, options) {
    const id = String(deviceId || '');
    const proposal = LF.ActionData.proposal(exp, 'design.infer', id);
    if (!proposal) throw new Error('No AI suggestion is available for this experiment.');

    let changed = 0;
    (proposal.solutions || []).forEach(function (solution) {
      changed += applyDesignSolution(exp, solution, true, !!(options && options.distinctSolutions));
    });
    const proposedDevice = proposal.devices && proposal.devices[0];
    if (proposedDevice) {
      changed += applyDesignDevice(exp, proposedDevice, 'solutions', true, proposal);
      changed += applyDesignDevice(exp, proposedDevice, 'process', true, proposal);
      changed += applyDesignDevice(exp, proposedDevice, 'stack', true, proposal);
    }

    const target = LF.DesignModel.device(exp, id);
    const remaining = target ? LF.DesignModel.missingDomains(exp, target) : [];
    const complete = !!target && !remaining.length;
    const now = new Date().toISOString();
    if (target && complete) LF.DesignModel.confirmInferredDevice(exp, id, now);

    /* Acceptance commits the proposal values. An exhausted proposal that still
       cannot satisfy the current completeness rule is discarded so a later
       inference starts from the actual remaining domains. */
    LF.ActionData.removeProposal(exp, 'design.infer', id);
    LF.ActionData.setStatus(exp, 'design.infer', id, {
      state: complete ? 'accepted' : 'incomplete',
      updatedAt: now,
      message: complete ? '' : 'Still missing: ' + remaining.join(', ')
    });
    markReviewing(exp);
    return { changed: changed, deviceId: id, complete: complete, remaining: remaining };
  }

  function acceptAllDesignProposals(exp) {
    const map = LF.ActionData.proposals(exp, 'design.infer');
    const ids = Object.keys(map || {});
    let changed = 0;
    let accepted = 0;
    const failed = [];
    const incomplete = [];
    const acceptedIds = [];
    ids.forEach(function (id) {
      try {
        const out = acceptDesignProposal(exp, id, { distinctSolutions: true });
        changed += out.changed;
        if (out.complete) {
          accepted++;
          acceptedIds.push(id);
        } else {
          incomplete.push({ id: id, remaining: (out.remaining || []).slice() });
        }
      } catch (error) {
        failed.push({ id: id, message: error && error.message || String(error) });
      }
    });
    return {
      changed: changed,
      accepted: accepted,
      acceptedIds: acceptedIds,
      incomplete: incomplete,
      failed: failed,
      total: ids.length
    };
  }

  function applyAcceptedDesign(exp, targetId) {
    const proposal = activeDesignProposal(exp, targetId);
    if (!proposal) throw new Error('No AI design proposal is available.');
    const acceptedSolutions = (proposal.solutions || []).filter(function (item) {
      return item.decision === 'accepted' && !item.applied;
    });
    const acceptedDevices = (proposal.devices || []).filter(function (item) {
      return item.decision === 'accepted' && !item.applied;
    });
    if (!acceptedSolutions.length && !acceptedDevices.length) {
      throw new Error('Accept at least one design proposal first.');
    }
    let changed = 0;
    acceptedSolutions.forEach(function (source) { changed += applyDesignSolution(exp, source, true); });
    acceptedDevices.forEach(function (source) {
      changed += applyDesignDevice(exp, source, 'all', true, proposal);
    });
    markReviewing(exp);
    return { solutions: acceptedSolutions.length, devices: acceptedDevices.length, changed: changed };
  }

  function applySelectedDevice(exp, deviceId, targetId) {
    const proposal = activeDesignProposal(exp, targetId);
    if (!proposal) throw new Error('No AI design proposal is available.');
    const source = (proposal.devices || []).find(function (device) {
      return device.id === deviceId;
    }) || (proposal.devices || []).find(function (device) {
      return String(device.name) === String(deviceId);
    });
    if (!source) throw new Error('Selected experiment proposal not found.');

    let changed = 0;
    (proposal.solutions || []).forEach(function (solution) {
      if ((source.solution_names || []).some(function (name) { return norm(solution.name) === norm(name); })) {
        changed += applyDesignSolution(exp, solution, true);
      }
    });
    changed += applyDesignDevice(exp, source, 'all', true, proposal);
    if (!changed) {
      throw new Error('The proposed values are already present or protected by researcher-entered values.');
    }
    markReviewing(exp);
    return { changed: changed };
  }

  LF.DesignAnalysis = {
    build: designAnalysis,
    applyAccepted: applyAcceptedDesign,
    applyOne: applyOneDesign,
    applyAll: applyAllDesign,
    applyAllProposals: applyAllDesignProposals,
    acceptProposal: acceptDesignProposal,
    acceptAllProposals: acceptAllDesignProposals,
    applySelectedDevice: applySelectedDevice,
    isQuantitative: looksQuantitative,
    sanitizeProposal: sanitizeDesignProposal,
    summarizeProposal: designApplicationSummary,
    applicableFields: applicableDesignFields
  };
}());
