/*
 * MathJax typesetting for rendered Markdown and structured output.
 * Boundary: Presentation-only; own no application state and never block a render.
 */
(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const Log=LF.Logger?LF.Logger.scope('math'):null;
  let queueTimer=null,queuedRoot=null;

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

  // Coalesce repeated render requests into one MathJax typeset pass.
  function queueTypeset(root,delay){
    queuedRoot=root||queuedRoot||document.body;
    clearTimeout(queueTimer);
    queueTimer=setTimeout(function(){const target=queuedRoot;queuedRoot=null;typeset(target);},Math.max(0,Number(delay)||90));
  }

  LF.Math={ready:ready,typeset:typeset,queueTypeset:queueTypeset};
}());
