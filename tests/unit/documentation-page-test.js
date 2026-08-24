'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF,ctx){
  require(path.join(ctx.root,'assets/js/core.js'));
  require(path.join(ctx.root,'assets/js/pages/docs-bundle.js'));
  LF.State={state:{docsSlug:'guides--getting-started',docsQuery:'',docsSection:'all'}};
  LF.PageShell={pageHead:function(title,subtitle){return'<div class="page-head"><h1>'+title+'</h1><p>'+subtitle+'</p></div>';}};
  require(path.join(ctx.root,'assets/js/pages/docs-page.js'));

  t['documentation bundle is generated from canonical Markdown sources']=function(){
    const sources=[];
    function walk(dir){fs.readdirSync(dir,{withFileTypes:true}).forEach(function(entry){const p=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='superpowers')walk(p);}else if(entry.name.endsWith('.md')&&entry.name!=='AUDIT_REPORT.md')sources.push(p);});}
    walk(path.join(ctx.root,'docs'));sources.sort();const digest=crypto.createHash('sha256');
    sources.forEach(function(file){digest.update(path.relative(path.join(ctx.root,'docs'),file).split(path.sep).join('/'));digest.update(fs.readFileSync(file,'utf8'));});
    assert(LF.DocsBundle.digest,digest.digest('hex'),'source digest');
    assert(LF.DocsBundle.documents.length,sources.length,'all canonical Markdown included');
  };

  t['documentation page renders search, provenance and selected Markdown']=function(){
    const html=LF.DocsPage.render();
    assert(html.includes('id="docsSearch"'),true,'search control');
    assert(html.includes('Versioned Markdown'),true,'source provenance');
    assert(html.includes('<h1 id="start-with-labflow">Start with LabFlow</h1>'),true,'rendered Markdown heading');
    assert(html.includes('data-copy-doc="guides--getting-started"'),true,'copy Markdown action');
  };

  t['Mermaid fences render as local accessible diagrams and retain source']=function(){
    const html=LF.DocsPage.render();
    assert(html.includes('class="docs-mermaid"'),true,'diagram surface');
    assert(html.includes('role="img" aria-label="Documentation flow diagram"'),true,'accessible SVG');
    assert(html.includes('Mermaid source'),true,'source disclosure');
    assert(html.includes('LFMERMAIDTOKEN'),false,'render token does not leak');
  };

  t['relative Markdown links resolve to documentation topics']=function(){
    const html=LF.DocsPage.render();
    assert(html.includes('data-doc-slug="guides--research-workflow"'),true,'guide link');
    assert(html.includes('data-doc-slug="privacy"'),true,'parent-directory link');
  };
};
