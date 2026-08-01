(() => {
  'use strict';
  const init = root => {
    const S = LabFlowProjectStore, esc = S.esc;
    let state = S.get('materials', {solvents:[], solutes:[], solutions:[], resources:[]}), editing = null;
    const form = root.querySelector('[data-materials-editor]'), list = root.querySelector('[data-materials-list]');
    const cabinetMaterials = () => window.LabFlowCabinet?.list().filter(item => item.category === 'materials') || [];
    const isSolvent = item => /solvent/i.test(`${item.role||''} ${(item.tags||[]).join(' ')}`);
    const component = (type,item={}) => `<div class="component-row ${type}"><input class="input" list="cabinet${type==='solvent'?'Solvents':'Solutes'}" placeholder="${type==='solvent'?'Choose or name a solvent':'Choose or name a solute'}" value="${esc(item.name||'')}" data-component-name><input class="input" type="number" step="any" placeholder="Amount" value="${esc(item.amount??'')}" data-component-amount><input class="input" placeholder="${type==='solvent'?'% v/v':'mmol or mg'}" value="${esc(item.unit||'')}" data-component-unit><button class="icon-button small" type="button" data-remove-component aria-label="Remove component">×</button></div>`;
    const rows = selector => [...form.querySelectorAll(selector)].map(row => ({name:row.querySelector('[data-component-name]').value.trim(),amount:row.querySelector('[data-component-amount]').value,unit:row.querySelector('[data-component-unit]').value.trim()})).filter(item => item.name);
    const live = () => {
      const solvents = rows('[data-solvent-list] .component-row'), solutes = rows('[data-solute-list] .component-row');
      const numeric = solvents.map(item => Number(item.amount)||0), numericTotal = numeric.reduce((a,b)=>a+b,0);
      const colors = ['var(--accent)','var(--teal)','var(--violet)','var(--amber)','var(--red)'];
      const shares = solvents.map((item,index)=>{
        const share = numericTotal > 0 ? Math.max(4, numeric[index] / numericTotal * 100) : 100 / Math.max(1,solvents.length);
        return `<span style="--share:${share};--liquid:${colors[index%colors.length]}"><b>${esc(item.name)}</b><small>${esc(item.amount||'—')} ${esc(item.unit||'')}</small></span>`;
      }).join('');
      const soluteRows = solutes.length ? solutes.map(item=>`<span><b>${esc(item.name)}</b><small>${esc(item.amount||'—')} ${esc(item.unit||'')}</small></span>`).join('') : '<em>No solutes added yet</em>';
      const totalLabel = `${esc(form.totalVolume.value||'—')} ${esc(form.volumeUnit.value||'mL')}`;
      form.querySelector('[data-solution-visual]').innerHTML = `
        <header class="solution-map-head">
          <div><span class="eyebrow">2D recipe map</span><strong>${esc(form.name.value||'Untitled solution')}</strong><small>${esc(form.concentration.value||'Concentration not set')}</small></div>
          <div class="solution-map-total"><span>Total volume</span><b>${totalLabel}</b></div>
        </header>
        <section class="solution-map-section">
          <div class="solution-map-label"><strong>Solvent phase</strong><small>Relative composition</small></div>
          <div class="solution-composition-bar">${shares || '<span class="solution-empty-segment"><b>Add a solvent</b></span>'}</div>
        </section>
        <section class="solution-map-section">
          <div class="solution-map-label"><strong>Solutes & additives</strong><small>Target amount</small></div>
          <div class="solution-solute-list">${soluteRows}</div>
        </section>
        <footer class="solution-map-summary"><span><b>${solvents.length}</b><small>solvents</small></span><span><b>${solutes.length}</b><small>dissolved species</small></span><span><b>${totalLabel}</b><small>project batch</small></span></footer>`;
    };
    const hydrateOptions = () => {
      const resources = [...cabinetMaterials(), ...(state.resources||[])].filter((item,index,all)=>all.findIndex(other=>other.name===item.name)===index);
      form.querySelector('#cabinetSolvents').innerHTML = resources.filter(isSolvent).map(item=>`<option value="${esc(item.name)}">${esc(item.formula||item.role||'Solvent')}</option>`).join('');
      form.querySelector('#cabinetSolutes').innerHTML = resources.filter(item=>!isSolvent(item)).map(item=>`<option value="${esc(item.name)}">${esc(item.formula||item.role||'Material')}</option>`).join('');
      const shelf = root.querySelector('[data-project-materials]'), selected = state.resources||[];
      shelf.hidden = !selected.length;
      root.querySelector('[data-project-material-list]').innerHTML = selected.map(item=>`<span><i>${isSolvent(item)?'∿':'◇'}</i><strong>${esc(item.name)}</strong><small>${esc(item.formula||item.role||'Material')}</small></span>`).join('');
    };
    const render = () => {
      const overview=root.querySelector('[data-materials-overview]');
      if(overview){const resources=state.resources||[],solventCount=resources.filter(isSolvent).length||state.solvents.length,soluteCount=Math.max(0,resources.length-solventCount)||state.solutes.length;overview.innerHTML=[[state.solutions.length,'saved solutions'],[solventCount,'solvents in context'],[soluteCount,'solutes / materials'],[state.solutions.reduce((sum,item)=>sum+(Number(item.totalVolume)||0),0).toFixed(1),'mL prepared']].map(([value,label])=>`<span><b>${esc(value)}</b><small>${esc(label)}</small></span>`).join('');}
      list.innerHTML = state.solutions.map(solution=>{const solventTotal=solution.solvents.reduce((sum,item)=>sum+(Number(item.amount)||0),0)||solution.solvents.length||1;const bar=solution.solvents.map((item,index)=>`<span style="--share:${Math.max(1,(Number(item.amount)||1)/solventTotal*100)};--tone:${10+index*7}%">${esc(item.name)}</span>`).join('');return `<article class="panel record-card solution-record"><div class="solution-record-head"><div><span class="eyebrow">${solution.origin?'Cabinet snapshot':'Project recipe'}</span><h4>${esc(solution.name)}</h4></div><span class="pipeline-badge"><i></i>${esc(solution.concentration||'Recipe')}</span></div><div class="solution-record-meta"><span>${esc(solution.totalVolume||'—')} ${esc(solution.volumeUnit||'mL')}</span><span>${solution.solvents.length} solvent${solution.solvents.length===1?'':'s'}</span><span>${solution.solutes.length} solute${solution.solutes.length===1?'':'s'}</span></div><div class="solution-record-composition"><div class="solution-record-bar">${bar}</div><strong>${esc(solution.concentration||'—')}</strong></div><div class="solution-record-solutes">${solution.solutes.map(item=>`<span><b>${esc(item.name)}</b> ${esc(item.amount)} ${esc(item.unit)}</span>`).join('')||'<span>No solutes</span>'}</div><small>${esc(solution.preparation||solution.notes||'Preparation details can be added later.')}</small><footer><button class="button small" data-edit-solution="${solution.id}">Edit</button><button class="button small" data-duplicate-solution="${solution.id}">Duplicate</button><button class="button small danger" data-remove-solution="${solution.id}">Remove</button></footer></article>`}).join('');
      root.querySelector('[data-materials-empty]').hidden = state.solutions.length > 0;
      hydrateOptions();
    };
    const open = solution => {
      editing = solution?.id || null; form.reset(); form.hidden = false;
      form.name.value=solution?.name||''; form.concentration.value=solution?.concentration||''; form.totalVolume.value=solution?.totalVolume||5; form.volumeUnit.value=solution?.volumeUnit||'mL'; form.preparation.value=solution?.preparation||''; form.handling.value=solution?.handling||''; form.storage.value=solution?.storage||''; form.notes.value=solution?.notes||'';
      form.querySelector('[data-solvent-list]').innerHTML=(solution?.solvents||[{name:'DMF',amount:80,unit:'% v/v'},{name:'DMSO',amount:20,unit:'% v/v'}]).map(item=>component('solvent',item)).join('');
      form.querySelector('[data-solute-list]').innerHTML=(solution?.solutes||[{name:'PbI₂',amount:'',unit:'mmol'}]).map(item=>component('solute',item)).join('');
      live(); form.scrollIntoView({behavior:'smooth',block:'start'});
    };
    root.onclick = event => {
      const button=event.target.closest('button'); if(!button)return;
      const find=id=>state.solutions.find(item=>item.id===id);
      if(button.matches('[data-materials-new]'))open();
      if(button.matches('[data-materials-close]'))form.hidden=true;
      if(button.dataset.editSolution)open(find(button.dataset.editSolution));
      if(button.dataset.duplicateSolution){const source=find(button.dataset.duplicateSolution),copy={...structuredClone(source),id:S.uid('solution'),name:`${source.name} copy`,origin:null};state.solutions.push(copy);S.set('materials',state);render();}
      if(button.dataset.removeSolution){state.solutions=state.solutions.filter(item=>item.id!==button.dataset.removeSolution);S.set('materials',state);render();}
      if(button.matches('[data-add-solvent]'))form.querySelector('[data-solvent-list]').insertAdjacentHTML('beforeend',component('solvent'));
      if(button.matches('[data-add-solute]'))form.querySelector('[data-solute-list]').insertAdjacentHTML('beforeend',component('solute'));
      if(button.matches('[data-remove-component]'))button.closest('.component-row').remove();
      live();
    };
    form.oninput=live;
    form.onsubmit = event => {
      event.preventDefault(); const old=state.solutions.find(item=>item.id===editing);
      const solution={id:editing||S.uid('solution'),name:form.name.value.trim(),concentration:form.concentration.value.trim(),totalVolume:Number(form.totalVolume.value)||0,volumeUnit:form.volumeUnit.value,solvents:rows('[data-solvent-list] .component-row'),solutes:rows('[data-solute-list] .component-row'),preparation:form.preparation.value.trim(),handling:form.handling.value.trim(),storage:form.storage.value.trim(),notes:form.notes.value.trim(),origin:old?.origin||null,savedAt:new Date().toISOString()};
      const index=state.solutions.findIndex(item=>item.id===solution.id); index<0?state.solutions.push(solution):state.solutions[index]=solution;
      state.solvents=[...new Set(state.solutions.flatMap(item=>item.solvents.map(component=>component.name)))]; state.solutes=[...new Set(state.solutions.flatMap(item=>item.solutes.map(component=>component.name)))]; S.set('materials',state);
      if(form.saveCabinet.checked&&window.LabFlowCabinet)LabFlowCabinet.save({...solution,id:null,category:'solutions',type:'Solution',role:'Solution recipe',description:solution.notes||'Reusable solution recipe.',tags:[solution.name,solution.concentration,...solution.solvents.map(item=>item.name)].filter(Boolean)});
      form.hidden=true; render();
    };
    const onProjectData = event => {state=event.detail.materials||state;render();};
    document.addEventListener('labflow:project-data',onProjectData,{once:true});
    render();
  };
  document.addEventListener('labflow:pipeline-step',event=>{if(event.detail.pipelineId==='chose'&&event.detail.id==='materials')requestAnimationFrame(()=>init(document.getElementById('materialsTool')))});
})();
