(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const Log=LF.Logger?LF.Logger.scope('math'):null;
  let queueTimer=null,queuedRoot=null;

  function extractDisplayEquations(markdown){
    const source=String(markdown||''),out=[];
    const re=/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g;
    let m,index=0;
    while((m=re.exec(source))){const latex=String(m[1]!=null?m[1]:m[2]||'').trim();if(latex)out.push({index:index++,latex:latex,raw:m[0]});}
    return out;
  }

  function readable(latex){
    let s=String(latex||'');
    const greek={alpha:'α',beta:'β',gamma:'γ',delta:'δ',Delta:'Δ',epsilon:'ε',varepsilon:'ε',eta:'η',theta:'θ',lambda:'λ',mu:'μ',nu:'ν',pi:'π',rho:'ρ',sigma:'σ',Sigma:'Σ',tau:'τ',phi:'φ',varphi:'φ',chi:'χ',psi:'ψ',omega:'ω',Omega:'Ω'};
    s=s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,'($1)/($2)');
    s=s.replace(/\\(?:mathrm|text|operatorname)\s*\{([^{}]*)\}/g,'$1');
    s=s.replace(/\\([A-Za-z]+)/g,function(_m,name){if(Object.prototype.hasOwnProperty.call(greek,name))return greek[name];return({times:'×',cdot:'·',pm:'±',approx:'≈',leq:'≤',geq:'≥',neq:'≠',rightarrow:'→',leftarrow:'←',infty:'∞',partial:'∂',nabla:'∇',sum:'Σ',prod:'Π'}[name]||name);});
    s=s.replace(/\\[,;!]/g,' ').replace(/\\_/g,'_').replace(/\{([^{}]*)\}/g,'$1').replace(/\s+/g,' ').trim();
    return s;
  }

  function ready(){
    const M=window.MathJax;
    if(!M)return Promise.resolve(false);
    if(M.startup&&M.startup.promise)return M.startup.promise.then(function(){return true;}).catch(function(err){if(Log)Log.warn('startup.failed',{error:err});return false;});
    return Promise.resolve(!!M.typesetPromise);
  }

  async function typeset(root){
    root=root||document.body;
    if(!root)return false;
    const ok=await ready();if(!ok||!window.MathJax||!window.MathJax.typesetPromise)return false;
    try{
      if(window.MathJax.typesetClear)window.MathJax.typesetClear([root]);
      await window.MathJax.typesetPromise([root]);
      return true;
    }catch(err){if(Log)Log.warn('typeset.failed',{error:err});return false;}
  }

  function queueTypeset(root,delay){
    queuedRoot=root||queuedRoot||document.body;
    clearTimeout(queueTimer);
    queueTimer=setTimeout(function(){const target=queuedRoot;queuedRoot=null;typeset(target);},Math.max(0,Number(delay)||90));
  }

  function svgString(svg){
    const clone=svg.cloneNode(true);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(clone);
  }

  function imageFromSvg(svg,latex){
    return new Promise(function(resolve,reject){
      try{
        const vb=(svg.getAttribute('viewBox')||'0 0 1000 200').trim().split(/\s+/).map(Number),vw=Math.max(1,Number(vb[2])||1000),vh=Math.max(1,Number(vb[3])||200),ratio=Math.max(.25,Math.min(24,vw/vh));
        const sourceLatex=String(latex||''),rows=Math.max(1,(sourceLatex.match(/\\\\|\\begin\{|\n/g)||[]).length+1),targetHeight=Math.min(84,rows>1?52+Math.min(3,rows-1)*8:40);let cssHeight=targetHeight,cssWidth=cssHeight*ratio;if(cssWidth>760){cssWidth=760;cssHeight=cssWidth/ratio;}if(cssWidth<36)cssWidth=36;cssHeight=Math.max(24,Math.min(96,cssHeight));const scale=3;
        const source='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgString(svg)),img=new Image();
        img.onload=function(){
          const canvas=document.createElement('canvas');canvas.width=Math.round(cssWidth*scale);canvas.height=Math.round(cssHeight*scale);const ctx=canvas.getContext('2d');
          ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
          const pad=8*scale,availW=canvas.width-pad*2,availH=canvas.height-pad*2,drawRatio=vw/vh;let dw=availW,dh=dw/drawRatio;if(dh>availH){dh=availH;dw=dh*drawRatio;}
          ctx.drawImage(img,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
          resolve({dataUrl:canvas.toDataURL('image/jpeg',.96),widthPx:cssWidth,heightPx:cssHeight,pixelWidth:canvas.width,pixelHeight:canvas.height});
        };
        img.onerror=function(){reject(new Error('Could not rasterize LaTeX equation.'));};img.src=source;
      }catch(err){reject(err);}
    });
  }

  async function renderDisplayEquations(markdown){
    const equations=extractDisplayEquations(markdown);if(!equations.length)return[];
    const ok=await ready();if(!ok||!window.MathJax||!window.MathJax.tex2svgPromise)return equations.map(function(e){return Object.assign({},e,{fallback:true});});
    const out=[];
    for(const eq of equations){
      try{
        const node=await window.MathJax.tex2svgPromise(eq.latex,{display:true}),svg=node&&node.querySelector?node.querySelector('svg'):null;
        if(!svg)throw new Error('MathJax did not return SVG.');
        const image=await imageFromSvg(svg,eq.latex);out.push(Object.assign({},eq,image));
      }catch(err){if(Log)Log.warn('equation.rasterize-failed',{index:eq.index,error:err});out.push(Object.assign({},eq,{fallback:true}));}
    }
    return out;
  }

  LF.Math={extractDisplayEquations:extractDisplayEquations,readable:readable,ready:ready,typeset:typeset,queueTypeset:queueTypeset,renderDisplayEquations:renderDisplayEquations};
}());
