window.LabFlowData={
 user:{id:"USR-CHOSE-042",name:"Matteo Ginesi",role:"Perovskite Researcher",initials:"MG",email:"matteo.ginesi@lab.example",laboratory:"CHOSE — Centre for Hybrid and Organic Solar Energy",organisation:"University of Rome Tor Vergata",workspace:"Advanced Photovoltaics",projects:6,storage:"1.8 GB / 10 GB",lastAccess:"03 Aug 2026 · 00:54"},
 projects:[
 {id:"PRJ-2026-014",name:"Mixed-cation perovskite optimisation",pipeline:"chose",currentStep:"analysis-report",progress:78,status:"active",updated:"Today, 00:48",owner:"Matteo Ginesi",objective:"Compare MA/FA ratios and identify the most stable high-efficiency device stack.",tags:["Perovskite","JV","Stability"],samples:12,files:28,solutions:4,stacks:6,measurements:18,findings:7,collaborators:3,nextAction:"Review AI-assisted outlier analysis and approve report conclusions"},
 {id:"PRJ-2026-011",name:"Spiro-OMeTAD HTL screening",pipeline:"chose",currentStep:"ingest",progress:52,status:"active",updated:"Yesterday, 18:10",owner:"Matteo Ginesi",objective:"Screen additive ratios for reproducible hole transport layer performance.",tags:["HTL","Screening"],samples:8,files:11,solutions:3,stacks:3,measurements:6,findings:1,collaborators:2,nextAction:"Map the final Keithley export and validate units"},
 {id:"PRJ-2026-006",name:"UV–Vis reference comparison",pipeline:"quick",currentStep:"report",progress:86,status:"review",updated:"30 Jul 2026",owner:"Matteo Ginesi",objective:"Review two reference spectra and document the main absorption shift.",tags:["UV–Vis","Reference"],samples:2,files:3,solutions:0,stacks:0,measurements:2,findings:3,collaborators:1,nextAction:"Approve report and export the review package"},
 {id:"PRJ-2026-003",name:"Encapsulation aging study",pipeline:"chose",currentStep:"analysis-report",progress:91,status:"review",updated:"28 Jul 2026",owner:"Matteo Ginesi",objective:"Compare barrier films after 500 h accelerated aging.",tags:["Aging","Encapsulation"],samples:16,files:46,solutions:2,stacks:4,measurements:64,findings:9,collaborators:4,nextAction:"Resolve two missing environmental metadata fields"},
 {id:"PRJ-2026-001",name:"Reference device reproducibility",pipeline:"chose",currentStep:"export",progress:100,status:"complete",updated:"18 Jul 2026",owner:"Matteo Ginesi",objective:"Establish the laboratory reference distribution for the standard n-i-p stack.",tags:["Reference","Reproducibility"],samples:24,files:52,solutions:3,stacks:2,measurements:96,findings:11,collaborators:5,nextAction:"Archived — package ready for NOMAD mapping"},
 {id:"PRJ-2025-037",name:"PL calibration verification",pipeline:"quick",currentStep:"export",progress:100,status:"complete",updated:"12 Dec 2025",owner:"Matteo Ginesi",objective:"Verify the photoluminescence calibration against the certified reference.",tags:["PL","Calibration"],samples:3,files:8,solutions:0,stacks:0,measurements:12,findings:2,collaborators:2,nextAction:"Archived"}],
 cabinet:[
 {id:"MAT-001",type:"material",name:"FAPbI₃ precursor",subtitle:"Perovskite precursor",status:"reviewed",meta:"Sigma-Aldrich · 99.99% · Lot FA-2407",tags:["Perovskite","Precursor"],usage:12},{id:"MAT-003",type:"material",name:"MAPbBr₃ precursor",subtitle:"Bandgap tuning precursor",status:"reviewed",meta:"GreatCell Solar · 99.9%",tags:["Perovskite"],usage:7},{id:"MAT-008",type:"material",name:"SnO₂ colloidal dispersion",subtitle:"Electron transport material",status:"reviewed",meta:"15% in H₂O",tags:["ETL"],usage:15},{id:"SOLV-004",type:"solvent",name:"DMF",subtitle:"Anhydrous solvent",status:"reviewed",meta:"CAS 68-12-2 · 99.8%",tags:["Solvent"],usage:18},{id:"SOLV-006",type:"solvent",name:"DMSO",subtitle:"Co-solvent",status:"reviewed",meta:"CAS 67-68-5 · 99.9%",tags:["Solvent"],usage:16},{id:"SOLV-009",type:"solvent",name:"Chlorobenzene",subtitle:"HTL solvent",status:"reviewed",meta:"CAS 108-90-7 · anhydrous",tags:["Solvent","HTL"],usage:11},{id:"SOL-011",type:"solution",name:"FA/MA 1.25 M reference",subtitle:"Reusable solution recipe",status:"reviewed",meta:"DMF:DMSO 4:1 · 1.25 M",tags:["Solution","CHOSE"],usage:9},{id:"SOL-017",type:"solution",name:"Spiro-OMeTAD standard",subtitle:"HTL solution recipe",status:"draft",meta:"72.3 mg/mL chlorobenzene",tags:["Solution","HTL"],usage:5},{id:"SOL-021",type:"solution",name:"SnO₂ diluted 1:5",subtitle:"ETL coating recipe",status:"reviewed",meta:"DI water · 0.22 μm filter",tags:["Solution","ETL"],usage:14},{id:"STK-003",type:"stack",name:"n-i-p reference device",subtitle:"Reusable stack template",status:"reviewed",meta:"Glass/FTO/SnO₂/Perovskite/Spiro/Au",tags:["Stack","n-i-p"],usage:17},{id:"STK-008",type:"stack",name:"p-i-n low-temperature",subtitle:"Flexible-compatible template",status:"reviewed",meta:"ITO/SAM/Perovskite/C60/BCP/Ag",tags:["Stack","p-i-n"],usage:6},{id:"MAP-002",type:"mapping",name:"Keithley JV CSV",subtitle:"Import mapping",status:"reviewed",meta:"Voltage, current density, scan direction",tags:["Mapping","JV"],usage:22},{id:"MAP-006",type:"mapping",name:"UV–Vis Cary export",subtitle:"Spectral import mapping",status:"reviewed",meta:"Wavelength, absorbance, baseline",tags:["Mapping","UV–Vis"],usage:8},{id:"ANA-004",type:"analysis",name:"JV comparison",subtitle:"Analysis recipe",status:"reviewed",meta:"PCE, Voc, Jsc, FF + hysteresis",tags:["Analysis","JV"],usage:19},{id:"ANA-009",type:"analysis",name:"Stability degradation",subtitle:"Analysis recipe",status:"reviewed",meta:"T80, normalized PCE, segmented fit",tags:["Analysis","Stability"],usage:7}],
 knowledge:[
 {id:"KB-SOP-014",type:"SOP",title:"Perovskite precursor preparation",summary:"Approved preparation sequence, glovebox limits, filtration and labeling requirements.",owner:"Lab Manager",updated:"01 Aug 2026",status:"approved",tags:["Solutions","Safety"]},{id:"KB-SOP-021",type:"SOP",title:"JV measurement and scan protocol",summary:"Reference scan direction, stabilization time, active area and reporting rules.",owner:"PV Characterisation",updated:"29 Jul 2026",status:"approved",tags:["JV","Measurement"]},{id:"KB-GUIDE-008",type:"Guide",title:"NOMAD metadata mapping guide",summary:"Local field mapping, required identifiers, units and provenance conventions.",owner:"Data Steward",updated:"26 Jul 2026",status:"review",tags:["NOMAD","Metadata"]},{id:"KB-NOTE-032",type:"Research note",title:"Recurring low-fill-factor signatures",summary:"Known equipment, contact and processing patterns associated with FF below 74%.",owner:"Matteo Ginesi",updated:"24 Jul 2026",status:"working",tags:["AI context","JV"]},{id:"KB-PAPER-104",type:"Literature",title:"Mixed-cation stability reference set",summary:"Curated papers and extracted conditions used to contextualise the current campaign.",owner:"Knowledge Curator",updated:"20 Jul 2026",status:"approved",tags:["Literature","Stability"]},{id:"KB-EQUIP-003",type:"Equipment",title:"Keithley 2450 configuration",summary:"Instrument profile, calibration status, export format and known caveats.",owner:"Metrology",updated:"18 Jul 2026",status:"approved",tags:["Equipment","JV"]}],
 tools:[
 {id:"solution-calculator",name:"Solution calculator",category:"Preparation",icon:"flask",description:"Calculate masses, molarity, solvent ratios and scaled batch volumes.",state:"ready"},{id:"unit-converter",name:"Scientific unit converter",category:"Common",icon:"swap",description:"Convert concentration, thickness, current density, time and temperature units.",state:"ready"},{id:"stack-builder",name:"Stack builder",category:"Preparation",icon:"layers",description:"Create ordered device layers with material, thickness and process metadata.",state:"ready"},{id:"file-profiler",name:"File profiler",category:"Data",icon:"file",description:"Inspect columns, delimiters, missing values, units and likely measurement type.",state:"ready"},{id:"mapping-validator",name:"Mapping validator",category:"Data",icon:"check",description:"Validate imported fields against an approved measurement mapping.",state:"ready"},{id:"descriptive-stats",name:"Descriptive statistics",category:"Analysis",icon:"chart",description:"Mean, median, dispersion, confidence intervals and grouped summaries.",state:"ready"},{id:"outlier-review",name:"Outlier review",category:"Analysis",icon:"warning",description:"Flag IQR and robust z-score candidates while preserving researcher control.",state:"ready"},{id:"curve-processor",name:"Curve processor",category:"Analysis",icon:"curve",description:"Smooth, normalize, align baselines and compare measurement curves.",state:"ready"},{id:"batch-compare",name:"Batch comparison",category:"Analysis",icon:"compare",description:"Compare formulations, stacks, operators, equipment and time windows.",state:"ready"},{id:"experiment-inspector",name:"Experiment Inspector",category:"Assistant",icon:"spark",description:"Summarise evidence, detect inconsistencies and propose review questions.",state:"simulated"},{id:"knowledge-query",name:"Ask LabFlow",category:"Assistant",icon:"book",description:"Search approved SOPs, data and explicit relationships together.",state:"simulated"},{id:"report-builder",name:"Report builder",category:"Reporting",icon:"file",description:"Assemble branded PDF, DOCX and Excel outputs from project evidence.",state:"ready"},{id:"nomad-mapper",name:"NOMAD mapper",category:"Export",icon:"external",description:"Preview structured field mappings and export readiness before submission.",state:"preview"}],
 demoDataset:[{sample:"S01",formulation:"FA0.85MA0.15",batch:"B01",voc:1.08,jsc:22.7,ff:78.1,pce:19.15,stability:89,hysteresis:3.2},{sample:"S02",formulation:"FA0.85MA0.15",batch:"B01",voc:1.10,jsc:23.2,ff:79.0,pce:20.16,stability:91,hysteresis:2.8},{sample:"S03",formulation:"FA0.80MA0.20",batch:"B02",voc:1.07,jsc:22.9,ff:77.3,pce:18.94,stability:85,hysteresis:4.1},{sample:"S04",formulation:"FA0.90MA0.10",batch:"B03",voc:1.12,jsc:23.5,ff:80.2,pce:21.10,stability:94,hysteresis:2.1},{sample:"S05",formulation:"FA0.90MA0.10",batch:"B03",voc:1.09,jsc:23.0,ff:79.4,pce:19.90,stability:92,hysteresis:2.5},{sample:"S06",formulation:"FA0.75MA0.25",batch:"B04",voc:1.05,jsc:21.8,ff:75.8,pce:17.36,stability:78,hysteresis:5.9},{sample:"S07",formulation:"FA0.85MA0.15",batch:"B05",voc:1.11,jsc:23.1,ff:79.7,pce:20.44,stability:90,hysteresis:2.7},{sample:"S08",formulation:"FA0.90MA0.10",batch:"B06",voc:1.13,jsc:23.4,ff:80.5,pce:21.28,stability:95,hysteresis:1.9}],
 aiFindings:[{score:96,title:"FA0.90MA0.10 is the strongest candidate",detail:"S04 and S08 lead both PCE and stability, with the lowest hysteresis.",evidence:"S04, S08 · 7 metrics",status:"accepted"},{score:91,title:"S06 is a multi-metric outlier",detail:"PCE, fill factor and stability are jointly below the robust cohort range; review fabrication notes before exclusion.",evidence:"S06 · IQR + robust z",status:"review"},{score:88,title:"Batch effect is smaller than formulation effect",detail:"Within-batch variation is limited compared with the shift between formulations.",evidence:"Grouped comparison",status:"accepted"},{score:84,title:"Stability and hysteresis are inversely associated",detail:"Lower hysteresis appears in the most stable devices; the sample count does not support a causal claim.",evidence:"Spearman preview",status:"review"},{score:78,title:"Two metadata gaps limit reproducibility",detail:"Humidity during coating and elapsed time before annealing are missing for B04 and B05.",evidence:"Process records",status:"action"}],
 experiments:[
  {id:"EXP-041",project:"PRJ-2026-014",process:"CHOSE Standard v2",samples:["S01","S02","S03"],solution:"SOL-B01",solvents:["DMF","DMSO"],stack:"STK-003/v2",annealing:{value:100,unit:"°C",duration:30},devicesDeclared:6,measurements:6,status:"reviewed"},
  {id:"EXP-052",project:"PRJ-2026-014",process:"CHOSE Standard v2",samples:["S04","S05"],solution:"SOL-B03",solvents:["DMF","DMSO"],stack:"STK-003/v2",annealing:{value:105,unit:"°C",duration:25},devicesDeclared:4,measurements:4,status:"reviewed"},
  {id:"EXP-067",project:"PRJ-2026-014",process:"CHOSE Standard v2",samples:["S06","S07","S08"],solution:null,solvents:["DMF","DMSO"],stack:"STK-003/v2",annealing:{value:100,unit:"",duration:30},devicesDeclared:20,measurements:24,status:"review"}
 ],
 validationIssues:[
  {id:"DQ-001",severity:"error",title:"Device count conflicts with imported data",detail:"EXP-067 declares 20 devices, while batch_B03_forward.csv contains 24 JV measurements.",source:"Deterministic validation",evidence:"EXP-067 · batch_B03_forward.csv"},
  {id:"DQ-002",severity:"warning",title:"Annealing unit is missing",detail:"EXP-067 records annealing temperature as 100 without an explicit unit.",source:"Deterministic validation",evidence:"EXP-067 · process.annealing.temperature"},
  {id:"DQ-003",severity:"warning",title:"Solution preparation is not linked",detail:"Batch B06 is used by S08 but EXP-067 has no solution preparation link.",source:"Deterministic validation",evidence:"EXP-067 · S08 · B06"},
  {id:"DQ-004",severity:"suggestion",title:"Clarify the coating note",detail:"The note “briefly before annealing” is ambiguous; record an elapsed time instead of inferring one.",source:"AI interpretation",evidence:"EXP-067 · fabrication note"},
  {id:"DQ-005",severity:"information",title:"NOMAD preview can be prepared",detail:"Required project and sample identifiers exist; the three issues above remain visible in the package.",source:"Deterministic validation",evidence:"KB-GUIDE-008 · PRJ-2026-014"}
 ],
 importMapping:[
  {column:"Sample_ID",target:"device.identifier",detected:"text",required:"text",conversion:"None",confidence:99,preview:"S08",status:"ready"},
  {column:"Voc",target:"measurements.jv.open_circuit_voltage",detected:"V",required:"V",conversion:"None",confidence:98,preview:"1.13 V",status:"ready"},
  {column:"Jsc",target:"measurements.jv.short_circuit_current_density",detected:"mA/cm²",required:"A/m²",conversion:"× 10",confidence:94,preview:"234 A/m²",status:"review"},
  {column:"FF",target:"measurements.jv.fill_factor",detected:"%",required:"%",conversion:"None",confidence:97,preview:"80.5%",status:"ready"},
  {column:"PCE",target:"measurements.jv.efficiency",detected:"%",required:"%",conversion:"None",confidence:99,preview:"21.28%",status:"ready"},
  {column:"ScanDir",target:"measurements.jv.scan_direction",detected:"enum",required:"enum",conversion:"FWD → forward",confidence:91,preview:"forward",status:"review"}
 ],
 savedViews:[
  {id:"review",name:"Experiments requiring review",criteria:"Quality severity is error or warning",count:1},
  {id:"high-pce",name:"High-performing devices",criteria:"PCE > 20%",count:4},
  {id:"annealing",name:"Missing annealing parameters",criteria:"Annealing unit or duration is empty",count:1},
  {id:"export",name:"Experiments ready for export",criteria:"No blocking validation errors",count:2},
  {id:"dmso",name:"Experiments using DMSO",criteria:"Solution solvent contains DMSO",count:3}
 ],
 aiFoundation:{
  readiness:{overall:86,status:"Ready with warnings",updated:"03 Aug 2026",metrics:[
   {id:"structured",label:"Structured metadata",value:92,detail:"Stable project, experiment, sample and measurement identifiers"},
   {id:"units",label:"Units normalized",value:100,detail:"Measurement units are explicit and conversion remains traceable"},
   {id:"provenance",label:"Provenance available",value:87,detail:"Three process links still require review"},
   {id:"targets",label:"Target completeness",value:75,detail:"PCE is complete; environmental context is partial"},
   {id:"knowledge",label:"Knowledge coverage",value:78,detail:"Six governed sources are linked to the current project"}
  ],blocking:["Resolve EXP-067 device count mismatch","Add the annealing unit","Link solution batch B06 to its preparation record"]},
  datasetSnapshots:[
   {id:"DS-PCE-001",name:"Mixed-cation PCE baseline",version:"1.0",project:"PRJ-2026-014",created:"03 Aug 2026",rows:8,features:6,target:"PCE (%)",excluded:0,status:"ready-with-warnings",split:"Grouped by experiment",sourceExperiments:["EXP-041","EXP-052","EXP-067"]},
   {id:"DS-STABILITY-001",name:"Stability screening preview",version:"0.2",project:"PRJ-2026-014",created:"03 Aug 2026",rows:8,features:5,target:"Retained performance (%)",excluded:1,status:"draft",split:"Not assigned",sourceExperiments:["EXP-041","EXP-052","EXP-067"]}
  ],
  featureSchema:[
   {name:"fa_fraction",label:"FA fraction",type:"numeric",unit:"fraction",role:"feature",source:"Solution formulation",coverage:100},
   {name:"ma_fraction",label:"MA fraction",type:"numeric",unit:"fraction",role:"feature",source:"Solution formulation",coverage:100},
   {name:"annealing_temperature",label:"Annealing temperature",type:"numeric",unit:"°C",role:"feature",source:"Process snapshot",coverage:87},
   {name:"annealing_duration",label:"Annealing duration",type:"numeric",unit:"min",role:"feature",source:"Process snapshot",coverage:100},
   {name:"batch",label:"Batch",type:"categorical",unit:"—",role:"group",source:"Experiment",coverage:100},
   {name:"pce",label:"Power conversion efficiency",type:"numeric",unit:"%",role:"target",source:"JV measurement",coverage:100}
  ],
  models:[
   {id:"MDL-PCE-RF-001",name:"PCE baseline regressor",version:"1.0",task:"Regression",algorithm:"Random Forest",dataset:"DS-PCE-001",status:"evaluated",scope:"Illustrative baseline only",metrics:{mae:"1.40 pp",rmse:"1.72 pp",r2:"0.71",validation:"Grouped cross-validation"},score:0.71,mae:1.40,rmse:1.72,parameters:"240 trees · max depth 6",size:"1.8 MB"},
   {id:"MDL-PCE-GB-002",name:"PCE gradient boosting",version:"0.8",task:"Regression",algorithm:"Gradient Boosting",dataset:"DS-PCE-001",status:"evaluated",scope:"Candidate baseline · demonstration only",metrics:{mae:"1.18 pp",rmse:"1.51 pp",r2:"0.78",validation:"Grouped cross-validation"},score:0.78,mae:1.18,rmse:1.51,parameters:"120 estimators · depth 3",size:"940 KB"},
   {id:"MDL-PCE-MLP-003",name:"PCE neural regressor",version:"0.4",task:"Regression",algorithm:"Multilayer Perceptron",dataset:"DS-PCE-001",status:"prototype",scope:"DL-ready workflow demonstration",metrics:{mae:"1.31 pp",rmse:"1.63 pp",r2:"0.74",validation:"Grouped cross-validation"},score:0.74,mae:1.31,rmse:1.63,parameters:"6 → 24 → 12 → 1 · dropout 0.10",size:"86 KB"},
   {id:"MDL-QUALITY-RULES-001",name:"Experiment readiness classifier",version:"0.3",task:"Classification",algorithm:"Deterministic baseline + review labels",dataset:"DS-PCE-001",status:"prototype",scope:"Demonstration only",metrics:{precision:"0.83",recall:"0.80",f1:"0.81",validation:"Leave-one-experiment-out"},score:0.81,parameters:"Rules + calibrated review labels",size:"12 KB"}
  ],
  modelComparison:{labels:["Random Forest","Gradient Boosting","Neural regressor"],r2:[0.71,0.78,0.74],mae:[1.40,1.18,1.31],rmse:[1.72,1.51,1.63]},
  trainingHistory:{model:"MDL-PCE-MLP-003",epochs:[1,5,10,15,20,25,30,35,40],trainLoss:[5.8,3.6,2.5,2.0,1.72,1.55,1.43,1.37,1.34],validationLoss:[6.2,4.1,3.0,2.42,2.06,1.88,1.75,1.70,1.68],validationR2:[0.08,0.31,0.49,0.61,0.68,0.71,0.73,0.74,0.74],learningRate:[0.01,0.01,0.01,0.005,0.005,0.002,0.002,0.001,0.001]},
  residuals:[{sample:"S01",observed:18.94,predicted:19.22},{sample:"S02",observed:20.16,predicted:19.71},{sample:"S03",observed:19.42,predicted:19.60},{sample:"S04",observed:21.10,predicted:20.63},{sample:"S05",observed:19.90,predicted:20.08},{sample:"S06",observed:17.36,predicted:18.62},{sample:"S07",observed:20.54,predicted:20.31},{sample:"S08",observed:21.28,predicted:20.80}],
  confusionMatrix:{labels:["Ready","Review"],values:[[5,1],[1,3]],accuracy:0.80},
  trainingRuns:[
   {id:"RUN-PCE-20260803-01",model:"MDL-PCE-RF-001",dataset:"DS-PCE-001",seed:42,status:"completed",duration:"2.4 s",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 18:42",bestMetric:"R² 0.71",artifact:"rf-pce-v1.bin"},
   {id:"RUN-PCE-20260803-02",model:"MDL-PCE-GB-002",dataset:"DS-PCE-001",seed:42,status:"completed",duration:"1.8 s",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 18:44",bestMetric:"R² 0.78",artifact:"gb-pce-v08.bin"},
   {id:"RUN-PCE-20260803-03",model:"MDL-PCE-MLP-003",dataset:"DS-PCE-001",seed:42,status:"completed",duration:"18.6 s",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 18:47",bestMetric:"Val R² 0.74",artifact:"mlp-pce-v04.onnx"},
   {id:"RUN-QUALITY-20260803-01",model:"MDL-QUALITY-RULES-001",dataset:"DS-PCE-001",seed:42,status:"review",duration:"0.6 s",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 18:45",bestMetric:"F1 0.81",artifact:"quality-rules-v03.json"}
  ],
  predictions:[
   {id:"PRD-S08-PCE-001",sample:"S08",model:"MDL-PCE-RF-001",dataset:"DS-PCE-001",predicted:20.8,uncertainty:1.5,observed:21.28,coverage:93,status:"reviewed",note:"Prediction is consistent with the observed result."},
   {id:"PRD-S06-PCE-001",sample:"S06",model:"MDL-PCE-RF-001",dataset:"DS-PCE-001",predicted:19.1,uncertainty:1.8,observed:17.36,coverage:81,status:"needs-review",note:"Large residual; inspect fabrication and provenance before interpretation."}
  ],
  ragEvaluation:[
   {id:"RAG-EVAL-001",question:"Which solvent system was used in batch B03?",expectedSource:"SOL-011",expected:"DMF:DMSO 4:1",status:"pass"},
   {id:"RAG-EVAL-002",question:"Which samples exceed 20% PCE?",expectedSource:"JV-B03",expected:"S02, S04, S07 and S08",status:"pass"},
   {id:"RAG-EVAL-003",question:"What blocks EXP-067 from final NOMAD submission?",expectedSource:"DQ-001–DQ-003",expected:"Device count, annealing unit and solution provenance",status:"pass"},
   {id:"RAG-EVAL-004",question:"Did SnO₂ cause the best PCE?",expectedSource:"STK-003/v2 + measurements",expected:"Unsupported causal claim must be rejected",status:"review"}
  ],
  outputTypes:[
   {type:"raw",label:"Raw measurement",review:"Recorded",evidence:"Source file"},
   {type:"derived",label:"Calculated result",review:"Calculated",evidence:"Formula or analysis run"},
   {type:"prediction",label:"Model prediction",review:"Needs review",evidence:"Model + dataset snapshot"},
   {type:"suggestion",label:"LLM suggestion",review:"Suggested",evidence:"Prompt + sources + tools"},
   {type:"conclusion",label:"Researcher conclusion",review:"Approved by researcher",evidence:"Reviewed evidence"}
  ]
 },
 activity:[{time:"00:48",text:"Report package regenerated",detail:"PDF, DOCX and Excel outputs updated with the active palette"},{time:"00:33",text:"AI review completed",detail:"5 evidence-linked findings generated"},{time:"Yesterday",text:"Knowledge item linked",detail:"JV protocol added to project context"},{time:"Yesterday",text:"Measurement mapping reviewed",detail:"12 files mapped with Keithley JV CSV"},{time:"01 Aug",text:"Stack variant created",detail:"S04 copied from reference stack"}],
 assistantPrompts:["Inspect current experiment","Compare experiments using DMSO","Find missing annealing parameters","Prepare evidence-linked report","Check NOMAD readiness"]
};

(function () {
  "use strict";

  const data = window.LabFlowData;
  const list = (items) => items.slice();

  window.LabFlowDataSource = Object.freeze({
    getUser: () => data.user,
    listProjects: () => list(data.projects),
    getProjectById: (id) => data.projects.find((item) => item.id === id) || null,
    listCabinet: () => list(data.cabinet),
    getCabinetItemById: (id) => data.cabinet.find((item) => item.id === id) || null,
    listKnowledge: () => list(data.knowledge),
    listTools: () => list(data.tools),
    listExperiments: (projectId) => data.experiments.filter((item) => !projectId || item.project === projectId),
    listMeasurements: () => list(data.demoDataset),
    listValidationIssues: () => list(data.validationIssues),
    getAiReadiness: () => ({...data.aiFoundation.readiness, metrics: list(data.aiFoundation.readiness.metrics), blocking: list(data.aiFoundation.readiness.blocking)}),
    listDatasetSnapshots: () => list(data.aiFoundation.datasetSnapshots),
    listFeatureSchema: () => list(data.aiFoundation.featureSchema),
    listModels: () => list(data.aiFoundation.models),
    listTrainingRuns: () => list(data.aiFoundation.trainingRuns),
    listPredictions: () => list(data.aiFoundation.predictions),
    listRagEvaluations: () => list(data.aiFoundation.ragEvaluation)
  });
})();
