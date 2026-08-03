(function () {
  "use strict";

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
  function download(value, name) { const blob=value instanceof Blob?value:new Blob([value]);const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1500); }
  const yamlString = (value) => typeof value === "number" || typeof value === "boolean" ? String(value) : `"${String(value ?? "").replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`;
  function projectYaml(project, pipeline) { const completed=Math.ceil(project.progress/100*pipeline.steps.length);return ["schema: labflow.project.v1",`id: ${yamlString(project.id)}`,`name: ${yamlString(project.name)}`,`pipeline: ${yamlString(pipeline.id)}`,`pipeline_version: ${yamlString(pipeline.version)}`,`status: ${yamlString(project.status)}`,`progress: ${project.progress}`,`owner: ${yamlString(project.owner)}`,`objective: ${yamlString(project.objective)}`,"counts:",`  samples: ${project.samples}`,`  measurements: ${project.measurements}`,`  findings: ${project.findings}`,"steps:",...pipeline.steps.flatMap((step,index)=>[`  - id: ${yamlString(step.id)}`,`    status: ${index<completed?"completed":"available"}`,`    output: ${yamlString(step.output)}`])].join("\n")+"\n"; }
  function jsonl(project, data) { return data.map((row)=>JSON.stringify({project_id:project.id,measurement_type:"JV summary",...row})).join("\n")+"\n"; }
  function csv(data) { const keys=Object.keys(data[0]||{});const quote=(value)=>/[",\n]/.test(String(value))?`"${String(value).replace(/"/g,'""')}"`:value;return keys.join(",")+"\n"+data.map((row)=>keys.map((key)=>quote(row[key])).join(",")).join("\n")+"\n"; }
  function nomadYaml(project) { return `definitions:\n  name: LabFlow project export\ndata:\n  project_id: ${yamlString(project.id)}\n  project_name: ${yamlString(project.name)}\n  source: LabFlow static research workspace\n  upload_state: preview\n`; }

  window.LabFlowExport = {palettes, download, projectYaml, jsonl, csv, nomadYaml, zipBytes, zipStore:(files,type="application/zip")=>new Blob([zipBytes(files)],{type})};
})();
