'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/data/analysis.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
}

module.exports = function (t, LF) {
  LF.PromptRegistry={effectiveRules:function(){return{
    metric_ranges:{ff:{min:0,max:1,severity:'warning'},efficiency:{min:0,max:100,severity:'warning'},voc:{min:0,max:2,severity:'warning'},jsc_abs:{max:100,severity:'warning'}},
    pair_checks:{hysteresis_abs_warning:0.2,jsc_difference_percent_warning:50,efficiency_difference_percent_warning:50},
    ranking:{exclude_danger_findings:true,require_finite_efficiency:true}
  };}};

  function experiment(factor) {
    return {
      id:'exp',analysisSettings:{mismatchFactor:factor||1},patches:[],findings:[],samples:[
        {id:'s1',name:'DEVICE A'},{id:'s2',name:'REF CONTROL'}
      ],measurements:[
        {id:'m1',file:'a.txt',sample:'DEVICE A',group:'A',isRef:false,fw:{voc:1.0,jsc:20,ff:0.8,eff:18},rv:{voc:1.0,jsc:20,ff:0.8,eff:20}},
        {id:'m2',file:'ref.txt',sample:'REF CONTROL',group:'REF',isRef:true,fw:{voc:1.0,jsc:20,ff:0.8,eff:17},rv:{voc:1.0,jsc:20,ff:0.8,eff:19}}
      ]
    };
  }

  t['analysis builds separate REF and non-REF rankings'] = function () {
    const exp=experiment(1),a=LF.Analysis.analyze(exp);
    assert(a.summary.measurementCount,2,'measurement count');
    assert(a.topNonRef.length,1,'non-ref count');
    assert(a.topNonRef[0].sample,'DEVICE A','non-ref sample');
    assert(a.topRef.length,1,'ref count');
    assert(a.topRef[0].sample,'REF CONTROL','ref sample');
  };

  t['mismatch factor scales efficiency but never hysteresis'] = function () {
    const exp=experiment(2);LF.Analysis.analyze(exp);
    assert(exp.measurements[0].bestEff,10,'scaled best efficiency');
    assert(Number(exp.measurements[0].hysteresis.toFixed(4)),0.1,'unscaled hysteresis');
  };
};
