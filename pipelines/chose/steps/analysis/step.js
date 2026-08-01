(() => {
  'use strict';

  const init = root => {
    if (!root || root.dataset.analysisInit === '1') return;
    root.dataset.analysisInit = '1';
    const S = LabFlowProjectStore, M = LabFlowMeasurements, esc = S.esc;
    const datasets = (S.get('data',{datasets:[]}).datasets || []).map(dataset => ({ ...dataset, measurementType: dataset.measurementType || M.typeFromLegacy(dataset.measurement), conditions: dataset.conditions || {}, mapping: dataset.mapping || [], rows: dataset.rows || [], columns: dataset.columns || [] }));
    const stacks = S.get('fabrication',{stacks:[]}).stacks || [];
    let analysis = S.get('analysis',{comparisons:[],conclusions:[]});
    const typeSelect = root.querySelector('[data-analysis-type]'), metricSelect = root.querySelector('[data-analysis-metric]');
    const typeIds = [...new Set(datasets.map(dataset => dataset.measurementType).filter(Boolean))];

    const stackName = id => stacks.find(stack => stack.id === id)?.name || 'Project';
    const target = dataset => dataset.sample || dataset.target || stackName(dataset.stackId);
    const type = dataset => M.types[dataset.measurementType] || M.types.generic;
    const mapFor = dataset => {
      const x = dataset.mapping.findIndex(item => item.meaning === 'x'), y = dataset.mapping.findIndex(item => item.meaning === 'signal');
      return x >= 0 && y >= 0 ? {x,y} : M.mapping(dataset.measurementType,dataset.columns);
    };
    const pointsFor = dataset => dataset.manual ? [] : M.series(dataset.measurementType,dataset.columns,dataset.rows,mapFor(dataset));
    const derived = dataset => dataset.manual
      ? dataset.rows.map(row => ({label:row[0],value:Number(row[1]),unit:row[2],source:'user'})).filter(item => item.label && Number.isFinite(item.value))
      : (dataset.derivedMetrics?.length ? dataset.derivedMetrics : M.summary(dataset.measurementType,pointsFor(dataset)));

    typeSelect.innerHTML = typeIds.length ? typeIds.map(id => `<option value="${esc(id)}">${esc(M.types[id]?.label || id)}</option>`).join('') : '<option value="generic">No Measurements</option>';

    function selectedDatasets() {
      const ids = [...root.querySelectorAll('[data-analysis-measurements] input:checked')].map(input => input.value);
      return datasets.filter(dataset => ids.includes(dataset.id));
    }

    function renderMeasurementList() {
      const available = datasets.filter(dataset => dataset.measurementType === typeSelect.value), list = root.querySelector('[data-analysis-measurements]');
      list.innerHTML = available.length ? available.map((dataset,index) => `<label class="measurement-analysis-choice"><input type="checkbox" value="${esc(dataset.id)}" ${index < 4 ? 'checked' : ''}><span class="measurement-type-mark ${esc(dataset.measurementType)}">${esc(type(dataset).short)}</span><span><strong>${esc(target(dataset))}</strong><small>${esc(dataset.filename || 'Manual entry')} · ${esc(dataset.parseState || dataset.status || 'Structured')}</small></span></label>`).join('') : '<div class="useful-empty"><small>No Measurements of this type.</small></div>';
      const manualOnly = available.length && available.every(dataset => dataset.manual);
      const metricField = root.querySelector('[data-analysis-metric-field]');
      metricField.hidden = !manualOnly;
      if (manualOnly) {
        const metrics = [...new Set(available.flatMap(dataset => derived(dataset).map(item => item.label)))];
        metricSelect.innerHTML = metrics.map(metric => `<option>${esc(metric)}</option>`).join('');
      }
      render();
    }

    function curveChart(selected) {
      const series = selected.map(dataset => ({ dataset, points: pointsFor(dataset) })).filter(item => item.points.length > 1);
      if (!series.length) return null;
      const all = series.flatMap(item => item.points), xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),xr=xmax-xmin||1,yr=ymax-ymin||1;
      const W=760,H=330,p={l:58,r:22,t:24,b:48};
      const grid = [0,.25,.5,.75,1].map(frac => { const y=p.t+frac*(H-p.t-p.b); return `<line class="grid" x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}"/>`; }).join('');
      const lines = series.map((item,index) => {
        const coords=item.points.map(([x,y])=>`${p.l+(x-xmin)/xr*(W-p.l-p.r)},${p.t+(ymax-y)/yr*(H-p.t-p.b)}`).join(' ');
        return `<polyline class="series series-${index%5}" points="${coords}"/>`;
      }).join('');
      const selectedType = M.types[typeSelect.value] || M.types.generic;
      return { svg:`${grid}<line class="axis" x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}"/><line class="axis" x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}"/>${lines}<text x="${W/2}" y="${H-12}" text-anchor="middle">${esc(selectedType.units?.x || 'x')}</text><text x="16" y="${H/2}" transform="rotate(-90 16 ${H/2})" text-anchor="middle">${esc(selectedType.units?.y || 'signal')}</text><text x="${p.l}" y="16">${esc(ymax.toFixed(2))}</text><text x="${p.l}" y="${H-p.b+17}">${esc(xmin.toFixed(1))}</text><text x="${W-p.r-28}" y="${H-p.b+17}">${esc(xmax.toFixed(1))}</text>`, series };
    }

    function manualChart(selected) {
      const metric = metricSelect.value;
      const values = selected.map(dataset => {
        const item = derived(dataset).find(value => value.label === metric);
        return item ? {dataset,value:item.value,unit:item.unit} : null;
      }).filter(Boolean);
      if (!values.length) return null;
      const W=760,H=330,p={l:58,r:22,t:24,b:55},max=Math.max(...values.map(item=>Math.abs(item.value)),1),bar=Math.min(82,(W-p.l-p.r)/Math.max(values.length,1)*.55),gap=(W-p.l-p.r)/Math.max(values.length,1);
      const bars=values.map((item,index)=>{const h=Math.abs(item.value)/max*(H-p.t-p.b-20),x=p.l+gap*index+(gap-bar)/2,y=H-p.b-h;return `<g><rect class="metric-bar" x="${x}" y="${y}" width="${bar}" height="${h}"/><text x="${x+bar/2}" y="${y-7}" text-anchor="middle">${item.value.toFixed(2)}</text><text x="${x+bar/2}" y="${H-p.b+18}" text-anchor="middle">${esc(target(item.dataset))}</text></g>`}).join('');
      return {svg:`<line class="axis" x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}"/>${bars}<text x="${p.l}" y="16">${esc(metric)}${values[0]?.unit ? ` · ${esc(values[0].unit)}` : ''}</text>`,series:values.map(item=>({dataset:item.dataset,points:[]}))};
    }

    function renderRequest(selected) {
      const request = root.querySelector('[data-analysis-request]');
      const missingArea = selected.filter(dataset => ['jv','dark_jv'].includes(dataset.measurementType) && !dataset.conditions?.activeArea);
      if (selected.length > 1 && missingArea.length) {
        request.hidden = false;
        request.innerHTML = `<span class="request-mark">+</span><div><strong>Comparison quality can be improved</strong><p>Active device area is missing for ${missingArea.length} selected JV Measurement${missingArea.length>1?'s':''}. You can still continue.</p></div><button class="button small" type="button" data-action="pipeline-step" data-step="data">Add active area</button><button class="button small" type="button" data-analysis-dismiss>Continue anyway</button>`;
      } else request.hidden = true;
    }

    function render() {
      const selected = selectedDatasets(), allForType=datasets.filter(dataset=>dataset.measurementType===typeSelect.value), manualOnly=allForType.length&&allForType.every(dataset=>dataset.manual);
      renderRequest(selected);
      const chart = manualOnly ? manualChart(selected) : curveChart(selected);
      const svg = root.querySelector('[data-analysis-chart]'), legend = root.querySelector('[data-analysis-legend]');
      svg.innerHTML = chart?.svg || '<text x="380" y="160" text-anchor="middle">Select compatible Measurements to preview them.</text>';
      legend.innerHTML = chart?.series?.length ? chart.series.map((item,index)=>`<span><i class="series-key series-${index%5}"></i><strong>${esc(target(item.dataset))}</strong><small>${esc(item.dataset.filename || 'Manual entry')}</small></span>`).join('') : '';
      const typeLabel = M.types[typeSelect.value]?.label || 'Measurement';
      root.querySelector('[data-analysis-title]').textContent = manualOnly ? `${typeLabel} · ${metricSelect.value || 'metric comparison'}` : `${typeLabel} comparison`;
      root.querySelector('[data-analysis-count]').textContent = `${selected.length} selected of ${allForType.length}`;
      root.querySelector('[data-analysis-chart-note]').textContent = manualOnly ? 'Summary metrics by target' : 'Raw mapped curves · no source data overwritten';
      root.querySelector('[data-analysis-summary]').innerHTML = selected.length ? selected.map(dataset => {
        const metrics=derived(dataset).slice(0,5);
        return `<article class="analysis-measurement-card"><header><span class="measurement-type-mark ${esc(dataset.measurementType)}">${esc(type(dataset).short)}</span><div><strong>${esc(target(dataset))}</strong><small>${esc(dataset.filename || 'Manual entry')}</small></div></header>${metrics.length?`<div>${metrics.map(item=>`<span><small>${esc(item.label)}</small><strong>${Number.isFinite(Number(item.value))?Number(item.value).toFixed(2):esc(item.value)} ${esc(item.unit||'')}</strong><i>${esc(item.source||'recorded')}</i></span>`).join('')}</div>`:'<p>No derived summary for this Measurement.</p>'}</article>`;
      }).join('') : '<div class="useful-empty"><small>Select at least one Measurement.</small></div>';
      root.querySelector('[data-analysis-table]').innerHTML = `<thead><tr><th>Measurement</th><th>Target</th><th>Source</th><th>Context</th><th>Provenance</th></tr></thead><tbody>${selected.map(dataset=>`<tr><td><strong>${esc(type(dataset).label)}</strong></td><td>${esc(target(dataset))}</td><td>${esc(dataset.filename||'Manual entry')}</td><td>${esc(stackName(dataset.stackId))}</td><td><span class="badge">${esc(dataset.provenance?.measurementType||'user')}</span></td></tr>`).join('')}</tbody>`;
    }

    typeSelect.onchange = renderMeasurementList;
    metricSelect.onchange = render;
    root.querySelector('[data-analysis-measurements]').onchange = render;
    root.onclick = event => { if (event.target.closest('[data-analysis-dismiss]')) root.querySelector('[data-analysis-request]').hidden = true; };

    const form = root.querySelector('[data-analysis-form]');
    form.onsubmit = event => {
      event.preventDefault(); const text=form.text.value.trim(); if(!text)return;
      analysis.conclusions.push({id:S.uid('conclusion'),text,measurementType:typeSelect.value,measurementIds:selectedDatasets().map(dataset=>dataset.id),origin:'human',createdAt:new Date().toISOString()});
      analysis.comparisons.push({measurementType:typeSelect.value,metric:metricSelect.value||null,measurementIds:selectedDatasets().map(dataset=>dataset.id),savedAt:new Date().toISOString()});
      S.set('analysis',analysis); form.reset();
    };

    root.querySelector('[data-analysis-ai]').onclick = () => {
      const selected=selectedDatasets(), label=M.types[typeSelect.value]?.label||'measurement';
      if(!selected.length){root.querySelector('[data-analysis-ai-note]').textContent='Demo assistant: select Project Measurements first.';return;}
      if(selected.every(dataset=>dataset.manual)){
        const metric=metricSelect.value, ranked=selected.map(dataset=>({dataset,item:derived(dataset).find(item=>item.label===metric)})).filter(x=>x.item).sort((a,b)=>b.item.value-a.item.value);
        root.querySelector('[data-analysis-ai-note]').textContent=ranked.length?`Demo draft only: ${target(ranked[0].dataset)} has the highest recorded ${metric} (${ranked[0].item.value} ${ranked[0].item.unit||''}). Verify replicates and uncertainty before deciding.`:'Demo assistant: no comparable numeric metric found.';
      }else{
        const summaries=selected.map(dataset=>({dataset,metrics:derived(dataset)}));
        const metricText=summaries.flatMap(item=>item.metrics.slice(0,2).map(metric=>`${target(item.dataset)} ${metric.label} ${metric.value} ${metric.unit}`)).join('; ');
        root.querySelector('[data-analysis-ai-note]').textContent=`Demo draft only: ${selected.length} ${label} Measurement${selected.length>1?'s':''} selected. ${metricText||'Compare curve shape and acquisition context.'} Human interpretation remains required.`;
      }
    };

    renderMeasurementList();
  };

  document.addEventListener('labflow:pipeline-step', event => {
    if (event.detail.pipelineId === 'chose' && event.detail.id === 'analysis') requestAnimationFrame(() => init(document.getElementById('analysisTool')));
  });
})();
