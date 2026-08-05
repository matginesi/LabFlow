window.LabFlowData={
 user:{id:"USR-CHOSE-042",name:"Matteo Ginesi",role:"Perovskite Researcher",initials:"MG",email:"matteo.ginesi@lab.example",laboratory:"CHOSE — Centre for Hybrid and Organic Solar Energy",organisation:"University of Rome Tor Vergata",workspace:"Advanced Photovoltaics",projects:6,storage:"1.8 GB / 10 GB",lastAccess:"03 Aug 2026 · 00:54"},
 projects:[
 {id:"PRJ-2026-014",name:"Mixed-cation perovskite optimisation",pipeline:"chose",currentStep:"review",progress:78,status:"active",updated:"Today, 00:48",owner:"Matteo Ginesi",objective:"Compare MA/FA ratios and identify the most stable high-efficiency device stack.",tags:["Perovskite","JV","Stability"],samples:12,files:28,solutions:4,stacks:6,measurements:18,findings:7,collaborators:3,nextAction:"Review evidence-linked findings and approve the report package"},
 {id:"PRJ-2026-011",name:"Spiro-OMeTAD HTL screening",pipeline:"chose",currentStep:"results",progress:52,status:"active",updated:"Yesterday, 18:10",owner:"Matteo Ginesi",objective:"Screen additive ratios for reproducible hole transport layer performance.",tags:["HTL","Screening"],samples:8,files:11,solutions:3,stacks:3,measurements:6,findings:1,collaborators:2,nextAction:"Map the final Keithley result set and validate units"},
 {id:"PRJ-2026-006",name:"UV–Vis reference comparison",pipeline:"quick",currentStep:"report",progress:86,status:"review",updated:"30 Jul 2026",owner:"Matteo Ginesi",objective:"Review two reference spectra and document the main absorption shift.",tags:["UV–Vis","Reference"],samples:2,files:3,solutions:0,stacks:0,measurements:2,findings:3,collaborators:1,nextAction:"Approve report and export the review package"},
 {id:"PRJ-2026-003",name:"Encapsulation aging study",pipeline:"chose",currentStep:"review",progress:91,status:"review",updated:"28 Jul 2026",owner:"Matteo Ginesi",objective:"Compare barrier films after 500 h accelerated aging.",tags:["Aging","Encapsulation"],samples:16,files:46,solutions:2,stacks:4,measurements:64,findings:9,collaborators:4,nextAction:"Resolve two experiment-execution metadata fields"},
 {id:"PRJ-2026-001",name:"Reference device reproducibility",pipeline:"chose",currentStep:"review",progress:100,status:"complete",updated:"18 Jul 2026",owner:"Matteo Ginesi",objective:"Establish the laboratory reference distribution for the standard n-i-p stack.",tags:["Reference","Reproducibility"],samples:24,files:52,solutions:3,stacks:2,measurements:96,findings:11,collaborators:5,nextAction:"Archived — reviewed package ready for NOMAD preview"},
 {id:"PRJ-2025-037",name:"PL calibration verification",pipeline:"quick",currentStep:"export",progress:100,status:"complete",updated:"12 Dec 2025",owner:"Matteo Ginesi",objective:"Verify the photoluminescence calibration against the certified reference.",tags:["PL","Calibration"],samples:3,files:8,solutions:0,stacks:0,measurements:12,findings:2,collaborators:2,nextAction:"Archived"}],
 cabinet:[
 {id:"MAT-001",type:"material",name:"FAPbI₃ precursor",subtitle:"Perovskite precursor",status:"reviewed",meta:"Sigma-Aldrich · 99.99% · Lot FA-2407",tags:["Perovskite","Precursor"],usage:12},{id:"MAT-003",type:"material",name:"MAPbBr₃ precursor",subtitle:"Bandgap tuning precursor",status:"reviewed",meta:"GreatCell Solar · 99.9%",tags:["Perovskite"],usage:7},{id:"MAT-008",type:"material",name:"SnO₂ colloidal dispersion",subtitle:"Electron transport material",status:"reviewed",meta:"15% in H₂O",tags:["ETL"],usage:15},{id:"SOLV-004",type:"solvent",name:"DMF",subtitle:"Anhydrous solvent",status:"reviewed",meta:"CAS 68-12-2 · 99.8%",tags:["Solvent"],usage:18},{id:"SOLV-006",type:"solvent",name:"DMSO",subtitle:"Co-solvent",status:"reviewed",meta:"CAS 67-68-5 · 99.9%",tags:["Solvent"],usage:16},{id:"SOLV-009",type:"solvent",name:"Chlorobenzene",subtitle:"HTL solvent",status:"reviewed",meta:"CAS 108-90-7 · anhydrous",tags:["Solvent","HTL"],usage:11},{id:"SOL-011",type:"solution",name:"FA/MA 1.25 M reference",subtitle:"Reusable solution recipe",status:"reviewed",meta:"DMF:DMSO 4:1 · 1.25 M",tags:["Solution","CHOSE"],usage:9},{id:"SOL-017",type:"solution",name:"Spiro-OMeTAD standard",subtitle:"HTL solution recipe",status:"draft",meta:"72.3 mg/mL chlorobenzene",tags:["Solution","HTL"],usage:5},{id:"SOL-021",type:"solution",name:"SnO₂ diluted 1:5",subtitle:"ETL coating recipe",status:"reviewed",meta:"DI water · 0.22 μm filter",tags:["Solution","ETL"],usage:14},{id:"STK-003",type:"stack",name:"n-i-p reference device",subtitle:"Reusable stack template",status:"reviewed",meta:"Glass/FTO/SnO₂/Perovskite/Spiro/Au",tags:["Stack","n-i-p"],usage:17},{id:"STK-008",type:"stack",name:"p-i-n low-temperature",subtitle:"Flexible-compatible template",status:"reviewed",meta:"ITO/SAM/Perovskite/C60/BCP/Ag",tags:["Stack","p-i-n"],usage:6},{id:"MAP-002",type:"mapping",name:"Keithley JV CSV",subtitle:"Import mapping",status:"reviewed",meta:"Voltage, current density, scan direction",tags:["Mapping","JV"],usage:22},{id:"MAP-006",type:"mapping",name:"UV–Vis Cary export",subtitle:"Spectral import mapping",status:"reviewed",meta:"Wavelength, absorbance, baseline",tags:["Mapping","UV–Vis"],usage:8},{id:"ANA-004",type:"analysis",name:"JV comparison",subtitle:"Analysis recipe",status:"reviewed",meta:"PCE, Voc, Jsc, FF + hysteresis",tags:["Analysis","JV"],usage:19},{id:"ANA-009",type:"analysis",name:"Stability degradation",subtitle:"Analysis recipe",status:"reviewed",meta:"T80, normalized PCE, segmented fit",tags:["Analysis","Stability"],usage:7}],
 knowledge:[
 {id:"KB-SOP-014",type:"SOP",title:"Perovskite precursor preparation",summary:"Approved preparation sequence, glovebox limits, filtration and labeling requirements.",owner:"Lab Manager",updated:"01 Aug 2026",status:"approved",tags:["Solutions","Safety"]},{id:"KB-SOP-021",type:"SOP",title:"JV measurement and scan protocol",summary:"Reference scan direction, stabilization time, active area and reporting rules.",owner:"PV Characterisation",updated:"29 Jul 2026",status:"approved",tags:["JV","Measurement"]},{id:"KB-GUIDE-008",type:"Guide",title:"NOMAD metadata mapping guide",summary:"Local field mapping, required identifiers, units and provenance conventions.",owner:"Data Steward",updated:"26 Jul 2026",status:"review",tags:["NOMAD","Metadata"]},{id:"KB-NOTE-032",type:"Research note",title:"Recurring low-fill-factor signatures",summary:"Known equipment, contact and processing patterns associated with FF below 74%.",owner:"Matteo Ginesi",updated:"24 Jul 2026",status:"working",tags:["AI context","JV"]},{id:"KB-PAPER-104",type:"Literature",title:"Mixed-cation stability reference set",summary:"Curated papers and extracted conditions used to contextualise the current campaign.",owner:"Knowledge Curator",updated:"20 Jul 2026",status:"approved",tags:["Literature","Stability"]},{id:"KB-EQUIP-003",type:"Equipment",title:"Keithley 2450 configuration",summary:"Instrument profile, calibration status, export format and known caveats.",owner:"Metrology",updated:"18 Jul 2026",status:"approved",tags:["Equipment","JV"]}],
 tools:[
 {id:"solution-calculator",name:"Solution calculator",category:"Preparation",icon:"flask",description:"Calculate masses, molarity, solvent ratios and scaled batch volumes.",state:"ready"},{id:"unit-converter",name:"Scientific unit converter",category:"Common",icon:"swap",description:"Convert concentration, thickness, current density, time and temperature units.",state:"ready"},{id:"stack-builder",name:"Stack builder",category:"Preparation",icon:"layers",description:"Create ordered device layers with material, thickness and process metadata.",state:"ready"},{id:"file-profiler",name:"File profiler",category:"Data",icon:"file",description:"Inspect columns, delimiters, missing values, units and likely measurement type.",state:"ready"},{id:"mapping-validator",name:"Mapping validator",category:"Data",icon:"check",description:"Validate imported fields against an approved measurement mapping.",state:"ready"},{id:"descriptive-stats",name:"Descriptive statistics",category:"Analysis",icon:"chart",description:"Mean, median, dispersion, confidence intervals and grouped summaries.",state:"ready"},{id:"outlier-review",name:"Outlier review",category:"Analysis",icon:"warning",description:"Flag IQR and robust z-score candidates while preserving researcher control.",state:"ready"},{id:"curve-processor",name:"Curve processor",category:"Analysis",icon:"curve",description:"Smooth, normalize, align baselines and compare measurement curves.",state:"ready"},{id:"batch-compare",name:"Batch comparison",category:"Analysis",icon:"compare",description:"Compare formulations, stacks, operators, equipment and time windows.",state:"ready"},{id:"experiment-inspector",name:"Experiment Inspector",category:"Assistant",icon:"spark",description:"Summarise evidence, detect inconsistencies and propose review questions.",state:"simulated"},{id:"knowledge-query",name:"Ask LabFlow",category:"Assistant",icon:"book",description:"Search approved SOPs, data and explicit relationships together.",state:"simulated"},{id:"report-builder",name:"Report builder",category:"Reporting",icon:"file",description:"Assemble branded PDF, DOCX and Excel outputs from project evidence.",state:"ready"},{id:"nomad-mapper",name:"NOMAD mapper",category:"Export",icon:"external",description:"Preview structured field mappings and export readiness before submission.",state:"preview"}],
 demoDataset:[],
 aiFindings:[],
 experiments:[
  {id:"EXP-041",project:"PRJ-2026-014",process:"CHOSE Standard v2",samples:["S01","S02","S03"],solution:"SOL-B01",solvents:["DMF","DMSO"],stack:"STK-003/v2",annealing:{value:100,unit:"°C",duration:30},devicesDeclared:6,measurements:6,status:"reviewed"},
  {id:"EXP-052",project:"PRJ-2026-014",process:"CHOSE Standard v2",samples:["S04","S05"],solution:"SOL-B03",solvents:["DMF","DMSO"],stack:"STK-003/v2",annealing:{value:105,unit:"°C",duration:25},devicesDeclared:4,measurements:4,status:"reviewed"},
  {id:"EXP-067",project:"PRJ-2026-014",process:"CHOSE Standard v2",samples:["S06","S07","S08"],solution:null,solvents:["DMF","DMSO"],stack:"STK-003/v2",annealing:{value:100,unit:"",duration:30},devicesDeclared:20,measurements:24,status:"review"}
 ],
 validationIssues:[],
 importMapping:[],
 savedViews:[
  {id:"review",name:"Experiments requiring review",criteria:"Quality severity is error or warning",count:1},
  {id:"high-pce",name:"High-performing devices",criteria:"PCE > 20%",count:4},
  {id:"annealing",name:"Missing annealing parameters",criteria:"Annealing unit or duration is empty",count:1},
  {id:"export",name:"Experiments ready for export",criteria:"No blocking validation errors",count:2},
  {id:"dmso",name:"Experiments using DMSO",criteria:"Solution solvent contains DMSO",count:3}
 ],
 aiFoundation:{
  readiness:{overall:82,status:"Dataset build in progress",updated:"03 Aug 2026",metrics:[
   {id:"structured",label:"Structured metadata",value:94,detail:"Projects, experiments, samples and measurements use stable identifiers"},
   {id:"units",label:"Units normalized",value:97,detail:"Three imported process fields still need explicit units"},
   {id:"provenance",label:"Provenance coverage",value:88,detail:"Instrument, process snapshot and material lot are linked for most records"},
   {id:"targets",label:"Target completeness",value:84,detail:"PCE is complete; T80 and defect labels are still growing"},
   {id:"images",label:"Image annotation",value:63,detail:"61 of 96 optical, PL and EL images have reviewed labels"},
   {id:"leakage",label:"Split safety",value:100,detail:"Samples are grouped by experiment and batch before train/test assignment"}
  ],blocking:["Resolve 3 missing process units","Review 11 vision annotations","Link 5 samples to material lot provenance"]},
  activeDataset:{id:"DS-PV-MULTIMODAL-002",name:"Perovskite process, performance and imaging cohort",version:"0.7-draft",owner:"CHOSE Data Working Set",created:"31 Jul 2026",updated:"03 Aug 2026 · 22:40",records:184,experiments:27,measurements:612,images:96,features:34,targets:4,size:"12.8 GB",readiness:82,status:"building",split:"Grouped by experiment, batch and acquisition date",purpose:"PCE regression, stability forecasting, anomaly detection and film-defect vision baselines"},
  datasetLifecycle:[
   {id:"collect",label:"Collect",count:"735 assets",detail:"Forms, instruments, files and images",status:"complete"},
   {id:"map",label:"Map",count:"712 linked",detail:"Sample, experiment and process identity",status:"complete"},
   {id:"validate",label:"Validate",count:"23 issues",detail:"Units, ranges, duplicates and provenance",status:"review"},
   {id:"label",label:"Label",count:"61 / 96",detail:"Defect masks, quality classes and targets",status:"active"},
   {id:"snapshot",label:"Snapshot",count:"v0.7 draft",detail:"Immutable manifest and grouped split",status:"active"},
   {id:"train",label:"Train",count:"6 runs",detail:"Baselines, vision and forecasting",status:"queued"}
  ],
  modalities:[
   {id:"tabular",label:"Structured process data",icon:"table",count:184,coverage:94,detail:"Solutions, stack, deposition, annealing and environment"},
   {id:"electrical",label:"Electrical measurements",icon:"activity",count:428,coverage:100,detail:"JV, stabilized output, Voc, Jsc, FF and PCE"},
   {id:"spectral",label:"Spectra and time series",icon:"curve",count:184,coverage:78,detail:"UV–Vis, PL, EQE and accelerated-aging series"},
   {id:"vision",label:"Scientific images",icon:"eye",count:96,coverage:63,detail:"Optical, PL, EL and microscopy with reviewed labels"}
  ],
  qualityChecks:[
   {id:"Q-UNIT",label:"Units and dimensions",status:"review",passed:709,total:712,detail:"3 annealing fields missing explicit units"},
   {id:"Q-LINK",label:"Entity and provenance links",status:"review",passed:179,total:184,detail:"5 samples need material-lot linkage"},
   {id:"Q-DUP",label:"Duplicate and near-duplicate files",status:"pass",passed:735,total:735,detail:"Checksums and acquisition metadata are unique"},
   {id:"Q-RANGE",label:"Scientific range validation",status:"pass",passed:612,total:612,detail:"No impossible JV or environmental values detected"},
   {id:"Q-SPLIT",label:"Leakage-safe split",status:"pass",passed:27,total:27,detail:"Experiments and batches never cross data splits"},
   {id:"Q-LABEL",label:"Reviewed labels",status:"active",passed:61,total:96,detail:"11 labels await review; 24 images remain unlabeled"}
  ],
  datasetRows:[
   {sample:"S01",experiment:"EXP-041",batch:"B01",modalities:["Process","JV","PL","Optical"],target:"18.94% PCE",split:"train",quality:"ready"},
   {sample:"S02",experiment:"EXP-041",batch:"B01",modalities:["Process","JV","PL","Optical"],target:"20.16% PCE",split:"train",quality:"ready"},
   {sample:"S04",experiment:"EXP-052",batch:"B03",modalities:["Process","JV","EQE","PL","EL"],target:"21.10% PCE",split:"validation",quality:"ready"},
   {sample:"S06",experiment:"EXP-067",batch:"B05",modalities:["Process","JV","Optical"],target:"17.36% PCE",split:"review",quality:"warning"},
   {sample:"S08",experiment:"EXP-067",batch:"B06",modalities:["Process","JV","PL","EL"],target:"21.28% PCE",split:"test",quality:"warning"},
   {sample:"STB-014",experiment:"EXP-AGING-014",batch:"ENC-02",modalities:["Process","JV","Time series"],target:"T80 1,420 h",split:"validation",quality:"ready"},
   {sample:"VIS-031",experiment:"EXP-COAT-009",batch:"BC-11",modalities:["Process","Optical","Mask"],target:"Streaking",split:"train",quality:"ready"},
   {sample:"VIS-044",experiment:"EXP-LASER-006",batch:"LS-04",modalities:["EL","Mask","Geometry"],target:"P2 interruption",split:"test",quality:"review"},
   {sample:"VIS-052",experiment:"EXP-FLEX-003",batch:"FX-02",modalities:["Optical","PL","Mask"],target:"Edge delamination",split:"train",quality:"ready"},
   {sample:"STB-022",experiment:"EXP-AGING-018",batch:"ENC-05",modalities:["JV","Time series","Environment"],target:"T80 pending",split:"holdout",quality:"review"}
  ],
  labelQueue:[
   {id:"LBL-IMG-088",sample:"VIS-044",type:"Segmentation mask",label:"P2 interruption",reviewer:"Unassigned",status:"review",confidence:71},
   {id:"LBL-IMG-091",sample:"VIS-052",type:"Region label",label:"Edge delamination",reviewer:"M. Ginesi",status:"review",confidence:84},
   {id:"LBL-STB-022",sample:"STB-022",type:"Time-to-event",label:"T80 pending",reviewer:"Aging team",status:"waiting",confidence:0},
   {id:"LBL-QC-067",sample:"S06",type:"Quality class",label:"Process anomaly",reviewer:"Process owner",status:"review",confidence:76}
  ],
  datasetSnapshots:[
   {id:"DS-PV-MULTIMODAL-002",name:"Perovskite multimodal working cohort",version:"0.7",project:"Cross-project",created:"03 Aug 2026",rows:184,features:34,target:"PCE · T80 · defect class",excluded:12,status:"building",split:"Grouped by experiment and batch",sourceExperiments:["27 experiments","4 modalities","12.8 GB"]},
   {id:"DS-PCE-001",name:"Mixed-cation PCE baseline",version:"1.1",project:"PRJ-2026-014",created:"03 Aug 2026",rows:136,features:18,target:"PCE (%)",excluded:4,status:"ready-with-warnings",split:"Grouped 5-fold by experiment",sourceExperiments:["EXP-041","EXP-052","EXP-067"]},
   {id:"DS-VISION-001",name:"Coating and module defect images",version:"0.4",project:"Cross-project",created:"02 Aug 2026",rows:96,features:3,target:"Defect mask / class",excluded:7,status:"annotation",split:"Grouped by acquisition session",sourceExperiments:["Optical","PL","EL"]},
   {id:"DS-STABILITY-001",name:"Accelerated aging trajectories",version:"0.5",project:"PRJ-2026-003",created:"01 Aug 2026",rows:48,features:21,target:"T80 (h)",excluded:3,status:"draft",split:"Temporal holdout + experiment groups",sourceExperiments:["ISOS-L","Temperature","Humidity"]}
  ],
  featureSchema:[
   {name:"fa_fraction",label:"FA fraction",type:"numeric",unit:"fraction",role:"feature",source:"Solution formulation",coverage:100},
   {name:"annealing_temperature",label:"Annealing temperature",type:"numeric",unit:"°C",role:"feature",source:"Process snapshot",coverage:98},
   {name:"coating_speed",label:"Coating speed",type:"numeric",unit:"mm/s",role:"feature",source:"Deposition step",coverage:89},
   {name:"relative_humidity",label:"Relative humidity",type:"numeric",unit:"%",role:"feature",source:"Environment record",coverage:82},
   {name:"material_lot",label:"Material lot",type:"categorical",unit:"—",role:"group",source:"Cabinet provenance",coverage:97},
   {name:"experiment_id",label:"Experiment",type:"identifier",unit:"—",role:"group",source:"Experiment",coverage:100},
   {name:"pce",label:"Power conversion efficiency",type:"numeric",unit:"%",role:"target",source:"JV measurement",coverage:100},
   {name:"t80",label:"Time to 80% performance",type:"time-to-event",unit:"h",role:"target",source:"Stability analysis",coverage:72},
   {name:"defect_mask",label:"Defect segmentation mask",type:"image-mask",unit:"pixel",role:"target",source:"Reviewed annotation",coverage:63},
   {name:"image_modality",label:"Image modality",type:"categorical",unit:"—",role:"feature",source:"Acquisition metadata",coverage:100}
  ],
  models:[
   {id:"MDL-PCE-GB-002",name:"PCE gradient-boosting baseline",version:"1.1",task:"Regression",family:"Machine learning",algorithm:"Gradient Boosting",dataset:"DS-PCE-001",status:"candidate",scope:"Interpretable tabular baseline",metrics:{MAE:"1.18 pp",RMSE:"1.51 pp",R2:"0.78",CV:"Grouped 5-fold"},score:0.78,mae:1.18,rmse:1.51,parameters:"120 estimators · depth 3 · calibrated intervals",size:"940 KB"},
   {id:"MDL-STAB-GP-001",name:"T80 probabilistic forecaster",version:"0.5",task:"Survival / regression",family:"Machine learning",algorithm:"Gaussian Process + censoring",dataset:"DS-STABILITY-001",status:"prototype",scope:"Stability forecast with uncertainty",metrics:{MAE:"186 h",Coverage:"89%",CIndex:"0.74",Validation:"Temporal holdout"},score:0.74,parameters:"Matérn kernel · censored targets",size:"1.4 MB"},
   {id:"MDL-QC-IF-001",name:"Process anomaly detector",version:"0.6",task:"Anomaly detection",family:"Machine learning",algorithm:"Isolation Forest + rules",dataset:"DS-PV-MULTIMODAL-002",status:"evaluated",scope:"Flag unusual process and measurement combinations",metrics:{Precision:"0.86",Recall:"0.79",F1:"0.82",Validation:"Reviewed anomalies"},score:0.82,parameters:"Contamination 0.08 · deterministic guards",size:"380 KB"},
   {id:"MDL-VIS-UNET-001",name:"Film defect segmenter",version:"0.4",task:"Image segmentation",family:"Deep learning",algorithm:"Compact U-Net",dataset:"DS-VISION-001",status:"prototype",scope:"Optical / PL / EL defect masks",metrics:{mIoU:"0.78",Dice:"0.86",Precision:"0.88",Recall:"0.84"},score:0.78,parameters:"512 px tiles · 1.8 M parameters · augmentations",size:"7.6 MB"},
   {id:"MDL-VIS-CLS-002",name:"Defect triage classifier",version:"0.3",task:"Image classification",family:"Deep learning",algorithm:"Efficient CNN",dataset:"DS-VISION-001",status:"candidate",scope:"Prioritize images for human review",metrics:{Accuracy:"0.87",MacroF1:"0.83",AUROC:"0.91",Validation:"Session grouped"},score:0.83,parameters:"224 px crops · focal loss",size:"5.2 MB"},
   {id:"MDL-DOE-GP-001",name:"Next-experiment recommender",version:"0.2",task:"Bayesian optimization",family:"Scientific ML",algorithm:"Gaussian Process acquisition",dataset:"DS-PCE-001",status:"simulation",scope:"Rank informative process candidates",metrics:{Regret:"0.12",Coverage:"91%",Candidates:"24",Mode:"Offline replay"},score:0.88,parameters:"Expected improvement · feasibility constraints",size:"620 KB"}
  ],
  modelComparison:{labels:["Linear baseline","Random Forest","Gradient Boosting"],r2:[0.52,0.71,0.78],mae:[1.92,1.40,1.18],rmse:[2.31,1.72,1.51]},
  trainingHistory:{model:"MDL-VIS-UNET-001",metricLabel:"Validation Dice",epochs:[1,5,10,15,20,25,30,35,40],trainLoss:[1.14,0.82,0.61,0.48,0.39,0.34,0.31,0.29,0.28],validationLoss:[1.20,0.91,0.70,0.56,0.48,0.44,0.42,0.41,0.41],validationMetric:[0.31,0.48,0.61,0.70,0.77,0.81,0.84,0.86,0.86],learningRate:[0.001,0.001,0.001,0.0005,0.0005,0.0002,0.0002,0.0001,0.0001]},
  residuals:[{sample:"S01",observed:18.94,predicted:19.22},{sample:"S02",observed:20.16,predicted:19.71},{sample:"S03",observed:19.42,predicted:19.60},{sample:"S04",observed:21.10,predicted:20.63},{sample:"S05",observed:19.90,predicted:20.08},{sample:"S06",observed:17.36,predicted:18.62},{sample:"S07",observed:20.54,predicted:20.31},{sample:"S08",observed:21.28,predicted:20.80}],
  confusionMatrix:{labels:["Accept","Review"],values:[[31,4],[3,18]],accuracy:0.88},
  trainingRuns:[
   {id:"RUN-PCE-20260803-02",model:"MDL-PCE-GB-002",dataset:"DS-PCE-001",seed:42,status:"completed",duration:"1.8 s",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 18:44",bestMetric:"R² 0.78",artifact:"gb-pce-v11.bin",stage:"evaluated"},
   {id:"RUN-STAB-20260803-01",model:"MDL-STAB-GP-001",dataset:"DS-STABILITY-001",seed:17,status:"review",duration:"4.6 s",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 19:12",bestMetric:"C-index 0.74",artifact:"gp-t80-v05.bin",stage:"validation"},
   {id:"RUN-QC-20260803-01",model:"MDL-QC-IF-001",dataset:"DS-PV-MULTIMODAL-002",seed:42,status:"completed",duration:"2.1 s",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 19:26",bestMetric:"F1 0.82",artifact:"qc-if-v06.bin",stage:"evaluated"},
   {id:"RUN-VIS-20260803-03",model:"MDL-VIS-UNET-001",dataset:"DS-VISION-001",seed:11,status:"completed",duration:"3 m 18 s",hardware:"GPU simulation",created:"03 Aug 2026 · 20:05",bestMetric:"Dice 0.86",artifact:"film-unet-v04.onnx",stage:"evaluated"},
   {id:"RUN-VIS-20260803-04",model:"MDL-VIS-CLS-002",dataset:"DS-VISION-001",seed:11,status:"review",duration:"1 m 42 s",hardware:"GPU simulation",created:"03 Aug 2026 · 20:18",bestMetric:"Macro F1 0.83",artifact:"defect-triage-v03.onnx",stage:"review"},
   {id:"RUN-DOE-20260803-01",model:"MDL-DOE-GP-001",dataset:"DS-PCE-001",seed:7,status:"queued",duration:"—",hardware:"Local CPU demonstration",created:"03 Aug 2026 · 22:31",bestMetric:"Pending",artifact:"not-created",stage:"queued"}
  ],
  predictions:[
   {id:"PRD-S08-PCE-001",sample:"S08",kind:"PCE forecast",label:"Predicted PCE",unit:"%",model:"MDL-PCE-GB-002",dataset:"DS-PCE-001",predicted:20.8,uncertainty:1.2,observed:21.28,coverage:93,status:"reviewed",note:"Prediction is consistent with the observed result and remains inside the applicability region."},
   {id:"PRD-S06-PCE-001",sample:"S06",kind:"PCE forecast",label:"Predicted PCE",unit:"%",model:"MDL-PCE-GB-002",dataset:"DS-PCE-001",predicted:18.62,uncertainty:1.6,observed:17.36,coverage:81,status:"needs-review",note:"Large residual and incomplete process provenance; inspect fabrication before interpretation."},
   {id:"PRD-STB-014-T80",sample:"STB-014",kind:"Stability forecast",label:"Predicted T80",unit:"h",model:"MDL-STAB-GP-001",dataset:"DS-STABILITY-001",predicted:1480,uncertainty:260,observed:1420,coverage:89,status:"reviewed",note:"Observed T80 falls inside the demonstration uncertainty interval."},
   {id:"PRD-VIS-044-DEFECT",sample:"VIS-044",kind:"Vision inspection",label:"Defect probability",unit:"%",model:"MDL-VIS-CLS-002",dataset:"DS-VISION-001",predicted:87,uncertainty:8,observed:100,coverage:96,status:"needs-review",note:"Model highlights a likely P2 interruption; the segmentation mask still requires human approval."}
  ],
  visionSamples:[
   {id:"IMG-OPT-031",sample:"VIS-031",modality:"Optical",label:"Coating streak",status:"reviewed",score:0.94,kind:"streak",detail:"Linear non-uniformity across blade-coating direction"},
   {id:"IMG-PL-018",sample:"S04",modality:"PL map",label:"Uniform",status:"reviewed",score:0.91,kind:"pl",detail:"Homogeneous emission with a low-intensity edge region"},
   {id:"IMG-EL-044",sample:"VIS-044",modality:"EL module",label:"P2 interruption",status:"review",score:0.87,kind:"module",detail:"Inactive stripe aligned with the second scribing line"},
   {id:"IMG-OPT-052",sample:"VIS-052",modality:"Optical",label:"Edge delamination",status:"review",score:0.84,kind:"edge",detail:"Irregular boundary region on flexible substrate"},
   {id:"IMG-MIC-061",sample:"VIS-061",modality:"Microscopy",label:"Pinholes",status:"reviewed",score:0.89,kind:"pinhole",detail:"Multiple isolated low-coverage regions"},
   {id:"IMG-EL-073",sample:"VIS-073",modality:"EL module",label:"Microcrack",status:"queued",score:0.72,kind:"crack",detail:"Weak diagonal discontinuity requiring manual confirmation"}
  ],
  visionMetrics:{dataset:"DS-VISION-001",reviewed:61,total:96,classes:[{label:"Uniform",count:24},{label:"Streak / non-uniform",count:19},{label:"Pinhole",count:17},{label:"Scribing defect",count:14},{label:"Delamination",count:12},{label:"Other / review",count:10}],metrics:[{label:"Mean IoU",value:"0.78"},{label:"Dice",value:"0.86"},{label:"Precision",value:"0.88"},{label:"Recall",value:"0.84"}]},
  stabilityForecast:{sample:"STB-014",times:[0,100,250,500,750,1000,1250,1500,1750],observed:[100,99,97,94,91,87,83,79,null],forecast:[100,99,97,94,91,87,83,79,75],lower:[100,98,95,91,86,81,76,70,65],upper:[100,100,99,97,96,94,90,87,84],t80:1480},
  experimentCandidates:[
   {rank:1,id:"DOE-024",speed:"14 mm/s",temperature:"105 °C",concentration:"1.20 M",score:0.91,objective:"High information gain",risk:"Low",reason:"Fills the least explored stable region"},
   {rank:2,id:"DOE-019",speed:"18 mm/s",temperature:"110 °C",concentration:"1.25 M",score:0.86,objective:"Expected PCE improvement",risk:"Medium",reason:"Near the current optimum but with humidity sensitivity"},
   {rank:3,id:"DOE-021",speed:"12 mm/s",temperature:"100 °C",concentration:"1.30 M",score:0.82,objective:"Stability trade-off",risk:"Low",reason:"Tests a lower-speed high-concentration interaction"},
   {rank:4,id:"DOE-015",speed:"22 mm/s",temperature:"105 °C",concentration:"1.15 M",score:0.73,objective:"Boundary exploration",risk:"High",reason:"Useful scientifically but near a known coating limit"},
   {rank:5,id:"DOE-011",speed:"16 mm/s",temperature:"95 °C",concentration:"1.20 M",score:0.68,objective:"Reproducibility",risk:"Low",reason:"Repeats a sparse region with better controls"}
  ],
  processSignals:[
   {label:"Valid-device yield",value:"76%",trend:"+8 pp",state:"good",detail:"Last four completed batches"},
   {label:"Median PCE",value:"19.8%",trend:"+0.6 pp",state:"good",detail:"Grouped by experiment"},
   {label:"Batch variability",value:"1.4 pp",trend:"−0.3 pp",state:"good",detail:"Interquartile range"},
   {label:"Open quality issues",value:"23",trend:"5 blocking",state:"warning",detail:"Across the active dataset"}
  ],
  useCases:[
   {id:"quality",title:"Quality and anomaly detection",stage:"POC ready",icon:"warning",description:"Find invalid measurements, unusual process combinations, drift and provenance gaps before training."},
   {id:"performance",title:"Performance prediction",stage:"Baseline",icon:"chart",description:"Estimate PCE, Voc, Jsc and FF with uncertainty and grouped validation."},
   {id:"stability",title:"Stability forecasting",stage:"Prototype",icon:"activity",description:"Predict T80/T90 from process, device and accelerated-aging trajectories."},
   {id:"vision",title:"Film and module vision",stage:"Prototype",icon:"eye",description:"Classify and segment coating, PL, EL, scribing and flexible-module defects."},
   {id:"doe",title:"Experiment optimization",stage:"Simulation",icon:"flask",description:"Rank the next most informative feasible experiment with Bayesian optimization."},
   {id:"reproducibility",title:"Reproducibility monitoring",stage:"POC ready",icon:"compare",description:"Track batch, material-lot, instrument, operator and environmental effects."}
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

window.LabFlowPipelineRuntime?.hydrateData(window.LabFlowData, "chose");

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
    getActiveDataset: () => ({...data.aiFoundation.activeDataset}),
    listDatasetLifecycle: () => list(data.aiFoundation.datasetLifecycle),
    listDatasetRows: () => list(data.aiFoundation.datasetRows),
    listModalities: () => list(data.aiFoundation.modalities),
    listQualityChecks: () => list(data.aiFoundation.qualityChecks),
    listLabelQueue: () => list(data.aiFoundation.labelQueue),
    listDatasetSnapshots: () => list(data.aiFoundation.datasetSnapshots),
    listFeatureSchema: () => list(data.aiFoundation.featureSchema),
    listModels: () => list(data.aiFoundation.models),
    listTrainingRuns: () => list(data.aiFoundation.trainingRuns),
    listPredictions: () => list(data.aiFoundation.predictions),
    listVisionSamples: () => list(data.aiFoundation.visionSamples),
    listExperimentCandidates: () => list(data.aiFoundation.experimentCandidates),
    listRagEvaluations: () => list(data.aiFoundation.ragEvaluation)
  });
})();
