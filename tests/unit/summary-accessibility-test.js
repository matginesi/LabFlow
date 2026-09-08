'use strict';
const fs=require('fs'),path=require('path');
module.exports=function(t,_LF,ctx){
  t['summary elements contain no nested interactive controls']=function(){
    const root=ctx.root,files=[];
    function walk(dir){fs.readdirSync(dir,{withFileTypes:true}).forEach(function(ent){const p=path.join(dir,ent.name);if(ent.isDirectory()){if(ent.name!=='.git')walk(p);}else if(/\.(?:js|html)$/.test(ent.name))files.push(p);});}
    walk(path.join(root,'assets','js'));files.push(path.join(root,'index.html'),path.join(root,'ui-kit.html'));
    const bad=[];
    files.forEach(function(file){const src=fs.readFileSync(file,'utf8'),re=/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi;let m;while((m=re.exec(src))){if(/<(?:button|input|select|textarea|a\b|details\b)[^>]*>/i.test(m[1]))bad.push(path.relative(root,file)+':'+(src.slice(0,m.index).split('\n').length));}});
    if(bad.length)throw new Error('Interactive descendants inside <summary>: '+bad.join(', '));
  };
  return t;
};
