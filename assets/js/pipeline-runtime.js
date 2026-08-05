(function () {
  "use strict";

  const asArray = (value) => Array.isArray(value) ? value : [];
  const pipelines = () => window.LabFlowPipelines || {};

  function deepGet(value, path, fallback = undefined) {
    const keys = Array.isArray(path) ? path : String(path || "").split(".").filter(Boolean);
    let current = value;
    for (const key of keys) {
      if (current == null || typeof current !== "object" || !(key in current)) return fallback;
      current = current[key];
    }
    return current == null ? fallback : current;
  }

  function hasValue(value) {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  }

  function pipeline(value) {
    if (value && typeof value === "object") return value;
    return pipelines()[value] || null;
  }

  function resource(value, group, key, fallback = {}) {
    const current = pipeline(value);
    return deepGet(current, ["resources", group, key], fallback);
  }

  function resourceRef(value, ref, fallback = {}) {
    const current = pipeline(value);
    if (!current || !ref) return fallback;
    return deepGet(current.resources || {}, String(ref).split("."), fallback);
  }

  function step(value, stepId) {
    return asArray(pipeline(value)?.steps).find((item) => item.id === stepId) || null;
  }

  function demoRecord(value, stepId) {
    const currentStep = step(value, stepId);
    const ref = currentStep?.contract?.demo_ref;
    return resourceRef(value, ref, {});
  }

  function quantityObjectsHaveUnits(value) {
    let valid = true;
    const visit = (item) => {
      if (!valid || item == null) return;
      if (Array.isArray(item)) return item.forEach(visit);
      if (typeof item !== "object") return;
      if (Object.prototype.hasOwnProperty.call(item, "value") && !hasValue(item.unit)) valid = false;
      Object.values(item).forEach(visit);
    };
    visit(value);
    return valid;
  }

  const validators = {
    all_quantities_have_units({record}) {
      return quantityObjectsHaveUnits(record)
        ? {status:"pass", detail:"Every structured quantity declares a unit."}
        : {status:"error", detail:"At least one structured quantity is missing a unit."};
    },
    fabrication_operations_are_ordered({record}) {
      const operations = asArray(record.fabrication_operations);
      const ids = operations.map((item) => item.id);
      const valid = operations.length > 0 && ids.every(Boolean) && new Set(ids).size === ids.length;
      return valid
        ? {status:"pass", detail:`${operations.length} uniquely identified operations are stored in order.`}
        : {status:"error", detail:"Fabrication operations are empty, duplicated or missing stable identifiers."};
    },
    stack_layers_have_producing_operations({record}) {
      const operations = new Set(asArray(record.fabrication_operations).map((item) => item.id));
      const allowed = new Set(["substrate", "process_variant"]);
      const invalid = asArray(record.stack?.layers).filter((layer) => !operations.has(layer.producer) && !allowed.has(layer.producer));
      return invalid.length
        ? {status:"error", detail:`${invalid.length} stack layer${invalid.length === 1 ? "" : "s"} lack a valid producer.`}
        : {status:"pass", detail:"Every stack layer has a fabrication producer or an explicit external producer."};
    },
    required_equipment_capabilities_are_declared({record}) {
      const missing = asArray(record.fabrication_operations).filter((item) => item.required && !hasValue(item.capability));
      return missing.length
        ? {status:"warning", detail:`${missing.length} required operation${missing.length === 1 ? "" : "s"} lack a capability category.`}
        : {status:"pass", detail:"Required operations declare equipment capability categories."};
    },
    process_snapshot_is_immutable({record}) {
      const snapshot = record.experiment?.process_snapshot || {};
      return snapshot.immutable && hasValue(snapshot.demo_hash)
        ? {status:"pass", detail:"The process snapshot is immutable and carries an identity hash."}
        : {status:"error", detail:"The process snapshot is mutable or has no identity hash."};
    },
    required_operations_have_actual_values({record}) {
      const rows = asArray(record.execution_records);
      const missing = rows.filter((item) => !hasValue(item.actual) || !hasValue(item.execution_time));
      return rows.length && !missing.length
        ? {status:"pass", detail:`All ${rows.length} execution records contain actual values and execution times.`}
        : {status:"error", detail:`${missing.length || 1} required execution record${missing.length === 1 ? "" : "s"} are incomplete.`};
    },
    deviations_are_explicit({record}) {
      const deviations = new Set(asArray(record.deviations).map((item) => item.operation_id));
      const missing = asArray(record.execution_records).filter((item) => item.status === "deviation" && !deviations.has(item.operation_id));
      return missing.length
        ? {status:"warning", detail:`${missing.length} changed operation${missing.length === 1 ? "" : "s"} lack a deviation record.`}
        : {status:"pass", detail:"Changed operations have explicit deviation records."};
    },
    required_environment_fields_present({record}) {
      const environment = record.experiment?.environment || {};
      const missing = ["atmosphere", "temperature", "humidity"].filter((key) => !hasValue(environment[key]));
      return missing.length
        ? {status:"warning", detail:`Missing environment fields: ${missing.join(", ")}.`}
        : {status:"pass", detail:"Required environment fields are present."};
    },
    result_records_have_stable_identifiers({record}) {
      const rows = asArray(record.normalized_records);
      const required = ["result_set_id", "experiment_id", "sample", "source_file"];
      const invalid = rows.filter((row) => required.some((key) => !hasValue(row[key])));
      return rows.length && !invalid.length
        ? {status:"pass", detail:`All ${rows.length} normalized records have stable identity and source links.`}
        : {status:"error", detail:`${invalid.length || 1} normalized record${invalid.length === 1 ? "" : "s"} lack stable identifiers.`};
    },
    mapped_quantities_have_units({pipeline:current}) {
      const fields = asArray(resource(current, "mappings", "jv", {}).fields);
      const missing = fields.filter((item) => !hasValue(item.target_unit));
      return fields.length && !missing.length
        ? {status:"pass", detail:"Mapped scientific fields declare target units."}
        : {status:"error", detail:"One or more mapped scientific fields lack target units."};
    },
    derived_values_link_to_sources({record}) {
      const rows = asArray(record.normalized_records);
      const missing = rows.filter((item) => !hasValue(item.source_file));
      return rows.length && !missing.length
        ? {status:"pass", detail:"Every normalized record retains its source-file identity."}
        : {status:"error", detail:`${missing.length || 1} derived record${missing.length === 1 ? "" : "s"} lack source provenance.`};
    },
    declared_and_measured_device_counts_agree({record}) {
      const context = record.quality_context || {};
      const declared = Number(context.declared_devices);
      const measured = Number(context.measured_devices);
      return declared === measured
        ? {status:"pass", detail:`Declared and measured device counts agree at ${declared}.`}
        : {status:"warning", detail:`Declared devices: ${declared || "—"}; measured devices: ${measured || "—"}.`};
    },
    no_unresolved_quality_errors({record}) {
      const errors = asArray(record.quality_issues).filter((item) => item.severity === "error");
      return errors.length
        ? {status:"error", detail:`${errors.length} unresolved deterministic quality error${errors.length === 1 ? "" : "s"} block result completion.`}
        : {status:"pass", detail:"No unresolved deterministic quality errors remain."};
    },
    findings_link_to_evidence({record}) {
      const missing = asArray(record.findings).filter((item) => !asArray(item.evidence_refs).length);
      return missing.length
        ? {status:"error", detail:`${missing.length} finding${missing.length === 1 ? "" : "s"} lack evidence references.`}
        : {status:"pass", detail:"Every finding links one or more evidence records."};
    },
    ai_suggestions_have_human_decisions({record}) {
      const pending = asArray(record.findings).filter((item) => ["ai_suggestion", "hypothesis"].includes(item.type) && ["proposed", ""].includes(item.review_status || ""));
      return pending.length
        ? {status:"error", detail:`${pending.length} advisory finding${pending.length === 1 ? "" : "s"} still require a human decision.`}
        : {status:"pass", detail:"Advisory findings have explicit human decisions."};
    },
    export_contains_open_issues({record}) {
      return record.export_manifest?.include_open_issues
        ? {status:"pass", detail:"The export manifest preserves open issues."}
        : {status:"error", detail:"The export manifest would hide open issues."};
    },
    nomad_required_fields_are_mapped({pipeline:current}) {
      const results = resource(current, "demo", "results", {});
      const unresolved = Number(results.quality_context?.unresolved_errors || 0);
      return unresolved
        ? {status:"warning", detail:`${unresolved} unresolved result error${unresolved === 1 ? "" : "s"} block final NOMAD readiness.`}
        : {status:"pass", detail:"Required NOMAD entities and fields are mapped."};
    }
  };

  function schemaIssue(status, path, detail) {
    return {id:`schema:${path}`, validator:"schema_contract", severity:status === "error" ? "error" : "warning", status, path, detail};
  }

  function validateField(path, value, definition, results) {
    if (definition?.required && !hasValue(value)) {
      results.push(schemaIssue("error", path, `Required schema field ${path} is missing.`));
      return;
    }
    if (!hasValue(value)) return;
    if (definition.pattern && typeof value === "string") {
      try {
        if (!(new RegExp(definition.pattern)).test(value)) results.push(schemaIssue("error", path, `${path} does not match ${definition.pattern}.`));
      } catch (_) {
        results.push(schemaIssue("error", path, `Schema pattern for ${path} is invalid.`));
      }
    }
    if (["string", "relation", "date"].includes(definition.type) && typeof value !== "string") results.push(schemaIssue("error", path, `${path} must be a string.`));
    if (definition.type === "date" && typeof value === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) results.push(schemaIssue("error", path, `${path} must use YYYY-MM-DD.`));
    if (definition.type === "integer" && !Number.isInteger(Number(value))) results.push(schemaIssue("error", path, `${path} must be an integer.`));
    if (definition.type === "number" && !Number.isFinite(Number(value))) results.push(schemaIssue("error", path, `${path} must be numeric.`));
    if (definition.type === "boolean" && typeof value !== "boolean") results.push(schemaIssue("error", path, `${path} must be boolean.`));
    if (definition.minimum != null && Number(value) < Number(definition.minimum)) results.push(schemaIssue("error", path, `${path} is below the minimum ${definition.minimum}.`));
    if (definition.type === "enum" && asArray(definition.values).length && !definition.values.includes(value)) results.push(schemaIssue("error", path, `${path} is not an allowed value.`));
    if (["object_list", "relation_list", "ordered_list", "string_list"].includes(definition.type) && !Array.isArray(value)) results.push(schemaIssue("error", path, `${path} must be a list.`));
    if (definition.type === "string_list" && Array.isArray(value) && value.some((item) => typeof item !== "string")) results.push(schemaIssue("error", path, `${path} must contain only strings.`));
    if (definition.type === "object" && (typeof value !== "object" || value == null || Array.isArray(value))) results.push(schemaIssue("error", path, `${path} must be an object.`));
    if (definition.minimum_items != null && asArray(value).length < Number(definition.minimum_items)) results.push(schemaIssue("error", path, `${path} requires at least ${definition.minimum_items} item(s).`));
  }

  function validateItemContract(collectionPath, items, contract, results) {
    const requiredFields = asArray(contract?.required_fields);
    asArray(items).forEach((item, index) => {
      requiredFields.forEach((field) => {
        if (!hasValue(item?.[field])) results.push(schemaIssue("error", `${collectionPath}[${index}].${field}`, `${collectionPath} item ${index + 1} is missing ${field}.`));
      });
      if (asArray(contract?.allowed_types).length && item?.type && !contract.allowed_types.includes(item.type)) {
        results.push(schemaIssue("error", `${collectionPath}[${index}].type`, `${item.type} is not an allowed ${collectionPath} type.`));
      }
      if (asArray(contract?.review_status_values).length && item?.review_status && !contract.review_status_values.includes(item.review_status)) {
        results.push(schemaIssue("error", `${collectionPath}[${index}].review_status`, `${item.review_status} is not an allowed review state.`));
      }
    });
  }

  function validateSchemaRecord(current, currentStep, record) {
    const schemaRef = currentStep?.contract?.schema_ref;
    const schema = resourceRef(current, schemaRef, null);
    if (!schema || typeof schema !== "object") return [schemaIssue("error", schemaRef || currentStep?.id || "schema", "The step schema could not be resolved from the pipeline contract.")];
    const results = [];
    asArray(schema.document?.required).forEach((path) => {
      if (!hasValue(deepGet(record, path))) results.push(schemaIssue("error", path, `Required document section ${path} is missing.`));
    });
    const recordPath = schema.record_path || "";
    const entity = recordPath ? deepGet(record, recordPath, {}) : record;
    if (schema.stable_id_field && !hasValue(entity?.[schema.stable_id_field])) results.push(schemaIssue("error", recordPath ? `${recordPath}.${schema.stable_id_field}` : schema.stable_id_field, `Stable identifier ${schema.stable_id_field} is missing.`));
    if (schema.version_field && !hasValue(entity?.[schema.version_field])) results.push(schemaIssue("error", recordPath ? `${recordPath}.${schema.version_field}` : schema.version_field, `Version field ${schema.version_field} is missing.`));
    Object.entries(schema.fields || {}).forEach(([field, definition]) => validateField(recordPath ? `${recordPath}.${field}` : field, entity?.[field], definition, results));
    Object.entries(schema.collections || {}).forEach(([path, definition]) => {
      const value = deepGet(record, path);
      validateField(path, value, definition, results);
      const stableIdField = definition?.stable_id_field;
      if (stableIdField && Array.isArray(value)) {
        const ids = value.map((item) => item?.[stableIdField]);
        if (ids.some((id) => !hasValue(id))) results.push(schemaIssue("error", path, `${path} contains items without ${stableIdField}.`));
        if (new Set(ids).size !== ids.length) results.push(schemaIssue("error", path, `${path} contains duplicate ${stableIdField} values.`));
      }
    });
    if (schema.execution_record) validateItemContract("execution_records", record.execution_records, schema.execution_record, results);
    if (schema.source_file_contract) validateItemContract("source_files", record.source_files, schema.source_file_contract, results);
    if (schema.finding_contract) validateItemContract("findings", record.findings, schema.finding_contract, results);
    return results;
  }

  function evaluateRule(current, currentStep, record, rule) {
    const validator = validators[rule.validator];
    let result = validator ? validator({pipeline:current, step:currentStep, record, rule}) : null;
    const declared = deepGet(record, ["validation", "rule_results", rule.id], null);
    if (!result && declared) result = {...declared};
    if (!result) result = {status:current.contract?.strict ? "error" : "warning", detail:`Validator ${rule.validator} is not implemented in the static POC.`};
    if (!result.status) result.status = rule.severity === "error" ? "error" : "warning";
    return {...rule, ...result};
  }

  function evaluateStep(value, stepId, visited = new Set()) {
    const current = pipeline(value);
    const currentStep = step(current, stepId);
    if (!current || !currentStep) return {ready:false, status:"blocked", missing:[stepId], rules:[], schema:[], dependencies:[], errors:1, warnings:0};
    if (visited.has(stepId)) return {ready:false, status:"blocked", missing:[], rules:[], schema:[schemaIssue("error", stepId, "A cyclic step dependency was detected.")], dependencies:[], errors:1, warnings:0};
    const nextVisited = new Set(visited);
    nextVisited.add(stepId);
    const record = demoRecord(current, stepId);
    const completion = currentStep.completion || {};
    const missing = asArray(completion.requires).filter((path) => !hasValue(deepGet(record, path)));
    const rules = asArray(completion.rules).map((rule) => evaluateRule(current, currentStep, record, rule));
    const schema = validateSchemaRecord(current, currentStep, record);
    const dependencies = asArray(currentStep.contract?.depends_on).map((dependencyId) => evaluateStep(current, dependencyId, nextVisited));
    const dependencyBlockers = dependencies.filter((item) => !item.ready);
    const errors = missing.length
      + rules.filter((item) => item.status === "error").length
      + schema.filter((item) => item.status === "error").length
      + dependencyBlockers.length;
    const warnings = rules.filter((item) => item.status === "warning").length
      + schema.filter((item) => item.status === "warning").length
      + dependencies.filter((item) => item.ready && item.warnings).length;
    return {
      pipeline: current.id,
      step: currentStep.id,
      record,
      completion,
      missing,
      rules,
      schema,
      dependencies,
      dependencyBlockers: dependencyBlockers.map((item) => item.step),
      errors,
      warnings,
      ready: errors === 0,
      status: errors ? "blocked" : warnings ? "warning" : "ready"
    };
  }

  function normalizeFinding(item) {
    const statusMap = {accepted:"accepted", needs_revision:"review", proposed:"action", rejected:"review"};
    return {
      score: Number(item?.score) || 0,
      title: item?.title || item?.statement || "Untitled finding",
      detail: item?.statement || item?.detail || "",
      evidence: item?.evidence_label || asArray(item?.evidence_refs).join(" · ") || "No evidence linked",
      status: statusMap[item?.review_status] || item?.status || "review",
      type: item?.type || "observation",
      id: item?.finding_id || item?.id || ""
    };
  }

  function hydrateData(data, pipelineId = "chose") {
    const current = pipeline(pipelineId);
    if (!data || !current) return data;
    const results = resource(current, "demo", "results", {});
    const review = resource(current, "demo", "review", {});
    const mapping = resource(current, "mappings", "jv", {});
    data.demoDataset = asArray(results.normalized_records).map((item) => ({...item}));
    data.aiFindings = asArray(review.findings).map(normalizeFinding);
    data.validationIssues = asArray(results.quality_issues).map((item) => ({...item}));
    data.importMapping = asArray(mapping.fields).map((item) => ({
      column: item.source,
      target: item.target,
      detected: item.source_unit,
      required: item.target_unit,
      conversion: item.conversion === "multiply_10" ? "× 10" : item.conversion === "FWD_to_forward" ? "FWD → forward" : item.conversion === "none" ? "None" : item.conversion,
      confidence: Number(item.confidence) || 0,
      preview: item.preview,
      status: item.decision === "confirmed" ? "ready" : "review"
    }));
    return data;
  }

  window.LabFlowPipelineRuntime = Object.freeze({
    deepGet,
    hasValue,
    pipeline,
    resource,
    resourceRef,
    step,
    demoRecord,
    validateSchemaRecord,
    evaluateStep,
    hydrateData,
    normalizeFinding,
    validators: Object.freeze({...validators})
  });
})();
