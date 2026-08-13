'use strict';
const RE=require('../../vendor/report-export/report-export.js');
function truthy(v,label){if(!v)throw new Error((label||'assert')+': expected truthy');}
module.exports=function(t){
  t['DOCX and PDF contain the active editor Markdown text']=async function(){
    const model={title:'Demo',author:'A',lab:'L',sourceZip:'demo.zip',reportKind:'lab',sourceWords:4,markdown:'# Editor title\n\nExact editor phrase 123.',includeCharts:false,figures:[],chartData:{figureSelection:{}}};
    const docx=await RE.buildDocx(model),zip=await JSZip.loadAsync(await docx.arrayBuffer()),xml=await zip.file('word/document.xml').async('string');
    truthy(xml.indexOf('Exact editor phrase 123.')>=0,'DOCX editor text');
    const pdf=RE.buildPdf(model),pdfText=await pdf.text();
    truthy(pdfText.indexOf('Exact editor phrase 123.')>=0,'PDF editor text');
  };
  t['PDF honors the selected report figures only']=async function(){
    const model={title:'Demo',markdown:'# T',includeCharts:true,top10:[{cell:'S1',effRV:20}],groupStatistics:[{name:'A',medianEff:19}],chartData:{efficiencies:[18,19,20],hysteresis:[1,2],scatter:[{cell:'S1',eff:20,hysteresisPct:2}],bestCurve:null,thresholds:{hysteresisPct:30},figureSelection:{pceDistribution:false,hysteresisDistribution:false,bestJvmCurve:false,efficiencyHysteresis:true,topEfficiency:false,groupComparison:false}}};
    const pdf=RE.buildPdf(model),text=await pdf.text();
    truthy(text.indexOf('Efficiency vs hysteresis')>=0,'selected scatter present');
    truthy(text.indexOf('PCE distribution')<0,'unselected histogram absent');
    truthy(text.indexOf('Top RV efficiency')<0,'unselected ranking absent');
  };
  return t;
};
