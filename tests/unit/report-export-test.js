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

  t['Markdown parser keeps display LaTeX as an equation block']=function(){
    const blocks=RE.parseMarkdown('Inline $J_{SC}$ stays inline.\n\n$$\n\\Delta \mathrm{PCE}=\mathrm{PCE}_{RV}-\mathrm{PCE}_{FW}\n$$');
    truthy(blocks.some(function(b){return b.type==='equation'&&b.latex.indexOf('PCE')>=0;}),'equation block');
  };
  t['DOCX and PDF export display equations without leaking raw Markdown delimiters']=async function(){
    const math={index:0,latex:'E=mc^2',dataUrl:'data:image/jpeg;base64,AAECAwQF',widthPx:420,heightPx:90,pixelWidth:840,pixelHeight:180};
    const model={title:'Math demo',markdown:'Before.\n\n$$\nE=mc^2\n$$\n\nAfter $J_{SC}$.',includeCharts:false,figures:[],mathImages:[math],chartData:{figureSelection:{}}};
    const docx=await RE.buildDocx(model),zip=await JSZip.loadAsync(await docx.arrayBuffer()),xml=await zip.file('word/document.xml').async('string');
    truthy(xml.indexOf('<w:drawing>')>=0,'DOCX equation drawing');truthy(!!zip.file('word/media/equation-1.jpg'),'DOCX equation image');
    const pdf=RE.buildPdf(model),pdfText=await pdf.text();truthy(pdfText.indexOf('/ImEq1')>=0,'PDF equation image resource');truthy(pdfText.indexOf('$$')<0,'raw display delimiter absent');truthy(pdfText.indexOf('J_SC')>=0||pdfText.indexOf('JSC')>=0,'inline math readable');
  };
  return t;
};
