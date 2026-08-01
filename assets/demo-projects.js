/**
 * LabFlow demonstration workspace seed
 * ===================================
 *
 * The static POC must feel explorable on first open. This file seeds coherent,
 * session-only scientific examples for BOTH bundled Pipelines. It deliberately
 * writes to sessionStorage only: a new browser session starts from the same
 * curated demonstration, while edits during the current session are preserved.
 */
(() => {
  'use strict';

  const VERSION = 'workspace-seeded-v4';
  const user = localStorage.getItem('labflow-user') || 'ew';
  if (sessionStorage.getItem('labflow-demo-version') === VERSION) return;

  Object.keys(sessionStorage)
    .filter(key => key.startsWith('labflow-'))
    .forEach(key => sessionStorage.removeItem(key));

  const put = (project, value) => sessionStorage.setItem(
    `labflow-pipeline-data-${user}-${project}`,
    JSON.stringify(value)
  );
  const progress = (project, currentStep, completed = false) => sessionStorage.setItem(
    `labflow-project-state-${user}-${project}`,
    JSON.stringify({ currentStep, pipelineCompleted: completed, updatedAt: new Date().toISOString() })
  );

  /* -----------------------------------------------------------------------
   * CHOSE showcase — Mixed-cation optimisation
   * A complete chain is intentionally present so every Step can be explored.
   * -------------------------------------------------------------------- */
  put('mixed', {
    materials: {
      solvents: ['DMF', 'DMSO'],
      solutes: ['PbI₂', 'FAI', 'CsI', 'MACl'],
      resources: [
        { id:'MAT-DMF', name:'DMF', formula:'C₃H₇NO', role:'Solvent', category:'materials', tags:['solvent'] },
        { id:'MAT-DMSO', name:'DMSO', formula:'C₂H₆OS', role:'Solvent', category:'materials', tags:['solvent'] },
        { id:'MAT-PBI2', name:'PbI₂', formula:'PbI₂', role:'Lead precursor', category:'materials', tags:['precursor'] },
        { id:'MAT-FAI', name:'FAI', formula:'CH₅IN₂', role:'A-site precursor', category:'materials', tags:['precursor'] },
        { id:'MAT-CSI', name:'CsI', formula:'CsI', role:'A-site precursor', category:'materials', tags:['precursor'] },
        { id:'MAT-SNO2', name:'SnO₂', formula:'SnO₂', role:'Electron transport', category:'materials', tags:['ETL'] }
      ],
      solutions: [
        {
          id:'SOL-MIX-01', name:'FA–Cs absorber · 1.20 M', concentration:'1.20 M', totalVolume:5, volumeUnit:'mL',
          solvents:[{name:'DMF',amount:80,unit:'% v/v'},{name:'DMSO',amount:20,unit:'% v/v'}],
          solutes:[{name:'PbI₂',amount:6.0,unit:'mmol'},{name:'FAI',amount:5.1,unit:'mmol'},{name:'CsI',amount:0.9,unit:'mmol'},{name:'MACl',amount:5,unit:'mol%'}],
          preparation:'Stir 60 min at 60 °C, cool to room temperature and filter through 0.22 µm PTFE.',
          handling:'Warm gently before use; keep protected from ambient moisture.', storage:'N₂ glovebox · dark',
          notes:'Reference absorber recipe for the CHOSE demonstration.', savedAt:'2026-07-28T10:15:00Z'
        },
        {
          id:'SOL-MIX-02', name:'Spiro-OMeTAD HTL', concentration:'72.3 mg/mL', totalVolume:1, volumeUnit:'mL',
          solvents:[{name:'Chlorobenzene',amount:100,unit:'% v/v'}],
          solutes:[{name:'Spiro-OMeTAD',amount:72.3,unit:'mg'},{name:'Li-TFSI',amount:17.5,unit:'µL stock'},{name:'tBP',amount:28.8,unit:'µL'}],
          preparation:'Dissolve under gentle agitation until optically clear.', handling:'Use the same day.', storage:'Dark · room temperature',
          notes:'Transport-layer reference solution.', savedAt:'2026-07-28T10:35:00Z'
        }
      ]
    },
    fabrication: {
      stacks: [
        {
          id:'STACK-MIX-A', name:'Reference n-i-p · A', condition:'1200 rpm absorber', samples:['S01-A','S01-B','S01-C'], atmosphere:'N₂ glovebox', instrument:'Spin Coater 01', operator:'Eleanor Wright',
          layers:[
            {material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Sequential cleaning + UV/O₃'},
            {material:'SnO₂',role:'Electron transport',thickness:30,unit:'nm',method:'Spin coating'},
            {material:'FA–Cs perovskite',role:'Absorber',thickness:455,unit:'nm',method:'Antisolvent spin coating'},
            {material:'Spiro-OMeTAD',role:'Hole transport',thickness:180,unit:'nm',method:'Spin coating'},
            {material:'Au',role:'Top contact',thickness:80,unit:'nm',method:'Thermal evaporation'}
          ],
          processes:[
            {name:'SnO₂ coating',value:'3000 rpm',duration:'30 s',notes:'150 °C · 30 min'},
            {name:'Absorber coating',value:'1200 rpm',duration:'30 s',notes:'150 µL CB at 12 s'},
            {name:'Annealing',value:'100 °C',duration:'30 min',notes:'N₂'},
            {name:'Au evaporation',value:'2×10⁻⁶ mbar',duration:'80 nm',notes:'Shadow mask'}
          ], notes:'Baseline device architecture.', savedAt:'2026-07-29T09:10:00Z'
        },
        {
          id:'STACK-MIX-B', name:'Optimised n-i-p · B', condition:'1500 rpm absorber', samples:['S02-A','S02-B','S02-C'], atmosphere:'N₂ glovebox', instrument:'Spin Coater 01', operator:'Eleanor Wright',
          layers:[
            {material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Sequential cleaning + UV/O₃'},
            {material:'SnO₂',role:'Electron transport',thickness:30,unit:'nm',method:'Spin coating'},
            {material:'FA–Cs perovskite',role:'Absorber',thickness:392,unit:'nm',method:'Antisolvent spin coating'},
            {material:'Spiro-OMeTAD',role:'Hole transport',thickness:180,unit:'nm',method:'Spin coating'},
            {material:'Au',role:'Top contact',thickness:80,unit:'nm',method:'Thermal evaporation'}
          ],
          processes:[
            {name:'SnO₂ coating',value:'3000 rpm',duration:'30 s',notes:'150 °C · 30 min'},
            {name:'Absorber coating',value:'1500 rpm',duration:'30 s',notes:'150 µL CB at 12 s'},
            {name:'Annealing',value:'100 °C',duration:'30 min',notes:'N₂'},
            {name:'Au evaporation',value:'2×10⁻⁶ mbar',duration:'80 nm',notes:'Shadow mask'}
          ], notes:'Best-performing demonstration condition.', savedAt:'2026-07-29T10:05:00Z'
        }
      ]
    },
    data: {
      datasets: [
        {
          id:'MEAS-JV-A', kind:'measurement', filename:'S01-A_JV.csv', fileType:'csv', measurementType:'jv', measurement:'JV', stackId:'STACK-MIX-A', sample:'S01-A', target:'S01-A', status:'Structured', parseState:'Parsed', manual:false,
          columns:['Voltage V','Current density mA/cm2'], mapping:[{column:'Voltage V',meaning:'x',unit:'V'},{column:'Current density mA/cm2',meaning:'signal',unit:'mA/cm²'}],
          rows:[[-0.1,-22.1],[0,-21.9],[0.2,-21.5],[0.4,-20.8],[0.6,-19.5],[0.8,-16.8],[1.0,-8.4],[1.08,0.2]],
          conditions:{activeArea:'0.10 cm²',instrument:'JV-01',illumination:'AM1.5G · 100 mW/cm²',environment:'N₂ · 25 °C',protocol:'Reverse scan · 100 mV/s'}, provenance:{measurementType:'user',target:'inherited',data:'imported',derivedMetrics:'calculated'}
        },
        {
          id:'MEAS-JV-B', kind:'measurement', filename:'S02-A_JV.csv', fileType:'csv', measurementType:'jv', measurement:'JV', stackId:'STACK-MIX-B', sample:'S02-A', target:'S02-A', status:'Structured', parseState:'Parsed', manual:false,
          columns:['Voltage V','Current density mA/cm2'], mapping:[{column:'Voltage V',meaning:'x',unit:'V'},{column:'Current density mA/cm2',meaning:'signal',unit:'mA/cm²'}],
          rows:[[-0.1,-23.5],[0,-23.2],[0.2,-22.9],[0.4,-22.5],[0.6,-21.8],[0.8,-20.2],[1.0,-14.0],[1.12,-2.0],[1.145,0.1]],
          conditions:{activeArea:'0.10 cm²',instrument:'JV-01',illumination:'AM1.5G · 100 mW/cm²',environment:'N₂ · 25 °C',protocol:'Reverse scan · 100 mV/s'}, provenance:{measurementType:'user',target:'inherited',data:'imported',derivedMetrics:'calculated'}
        },
        {
          id:'MEAS-IPCE-B', kind:'measurement', filename:'S02-A_EQE.txt', fileType:'txt', measurementType:'ipce', measurement:'IPCE', stackId:'STACK-MIX-B', sample:'S02-A', target:'S02-A', status:'Structured', parseState:'Parsed', manual:false,
          columns:['Wavelength nm','EQE %'], mapping:[{column:'Wavelength nm',meaning:'x',unit:'nm'},{column:'EQE %',meaning:'signal',unit:'%'}],
          rows:[[350,42],[400,71],[450,84],[500,89],[550,91],[600,90],[650,87],[700,82],[750,69],[800,18]],
          conditions:{instrument:'EQE-02',illumination:'Monochromatic chopped beam',environment:'Ambient · 24 °C',protocol:'300–850 nm'}, provenance:{measurementType:'user',target:'inherited',data:'imported',derivedMetrics:'calculated'}
        },
        {
          id:'MEAS-UVVIS-A', kind:'measurement', filename:'film_A_uvvis.csv', fileType:'csv', measurementType:'uvvis', measurement:'UV/VIS', stackId:'STACK-MIX-A', sample:'S01-B', target:'S01-B', status:'Structured', parseState:'Parsed', manual:false,
          columns:['Wavelength nm','Absorbance'], mapping:[{column:'Wavelength nm',meaning:'x',unit:'nm'},{column:'Absorbance',meaning:'signal',unit:'a.u.'}],
          rows:[[400,0.82],[450,1.04],[500,1.22],[550,1.31],[600,1.34],[650,1.28],[700,1.15],[750,0.78],[800,0.21]],
          conditions:{instrument:'UVVIS-01',environment:'Ambient'}, provenance:{measurementType:'user',target:'inherited',data:'imported',derivedMetrics:'calculated'}
        }
      ]
    },
    analysis: {
      comparisons:[{id:'CMP-MIX-01',measurementType:'jv',datasets:['MEAS-JV-A','MEAS-JV-B'],title:'Reference vs optimised absorber spin speed'}],
      conclusions:[
        {id:'CONC-MIX-01',origin:'human',text:'The 1500 rpm condition gives the strongest device response while preserving a comparable spectral profile. Repeat B with a second batch before treating the improvement as robust.',savedAt:'2026-07-30T15:40:00Z'}
      ]
    }
  });
  progress('mixed', 3, false);

  /* CHOSE second example — annealing comparison, deliberately parked at ingest. */
  put('annealing', {
    materials: {
      solvents:['DMF','DMSO'], solutes:['PbI₂','FAI'], resources:[
        {id:'ANN-MAT-DMF',name:'DMF',formula:'C₃H₇NO',role:'Solvent',category:'materials',tags:['solvent']},
        {id:'ANN-MAT-DMSO',name:'DMSO',formula:'C₂H₆OS',role:'Solvent',category:'materials',tags:['solvent']},
        {id:'ANN-MAT-PBI2',name:'PbI₂',formula:'PbI₂',role:'Lead precursor',category:'materials',tags:['precursor']},
        {id:'ANN-MAT-FAI',name:'FAI',formula:'CH₅IN₂',role:'A-site precursor',category:'materials',tags:['precursor']}
      ],
      solutions:[{id:'SOL-ANN-01',name:'FA perovskite reference · 1.10 M',concentration:'1.10 M',totalVolume:3,volumeUnit:'mL',solvents:[{name:'DMF',amount:80,unit:'% v/v'},{name:'DMSO',amount:20,unit:'% v/v'}],solutes:[{name:'PbI₂',amount:3.3,unit:'mmol'},{name:'FAI',amount:3.3,unit:'mmol'}],preparation:'Stir 45 min at 60 °C.',handling:'Filter immediately before use.',storage:'N₂ glovebox',notes:'Fixed chemistry while annealing temperature varies.'}]
    },
    fabrication:{stacks:[90,100,110].map((temperature,index)=>({id:`STACK-ANN-${temperature}`,name:`Anneal ${temperature} °C`,condition:`${temperature} °C · 30 min`,samples:[`ANN-${temperature}-A`,`ANN-${temperature}-B`],layers:[{material:'Glass / ITO',role:'Substrate',thickness:1.1,unit:'mm',method:'Cleaned'},{material:'SnO₂',role:'Electron transport',thickness:30,unit:'nm',method:'Spin coating'},{material:'FA perovskite',role:'Absorber',thickness:420-index*18,unit:'nm',method:'Spin coating'},{material:'Spiro-OMeTAD',role:'Hole transport',thickness:180,unit:'nm',method:'Spin coating'},{material:'Au',role:'Top contact',thickness:80,unit:'nm',method:'Evaporation'}],processes:[{name:'Absorber coating',value:'1500 rpm',duration:'30 s',notes:'Identical for all conditions'},{name:'Annealing',value:`${temperature} °C`,duration:'30 min',notes:'N₂'}],atmosphere:'N₂',instrument:'Hotplate HP-02',operator:'Eleanor Wright',notes:'Annealing temperature screening.'}))},
    data:{datasets:[
      {id:'ANN-JV-90',manual:true,measurementType:'jv',measurement:'JV',filename:'Manual summary · 90 °C',stackId:'STACK-ANN-90',sample:'ANN-90-A',target:'ANN-90-A',status:'Structured',parseState:'Parsed',columns:['Metric','Value','Unit'],rows:[['PCE',18.6,'%'],['Voc',1.08,'V'],['Jsc',22.4,'mA/cm²'],['FF',76.9,'%']],mapping:[],conditions:{activeArea:'0.10 cm²',instrument:'JV-01'},provenance:{measurementType:'user',target:'inherited',data:'user'}},
      {id:'ANN-JV-100',manual:true,measurementType:'jv',measurement:'JV',filename:'Manual summary · 100 °C',stackId:'STACK-ANN-100',sample:'ANN-100-A',target:'ANN-100-A',status:'Structured',parseState:'Parsed',columns:['Metric','Value','Unit'],rows:[['PCE',20.8,'%'],['Voc',1.12,'V'],['Jsc',23.0,'mA/cm²'],['FF',80.7,'%']],mapping:[],conditions:{activeArea:'0.10 cm²',instrument:'JV-01'},provenance:{measurementType:'user',target:'inherited',data:'user'}},
      {id:'ANN-JV-110',manual:true,measurementType:'jv',measurement:'JV',filename:'Manual summary · 110 °C',stackId:'STACK-ANN-110',sample:'ANN-110-A',target:'ANN-110-A',status:'Needs review',parseState:'Parsed',columns:['Metric','Value','Unit'],rows:[['PCE',19.4,'%'],['Voc',1.10,'V'],['Jsc',22.6,'mA/cm²'],['FF',78.0,'%']],mapping:[],conditions:{activeArea:'0.10 cm²',instrument:'JV-01'},provenance:{measurementType:'user',target:'inherited',data:'user'}}
    ]},
    analysis:{comparisons:[],conclusions:[{id:'ANN-CONC-1',origin:'human',text:'100 °C is the current best condition. The 110 °C group should be reviewed for film non-uniformity before a second run.',savedAt:'2026-07-30T17:15:00Z'}]}
  });
  progress('annealing', 2, false);

  /* -----------------------------------------------------------------------
   * Quick Pipeline — two distinct examples, one active and one completed.
   * -------------------------------------------------------------------- */
  put('thickness', { quick:{
    plan:{question:'How does spin speed affect dry film thickness?',conditions:['1000 rpm','1500 rpm','2000 rpm'],measurement:'Profilometer thickness',note:'One coated glass witness per condition; same solution batch.'},
    records:[
      {condition:'1000 rpm',value:486,unit:'nm',evidence:'profilometer_run_017.csv',status:'Complete'},
      {condition:'1500 rpm',value:401,unit:'nm',evidence:'profilometer_run_018.csv',status:'Complete'},
      {condition:'2000 rpm',value:338,unit:'nm',evidence:'profilometer_run_019.csv',status:'Complete'}
    ],
    conclusion:'Thickness decreases monotonically across this screening window. 1500 rpm remains the practical midpoint for the next device batch.'
  }});
  progress('thickness', 1, false);

  put('solvent-ratio', { quick:{
    plan:{question:'Which DMF:DMSO ratio gives the best device PCE in this small screen?',conditions:['5:1','4:1','3:1'],measurement:'Best-cell PCE',note:'Same precursor concentration and 1500 rpm deposition.'},
    records:[
      {condition:'5:1',value:19.2,unit:'%',evidence:'ratio_5-1_summary.csv',status:'Complete'},
      {condition:'4:1',value:21.1,unit:'%',evidence:'ratio_4-1_summary.csv',status:'Complete'},
      {condition:'3:1',value:20.0,unit:'%',evidence:'ratio_3-1_summary.csv',status:'Complete'}
    ],
    conclusion:'DMF:DMSO 4:1 is the strongest condition in this limited screen. Repeat with additional devices before promoting it to a shared recipe.'
  }});
  progress('solvent-ratio', 2, true);

  sessionStorage.setItem(`labflow-project-${user}`, 'mixed');
  sessionStorage.setItem('labflow-demo-version', VERSION);
})();
