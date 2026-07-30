document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = document.body.dataset.page || 'dashboard';
  const X = window.LabFlowExporters;

  const icons = {
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    home:'<path d="m3 11 9-8 9 8v9H4z"/><path d="M9 20v-6h6v6"/>',
    model:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8M18 8l-5 8"/>',
    flow:'<circle cx="6" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 6h3a3 3 0 0 1 3 3 3 3 0 0 0 3 3M8 18h3a3 3 0 0 0 3-3 3 3 0 0 1 3-3"/>',
    flask:'<path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10"/>',
    catalog:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    grid:'<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M8 4v16M15 4v16"/>',
    code:'<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
    download:'<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    report:'<path d="M6 2h9l3 3v17H6zM15 2v4h4M9 11h6M9 15h6M9 19h4"/>',
    table:'<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M8 4v16M15 4v16"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    moon:'<path d="M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    warning:'<path d="M12 3 3 20h18zM12 9v4M12 17h.01"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    file:'<path d="M6 2h8l4 4v16H6zM14 2v5h5"/>',
    upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    image:'<rect x="3" y="4" width="18" height="16"/><circle cx="8" cy="9" r="2"/><path d="m4 18 5-5 3 3 3-4 5 6"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    save:'<path d="M5 3h12l2 2v16H5zM8 3v6h8V3M8 21v-7h8v7"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock:'<rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    chevron:'<path d="m8 10 4 4 4-4"/>',
    spark:'<path d="m12 3 1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8z"/><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
    brain:'<path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.8A3 3 0 0 0 6 14v1a3 3 0 0 0 3 3M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.8A3 3 0 0 1 18 14v1a3 3 0 0 1-3 3M9 4v16M15 4v16M9 8h2M13 12h2M9 16h2"/>',
    folder:'<path d="M3 6h7l2 2h9v11H3z"/><path d="M3 10h18"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;

  const userProfiles = {
    ew:{id:'USR-EW',name:'Eleanor Wright',initials:'EW',role:'Principal investigator',email:'eleanor.wright@lab.example',workspaceId:'WS-EW-01',workspace:'Eleanor research workspace',privateLabel:'Private workspace',preferences:{language:'English',units:'SI',date:'DD MMM YYYY'},metrics:{projects:3,experiments:12,samples:48,files:184,pce:'21.4%'},recent:'EXP-2026-052',projects:[
      {id:'PRJ-MCP-01',key:'mixed',name:'Mixed-cation perovskite optimisation',status:'Active',description:'Optimise absorber composition and deposition while keeping a reusable device baseline.',experiments:5,samples:24,progress:72,nomad:92,updated:'Today · 16:20',tags:['Perovskite','Device','Optimisation']},
      {id:'PRJ-STB-02',key:'stability',name:'Encapsulation and stability study',status:'Active',description:'Compare encapsulation strategies and operational stability under controlled ageing.',experiments:4,samples:16,progress:48,nomad:68,updated:'Yesterday',tags:['Stability','Encapsulation']},
      {id:'PRJ-FLX-03',key:'flexible',name:'Flexible p-i-n pilot',status:'Planning',description:'Early feasibility work for low-temperature flexible substrates and inverted stacks.',experiments:3,samples:8,progress:22,nomad:44,updated:'24 Jul 2026',tags:['Flexible','p-i-n']}
    ]},
    ag:{id:'USR-AG',name:'Amelia Grant',initials:'AG',role:'Researcher',email:'amelia.grant@lab.example',workspaceId:'WS-AG-01',workspace:'Amelia research workspace',privateLabel:'Private workspace',preferences:{language:'English',units:'SI',date:'DD MMM YYYY'},metrics:{projects:2,experiments:5,samples:21,files:76,pce:'18.9%'},recent:'EXP-2026-018',projects:[
      {id:'PRJ-AG-FLX',key:'flex',name:'Flexible device screening',status:'Active',description:'Screen low-temperature transport layers on PET/ITO substrates.',experiments:3,samples:15,progress:61,nomad:78,updated:'Today · 10:05',tags:['Flexible','Screening']},
      {id:'PRJ-AG-INK',key:'ink',name:'Precursor ink shelf-life',status:'Planning',description:'Track precursor quality and film response across storage conditions.',experiments:2,samples:6,progress:30,nomad:55,updated:'26 Jul 2026',tags:['Solution','Stability']}
    ]},
    mc:{id:'USR-MC',name:'Marcus Chen',initials:'MC',role:'Researcher',email:'marcus.chen@lab.example',workspaceId:'WS-MC-01',workspace:'Marcus research workspace',privateLabel:'Private workspace',preferences:{language:'English',units:'SI',date:'DD MMM YYYY'},metrics:{projects:2,experiments:8,samples:34,files:129,pce:'20.3%'},recent:'EXP-2026-031',projects:[
      {id:'PRJ-MC-CHR',key:'characterisation',name:'Characterisation method comparison',status:'Active',description:'Compare JV, EQE, PL and XRD evidence across shared reference samples.',experiments:5,samples:22,progress:83,nomad:90,updated:'Today · 14:42',tags:['Characterisation','Methods']},
      {id:'PRJ-MC-XRD',key:'xrd',name:'XRD acquisition optimisation',status:'Review',description:'Tune scan windows and acquisition settings for mixed-halide films.',experiments:3,samples:12,progress:88,nomad:96,updated:'28 Jul 2026',tags:['XRD','Quality']}
    ]}
  };
  let currentUserKey='ew';
  try { currentUserKey=localStorage.getItem('labflow-user')||'ew'; } catch(_) {}
  if(!userProfiles[currentUserKey]) currentUserKey='ew';
  const currentUser=()=>userProfiles[currentUserKey];
  try { const extras=JSON.parse(localStorage.getItem(`labflow-custom-projects-${currentUserKey}`)||'[]'); extras.reverse().forEach(project=>{if(!currentUser().projects.some(p=>p.key===project.key))currentUser().projects.unshift(project);}); } catch(_) {}
  const projectStoreKey=()=>`labflow-project-${currentUserKey}`;
  let currentProjectKey='';
  try { currentProjectKey=localStorage.getItem(projectStoreKey())||currentUser().projects[0].key; } catch(_) { currentProjectKey=currentUser().projects[0].key; }
  const currentProject=()=>currentUser().projects.find(project=>project.key===currentProjectKey)||currentUser().projects[0];


  const navigation = [
    { section: true, label: 'WORK' },
    { id: 'dashboard',  href: 'index.html',     icon: 'home',   label: 'Dashboard' },
    { id: 'progetti',   href: 'projects.html',  icon: 'folder', label: 'Progetti' },
    { section: true, label: 'RESOURCES' },
    { id: 'catalogo',   href: 'catalogs.html',  icon: 'grid',   label: 'Catalogo' },
    { section: true, label: 'OUTPUT' },
    { id: 'exports',    href: 'report.html',    icon: 'download', label: 'Report / Export' },
    { section: true, label: 'MORE' },
    { id: 'altro-parent', href: '#', icon: 'plus', label: 'Altro', expandable: true, children: [
      { id: 'editors',  href: 'editors.html',       icon: 'code',   label: 'Editors' },
      { id: 'ai',       href: 'ai-assistant.html',   icon: 'spark', label: 'AI Assistant' },
      { id: 'flow',     href: 'flow.html',           icon: 'flow', label: 'Flow & Data' },
      { id: 'docs',     href: 'documentation.html',  icon: 'info', label: 'Documentation' },
      { id: 'users',    href: 'users.html',           icon: 'user', label: 'Account' },
      { id: 'ui-kit',   href: 'ui-kit.html',          icon: 'grid', label: 'UI Kit' },
    ]},
  ];

  function mountShell() {
    const sidebar = $('#sidebar'); const topbar = $('#topbar'); const user=currentUser(); const project=currentProject();
    if (topbar) topbar.innerHTML = `<div class="topbar-group"><button class="icon-button nav-toggle" type="button" data-action="sidebar" aria-label="Toggle navigation">${icon('menu')}</button><a class="brand" href="index.html"><span class="brand-mark">LF</span><span class="brand-copy"><strong>LabFlow</strong><small>Personal laboratory workspace</small></span></a><button class="project-context-button" type="button" data-action="project-toggle" aria-expanded="false"><span>${icon('folder')}</span><span><small>Active project</small><strong>${escapeHtml(project.name)}</strong></span>${icon('chevron')}</button></div><label class="topbar-search">${icon('model')}<input type="search" placeholder="Search this page" data-page-search></label><div class="topbar-group"><button class="button topbar-ai" type="button" data-action="ai-drawer">${icon('spark')}<span>AI</span></button><button class="button topbar-create" type="button" data-action="quick-create">${icon('plus')}<span>Create</span></button><button class="icon-button" type="button" data-action="theme" aria-label="Toggle theme">${icon('moon')}</button><button class="user-menu" type="button" data-action="user-toggle" aria-expanded="false"><span class="user-avatar">${user.initials}</span><span class="user-copy"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.role)}</small></span>${icon('chevron')}</button></div>`;
    if (sidebar) {
      const navHtml = navigation.map(item => {
        if (item.section) {
          return `<div class="nav-section">${item.label}</div>`;
        }
        if (item.expandable) {
          const childActive = item.children.some(c => c.id === page);
          const isOpen = childActive || item.id === page;
          return `<div class="nav-expandable ${isOpen ? 'open' : ''}">
            <a class="nav-link ${childActive || item.id === page ? 'active' : ''}" href="${item.href}" data-nav-toggle="${item.id}">
              ${icon(item.icon)}<span>${item.label}</span><span class="nav-chevron">${icon('chevron')}</span>
            </a>
            <div class="nav-sub-list" ${!isOpen ? 'style="display:none"' : ''}>
              ${item.children.map(child =>
                `<a class="nav-link nav-sub-link ${child.id === page ? 'active' : ''}" href="${child.href}">${icon(child.icon)}<span>${child.label}</span></a>`
              ).join('')}
            </div>
          </div>`;
        }
        return `<a class="nav-link ${item.id === page ? 'active' : ''}" href="${item.href}">${icon(item.icon)}<span>${item.label}</span></a>`;
      }).join('');
      sidebar.innerHTML = `<nav class="sidebar-nav">${navHtml}</nav><div class="sidebar-foot"><strong>${escapeHtml(user.workspace)}</strong><br><span>${escapeHtml(project.name)}</span><br>${escapeHtml(user.privateLabel)} · ${escapeHtml(user.id)}<br>No CDN · no trackers</div>`;
      sidebar.addEventListener('click', e => {
      const toggle = e.target.closest('[data-nav-toggle]');
      if (toggle) {
        e.preventDefault();
        const expandable = toggle.closest('.nav-expandable');
        if (expandable) {
          expandable.classList.toggle('open');
          const subList = expandable.querySelector('.nav-sub-list');
          if (subList) subList.style.display = subList.style.display === 'none' ? '' : 'none';
        }
      }
    });
    $$('[data-icon]').forEach(node => node.innerHTML = icon(node.dataset.icon));
    mountUserPopover(); mountProjectPopover(); mountScopeBar(); mountCreateWizard(); mountProjectWizard(); applyUserScope();
  }

  function mountUserPopover(){
    let pop=$('#userPopover'); if(pop) pop.remove();
    pop=document.createElement('section'); pop.id='userPopover'; pop.className='user-popover'; pop.hidden=true;
    pop.innerHTML=`<div class="user-popover-head"><strong>Your account</strong><small>Each profile owns separate workspaces and records.</small></div>${Object.entries(userProfiles).map(([key,u])=>`<button type="button" class="user-option ${key===currentUserKey?'active':''}" data-action="user-select" data-user="${key}"><span class="user-avatar">${u.initials}</span><span><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(u.workspace)} · ${u.metrics.experiments} experiments</small></span>${key===currentUserKey?'<span class="badge success">Current</span>':''}</button>`).join('')}<div class="popover-actions user-account-actions"><a class="button small" href="users.html">Profile & preferences</a><a class="button small" href="users.html#sessions">Sessions</a></div><div class="user-popover-note">Static POC: the browser simulates isolation. Flask must enforce ownership and authorization.</div>`;
    document.body.append(pop);
  }

  function mountProjectPopover(){
    let pop=$('#projectPopover'); if(pop) pop.remove();
    pop=document.createElement('section'); pop.id='projectPopover'; pop.className='project-popover'; pop.hidden=true;
    pop.innerHTML=`<div class="user-popover-head"><strong>Your projects</strong><small>Open an existing project or create a guided one.</small></div>${currentUser().projects.map(project=>`<button type="button" class="project-option ${project.key===currentProject().key?'active':''}" data-action="project-select" data-project="${project.key}"><span class="project-option-icon">${icon('folder')}</span><span><strong>${escapeHtml(project.name)}</strong><small>${project.experiments} experiments · ${project.progress}% complete</small></span>${project.key===currentProject().key?'<span class="badge success">Open</span>':''}</button>`).join('')}<div class="popover-actions"><a class="button small" href="projects.html">Manage projects</a><button class="button small primary" type="button" data-action="project-new">New project</button></div>`;
    document.body.append(pop);
  }

  function mountScopeBar(){
    if(page==='kit'||page==='dashboard') return;
    const header=$('.page-header'); if(!header||$('.scope-bar')) return; const u=currentUser(); const project=currentProject();
    const bar=document.createElement('section'); bar.className='scope-bar project-scope';
    bar.innerHTML=`<div class="scope-main">${icon('lock')}<div><span>Private research scope</span><strong>${escapeHtml(u.name)} <b>›</b> ${escapeHtml(u.workspace)} <b>›</b> ${escapeHtml(project.name)}</strong></div></div><div class="scope-meta"><span class="badge success">Owner only</span><span class="mono">${project.id}</span><button class="button small" type="button" data-action="project-toggle">Switch project</button></div>`;
    header.insertAdjacentElement('afterend',bar);
  }

  function applyUserScope(){
    const u=currentUser(); const project=currentProject();
    const bind=(selector,value)=>$$(selector).forEach(node=>{if(node.matches('input,textarea,select'))node.value=value;else node.textContent=value;});
    bind('[data-user-name]',u.name);
    bind('[data-user-email]',u.email);
    bind('[data-user-role]',u.role);
    bind('[data-user-initials]',u.initials);
    bind('[data-user-id]',u.id);
    bind('[data-workspace-name]',u.workspace);
    bind('[data-workspace-id]',u.workspaceId);
    bind('[data-project-name]',project.name);
    bind('[data-project-id]',project.id);
    bind('[data-project-status]',project.status);
    bind('[data-project-description]',project.description);
    bind('[data-project-experiments]',project.experiments);
    bind('[data-project-samples]',project.samples);
    bind('[data-project-progress]',`${project.progress}%`);
    bind('[data-project-nomad]',`${project.nomad}%`);
    $$('[data-project-ring="progress"]').forEach(node=>node.style.setProperty('--value',project.progress));
    $$('[data-project-ring="nomad"]').forEach(node=>node.style.setProperty('--value',project.nomad));
    $$('[data-user-recent]').forEach(n=>n.textContent=u.recent);
    $$('[data-user-option]').forEach(n=>n.textContent=u.name);
    if(typeof reportData!=='undefined'){reportData.general.principal_investigator=u.name;reportData.general.operator=u.name;reportData.general.project_id=project.id;reportData.general.project=project.name;}
    Object.entries(u.metrics).forEach(([key,value])=>$$(`[data-user-metric="${key}"]`).forEach(n=>n.textContent=value));
    const metricEls = document.querySelectorAll('[data-user-metric]');
    if (metricEls.length) {
      const user = currentUser();
      metricEls.forEach(el => {
        const key = el.dataset.userMetric;
        if (key === 'projects' && user) el.textContent = user.projects.length;
        if (key === 'experiments' && user) el.textContent = user.projects.reduce((sum, p) => sum + (p.experiments || 0), 0) || '8';
      });
    }
    renderProjectPage(); renderDashboard(); renderUsersPage();
  }

  const createWizardState={type:null,step:-1,preset:'blank'};
  const createTypes={
    project:{label:'Project',copy:'A research goal containing related experiments',icon:'folder'},
    material:{label:'Material',copy:'Chemical identity and optional physical lot',icon:'catalog'},
    solution:{label:'Solution',copy:'Reusable recipe and prepared batch',icon:'spark'},
    substrate:{label:'Substrate',copy:'Reusable definition and physical piece',icon:'grid'},
    stack:{label:'Material stack',copy:'Ordered layers and source materials',icon:'grid'},
    method:{label:'Method',copy:'Reusable parameter form',icon:'flow'},
    process:{label:'Process template',copy:'Ordered protocol and evidence',icon:'flow'},
    experiment:{label:'Experiment',copy:'Run a process with sample variations',icon:'flask'}
  };
  function mountCreateWizard(){
    if($('#createWizard')) return;
    const wrap=document.createElement('div'); wrap.id='createWizard'; wrap.className='overlay'; wrap.hidden=true;
    wrap.innerHTML=`<section class="modal create-wizard"><div class="panel-header"><div class="panel-title"><strong>Guided creation</strong><small>Reuse first, enter the minimum, and review a visual preview.</small></div><button class="icon-button" type="button" data-action="close">×</button></div><div id="createProgress" class="create-progress"></div><div class="panel-body"><div id="createWizardBody"></div></div><div class="panel-footer" id="createWizardFooter"></div></section>`;
    document.body.append(wrap); renderCreateChooser();
  }
  function renderCreateChooser(){
    createWizardState.type=null;createWizardState.step=-1;const body=$('#createWizardBody'),progress=$('#createProgress'),footer=$('#createWizardFooter');if(!body)return;
    progress.innerHTML='<span class="active">Choose object</span><span>Start</span><span>Details</span><span>Review</span>';
    body.innerHTML=`<div class="choice-grid">${Object.entries(createTypes).map(([id,o])=>`<button class="choice-card" type="button" data-action="create-type" data-create-type="${id}"><span class="choice-icon">${icon(o.icon)}</span><strong>${o.label}</strong><small>${o.copy}</small></button>`).join('')}</div>`;
    footer.innerHTML=`<span class="small subtle">Saved to <strong>${escapeHtml(currentUser().workspace)}</strong> only.</span><button class="button" type="button" data-action="close">Cancel</button>`;
  }
  function createPreview(type){
    if(type==='project')return `<div class="project-preview wizard-preview"><span class="project-preview-root">${icon('folder')}<strong>Research project</strong></span><span class="project-preview-arrow">→</span><span>Experiment 01</span><span>Experiment 02</span><span>Experiment 03</span></div>`;
    if(type==='solution')return `<div class="solution-diagram wizard-preview"><div class="solution-inputs"><span>PbI₂</span><span>FAI</span><span>CsI</span></div><div class="solution-beaker"><i class="fill-70"></i><strong>1.30 M</strong><small>DMF:DMSO 4:1</small></div><div class="solution-output"><strong>Recipe + batch</strong><small>Reusable and traceable</small></div></div>`;
    if(type==='stack')return `<div class="stack-visual-large wizard-preview"><span class="contact">Au <b>80 nm</b></span><span class="transport">HTL <b>180 nm</b></span><span class="absorber">Perovskite <b>400 nm</b></span><span class="transport">ETL <b>30 nm</b></span><span class="substrate">Glass / ITO <b>1.1 mm</b></span></div>`;
    if(type==='process')return `<div class="process-mini wide wizard-preview"><span>Inputs</span><b>→</b><span>Prepare</span><b>→</b><span>Deposit</span><b>→</b><span>Output</span><b>→</b><span>Evidence</span></div>`;
    if(type==='material')return `<div class="material-card-preview wizard-preview"><span class="material-symbol">PbI₂</span><div><strong>Lead iodide</strong><small>CAS · formula · role · physical lot</small></div></div>`;
    if(type==='method')return `<div class="method-flow wizard-preview"><span>Inputs</span><b>→</b><strong>Spin coating</strong><b>→</b><span>Film layer</span></div>`;
    if(type==='substrate')return `<div class="substrate-preview wizard-preview"><span>Glass / ITO</span><b>25 × 25 × 1.1 mm</b><small>Rigid · RMS 1.8 nm</small></div>`;
    return `<div class="experiment-map-mini wizard-preview"><span>Process</span><b>→</b><span>Groups</span><b>→</b><span>Samples</span><b>→</b><span>Results</span><b>→</b><span>NOMAD</span></div>`;
  }
  function createStepFields(type,step){
    const base={project:['New research project','PRJ-NEW','Planning'],material:['Lead iodide','PbI₂','10101-63-0'],solution:['Mixed-cation precursor','1.30','5'],substrate:['Glass / ITO','25 × 25','1.8'],stack:['Baseline n-i-p','n-i-p','STACK-NIP-01'],method:['Spin coating','Deposition','METHOD-SC-01'],process:['PSC baseline','4.2','Device'],experiment:['New optimisation','3','6']}[type];
    if(step===0)return `<div class="starter-choice"><button class="starter-card active" type="button" data-starter="preset"><span class="badge success">Fastest</span><strong>Start from a ready preset</strong><small>Use a reviewed object and customise a copy.</small></button><button class="starter-card" type="button" data-starter="blank"><span class="badge">Blank</span><strong>Start from scratch</strong><small>Use only when no existing object matches.</small></button></div>${createPreview(type)}`;
    if(step===1){
      if(type==='project')return `<div class="form-grid"><div class="field span-2"><label>Project name</label><input class="input" value="${base[0]}"></div><div class="field"><label>Project ID</label><input class="input mono" value="${base[1]}"></div><div class="field"><label>Status</label><select class="input"><option>${base[2]}</option><option>Active</option><option>Review</option></select></div><div class="field span-2"><label>Research objective</label><textarea class="input">Describe the scientific goal in one clear paragraph.</textarea></div></div>`;
      if(type==='material')return `<div class="form-grid"><div class="field span-2"><label>Material name</label><input class="input" value="${base[0]}"></div><div class="field"><label>Formula</label><input class="input" value="${base[1]}"></div><div class="field"><label>CAS number</label><input class="input" value="${base[2]}"></div><div class="field"><label>Role</label><select class="input"><option>Precursor</option><option>Solvent</option><option>Layer material</option></select></div><div class="field"><label>Create physical lot?</label><select class="input"><option>Yes, now</option><option>No, definition only</option></select></div></div>`;
      if(type==='solution')return `<div class="form-grid"><div class="field span-2"><label>Recipe name</label><input class="input" value="${base[0]}"></div><div class="field"><label>Target concentration</label><div class="input-group"><input class="input" value="${base[1]}"><span class="input-suffix">M</span></div></div><div class="field"><label>Total volume</label><div class="input-group"><input class="input" value="${base[2]}"><span class="input-suffix">mL</span></div></div><div class="field"><label>Primary solvent</label><select class="input"><option>DMF</option><option>DMSO</option><option>GBL</option></select></div><div class="field"><label>Secondary solvent</label><select class="input"><option>DMSO</option><option>None</option></select></div></div>`;
      if(type==='stack')return `<div class="form-grid"><div class="field span-2"><label>Stack name</label><input class="input" value="${base[0]}"></div><div class="field"><label>Architecture</label><select class="input"><option>${base[1]}</option><option>p-i-n</option><option>Film only</option></select></div><div class="field"><label>Identifier</label><input class="input mono" value="${base[2]}"></div><div class="field span-2"><label>Expected output</label><select class="input"><option>Photovoltaic device</option><option>Film sample</option></select></div></div>`;
      if(type==='process')return `<div class="form-grid"><div class="field span-2"><label>Process name</label><input class="input" value="${base[0]}"></div><div class="field"><label>New version</label><input class="input" value="${base[1]}"></div><div class="field"><label>Expected output</label><select class="input"><option>${base[2]}</option><option>Film</option><option>Solution</option></select></div><div class="field span-2"><label>Purpose</label><textarea class="input">Reusable baseline for mixed-cation perovskite devices.</textarea></div></div>`;
      if(type==='experiment')return `<div class="form-grid"><div class="field span-2"><label>Experiment name</label><input class="input" value="${base[0]}"></div><div class="field"><label>Sample groups</label><input class="input" type="number" value="${base[1]}"></div><div class="field"><label>Replicates per group</label><input class="input" type="number" value="${base[2]}"></div><div class="field span-2"><label>Process</label><select class="input"><option>PSC baseline v4.1</option><option>Film screening v2.2</option></select></div></div>`;
      return `<div class="form-grid"><div class="field span-2"><label>Name</label><input class="input" value="${base[0]}"></div><div class="field"><label>Category</label><input class="input" value="${base[1]}"></div><div class="field"><label>Identifier</label><input class="input mono" value="${base[2]}"></div><div class="field span-2"><label>Notes</label><textarea class="input">Optional implementation notes.</textarea></div></div>`;
    }
    if(step===2){
      if(type==='project')return `<div class="project-setup-grid"><article class="starter-card active"><span class="badge success">Recommended</span><strong>Use your existing Library</strong><small>Materials, solutions, stacks and processes remain reusable across experiments.</small></article><article class="starter-card"><span class="badge">Optional</span><strong>Copy a starter collection</strong><small>Add reviewed perovskite presets to this personal workspace.</small></article><article class="starter-card"><span class="badge info">Plan</span><strong>Create the first experiment later</strong><small>The project may start empty and guide the researcher when ready.</small></article></div>${createPreview(type)}`;
      if(type==='solution')return `<div class="component-builder"><article><header><strong>Solvents</strong><button class="button small" type="button">Add</button></header><div class="component-row"><input class="input" value="DMF"><input class="input" value="80%"></div><div class="component-row"><input class="input" value="DMSO"><input class="input" value="20%"></div></article><article><header><strong>Solutes and additives</strong><button class="button small" type="button">Add</button></header><div class="component-row"><input class="input" value="PbI₂"><input class="input" value="1.30 M"></div><div class="component-row"><input class="input" value="MACl"><input class="input" value="5 mol%"></div></article></div>${createPreview(type)}`;
      if(type==='stack')return `<div class="layer-wizard"><div class="layer-edit"><span class="layer-grip">1</span><select class="input"><option>Back contact</option></select><input class="input" value="Au"><input class="input" value="80 nm"></div><div class="layer-edit"><span class="layer-grip">2</span><select class="input"><option>HTL</option></select><input class="input" value="Spiro-OMeTAD"><input class="input" value="180 nm"></div><div class="layer-edit"><span class="layer-grip">3</span><select class="input"><option>Absorber</option></select><input class="input" value="Perovskite"><input class="input" value="400 nm"></div><div class="layer-edit"><span class="layer-grip">4</span><select class="input"><option>ETL</option></select><input class="input" value="SnO₂"><input class="input" value="30 nm"></div><div class="layer-edit"><span class="layer-grip">5</span><select class="input"><option>Substrate</option></select><input class="input" value="Glass / ITO"><input class="input" value="1.1 mm"></div><button class="button small" type="button" data-action="create-add-layer">Add layer</button></div>${createPreview(type)}`;
      if(type==='process')return `<div class="process-method-picker"><button class="active" type="button"><span>1</span><strong>Prepare substrate</strong><small>Cleaning method</small></button><button class="active" type="button"><span>2</span><strong>Spin coat</strong><small>Variable rpm</small></button><button class="active" type="button"><span>3</span><strong>Anneal</strong><small>100 °C · 30 min</small></button><button class="active" type="button"><span>4</span><strong>Measure</strong><small>JV · EQE · XRD</small></button></div>${createPreview(type)}`;
      return `${createPreview(type)}<div class="alert info"><span>${icon('info')}</span><div><strong>Advanced details are optional</strong><div class="small subtle">The record can be completed later without blocking the experiment.</div></div></div>`;
    }
    return `<div class="create-review"><div>${createPreview(type)}<span class="eyebrow">Will create</span><h3>${createTypes[type].label} in ${escapeHtml(type==='project'?currentUser().workspace:currentProject().name)}</h3><p>The new record receives an automatic ID, owner scope, status and version metadata.</p></div><div class="wizard-checklist"><div>${icon('check')}<span><strong>Private owner scope</strong><small>${escapeHtml(currentUser().name)}</small></span></div><div>${icon('check')}<span><strong>Reusable reference</strong><small>Experiments link instead of copy</small></span></div><div>${icon('check')}<span><strong>NOMAD mapping prepared</strong><small>Export fields are collected progressively</small></span></div></div></div>`;
  }
  function startCreateWizard(type,preset='preset'){createWizardState.type=type;createWizardState.step=0;createWizardState.preset=preset;openOverlay('createWizard');renderCreateForm();}
  function renderCreateForm(){
    const {type,step}=createWizardState;if(!type){renderCreateChooser();return;}const body=$('#createWizardBody'),progress=$('#createProgress'),footer=$('#createWizardFooter'),info=createTypes[type];
    progress.innerHTML=['Start','Details','Review'].map((x,i)=>`<span class="${i===step?'active':i<step?'complete':''}">${i+1} · ${x}</span>`).join('');
    const content=step===0?createStepFields(type,0):step===1?`${createStepFields(type,1)}<details class="advanced-details wizard-advanced"><summary>Optional structure and advanced details</summary>${createStepFields(type,2)}</details>`:createStepFields(type,3);
    body.innerHTML=`<div class="wizard-intro"><span class="choice-icon">${icon(info.icon)}</span><div><span class="eyebrow">${info.label} wizard</span><h3>${info.copy}</h3><p>Step ${step+1} of 3 · only the essentials are required.</p></div></div>${content}`;
    footer.innerHTML=`<button class="button" type="button" data-action="${step===0?'create-choose':'create-prev'}">${step===0?'Change object':'Previous'}</button><span class="small subtle">${type==='project'?'Personal workspace':`Project · ${escapeHtml(currentProject().name)}`}</span><button class="button primary" type="button" data-action="${step===2?'create-complete':'create-next'}" data-create-type="${type}">${step===2?(type==='project'?'Open project':type==='experiment'?'Open experiment':'Create in Library'):'Continue'}</button>`;
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('labflow-theme', theme); } catch (_) {}
    const button = $('[data-action="theme"]');
    if (button) button.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  }

  function toast(title, tone='info', detail='Demo action completed.') {
    const region = $('#toastRegion'); if (!region) return;
    const item = document.createElement('div'); item.className = 'toast';
    item.style.borderLeftColor = tone === 'success' ? 'var(--teal)' : tone === 'warning' ? 'var(--amber)' : tone === 'danger' ? 'var(--red)' : 'var(--accent)';
    item.innerHTML = `${icon(tone === 'success' ? 'check' : tone === 'warning' || tone === 'danger' ? 'warning' : 'info')}<div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>`;
    region.append(item); setTimeout(() => item.remove(), 4200);
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
  function openOverlay(id) { const el = document.getElementById(id); if (el) el.hidden = false; }
  function closeOverlay(el) { if (el) el.hidden = true; }
  function filterPage(input) { const q = input.value.trim().toLowerCase(); $$('[data-filter-item]').forEach(item => item.hidden = Boolean(q && !item.textContent.toLowerCase().includes(q))); }

  function activateTab(button) {
    const tabs = button.closest('[data-tabs]'); if (!tabs) return;
    const panelRoot = tabs.parentElement; const key = button.dataset.tab;
    $$('.tab-button', tabs).forEach(item => item.classList.toggle('active', item === button));
    $$('[data-tab-panel]', panelRoot).forEach(panel => panel.hidden = panel.dataset.tabPanel !== key);
    history.replaceState(null, '', `#${key}`);
    requestAnimationFrame(renderDemoCharts);
  }

  /* Data model atlas */
  const projectWizardState={step:0,starter:'research',name:'New perovskite research project',id:'PRJ-NEW-04',status:'Planning',objective:'Describe the scientific question and the decisions this project should support.'};
  function mountProjectWizard(){
    if($('#projectWizard')) return;
    const wrap=document.createElement('div');wrap.id='projectWizard';wrap.className='overlay';wrap.hidden=true;
    wrap.innerHTML=`<section class="modal project-wizard-modal"><div class="panel-header"><div class="panel-title"><strong>Create a project</strong><small>Three clear decisions, then start the first experiment.</small></div><button class="icon-button" type="button" data-action="close">×</button></div><div id="projectWizardProgress" class="create-progress"></div><div class="panel-body" id="projectWizardBody"></div><div class="panel-footer" id="projectWizardFooter"></div></section>`;
    document.body.append(wrap);
  }
  function openProjectWizard(){projectWizardState.step=0;renderProjectWizard();openOverlay('projectWizard');}
  function renderProjectWizard(){
    const body=$('#projectWizardBody'),progress=$('#projectWizardProgress'),footer=$('#projectWizardFooter');if(!body)return;
    const labels=['Choose','Purpose','Review'];progress.innerHTML=labels.map((label,index)=>`<span class="${index===projectWizardState.step?'active':index<projectWizardState.step?'complete':''}">${index+1} · ${label}</span>`).join('');
    if(projectWizardState.step===0)body.innerHTML=`<div class="starter-choice project-starters"><button class="starter-card active" type="button" data-project-starter="research"><span class="badge success">Recommended</span><strong>Research project</strong><small>Experiments, results, reports and NOMAD exports.</small></button><button class="starter-card" type="button" data-project-starter="screening"><span class="badge info">Fast</span><strong>Screening campaign</strong><small>Conditions, replicates and comparisons already prepared.</small></button><button class="starter-card" type="button" data-project-starter="blank"><span class="badge">Blank</span><strong>Empty project</strong><small>Start with only a name and objective.</small></button></div><div class="project-preview wizard-preview"><span class="project-preview-root">${icon('folder')}<strong>Project</strong></span><span class="project-preview-arrow">→</span><span>Experiments</span><span>Results</span><span>Report</span><span>NOMAD</span></div>`;
    if(projectWizardState.step===1)body.innerHTML=`<div class="form-grid"><div class="field span-2"><label>Project name</label><input class="input" id="newProjectName" value="${escapeHtml(projectWizardState.name)}"></div><div class="field span-2"><label>Research objective</label><textarea class="input" id="newProjectObjective">${escapeHtml(projectWizardState.objective)}</textarea></div><div class="field"><label>Project ID</label><input class="input mono" id="newProjectId" value="${escapeHtml(projectWizardState.id==='PRJ-NEW-04'?`PRJ-${currentUser().initials}-04`:projectWizardState.id)}"></div><div class="field"><label>Status</label><select class="input" id="newProjectStatus"><option ${projectWizardState.status==='Planning'?'selected':''}>Planning</option><option ${projectWizardState.status==='Active'?'selected':''}>Active</option></select></div><details class="advanced-details span-2"><summary>Optional project preferences</summary><div class="form-grid"><div class="field"><label>Expected duration</label><select class="input"><option>1–3 months</option><option>3–6 months</option><option>More than 6 months</option></select></div><div class="field"><label>NOMAD preparation</label><select class="input"><option>Collect progressively</option><option>Local records only for now</option></select></div></div></details></div>`;
    if(projectWizardState.step===2)body.innerHTML=`<div class="project-review-card"><div class="project-review-visual">${icon('folder')}<strong>${escapeHtml(projectWizardState.name)}</strong><small>${currentUser().name} · ${currentUser().workspace}</small></div><div class="simple-check-list"><div class="done">${icon('check')}<div><strong>Private workspace</strong><small>Owned by ${currentUser().name}</small></div></div><div class="done">${icon('check')}<div><strong>Reusable Library available</strong><small>Nothing needs to be copied</small></div></div><div class="done">${icon('check')}<div><strong>First experiment ready</strong><small>Choose a setup and say what changes</small></div></div></div></div>`;
    footer.innerHTML=`<button class="button" type="button" data-action="${projectWizardState.step===0?'close':'project-prev'}">${projectWizardState.step===0?'Cancel':'Previous'}</button><span class="small subtle">Personal workspace · ${escapeHtml(currentUser().workspace)}</span><button class="button primary" type="button" data-action="${projectWizardState.step===2?'project-complete':'project-next'}">${projectWizardState.step===2?'Create and open project':'Continue'}</button>`;
  }
  function completeProjectWizard(){
    const key=projectWizardState.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32)||`project-${Date.now()}`;
    const project={id:projectWizardState.id||`PRJ-${currentUser().initials}-04`,key,name:projectWizardState.name||'New research project',status:projectWizardState.status||'Planning',description:projectWizardState.objective||'New guided research project.',experiments:0,samples:0,progress:5,nomad:20,updated:'Just now',tags:['New project']};
    currentUser().projects.unshift(project);currentProjectKey=project.key;
    try { const storageKey=`labflow-custom-projects-${currentUserKey}`; const extras=JSON.parse(localStorage.getItem(storageKey)||'[]');extras.push(project);localStorage.setItem(storageKey,JSON.stringify(extras));localStorage.setItem(projectStoreKey(),project.key); } catch(_) {}
    toast('Project created','success','The project workspace is ready for its first guided experiment.');setTimeout(()=>location.href='project.html',300);
  }
  function projectCard(project){return `<article class="project-card ${project.key===currentProject().key?'active':''}" data-project-card><header><span class="project-folder">${icon('folder')}</span><div><span class="eyebrow">${escapeHtml(project.id)}</span><h3>${escapeHtml(project.name)}</h3></div><span class="badge ${project.status==='Active'?'success':project.status==='Review'?'warning':'info'}">${escapeHtml(project.status)}</span></header><p>${escapeHtml(project.description)}</p><div class="project-tags">${project.tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="project-stats"><div><strong>${project.experiments}</strong><small>Experiments</small></div><div><strong>${project.samples}</strong><small>Samples</small></div><div><strong>${project.nomad}%</strong><small>NOMAD ready</small></div></div><div class="project-progress"><span style="width:${project.progress}%"></span></div><footer><small>Updated ${escapeHtml(project.updated)}</small><button class="button small ${project.key===currentProject().key?'':'primary'}" type="button" data-action="project-open" data-project="${project.key}">${project.key===currentProject().key?'Open project':'Open'}</button></footer></article>`;}
  function dashboardProjectCard(project,index){
    const next=index===0?'Continue results review':index===1?'Review the next experiment':'Create the first experiment';
    const action=index===0?'Continue':project.experiments?'Open':'Start';
    return `<article class="home-project-card ${project.key===currentProject().key?'active':''}"><div class="home-project-card-head"><span class="home-project-folder">${icon('folder')}</span><div><span class="eyebrow mono">${escapeHtml(project.id)}</span><h3>${escapeHtml(project.name)}</h3></div><span class="badge ${project.status==='Active'?'success':project.status==='Review'?'warning':'info'}">${escapeHtml(project.status)}</span></div><div class="home-project-summary"><span><strong>${project.experiments}</strong> experiments</span><span><strong>${project.samples}</strong> samples</span><span><strong>${project.progress}%</strong> complete</span></div><div class="home-project-next"><span>Next</span><strong>${escapeHtml(next)}</strong></div><div class="home-project-footer"><small>Updated ${escapeHtml(project.updated)}</small><button class="button small ${project.key===currentProject().key?'primary':''}" type="button" data-action="project-open" data-project="${project.key}">${action}</button></div></article>`;
  }

  function renderDashboard(){
    const projects=$('#homeProjectList');
    if(projects) projects.innerHTML=currentUser().projects.slice(0,3).map(dashboardProjectCard).join('');
    const attention=$('#homeAttentionList');
    if(attention){
      const recent=currentUser().recent;
      const project=currentProject();
      attention.innerHTML=[
        [recent,'One sample is missing J–V data','Complete','experiment.html#results','warning'],
        [`${project.id} export`,'NOMAD package requires a final metadata review','Review','exports.html#nomad','info'],
        ['SOL-B-019','Solution batch expires in 4 days','Open','catalogs.html#solutions','danger']
      ].map(([id,text,label,href,tone])=>`<a class="attention-item" href="${href}"><span class="attention-status ${tone}"></span><span><strong>${escapeHtml(id)}</strong><small>${escapeHtml(text)}</small></span><b>${escapeHtml(label)}</b></a>`).join('');
    }
  }

  const experimentRows=[
    {id:'EXP-2026-052',name:'Mixed-cation deposition window',status:'running',statusLabel:'Running',progress:92,stack:'n-i-p PSC baseline',date:'Today',actionLink:'<a class="button small primary" href="experiment.html#run">Continue</a>'},
    {id:'EXP-2026-048',name:'Antisolvent timing refinement',status:'running',statusLabel:'Running',progress:68,stack:'n-i-p PSC baseline',date:'28 Jul',actionLink:'<a class="button small primary" href="experiment.html#plan">Continue</a>'},
    {id:'EXP-2026-044',name:'Absorber concentration screening',status:'completed',statusLabel:'Completed',progress:100,stack:'n-i-p PSC baseline',date:'24 Jul',actionLink:'<a class="button small" href="workspace.html#comparisons">View results</a>'},
    {id:'EXP-2026-039',name:'Baseline device reproducibility',status:'completed',statusLabel:'Completed',progress:100,stack:'n-i-p PSC baseline',date:'18 Jul',actionLink:'<a class="button small" href="exports.html">Export</a>'}
  ];

  function renderProjectPage(){
    const list=$('#projectList');if(list)list.innerHTML=currentUser().projects.map(projectCard).join('');
    const project=currentProject();
    const experimentCount=$('[data-project-experiment-count]');
    if(experimentCount)experimentCount.textContent=Math.min(project.experiments,4);
    const experiments=$('#projectExperiments');
    if(experiments)experiments.innerHTML=experimentRows.slice(0,Math.max(1,Math.min(project.experiments,4))).map((row,index)=>`<article class="experiment-project-card"><div class="experiment-state ${index===0?'current':''}">${index+1}</div><div><span class="eyebrow mono">${row.id}</span><strong>${row.name}</strong><small><span class="badge ${row.status==='running'?'warning':row.status==='completed'?'success':'info'}">${row.statusLabel}</span> · ${row.date}</small></div><div class="experiment-progress"><span style="width:${row.progress}%"></span><small>${row.progress}%</small></div><span class="experiment-stack"><a href="stack.html">${row.stack}</a></span><div class="experiment-actions">${row.actionLink}</div></article>`).join('');
    const tags=$('#projectTags');if(tags)tags.innerHTML=project.tags.map(tag=>`<span class="badge">${escapeHtml(tag)}</span>`).join('');
  }
  function renderUsersPage(){
    const accounts=$('#demoAccounts');if(accounts)accounts.innerHTML=Object.entries(userProfiles).map(([key,user])=>`<button class="account-row ${key===currentUserKey?'active':''}" type="button" data-action="user-select" data-user="${key}"><span class="user-avatar">${user.initials}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · ${user.metrics.projects} projects</small></span>${key===currentUserKey?'<span class="badge success">Current</span>':'<span class="badge">Switch</span>'}</button>`).join('');
  }

  const entityModel = {
    UserAccount:{group:'Ownership root',purpose:'Authenticated person who owns isolated data and preferences.',fields:[['id','Stable user identifier'],['profile','Name, role and research identity'],['preferences','Locale, units and UI defaults'],['workspaces','Zero or more personal workspaces']],relations:[['owns','Workspace','1..n']]},
    Workspace:{group:'Ownership root',purpose:'Private root container for one user. It owns one reusable Library and multiple research projects.',fields:[['id','Workspace identifier'],['owner_id','Exactly one UserAccount'],['name','Personal workspace name'],['library','Reusable records owned in this workspace'],['projects','Research activities owned in this workspace'],['export_settings','NOMAD mapping preferences']],relations:[['owned by','UserAccount','1'],['contains','Library records','0..n'],['contains','Project','0..n']]},
    Project:{group:'Research organisation',purpose:'A research goal that groups related experiments, decisions, reports and exports without duplicating Library records.',fields:[['id','Project identifier'],['workspace_id','Owning personal workspace'],['title','Research project name'],['objective','Scientific question and expected decision'],['status','Planning, active, review, archived'],['experiments','Related experiment references'],['nomad_readiness','Aggregated export readiness']],relations:[['belongs to','Workspace','1'],['contains','Experiment','0..n'],['references','Library records','0..n'],['generates','Report / ExportPackage','0..n']]},
    IonDefinition:{group:'Reference catalogue',purpose:'Standard identity used in A, B and X composition sites.',fields:[['id','Stable catalogue identifier'],['abbreviation','FA, MA, Cs, Pb, I, Br'],['molecular_formula','Canonical molecular or ionic formula'],['smiles','Canonical SMILES when applicable'],['cas_number','External chemical identity'],['site_compatibility','Allowed A, B or X sites']],relations:[['used by','SiteIon','0..n'],['may map to','MaterialDefinition','0..n']]},
    MaterialDefinition:{group:'Reference catalogue',purpose:'Chemical or functional material identity, independent from a purchased lot.',fields:[['id','Stable material identifier'],['name','Display name'],['formula','Molecular formula'],['cas_number','CAS number'],['role_tags','Solvent, solute, additive, ETL...']],relations:[['instantiated as','MaterialLot','0..n'],['used in','RecipeComponent','0..n'],['used in','LayerDefinition','0..n']]},
    InstrumentDefinition:{group:'Reference catalogue',purpose:'Instrument identity and capabilities used by measurements.',fields:[['id','Instrument identifier'],['manufacturer','Manufacturer'],['model','Model'],['techniques','JV, EQE, XRD, PL...'],['calibration_due','Calibration control']],relations:[['used by','Measurement','0..n']]},
    MeasurementMethod:{group:'Reference catalogue',purpose:'Defines required metadata and derived metrics for one technique.',fields:[['technique','JV, EQE, XRD, PL, AFM...'],['required_metadata','Instrumental conditions'],['accepted_files','CSV, TXT, images...'],['derived_metrics','Voc, PCE, peak, RMS...']],relations:[['instantiated as','Measurement','0..n']]},
    PerovskiteComposition:{group:'Reusable definition',purpose:'Structured ABX₃ composition supporting mixed sites.',fields:[['id','Composition identifier'],['site_a','One or more SiteIon entries'],['site_b','One or more SiteIon entries'],['site_x','One or more SiteIon entries'],['formula_text','Generated readable formula'],['sample_type','Film, crystal, quantum dots'],['dimensionality','3D, 2D, 2D/3D'],['band_gap_ev','Optional material property']],relations:[['contains','SiteIon','3..n'],['used by','Experiment','0..n'],['describes','Sample','0..n']]},
    SolutionRecipe:{group:'Reusable definition',purpose:'Versioned recipe independent from any physical preparation.',fields:[['id','Recipe identifier'],['version','Immutable version'],['target_concentration','Molar or mass concentration'],['total_volume_basis','Reference volume'],['preparation','Procedure text'],['before_use','Filter, temperature, ageing limits']],relations:[['contains','RecipeComponent','1..n'],['instantiated as','SolutionBatch','0..n'],['selected by','ProcessTemplate','0..n']]},
    ProcessTemplate:{group:'Reusable definition',purpose:'Versioned graph of required synthesis steps and evidence.',fields:[['id','Template identifier'],['version','Locked version'],['stages','Definition, chemistry, synthesis, device, result'],['parameter_schema','Dynamic method-specific fields'],['input_roles','Required references'],['output_roles','Produced record types']],relations:[['contains','StepTemplate','1..n'],['executed as','ProcessRun','0..n'],['selected by','Experiment','0..n']]},
    StackDefinition:{group:'Reusable definition',purpose:'Ordered cross-section from substrate to back contact.',fields:[['id','Stack identifier'],['architecture','n-i-p, p-i-n, film-only'],['layers','Ordered LayerDefinition entries'],['default_geometry','Optional device defaults']],relations:[['contains','LayerDefinition','1..n'],['instantiated by','Device','0..n'],['selected by','Experiment','0..n']]},
    ReportTemplate:{group:'Reusable definition',purpose:'Defines report sections, export layout and required fields.',fields:[['id','Template identifier'],['sections','Composition, chemistry, process, device, results'],['tables','Sample and measurement tables'],['charts','Required visual summaries']],relations:[['instantiated as','Report','0..n']]},
    MaterialLot:{group:'Physical instance',purpose:'Purchased or prepared lot with provenance and quality.',fields:[['id','Lot identifier'],['material_id','MaterialDefinition reference'],['supplier','Supplier'],['purity','Declared purity'],['received_at','Receipt date'],['expiry_at','Expiry or review date']],relations:[['instance of','MaterialDefinition','1'],['used by','SolutionBatch','0..n'],['used by','ProcessRun','0..n']]},
    SolutionBatch:{group:'Physical instance',purpose:'Physical solution prepared from one locked recipe version.',fields:[['id','Batch identifier'],['recipe_version','Locked recipe reference'],['prepared_at','Timestamp'],['prepared_by','User reference'],['actual_volume','Physical volume'],['storage','Temperature, light, atmosphere'],['expires_at','Expiry or review date']],relations:[['instance of','SolutionRecipe','1'],['uses','MaterialLot','1..n'],['consumed by','ProcessRun','0..n']]},
    Substrate:{group:'Physical instance',purpose:'Physical substrate with geometry and surface qualification.',fields:[['id','Substrate identifier'],['definition','Substrate type reference'],['rigidity','Rigid or flexible'],['dimensions','Length, width, thickness'],['roughness_rms_nm','Surface RMS'],['cleaning_run','Preparation evidence']],relations:[['used by','ProcessRun','0..1'],['becomes','Sample','0..1']]},
    Sample:{group:'Physical instance',purpose:'Produced film, crystal or other physical sample.',fields:[['id','Sample identifier'],['composition','PerovskiteComposition reference'],['process_run','Producing ProcessRun'],['substrate','Substrate reference'],['status','Planned, produced, validated']],relations:[['produced by','ProcessRun','1'],['has','Measurement','0..n'],['may create','Device','0..n']]},
    Device:{group:'Physical instance',purpose:'Device instance made from a sample/stack and mask geometry.',fields:[['id','Device identifier'],['sample','Sample reference'],['stack','StackDefinition reference'],['mask','Mask identifier'],['active_area_cm2','Active area'],['cell_index','Cell position']],relations:[['built from','Sample','1'],['uses','StackDefinition','1'],['has','Measurement','0..n']]},
    Experiment:{group:'Execution',purpose:'Scientific plan that locks definitions and groups process runs.',fields:[['id','Experiment identifier'],['title','Human-readable title'],['objective','Scientific objective'],['template_version','Locked ProcessTemplate'],['composition','Locked composition'],['recipe_versions','Selected recipes'],['status','Lifecycle state']],relations:[['uses','ProcessTemplate','1'],['uses','PerovskiteComposition','1'],['contains','ProcessRun','1..n'],['produces','Sample','1..n']]},
    ProcessRun:{group:'Execution',purpose:'Actual execution of a template, including deviations and evidence.',fields:[['id','Run identifier'],['experiment','Parent experiment'],['condition','Condition/replicate identity'],['actual_parameters','rpm, time, temperature...'],['inputs','Batch, substrate, material lots'],['outputs','Samples, layers, devices'],['deviations','Observed changes or incidents']],relations:[['instance of','ProcessTemplate','1'],['uses','SolutionBatch','0..n'],['uses','Substrate','1..n'],['produces','Sample','1..n']]},
    Measurement:{group:'Evidence',purpose:'Contextualised acquisition linked to a sample or device.',fields:[['id','Measurement identifier'],['target','Sample or device'],['method','MeasurementMethod reference'],['instrument','InstrumentDefinition reference'],['metadata','Irradiance, mask area, temperature...'],['status','Planned, acquired, validated']],relations:[['targets','Sample / Device','1'],['uses','InstrumentDefinition','1'],['has','DataFile','1..n'],['derives','DerivedResult','0..n']]},
    DataFile:{group:'Evidence',purpose:'Immutable original or processed file with integrity metadata.',fields:[['id','File identifier'],['role','Raw, processed, image, attachment'],['name','Original filename'],['mime_type','File type'],['sha256','Integrity hash'],['parser_version','Parser provenance']],relations:[['belongs to','Measurement','1'],['supports','DerivedResult','0..n']]},
    DerivedResult:{group:'Evidence',purpose:'Metric, peak, curve or plot derived from evidence files.',fields:[['id','Result identifier'],['name','Voc, Jsc, PCE, peak position...'],['value','Numeric or structured value'],['unit','Physical unit'],['method_version','Calculation method'],['quality_flag','Validated, review, failed']],relations:[['derived from','DataFile','1..n'],['belongs to','Measurement','1'],['used by','Report','0..n']]}
  };

  function renderEntity(name) {
    const data = entityModel[name]; const target = $('#entityDetail'); if (!data || !target) return;
    $$('.entity-node').forEach(node => node.classList.toggle('active', node.dataset.entity === name));
    target.innerHTML = `<div class="panel-header"><div class="panel-title"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(data.group)}</small></div><span class="badge info">Selected</span></div><div class="panel-body stack"><p>${escapeHtml(data.purpose)}</p><div><strong>Core fields</strong><dl class="entity-fields">${data.fields.map(([field,desc]) => `<div class="entity-field"><dt class="mono">${escapeHtml(field)}</dt><dd>${escapeHtml(desc)}</dd></div>`).join('')}</dl></div><div><strong>Relations</strong><div class="relation-list relation-list-spaced">${data.relations.map(([relation,targetName,card]) => `<div class="relation-item"><span>${escapeHtml(relation)}</span><strong>${escapeHtml(targetName)}</strong><span class="cardinality">${escapeHtml(card)}</span></div>`).join('')}</div></div></div>`;
  }

  /* Process inspector */
  const processNodes = {
    composition:{title:'Define ABX₃ sample',stage:'Definition',subtitle:'Structured sample definition',fields:[['Composition source','New or catalogue'],['Required output','PerovskiteComposition'],['Validation','A=1, B=1, X=3 target']]},
    stack:{title:'Select stack architecture',stage:'Definition',subtitle:'Locked layer sequence',fields:[['Architecture','n-i-p'],['Stack definition','PSC baseline v2'],['Required output','StackDefinition reference']]},
    recipe:{title:'Select precursor recipe',stage:'Chemistry',subtitle:'Reusable locked chemistry',fields:[['Recipe','Mixed-cation precursor v5'],['Concentration','1.30 M'],['Required evidence','Recipe version']]},
    batch:{title:'Prepare solution batch',stage:'Chemistry',subtitle:'Physical preparation',fields:[['Required inputs','Material lots'],['Actual values','Masses and volume'],['Required output','SolutionBatch']]},
    'before-use':{title:'Condition before use',stage:'Chemistry',subtitle:'Batch readiness',fields:[['Filter','0.22 µm PTFE'],['Temperature','25 °C'],['Age limit','48 h']]},
    substrate:{title:'Prepare substrate',stage:'Synthesis',subtitle:'Qualify the physical substrate',fields:[['Substrate type','Glass / ITO'],['Required metadata','Dimensions, RMS'],['Required output','Substrate instance']]},
    spin:{title:'Spin-coat absorber',stage:'Synthesis',subtitle:'Dynamic spin-coating parameters',fields:[['Speed','1500 rpm'],['Duration','30 s'],['Acceleration','1000 rpm/s'],['Antisolvent','150 µL at 12 s'],['Input roles','SolutionBatch + Substrate'],['Output role','Coated sample']]},
    anneal:{title:'Anneal layer',stage:'Synthesis',subtitle:'Thermal treatment',fields:[['Temperature','100 °C'],['Duration','30 min'],['Atmosphere','N₂ glovebox'],['Output role','Annealed sample']]},
    device:{title:'Create device instances',stage:'Device',subtitle:'Mask and geometry',fields:[['Mask','MASK-6CELL-A'],['Active area','0.10 cm²'],['ID rule','DEV-{experiment}-{cell}']]},
    measurements:{title:'Acquire measurements',stage:'Results',subtitle:'Measurement plan and evidence',fields:[['Required methods','JV, EQE, XRD'],['Optional methods','PL, AFM, SEM'],['Required evidence','Original file + metadata']]}
  };
  function renderProcessInspector(key) {
    const data = processNodes[key] || processNodes.composition;
    $('#processInspectorTitle') && ($('#processInspectorTitle').textContent = data.title);
    $('#processInspectorSubtitle') && ($('#processInspectorSubtitle').textContent = data.subtitle);
    $('#processInspectorStage') && ($('#processInspectorStage').textContent = data.stage);
    const target = $('#processInspector'); if (!target) return;
    target.innerHTML = `<div class="form-grid">${data.fields.map(([label,value],index) => `<div class="field ${index > 3 ? 'span-2' : ''}"><label>${escapeHtml(label)}</label><input class="input" value="${escapeHtml(value)}"></div>`).join('')}<div class="field span-2"><label>Execution note</label><textarea class="input">This field becomes a template instruction. Actual execution evidence is recorded in ProcessRun.</textarea></div></div>`;
  }

  /* Wizard and ABX3 */
  let wizardStep = 0;
  function showWizardStep(index) {
    const panels = $$('[data-wizard-panel]'); if (!panels.length) return;
    wizardStep = Math.max(0, Math.min(index, panels.length - 1));
    panels.forEach((panel,i) => panel.hidden = i !== wizardStep);
    $$('[data-wizard-step]').forEach(button => {const i=Number(button.dataset.wizardStep);button.classList.toggle('active',i===wizardStep);button.classList.toggle('complete',i<wizardStep);button.setAttribute('aria-current',i===wizardStep?'step':'false');});
    const label=panels[wizardStep]?.dataset.wizardLabel||`Step ${wizardStep+1}`;
    $('#wizardStatus') && ($('#wizardStatus').textContent = `Step ${wizardStep + 1} of ${panels.length} · ${label}`);
    const meter=$('#wizardProgressFill'); if(meter)meter.style.width=`${((wizardStep+1)/panels.length)*100}%`;
    const prev=$('[data-action="wizard-prev"]'); if(prev)prev.disabled=wizardStep===0;
    const next = $('[data-action="wizard-next"]');
    if(next){const labels=['Continue to plan','Continue to work','Review and finish','Finished'];next.textContent=labels[wizardStep]||'Continue';next.disabled=wizardStep===panels.length-1;}
    location.hash = ['choose','plan','work','finish'][wizardStep] || '';
    requestAnimationFrame(()=>renderGraphContainers(panels[wizardStep]));
  }

  let setupWizardStep=0;
  function showSetupWizardStep(index){
    const panels=$$('[data-setup-panel]');if(!panels.length)return;
    setupWizardStep=Math.max(0,Math.min(index,panels.length-1));
    panels.forEach((panel,i)=>panel.hidden=i!==setupWizardStep);
    $$('[data-setup-step]').forEach(button=>{const i=Number(button.dataset.setupStep);button.classList.toggle('active',i===setupWizardStep);button.classList.toggle('complete',i<setupWizardStep);});
    const meter=$('#setupProgressFill');if(meter)meter.style.width=`${((setupWizardStep+1)/panels.length)*100}%`;
    const status=$('#setupWizardStatus');if(status)status.textContent=['Step 1 of 3 · Choose a starting point','Step 2 of 3 · Adjust only what differs','Step 3 of 3 · Review and save'][setupWizardStep];
    const prev=$('[data-action="setup-prev"]');if(prev)prev.disabled=setupWizardStep===0;
    const next=$('[data-action="setup-next"]');if(next){next.textContent=['Continue to adjust','Continue to review','Setup ready'][setupWizardStep];next.disabled=setupWizardStep===panels.length-1;}
  }
  function updateAbxFormula() {
    const siteText = site => $$(`[data-ion-list="${site}"] .ion-row`).map(row => {
      const name = $('[data-ion-name]', row)?.value || ''; const coeff = Number($('[data-ion-coeff]', row)?.value || 0);
      return coeff > 0 ? `${name}${coefficientText(coeff)}` : '';
    }).join('');
    const formula = `${siteText('A')}${siteText('B')}${siteText('X')}` || 'ABX₃';
    $('#abxFormula') && ($('#abxFormula').textContent = formula);
    const sums = ['A','B','X'].map(site => $$(`[data-ion-list="${site}"] [data-ion-coeff]`).reduce((sum,input) => sum + Number(input.value || 0), 0));
    const okay = Math.abs(sums[0]-1)<.02 && Math.abs(sums[1]-1)<.02 && Math.abs(sums[2]-3)<.05;
    const status = $('#abxStatus'); if (status) { status.textContent = okay ? 'Balanced' : `Check ${sums.map(v=>v.toFixed(2)).join(' / ')}`; status.className = `badge ${okay ? 'success' : 'warning'}`; }
  }
  function addIon(site) {
    const list = $(`[data-ion-list="${site}"]`); if (!list) return;
    const options = site === 'A' ? ['FA','MA','Cs','Rb','PEA'] : site === 'B' ? ['Pb','Sn','Ge'] : ['I','Br','Cl'];
    const row = document.createElement('div'); row.className='ion-row'; row.innerHTML=`<select class="input" data-ion-name>${options.map(x=>`<option>${x}</option>`).join('')}</select><input class="input" type="number" step="0.01" value="0" data-ion-coeff><button class="icon-button small" type="button" data-action="remove-ion">×</button>`;
    list.append(row); updateAbxFormula();
  }

  /* Simple SVG charts */
  const palette = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)'];
  function chartSvg(type, title, rows, width=720, height=300) {
    const pad={l:56,r:28,t:34,b:44},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
    const base=`<rect width="${width}" height="${height}" fill="var(--chart-bg)"/><text x="${pad.l}" y="20" fill="var(--chart-ink)" font-size="13" font-weight="700">${escapeHtml(title)}</text>`;
    if(type==='donut'){
      const total=rows.reduce((sum,row)=>sum+Number(row[1]||0),0)||1,cx=width/2,cy=height/2+6,r=82,c=2*Math.PI*r;let offset=0;
      const marks=rows.map((row,i)=>{const value=Number(row[1]||0),len=c*value/total;const out=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${palette[i%palette.length]}" stroke-width="38" stroke-dasharray="${len} ${c-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"><title>${escapeHtml(row[0])}: ${value}</title></circle>`;offset+=len;return out;}).join('');
      return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">${base}${marks}<text x="${cx}" y="${cy+5}" text-anchor="middle" fill="var(--chart-ink)" font-size="24" font-weight="700">${total}</text></svg>`;
    }
    if(type==='scatter'){
      const xs=rows.map(r=>Number(r[1])).filter(Number.isFinite),ys=rows.map(r=>Number(r[2])).filter(Number.isFinite),xmin=Math.min(...xs,0),xmax=Math.max(...xs,1),ymin=Math.min(...ys,0),ymax=Math.max(...ys,1),xr=Math.max(xmax-xmin,1),yr=Math.max(ymax-ymin,1);
      const hgrid=Array.from({length:5},(_,i)=>{const y=pad.t+i*h/4,v=ymax-(yr*i/4);return `<line x1="${pad.l}" y1="${y}" x2="${width-pad.r}" y2="${y}" stroke="var(--chart-grid)"/><text x="${pad.l-8}" y="${y+4}" text-anchor="end" fill="var(--chart-muted)" font-size="10">${v.toFixed(Math.abs(v)<10?1:0)}</text>`;}).join('');
      const vgrid=Array.from({length:5},(_,i)=>{const x=pad.l+i*w/4,v=xmin+(xr*i/4);return `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${pad.t+h}" stroke="var(--chart-grid-soft)"/><text x="${x}" y="${height-15}" text-anchor="middle" fill="var(--chart-muted)" font-size="10">${v.toFixed(Math.abs(v)<10?1:0)}</text>`;}).join('');
      const marks=rows.map((r,i)=>{const xv=Number(r[1]),yv=Number(r[2]),x=pad.l+(xv-xmin)/xr*w,y=pad.t+h-(yv-ymin)/yr*h,anchor=x>pad.l+w*.78?'end':'start',tx=x+(anchor==='end'?-8:8),ty=Math.max(pad.t+10,y-7);return `<g class="chart-point"><circle cx="${x}" cy="${y}" r="6" fill="${palette[i%palette.length]}"><title>${escapeHtml(r[0])}: ${xv}, ${yv}</title></circle><text x="${tx}" y="${ty}" text-anchor="${anchor}" fill="var(--chart-muted)" font-size="9">${escapeHtml(r[0])}</text></g>`;}).join('');
      return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">${base}${hgrid}${vgrid}${marks}</svg>`;
    }
    const values=rows.flatMap(row=>row.slice(1).map(Number)).filter(Number.isFinite),max=Math.max(...values,1),min=Math.min(0,...values),range=Math.max(max-min,1);
    const grid=Array.from({length:5},(_,i)=>{const y=pad.t+i*h/4,v=max-range*i/4;return `<line x1="${pad.l}" y1="${y}" x2="${width-pad.r}" y2="${y}" stroke="var(--chart-grid)"/><text x="${pad.l-8}" y="${y+4}" text-anchor="end" fill="var(--chart-muted)" font-size="10">${v.toFixed(Math.abs(v)<10?1:0)}</text>`;}).join('');
    let marks='';
    if(type==='bar'){
      const bw=w/Math.max(rows.length,1)*.58;
      marks=rows.map((r,i)=>{const value=Number(r[1]||0),x=pad.l+(i+.21)*w/Math.max(rows.length,1),y=pad.t+h-((value-min)/range)*h;return `<g class="chart-point"><rect x="${x}" y="${y}" width="${bw}" height="${pad.t+h-y}" fill="${palette[i%palette.length]}"><title>${escapeHtml(r[0])}: ${value}</title></rect><text x="${x+bw/2}" y="${height-14}" text-anchor="middle" fill="var(--chart-muted)" font-size="10">${escapeHtml(r[0])}</text></g>`;}).join('');
    }else{
      const seriesCount=Math.max(1,...rows.map(r=>r.length-1));
      for(let series=0;series<seriesCount;series++){
        const points=rows.map((r,i)=>`${pad.l+(rows.length===1?.5:i/(rows.length-1))*w},${pad.t+h-((Number(r[series+1]||0)-min)/range)*h}`).join(' ');
        marks+=`<polyline points="${points}" fill="none" stroke="${palette[series%palette.length]}" stroke-width="3"/>`;
        rows.forEach((r,i)=>{const value=Number(r[series+1]||0),x=pad.l+(rows.length===1?.5:i/(rows.length-1))*w,y=pad.t+h-((value-min)/range)*h;marks+=`<g class="chart-point"><circle cx="${x}" cy="${y}" r="4" fill="${palette[series%palette.length]}"><title>${escapeHtml(r[0])}: ${value}</title></circle>${series===0?`<text x="${x}" y="${height-14}" text-anchor="middle" fill="var(--chart-muted)" font-size="10">${escapeHtml(r[0])}</text>`:''}</g>`;});
      }
    }
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">${base}${grid}${marks}</svg>`;
  }
  function renderDemoCharts() {
    $$('[data-demo-chart]').forEach(node => {
      const kind=node.dataset.demoChart;
      const configs={
        jv:['line','JV curve',[['0.0',23.2],['0.2',23.0],['0.4',22.6],['0.6',21.8],['0.8',19.5],['1.0',12.0],['1.14',0]]],
        eqe:['line','EQE spectrum',[['350',55],['450',84],['550',91],['650',88],['750',72],['800',12]]],
        xrd:['line','XRD pattern',[['10',8],['12',15],['14.1',95],['18',12],['28.4',68],['32',9],['40',5]]],
        compare:['bar','PCE by condition',[['1000 rpm',18.7],['1500 rpm',21.4],['2000 rpm',19.4]]],
        scatter:['scatter','Thickness versus PCE',[['A01',482,18.7],['A02',468,19.2],['B03',397,20.9],['B04',392,21.4],['C05',331,19.8],['C06',325,19.4]]]
      };
      const cfg=configs[kind]; if(cfg) node.innerHTML=chartSvg(...cfg);
    });
  }


  /* Rendered graphs */
  const graphPresets={
    experiment:`direction LR\nUser[User account] --> Workspace[Personal workspace] : owns\nWorkspace --> Library[Reusable library] : contains\nLibrary --> Process[Process template] : provides\nProcess --> Experiment[Experiment] : instantiated as\nExperiment --> Sample[Samples & devices] : produces\nSample --> Result[Measurements & results] : characterised by\nResult --> NOMAD[NOMAD package] : exported as`,
    library:`direction TB\nWorkspace[Personal workspace] --> Library[Reusable library] : contains\nLibrary --> Materials[Materials & lots]\nLibrary --> Solutions[Recipes & batches]\nLibrary --> Stacks[Stack definitions]\nLibrary --> Methods[Methods]\nLibrary --> Processes[Process templates]`,
    nomad:`direction LR\nExperiment[Experiment graph] --> Validate[Readiness validation] : checked by\nValidate --> Archive[Archive YAML] : creates\nValidate --> Raw[Raw file references] : includes\nArchive --> Package[NOMAD package ZIP] : bundled in\nRaw --> Package\nPackage --> Upload[Explicit NOMAD upload] : submitted as`
  };
  function parseGraphDsl(source){
    const nodes=new Map(),edges=[];let direction='LR';
    const ensure=(id,label=id)=>{id=String(id||'').trim();if(!id)return null;if(!nodes.has(id))nodes.set(id,{id,label:String(label||id).trim()});else if(label&&label!==id)nodes.get(id).label=String(label).trim();return nodes.get(id);};
    String(source||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')).forEach(line=>{
      const dir=line.match(/^direction\s+(LR|TB)$/i);if(dir){direction=dir[1].toUpperCase();return;}
      const edge=line.match(/^([A-Za-z0-9_-]+)(?:\[([^\]]+)\])?\s*--?>\s*([A-Za-z0-9_-]+)(?:\[([^\]]+)\])?(?:\s*:\s*(.+))?$/);
      if(edge){ensure(edge[1],edge[2]||edge[1]);ensure(edge[3],edge[4]||edge[3]);edges.push({from:edge[1],to:edge[3],label:(edge[5]||'').trim()});return;}
      const node=line.match(/^([A-Za-z0-9_-]+)(?:\[([^\]]+)\])$/);if(node)ensure(node[1],node[2]||node[1]);
    });
    return {direction,nodes:[...nodes.values()],edges};
  }
  function graphLayout(model){
    const ids=model.nodes.map(n=>n.id),incoming=new Map(ids.map(id=>[id,0])),outgoing=new Map(ids.map(id=>[id,[]]));
    model.edges.forEach(e=>{incoming.set(e.to,(incoming.get(e.to)||0)+1);outgoing.get(e.from)?.push(e.to);});
    const depth=new Map(ids.map(id=>[id,0])),queue=ids.filter(id=>(incoming.get(id)||0)===0),seen=new Set();
    while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);for(const to of outgoing.get(id)||[]){depth.set(to,Math.max(depth.get(to)||0,(depth.get(id)||0)+1));incoming.set(to,(incoming.get(to)||1)-1);if(incoming.get(to)===0)queue.push(to);}}
    ids.filter(id=>!seen.has(id)).forEach((id,i)=>depth.set(id,i%Math.max(1,Math.ceil(Math.sqrt(ids.length)))));
    const levels=new Map();model.nodes.forEach(n=>{const d=depth.get(n.id)||0;if(!levels.has(d))levels.set(d,[]);levels.get(d).push(n);});
    return {depth,levels:[...levels.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1])};
  }
  function wrapGraphLabel(label,max=18){const words=String(label).split(/\s+/);const lines=[''];for(const word of words){const i=lines.length-1;if((lines[i]+' '+word).trim().length>max&&lines[i])lines.push(word);else lines[i]=(lines[i]+' '+word).trim();}return lines.slice(0,2);}
  function graphSvg(source,{compact=false}={}){
    const model=parseGraphDsl(source),layout=graphLayout(model),lr=model.direction==='LR';
    const nodeW=compact?130:154,nodeH=compact?50:58,levelGap=compact?70:92,rowGap=compact?22:34,pad=compact?28:42;
    const counts=layout.levels.map(l=>l.length),maxCount=Math.max(1,...counts),levelCount=Math.max(1,layout.levels.length);
    const width=lr?pad*2+levelCount*nodeW+(levelCount-1)*levelGap:pad*2+maxCount*nodeW+(maxCount-1)*rowGap;
    const height=lr?pad*2+maxCount*nodeH+(maxCount-1)*rowGap:pad*2+levelCount*nodeH+(levelCount-1)*levelGap;
    const positions=new Map();
    layout.levels.forEach((level,li)=>{level.forEach((node,ni)=>{const span=lr?height-pad*2:width-pad*2;const used=level.length*(lr?nodeH:nodeW)+(level.length-1)*rowGap;const offset=pad+Math.max(0,(span-used)/2);const x=lr?pad+li*(nodeW+levelGap):offset+ni*(nodeW+rowGap);const y=lr?offset+ni*(nodeH+rowGap):pad+li*(nodeH+levelGap);positions.set(node.id,{x,y});});});
    const edgeSvg=model.edges.map((e,i)=>{const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return'';const x1=lr?a.x+nodeW:a.x+nodeW/2,y1=lr?a.y+nodeH/2:a.y+nodeH,x2=lr?b.x:b.x+nodeW/2,y2=lr?b.y+nodeH/2:b.y;const c1x=lr?x1+Math.max(28,(x2-x1)/2):x1,c1y=lr?y1:y1+Math.max(24,(y2-y1)/2),c2x=lr?x2-Math.max(28,(x2-x1)/2):x2,c2y=lr?y2:y2-Math.max(24,(y2-y1)/2);const lx=(x1+x2)/2,ly=(y1+y2)/2-5;return `<g class="graph-edge" data-graph-edge="${escapeHtml(e.from)}|${escapeHtml(e.to)}"><path d="M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}" marker-end="url(#graph-arrow)"/>${e.label?`<text x="${lx}" y="${ly}" text-anchor="middle">${escapeHtml(e.label)}</text>`:''}</g>`;}).join('');
    const nodeSvg=model.nodes.map((n,i)=>{const p=positions.get(n.id),lines=wrapGraphLabel(n.label);return `<g class="graph-node graph-tone-${i%5}" data-graph-node-id="${escapeHtml(n.id)}" role="button" tabindex="0"><rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="5"/><text x="${p.x+nodeW/2}" y="${p.y+nodeH/2-(lines.length-1)*8}" text-anchor="middle">${lines.map((line,j)=>`<tspan x="${p.x+nodeW/2}" dy="${j?16:0}">${escapeHtml(line)}</tspan>`).join('')}</text><title>${escapeHtml(n.label)}</title></g>`;}).join('');
    return `<svg class="graph-svg" viewBox="0 0 ${Math.max(width,260)} ${Math.max(height,150)}" role="img" aria-label="Rendered graph with ${model.nodes.length} nodes and ${model.edges.length} relationships"><defs><marker id="graph-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z"/></marker></defs>${edgeSvg}${nodeSvg}</svg>`;
  }
  function graphSourceFor(node){const ref=node.dataset.graphRef;if(ref)return document.getElementById(ref)?.textContent.trim()||'';return node.dataset.graphSource||'';}
  function renderGraphContainers(root=document){$$('[data-graph-ref],[data-graph-source]',root).forEach(node=>{const source=graphSourceFor(node);if(source)node.innerHTML=graphSvg(source,{compact:node.classList.contains('graph-compact')});});}
  const graphEditorState={source:graphPresets.experiment,selected:null};
  function graphNodesFromEditor(){return parseGraphDsl($('#graphSource')?.value||graphEditorState.source).nodes;}
  function renderGraphEditor(){const source=$('#graphSource'),preview=$('#graphPreview');if(!source||!preview)return;graphEditorState.source=source.value;preview.innerHTML=graphSvg(source.value);const model=parseGraphDsl(source.value);const options=model.nodes.map(n=>`<option value="${escapeHtml(n.id)}">${escapeHtml(n.label)}</option>`).join('');['#graphEdgeFrom','#graphEdgeTo'].forEach(sel=>{const node=$(sel);if(node){const keep=node.value;node.innerHTML=options;if(model.nodes.some(n=>n.id===keep))node.value=keep;}});const inspector=$('#graphInspector');if(inspector&&graphEditorState.selected){const selected=model.nodes.find(n=>n.id===graphEditorState.selected);if(selected){const incoming=model.edges.filter(e=>e.to===selected.id),outgoing=model.edges.filter(e=>e.from===selected.id);inspector.innerHTML=`<span class="badge info">${escapeHtml(selected.id)}</span><strong>${escapeHtml(selected.label)}</strong><small>${incoming.length} incoming · ${outgoing.length} outgoing</small><div class="graph-relation-list">${[...incoming.map(e=>`${e.from} → ${selected.id}${e.label?` · ${e.label}`:''}`),...outgoing.map(e=>`${selected.id} → ${e.to}${e.label?` · ${e.label}`:''}`)].map(x=>`<span>${escapeHtml(x)}</span>`).join('')||'<span>No relationships yet.</span>'}</div>`;}}
  }
  function graphSafeId(label){let id=String(label||'Node').normalize('NFKD').replace(/[^A-Za-z0-9]+/g,' ').trim().split(/\s+/).map((x,i)=>i?x[0]?.toUpperCase()+x.slice(1):x).join('')||'Node';const taken=new Set(graphNodesFromEditor().map(n=>n.id));let candidate=id,n=2;while(taken.has(candidate))candidate=id+n++;return candidate;}
  function exportSvgAsPng(svg,filename){if(!svg)return;const blob=new Blob([svg.outerHTML],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const box=svg.viewBox.baseVal,c=document.createElement('canvas'),scale=2;c.width=Math.max(800,box.width*scale);c.height=Math.max(420,box.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);c.toBlob(b=>X.download(b,'image/png',filename));URL.revokeObjectURL(url);};img.src=url;}

  /* Dynamic scientific charts */
  const dynamicSamples=[
    {id:'S-052-A01',condition:'A',status:'review',spin:1000,thickness:482,roughness:21.4,pce:18.7,voc:1.08,ff:75.1},
    {id:'S-052-A02',condition:'A',status:'validated',spin:1000,thickness:468,roughness:19.8,pce:19.2,voc:1.09,ff:76.8},
    {id:'S-052-B03',condition:'B',status:'validated',spin:1500,thickness:397,roughness:14.1,pce:20.9,voc:1.13,ff:80.0},
    {id:'S-052-B04',condition:'B',status:'validated',spin:1500,thickness:392,roughness:13.7,pce:21.4,voc:1.14,ff:81.0},
    {id:'S-052-C05',condition:'C',status:'validated',spin:2000,thickness:331,roughness:16.3,pce:19.8,voc:1.10,ff:77.2},
    {id:'S-052-C06',condition:'C',status:'review',spin:2000,thickness:325,roughness:17.0,pce:19.4,voc:1.09,ff:76.1}
  ];
  const metricLabels={pce:'PCE (%)',voc:'Voc (V)',ff:'Fill factor (%)',thickness:'Thickness (nm)',roughness:'RMS roughness (nm)',spin:'Spin speed (rpm)'};
  function mean(rows,key){return rows.reduce((s,r)=>s+Number(r[key]||0),0)/Math.max(rows.length,1);}
  function renderDynamicChart(root){const kind=root.dataset.dynamicChart,preview=$('[data-dynamic-preview]',root),summary=$('[data-dynamic-summary]',root);if(!preview)return;
    if(kind==='performance'){const metric=$('[data-chart-control="metric"]',root)?.value||'pce',type=$('[data-chart-control="type"]',root)?.value||'bar',conditions=$$('[data-chart-condition]:checked',root).map(x=>x.value);const rows=conditions.map(c=>{const samples=dynamicSamples.filter(s=>s.condition===c&&s.status==='validated');return [`Condition ${c}`,Number(mean(samples,metric).toFixed(metric==='voc'?3:1))];});preview.innerHTML=chartSvg(type,metricLabels[metric]||metric,rows);const best=rows.slice().sort((a,b)=>b[1]-a[1])[0];summary.innerHTML=rows.length?`<strong>${escapeHtml(best[0])}</strong><span>Highest visible mean: ${best[1]} · ${rows.length} conditions selected</span>`:'<span>Select at least one condition.</span>';
    }else{const x=$('[data-chart-control="x"]',root)?.value||'thickness',y=$('[data-chart-control="y"]',root)?.value||'pce',scope=$('[data-chart-control="scope"]',root)?.value||'all';let samples=dynamicSamples.filter(s=>scope==='review'||s.status==='validated');if(scope==='recommended')samples=samples.filter(s=>s.condition==='B');const rows=samples.map(s=>[s.id,s[x],s[y]]);preview.innerHTML=chartSvg('scatter',`${metricLabels[y]} versus ${metricLabels[x]}`,rows);const n=samples.length,avg=n?mean(samples,y):0;summary.innerHTML=`<strong>${n} samples</strong><span>Mean ${metricLabels[y]}: ${avg.toFixed(y==='voc'?3:1)}</span>`;}
  }
  function renderDynamicCharts(){$$('[data-dynamic-chart]').forEach(renderDynamicChart);}

  /* Local tools */
  const codeSamples={yaml:'experiment:\n  id: EXP-2026-052\n  composition: Cs0.05FA0.78MA0.17PbI2.5Br0.5\n  process_template: psc_baseline@4.1\n  status: draft',json:'{\n  "experiment": "EXP-2026-052",\n  "samples": 18,\n  "validated": true\n}',python:'def validate_experiment(record: dict) -> bool:\n    required = {"id", "composition", "process_template"}\n    return required.issubset(record)',csv:'sample_id,condition,thickness_nm,pce\nS-052-A02,1000 rpm,468,19.2\nS-052-B04,1500 rpm,392,21.4',text:'LabFlow experiment note\n\nAll original files remain local and immutable.'};
  function updateCodeEditor(){const input=$('#codeInput'),lines=$('#codeLines');if(!input||!lines)return;lines.textContent=Array.from({length:input.value.split('\n').length},(_,i)=>i+1).join('\n');}
  function validateCode(){const mode=$('#codeMode')?.value,input=$('#codeInput'),status=$('#codeStatus');if(!input||!status)return;let ok=true,msg='Text is readable.';try{if(mode==='json')JSON.parse(input.value);if(mode==='csv'){const n=input.value.trim().split(/\r?\n/).map(r=>r.split(',').length);ok=n.every(x=>x===n[0]);if(!ok)throw new Error('Rows have different column counts.');}if(mode==='yaml'&&input.value.includes('\t'))throw new Error('Tabs are not allowed in YAML indentation.');msg=mode==='json'?'Valid JSON.':mode==='csv'?'CSV column counts match.':mode==='yaml'?'Basic YAML checks passed.':'Text is readable.';}catch(error){ok=false;msg=error.message;}status.textContent=msg;toast(ok?'Validation passed':'Validation failed',ok?'success':'danger',msg);}
  function inlineMarkdown(text){return escapeHtml(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');}
  function renderMarkdown(text){
    const lines=String(text).split(/\r?\n/);let html='',table=[],list=null,inCode=false,code=[],codeLang='';
    const closeList=()=>{if(list){html+=`</${list}>`;list=null;}};
    const flushTable=()=>{if(!table.length)return;html+=`<div class="table-wrap"><table class="data-table"><tbody>${table.map((r,i)=>`<tr>${r.map(c=>i===0?`<th>${inlineMarkdown(c)}</th>`:`<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;table=[];};
    const flushCode=()=>{if(codeLang==='graph')html+=`<div class="markdown-graph graph-stage">${graphSvg(code.join('\n'),{compact:true})}</div>`;else html+=`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;code=[];codeLang='';};
    for(const line of lines){
      if(/^```/.test(line)){flushTable();closeList();if(inCode){flushCode();inCode=false;}else{inCode=true;codeLang=line.slice(3).trim().toLowerCase();}continue;}
      if(inCode){code.push(line);continue;}
      if(/^\|.*\|$/.test(line)&&!/^[|\s:-]+$/.test(line)){closeList();table.push(line.slice(1,-1).split('|').map(x=>x.trim()));continue;}
      if(/^[|\s:-]+$/.test(line)&&table.length)continue;
      flushTable();
      if(/^### /.test(line)){closeList();html+=`<h3>${inlineMarkdown(line.slice(4))}</h3>`;}
      else if(/^## /.test(line)){closeList();html+=`<h2>${inlineMarkdown(line.slice(3))}</h2>`;}
      else if(/^# /.test(line)){closeList();html+=`<h1>${inlineMarkdown(line.slice(2))}</h1>`;}
      else if(/^> /.test(line)){closeList();html+=`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`;}
      else if(/^- /.test(line)){if(list!=='ul'){closeList();html+='<ul>';list='ul';}html+=`<li>${inlineMarkdown(line.slice(2))}</li>`;}
      else if(/^\d+\. /.test(line)){if(list!=='ol'){closeList();html+='<ol>';list='ol';}html+=`<li>${inlineMarkdown(line.replace(/^\d+\. /,''))}</li>`;}
      else if(!line.trim()){closeList();}
      else{closeList();html+=`<p>${inlineMarkdown(line)}</p>`;}
    }
    flushTable();closeList();if(inCode)flushCode();return html;
  }
  function syncMarkdown(){const input=$('#markdownInput'),preview=$('#markdownPreview');if(input&&preview)preview.innerHTML=renderMarkdown(input.value);}
  function readTextFile(file,target){if(!file||!target)return;const reader=new FileReader();reader.onload=()=>{target.value=String(reader.result||'');target.dispatchEvent(new Event('input',{bubbles:true}));};reader.readAsText(file);}

  const workbook={active:0,selected:{row:0,col:0},sheets:[{name:'Samples',rows:[['Sample ID','Condition','Thickness nm','PCE %'],['S-052-A02','1000 rpm',468,19.2],['S-052-B04','1500 rpm',392,21.4]]},{name:'Measurements',rows:[['Measurement','Target','Status'],['JV','DEV-052-B04-03','Validated'],['EQE','DEV-052-B04-03','Validated']]},{name:'Materials',rows:[['Material','Lot','Purity'],['PbI2','PBI2-2606','99.999%'],['FAI','FAI-2026-07','99.99%']]}]};
  function normaliseSheet(s){const width=Math.max(1,...s.rows.map(r=>r.length));s.rows=s.rows.map(r=>[...r,...Array(width-r.length).fill('')]);return width;}
  function renderWorkbook(){const table=$('#workbookTable'),tabs=$('#sheetTabs');if(!table||!tabs)return;const sheet=workbook.sheets[workbook.active],width=normaliseSheet(sheet);tabs.innerHTML=workbook.sheets.map((s,i)=>`<button class="sheet-tab ${i===workbook.active?'active':''}" type="button" data-action="sheet-select" data-index="${i}">${escapeHtml(s.name)}</button>`).join('');table.tHead.innerHTML=`<tr><th></th>${Array.from({length:width},(_,i)=>`<th>${X.columnName(i)}</th>`).join('')}</tr>`;table.tBodies[0].innerHTML=sheet.rows.map((r,ri)=>`<tr><th>${ri+1}</th>${r.map((v,ci)=>`<td contenteditable="true" data-sheet-cell data-row="${ri}" data-col="${ci}">${escapeHtml(v)}</td>`).join('')}</tr>`).join('');selectCell(0,0);}
  function selectCell(row,col){const sheet=workbook.sheets[workbook.active];row=Math.min(row,sheet.rows.length-1);col=Math.min(col,normaliseSheet(sheet)-1);workbook.selected={row,col};$$('[data-sheet-cell]').forEach(c=>c.classList.toggle('selected',+c.dataset.row===row&&+c.dataset.col===col));$('#cellName')&&($('#cellName').textContent=`${X.columnName(col)}${row+1}`);$('#formulaInput')&&($('#formulaInput').value=sheet.rows[row][col]??'');}
  function workbookSheets(){return workbook.sheets.map(s=>({name:s.name,rows:s.rows}));}

  const imageState={items:[],selected:null,rotation:0,flip:1,brightness:100,gray:false};
  function initDemoImage(){const canvas=document.createElement('canvas');canvas.width=900;canvas.height=560;const c=canvas.getContext('2d');const g=c.createLinearGradient(0,0,900,560);g.addColorStop(0,'#263d58');g.addColorStop(1,'#b17b45');c.fillStyle=g;c.fillRect(0,0,900,560);for(let i=0;i<90;i++){c.fillStyle=`rgba(255,255,255,${.08+Math.random()*.18})`;c.beginPath();c.arc(Math.random()*900,Math.random()*560,3+Math.random()*18,0,Math.PI*2);c.fill();}c.fillStyle='#fff';c.font='bold 36px Arial';c.fillText('AFM surface preview',42,70);imageState.items=[{id:'demo',name:'AFM-S-052-B04.png',url:canvas.toDataURL()}];imageState.selected='demo';renderImages();}
  function renderImages(){const list=$('#imageList');if(list)list.innerHTML=imageState.items.map(item=>`<button class="image-thumb ${item.id===imageState.selected?'active':''}" data-action="image-select" data-id="${item.id}" type="button"><span data-icon="image"></span><span class="cell-main"><strong>${escapeHtml(item.name)}</strong><small>Local image</small></span></button>`).join('');$$('[data-icon]',list||document).forEach(n=>n.innerHTML=icon(n.dataset.icon));drawImage();}
  function drawImage(){const item=imageState.items.find(x=>x.id===imageState.selected),canvas=$('#imageCanvas');if(!item||!canvas)return;const img=new Image();img.onload=()=>{const ctx=canvas.getContext('2d');canvas.width=900;canvas.height=560;ctx.clearRect(0,0,900,560);ctx.save();ctx.translate(450,280);ctx.rotate(imageState.rotation*Math.PI/180);ctx.scale(imageState.flip,1);ctx.filter=`brightness(${imageState.brightness}%) grayscale(${imageState.gray?1:0})`;const scale=Math.min(900/img.width,560/img.height);ctx.drawImage(img,-img.width*scale/2,-img.height*scale/2,img.width*scale,img.height*scale);ctx.restore();};img.src=item.url;}
  function addImages(files){[...files].filter(f=>f.type.startsWith('image/')).forEach(file=>{const r=new FileReader();r.onload=()=>{const id=crypto.randomUUID();imageState.items.push({id,name:file.name,url:r.result});imageState.selected=id;renderImages();};r.readAsDataURL(file);});}

  const chartState={rows:[['1000 rpm',18.7,482],['1500 rpm',21.4,392],['2000 rpm',19.4,325]]};
  function renderChartBuilder(){const rows=$('#chartRows'),preview=$('#chartPreview');if(rows)rows.innerHTML=chartState.rows.map((r,i)=>`<div class="row"><input class="input" data-chart-cell data-row="${i}" data-col="0" value="${escapeHtml(r[0])}"><input class="input" type="number" step="0.1" data-chart-cell data-row="${i}" data-col="1" value="${r[1]}"><input class="input" type="number" step="0.1" data-chart-cell data-row="${i}" data-col="2" value="${r[2]}"><button class="icon-button small" data-action="chart-remove" data-index="${i}" type="button">×</button></div>`).join('');if(preview)preview.innerHTML=chartSvg($('#chartType')?.value||'line',$('#chartTitle')?.value||'Chart',chartState.rows);}

  /* Unified demo data and export */
  const demoGraph={
    ownership:{owner:currentUser().id,workspace_id:currentUser().workspaceId,workspace_name:currentUser().workspace,project_id:currentProject().id,project_name:currentProject().name,visibility:'private'},
    catalogues:{ions:[{id:'ION-FA',abbreviation:'FA',formula:'CH5N2+',site:'A'},{id:'ION-MA',abbreviation:'MA',formula:'CH6N+',site:'A'},{id:'ION-CS',abbreviation:'Cs',formula:'Cs+',site:'A'},{id:'ION-PB',abbreviation:'Pb',formula:'Pb+2',site:'B'},{id:'ION-I',abbreviation:'I',formula:'I-',site:'X'},{id:'ION-BR',abbreviation:'Br',formula:'Br-',site:'X'}],materials:[{id:'MAT-PBI2',name:'PbI2',cas:'10101-63-0'},{id:'MAT-FAI',name:'FAI',cas:'879643-71-7'}],instruments:[{id:'JV-01',method:'JV'},{id:'EQE-02',method:'EQE'},{id:'XRD-03',method:'XRD'}]},
    definitions:{composition:{id:'COMP-052',formula:'Cs0.05FA0.78MA0.17PbI2.5Br0.5',sample_type:'Polycrystalline film',dimensionality:'3D',band_gap_ev:1.58},solution_recipe:{id:'REC-MIX-05',version:5,solvents:[['DMF',0.8],['DMSO',0.2]],solutes:['PbI2','FAI','MABr','CsI'],additives:[['MACl','5 mol%']]},process_template:{id:'PROC-PSC',version:'4.1',steps:['define composition','prepare batch','prepare substrate','spin coat','anneal','create devices','measure']},stack:{id:'STACK-NIP-02',layers:['Glass/ITO','SnO2','Perovskite','Spiro-OMeTAD','Au']}},
    instances:{material_lots:[{id:'PBI2-2606',material:'PbI2',purity:'99.999%'},{id:'FAI-2026-07',material:'FAI',purity:'99.99%'}],solution_batch:{id:'SOL-0719-B',recipe:'REC-MIX-05@5',volume_ml:5,prepared_at:'2026-07-19'},substrates:[{id:'SUB-B04',type:'Glass/ITO',dimensions_mm:[25,25,1.1],roughness_rms_nm:1.8}],samples:[{id:'S-052-B04',composition:'COMP-052',thickness_nm:392,roughness_nm:13.7}],devices:[{id:'DEV-052-B04-03',sample:'S-052-B04',stack:'STACK-NIP-02',active_area_cm2:.1}]},
    execution:{experiment:{id:'EXP-2026-052',title:'Mixed-cation absorber optimisation',template:'PROC-PSC@4.1'},process_runs:[{id:'RUN-052-B',condition:'1500 rpm',solution_batch:'SOL-0719-B',substrate:'SUB-B04',annealing:'100 C / 30 min / N2'}]},
    measurements:{records:[{id:'MEAS-JV-052-03',target:'DEV-052-B04-03',method:'JV',instrument:'JV-01',metrics:{Voc_V:1.14,Jsc_mA_cm2:23.2,FF_percent:81,PCE_percent:21.4}},{id:'MEAS-EQE-052-03',target:'DEV-052-B04-03',method:'EQE',instrument:'EQE-02',metrics:{integrated_Jsc_mA_cm2:22.8}},{id:'MEAS-XRD-052-B04',target:'S-052-B04',method:'XRD',instrument:'XRD-03',metrics:{main_peak_2theta:14.12}}],files:[{name:'DEV-052-B04-03-jv.csv',role:'raw'},{name:'DEV-052-B04-03-eqe.csv',role:'raw'},{name:'S-052-B04.xye',role:'raw'}]},
    reports:{id:'LF-RPT-2026-052',status:'Draft',quality_score:.96}
  };
  const demoStack = {
    id: 'STK-001',
    name: 'FA0.85Cs0.15PbI3',
    layers: [
      { type: 'substrate', label: 'FTO/Glass', thickness: '2.2 mm' },
      { type: 'transport', label: 'TiO2 Compact', thickness: '30 nm' },
      { type: 'transport', label: 'TiO2 Mesoporous', thickness: '150 nm' },
      { type: 'absorber', label: 'FA0.85Cs0.15PbI3', thickness: '500 nm' },
      { type: 'transport', label: 'Spiro-OMeTAD', thickness: '200 nm' },
      { type: 'contact', label: 'Au', thickness: '80 nm' },
    ],
    solutions: ['SOL-001', 'SOL-002'],
    conditions: { spinSpeed: '2000 rpm', annealTemp: '150°C', atmosphere: 'N2' }
  };
  function selectedExport(){const out={ownership:demoGraph.ownership};$$('[data-export-part]').forEach(box=>{if(box.checked)out[box.dataset.exportPart]=demoGraph[box.dataset.exportPart];});return out;}
  function yamlScalar(v){if(v===null)return'null';if(typeof v==='number'||typeof v==='boolean')return String(v);return `'${String(v).replaceAll("'","''")}'`;}
  function toYaml(v,indent=0){const pad=' '.repeat(indent);if(Array.isArray(v))return v.map(x=>x&&typeof x==='object'?`${pad}-\n${toYaml(x,indent+2)}`:`${pad}- ${yamlScalar(x)}`).join('\n');if(v&&typeof v==='object')return Object.entries(v).map(([k,x])=>x&&typeof x==='object'?`${pad}${k}:\n${toYaml(x,indent+2)}`:`${pad}${k}: ${yamlScalar(x)}`).join('\n');return `${pad}${yamlScalar(v)}`;}
  function exportSheets(){return Object.entries(selectedExport()).map(([name,value])=>({name:name.slice(0,31),rows:[['Path','JSON'],...[...flattenObject(value)].map(([p,v])=>[p,typeof v==='object'?JSON.stringify(v):v])]}));}
  function* flattenObject(value,path=''){if(Array.isArray(value)){for(let i=0;i<value.length;i++)yield* flattenObject(value[i],`${path}[${i}]`);}else if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value))yield* flattenObject(v,path?`${path}.${k}`:k);}else yield [path,value];}
  function exportCsv(){return X.rowsToCsv([['section','path','value'],...Object.entries(selectedExport()).flatMap(([section,value])=>[...flattenObject(value)].map(([path,v])=>[section,path,v]))]);}
  function nomadSchema(){return `definitions:\n  name: LabFlowPerovskiteSchema\n  sections:\n    PerovskiteExperiment:\n      quantities:\n        experiment_id: {type: str}\n        title: {type: str}\n      sub_sections:\n        composition: {section: PerovskiteComposition}\n        solution_batch: {section: SolutionBatch}\n        process_runs: {section: ProcessRun, repeats: true}\n        devices: {section: Device, repeats: true}\n        measurements: {section: Measurement, repeats: true}\n`;}
  function nomadArchive(){return `data:\n  m_def: ../upload/raw/labflow.schema.archive.yaml#PerovskiteExperiment\n${toYaml({experiment_id:'EXP-2026-052',title:'Mixed-cation absorber optimisation',...demoGraph.definitions,...demoGraph.instances,...demoGraph.execution,...demoGraph.measurements},2)}\n`;}
  function buildNomadZip(){const manifest={created_at:new Date().toISOString(),source:'LabFlow static POC',project_id:currentProject().id,project_name:currentProject().name,experiment:'EXP-2026-052',owner_id:currentUser().id,workspace_id:currentUser().workspaceId,files:['labflow.schema.archive.yaml','experiment.archive.yaml','raw/README.md']};return X.zipStore([{name:'README.md',data:'# LabFlow NOMAD package\nGenerated locally from the static POC.\n'},{name:'labflow.schema.archive.yaml',data:nomadSchema()},{name:'experiment.archive.yaml',data:nomadArchive()},{name:'manifest.json',data:JSON.stringify(manifest,null,2)},{name:'raw/README.md',data:'Place original measurement files here. The POC only stores references.'}]);}

  const processStepState={step:0,method:'Spin coating'};
  function mountProcessStepWizard(){if($('#processStepWizard'))return;const wrap=document.createElement('div');wrap.id='processStepWizard';wrap.className='overlay';wrap.hidden=true;wrap.innerHTML='<section class="modal step-wizard"><div class="panel-header"><div class="panel-title"><strong>Add a work step</strong><small>Choose the action, then enter only the values the researcher needs.</small></div><button class="icon-button" type="button" data-action="close">×</button></div><div class="create-progress" id="stepProgress"></div><div class="panel-body" id="stepWizardBody"></div><div class="panel-footer" id="stepWizardFooter"></div></section>';document.body.append(wrap);}
  function openProcessStepWizard(){processStepState.step=0;openOverlay('processStepWizard');renderProcessStepWizard();}
  function renderProcessStepWizard(){const body=$('#stepWizardBody'),progress=$('#stepProgress'),footer=$('#stepWizardFooter');if(!body)return;progress.innerHTML=['Choose action','Essential details'].map((x,i)=>`<span class="${i===processStepState.step?'active':i<processStepState.step?'complete':''}">${i+1} · ${x}</span>`).join('');if(processStepState.step===0)body.innerHTML=`<div class="method-selector simple-method-selector">${[['Prepare','PR','Cleaning, mixing or handling'],['Deposit','DE','Spin coating, evaporation or sputtering'],['Heat','HE','Annealing or thermal treatment'],['Measure','ME','Instrument and required file'],['Custom','CU','A short named laboratory action']].map((m,i)=>`<button class="${i===0?'active':''}" type="button" data-step-method="${m[0]}"><span>${m[1]}</span><div><strong>${m[0]}</strong><small>${m[2]}</small></div></button>`).join('')}</div>`;else body.innerHTML=`<div class="form-grid"><div class="field span-2"><label>Step name</label><input class="input" value="Spin-coat absorber"></div><div class="field"><label>Main value</label><div class="input-group"><input class="input" value="1500"><span class="input-suffix">rpm</span></div></div><div class="field"><label>Duration</label><div class="input-group"><input class="input" value="30"><span class="input-suffix">s</span></div></div><div class="field"><label>Can experiments change it?</label><select class="input"><option>Yes · spin speed</option><option>No · keep fixed</option></select></div><div class="field"><label>What confirms completion?</label><select class="input"><option>Actual values and timestamp</option><option>File attached</option><option>Manual confirmation</option></select></div><details class="advanced-details span-2"><summary>Optional input and output references</summary><div class="form-grid"><div class="field"><label>Required input</label><select class="input"><option>Solution batch</option><option>Material lot</option><option>None</option></select></div><div class="field"><label>Output</label><select class="input"><option>Deposited layer</option><option>Prepared sample</option><option>Data file</option></select></div></div></details></div><div class="simple-flow-line wizard-preview"><span>Input</span><i></i><strong>Spin coat</strong><i></i><span>Layer</span></div>`;footer.innerHTML=`<button class="button" type="button" data-action="${processStepState.step===0?'close':'step-prev'}">${processStepState.step===0?'Cancel':'Previous'}</button><span class="small subtle">Two-step editor</span><button class="button primary" type="button" data-action="${processStepState.step===1?'step-complete':'step-next'}">${processStepState.step===1?'Add step':'Continue'}</button>`;}
  function completeProcessStep(){toast('Work step added','success','The setup now includes one clear action with its essential values.');closeOverlay($('#processStepWizard'));}
  function renderDocumentation(key='overview'){const root=$('#documentationPreview');if(!root)return;$$('[data-doc]').forEach(b=>b.classList.toggle('active',b.dataset.doc===key));const source=$(`#doc-${key}`);if(source)root.innerHTML=renderMarkdown(source.textContent.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));}

  /* Optional AI simulation layer */
  const aiModes={
    plan:{title:'Plan an experiment',subtitle:'Use the active setup and prior experiments as context.',badge:'Experiment copilot',prompts:['Suggest three simple conditions','Reduce the number of samples','Explain why this plan is useful'],context:['Standard n-i-p PSC setup','Previous experiment EXP-2026-048','Allowed variable: spin speed','Target measurements: J–V, EQE, XRD'],response:{summary:'Use one variable with three clearly separated conditions and three replicates.',details:['1000 rpm — baseline','1500 rpm — focus condition','2000 rpm — upper bound','3 replicates per condition · 9 samples total'],confidence:88,evidence:['EXP-2026-048','PSC baseline v4.1'],warning:'Confirm the spin coater limit and randomise the run order.'}},
    files:{title:'Understand a file',subtitle:'Extract a proposed mapping without changing the original file.',badge:'File interpreter',prompts:['Parse this J–V CSV','Identify the target sample','Show uncertain columns'],context:['File: DEV-052-B04-03-jv.csv','Selected sample: DEV-052-B04-03','Planned technique: J–V','Instrument: JV-01'],response:{summary:'The file is consistent with a J–V sweep and can be linked to DEV-052-B04-03.',details:['Voltage column → voltage_V','Current density column → current_density_mA_cm2','Derived Voc 1.14 V, Jsc 23.2 mA/cm², FF 81.0%, PCE 21.4%','Forward scan detected'],confidence:96,evidence:['CSV header','Selected sample ID','JV-01 method definition'],warning:'Confirm the illuminated area before validating PCE.'}},
    quality:{title:'Check data quality',subtitle:'Find gaps and inconsistencies while keeping deterministic checks visible.',badge:'Quality reviewer',prompts:['Check all selected samples','Find outliers','List blocking missing data'],context:['18 samples','17 J–V datasets','9 EQE datasets','18 XRD datasets','Current comparison filters'],response:{summary:'Most data are consistent; one missing dataset and one probable morphology outlier need review.',details:['Missing J–V measurement for sample C03','S-052-C06 roughness 17.0 nm is above its group distribution','EQE-derived Jsc differs from J–V Jsc by 1.8% — within the configured tolerance','Humidity metadata missing for two measurements'],confidence:91,evidence:['Measurement completeness rules','Condition distributions','J–V/EQE consistency check'],warning:'Outliers are flags, not errors. Review the raw data before excluding a sample.'}},
    nomad:{title:'Prepare NOMAD metadata',subtitle:'Suggest mappings for fields that are missing or ambiguous.',badge:'Metadata mapper',prompts:['Map missing fields','Explain blocking warnings','Draft archive values'],context:['Experiment EXP-2026-052','Process run PR-052-B','Solution batch SOL-0719-B','Selected measurements and files'],response:{summary:'Twelve of fourteen required mappings are ready. Two fields need researcher confirmation.',details:['annealing_atmosphere → proposed “N₂ glovebox” (82%)','measurement_illumination → proposed “AM1.5G, 100 mW/cm²” (94%)','sample_owner and project references mapped directly','Raw-file roles mapped from technique and filename'],confidence:89,evidence:['Process step note','JV-01 method definition','Experiment ownership scope'],warning:'Do not accept annealing atmosphere unless it matches the actual run note.'}},
    report:{title:'Draft report text',subtitle:'Create editable prose from selected measurements and deterministic charts.',badge:'Scientific writer',prompts:['Draft the main finding','Summarise limitations','Write next actions'],context:['Condition comparison chart','Validated J–V, EQE and XRD results','Selected AFM and SEM images','Experiment objective'],response:{summary:'Condition B produced the strongest validated device performance while maintaining the lowest roughness among the tested conditions.',details:['PCE improved to 21.4% at 1500 rpm','Film thickness decreased from 468 nm to 392 nm relative to baseline','No secondary XRD phase was detected','The conclusion should remain limited to this spin-speed window and batch'],confidence:87,evidence:['DEV-052-B04-03 J–V','S-052-B04 AFM','S-052-B04 XRD','Condition comparison'],warning:'Generated prose must be reviewed for scientific interpretation and causal claims.'}}
  };
  const aiState={mode:'plan',lastInput:null,lastOutput:null};
  function aiInput(mode,prompt){return {task:`${mode}_assistant`,scope:{owner_id:currentUser().id,workspace_id:currentUser().workspaceId,project_id:currentProject().id,experiment_id:'EXP-2026-052'},prompt:prompt||'',context_refs:aiModes[mode].context,policy:{mode:'read_and_suggest',requires_approval:true,network_request:false}};}
  function aiOutput(mode){const r=aiModes[mode].response;return {suggestion:{summary:r.summary,items:r.details},confidence:r.confidence/100,evidence_refs:r.evidence,warnings:[r.warning],status:'proposed',requires_approval:true};}
  function aiMessage(role,content,extra=''){return `<article class="ai-message ${role}"><div class="ai-message-avatar">${role==='assistant'?icon('spark'):currentUser().initials}</div><div><span>${role==='assistant'?'LabFlow AI':'Researcher'}</span><div class="ai-message-bubble">${content}</div>${extra}</div></article>`;}
  function renderAIPage(){const chat=$('#aiChat');if(!chat)return;const mode=aiModes[aiState.mode];$('#aiModeTitle').textContent=mode.title;$('#aiModeSubtitle').textContent=mode.subtitle;$('#aiModeBadge').textContent=mode.badge;$$('[data-ai-mode]').forEach(b=>b.classList.toggle('active',b.dataset.aiMode===aiState.mode));const quick=$('#aiQuickPrompts');if(quick)quick.innerHTML=mode.prompts.map(p=>`<button type="button" data-ai-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('');const context=$('#aiContextList');if(context)context.innerHTML=mode.context.map((item,i)=>`<div class="ai-context-item"><span>${i+1}</span><div><strong>${escapeHtml(item)}</strong><small>Included by explicit page context</small></div></div>`).join('');if(!aiState.lastInput||aiState.lastInput.task!==`${aiState.mode}_assistant`){aiState.lastInput=aiInput(aiState.mode,$('#aiPrompt')?.value||mode.prompts[0]);aiState.lastOutput=null;}if(chat&&!aiState.lastOutput)chat.innerHTML=aiMessage('assistant',`<p><strong>${escapeHtml(mode.title)}</strong></p><p>${escapeHtml(mode.subtitle)}</p><p>Select a quick prompt or write a focused instruction. I will return a suggestion, evidence and uncertainty.</p>`);const inp=$('#aiInputPreview');if(inp)inp.textContent=JSON.stringify(aiState.lastInput,null,2);const out=$('#aiOutputPreview');if(out)out.textContent=aiState.lastOutput?JSON.stringify(aiState.lastOutput,null,2):'{\n  "status": "waiting_for_request"\n}';}
  function runAI(mode=aiState.mode,prompt=$('#aiPrompt')?.value||''){aiState.mode=mode;const m=aiModes[mode];aiState.lastInput=aiInput(mode,prompt);const chat=$('#aiChat');if(chat)chat.innerHTML=aiMessage('user',`<p>${escapeHtml(prompt||m.prompts[0])}</p>`)+aiMessage('assistant','<div class="ai-thinking"><i></i><i></i><i></i><span>Reviewing selected LabFlow context…</span></div>');const inp=$('#aiInputPreview');if(inp)inp.textContent=JSON.stringify(aiState.lastInput,null,2);setTimeout(()=>{aiState.lastOutput=aiOutput(mode);const r=m.response;const result=`<div class="ai-result-head"><span class="badge success">Confidence ${r.confidence}%</span><strong>${escapeHtml(r.summary)}</strong></div><ul>${r.details.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul><div class="ai-evidence-box"><strong>Evidence</strong>${r.evidence.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div><div class="ai-warning-box">${icon('warning')}<span>${escapeHtml(r.warning)}</span></div>`;const actions=`<div class="ai-response-actions"><button class="button small" type="button" data-action="ai-reject">Reject</button><button class="button small" type="button" data-action="ai-edit">Edit before applying</button><button class="button small primary" type="button" data-action="ai-accept">Accept suggestion</button></div>`;if(chat)chat.innerHTML=aiMessage('user',`<p>${escapeHtml(prompt||m.prompts[0])}</p>`)+aiMessage('assistant',result,actions);const out=$('#aiOutputPreview');if(out)out.textContent=JSON.stringify(aiState.lastOutput,null,2);},650);}
  function contextualAIResponse(){const map={dashboard:['Next useful action','Continue EXP-2026-052 and complete the missing C03 J–V measurement.'],projects:['Project overview','The active project is ready for one more experiment before comparative reporting.'],project:['Project guidance','Continue the current experiment; the remaining blocker is one measurement and final metadata review.'],experiment:['Experiment guidance','Keep one variable, use the prepared setup and record actual deviations only.'],pipeline:['Setup guidance','This setup is reusable. Change only the stack, solution or planned measurements that differ.'],catalogs:['Library guidance','Reuse the reviewed mixed-cation recipe and prepare a new physical batch for today.'],workspace:['Results guidance','Condition B is currently strongest; review C06 morphology and complete C03 J–V.'],report:['Report guidance','Draft the finding from validated charts, then edit causal wording before export.'],exports:['NOMAD guidance','Two metadata suggestions need confirmation before package generation.'],docs:['Documentation guidance','The core flow is Workspace → Project → Experiment → Work → Results → Output.'],flow:['Data model guidance','Experiment Setup hides repeated Library references while preserving traceability.'],editors:['Tool guidance','Use deterministic tools for files and charts; use AI only for interpretation and drafting.'],kit:['UI guidance','AI patterns use optional cards, visible evidence and explicit apply actions.'],users:['Privacy guidance','AI context inherits the current user and private workspace scope.'],ai:['AI assistant','Choose one focused task and review the evidence before applying any suggestion.']};return map[page]||['LabFlow assistant','I can explain this page, identify the next action or check completeness.'];}
  function mountAIDrawer(){if($('#aiDrawer'))return;const [title,answer]=contextualAIResponse();const drawer=document.createElement('aside');drawer.id='aiDrawer';drawer.className='drawer ai-drawer';drawer.hidden=true;drawer.innerHTML=`<div class="panel-header"><div class="panel-title"><strong>${icon('spark')} LabFlow AI</strong><small>Optional, simulated and reviewable</small></div><button class="icon-button" type="button" data-action="close">×</button></div><div class="ai-drawer-context"><span class="badge violet">${escapeHtml(currentProject().id)}</span><span>${escapeHtml(page)}</span><span>Read + suggest</span></div><div class="ai-drawer-body"><div class="ai-drawer-answer"><span class="eyebrow">${escapeHtml(title)}</span><p>${escapeHtml(answer)}</p></div><div class="ai-drawer-prompts"><button type="button" data-action="ai-drawer-prompt" data-prompt="Explain this page">Explain this page</button><button type="button" data-action="ai-drawer-prompt" data-prompt="What should I do next?">What should I do next?</button><button type="button" data-action="ai-drawer-prompt" data-prompt="Check completeness">Check completeness</button></div><div class="ai-drawer-compose"><textarea class="input" id="aiDrawerPrompt" rows="3" placeholder="Ask about the current page…"></textarea><button class="button primary" type="button" data-action="ai-drawer-run">Ask</button></div><a class="button w-100" href="ai-assistant.html">Open full AI assistant</a></div>`;document.body.append(drawer);}
  function renderNomadAISuggestions(){const root=$('#aiNomadBody');if(!root)return;root.innerHTML=`<div class="ai-suggestion-list"><article><div><span class="badge warning">Needs confirmation</span><strong>Annealing atmosphere</strong><small>Suggested from process note: “N₂ glovebox”</small></div><div><b>82%</b><button class="button small" type="button" data-action="ai-accept-field">Accept</button></div></article><article><div><span class="badge info">High confidence</span><strong>Measurement illumination</strong><small>Suggested from method JV-01: “AM1.5G · 100 mW/cm²”</small></div><div><b>94%</b><button class="button small" type="button" data-action="ai-accept-field">Accept</button></div></article></div><div class="ai-nomad-note">${icon('warning')}<span>The assistant proposes metadata only. The researcher remains responsible for confirming the actual experimental conditions.</span></div>`;}

  /* Rich editable report */
  const reportData={
    general:{report_id:'LF-RPT-2026-052',project_id:'PRJ-MCP-01',project:'Mixed-cation perovskite optimisation',experiment_id:'EXP-2026-052',status:'Validated',title:'Mixed-cation absorber optimisation',subtitle:'Complete materials, process, device and characterisation dossier',principal_investigator:'Dr. Eleanor Wright',operator:'Amelia Grant',laboratory:'Perovskite Lab',period:'19–29 July 2026',template:'PSC baseline v4.1',generated:'29 July 2026 · 12:45'},
    objective:'Identify a robust spin-coating window for a mixed-cation, mixed-halide absorber while preserving morphology, spectral response and device efficiency.',
    composition:{formula:'Cs0.05FA0.78MA0.17PbI2.5Br0.5',sample_type:'Polycrystalline film',dimensionality:'3D',band_gap_ev:1.58,a_site:'Cs 0.05 · FA 0.78 · MA 0.17',b_site:'Pb 1.00',x_site:'I 2.50 · Br 0.50'},
    chemistry:{recipe:'Mixed-cation precursor v5',batch:'SOL-0719-B',concentration:'1.30 M',solvent_ratio:'DMF:DMSO = 4:1',solutes:'PbI2 · FAI · MABr · CsI',additives:'MACl · 5 mol%',impurities:'None declared',volume:'5 mL',prepared_at:'19 July 2026',filter:'0.22 µm PTFE',storage:'Dark · N2 · 5 °C'},
    process:{substrate:'Glass / ITO',substrate_size:'25 × 25 × 1.1 mm',surface_rms:'1.8 nm',cleaning:'Detergent → DI water → IPA → UV/O3',spin_speed:'1500 rpm',spin_time:'30 s',acceleration:'1000 rpm/s',antisolvent:'Chlorobenzene · 150 µL at 12 s',annealing:'100 °C · 30 min',atmosphere:'N2 glovebox'},
    device:{architecture:'n-i-p',stack:'Glass/ITO | SnO2 | Perovskite | Spiro-OMeTAD | Au',mask:'MASK-6CELL-A',active_area:'0.10 cm²',devices_per_substrate:6,encapsulation:'None',best_device:'DEV-052-B04-03'},
    summary:{samples:18,devices:108,valid_datasets:52,planned_datasets:54,best_pce:21.4,mean_pce:20.7,uniformity_gain:18,recommended_condition:'1500 rpm · 30 s · 150 µL antisolvent at 12 s'},
    results:{Voc:'1.14 V',Jsc:'23.2 mA/cm²',FF:'81.0%',PCE:'21.4%',EQE_Jsc:'22.8 mA/cm²',XRD_peak:'14.12° 2θ',PL_peak:'782 nm',thickness:'392 ± 11 nm',roughness:'13.7 nm'},
    conditions:[['A','1000 rpm','482 ± 24 nm','18.7%','Valid'],['B','1500 rpm','392 ± 11 nm','21.4%','Recommended'],['C','2000 rpm','328 ± 17 nm','19.4%','Valid']],
    measurements:[['JV','DEV-052-B04-03','JV-01','100 mW/cm²','Validated'],['EQE','DEV-052-B04-03','EQE-02','300–850 nm','Validated'],['XRD','S-052-B04','XRD-03','5–50° 2θ','Validated'],['AFM','S-052-B04','AFM-01','5 × 5 µm','Validated'],['PL','S-052-B04','PL-02','532 nm excitation','Review']],
    files:[['DEV-052-B04-03-jv.csv','JV raw','SHA256 verified'],['DEV-052-B04-03-eqe.csv','EQE spectrum','SHA256 verified'],['S-052-B04.xye','XRD raw','SHA256 verified'],['AFM-S-052-B04.png','AFM image','SHA256 verified']],
    images:[{title:'AFM topography',caption:'5 × 5 µm tapping-mode image of sample S-052-B04.',kind:'afm',filename:'AFM-S-052-B04.png'},{title:'SEM morphology',caption:'Top-view morphology showing compact grains and limited pinholes.',kind:'sem',filename:'SEM-S-052-B04.png'}],
    narrative:{primary_finding:'Condition B delivered the best balance of compact morphology, low thickness spread, spectral current and device efficiency.',interpretation:'The 1500 rpm condition reduces film thickness variance without sacrificing absorption or fill factor. Higher spin speed decreases thickness but also reduces device performance.',quality_note:'Two planned measurements remain incomplete. The available validated evidence is sufficient for the present recommendation.',conclusion:'Repeat condition B with a second precursor batch, then publish process template v4.1 as the laboratory baseline.',actions:['Repeat condition B using an independent material lot.','Complete the remaining PL acquisition and review its metadata.','Lock the process template after cross-batch confirmation.']},
    provenance:[['Composition','COMP-052'],['Solution recipe','REC-MIX-05@5'],['Solution batch','SOL-0719-B'],['Process template','PROC-PSC@4.1'],['Process run','RUN-052-B'],['Sample','S-052-B04'],['Device','DEV-052-B04-03'],['Raw archive','SHA256 verified · 1.82 GB']]
  };
  const reportDefaults=JSON.parse(JSON.stringify(reportData));
  const reportImageCache=new Map();
  function generatedMicrograph(kind,w=760,h=390){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(kind==='afm'){const image=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const v=(Math.sin(x/24)+Math.cos(y/31)+Math.sin((x+y)/44)+3)/6;image.data[i]=Math.round(25+35*v);image.data[i+1]=Math.round(75+120*v);image.data[i+2]=Math.round(120+125*v);image.data[i+3]=255;}ctx.putImageData(image,0,0);for(let i=0;i<90;i++){ctx.fillStyle=`rgba(255,230,120,${.04+Math.random()*.09})`;ctx.beginPath();ctx.arc(Math.random()*w,Math.random()*h,10+Math.random()*34,0,Math.PI*2);ctx.fill();}}else{ctx.fillStyle='#20262d';ctx.fillRect(0,0,w,h);for(let i=0;i<130;i++){const x=Math.random()*w,y=Math.random()*h,r=10+Math.random()*35;ctx.fillStyle=`rgb(${95+Math.random()*90},${98+Math.random()*85},${100+Math.random()*80})`;ctx.beginPath();for(let k=0;k<8;k++){const a=k/8*Math.PI*2,rr=r*(.7+Math.random()*.45);const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(15,18,22,.65)';ctx.stroke();}ctx.fillStyle='#fff';ctx.fillRect(w-160,h-36,110,5);ctx.font='16px sans-serif';ctx.fillText('1 µm',w-155,h-44);}return c;}
  function initReportImages(){reportData.images.forEach((img,i)=>{if(!reportImageCache.has(i))reportImageCache.set(i,generatedMicrograph(img.kind));});}
  function reportImageSrc(i){const source=reportImageCache.get(i);return source?.toDataURL?source.toDataURL('image/jpeg',.9):source?.src||'';}
  function dataGet(path){return path.split('.').reduce((v,k)=>v?.[k],reportData);}
  function dataSet(path,value){const keys=path.split('.');let target=reportData;keys.slice(0,-1).forEach(k=>target=target[k]);target[keys.at(-1)]=value;}
  const fieldGroups={
    'General & objective':['general.report_id','general.project_id','general.project','general.experiment_id','general.status','general.title','general.subtitle','general.principal_investigator','general.operator','general.laboratory','general.period','general.template','general.generated','objective'],
    'Composition':['composition.formula','composition.sample_type','composition.dimensionality','composition.band_gap_ev','composition.a_site','composition.b_site','composition.x_site'],
    'Chemistry':['chemistry.recipe','chemistry.batch','chemistry.concentration','chemistry.solvent_ratio','chemistry.solutes','chemistry.additives','chemistry.impurities','chemistry.volume','chemistry.prepared_at','chemistry.filter','chemistry.storage'],
    'Process':['process.substrate','process.substrate_size','process.surface_rms','process.cleaning','process.spin_speed','process.spin_time','process.acceleration','process.antisolvent','process.annealing','process.atmosphere'],
    'Device':['device.architecture','device.stack','device.mask','device.active_area','device.devices_per_substrate','device.encapsulation','device.best_device'],
    'Summary & metrics':['summary.samples','summary.devices','summary.valid_datasets','summary.planned_datasets','summary.best_pce','summary.mean_pce','summary.uniformity_gain','summary.recommended_condition','results.Voc','results.Jsc','results.FF','results.PCE','results.EQE_Jsc','results.XRD_peak','results.PL_peak','results.thickness','results.roughness'],
    'Narrative':['narrative.primary_finding','narrative.interpretation','narrative.quality_note','narrative.conclusion']
  };
  const labelFor=path=>path.split('.').at(-1).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  function renderReportEditor(){const root=$('#reportEditor');if(!root)return;root.innerHTML=Object.entries(fieldGroups).map(([group,paths],gi)=>`<section class="report-editor-section"><button type="button" data-action="report-section"><span>${escapeHtml(group)}</span><span>${gi===0?'−':'+'}</span></button><div class="section-fields" ${gi===0?'':'hidden'}>${paths.map(path=>{const value=dataGet(path);const textarea=String(value).length>70||path==='objective'||path.startsWith('narrative.');return `<div class="field"><label>${labelFor(path)}</label>${textarea?`<textarea class="input" data-report-field="${path}">${escapeHtml(value)}</textarea>`:`<input class="input" data-report-field="${path}" value="${escapeHtml(value)}">`}</div>`}).join('')}</div></section>`).join('')+`<section class="report-editor-section"><button type="button" data-action="report-section"><span>Images and captions</span><span>+</span></button><div class="section-fields" hidden><div id="reportImageEditor"></div></div></section><section class="report-editor-section"><button type="button" data-action="report-section"><span>Condition table</span><span>+</span></button><div class="section-fields" hidden><div id="conditionEditor" class="editable-grid"></div><button class="button small" type="button" data-action="report-add-condition">Add condition</button></div></section><section class="report-editor-section"><button type="button" data-action="report-section"><span>Measurement table</span><span>+</span></button><div class="section-fields" hidden><div id="measurementEditor" class="editable-grid"></div><button class="button small" type="button" data-action="report-add-measurement">Add measurement</button></div></section><section class="report-editor-section"><button type="button" data-action="report-section"><span>Next actions</span><span>+</span></button><div class="section-fields" hidden><div id="actionEditor" class="editable-grid"></div><button class="button small" type="button" data-action="report-add-action">Add action</button></div></section>`;renderReportArrays();}
  function renderReportArrays(){const cond=$('#conditionEditor'),meas=$('#measurementEditor'),actions=$('#actionEditor'),images=$('#reportImageEditor');if(cond)cond.innerHTML=reportData.conditions.map((r,i)=>`<div class="editable-row">${r.map((v,c)=>`<input class="input" data-report-array="conditions" data-row="${i}" data-col="${c}" value="${escapeHtml(v)}">`).join('')}<button class="icon-button small" data-action="report-remove-row" data-array="conditions" data-index="${i}" type="button">×</button></div>`).join('');if(meas)meas.innerHTML=reportData.measurements.map((r,i)=>`<div class="editable-row">${r.map((v,c)=>`<input class="input" data-report-array="measurements" data-row="${i}" data-col="${c}" value="${escapeHtml(v)}">`).join('')}<button class="icon-button small" data-action="report-remove-row" data-array="measurements" data-index="${i}" type="button">×</button></div>`).join('');if(actions)actions.innerHTML=reportData.narrative.actions.map((v,i)=>`<div class="row"><input class="input" data-report-action="${i}" value="${escapeHtml(v)}"><button class="icon-button small" data-action="report-remove-action" data-index="${i}" type="button">×</button></div>`).join('');if(images)images.innerHTML=reportData.images.map((img,i)=>`<article class="report-image-editor"><img src="${reportImageSrc(i)}" alt="${escapeHtml(img.title)}"><div class="field"><label>Image title</label><input class="input" data-report-image-field="title" data-index="${i}" value="${escapeHtml(img.title)}"></div><div class="field"><label>Caption</label><textarea class="input" data-report-image-field="caption" data-index="${i}">${escapeHtml(img.caption)}</textarea></div><label class="button small">Replace local image<input hidden type="file" accept="image/*" data-report-image-input="${i}"></label></article>`).join('');}
  function reportSection(number,title,content){return `<section class="report-section"><div class="report-section-head"><span>${number}</span><h3>${escapeHtml(title)}</h3></div>${content}</section>`;}
  function dataTiles(obj,keys){return `<div class="report-data-grid">${keys.map(k=>`<div class="report-data"><span>${labelFor(k)}</span><strong>${escapeHtml(obj[k])}</strong></div>`).join('')}</div>`;}
  function renderReport(){
    const root=$('#reportPreview');if(!root)return;
    const valid=Math.round(reportData.summary.valid_datasets/Math.max(reportData.summary.planned_datasets,1)*100);
    const pceRows=reportData.conditions.map(r=>[r[1],parseFloat(r[3])]);
    const thicknessRows=reportData.conditions.map(r=>[r[1],parseFloat(r[2])]);
    const meta=[['Project',reportData.general.project],['Experiment',reportData.general.experiment_id],['PI',reportData.general.principal_investigator],['Operator',reportData.general.operator],['Period',reportData.general.period],['Template',reportData.general.template]];
    const processFlow=`<div class="report-process-flow"><span>Prepare substrate</span><i></i><span>Prepare batch</span><i></i><span>Deposit absorber</span><i></i><span>Complete device</span><i></i><span>Measure</span></div>`;
    root.innerHTML=`
      <article class="report-sheet report-cover report-page-summary">
        <div class="report-topline"><div><strong>LABFLOW</strong><span>Experimental report</span></div><div><span>${escapeHtml(reportData.general.report_id)}</span><b>${escapeHtml(reportData.general.status)}</b></div></div>
        <div class="report-title-block"><span class="eyebrow">${escapeHtml(reportData.general.experiment_id)}</span><h2>${escapeHtml(reportData.general.title)}</h2><p>${escapeHtml(reportData.general.subtitle)}</p></div>
        <div class="report-meta-grid compact">${meta.map(([l,v])=>`<div class="report-meta"><span>${l}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>
        <div class="report-kpis compact"><div class="report-kpi"><span>Samples</span><strong>${reportData.summary.samples}</strong><small>physical specimens</small></div><div class="report-kpi"><span>Data complete</span><strong>${valid}%</strong><small>${reportData.summary.valid_datasets}/${reportData.summary.planned_datasets} datasets</small></div><div class="report-kpi"><span>Best PCE</span><strong>${reportData.summary.best_pce}%</strong><small>${escapeHtml(reportData.device.best_device)}</small></div><div class="report-kpi"><span>Mean PCE</span><strong>${reportData.summary.mean_pce}%</strong><small>validated devices</small></div></div>
        <div class="report-summary-grid"><div>${reportSection('01','Question',`<div class="report-callout concise"><strong>Scientific objective</strong><p>${escapeHtml(reportData.objective)}</p></div>`)}${reportSection('02','Finding',`<div class="report-finding"><span data-icon="spark"></span><div><strong>${escapeHtml(reportData.narrative.primary_finding)}</strong><p>${escapeHtml(reportData.narrative.interpretation)}</p></div></div>`)}</div><div class="report-decision-card"><span>Recommended condition</span><strong>${escapeHtml(reportData.summary.recommended_condition)}</strong><p>${escapeHtml(reportData.narrative.conclusion)}</p></div></div>
        ${reportSection('03','Experiment comparison',`<div class="report-chart-grid"><div class="chart-frame">${chartSvg('bar','PCE by condition',pceRows)}</div><div class="chart-frame">${chartSvg('line','Thickness by condition',thicknessRows)}</div></div>`)}
      </article>
      <article class="report-sheet report-page-method">
        <div class="report-page-head"><div><span>02</span><strong>Materials and method</strong></div><small>${escapeHtml(reportData.general.experiment_id)}</small></div>
        ${reportSection('04','Perovskite and precursor',`<div class="report-method-grid"><div class="composition-report-card"><span>ABX3 composition</span><strong>${escapeHtml(reportData.composition.formula)}</strong><dl><div><dt>Type</dt><dd>${escapeHtml(reportData.composition.sample_type)}</dd></div><div><dt>Dimensionality</dt><dd>${escapeHtml(reportData.composition.dimensionality)}</dd></div><div><dt>Band gap</dt><dd>${escapeHtml(reportData.composition.band_gap_ev)} eV</dd></div></dl></div><div class="solution-diagram report-solution compact"><div class="solution-inputs"><span>PbI2</span><span>FAI</span><span>MABr</span><span>CsI</span></div><div class="solution-beaker"><i class="fill-72"></i><strong>${escapeHtml(reportData.chemistry.concentration)}</strong><small>${escapeHtml(reportData.chemistry.solvent_ratio)}</small></div><div class="solution-output"><strong>${escapeHtml(reportData.chemistry.batch)}</strong><small>${escapeHtml(reportData.chemistry.volume)}</small></div></div></div><div class="report-data-grid compact">${[['Recipe',reportData.chemistry.recipe],['Additives',reportData.chemistry.additives],['Prepared',reportData.chemistry.prepared_at],['Filter',reportData.chemistry.filter],['Storage',reportData.chemistry.storage],['Impurities',reportData.chemistry.impurities]].map(([l,v])=>`<div class="report-data"><span>${l}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>`)}
        ${reportSection('05','Device stack',`<div class="stack-visual-large report-stack compact"><span class="contact">Au <b>80 nm</b></span><span class="transport">Spiro-OMeTAD <b>180 nm</b></span><span class="absorber">Perovskite <b>400 nm</b></span><span class="transport">SnO2 <b>30 nm</b></span><span class="substrate">Glass / ITO <b>1.1 mm</b></span></div><div class="report-data-grid compact">${[['Architecture',reportData.device.architecture],['Active area',reportData.device.active_area],['Mask',reportData.device.mask],['Cells / substrate',reportData.device.devices_per_substrate]].map(([l,v])=>`<div class="report-data"><span>${l}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>`)}
        ${reportSection('06','Work performed',`${processFlow}<div class="report-data-grid compact">${[['Substrate',reportData.process.substrate],['Cleaning',reportData.process.cleaning],['Spin coating',`${reportData.process.spin_speed} · ${reportData.process.spin_time}`],['Antisolvent',reportData.process.antisolvent],['Annealing',reportData.process.annealing],['Atmosphere',reportData.process.atmosphere]].map(([l,v])=>`<div class="report-data"><span>${l}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>`)}
        ${reportSection('07','Conditions',`<table class="report-table compact"><thead><tr><th>Group</th><th>Condition</th><th>Thickness</th><th>PCE</th><th>Status</th></tr></thead><tbody>${reportData.conditions.map(r=>`<tr>${r.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)}
      </article>
      <article class="report-sheet report-page-results">
        <div class="report-page-head"><div><span>03</span><strong>Results and evidence</strong></div><small>${escapeHtml(reportData.general.experiment_id)}</small></div>
        ${reportSection('08','Key results',`<div class="report-result-strip">${Object.entries(reportData.results).slice(0,6).map(([k,v])=>`<div><span>${labelFor(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>`)}
        ${reportSection('09','Characterisation',`<div class="report-chart-grid"><div class="chart-frame">${chartSvg('line','J-V curve',[['0.0',23.2],['0.2',23.0],['0.4',22.6],['0.6',21.8],['0.8',19.5],['1.0',12.0],['1.14',0]])}</div><div class="chart-frame">${chartSvg('line','EQE spectrum',[['350',55],['450',84],['550',91],['650',88],['750',72],['800',12]])}</div></div>`)}
        ${reportSection('10','Images and measurements',`<div class="report-evidence-grid"><div class="report-media-grid compact">${reportData.images.map((img,i)=>`<figure class="report-image-card"><img src="${reportImageSrc(i)}" alt="${escapeHtml(img.title)}"><figcaption><strong>${escapeHtml(img.title)}</strong><span>${escapeHtml(img.caption)}</span></figcaption></figure>`).join('')}</div><table class="report-table compact"><thead><tr><th>Technique</th><th>Target</th><th>Instrument</th><th>Status</th></tr></thead><tbody>${reportData.measurements.map(r=>`<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td><td>${escapeHtml(r[4])}</td></tr>`).join('')}</tbody></table></div>`)}
        ${reportSection('11','Traceability and next actions',`<div class="report-final-grid"><div><div class="report-provenance-list">${reportData.provenance.map(r=>`<div><span>${escapeHtml(r[0])}</span><strong>${escapeHtml(r[1])}</strong></div>`).join('')}</div></div><div><div class="report-decision"><strong>${escapeHtml(reportData.summary.recommended_condition)}</strong><span>${escapeHtml(reportData.narrative.conclusion)}</span></div><ol>${reportData.narrative.actions.map(a=>`<li>${escapeHtml(a)}</li>`).join('')}</ol></div></div>`)}
      </article>`;
  }
  function reportSheets(){return [{name:'Overview',rows:[['Field','Value'],...Object.entries(reportData.general),['Objective',reportData.objective]]},{name:'Composition',rows:[['Field','Value'],...Object.entries(reportData.composition)]},{name:'Chemistry',rows:[['Field','Value'],...Object.entries(reportData.chemistry)]},{name:'Process',rows:[['Field','Value'],...Object.entries(reportData.process)]},{name:'Device',rows:[['Field','Value'],...Object.entries(reportData.device)]},{name:'Summary',rows:[['Field','Value'],...Object.entries(reportData.summary),...Object.entries(reportData.results)]},{name:'Conditions',rows:[['Group','Condition','Thickness','PCE','Status'],...reportData.conditions]},{name:'Measurements',rows:[['Technique','Target','Instrument','Context','Status'],...reportData.measurements]},{name:'Files',rows:[['File','Role','Integrity'],...reportData.files]},{name:'Images',rows:[['Title','Caption','Filename'],...reportData.images.map(i=>[i.title,i.caption,i.filename])]},{name:'Provenance',rows:[['Entity','Identifier'],...reportData.provenance]},{name:'Narrative',rows:[['Section','Text'],['Primary finding',reportData.narrative.primary_finding],['Interpretation',reportData.narrative.interpretation],['Quality note',reportData.narrative.quality_note],['Conclusion',reportData.narrative.conclusion],...reportData.narrative.actions.map((a,i)=>[`Action ${i+1}`,a])]}];}
  function reportCsv(){return X.rowsToCsv(reportSheets().flatMap(s=>[[s.name,'',''],...s.rows]));}
  function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines=99){const words=String(text).split(/\s+/);let line='',count=0;for(const word of words){const test=`${line}${word} `;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line.trim(),x,y);line=`${word} `;y+=lineHeight;if(++count>=maxLines)return y;}else line=test;}if(line&&count<maxLines){ctx.fillText(line.trim(),x,y);y+=lineHeight;}return y;}
  function drawPdfChart(ctx,type,rows,x,y,w,h,color='#2563a8'){
    const values=rows.map(r=>parseFloat(r[1])||0),max=Math.max(...values,1),min=type==='line'?Math.min(...values,0):0;
    const range=Math.max(max-min,1);
    ctx.fillStyle='#f7f9fc';ctx.fillRect(x,y,w,h);
    ctx.strokeStyle='#dce3ea';ctx.lineWidth=1;
    for(let i=1;i<5;i++){const yy=y+i*h/5;ctx.beginPath();ctx.moveTo(x+42,yy);ctx.lineTo(x+w-16,yy);ctx.stroke();}
    if(type==='bar'){
      const slot=(w-76)/rows.length,bw=Math.min(118,slot*.56);
      rows.forEach((r,i)=>{const value=parseFloat(r[1])||0,bx=x+48+i*slot+(slot-bw)/2,hh=value/max*(h-66),by=y+h-34-hh;ctx.fillStyle=i===1?'#19766f':color;ctx.fillRect(bx,by,bw,hh);ctx.fillStyle='#17202b';ctx.font='600 14px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText(String(value),bx+bw/2,Math.max(y+18,by-8));ctx.fillStyle='#5d6a79';ctx.font='12px system-ui, sans-serif';ctx.fillText(r[0],bx+bw/2,y+h-12);});
    }else{
      ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();
      rows.forEach((r,i)=>{const value=parseFloat(r[1])||0,px=x+52+i*(w-84)/Math.max(rows.length-1,1),py=y+h-38-(value-min)/range*(h-70);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();
      rows.forEach((r,i)=>{const value=parseFloat(r[1])||0,px=x+52+i*(w-84)/Math.max(rows.length-1,1),py=y+h-38-(value-min)/range*(h-70);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#17202b';ctx.font='600 12px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText(String(value),px,Math.max(y+16,py-12));ctx.fillStyle='#5d6a79';ctx.font='11px system-ui, sans-serif';ctx.fillText(r[0],px,y+h-12);});
    }
    ctx.textAlign='left';ctx.lineWidth=1;
  }
  function createReportPdfPages(){
    const W=1240,H=1754,nav='#18283c',blue='#2767a9',ink='#18212c',muted='#617083',line='#dbe2e9',soft='#f3f6f9',teal='#19766f',amber='#ae741e',white='#ffffff';
    const make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
    const pages=Array.from({length:3},make);
    const font=(weight,size)=>`${weight} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const header=(ctx,n,title)=>{ctx.fillStyle=nav;ctx.fillRect(0,0,W,102);ctx.fillStyle=blue;ctx.fillRect(0,102,W,6);ctx.fillStyle=white;ctx.font=font(750,28);ctx.fillText('LABFLOW',64,48);ctx.fillStyle='#b8c5d3';ctx.font=font(500,14);ctx.fillText('EXPERIMENTAL REPORT',64,76);ctx.textAlign='right';ctx.fillStyle=white;ctx.font=font(700,19);ctx.fillText(title,W-64,45);ctx.fillStyle='#b8c5d3';ctx.font=font(500,13);ctx.fillText(`${reportData.general.report_id} · ${n}/3`,W-64,73);ctx.textAlign='left';};
    const footer=(ctx,n)=>{ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(64,H-58);ctx.lineTo(W-64,H-58);ctx.stroke();ctx.fillStyle=muted;ctx.font=font(500,12);ctx.fillText('Generated locally by LabFlow from editable experiment data',64,H-30);ctx.textAlign='right';ctx.fillText(`Page ${n} of 3`,W-64,H-30);ctx.textAlign='left';};
    const title=(ctx,num,text,y)=>{ctx.fillStyle=blue;ctx.fillRect(64,y,34,28);ctx.fillStyle=white;ctx.font=font(750,13);ctx.fillText(num,74,y+19);ctx.fillStyle=ink;ctx.font=font(750,21);ctx.fillText(text,116,y+21);return y+42;};
    const card=(ctx,x,y,w,h,label,value,accent=blue,sub='')=>{ctx.fillStyle=white;ctx.strokeStyle=line;ctx.strokeRect(x,y,w,h);ctx.fillStyle=accent;ctx.fillRect(x,y,6,h);ctx.fillStyle=muted;ctx.font=font(700,11);ctx.fillText(String(label).toUpperCase(),x+18,y+24);ctx.fillStyle=ink;ctx.font=font(760,26);ctx.fillText(String(value),x+18,y+58);if(sub){ctx.fillStyle=muted;ctx.font=font(500,11);wrapText(ctx,sub,x+18,y+79,w-34,15,2);}};
    const fieldGrid=(ctx,items,y,cols=3,rowH=68)=>{const gap=10,w=(1112-gap*(cols-1))/cols;items.forEach(([label,value],i)=>{const x=64+(i%cols)*(w+gap),yy=y+Math.floor(i/cols)*(rowH+10);ctx.fillStyle=soft;ctx.fillRect(x,yy,w,rowH);ctx.fillStyle=muted;ctx.font=font(700,10);ctx.fillText(String(label).toUpperCase(),x+12,yy+19);ctx.fillStyle=ink;ctx.font=font(650,14);wrapText(ctx,value,x+12,yy+43,w-24,17,2);});return y+Math.ceil(items.length/cols)*(rowH+10);};
    const table=(ctx,headers,rows,y,widths,rowH=34)=>{ctx.fillStyle=nav;ctx.fillRect(64,y,1112,34);ctx.fillStyle=white;ctx.font=font(700,10);let x=64;headers.forEach((h,i)=>{ctx.fillText(String(h).toUpperCase(),x+8,y+22);x+=widths[i];});y+=34;rows.forEach((row,ri)=>{ctx.fillStyle=ri%2?soft:white;ctx.fillRect(64,y,1112,rowH);ctx.fillStyle=ink;ctx.font=font(500,11);let xx=64;row.forEach((v,i)=>{wrapText(ctx,v,xx+8,y+21,widths[i]-16,14,1);xx+=widths[i];});ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(64,y+rowH);ctx.lineTo(1176,y+rowH);ctx.stroke();y+=rowH;});return y;};
    const labelBox=(ctx,x,y,w,label,value)=>{ctx.fillStyle=soft;ctx.fillRect(x,y,w,54);ctx.fillStyle=muted;ctx.font=font(700,9);ctx.fillText(label.toUpperCase(),x+10,y+17);ctx.fillStyle=ink;ctx.font=font(650,13);wrapText(ctx,value,x+10,y+37,w-20,15,1);};

    let ctx=pages[0].getContext('2d'),y=0;ctx.fillStyle=white;ctx.fillRect(0,0,W,H);header(ctx,1,'SUMMARY');y=150;
    ctx.fillStyle=blue;ctx.font=font(750,14);ctx.fillText(`${reportData.general.experiment_id} · ${String(reportData.general.status).toUpperCase()}`,64,y);y+=34;ctx.fillStyle=ink;ctx.font=font(780,38);y=wrapText(ctx,reportData.general.title,64,y,1080,44,2);ctx.fillStyle=muted;ctx.font=font(500,17);y=wrapText(ctx,reportData.general.subtitle,64,y+4,1080,24,2)+14;
    y=fieldGrid(ctx,[['Project',reportData.general.project],['Principal investigator',reportData.general.principal_investigator],['Operator',reportData.general.operator],['Period',reportData.general.period],['Laboratory',reportData.general.laboratory],['Setup',reportData.general.template]],y,3,58)+10;
    const valid=Math.round(reportData.summary.valid_datasets/Math.max(reportData.summary.planned_datasets,1)*100);[['Samples',reportData.summary.samples,blue,'physical specimens'],['Complete',`${valid}%`,teal,`${reportData.summary.valid_datasets}/${reportData.summary.planned_datasets} datasets`],['Best PCE',`${reportData.summary.best_pce}%`,blue,reportData.device.best_device],['Mean PCE',`${reportData.summary.mean_pce}%`,amber,'validated devices']].forEach((r,i)=>card(ctx,64+i*281,y,263,94,r[0],r[1],r[2],r[3]));y+=118;
    y=title(ctx,'01','Question and finding',y);ctx.fillStyle=soft;ctx.fillRect(64,y,716,154);ctx.fillStyle=muted;ctx.font=font(700,11);ctx.fillText('SCIENTIFIC QUESTION',84,y+28);ctx.fillStyle=ink;ctx.font=font(600,16);wrapText(ctx,reportData.objective,84,y+56,676,23,4);ctx.fillStyle='#e9f5f3';ctx.fillRect(798,y,378,154);ctx.fillStyle=teal;ctx.font=font(700,11);ctx.fillText('PRIMARY FINDING',818,y+28);ctx.fillStyle=ink;ctx.font=font(650,15);wrapText(ctx,reportData.narrative.primary_finding,818,y+56,338,21,4);y+=178;
    y=title(ctx,'02','Experiment comparison',y);ctx.fillStyle=muted;ctx.font=font(650,13);ctx.fillText('PCE (%)',64,y+16);ctx.fillText('THICKNESS (nm)',634,y+16);drawPdfChart(ctx,'bar',reportData.conditions.map(r=>[r[1],parseFloat(r[3])]),64,y+28,542,282,blue);drawPdfChart(ctx,'line',reportData.conditions.map(r=>[r[1],parseFloat(r[2])]),634,y+28,542,282,teal);y+=332;
    ctx.fillStyle=blue;ctx.fillRect(64,y,1112,106);ctx.fillStyle=white;ctx.font=font(700,12);ctx.fillText('RECOMMENDED CONDITION',84,y+27);ctx.font=font(760,20);ctx.fillText(reportData.summary.recommended_condition,84,y+56);ctx.font=font(500,13);wrapText(ctx,reportData.narrative.conclusion,84,y+80,1068,18,2);footer(ctx,1);

    ctx=pages[1].getContext('2d');ctx.fillStyle=white;ctx.fillRect(0,0,W,H);header(ctx,2,'MATERIALS AND METHOD');y=145;
    y=title(ctx,'03','Composition and solution',y);ctx.fillStyle='#eaf1fb';ctx.fillRect(64,y,516,126);ctx.fillStyle=blue;ctx.font=font(700,11);ctx.fillText('PEROVSKITE COMPOSITION',84,y+27);ctx.fillStyle=ink;ctx.font=font(760,22);wrapText(ctx,reportData.composition.formula,84,y+59,470,27,2);ctx.fillStyle=muted;ctx.font=font(500,12);ctx.fillText(`${reportData.composition.sample_type} · ${reportData.composition.dimensionality} · ${reportData.composition.band_gap_ev} eV`,84,y+104);
    ctx.fillStyle=soft;ctx.fillRect(600,y,576,126);ctx.fillStyle=muted;ctx.font=font(700,11);ctx.fillText('PRECURSOR SOLUTION',620,y+27);ctx.fillStyle=teal;ctx.fillRect(620,y+46,74,54);ctx.fillStyle=white;ctx.font=font(760,17);ctx.fillText(reportData.chemistry.concentration,632,y+78);ctx.fillStyle=ink;ctx.font=font(700,15);ctx.fillText(reportData.chemistry.batch,716,y+62);ctx.fillStyle=muted;ctx.font=font(500,12);ctx.fillText(`${reportData.chemistry.solvent_ratio} · ${reportData.chemistry.volume}`,716,y+86);y+=146;
    y=fieldGrid(ctx,[['Recipe',reportData.chemistry.recipe],['Solutes',reportData.chemistry.solutes],['Additives',reportData.chemistry.additives],['Prepared',reportData.chemistry.prepared_at],['Filter',reportData.chemistry.filter],['Storage',reportData.chemistry.storage]],y,3,58)+8;
    y=title(ctx,'04','Device stack',y);const layers=[['Au','80 nm','#ba8b2c'],['Spiro-OMeTAD','180 nm','#7457a8'],['Perovskite','400 nm','#2767a9'],['SnO2','30 nm','#19766f'],['Glass / ITO','1.1 mm','#6a7787']];layers.forEach((r,i)=>{const yy=y+i*44;ctx.fillStyle=r[2];ctx.fillRect(64,yy,706,35);ctx.fillStyle=white;ctx.font=font(700,13);ctx.fillText(r[0],80,yy+23);ctx.textAlign='right';ctx.fillText(r[1],752,yy+23);ctx.textAlign='left';});const deviceCards=[['Architecture',reportData.device.architecture],['Active area',reportData.device.active_area],['Mask',reportData.device.mask],['Best device',reportData.device.best_device],['Cells / substrate',reportData.device.devices_per_substrate],['Encapsulation',reportData.device.encapsulation]];deviceCards.forEach((r,i)=>labelBox(ctx,792+(i%2)*192,y+Math.floor(i/2)*64,182,r[0],r[1]));y+=244;
    y=title(ctx,'05','Work performed',y);const steps=['Prepare substrate','Prepare batch','Deposit absorber','Anneal','Complete device','Measure'];const sw=166;steps.forEach((step,i)=>{const x=64+i*184;ctx.fillStyle=i<3?blue:soft;ctx.strokeStyle=i<3?blue:line;ctx.fillRect(x,y,sw,58);ctx.strokeRect(x,y,sw,58);ctx.fillStyle=i<3?white:ink;ctx.font=font(700,12);wrapText(ctx,step,x+12,y+24,sw-24,16,2);if(i<steps.length-1){ctx.strokeStyle=blue;ctx.beginPath();ctx.moveTo(x+sw+4,y+29);ctx.lineTo(x+180,y+29);ctx.stroke();}});y+=78;
    y=fieldGrid(ctx,[['Substrate',reportData.process.substrate],['Cleaning',reportData.process.cleaning],['Spin coating',`${reportData.process.spin_speed} · ${reportData.process.spin_time}`],['Acceleration',reportData.process.acceleration],['Antisolvent',reportData.process.antisolvent],['Annealing',reportData.process.annealing],['Atmosphere',reportData.process.atmosphere],['Surface RMS',reportData.process.surface_rms],['Substrate size',reportData.process.substrate_size]],y,3,58)+8;
    y=title(ctx,'06','Conditions',y);table(ctx,['Group','Condition','Thickness','PCE','Status'],reportData.conditions,y,[100,300,245,180,287],42);footer(ctx,2);

    ctx=pages[2].getContext('2d');ctx.fillStyle=white;ctx.fillRect(0,0,W,H);header(ctx,3,'RESULTS AND EVIDENCE');y=145;
    y=title(ctx,'07','Key results',y);const resultEntries=[['Voc',reportData.results.Voc],['Jsc',reportData.results.Jsc],['FF',reportData.results.FF],['PCE',reportData.results.PCE],['Thickness',reportData.results.thickness],['Roughness',reportData.results.roughness]];resultEntries.forEach((r,i)=>{const x=64+(i%3)*374,yy=y+Math.floor(i/3)*82;card(ctx,x,yy,354,70,r[0],r[1],i===3?teal:blue,'');});y+=180;
    y=title(ctx,'08','Characterisation',y);ctx.fillStyle=muted;ctx.font=font(650,13);ctx.fillText('J-V CURVE',64,y+16);ctx.fillText('EQE SPECTRUM',634,y+16);drawPdfChart(ctx,'line',[['0.0',23.2],['0.2',23.0],['0.4',22.6],['0.6',21.8],['0.8',19.5],['1.0',12],['1.14',0]],64,y+28,542,230,blue);drawPdfChart(ctx,'line',[['350',55],['450',84],['550',91],['650',88],['750',72],['800',12]],634,y+28,542,230,teal);y+=282;
    y=title(ctx,'09','Images and measurements',y);reportData.images.slice(0,2).forEach((im,i)=>{const source=reportImageCache.get(i),x=64+i*566;if(source)ctx.drawImage(source,x,y,546,184);ctx.fillStyle=nav;ctx.fillRect(x,y+184,546,48);ctx.fillStyle=white;ctx.font=font(700,13);ctx.fillText(im.title,x+12,y+205);ctx.font=font(500,10);wrapText(ctx,im.caption,x+12,y+222,520,13,1);});y+=250;y=table(ctx,['Technique','Target','Instrument','Status'],reportData.measurements.slice(0,5).map(r=>[r[0],r[1],r[2],r[4]]),y,[150,430,220,312],29)+18;
    y=title(ctx,'10','Traceability',y);const prov=reportData.provenance.slice(0,6);prov.forEach((r,i)=>{const x=64+(i%3)*374,yy=y+Math.floor(i/3)*58;ctx.fillStyle=soft;ctx.fillRect(x,yy,354,48);ctx.fillStyle=muted;ctx.font=font(700,9);ctx.fillText(r[0].toUpperCase(),x+10,yy+16);ctx.fillStyle=ink;ctx.font=font(650,12);ctx.fillText(r[1],x+10,yy+35);});y+=130;
    y=title(ctx,'11','Conclusion and next actions',y);ctx.fillStyle='#e9f5f3';ctx.fillRect(64,y,1112,92);ctx.fillStyle=teal;ctx.font=font(700,11);ctx.fillText('RECOMMENDATION',84,y+25);ctx.fillStyle=ink;ctx.font=font(760,18);ctx.fillText(reportData.summary.recommended_condition,84,y+52);ctx.font=font(500,13);wrapText(ctx,reportData.narrative.conclusion,84,y+75,1060,17,1);y+=110;reportData.narrative.actions.slice(0,3).forEach((a,i)=>{const yy=y+i*42;ctx.fillStyle=blue;ctx.beginPath();ctx.arc(78,yy+15,13,0,Math.PI*2);ctx.fill();ctx.fillStyle=white;ctx.font=font(750,11);ctx.textAlign='center';ctx.fillText(String(i+1),78,yy+19);ctx.textAlign='left';ctx.fillStyle=ink;ctx.font=font(550,13);wrapText(ctx,a,104,yy+19,1050,17,2);});footer(ctx,3);
    return pages;
  }


  /* Events */
  document.addEventListener('click', event => {
    const button = event.target.closest('button,[data-action],.tab-button,.process-node,.entity-node,.measurement-card,.condition-card,[data-graph-node-id]'); if (!button) return;
    const action = button.dataset.action;
    if(action==='ai-drawer')openOverlay('aiDrawer');
    if(button.matches('[data-ai-mode]')){aiState.mode=button.dataset.aiMode;aiState.lastInput=null;aiState.lastOutput=null;const prompt=$('#aiPrompt');if(prompt)prompt.value=aiModes[aiState.mode].prompts[0];renderAIPage();}
    if(button.matches('[data-ai-prompt]')){const prompt=$('#aiPrompt');if(prompt){prompt.value=button.dataset.aiPrompt;prompt.focus();}aiState.lastInput=aiInput(aiState.mode,button.dataset.aiPrompt);renderAIPage();}
    if(action==='ai-run')runAI();
    if(action==='ai-accept'){if(aiState.lastOutput)aiState.lastOutput.status='accepted';const out=$('#aiOutputPreview');if(out)out.textContent=JSON.stringify(aiState.lastOutput,null,2);toast('AI suggestion accepted','success','The simulated change was added to the researcher review log.');}
    if(action==='ai-edit'){if(aiState.lastOutput)aiState.lastOutput.status='edited';toast('Suggestion opened for editing','info','In the future UI, only reviewed fields will be written.');}
    if(action==='ai-reject'){if(aiState.lastOutput)aiState.lastOutput.status='rejected';const out=$('#aiOutputPreview');if(out)out.textContent=JSON.stringify(aiState.lastOutput,null,2);toast('AI suggestion rejected','info','No scientific record was changed.');}
    if(action==='ai-copy-input'){navigator.clipboard?.writeText($('#aiInputPreview')?.textContent||'');toast('Input copied','success','Structured simulated input copied.');}
    if(action==='ai-copy-output'){navigator.clipboard?.writeText($('#aiOutputPreview')?.textContent||'');toast('Output copied','success','Structured simulated output copied.');}
    if(action==='ai-drawer-prompt'){const input=$('#aiDrawerPrompt');if(input)input.value=button.dataset.prompt;}
    if(action==='ai-drawer-run'){const box=$('.ai-drawer-answer');const q=$('#aiDrawerPrompt')?.value.trim()||'What should I do next?';const [,answer]=contextualAIResponse();if(box)box.innerHTML=`<span class="eyebrow">Simulated answer</span><p><strong>${escapeHtml(q)}</strong></p><p>${escapeHtml(answer)}</p><div class="ai-evidence-row"><span class="badge success">Evidence linked</span><span>Current page · ${escapeHtml(currentProject().id)}</span></div>`;}
    if(action==='ai-explain-plan')toast('Why this plan?','info','It changes one parameter, spans the previous useful window and keeps the sample count manageable.');
    if(action==='ai-apply-plan'){button.textContent='Suggestion applied';button.disabled=true;toast('Plan suggestion applied','success','Conditions and replicates remain editable before execution.');}
    if(action==='ai-parse-file'){const root=$('#aiFileResult');if(root){root.hidden=false;root.innerHTML=`<div class="ai-file-mapping"><span class="badge success">96% confidence</span><strong>J–V measurement detected</strong><dl><div><dt>Target</dt><dd>DEV-052-B04-03</dd></div><div><dt>Columns</dt><dd>voltage_V · current_density_mA_cm²</dd></div><div><dt>Derived</dt><dd>Voc 1.14 V · Jsc 23.2 · FF 81.0% · PCE 21.4%</dd></div><div><dt>Warning</dt><dd>Confirm illuminated area</dd></div></dl><div class="row wrap"><button class="button small" type="button" data-action="ai-reject-file">Reject</button><button class="button small primary" type="button" data-action="ai-accept-file">Review and attach</button></div></div>`;} }
    if(action==='ai-accept-file')toast('File mapping accepted','success','Simulated measurement is ready for final validation.');
    if(action==='ai-reject-file'){const root=$('#aiFileResult');if(root)root.hidden=true;toast('File suggestion rejected','info','The original file remains unchanged.');}
    if(action==='ai-analyse-charts'){const root=$('#aiChartInsightBody');if(root){root.className='panel-body ai-insight-result';root.innerHTML=`<div><span class="badge success">Evidence-linked draft</span><strong>Condition B provides the best performance–uniformity balance.</strong><p>PCE peaks at 21.4% near 1500 rpm while roughness is lower than conditions A and C. Condition C should be reviewed because one sample is a morphology outlier.</p><div class="ai-evidence-row"><span>Visible charts</span><span>Validated samples</span><span>Current filters</span></div></div><button class="button small" type="button" data-action="ai-use-chart-note">Use in report</button>`;} }
    if(action==='ai-use-chart-note')toast('Insight sent to report draft','success','The text remains editable and is marked as AI-assisted.');
    if(action==='ai-nomad-scan')renderNomadAISuggestions();
    if(action==='ai-accept-field'){button.textContent='Accepted';button.disabled=true;button.closest('article')?.classList.add('accepted');toast('Metadata suggestion accepted','success','The field is still available for researcher editing.');}
    if(action==='ai-draft-report'){reportData.narrative.primary_finding='AI-assisted draft: Condition B produced the highest validated device performance while maintaining lower roughness than the other tested conditions.';reportData.narrative.interpretation='The 1500 rpm condition provides the strongest performance–uniformity balance in this dataset. This interpretation is limited to the selected batch, setup and measurement context.';reportData.narrative.conclusion='Review the remaining C03 J–V measurement, confirm environmental metadata and repeat the recommended condition in an independent batch.';renderReportEditor();renderReport();toast('AI-assisted draft added','success','Finding, interpretation and conclusion remain fully editable.');}
    if(action==='sidebar') document.body.classList.toggle('sidebar-open');
    if(action==='user-toggle'){const pop=$('#userPopover'),project=$('#projectPopover');if(project)project.hidden=true;if(pop){pop.hidden=!pop.hidden;button.setAttribute('aria-expanded',String(!pop.hidden));}}
    if(action==='project-toggle'){const pop=$('#projectPopover'),user=$('#userPopover');if(user)user.hidden=true;if(pop){pop.hidden=!pop.hidden;button.setAttribute('aria-expanded',String(!pop.hidden));}}
    if(action==='project-select'){try{localStorage.setItem(projectStoreKey(),button.dataset.project);}catch(_){} if(page==='progetti')location.href='project.html';else location.reload();}
    if(action==='project-new'){location.href='projects.html#new';}
    if(action==='project-open'){try{localStorage.setItem(projectStoreKey(),button.dataset.project);}catch(_){} location.href='project.html';}
    if(action==='project-wizard'){openProjectWizard();}
    if(action==='experiment-wizard'){location.href='experiment.html';}
    if(action==='stack-wizard'){location.href='stack.html?new';}
    if(action==='quick-import'){location.href='report.html#import';}
    if(action==='project-prev'){projectWizardState.step=Math.max(0,projectWizardState.step-1);renderProjectWizard();}
    if(action==='project-next'){projectWizardState.step=Math.min(2,projectWizardState.step+1);renderProjectWizard();}
    if(action==='project-complete'){completeProjectWizard();}
    if(action==='user-save'){toast('Profile saved','success','Preferences remain local in this static POC.');}
    if(action==='user-avatar'){toast('Local avatar picker','info','A backend will store the selected profile image securely.');}
    if(action==='user-session-revoke'){button.closest('.session-row')?.remove();toast('Session revoked','success','Demo session removed from this view.');}
    if(action==='user-select'){try{localStorage.setItem('labflow-user',button.dataset.user);}catch(_){} location.reload();}
    if(action==='quick-create'){renderCreateChooser();openOverlay('createWizard');}
    if(action==='create-type')startCreateWizard(button.dataset.createType,button.dataset.preset||'preset');
    if(button.matches('[data-project-starter]')){$$('[data-project-starter]').forEach(x=>x.classList.toggle('active',x===button));projectWizardState.starter=button.dataset.projectStarter;}
    if(button.matches('[data-starter]')){$$('[data-starter]').forEach(x=>x.classList.toggle('active',x===button));createWizardState.preset=button.dataset.starter;}
    if(action==='create-add-layer'){const root=button.closest('.layer-wizard');if(root){const n=root.querySelectorAll('.layer-edit').length+1;const row=document.createElement('div');row.className='layer-edit';row.innerHTML=`<span class="layer-grip">${n}</span><select class="input"><option>Custom layer</option></select><input class="input" value="New material"><input class="input" value="—">`;root.insertBefore(row,button);}}
    if(button.matches('[data-step-method]')){$$('[data-step-method]').forEach(x=>x.classList.toggle('active',x===button));processStepState.method=button.dataset.stepMethod;}

    if(action==='create-choose')renderCreateChooser();
    if(action==='create-prev'){createWizardState.step=Math.max(0,createWizardState.step-1);renderCreateForm();}
    if(action==='create-next'){createWizardState.step=Math.min(2,createWizardState.step+1);renderCreateForm();}
    if(action==='create-complete'){const type=button.dataset.createType;const target=type==='project'?'project.html':type==='experiment'?'experiment.html':'catalogs.html';toast(type==='project'?'Project created':type==='experiment'?'Experiment wizard ready':'Library item created','success',type==='project'?'Opening the new project workspace.':type==='experiment'?'Opening the full guided experiment.':'Saved in the active project Library context.');setTimeout(()=>{location.href=target;},260);}
    if(action==='close-sidebar') document.body.classList.remove('sidebar-open');
    if(action==='theme') setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
    if(action==='open') openOverlay(button.dataset.target);
    if(action==='close') closeOverlay(button.closest('.overlay,.drawer'));
    if(action==='toast') toast(button.dataset.message||'Saved','success');
    if(button.classList.contains('tab-button')) activateTab(button);
    if(button.classList.contains('entity-node')) renderEntity(button.dataset.entity);
    if(button.matches('[data-flow-focus]')) { $$('[data-flow-focus]').forEach(b=>b.classList.toggle('active',b===button)); const map=$('#modelMap'); if(map){const target={composition:'PerovskiteComposition',chemistry:'SolutionRecipe',process:'ProcessTemplate',device:'StackDefinition',measurement:'Measurement',result:'DerivedResult'}[button.dataset.flowFocus];renderEntity(target);} }
    if(button.matches('[data-template-step]')){$$('[data-template-step]').forEach(b=>b.classList.toggle('active',b===button));const target=document.getElementById(button.dataset.target);target?.scrollIntoView({behavior:'smooth',block:'start'});}
    if(button.matches('[data-setup-step]'))showSetupWizardStep(Number(button.dataset.setupStep));
    if(action==='setup-prev')showSetupWizardStep(setupWizardStep-1);
    if(action==='setup-next')showSetupWizardStep(setupWizardStep+1);
    if(action==='setup-finish'){showSetupWizardStep(2);toast('Setup ready','success','Future experiments can use it in one click.');}
    if(button.classList.contains('process-node')) { $$('.process-node').forEach(n=>n.classList.toggle('active',n===button));renderProcessInspector(button.dataset.processNode); }
    if(action==='process-add-step')openProcessStepWizard();
    if(action==='process-validate') toast('Template validation','warning','One output role is still undefined in the demo.');
    if(button.matches('[data-wizard-step]')) showWizardStep(Number(button.dataset.wizardStep));
    if(action==='wizard-prev') showWizardStep(wizardStep-1);
    if(action==='wizard-next'){const panels=$$('[data-wizard-panel]');if(wizardStep<panels.length-1)showWizardStep(wizardStep+1);else{toast('Experiment review complete','success','Choose comparison, report or NOMAD from the finish screen.');}}
    if(action==='experiment-review'){showWizardStep($$('[data-wizard-panel]').length-1);toast('Review opened','info','Check completeness, ownership and NOMAD mapping.');}
    if(action==='add-ion') addIon(button.dataset.site);
    if(action==='remove-ion'){button.closest('.ion-row')?.remove();updateAbxFormula();}
    if(action==='add-condition'){const grid=$('#conditionGrid');if(grid){const n=grid.children.length+1;const card=document.createElement('article');card.className='condition-card selected';card.innerHTML=`<header><div><h3>Condition ${String.fromCharCode(64+n)}</h3><p>New condition</p></div><span class="badge">3 samples</span></header><dl class="key-values"><div><dt>Spin speed</dt><dd>1500 rpm</dd></div><div><dt>Duration</dt><dd>30 s</dd></div><div><dt>Antisolvent</dt><dd>Not set</dd></div><div><dt>Annealing</dt><dd>100 °C · 30 min</dd></div></dl>`;grid.append(card);}}
    if(action==='catalog-add'||action==='catalog-add-batch'||action==='catalog-import') toast('Catalogue demo','info','A backend form or importer will be connected here later.');
    if(action==='workspace-compare'){const tab=$('[data-tab="comparisons"]');if(tab)activateTab(tab);toast('Comparison ready','success','Selected samples are plotted locally.');}
    if(button.matches('[data-tool]')) { $$('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));$$('[data-tool-panel]').forEach(p=>p.hidden=p.dataset.toolPanel!==button.dataset.tool);if(button.dataset.tool==='charts')renderChartBuilder();if(button.dataset.tool==='graphs')renderGraphEditor(); }
    if(action==='code-load')$('#codeFileInput')?.click();
    if(action==='code-validate')validateCode();
    if(action==='code-download')X.download($('#codeInput')?.value||'','text/plain',`labflow.${$('#codeMode')?.value==='text'?'txt':$('#codeMode')?.value}`);
    if(action==='markdown-load')$('#markdownFileInput')?.click();
    if(action==='markdown-download')X.download($('#markdownInput')?.value||'','text/markdown','labflow-note.md');
    if(button.matches('[data-markdown]')){const input=$('#markdownInput');if(input){const type=button.dataset.markdown,start=input.selectionStart,end=input.selectionEnd,text=input.value.slice(start,end)||'text';const insert=type==='bold'?`**${text}**`:type==='heading'?`## ${text}`:`| Field | Value |\n|---|---|\n| Item | ${text} |`;input.setRangeText(insert,start,end,'end');syncMarkdown();}}
    if(action==='sheet-select'){workbook.active=Number(button.dataset.index);renderWorkbook();}
    if(action==='sheet-add'){workbook.sheets.push({name:`Sheet ${workbook.sheets.length+1}`,rows:[['Column A','Column B'],['','']]});workbook.active=workbook.sheets.length-1;renderWorkbook();}
    if(action==='sheet-rename'){const s=workbook.sheets[workbook.active],name=prompt('Sheet name',s.name)?.trim();if(name){s.name=name.slice(0,31);renderWorkbook();}}
    if(action==='sheet-delete'){if(workbook.sheets.length>1){workbook.sheets.splice(workbook.active,1);workbook.active=Math.max(0,workbook.active-1);renderWorkbook();}}
    if(action==='sheet-row'){const s=workbook.sheets[workbook.active];s.rows.push(Array(normaliseSheet(s)).fill(''));renderWorkbook();}
    if(action==='sheet-col'){const s=workbook.sheets[workbook.active];s.rows.forEach(r=>r.push(''));renderWorkbook();}
    if(action==='workbook-export'){X.download(X.buildXlsx(workbookSheets()),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','labflow-workbook.xlsx');toast('Workbook exported','success',`${workbook.sheets.length} sheets generated.`);}
    if(action==='image-open')$('#imageInput')?.click();
    if(action==='image-select'){imageState.selected=button.dataset.id;renderImages();}
    if(action==='image-left'){imageState.rotation-=90;drawImage();}
    if(action==='image-right'){imageState.rotation+=90;drawImage();}
    if(action==='image-flip'){imageState.flip*=-1;drawImage();}
    if(action==='image-reset'){Object.assign(imageState,{rotation:0,flip:1,brightness:100,gray:false});$('#imageBrightness').value=100;$('#imageGray').checked=false;drawImage();}
    if(action==='image-export')$('#imageCanvas')?.toBlob(blob=>X.download(blob,'image/png','labflow-image.png'));
    if(action==='chart-row'){chartState.rows.push([`Group ${chartState.rows.length+1}`,0,0]);renderChartBuilder();}
    if(action==='chart-remove'){chartState.rows.splice(Number(button.dataset.index),1);renderChartBuilder();}
    if(action==='chart-svg')X.download($('#chartPreview svg')?.outerHTML||'','image/svg+xml','labflow-chart.svg');
    if(action==='chart-png'){const svg=$('#chartPreview svg');if(svg){const blob=new Blob([svg.outerHTML],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=1200;c.height=700;c.getContext('2d').drawImage(img,0,0,1200,700);c.toBlob(b=>X.download(b,'image/png','labflow-chart.png'));URL.revokeObjectURL(url)};img.src=url;}}
    if(action==='graph-reset'){const preset=$('#graphPreset')?.value||'experiment';if($('#graphSource'))$('#graphSource').value=graphPresets[preset];if($('#graphDirection'))$('#graphDirection').value=parseGraphDsl(graphPresets[preset]).direction;graphEditorState.selected=null;renderGraphEditor();}
    if(action==='graph-add-node'){const label=$('#graphNodeLabel')?.value.trim();if(label&&$('#graphSource')){const id=graphSafeId(label);$('#graphSource').value+=`\n${id}[${label}]`;$('#graphNodeLabel').value='';renderGraphEditor();}}
    if(action==='graph-add-edge'){const from=$('#graphEdgeFrom')?.value,to=$('#graphEdgeTo')?.value,label=$('#graphEdgeLabel')?.value.trim();if(from&&to&&$('#graphSource')){$('#graphSource').value+=`\n${from} --> ${to}${label?` : ${label}`:''}`;$('#graphEdgeLabel').value='';renderGraphEditor();}}
    if(action==='graph-svg')X.download($('#graphPreview svg')?.outerHTML||'','image/svg+xml','labflow-graph.svg');
    if(action==='graph-png')exportSvgAsPng($('#graphPreview svg'),'labflow-graph.png');
    if(action==='export-toggle-all'){const boxes=$$('[data-export-part]'),next=boxes.some(b=>b.checked);boxes.forEach(b=>b.checked=!next);button.textContent=next?'Select all':'Clear all';}
    if(action==='export-json')X.download(JSON.stringify(selectedExport(),null,2),'application/json','labflow-domain-graph.json');
    if(action==='export-csv')X.download(exportCsv(),'text/csv','labflow-domain-graph.csv');
    if(action==='export-xlsx')X.download(X.buildXlsx(exportSheets()),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','labflow-domain-graph.xlsx');
    if(action==='export-yaml')X.download(toYaml(selectedExport()),'text/yaml','labflow-domain-graph.yaml');
    if(action==='nomad-yaml')X.download(nomadArchive(),'text/yaml','experiment.archive.yaml');
    if(action==='nomad-zip')X.download(buildNomadZip(),'application/zip','labflow-nomad-package.zip');
    if(action==='nomad-script'){$('#nomadConsole').textContent=`curl -X POST "${$('#nomadUrl').value}/uploads" \\\n  -H "Authorization: Bearer <TOKEN>" \\\n  -F "file=@labflow-nomad-package.zip" \\\n  -F "upload_name=${$('#nomadUploadName').value}"\n\n# Flask backend: use requests with the same multipart form.`;}
    if(action==='nomad-upload-demo'){$('#nomadConsole').textContent='POC safety mode: no request sent. Connect this explicit action to Flask or enable a trusted NOMAD endpoint later.';toast('Upload not sent','warning','The static POC intentionally avoids automatic network requests.');}
    if(action==='preset-use'){toast('Preset added to your Library','success','A personal reference is ready for the next experiment.');}
    if(action==='process-preset'){$$('.template-preset').forEach(x=>x.classList.toggle('selected',x===button));const names={baseline:'PSC baseline',film:'Film screening',flex:'Flexible p-i-n'};$$('.process-name').forEach(x=>x.textContent=names[button.dataset.processPreset]||'Process template');toast('Starter selected','success','The process builder now uses a personal editable copy.');}
    if(action==='experiment-template'){$$('.setup-choice-card').forEach(x=>x.classList.toggle('selected',x===button));if(button.dataset.template==='custom'){location.href='pipeline.html';return;}showWizardStep(1);toast('Experiment setup selected','success','Substrate, solution, stack, process and measurements are now prefilled.');}
    if(action==='experiment-add-group'){const root=$('#experimentLanes');if(root){const code=String.fromCharCode(65+root.children.length);const item=document.createElement('article');item.className='condition-visual-card';item.innerHTML=`<span class="condition-code">${code}</span><div><small>New condition</small><strong>Set value</strong></div><div class="sample-dots labeled"><span>${code}01</span><span>${code}02</span><span>${code}03</span></div>`;root.append(item);}}
    if(action==='add-stack-to-experiment'){const root=$('#experimentStackList');if(root&&!root.querySelector('.stack-card')){const card=document.createElement('article');card.className='stack-card panel';card.innerHTML=`<div class="stack-card-head"><strong>${escapeHtml(demoStack.name)}</strong><span class="badge info">${demoStack.id}</span></div><div class="mini-stack">${demoStack.layers.map(l=>`<span class="${l.type}">${escapeHtml(l.label.split(' ')[0])}</span>`).join('')}</div><div class="stack-card-meta"><span><b>${demoStack.layers.length}</b> layers</span><span><b>${demoStack.solutions.length}</b> solutions</span><span class="badge success">${demoStack.conditions.spinSpeed}</span></div>`;root.append(card);toast('Stack added','success',`${demoStack.name} linked to this experiment.`);}else{toast('Stack already added','info','Only one stack per experiment in this POC.');}}
    if(action==='add-pipeline-step'){const root=$('#pipelineSteps');if(root){const n=root.children.length+1;const step=document.createElement('div');step.className='pipeline-step';step.innerHTML=`<span class="pipeline-step-num">${n}</span><input class="input" placeholder="Describe this step" value="Step ${n}"><select class="input"><option>Operator</option><option>Automation</option><option>Measurement</option></select><button class="icon-button small" type="button" data-action="remove-pipeline-step">×</button>`;root.append(step);toast('Pipeline step added','success',`Step ${n} added to the workflow.`);}}
    if(action==='remove-pipeline-step'){button.closest('.pipeline-step')?.remove();const steps=$$('.pipeline-step');steps.forEach((s,i)=>s.querySelector('.pipeline-step-num').textContent=i+1);}
    if(action==='run-task'){button.classList.toggle('complete');button.classList.remove('active');const tasks=$$('.run-task'),done=tasks.filter(x=>x.classList.contains('complete')).length;const badge=$('#makeProgressBadge');if(badge)badge.textContent=`${done} / ${tasks.length}`;toast(button.classList.contains('complete')?'Step completed':'Step reopened',button.classList.contains('complete')?'success':'info',button.querySelector('strong')?.textContent||'Process step');}
    if(button.matches('[data-graph-node-id]')){graphEditorState.selected=button.dataset.graphNodeId;renderGraphEditor();}
    if(button.classList.contains('measurement-card'))button.classList.toggle('selected');
    if(action==='docs-print')window.print();
    if(button.matches('[data-doc]'))renderDocumentation(button.dataset.doc);
    if(action==='step-prev'){processStepState.step=Math.max(0,processStepState.step-1);renderProcessStepWizard();}
    if(action==='step-next'){processStepState.step=Math.min(1,processStepState.step+1);renderProcessStepWizard();}
    if(action==='step-complete'){completeProcessStep();}
    if(action==='report-section'){const fields=button.nextElementSibling;fields.hidden=!fields.hidden;button.lastElementChild.textContent=fields.hidden?'+':'−';}
    if(action==='report-add-condition'){reportData.conditions.push(['D','New condition','—','—','Draft']);renderReportArrays();renderReport();}
    if(action==='report-add-measurement'){reportData.measurements.push(['New technique','Target','Instrument','Context','Draft']);renderReportArrays();renderReport();}
    if(action==='report-add-action'){reportData.narrative.actions.push('New next action');renderReportArrays();renderReport();}
    if(action==='report-remove-row'){reportData[button.dataset.array].splice(Number(button.dataset.index),1);renderReportArrays();renderReport();}
    if(action==='report-remove-action'){reportData.narrative.actions.splice(Number(button.dataset.index),1);renderReportArrays();renderReport();}
    if(action==='report-reset'){Object.keys(reportData).forEach(k=>delete reportData[k]);Object.assign(reportData,JSON.parse(JSON.stringify(reportDefaults)));renderReportEditor();renderReport();toast('Report reset','success','Demo values restored.');}
    if(action==='report-json')X.download(JSON.stringify(reportData,null,2),'application/json','labflow-experiment-report.json');
    if(action==='report-csv')X.download(reportCsv(),'text/csv','labflow-experiment-report.csv');
    if(action==='report-xlsx')X.download(X.buildXlsx(reportSheets()),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','labflow-experiment-report.xlsx');
    if(action==='report-pdf'){toast('Building PDF','info','Rendering three clear A4 pages locally.');requestAnimationFrame(()=>{X.download(X.buildPdfFromCanvases(createReportPdfPages()),'application/pdf','labflow-experiment-report.pdf');toast('PDF exported','success','Three clear A4 pages generated from editable data, charts and images.');});}
  });

  document.addEventListener('input', event => {
    if(event.target.matches('[data-page-search]'))filterPage(event.target);
    if(event.target.id==='codeInput')updateCodeEditor();
    if(event.target.id==='codeMode'){const input=$('#codeInput');input.value=codeSamples[event.target.value];updateCodeEditor();}
    if(event.target.id==='markdownInput')syncMarkdown();
    if(event.target.matches('[data-ion-name],[data-ion-coeff]'))updateAbxFormula();
    if(event.target.matches('[data-sheet-cell]')){const r=+event.target.dataset.row,c=+event.target.dataset.col;workbook.sheets[workbook.active].rows[r][c]=event.target.textContent;selectCell(r,c);}
    if(event.target.id==='formulaInput'){const {row,col}=workbook.selected;workbook.sheets[workbook.active].rows[row][col]=event.target.value;const cell=$(`[data-sheet-cell][data-row="${row}"][data-col="${col}"]`);if(cell)cell.textContent=event.target.value;}
    if(event.target.id==='imageBrightness'){imageState.brightness=+event.target.value;drawImage();}
    if(event.target.id==='imageGray'){imageState.gray=event.target.checked;drawImage();}
    if(event.target.matches('[data-chart-cell]')){const r=+event.target.dataset.row,c=+event.target.dataset.col;chartState.rows[r][c]=c===0?event.target.value:+event.target.value||0;renderChartBuilder();}
    if(event.target.id==='chartType'||event.target.id==='chartTitle')renderChartBuilder();
    if(event.target.id==='graphSource')renderGraphEditor();
    if(event.target.id==='aiPrompt'){aiState.lastInput=aiInput(aiState.mode,event.target.value);const inp=$('#aiInputPreview');if(inp)inp.textContent=JSON.stringify(aiState.lastInput,null,2);}
    if(event.target.closest('[data-dynamic-chart]'))renderDynamicChart(event.target.closest('[data-dynamic-chart]'));
    if(event.target.id==='newProjectName')projectWizardState.name=event.target.value;
    if(event.target.id==='newProjectId')projectWizardState.id=event.target.value;
    if(event.target.id==='newProjectStatus')projectWizardState.status=event.target.value;
    if(event.target.id==='newProjectObjective')projectWizardState.objective=event.target.value;
    if(event.target.matches('[data-report-field]')){let value=event.target.value;if(typeof dataGet(event.target.dataset.reportField)==='number')value=Number(value)||0;dataSet(event.target.dataset.reportField,value);renderReport();}
    if(event.target.matches('[data-report-array]')){reportData[event.target.dataset.reportArray][+event.target.dataset.row][+event.target.dataset.col]=event.target.value;renderReport();}
    if(event.target.matches('[data-report-action]')){reportData.narrative.actions[+event.target.dataset.reportAction]=event.target.value;renderReport();}
    if(event.target.matches('[data-report-image-field]')){reportData.images[+event.target.dataset.index][event.target.dataset.reportImageField]=event.target.value;renderReport();}
  });
  document.addEventListener('change', event => {
    if(event.target.id==='graphPreset'){const preset=graphPresets[event.target.value]||graphPresets.experiment;if($('#graphSource'))$('#graphSource').value=preset;if($('#graphDirection'))$('#graphDirection').value=parseGraphDsl(preset).direction;graphEditorState.selected=null;renderGraphEditor();}
    if(event.target.id==='graphDirection'&&$('#graphSource')){const source=$('#graphSource').value;$('#graphSource').value=/^direction\s+(LR|TB)$/im.test(source)?source.replace(/^direction\s+(LR|TB)$/im,`direction ${event.target.value}`):`direction ${event.target.value}\n${source}`;renderGraphEditor();}
    if(event.target.id==='codeFileInput')readTextFile(event.target.files?.[0],$('#codeInput'));
    if(event.target.id==='markdownFileInput')readTextFile(event.target.files?.[0],$('#markdownInput'));
    if(event.target.id==='imageInput')addImages(event.target.files||[]);
    if(event.target.matches('[data-report-image-input]')){const file=event.target.files?.[0],index=+event.target.dataset.reportImageInput;if(file){const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{reportImageCache.set(index,img);reportData.images[index].filename=file.name;renderReportArrays();renderReport();toast('Report image updated','success',file.name);};img.src=String(reader.result);};reader.readAsDataURL(file);}}
  });
  document.addEventListener('pointerdown',event=>{const user=$('#userPopover'),project=$('#projectPopover');if(user&&!user.hidden&&!event.target.closest('#userPopover,.user-menu,[data-action="user-toggle"]'))user.hidden=true;if(project&&!project.hidden&&!event.target.closest('#projectPopover,.project-context-button,[data-action="project-toggle"]'))project.hidden=true;});
  document.addEventListener('focusin',event=>{if(event.target.matches('[data-sheet-cell]'))selectCell(+event.target.dataset.row,+event.target.dataset.col);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.body.classList.remove('sidebar-open');$$('.overlay:not([hidden]),.drawer:not([hidden])').forEach(closeOverlay);}});

  mountShell(); mountAIDrawer(); mountProcessStepWizard(); if(page==='exports')initReportImages(); if(page==='progetti'&&location.hash==='#new')setTimeout(openProjectWizard,0);
  let storedTheme = 'light'; try { storedTheme = localStorage.getItem('labflow-theme') || 'light'; } catch (_) {}
  setTheme(storedTheme);
  renderEntity(page==='flow'?'UserAccount':'IonDefinition'); renderDocumentation('overview');
  renderProcessInspector('composition');
  const hashToStep={choose:0,start:0,plan:1,setup:2,materials:2,process:2,work:2,run:2,results:2,review:3,finish:3};showWizardStep(hashToStep[location.hash.slice(1)]??0);showSetupWizardStep(0);
  updateAbxFormula(); renderAIPage(); renderDemoCharts(); renderDynamicCharts(); renderGraphContainers(); updateCodeEditor(); syncMarkdown(); renderWorkbook(); initDemoImage(); renderChartBuilder(); renderGraphEditor(); renderReportEditor(); renderReport();
  const initialTab=location.hash.slice(1);const tab=$(`[data-tab="${initialTab}"]`);if(tab)activateTab(tab);
});
