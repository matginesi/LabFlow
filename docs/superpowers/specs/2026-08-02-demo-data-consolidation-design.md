# Phase B Design: Demo Data Consolidation

## Objective
Consolidate all duplicated demo data (PSC-2026-041 ×29, SOL-081 ×11, stackData, cabinet seed) into a single canonical source file `assets/demo-data.js`, consumed by `demo-projects.js`, `cabinet-store.js`, and `app.js` via load-order global namespace.

## Current State (Post Phase A)
- `assets/demo-projects.js` — defines 4 Project seeds inline (mixed, annealing, thickness, solvent-ratio)
- `assets/cabinet-store.js` — defines 20-item seed array inline
- `assets/app.js` — duplicates cabinet items (lines 458-477) and `stackData` object (lines 1014+)
- Validator checks: demo-projects.js markers + cabinet-store.js seed pattern

## Target Architecture

### 1. New File: `assets/demo-data.js`
Canonical data definitions, loaded before consumers:

```javascript
// assets/demo-data.js
(() => {
  'use strict';
  window.LabFlowDemoData = {
    // Canonical materials
    materials: {
      solvents: [
        { id: 'mat-dmf', name: 'DMF', formula: 'C₃H₇NO', role: 'Solvent', supplier: 'Sigma-Aldrich', purity: '99.8%' },
        { id: 'mat-dmso', name: 'DMSO', formula: 'C₂H₆OS', role: 'Solvent', supplier: 'Sigma-Aldrich', purity: '99.9%' }
      ],
      solutes: [
        { id: 'mat-pbi2', name: 'PbI₂', formula: 'PbI₂', role: 'Lead precursor', supplier: 'TCI', purity: '99.99%' },
        { id: 'mat-fai', name: 'FAI', formula: 'CH₅IN₂', role: 'A-site precursor', supplier: 'GreatCell Solar', purity: '99.99%' },
        { id: 'mat-csi', name: 'CsI', formula: 'CsI', role: 'A-site precursor', supplier: 'Sigma-Aldrich', purity: '99.999%' }
      ],
      functional: [
        { id: 'mat-sno2', name: 'SnO₂', role: 'Electron transport layer', supplier: 'Alfa Aesar' },
        { id: 'mat-spiro', name: 'Spiro-OMeTAD', role: 'Hole transport layer', formula: 'C₈₁H₆₈N₄O₈', supplier: 'Lumtec', purity: '99%' },
        { id: 'mat-cbz', name: 'Chlorobenzene', role: 'Antisolvent', formula: 'C₆H₅Cl', supplier: 'Sigma-Aldrich', purity: '99.8%' }
      ]
    },

    // Canonical solutions
    solutions: {
      recipes: [
        { id: 'sol-fa-cs-12m', name: 'FA–Cs precursor · 1.2 M', concentration: '1.2 M', totalVolume: 5, volumeUnit: 'mL',
          solvents: [{name:'DMF',amount:80,unit:'% v/v'},{name:'DMSO',amount:20,unit:'% v/v'}],
          solutes: [{name:'FAI',amount:1,unit:'mmol'},{name:'PbI₂',amount:1.2,unit:'mmol'},{name:'CsI',amount:0.15,unit:'mmol'}],
          preparation: 'Dissolve under N₂ and stir until clear.', handling: 'Store dark under N₂.' },
        { id: 'sol-reference-08m', name: 'Reference precursor · 0.8 M', concentration: '0.8 M', totalVolume: 3, volumeUnit: 'mL',
          solvents: [{name:'DMF',amount:75,unit:'% v/v'},{name:'DMSO',amount:25,unit:'% v/v'}],
          solutes: [{name:'FAI',amount:0.8,unit:'mmol'},{name:'PbI₂',amount:0.8,unit:'mmol'}],
          preparation: 'Stir 45 min at room temperature.', handling: 'Filter 0.22 µm before use.' }
      ],
      batches: [
        { id: 'batch081', name: 'SOL-081', type: 'Prepared solution batch', recipeId: 'sol-fa-cs-12m',
          meta: 'Prepared 30 Jul 2026 · clear · 4.2 mL remaining', details: [['Recipe','FA-Cs 1.2 M'],['Prepared by','Eleanor Wright'],['Initial volume','5.0 mL'],['Remaining','4.2 mL']] }
      ]
    },

    // Canonical substrates
    substrates: [
      { id: 'sub-ito-25', name: 'Glass / ITO · 25 × 25 mm', material: 'Glass / ITO', dimensions: '25 × 25 mm', thickness: '1.1 mm', sheetResistance: '15 Ω/sq', quantity: 36 },
      { id: 'sub-fuo-15', name: 'Glass / FTO · 15 × 15 mm', material: 'Glass / FTO', dimensions: '15 × 15 mm', thickness: '2.2 mm' }
    ],

    // Canonical stack templates
    stacks: {
      templates: [
        { id: 'stack-psc-nip', name: 'PSC n-i-p reference', architecture: 'n-i-p',
          layers: [
            {material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Sequential cleaning + UV/O₃'},
            {material:'SnO₂',role:'Electron transport',thickness:30,unit:'nm',method:'Spin coating'},
            {material:'FA–Cs perovskite',role:'Absorber',thickness:455,unit:'nm',method:'Antisolvent spin coating'},
            {material:'Spiro-OMeTAD',role:'Hole transport',thickness:180,unit:'nm',method:'Spin coating'},
            {material:'Au',role:'Top contact',thickness:80,unit:'nm',method:'Thermal evaporation'}
          ],
          processes: [
            {name:'SnO₂ coating',value:'3000 rpm',duration:'30 s',notes:'150 °C · 30 min'},
            {name:'Absorber coating',value:'1200 rpm',duration:'30 s',notes:'150 µL CB at 12 s'},
            {name:'Annealing',value:'100 °C',duration:'30 min',notes:'N₂'},
            {name:'Au evaporation',value:'2×10⁻⁶ mbar',duration:'80 nm',notes:'Shadow mask'}
          ] },
        { id: 'stack-psc-pin', name: 'PSC p-i-n screening', architecture: 'p-i-n',
          layers: [
            {material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Cleaned'},
            {material:'NiOx',role:'Hole transport',thickness:25,unit:'nm',method:'Spin coating'},
            {material:'Perovskite',role:'Absorber',thickness:480,unit:'nm',method:'Spin coating'},
            {material:'C60',role:'Electron transport',thickness:30,unit:'nm',method:'Evaporation'},
            {material:'Ag',role:'Back contact',thickness:100,unit:'nm',method:'Evaporation'}
          ],
          processes: [
            {name:'Spin coating',value:'3500 rpm',duration:'30 s'},
            {name:'Annealing',value:'100 °C',duration:'25 min'}
          ] }
      ],
      projectStacks: {
        'STACK-MIX-A': { id: 'STACK-MIX-A', name: 'Reference n-i-p · A', condition: '1200 rpm absorber',
          layers: [
            {material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Sequential cleaning + UV/O₃'},
            {material:'SnO₂',role:'Electron transport',thickness:30,unit:'nm',method:'Spin coating'},
            {material:'FA–Cs perovskite',role:'Absorber',thickness:455,unit:'nm',method:'Antisolvent spin coating'},
            {material:'Spiro-OMeTAD',role:'Hole transport',thickness:180,unit:'nm',method:'Spin coating'},
            {material:'Au',role:'Top contact',thickness:80,unit:'nm',method:'Thermal evaporation'}
          ],
          processes: [
            {name:'SnO₂ coating',value:'3000 rpm',duration:'30 s',notes:'150 °C · 30 min'},
            {name:'Absorber coating',value:'1200 rpm',duration:'30 s',notes:'150 µL CB at 12 s'},
            {name:'Annealing',value:'100 °C',duration:'30 min',notes:'N₂'},
            {name:'Au evaporation',value:'2×10⁻⁶ mbar',duration:'80 nm',notes:'Shadow mask'}
          ] },
        'STACK-MIX-B': { id: 'STACK-MIX-B', name: 'Optimised n-i-p · B', condition: '1500 rpm absorber',
          layers: [
            {material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Sequential cleaning + UV/O₃'},
            {material:'SnO₂',role:'Electron transport',thickness:30,unit:'nm',method:'Spin coating'},
            {material:'FA–Cs perovskite',role:'Absorber',thickness:392,unit:'nm',method:'Antisolvent spin coating'},
            {material:'Spiro-OMeTAD',role:'Hole transport',thickness:180,unit:'nm',method:'Spin coating'},
            {material:'Au',role:'Top contact',thickness:80,unit:'nm',method:'Thermal evaporation'}
          ],
          processes: [
            {name:'SnO₂ coating',value:'3000 rpm',duration:'30 s',notes:'150 °C · 30 min'},
            {name:'Absorber coating',value:'1500 rpm',duration:'30 s',notes:'150 µL CB at 12 s'},
            {name:'Annealing',value:'100 °C',duration:'30 min',notes:'N₂'},
            {name:'Au evaporation',value:'2×10⁻⁶ mbar',duration:'80 nm',notes:'Shadow mask'}
          ] }
      }
    },

    // Canonical protocols
    protocols: [
      { id: 'prot-psc-nip', name: 'PSC n-i-p fabrication', steps: [
        {name:'Clean substrate',description:'Clean Glass / ITO.'},
        {name:'Spin coat',description:'Deposit transport and absorber layers.'},
        {name:'Anneal',description:'Anneal the absorber film.'}
      ] },
      { id: 'prot-jv-standard', name: 'J–V characterisation · standard', steps: [
        {name:'Stabilise sample',description:'Hold sample at measurement temperature.'},
        {name:'Set illumination',description:'Verify AM1.5G calibration.'},
        {name:'Run scans',description:'Acquire forward and reverse scans.'}
      ] }
    ],

    // Canonical instruments
    instruments: [
      { id: 'inst-spin-01', name: 'Spin Coater 01', manufacturer: 'Laurell', model: 'WS-650', capabilities: 'Spin coating · antisolvent dripping' },
      { id: 'inst-solar-01', name: 'Solar Simulator', manufacturer: 'Newport Oriel', model: 'Sol3A', capabilities: 'AM1.5G · J–V' },
      { id: 'inst-prof-01', name: 'Profilometer', manufacturer: 'Bruker', model: 'Dektak', capabilities: 'Step height · film thickness' },
      { id: 'inst-hot-02', name: 'Hot Plate 02', manufacturer: 'Generic', model: 'HP-02', capabilities: 'Annealing · temperature control' }
    ],

    // Canonical measurements
    measurements: {
      jv: [
        { id: 'MEAS-JV-A', filename: 'S01-A_JV.csv', stackId: 'STACK-MIX-A', sample: 'S01-A',
          columns: ['Voltage V','Current density mA/cm2'],
          rows: [[-0.1,-22.1],[0,-21.9],[0.2,-21.5],[0.4,-20.8],[0.6,-19.5],[0.8,-16.8],[1.0,-8.4],[1.08,0.2]],
          conditions: {activeArea:'0.10 cm²',instrument:'JV-01',illumination:'AM1.5G · 100 mW/cm²',environment:'N₂ · 25 °C',protocol:'Reverse scan · 100 mV/s'} },
        { id: 'MEAS-JV-B', filename: 'S02-A_JV.csv', stackId: 'STACK-MIX-B', sample: 'S02-A',
          columns: ['Voltage V','Current density mA/cm2'],
          rows: [[-0.1,-23.5],[0,-23.2],[0.2,-22.9],[0.4,-22.5],[0.6,-21.8],[0.8,-20.2],[1.0,-14.0],[1.12,-2.0],[1.145,0.1]],
          conditions: {activeArea:'0.10 cm²',instrument:'JV-01',illumination:'AM1.5G · 100 mW/cm²',environment:'N₂ · 25 °C',protocol:'Reverse scan · 100 mV/s'} }
      ],
      ipce: [
        { id: 'MEAS-IPCE-B', filename: 'S02-A_EQE.txt', stackId: 'STACK-MIX-B', sample: 'S02-A',
          columns: ['Wavelength nm','EQE %'],
          rows: [[350,42],[400,71],[450,84],[500,89],[550,91],[600,90],[650,87],[700,82],[750,69],[800,18]],
          conditions: {instrument:'EQE-02',illumination:'Monochromatic chopped beam',environment:'Ambient · 24 °C',protocol:'300–850 nm'} }
      ],
      uvvis: [
        { id: 'MEAS-UVVIS-A', filename: 'film_A_uvvis.csv', stackId: 'STACK-MIX-A', sample: 'S01-B',
          columns: ['Wavelength nm','Absorbance'],
          rows: [[400,0.82],[450,1.04],[500,1.22],[550,1.31],[600,1.34],[650,1.28],[700,1.15],[750,0.78],[800,0.21]],
          conditions: {instrument:'UVVIS-01',environment:'Ambient'} }
      ]
    },

    // Canonical project seeds (consumed by demo-projects.js)
    projects: {
      mixed: {
        materials: { /* references to materials/solutions above */ },
        fabrication: { stacks: ['STACK-MIX-A','STACK-MIX-B'] },
        data: { datasets: ['MEAS-JV-A','MEAS-JV-B','MEAS-IPCE-B','MEAS-UVVIS-A'] },
        analysis: { comparisons: [{id:'CMP-MIX-01',measurementType:'jv',datasets:['MEAS-JV-A','MEAS-JV-B'],title:'Reference vs optimised absorber spin speed'}],
          conclusions: [{id:'CONC-MIX-01',origin:'human',text:'The 1500 rpm condition gives the strongest device response while preserving a comparable spectral profile. Repeat B with a second batch before treating the improvement as robust.',savedAt:'2026-07-30T15:40:00Z'}] }
      },
      annealing: {
        materials: { solvents:['DMF','DMSO'], solutes:['PbI₂','FAI'] },
        fabrication: { stacks: [90,100,110].map(t=>({id:`STACK-ANN-${t}`,name:`Anneal ${t} °C`,condition:`${t} °C · 30 min`,samples:[`ANN-${t}-A`,`ANN-${t}-B`]}) },
        data: { datasets: [ /* manual JV summaries */ ] },
        analysis: { conclusions: [{id:'ANN-CONC-1',origin:'human',text:'100 °C is the current best condition. The 110 °C group should be reviewed for film non-uniformity before a second run.',savedAt:'2026-07-30T17:15:00Z'}] }
      },
      thickness: { quick: { plan:{question:'How does spin speed affect dry film thickness?',conditions:['1000 rpm','1500 rpm','2000 rpm'],measurement:'Profilometer thickness'}, records:[{condition:'1000 rpm',value:486,unit:'nm'},{condition:'1500 rpm',value:401,unit:'nm'},{condition:'2000 rpm',value:338,unit:'nm'}], conclusion:'Thickness decreases monotonically across this screening window.' } },
      'solvent-ratio': { quick: { plan:{question:'Which DMF:DMSO ratio gives the best device PCE?',conditions:['5:1','4:1','3:1'],measurement:'Best-cell PCE'}, records:[{condition:'5:1',value:19.2,unit:'%'},{condition:'4:1',value:21.1,unit:'%'},{condition:'3:1',value:20.0,unit:'%'}], conclusion:'DMF:DMSO 4:1 is the strongest condition in this limited screen.' } }
    },

    // Cabinet seed (consumed by cabinet-store.js)
    cabinet: {
      seed: [
        {id:'mat-dmf',category:'materials',type:'Material',name:'DMF',role:'Solvent',description:'Anhydrous solvent for precursor solutions.',tags:['solvent','DMF'],formula:'C₃H₇NO',supplier:'Sigma-Aldrich',purity:'99.8%'},
        {id:'mat-dmso',category:'materials',type:'Material',name:'DMSO',role:'Solvent',description:'Co-solvent for perovskite precursor recipes.',tags:['solvent','DMSO'],formula:'C₂H₆OS',supplier:'Sigma-Aldrich',purity:'99.9%'},
        {id:'mat-pbi2',category:'materials',type:'Material',name:'PbI₂',role:'Precursor',description:'Lead iodide precursor.',tags:['solute','precursor'],formula:'PbI₂',supplier:'TCI',purity:'99.99%'},
        {id:'mat-fai',category:'materials',type:'Material',name:'FAI',role:'Precursor',description:'Formamidinium iodide precursor.',tags:['solute','precursor'],formula:'CH₅IN₂',supplier:'GreatCell Solar',purity:'99.99%'},
        {id:'mat-sno2',category:'materials',type:'Material',name:'SnO₂',role:'Electron transport layer',description:'Colloidal dispersion for the electron transport layer.',tags:['functional material','ETL'],formula:'SnO₂',supplier:'Alfa Aesar'},
        {id:'sol-fa-cs-12m',category:'solutions',type:'Solution',name:'FA–Cs precursor · 1.2 M',role:'Absorber precursor',description:'Reusable DMF:DMSO precursor recipe.',tags:['FA-Cs','1.2 M','DMF','DMSO'],concentration:'1.2 M',version:'1.0',totalVolume:5,volumeUnit:'mL',solvents:[{name:'DMF',amount:80,unit:'% v/v'},{name:'DMSO',amount:20,unit:'% v/v'}],solutes:[{name:'FAI',amount:1,unit:'mmol'},{name:'PbI₂',amount:1.2,unit:'mmol'},{name:'CsI',amount:.15,unit:'mmol'}],preparation:'Dissolve under N₂ and stir until clear.',handling:'Store dark under N₂.'},
        {id:'sub-ito-25',category:'substrates',type:'Substrate',name:'Glass / ITO · 25 × 25 mm',role:'Device substrate',description:'Standard rigid substrate for n-i-p devices.',tags:['glass','ITO'],material:'Glass / ITO',dimensions:'25 × 25 mm',thickness:'1.1 mm'},
        {id:'stack-psc-nip',category:'stacks',type:'Stack',name:'PSC n-i-p reference',role:'Reference architecture',description:'Reusable six-layer perovskite solar-cell stack.',tags:['PSC','n-i-p'],architecture:'n-i-p',layers:[{material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Cleaned'},{material:'SnO₂',role:'Electron transport',thickness:30,unit:'nm',method:'Spin coating'},{material:'Perovskite',role:'Absorber',thickness:520,unit:'nm',method:'Spin coating'},{material:'Spiro-OMeTAD',role:'Hole transport',thickness:180,unit:'nm',method:'Spin coating'},{material:'Au',role:'Back contact',thickness:80,unit:'nm',method:'Evaporation'}],processes:[{name:'Spin coating',value:'4000 rpm',duration:'30 s'},{name:'Annealing',value:'100 °C',duration:'30 min'}]},
        {id:'prot-psc-nip',category:'protocols',type:'Protocol',name:'PSC n-i-p fabrication',role:'Fabrication',description:'Short reusable fabrication procedure.',tags:['PSC','fabrication'],steps:[{name:'Clean substrate',description:'Clean Glass / ITO.'},{name:'Spin coat',description:'Deposit transport and absorber layers.'},{name:'Anneal',description:'Anneal the absorber film.'}]},
        {id:'inst-spin-01',category:'instruments',type:'Instrument',name:'Spin Coater 01',role:'Film deposition',description:'Spin coater for solution-processed thin films.',tags:['spin coating','deposition'],manufacturer:'Laurell',model:'WS-650',capabilities:'Spin coating · antisolvent dripping'},
        {id:'inst-solar-01',category:'instruments',type:'Instrument',name:'Solar Simulator',role:'Characterisation',description:'AM1.5G solar simulator for J–V measurements.',tags:['J-V','solar simulator'],manufacturer:'Newport Oriel',model:'Sol3A',capabilities:'AM1.5G · J–V'},
        {id:'inst-prof-01',category:'instruments',type:'Instrument',name:'Profilometer',role:'Characterisation',description:'Film thickness measurement instrument.',tags:['profilometry','thickness'],manufacturer:'Bruker',model:'Dektak',capabilities:'Step height · film thickness'},
        {id:'mat-csi',category:'materials',type:'Material',name:'CsI',role:'Precursor',description:'Cesium iodide for mixed-cation absorber formulations.',tags:['solute','precursor','cesium'],formula:'CsI',supplier:'Sigma-Aldrich',purity:'99.999%'},
        {id:'mat-spiro',category:'materials',type:'Material',name:'Spiro-OMeTAD',role:'Hole transport layer',description:'Reference organic hole-transport material.',tags:['HTL','transport layer'],formula:'C₈₁H₆₈N₄O₈',supplier:'Lumtec',purity:'99%'},
        {id:'mat-cbz',category:'materials',type:'Material',name:'Chlorobenzene',role:'Antisolvent',description:'Antisolvent used during absorber spin coating.',tags:['solvent','antisolvent'],formula:'C₆H₅Cl',supplier:'Sigma-Aldrich',purity:'99.8%'},
        {id:'sub-fuo-15',category:'substrates',type:'Substrate',name:'Glass / FTO · 15 × 15 mm',role:'Device substrate',description:'Compact FTO substrate used for exploratory devices.',tags:['glass','FTO'],material:'Glass / FTO',dimensions:'15 × 15 mm',thickness:'2.2 mm'},
        {id:'sol-reference-08m',category:'solutions',type:'Solution',name:'Reference precursor · 0.8 M',role:'Absorber precursor',description:'Lower-concentration formulation for thickness screening.',tags:['reference','0.8 M','DMF','DMSO'],concentration:'0.8 M',version:'1.1',totalVolume:3,volumeUnit:'mL',solvents:[{name:'DMF',amount:75,unit:'% v/v'},{name:'DMSO',amount:25,unit:'% v/v'}],solutes:[{name:'FAI',amount:.8,unit:'mmol'},{name:'PbI₂',amount:.8,unit:'mmol'}],preparation:'Stir 45 min at room temperature.',handling:'Filter 0.22 µm before use.'},
        {id:'stack-psc-pin',category:'stacks',type:'Stack',name:'PSC p-i-n screening',role:'Alternative architecture',description:'Compact p-i-n template for architecture comparison.',tags:['PSC','p-i-n'],architecture:'p-i-n',layers:[{material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Cleaned'},{material:'NiOx',role:'Hole transport',thickness:25,unit:'nm',method:'Spin coating'},{material:'Perovskite',role:'Absorber',thickness:480,unit:'nm',method:'Spin coating'},{material:'C60',role:'Electron transport',thickness:30,unit:'nm',method:'Evaporation'},{material:'Ag',role:'Back contact',thickness:100,unit:'nm',method:'Evaporation'}],processes:[{name:'Spin coating',value:'3500 rpm',duration:'30 s'},{name:'Annealing',value:'100 °C',duration:'25 min'}]},
        {id:'prot-jv-standard',category:'protocols',type:'Protocol',name:'J–V characterisation · standard',role:'Characterisation',description:'Reusable checklist for illuminated J–V measurements.',tags:['J-V','characterisation'],steps:[{name:'Stabilise sample',description:'Hold sample at measurement temperature.'},{name:'Set illumination',description:'Verify AM1.5G calibration.'},{name:'Run scans',description:'Acquire forward and reverse scans.'}]}
      ]
    }
  };
})();
```

### 2. Modified: `assets/demo-projects.js`
- Remove all inline definitions
- Build project seeds by referencing `window.LabFlowDemoData.projects` and expanding references to canonical objects
- Keep exact same `put('mixed', ...)` structure so validator markers (`put('mixed'`, `MEAS-JV-B`, `STACK-MIX-B`) remain present

### 3. Modified: `assets/cabinet-store.js`
- Replace inline `seed` array with `const seed = window.LabFlowDemoData.cabinet.seed;`
- Keep validator check `return write(clone(seed))` intact

### 4. Modified: `assets/app.js`
- Remove cabinet items block (lines 458-477)
- Remove `stackData` object (lines 1014+)
- Any code referencing them reads from `window.LabFlowDemoData` if needed

### 5. Modified: All root HTML pages
Add `<script defer src="assets/demo-data.js"></script>` before `app.js`:
- `index.html`, `project.html`, `catalogs.html`, `imports.html`, `ui-kit.html`, `workspace.html`, `solution.html`, `stack.html`, `material.html`, `editors.html`, `report.html`, `knowledge.html`, `ai.html`, `users.html`, `admin-settings.html`, `documentation.html`

### 6. Modified: `tools/validate_poc.py`
- Add check: `demo-data.js` exists and contains all required namespaces
- Keep existing demo-projects.js and cabinet-store.js marker checks

## Success Criteria
1. `python3 tools/validate_poc.py` → green
2. All demo data defined exactly once in `demo-data.js`
3. `demo-projects.js` and `cabinet-store.js` read from shared source
4. `app.js` no longer has duplicate cabinet/stackData definitions
5. Browser smoke test: all AGENTS.md pages load with zero console errors
6. PSC-2026-041, SOL-081, STACK-MIX-A/B defined in one place only

## Risk Mitigation
- Validator marker strings preserved in consumer files (no false failures)
- Load order guaranteed by `defer` script tags (demo-data.js before consumers)
- No build step, no module system — pure global namespace pattern
- Incremental: can verify each file change independently