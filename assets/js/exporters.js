(function () {
  "use strict";

  const Log = window.LabFlowLogger?.child("export") || {debug(){},info(){},warn(){},error(){}};
  const encoder = new TextEncoder();
  const palettes = {
    blue:{name:"Scientific Blue",hex:"5B82FF",strong:"3268F5",dark:"101827",light:"EAF0FF"}, green:{name:"Laboratory Green",hex:"35B985",strong:"159568",dark:"0E2720",light:"E6F7F0"},
    violet:{name:"Research Violet",hex:"9470EE",strong:"7049D5",dark:"21183B",light:"F0EBFD"}, red:{name:"Signal Red",hex:"E96672",strong:"CF414F",dark:"32161B",light:"FDEBED"},
    teal:{name:"Instrument Teal",hex:"28ADA7",strong:"087F7B",dark:"0D2828",light:"E4F6F5"}, amber:{name:"Analytical Amber",hex:"E2A43B",strong:"B9790C",dark:"31240D",light:"FCF3DF"},
    cyan:{name:"Spectral Cyan",hex:"35AEE5",strong:"147FAA",dark:"102936",light:"E6F5FC"}, rose:{name:"Materials Rose",hex:"DB67A1",strong:"B73E79",dark:"351529",light:"FBEAF3"}
  };
  const concat = (arrays) => { const total=arrays.reduce((sum,item)=>sum+item.length,0); const output=new Uint8Array(total); let offset=0; arrays.forEach((item)=>{output.set(item,offset);offset+=item.length;}); return output; };
  const u16 = (value) => new Uint8Array([value&255,value>>>8&255]);
  const u32 = (value) => new Uint8Array([value&255,value>>>8&255,value>>>16&255,value>>>24&255]);
  let crcTable;
  function crc(data) { if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let value=n;for(let k=0;k<8;k++)value=value&1?0xedb88320^(value>>>1):value>>>1;crcTable[n]=value>>>0;}}let value=0xffffffff;for(const byte of data)value=crcTable[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0; }
  function dosTime() { const now=new Date(); const year=Math.max(1980,now.getFullYear()); return {time:now.getHours()<<11|now.getMinutes()<<5|now.getSeconds()>>1,date:(year-1980)<<9|(now.getMonth()+1)<<5|now.getDate()}; }
  function zipBytes(files) { const local=[];const central=[];let offset=0;for(const file of files){const name=encoder.encode(file.name);const data=file.data instanceof Uint8Array?file.data:encoder.encode(String(file.data));const checksum=crc(data);const stamp=dosTime();const record=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(stamp.time),u16(stamp.date),u32(checksum),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);local.push(record);central.push(concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(stamp.time),u16(stamp.date),u32(checksum),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=record.length;}const directory=concat(central);return concat([...local,directory,u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(directory.length),u32(offset),u16(0)]); }
  function download(value, name) {
    const blob=value instanceof Blob?value:new Blob([value]);
    const link=document.createElement("a");
    const objectUrl=URL.createObjectURL(blob);
    link.href=objectUrl;link.download=name;document.body.append(link);
    Log.info("download.started", { name, bytes: blob.size, mime: blob.type || "application/octet-stream" });
    try { link.click(); Log.info("download.dispatched", { name }); }
    catch (error) { Log.error("download.failed", { name, error }); throw error; }
    finally { link.remove(); setTimeout(()=>URL.revokeObjectURL(objectUrl),1500); }
  }
  const yamlString = (value) => typeof value === "number" || typeof value === "boolean" ? String(value) : `"${String(value ?? "").replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`;
  const asArray = (value) => Array.isArray(value) ? value : [];
  const jsonClone = (value) => JSON.parse(JSON.stringify(value ?? {}));
  const yamlList = (values, indent = 0) => asArray(values).map((value) => `${" ".repeat(indent)}- ${yamlString(value)}`);
  function pipelineContractJson(pipeline) { return JSON.stringify(jsonClone(pipeline), null, 2) + "\n"; }
  function projectYaml(project, pipeline) {
    const steps = asArray(pipeline?.steps);
    const completed = steps.length ? Math.ceil(Number(project.progress || 0) / 100 * steps.length) : 0;
    const lines = [
      "schema_version: labflow.project.v1",
      `id: ${yamlString(project.id)}`,
      `name: ${yamlString(project.name)}`,
      `status: ${yamlString(project.status)}`,
      `progress: ${Number(project.progress || 0)}`,
      `owner: ${yamlString(project.owner)}`,
      `objective: ${yamlString(project.objective)}`,
      "pipeline:",
      `  id: ${yamlString(pipeline?.id)}`,
      `  name: ${yamlString(pipeline?.name)}`,
      `  schema_version: ${yamlString(pipeline?.schema_version || "legacy-navigation-only")}`,
      `  version: ${yamlString(pipeline?.version)}`,
      `  domain: ${yamlString(pipeline?.domain || pipeline?.project_type)}`,
      `  contract_included: true`,
      "counts:",
      `  samples: ${Number(project.samples || 0)}`,
      `  measurements: ${Number(project.measurements || 0)}`,
      `  findings: ${Number(project.findings || 0)}`,
      "steps:"
    ];
    steps.forEach((step, index) => {
      const completion = step.completion || {};
      lines.push(
        `  - id: ${yamlString(step.id)}`,
        `    title: ${yamlString(step.title)}`,
        `    status: ${yamlString(index < completed ? "completed" : "available")}`,
        `    output: ${yamlString(step.output)}`,
        `    sections: [${asArray(step.sections).map((section) => yamlString(section.id)).join(", ")}]`,
        "    completion:",
        `      label: ${yamlString(completion.label || "Complete step")}`,
        `      mode: ${yamlString(completion.mode || "unspecified")}`,
        "      requires:"
      );
      lines.push(...(asArray(completion.requires).length ? yamlList(completion.requires, 8) : ["        []"]));
      lines.push("      rules:");
      if (asArray(completion.rules).length) {
        asArray(completion.rules).forEach((rule) => lines.push(
          `        - id: ${yamlString(rule.id)}`,
          `          validator: ${yamlString(rule.validator)}`,
          `          severity: ${yamlString(rule.severity)}`
        ));
      } else lines.push("        []");
      lines.push("      expected_evidence:");
      lines.push(...(asArray(completion.expected_evidence).length ? yamlList(completion.expected_evidence, 8) : ["        []"]));
    });
    return lines.join("\n") + "\n";
  }
  function jsonl(project, data) { return data.map((row)=>JSON.stringify({project_id:project.id,measurement_type:"JV summary",...row})).join("\n")+"\n"; }
  function csv(data) { const keys=Object.keys(data[0]||{});const quote=(value)=>/[",\n]/.test(String(value))?`"${String(value).replace(/"/g,'""')}"`:value;return keys.join(",")+"\n"+data.map((row)=>keys.map((key)=>quote(row[key])).join(",")).join("\n")+"\n"; }
  function nomadYaml(project, pipeline = {}) {
    const exportContract = pipeline.exports?.nomad || {};
    const mapping = pipeline.resources?.mappings?.nomad || {};
    const requiredEntities = asArray(mapping.required_entities);
    const lines = [
      "schema_version: labflow.nomad-preview.v1",
      "definitions:",
      "  name: LabFlow project export",
      `  pipeline_id: ${yamlString(pipeline.id || "unknown")}`,
      `  pipeline_version: ${yamlString(pipeline.version || "unknown")}`,
      `  mapping_profile: ${yamlString(exportContract.mapping_profile || mapping.id || "unmapped")}`,
      "data:",
      `  project_id: ${yamlString(project.id)}`,
      `  project_name: ${yamlString(project.name)}`,
      "  source: LabFlow static research workspace",
      `  upload_state: ${yamlString(exportContract.mode || mapping.mode || "readiness_preview")}`,
      `  remote_submission: ${Boolean(exportContract.remote_submission ?? mapping.remote_submission ?? false)}`,
      "  required_entities:"
    ];
    lines.push(...(requiredEntities.length ? yamlList(requiredEntities, 4) : ["    []"]));
    lines.push(
      "  provenance:",
      `    require_source_manifest: ${Boolean(mapping.provenance?.require_source_manifest ?? true)}`,
      `    require_process_snapshot: ${Boolean(mapping.provenance?.require_process_snapshot ?? true)}`,
      `    preserve_open_issues: ${Boolean(mapping.provenance?.preserve_open_issues ?? true)}`,
      "  validation_state: preview_only"
    );
    return lines.join("\n") + "\n";
  }

  Log.info("module.ready", { palettes: Object.keys(palettes).length });
  window.LabFlowExport = {palettes, download, projectYaml, pipelineContractJson, jsonl, csv, nomadYaml, zipBytes};
})();
