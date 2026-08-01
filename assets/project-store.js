(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = () => {
    const user = localStorage.getItem('labflow-user') || 'ew';
    const requested = new URLSearchParams(location.search).get('project');
    const project = requested || sessionStorage.getItem(`labflow-project-${user}`) || 'mixed';
    return `labflow-pipeline-data-${user}-${project}`;
  };
  function read() { try { return JSON.parse(sessionStorage.getItem(key()) || '{}'); } catch (_) { return {}; } }
  function write(state) { sessionStorage.setItem(key(), JSON.stringify(state)); document.dispatchEvent(new CustomEvent('labflow:project-data',{detail:clone(state)})); return state; }
  function get(section, fallback) { const value = read()[section]; return value === undefined ? clone(fallback) : clone(value); }
  function set(section, value) { const state = read(); state[section] = clone(value); write(state); return value; }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`; }
  function csv(text, delimiter) {
    const rows=[]; let row=[], cell='', quoted=false;
    for(let i=0;i<String(text).length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quoted&&next==='"'){cell+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
    row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;
  }
  function parseText(name, text) {
    const ext=(name.split('.').pop()||'').toLowerCase(), raw=String(text||'');
    const objectsToTable=list=>{const safe=list.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)),columns=[...new Set(safe.flatMap(item=>Object.keys(item)))];return {columns,rows:safe.map(item=>columns.map(column=>Array.isArray(item?.[column])?item[column].join('; '):(item?.[column]??'')))};};
    if(ext==='json'||ext==='jsonl'||ext==='ndjson'){
      if(ext!=='json')return objectsToTable(raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>JSON.parse(line)));
      const parsed=JSON.parse(raw);
      if(Array.isArray(parsed))return Array.isArray(parsed[0])?{columns:parsed[0].map((_,i)=>`Column ${i+1}`),rows:parsed}:objectsToTable(parsed);
      if(parsed&&typeof parsed==='object'){
        const entries=Object.entries(parsed),arrays=entries.filter(([,value])=>Array.isArray(value));
        if(arrays.length===entries.length&&arrays.length){const length=Math.max(...arrays.map(([,value])=>value.length));return {columns:entries.map(([key])=>key),rows:Array.from({length},(_,i)=>entries.map(([,value])=>value[i]??''))};}
        return objectsToTable([parsed]);
      }
      return {columns:['Value'],rows:[[parsed]]};
    }
    if(ext==='xml'){
      const doc=new DOMParser().parseFromString(raw,'application/xml');
      if(doc.querySelector('parsererror'))throw new Error('Invalid XML');
      const records=[...doc.querySelectorAll('record, row, item, measurement, point')],nodes=records.length?records:[doc.documentElement];
      return objectsToTable(nodes.map(node=>Object.fromEntries([...node.children].map(child=>[child.tagName,child.textContent.trim()]))));
    }
    if(ext==='yaml'||ext==='yml'){
      const blocks=raw.split(/\n(?=\s*-\s+[^\n]+:)/).map(block=>block.replace(/^\s*-\s*/,''));
      const list=blocks.map(block=>Object.fromEntries(block.split(/\r?\n/).map(line=>line.match(/^\s*([^:#][^:]*):\s*(.*)$/)).filter(Boolean).map(match=>[match[1].trim(),match[2].trim().replace(/^['"]|['"]$/g,'')]))).filter(item=>Object.keys(item).length);
      return objectsToTable(list.length?list:[{}]);
    }
    const contentLines=raw.split(/\r?\n/).filter(line=>line.trim()&&!/^\s*[#;]/.test(line));
    if(!contentLines.length)return {columns:[],rows:[]};
    const sample=contentLines.slice(0,20),candidates=['\t',';',',','|'];
    const scored=candidates.map(delimiter=>{const counts=sample.map(line=>line.split(delimiter).length),multi=counts.filter(count=>count>1),mode=multi.length?multi.sort((a,b)=>multi.filter(x=>x===b).length-multi.filter(x=>x===a).length)[0]:1,consistent=counts.filter(count=>count===mode).length;return{delimiter,mode,score:mode>1?consistent*10+mode:0};}).sort((a,b)=>b.score-a.score);
    const whitespace=scored[0].score===0&&sample.some(line=>line.trim().split(/\s+/).length>1);
    let rows=whitespace?contentLines.map(line=>line.trim().split(/\s+/)):csv(contentLines.join('\n'),scored[0].delimiter);
    const width=Math.max(...rows.map(row=>row.length),0);rows=rows.map(row=>Array.from({length:width},(_,i)=>row[i]??''));
    const first=rows[0]||[],second=rows[1]||[],looksNumeric=value=>value!==''&&Number.isFinite(Number(String(value).trim().replace(',','.'))),hasHeader=first.some((value,index)=>!looksNumeric(value)&&looksNumeric(second[index]));
    const columns=hasHeader?rows.shift():first.map((_,index)=>`Column ${index+1}`);
    return {columns,rows};
  }
  const esc = value => String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  window.LabFlowProjectStore=Object.freeze({read,write,get,set,uid,parseText,esc});
})();
