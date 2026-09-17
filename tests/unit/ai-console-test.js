'use strict';
require('../../assets/js/logger.js');
const LF=global.LabFlow;
LF.Storage={getAiSettings:function(){return{provider:'glm',model:'glm-4.7-flash'};},getApiKey:function(){return'';}};
LF.AIProviders={glm:{id:'glm',name:'GLM / Zhipu AI',model:'glm-4.7-flash',endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions'}};
LF.AIProviderList=[LF.AIProviders.glm];
require('../../assets/js/ai/console.js');
module.exports=function(t){t['AI developer console loads with a defined help function']=function(){if(typeof LF.AIConsole.help!=='function')throw new Error('AIConsole.help missing');const text=LF.AIConsole.help();if(text.indexOf('probe')<0)throw new Error('help text is incomplete');};};
