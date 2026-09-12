'use strict';
const fs=require('fs'),path=require('path');
function ok(value,label){if(!value)throw new Error(label||'assertion failed');}
module.exports=function(t){
  const root=path.resolve(__dirname,'../..');
  const app=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
  const ui=fs.readFileSync(path.join(root,'assets/css/ui.css'),'utf8');
  const tokens=fs.readFileSync(path.join(root,'assets/css/tokens.css'),'utf8');
  const theme=fs.readFileSync(path.join(root,'assets/js/ui/theme.js'),'utf8');
  const cabinet=fs.readFileSync(path.join(root,'assets/js/pages/cabinet-page.js'),'utf8');
  const kit=fs.readFileSync(path.join(root,'ui-kit.html'),'utf8');
  const skill=fs.readFileSync(path.join(root,'.agent/skills/labflow-ui/SKILL.md'),'utf8');

  t['Shared density is tokenized instead of page-specific']=function(){
    ['--page-gap:','--panel-head-py:','--panel-head-px:','--panel-body-pad:','--task-gap:'].forEach(function(x){ok(tokens.includes(x),'missing density token '+x);});
    ok(ui.includes('padding: var(--panel-head-py) var(--panel-head-px)'), 'panel head uses density token');
    ok(ui.includes('padding: var(--panel-body-pad)'), 'panel body uses density token');
    ok(app.includes('gap: var(--page-gap)'), 'page uses shared gap');
  };

  t['Instrument theme keeps native scientific forms light and chrome local']=function(){
    ok(theme.includes("document.documentElement.style.colorScheme = 'light'"),'root native controls stay light');
    ok(app.includes(':root:not([data-theme="light"]) .main-area{color-scheme:light}'),'scientific canvas color scheme');
    ok(app.includes(':root:not([data-theme="light"]) .assistant-panel{color-scheme:dark}')||app.includes('.assistant-panel{color-scheme:dark}'),'assistant dark chrome scheme');
  };

  t['Assistant embedded components use Assistant tokens only']=function(){
    ok(app.includes('.chat-action-menu')&&app.includes('background:var(--assistant-surface)'), 'Action menu uses the Assistant surface');
    ok(app.includes('.chat-action-item')&&app.includes('var(--assistant-border)'), 'Action menu items stay inside the Assistant palette');
    ok(app.includes('.chat-event.unavailable{border-left-color:var(--assistant-border);background:var(--assistant-surface-2)}'),'unavailable event stays in Assistant palette');
    ok(ui.includes('.assistant-panel .badge')&&ui.includes('background: var(--assistant-surface-2)'), 'assistant badges are locally themed');
    ok(ui.includes('.assistant-panel .notice')&&ui.includes('background: var(--assistant-surface)'), 'assistant notices are locally themed');
  };

  t['Cabinet is canvas-native with restrained kind accents']=function(){
    ok(cabinet.includes('Build once. Reuse in future experiments.'),'Cabinet purpose must be obvious');
    ok(cabinet.includes('cabinet-shelf-viewport')&&cabinet.includes('cabinet-shelf-list')&&cabinet.includes('cabinet-resource-editor'),'Cabinet uses one responsive shelf above one editor');
    ok(cabinet.includes('cabinet-library-tools')&&cabinet.includes('cabinetKindFilter'),'Cabinet uses one simple search/type/create toolbar');
    ok(!cabinet.includes('filter-chip')&&!cabinet.includes('cabinet-filter-tabs')&&!cabinet.includes('cabinet-catalog-row'),'retired Cabinet filters/table controls removed');
    ok(!cabinet.includes('cabinet-workbench')&&!cabinet.includes('cabinet-shelf-panel'),'retired Cabinet workbench markup removed');
    ['kind-material','kind-chemical','kind-solution','kind-substrate','kind-stack','kind-protocol','kind-instrument'].forEach(function(x){ok(app.includes('.cabinet-resource-tile.'+x),'missing Cabinet kind accent '+x);});
    ok(app.includes('grid-template-columns:repeat(3,minmax(0,1fr))')&&app.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'responsive shelf columns are explicit');
    ok(app.includes('background:color-mix(in srgb,var(--surface) 90%,var(--cabinet-kind) 10%)'),'kind preview uses theme canvas');
  };

  t['UI Kit and skill teach the Assistant, Cabinet and JSONL knowledge contracts']=function(){
    ok(kit.includes('id="cabinet-pattern"'),'Cabinet pattern in UI Kit');
    ok(kit.includes('Assistant theme contract'),'Assistant theme rule in UI Kit');
    ok(skill.includes('Assistant is a local themed surface'),'Assistant rule in skill');
    ok(skill.includes('Save → Reuse → the experiment keeps its own copy'),'Cabinet mental model in skill');
    ok(kit.includes('My JSONL library')&&skill.includes('Built-in library + My JSONL'),'JSONL knowledge model must be documented');
  };
  return t;
};
