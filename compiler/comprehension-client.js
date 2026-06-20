/**
 * Comprehension Dashboard — Client Application Script
 *
 * The browser-side application that generateComprehensionHTML() in
 * comprehension.js embeds into the dashboard's <script> tag. This is a STATIC
 * template literal — it contains no server-side ${} interpolation. The only
 * dynamic value, `const D`, is injected by the generator immediately before
 * this script. Extracted from comprehension.js (was a single ~3.6k-line file)
 * to keep the server-side generator navigable.
 *
 * Contains: tab switching, persona / My-Lens (Pro) profile, the Govern,
 * Measure and Improve renderers, and the Understand-tab canvas graph with
 * keyboard accessibility.
 */

export const CLIENT_SCRIPT = `
// ── Helpers ──
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function safeInt(v){const n=parseInt(v,10);return isNaN(n)?0:n;}
function safePct(n,d){return d>0?Math.round(n/d*100):null;}

// ── Tab switching ──
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>{
    tabs.forEach(t=>{t.classList.remove('active');t.setAttribute('aria-selected','false');});
    panels.forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected','true');
    panels[i].classList.add('active');
    if(tab.id==='tab-understand') renderUnderstandGraph();
  });
});

// ── Profile state ──
// Loaded from D.initialPersona (seeded from .rune/dashboard-profile.json on generate).
// Also persisted to localStorage for instant UX within the same browser session.
const LS_KEY='rune_dashboard_profile';
// 'mylens' is only valid when Pro is available (D.hasPro is embedded server-side).
const VALID_PERSONAS=D.hasPro?['exec','compliance','eng','mylens']:['exec','compliance','eng'];
function clampPersona(v){
  return VALID_PERSONAS.includes(v)?v:(VALID_PERSONAS.includes(D.initialPersona)?D.initialPersona:'exec');
}
function loadProfile(){
  // Prefer localStorage (instant UX within session) over D.initialPersona.
  // Normalize shape on load: guard against missing/unknown fields from tampered storage.
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw){
      const p=JSON.parse(raw);
      return {
        persona:clampPersona(p?.persona),
        pinnedConcerns:Array.isArray(p?.pinnedConcerns)?p.pinnedConcerns:[],
      };
    }
  }catch{}
  return {persona:clampPersona(D.initialPersona),pinnedConcerns:Array.isArray(D.initialPinned)?D.initialPinned:[]};
}
function saveProfile(p){
  try{localStorage.setItem(LS_KEY,JSON.stringify(p));}catch{}
}
let currentProfile=loadProfile();

// ── Persona toggle ──
// Personas re-emphasize sections:
//   Exec       → scorecard + verdict prominent; raw tables de-emphasised
//   Compliance → compliance coverage + ledger first; details shown
//   Eng        → full detail including provenance + raw events
//   My Lens    → Pro-only; personal focus: cost, gates, skill-ROI
const PERSONA_LABELS={exec:'Exec',compliance:'Compliance',eng:'Eng',mylens:'My Lens'};
const PERSONA_DESCRIPTIONS={
  exec:'Scorecard and verdict at a glance.',
  compliance:'Compliance coverage and obligation ledger.',
  eng:'Full detail including raw events and provenance.',
  mylens:'Your personal leverage: cost, gates fired, and skill ROI.',
};

function applyPersona(persona){
  currentProfile={...currentProfile,persona};
  saveProfile(currentProfile);

  // Update button states
  document.querySelectorAll('.persona button').forEach(b=>{
    const active=b.dataset.persona===persona;
    b.classList.toggle('on',active);
    b.setAttribute('aria-pressed',active?'true':'false');
  });

  // My Lens: activate Govern tab panel directly (without re-triggering renderGovern),
  // then replace govern-content with My Lens curated view.
  if(persona==='mylens'){
    // Activate Govern tab visually without dispatching a click (which would call renderGovern)
    document.querySelectorAll('.tab').forEach(t=>{
      t.classList.remove('active');t.setAttribute('aria-selected','false');
    });
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    const governTab=document.getElementById('tab-govern');
    const governPanel=document.getElementById('panel-govern');
    if(governTab){governTab.classList.add('active');governTab.setAttribute('aria-selected','true');}
    if(governPanel){governPanel.classList.add('active');}
    // Replace govern-content with My Lens view
    const container=document.getElementById('govern-content');
    if(container){container.innerHTML='';renderMyLens();}
    return;
  }

  // Switching away from mylens → restore govern-content to upsell or full govern
  const container=document.getElementById('govern-content');
  if(container && container.querySelector('.mylens-header')){
    // My Lens was showing — replace with standard govern view
    container.innerHTML='';
    renderGovern();
  }

  // Section visibility/order — use data-persona-hide attribute
  // Exec: hide raw tables (.govern-eng-only), show scorecard first
  // Compliance: show coverage first (.govern-compliance-first reorder)
  // Eng: show everything
  document.querySelectorAll('[data-exec-hide]').forEach(el=>{
    el.style.display=persona==='exec'?'none':'';
  });
  document.querySelectorAll('[data-eng-only]').forEach(el=>{
    el.style.display=persona==='eng'?'':'none';
  });
  document.querySelectorAll('[data-compliance-priority]').forEach(el=>{
    el.style.order=persona==='compliance'?'-1':'0';
  });

  // Update profile status label
  const statusEl=document.getElementById('profile-status-label');
  if(statusEl)statusEl.textContent=PERSONA_DESCRIPTIONS[persona]||'';
}

document.querySelectorAll('.persona button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    applyPersona(btn.dataset.persona||'exec');
  });
});

// ── Count-up animation ──
function countUp(el,target,suffix,decimals,duration){
  if(!Number.isFinite(target))return; // guard: never write NaN or Infinity
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){
    el.textContent=target.toFixed(decimals)+suffix;return;
  }
  const steps=50,interval=Math.min(duration/steps,20);
  let cur=0;
  const inc=target/steps;
  const t=setInterval(()=>{
    cur+=inc;
    if(cur>=target){cur=target;clearInterval(t);}
    el.textContent=cur.toFixed(decimals)+suffix;
  },interval);
}

// ── Verdict score count-up ──
window.addEventListener('load',()=>{
  const scoreNum=document.getElementById('score-num');
  if(scoreNum && D.verdictScore!=null){
    countUp(scoreNum,D.verdictScore,'',0,800);
  }
  const gatesEl=document.getElementById('kpi-gates');
  const gatesTarget=D.gates ? D.gates.reduce((s,g)=>s+(g.fired||0),0) : 0;
  if(gatesEl && gatesTarget>0) countUp(gatesEl,gatesTarget,'',0,600);

  const compEl=document.getElementById('compliance-num');
  if(compEl && D.compliance && D.compliance.length>0){
    const met=D.compliance.filter(c=>c.status==='met').length;
    const pct=safePct(met,D.compliance.length);
    if(pct!==null) countUp(compEl,pct,'',0,600);
  }

  const skillsNum=document.getElementById('skills-num');
  if(skillsNum && D.skillFrequency && D.skillFrequency.length>0){
    countUp(skillsNum,D.skillFrequency.length,'',0,600);
  }
});

// ── Govern tab (Phase 3 / Phase 5b) ──
function renderGovern(){
  const container=document.getElementById('govern-content');
  if(!container)return;

  // Phase 5b — tier gate: Govern is a Business feature.
  // Free and Pro tiers see an honest upsell instead of fabricated data.
  if(!D.hasBusiness){
    const upsell=document.createElement('div');
    upsell.className='tier-upsell';
    upsell.setAttribute('aria-label','Govern tab — Business tier feature');

    const icon=document.createElement('div');
    icon.className='upsell-icon';
    icon.setAttribute('aria-hidden','true');
    icon.innerHTML='&#x1F5C2;'; // 🗂

    const title=document.createElement('h3');
    title.textContent='Govern — compliance, gate ledger, and decision provenance';

    const desc=document.createElement('p');
    desc.className='upsell-desc';
    desc.textContent='The Govern tab tracks your compliance obligations, shows which quality gates fired and blocked, and maps output decisions back through their signal chain. This is a Rune Business feature.';

    const features=document.createElement('ul');
    features.className='upsell-features';
    features.setAttribute('aria-label','Govern features included in Business tier');
    const featureList=[
      {icon:'&#x2705;','text':'Compliance coverage map — obligations met, gap, unknown per pack'},
      {icon:'&#x1F6AB;','text':'Gate ledger — sentinel, preflight, completion-gate fire + block counts'},
      {icon:'&#x1F50D;','text':'Decision provenance — output ↦ signal chain ↦ gate ↦ model ↦ cost'},
      {icon:'&#x1F4C8;','text':'Governance scorecard — compliance %, blocks caught, cost per feature'},
    ];
    for(const f of featureList){
      const li=document.createElement('li');
      li.className='upsell-feature';
      const fi=document.createElement('span');
      fi.className='upsell-feature-icon';
      fi.setAttribute('aria-hidden','true');
      fi.innerHTML=f.icon;
      const ft=document.createElement('span');
      ft.textContent=f.text;
      li.appendChild(fi);
      li.appendChild(ft);
      features.appendChild(li);
    }

    const how=document.createElement('p');
    how.className='upsell-how';
    // Note: no external URLs here — dashboard is 100% local, no CDN or tracking.
    how.innerHTML=
      'To unlock Govern, set <code>RUNE_BUSINESS_ROOT</code> to your Rune Business directory and regenerate: <code>rune dashboard</code>. '
      +'Business tier ($149 lifetime) includes finance, legal, HR, and enterprise-search packs. '
      +'Available at <code>github.com/sponsors/rune-kit</code>.';

    upsell.appendChild(icon);
    upsell.appendChild(title);
    upsell.appendChild(desc);
    upsell.appendChild(features);
    upsell.appendChild(how);
    container.appendChild(upsell);
    return; // ← early return: no fabricated govern panels
  }

  const gates=D.gates||[];
  const compliance=D.compliance||[];
  const decisions=D.decisions||[];
  const totalBlocks=gates.reduce((s,g)=>s+(g.blocked||0),0);
  const totalFired=gates.reduce((s,g)=>s+(g.fired||0),0);
  const met=compliance.filter(c=>c.status==='met').length;
  const compliancePct=compliance.length>0?Math.round(met/compliance.length*100):null;

  // ── Profile bar ──
  const profileBar=document.createElement('div');
  profileBar.className='profile-bar';
  profileBar.setAttribute('aria-label','Profile actions');
  const profileStatus=document.createElement('span');
  profileStatus.id='profile-status-label';
  profileStatus.className='profile-status';
  profileStatus.textContent='';
  const exportBtn=document.createElement('button');
  exportBtn.textContent='Export profile';
  exportBtn.setAttribute('aria-label','Download dashboard profile JSON');
  exportBtn.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(currentProfile,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='dashboard-profile.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  profileBar.appendChild(profileStatus);
  profileBar.appendChild(exportBtn);
  container.appendChild(profileBar);

  // ── Govern sections wrapper (flex col for persona ordering) ──
  const sections=document.createElement('div');
  sections.className='govern-sections';
  container.appendChild(sections);

  // ── 1. Scorecard row ── (visible to all personas, prominent for Exec)
  const scorecard=document.createElement('div');
  scorecard.className='govern-scorecard';
  scorecard.setAttribute('aria-label','Governance scorecard');

  function kpiCell(label,val,sub,subClass){
    const d=document.createElement('div');
    d.className='kpi';
    d.innerHTML=
      '<div class="k-lbl">'+esc(label)+'</div>'+
      '<div class="k-val" style="font-size:22px">'+esc(String(val==null?'—':val))+'</div>'+
      (sub?'<div class="k-sub'+(subClass?' '+subClass:'')+'">'+esc(sub)+'</div>':'');
    return d;
  }

  scorecard.appendChild(kpiCell(
    'Compliance',
    compliancePct!==null?compliancePct+'%':'—',
    compliance.length>0?met+'/'+compliance.length+' obligations met':'no obligations captured',
    met>0?'up':'',
  ));
  scorecard.appendChild(kpiCell(
    'Gates fired',
    totalFired>0?totalFired:'—',
    totalFired>0?gates.length+' gate'+(gates.length!==1?'s':'')+' active':'no gates yet',
    totalFired>0?'up':'',
  ));
  scorecard.appendChild(kpiCell(
    'Blocks caught',
    totalBlocks>0?totalBlocks:'—',
    totalBlocks>0?'real block events captured':'not captured yet',
    totalBlocks>0?'warn':'',
  ));
  scorecard.appendChild(kpiCell(
    'Cost / feature',
    '—',
    'not captured yet',
    '',
  ));
  sections.appendChild(scorecard);

  // ── 2. Two-column: Gate ledger (left) + Compliance coverage map (right) ──
  const twoCol=document.createElement('div');
  twoCol.className='govern-3col';
  twoCol.setAttribute('data-compliance-priority','1'); // Compliance persona pulls this first
  sections.appendChild(twoCol);

  // ── 2a. Gate ledger ──
  const ledgerWrap=document.createElement('div');
  ledgerWrap.setAttribute('data-exec-hide','1'); // Exec hides raw ledger to show scorecard only
  twoCol.appendChild(ledgerWrap);

  const ledgerPanel=document.createElement('div');
  ledgerPanel.className='panel';
  ledgerWrap.appendChild(ledgerPanel);

  const ledgerTitle=document.createElement('h3');
  ledgerTitle.innerHTML='Governance Ledger <span class="pill">gate audit</span>';
  ledgerPanel.appendChild(ledgerTitle);

  if(gates.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='30px 10px';
    empty.innerHTML='<h4>No gates recorded yet</h4><p>Run Rune skills (sentinel, preflight, completion-gate, etc.) to start capturing gate fire events.</p>';
    ledgerPanel.appendChild(empty);
  } else {
    const tbl=document.createElement('table');
    tbl.setAttribute('aria-label','Governance gate ledger');
    tbl.innerHTML=
      '<thead><tr>'+
        '<th>Gate</th>'+
        '<th>Fired</th>'+
        '<th>Blocked</th>'+
        '<th>Passed / Bypassed</th>'+
        '<th>Last event</th>'+
      '</tr></thead>';
    const tbody=document.createElement('tbody');
    for(const g of gates){
      const tr=document.createElement('tr');
      const tsLabel=g.ts?new Date(g.ts).toLocaleDateString():'—';
      const blocked=safeInt(g.blocked);
      // passed/bypassed remain uncaptured (GAP-1 Phase 3 — honest label)
      const passedLabel='not captured';
      const blockedCell=blocked>0
        ?'<span class="blocks-badge" aria-label="'+blocked+' block'+(blocked!==1?'s':'')+' caught">&#x26A0; '+blocked+'</span>'
        :'<span style="color:var(--text-tertiary);font-size:11px">—</span>';
      tr.innerHTML=
        '<td class="mono">'+esc(g.name)+'</td>'+
        '<td class="mono">'+safeInt(g.fired)+'</td>'+
        '<td>'+blockedCell+'</td>'+
        '<td style="color:var(--text-tertiary);font-size:11px">'+esc(passedLabel)+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(tsLabel)+'</td>';
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    ledgerPanel.appendChild(tbl);

    // Blocked events detail (Eng persona only) — read from gate-outcomes embedded in gate data
    const blockedGates=gates.filter(g=>(g.blocked||0)>0);
    if(blockedGates.length>0){
      const detail=document.createElement('details');
      detail.className='blocked-events';
      detail.setAttribute('data-eng-only','1');
      const sum=document.createElement('summary');
      sum.textContent='Raw block events ('+totalBlocks+' total) — Eng view';
      detail.appendChild(sum);
      const mini=document.createElement('table');
      mini.setAttribute('aria-label','Raw block events');
      mini.innerHTML='<thead><tr><th>Gate</th><th>Blocks captured</th><th>Most recent</th></tr></thead>';
      const mb=document.createElement('tbody');
      for(const g of blockedGates){
        const mr=document.createElement('tr');
        mr.innerHTML=
          '<td class="mono" style="font-size:11px">'+esc(g.name)+'</td>'+
          '<td class="mono" style="font-size:11px">'+safeInt(g.blocked)+'</td>'+
          '<td style="font-size:11px;color:var(--text-tertiary)">'+esc(g.ts?new Date(g.ts).toLocaleString():'—')+'</td>';
        mb.appendChild(mr);
      }
      mini.appendChild(mb);
      detail.appendChild(mini);
      ledgerPanel.appendChild(detail);
    }
  }

  // ── 2b. Compliance coverage map ──
  const compWrap=document.createElement('div');
  twoCol.appendChild(compWrap);

  const compPanel=document.createElement('div');
  compPanel.className='panel';
  compWrap.appendChild(compPanel);

  const compTitle=document.createElement('h3');
  compTitle.innerHTML='Compliance Coverage <span class="pill">obligations</span>';
  compPanel.appendChild(compTitle);

  if(compliance.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='30px 10px';
    empty.innerHTML='<h4>No obligations captured</h4><p>Business pack PACK.md Constraints + Done-When sections declare obligations. Install Rune Business to see them here.</p>';
    compPanel.appendChild(empty);
  } else {
    // Group by pack
    const byPack=new Map();
    for(const c of compliance){
      if(!byPack.has(c.pack))byPack.set(c.pack,[]);
      byPack.get(c.pack).push(c);
    }

    // Pin controls
    const pinBar=document.createElement('div');
    pinBar.style.cssText='margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;';
    const pinLabel=document.createElement('span');
    pinLabel.style.cssText='font-size:11px;color:var(--text-tertiary);flex-shrink:0;';
    pinLabel.textContent='Pin pack:';
    pinBar.appendChild(pinLabel);
    for(const pk of byPack.keys()){
      const chip=document.createElement('button');
      chip.style.cssText='font:500 10px var(--font-mono);padding:2px 8px;border-radius:var(--r-pill);cursor:pointer;transition:all var(--t-fast);';
      chip.textContent=pk.split('/').pop()||pk;
      chip.title='Pin/unpin: '+pk;
      chip.setAttribute('aria-label','Pin pack '+pk);
      chip.setAttribute('aria-pressed',currentProfile.pinnedConcerns.includes(pk)?'true':'false');
      chip.style.border=currentProfile.pinnedConcerns.includes(pk)?'1px solid var(--accent)':'1px solid var(--border-strong)';
      chip.style.background=currentProfile.pinnedConcerns.includes(pk)?'rgba(45,212,191,.10)':'transparent';
      chip.style.color=currentProfile.pinnedConcerns.includes(pk)?'var(--accent)':'var(--text-secondary)';
      chip.addEventListener('click',()=>{
        const pinned=currentProfile.pinnedConcerns;
        const idx=pinned.indexOf(pk);
        const newPinned=idx>=0?pinned.filter(p=>p!==pk):[...pinned,pk];
        currentProfile={...currentProfile,pinnedConcerns:newPinned};
        saveProfile(currentProfile);
        // Re-render govern to reflect new pin state
        container.innerHTML='';
        renderGovern();
      });
      pinBar.appendChild(chip);
    }
    compPanel.appendChild(pinBar);

    // Coverage map: pinned packs first
    const sortedPacks=[...byPack.keys()].sort((a,b)=>{
      const aPin=currentProfile.pinnedConcerns.includes(a)?0:1;
      const bPin=currentProfile.pinnedConcerns.includes(b)?0:1;
      return aPin-bPin||a.localeCompare(b);
    });

    const covList=document.createElement('div');
    covList.setAttribute('aria-label','Compliance coverage by pack');
    for(const pk of sortedPacks){
      const items=byPack.get(pk);
      const pkMet=items.filter(c=>c.status==='met').length;
      const pkUnknown=items.filter(c=>c.status==='unknown').length;
      const pkGap=items.filter(c=>c.status==='gap'||c.status==='partial').length;
      const isPinned=currentProfile.pinnedConcerns.includes(pk);

      const packDiv=document.createElement('div');
      packDiv.className='cov-pack'+(isPinned?' pinned':'');

      // Pack header with bar
      const hdr=document.createElement('div');
      hdr.className='cov-pack-header';
      const nameSpan=document.createElement('span');
      nameSpan.className='cov-pack-name';
      nameSpan.title=pk;
      nameSpan.textContent=pk;
      const pctSpan=document.createElement('span');
      const pctVal=items.length>0?Math.round(pkMet/items.length*100):0;
      // Status pill for the pack: color+icon+text (never color-only per design system)
      let pkStClass='info',pkStIcon='?',pkStText='unknown';
      if(pkMet===items.length&&items.length>0){pkStClass='pass';pkStIcon='&#10003;';pkStText='all met';}
      else if(pkGap>0){pkStClass='fail';pkStIcon='&#10005;';pkStText=pkGap+' gap'+(pkGap!==1?'s':'');}
      else if(pkMet>0){pkStClass='warn';pkStIcon='&#9651;';pkStText=pkMet+'/'+items.length+' met';}
      pctSpan.innerHTML='<span class="st '+pkStClass+'" aria-label="Pack status: '+pkStText+'">'+pkStIcon+' '+esc(pkStText)+'</span>';
      hdr.appendChild(nameSpan);
      hdr.appendChild(pctSpan);
      packDiv.appendChild(hdr);

      // Coverage bar
      const barTrack=document.createElement('div');
      barTrack.className='cov-bar-track';
      barTrack.setAttribute('role','progressbar');
      barTrack.setAttribute('aria-valuenow',String(pctVal));
      barTrack.setAttribute('aria-valuemin','0');
      barTrack.setAttribute('aria-valuemax','100');
      barTrack.setAttribute('aria-label',pctVal+'% obligations met for '+pk);
      const barFill=document.createElement('div');
      barFill.className='cov-bar-fill';
      barFill.style.width=pctVal+'%';
      barFill.style.background=pkMet===items.length&&items.length>0?'var(--pass)':pkGap>0?'var(--fail)':'var(--warn)';
      barTrack.appendChild(barFill);
      packDiv.appendChild(barTrack);

      // Items (Compliance+Eng see all; Exec sees pack-level summary only)
      const itemsDiv=document.createElement('div');
      itemsDiv.className='cov-items';
      itemsDiv.setAttribute('data-exec-hide','1');
      for(const c of items){
        const row=document.createElement('div');
        row.className='cov-item';
        let stClass='info',stIcon='?',stText=c.status;
        if(c.status==='met'){stClass='pass';stIcon='&#10003;';stText='met';}
        else if(c.status==='gap'){stClass='fail';stIcon='&#10005;';stText='gap';}
        else if(c.status==='partial'){stClass='warn';stIcon='&#9651;';stText='partial';}
        else{stClass='info';stIcon='&#8253;';stText='not verified';}
        row.innerHTML=
          '<span class="st '+stClass+'" aria-label="Status: '+esc(stText)+'" style="flex-shrink:0;margin-top:1px">'+stIcon+'</span>'+
          '<span class="cov-item-text">'+esc(c.obligation)+'</span>';
        itemsDiv.appendChild(row);
      }
      packDiv.appendChild(itemsDiv);
      covList.appendChild(packDiv);
    }
    compPanel.appendChild(covList);
  }

  // ── 3. Decision Provenance ──
  const provPanel=document.createElement('div');
  provPanel.className='panel govern-provenance';
  provPanel.setAttribute('data-eng-only','1'); // Exec/Compliance: hide raw provenance
  const provTitle=document.createElement('h3');
  provTitle.innerHTML='Decision Provenance <span class="pill">trace</span>';
  provPanel.appendChild(provTitle);

  if(decisions.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='30px 10px';
    empty.innerHTML=
      '<h4>No decision provenance captured yet</h4>'+
      '<p>Future: a journal/ADR hook or <code>xlabs_log_decision</code> integration will populate this trace. Each entry maps an output (commit/file) back through its signal chain &#x2192; gate &#x2192; model &#x2192; cost.</p>';
    provPanel.appendChild(empty);
  } else {
    const tbl=document.createElement('table');
    tbl.setAttribute('aria-label','Decision provenance trace');
    tbl.innerHTML=
      '<thead><tr>'+
        '<th>Output</th>'+
        '<th>Signal chain</th>'+
        '<th>Gate</th>'+
        '<th>Model</th>'+
        '<th>Cost (USD)</th>'+
        '<th>When</th>'+
      '</tr></thead>';
    const tbody=document.createElement('tbody');
    for(const dec of decisions){
      const tr=document.createElement('tr');
      const chain=Array.isArray(dec.signal_chain)?dec.signal_chain.map(s=>esc(s)).join(' &#x2192; '):'—';
      const cost=typeof dec.cost==='number'?'$'+dec.cost.toFixed(4):'—';
      const ts=dec.ts?new Date(dec.ts).toLocaleDateString():'—';
      tr.innerHTML=
        '<td class="mono" style="font-size:11px">'+esc(dec.output||'—')+'</td>'+
        '<td style="font-size:10px;color:var(--accent)">'+chain+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(dec.gate||'—')+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(dec.model||'—')+'</td>'+
        '<td class="mono" style="font-size:11px">'+esc(cost)+'</td>'+
        '<td style="font-size:11px;color:var(--text-tertiary)">'+esc(ts)+'</td>';
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    provPanel.appendChild(tbl);
  }
  sections.appendChild(provPanel);

  // Apply initial persona
  applyPersona(currentProfile.persona);
}

// ── My Lens (Pro-only persona) ──
// Renders into #govern-content when the "My Lens" persona is selected.
// Shows only: cost KPIs, gates fired + blocks, skill-ROI (active/dormant).
// Data is the SAME real data as other tabs — just curated for personal leverage.
// XSS: all user data interpolated via esc(); no innerHTML of raw D values.
function renderMyLens(){
  const container=document.getElementById('govern-content');
  if(!container)return;

  const gates=D.gates||[];
  const freq=D.skillFrequency||[];
  const ov=D.overview||{};
  const totalInstalled=D.totalInstalledSkills||63;
  const totalFired=gates.reduce((s,g)=>s+(g.fired||0),0);
  const totalBlocks=gates.reduce((s,g)=>s+(g.blocked||0),0);
  const activeSkills=freq.length;
  const dormantCount=Math.max(0,totalInstalled-activeSkills);

  // Header
  const hdr=document.createElement('div');
  hdr.className='mylens-header';
  const badge=document.createElement('span');
  badge.className='mylens-badge';
  badge.setAttribute('aria-label','Pro feature');
  badge.textContent='Pro';
  const title=document.createElement('span');
  title.className='mylens-title';
  title.textContent='My Lens';
  const sub=document.createElement('span');
  sub.className='mylens-sub';
  sub.textContent='Personal leverage focus';
  hdr.appendChild(badge);
  hdr.appendChild(title);
  hdr.appendChild(sub);
  container.appendChild(hdr);

  // KPI row (3 cards: gates fired, blocks caught, skills active)
  const kpis=document.createElement('div');
  kpis.className='mylens-kpis';
  kpis.setAttribute('aria-label','Personal usage key metrics');

  function mkKpi(label,val,sub2,subCls){
    const d=document.createElement('div');
    d.className='kpi';
    d.innerHTML=
      '<div class="k-lbl">'+esc(label)+'</div>'+
      '<div class="k-val" style="font-size:24px">'+esc(String(val==null?'—':val))+'</div>'+
      (sub2?'<div class="k-sub'+(subCls?' '+subCls:'')+'">'+esc(sub2)+'</div>':'');
    return d;
  }

  kpis.appendChild(mkKpi(
    'Gates fired',
    totalFired>0?totalFired:'—',
    totalFired>0?gates.length+' gate'+(gates.length!==1?'s':'')+' active':'no gates yet',
    totalFired>0?'up':'',
  ));
  kpis.appendChild(mkKpi(
    'Blocks caught',
    totalBlocks>0?totalBlocks:'—',
    totalBlocks>0?'real policy violations blocked':'none recorded yet',
    totalBlocks>0?'warn':'',
  ));
  kpis.appendChild(mkKpi(
    'Skills active',
    activeSkills>0?activeSkills+'/'+totalInstalled:'—',
    activeSkills>0?(dormantCount+' dormant in last '+(D.window_days||30)+'d'):'run skills to track',
    activeSkills>0?(dormantCount>0?'warn':'up'):'',
  ));
  container.appendChild(kpis);

  // Skill ROI — top used + dormant (reuse Measure-tab data)
  if(freq.length>0){
    const roiPanel=document.createElement('div');
    roiPanel.className='panel section';
    roiPanel.setAttribute('aria-label','Skill ROI — active and dormant');
    roiPanel.innerHTML='<h3>Skill ROI <span class="pill">your window</span></h3>';

    // All-known list (same as renderMeasure)
    const allKnown=['cook','plan','scout','brainstorm','design','skill-forge','debug','fix','test','review',
      'db','sentinel','preflight','onboard','deploy','marketing','perf','autopsy','safeguard','surgeon',
      'audit','incident','review-intake','logic-guardian','ba','docs','mcp-builder','adversary','retro',
      'graft','improve-architecture','research','docs-seeker','trend-scout','problem-solver',
      'sequential-thinking','verification','hallucination-guard','completion-gate','constraint-check',
      'sast','integrity-check','context-engine','context-pack','journal','session-bridge',
      'neural-memory','worktree','watchdog','scope-guard','browser-pilot','asset-creator',
      'video-creator','slides','dependency-doctor','git','doc-processor','sentinel-env',
      'team','launch','rescue','scaffold','skill-router'];
    const activeSet=new Set(freq.map(s=>s.skill));
    const dormantSamples=allKnown.filter(s=>!activeSet.has(s)).slice(0,6);

    const roi=document.createElement('div');
    roi.className='roi-grid';

    // Top active
    const topCard=document.createElement('div');
    topCard.className='roi-card';
    const topTitleEl=document.createElement('div');
    topTitleEl.className='roi-card-title';
    topTitleEl.textContent='Your top skills';
    topCard.appendChild(topTitleEl);
    const topChips=document.createElement('div');
    for(const s of freq.slice(0,6)){
      const chip=document.createElement('span');
      chip.className='roi-chip active';
      chip.setAttribute('aria-label',s.skill+': '+s.count+' sessions');
      chip.textContent=s.skill;
      topChips.appendChild(chip);
    }
    topCard.appendChild(topChips);

    // Dormant sample
    const dormCard=document.createElement('div');
    dormCard.className='roi-card';
    const dormTitleEl=document.createElement('div');
    dormTitleEl.className='roi-card-title';
    dormTitleEl.textContent=dormantCount>0?'Unused this period':'All skills active';
    dormCard.appendChild(dormTitleEl);
    const dormChips=document.createElement('div');
    for(const s of dormantSamples){
      const chip=document.createElement('span');
      chip.className='roi-chip dormant';
      chip.setAttribute('aria-label',s+': not used in window');
      chip.textContent=s;
      dormChips.appendChild(chip);
    }
    if(dormantCount>dormantSamples.length){
      const more=document.createElement('span');
      more.className='roi-chip dormant';
      more.style.fontStyle='italic';
      more.textContent='+'+(dormantCount-dormantSamples.length)+' more';
      dormChips.appendChild(more);
    }
    dormCard.appendChild(dormChips);

    roi.appendChild(topCard);
    roi.appendChild(dormCard);
    roiPanel.appendChild(roi);
    container.appendChild(roiPanel);
  } else {
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='24px 10px';
    empty.innerHTML='<h4>No session data yet</h4><p>Run Rune skills to start seeing your personal leverage data here.</p>';
    container.appendChild(empty);
  }

  // Cost / feature — honest placeholder (not captured)
  const costPanel=document.createElement('div');
  costPanel.className='panel section';
  costPanel.setAttribute('aria-label','Cost metrics');
  costPanel.innerHTML=
    '<h3>Cost / Feature <span class="pill">personal</span></h3>'+
    '<div class="empty" style="padding:18px 10px">'+
    '<h4>Not captured yet</h4>'+
    '<p>Per-feature cost tracking requires session-level cost data. Run sessions with Rune hooks to begin collecting.</p>'+
    '</div>';
  container.appendChild(costPanel);

  // Update profile status label
  const statusEl=document.getElementById('profile-status-label');
  if(statusEl)statusEl.textContent=PERSONA_DESCRIPTIONS.mylens||'';
}

// ── Measure tab (Phase 5a enrichment) ──
function renderMeasure(){
  const container=document.getElementById('measure-content');
  if(!container)return;

  // Canonical list of all Rune core skills — single source of truth for denominator.
  // D.totalInstalledSkills is the server-side embedding of ALL_KNOWN_SKILLS.length,
  // but we also keep the list here for dormant-sample filtering.
  const allKnownSkills=D.allCoreSkillNames||['cook','plan','scout','brainstorm','design','skill-forge','debug','fix','test','review',
    'db','sentinel','preflight','onboard','deploy','marketing','perf','autopsy','safeguard','surgeon',
    'audit','incident','review-intake','logic-guardian','ba','docs','mcp-builder','adversary','retro',
    'graft','improve-architecture','research','docs-seeker','trend-scout','problem-solver',
    'sequential-thinking','verification','hallucination-guard','completion-gate','constraint-check',
    'sast','integrity-check','context-engine','context-pack','journal','session-bridge',
    'neural-memory','worktree','watchdog','scope-guard','browser-pilot','asset-creator',
    'video-creator','slides','dependency-doctor','git','doc-processor','sentinel-env',
    'team','launch','rescue','scaffold','skill-router'];
  const totalInstalled=allKnownSkills.length; // single source of truth — never magic 64

  const freq=D.skillFrequency||[];
  const models=D.modelDistribution||[];
  const ov=D.overview||{};
  const heatmapData=D.skillHeatmap||{heatmap:[],dates:[],maxCount:1};
  const timeline=D.sessionTimeline||[];

  // ── Row 1: Top Skills (left) + Model Mix (right) ──
  const row1=document.createElement('div');
  row1.className='cols';

  // Left: top skills frequency bar
  const skillPanel=document.createElement('div');
  skillPanel.className='panel';
  skillPanel.innerHTML='<h3>Top Skills <span class="pill">frequency</span></h3>';

  if(freq.length===0){
    skillPanel.innerHTML+='<div class="empty" style="padding:24px 10px"><h4>No skill data yet</h4><p>Run Rune skills to start collecting frequency metrics.</p></div>';
  } else {
    const maxCount=freq[0].count||1;
    const barList=document.createElement('div');
    barList.style.marginTop='8px';
    barList.setAttribute('role','list');
    barList.setAttribute('aria-label','Top skills by frequency');
    for(const s of freq.slice(0,15)){
      const row=document.createElement('div');
      row.className='skill-bar-row';
      row.setAttribute('role','listitem');
      const pct=Math.max(4,Math.round((s.count/maxCount)*100));
      const nameEl=document.createElement('div');
      nameEl.className='skill-bar-name';
      nameEl.title=s.skill;
      nameEl.textContent=s.skill;
      const track=document.createElement('div');
      track.className='skill-bar-track';
      track.setAttribute('role','progressbar');
      track.setAttribute('aria-valuenow',String(s.count));
      track.setAttribute('aria-valuemax',String(maxCount));
      track.setAttribute('aria-label',s.skill+': '+s.count+' sessions');
      const fill=document.createElement('div');
      fill.className='skill-bar-fill';
      fill.style.width=pct+'%';
      track.appendChild(fill);
      const countEl=document.createElement('div');
      countEl.className='skill-bar-count';
      countEl.textContent=String(safeInt(s.count));
      row.appendChild(nameEl);row.appendChild(track);row.appendChild(countEl);
      barList.appendChild(row);
    }
    skillPanel.appendChild(barList);
  }

  // Right: model mix table + session overview
  const rightPanel=document.createElement('div');
  rightPanel.className='panel';
  rightPanel.innerHTML='<h3>Model Mix <span class="pill">usage</span></h3>';

  if(models.length===0&&!ov.total_sessions){
    rightPanel.innerHTML+='<div class="empty" style="padding:24px 10px"><h4>No analytics data yet</h4><p>Start sessions to populate model usage stats.</p></div>';
  } else {
    if(models.length>0){
      const tbl=document.createElement('table');
      tbl.setAttribute('aria-label','Model distribution');
      tbl.innerHTML='<thead><tr><th>Model</th><th style="text-align:right">Skill calls</th></tr></thead>';
      const tbody=document.createElement('tbody');
      const total=models.reduce((s,m)=>s+(m.skill_count||0),0)||1;
      for(const m of models){
        const tr=document.createElement('tr');
        const pct=total>0?Math.round((m.skill_count||0)/total*100):0;
        const modelCell=document.createElement('td');
        modelCell.className='mono';
        modelCell.textContent=m.model;
        const countCell=document.createElement('td');
        countCell.className='mono';
        countCell.style.textAlign='right';
        countCell.textContent=String(safeInt(m.skill_count))+' ('+pct+'%)';
        tr.appendChild(modelCell);tr.appendChild(countCell);
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      rightPanel.appendChild(tbl);
    }
    if(ov.total_sessions){
      const stats=document.createElement('div');
      stats.style.cssText='margin-top:14px;display:flex;flex-direction:column;gap:8px;';
      const items=[
        ['Sessions',ov.total_sessions],
        ['Avg duration',ov.avg_duration_min!=null?ov.avg_duration_min+' min':'—'],
        ['Total tool calls',ov.total_tool_calls||0],
        ['Skill invocations',ov.total_skill_invocations||0],
        ['Active days',ov.active_days||0],
      ];
      for(const [label,val] of items){
        const row=document.createElement('div');
        row.style.cssText='display:flex;justify-content:space-between;font-size:12px;';
        const lblEl=document.createElement('span');
        lblEl.style.color='var(--text-tertiary)';
        lblEl.textContent=label;
        const valEl=document.createElement('span');
        valEl.style.cssText='font-family:var(--font-mono);color:var(--text-primary);';
        valEl.textContent=String(val);
        row.appendChild(lblEl);row.appendChild(valEl);
        stats.appendChild(row);
      }
      rightPanel.appendChild(stats);
    }
  }

  row1.appendChild(skillPanel);
  row1.appendChild(rightPanel);
  container.appendChild(row1);

  // ── Row 2: Skill-ROI (used vs dormant) ──
  const roiSection=document.createElement('div');
  roiSection.className='section panel';
  roiSection.setAttribute('aria-label','Skill ROI — used versus dormant');
  const roiTitle=document.createElement('h3');
  roiTitle.innerHTML='Skill ROI <span class="pill">coverage</span>';
  roiSection.appendChild(roiTitle);

  const activeSkills=freq.length; // distinct skills invoked in window
  const dormantCount=Math.max(0,totalInstalled-activeSkills);

  if(freq.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='24px 10px';
    empty.innerHTML='<h4>No session data yet</h4><p>Run Rune skills to see which are active vs dormant in your window.</p>';
    roiSection.appendChild(empty);
  } else {
    const roiMeta=document.createElement('div');
    roiMeta.style.cssText='margin-bottom:12px;font-size:12px;color:var(--text-secondary);';
    const activeEl=document.createElement('span');
    activeEl.innerHTML='<b style="font-family:var(--font-mono);color:var(--pass)">'+activeSkills+'</b> of <b style="font-family:var(--font-mono)">'+totalInstalled+'</b> Rune core skills active this period &bull; ';
    const dormEl=document.createElement('span');
    dormEl.innerHTML='<b style="font-family:var(--font-mono);color:var(--text-tertiary)">'+dormantCount+'</b> dormant in the last '+safeInt(D.window_days||30)+' days';
    roiMeta.appendChild(activeEl);
    roiMeta.appendChild(dormEl);
    roiSection.appendChild(roiMeta);

    // Progress bar for ROI coverage
    const coveragePct=totalInstalled>0?Math.round(activeSkills/totalInstalled*100):0;
    const barWrap=document.createElement('div');
    barWrap.style.cssText='height:6px;background:var(--bg-elevated);border-radius:3px;margin-bottom:14px;overflow:hidden;';
    barWrap.setAttribute('role','progressbar');
    barWrap.setAttribute('aria-valuenow',String(coveragePct));
    barWrap.setAttribute('aria-valuemin','0');
    barWrap.setAttribute('aria-valuemax','100');
    barWrap.setAttribute('aria-label',coveragePct+'% of Rune core skills active this period');
    const barFill=document.createElement('div');
    barFill.style.cssText='height:100%;width:'+coveragePct+'%;border-radius:3px;background:var(--accent);';
    barWrap.appendChild(barFill);
    roiSection.appendChild(barWrap);

    const roiGrid=document.createElement('div');
    roiGrid.className='roi-grid';

    // Top used
    const topCard=document.createElement('div');
    topCard.className='roi-card';
    const topTitle=document.createElement('div');
    topTitle.className='roi-card-title';
    topTitle.textContent='Top active skills';
    topCard.appendChild(topTitle);
    const topChips=document.createElement('div');
    for(const s of freq.slice(0,8)){
      const chip=document.createElement('span');
      chip.className='roi-chip active';
      chip.setAttribute('aria-label',s.skill+': used '+s.count+' sessions');
      chip.textContent=s.skill;
      topChips.appendChild(chip);
    }
    topCard.appendChild(topChips);

    // Dormant (Rune core skills not invoked in this window)
    const activeSet=new Set(freq.map(s=>s.skill));
    const dormantSamples=allKnownSkills.filter(s=>!activeSet.has(s)).slice(0,8);

    const dormCard=document.createElement('div');
    dormCard.className='roi-card';
    const dormTitle=document.createElement('div');
    dormTitle.className='roi-card-title';
    dormTitle.textContent=dormantCount>0?'Dormant skills (sample)':'No dormant skills';
    dormCard.appendChild(dormTitle);
    if(dormantSamples.length>0){
      const dormChips=document.createElement('div');
      for(const s of dormantSamples){
        const chip=document.createElement('span');
        chip.className='roi-chip dormant';
        chip.setAttribute('aria-label',s+': not used in window');
        chip.textContent=s;
        dormChips.appendChild(chip);
      }
      if(dormantCount>dormantSamples.length){
        const more=document.createElement('span');
        more.className='roi-chip dormant';
        more.style.fontStyle='italic';
        more.textContent='+'+(dormantCount-dormantSamples.length)+' more';
        dormChips.appendChild(more);
      }
      dormCard.appendChild(dormChips);
    } else {
      const msg=document.createElement('p');
      msg.style.cssText='font-size:11px;color:var(--text-tertiary);margin-top:4px;';
      msg.textContent='All tracked skills used in this window.';
      dormCard.appendChild(msg);
    }

    roiGrid.appendChild(topCard);
    roiGrid.appendChild(dormCard);
    roiSection.appendChild(roiGrid);
  }
  container.appendChild(roiSection);

  // ── Row 3: Activity heatmap (per-day per-skill) ──
  const hmSection=document.createElement('div');
  hmSection.className='section panel';
  hmSection.setAttribute('aria-label','Activity heatmap — skill use by date');
  const hmTitle=document.createElement('h3');
  hmTitle.innerHTML='Activity Heatmap <span class="pill">per-day</span>';
  hmSection.appendChild(hmTitle);

  const hm=heatmapData.heatmap||[];
  const hmDates=heatmapData.dates||[];
  const hmMax=heatmapData.maxCount||1;

  if(hm.length===0||hmDates.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='24px 10px';
    empty.innerHTML='<h4>No heatmap data yet</h4><p>Activity data by date will appear here once sessions are recorded. Not captured — no per-day metrics available.</p>';
    hmSection.appendChild(empty);
  } else {
    const hmMeta=document.createElement('p');
    hmMeta.style.cssText='font-size:11px;color:var(--text-tertiary);margin-bottom:8px;';
    hmMeta.textContent='Per-day skill invocations — top '+hm.length+' skills, '+hmDates.length+' day'+(hmDates.length!==1?'s':'');
    hmSection.appendChild(hmMeta);

    const hmWrap=document.createElement('div');
    hmWrap.className='heatmap-wrap';

    const tbl=document.createElement('table');
    tbl.className='heatmap-table';
    tbl.setAttribute('aria-label','Skill activity heatmap by date');

    // Header row — dates (show last 14 max to fit)
    const showDates=hmDates.slice(-14);
    const thead=document.createElement('thead');
    const hdr=document.createElement('tr');
    const cornerTh=document.createElement('th');
    cornerTh.textContent='Skill';
    hdr.appendChild(cornerTh);
    for(const d of showDates){
      const th=document.createElement('th');
      th.style.textAlign='center';
      // Show MM-DD
      th.textContent=d.slice(5);
      hdr.appendChild(th);
    }
    thead.appendChild(hdr);
    tbl.appendChild(thead);

    const tbody=document.createElement('tbody');
    for(const row of hm){
      const tr=document.createElement('tr');
      const nameTd=document.createElement('td');
      nameTd.className='hm-skill-label';
      nameTd.title=row.skill;
      nameTd.textContent=row.skill;
      tr.appendChild(nameTd);
      // Only show dates in showDates window
      const dateMap=new Map(row.days.map(d=>[d.date,d.count]));
      for(const date of showDates){
        const count=dateMap.get(date)||0;
        const td=document.createElement('td');
        td.style.padding='2px';
        const cell=document.createElement('div');
        cell.className='hm-cell';
        // Opacity 0.08 (empty) → 0.9 (max)
        const alpha=count===0?0.08:0.15+0.75*(count/hmMax);
        cell.style.background='rgba(45,212,191,'+alpha.toFixed(2)+')';
        cell.setAttribute('aria-label',row.skill+' on '+date+': '+count+(count===1?' session':' sessions'));
        cell.title=date+': '+count;
        td.appendChild(cell);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    hmWrap.appendChild(tbl);
    hmSection.appendChild(hmWrap);
  }
  container.appendChild(hmSection);

  // ── Row 4: Session timeline ──
  const tlSection=document.createElement('div');
  tlSection.className='section panel';
  tlSection.setAttribute('aria-label','Recent session timeline');
  const tlTitle=document.createElement('h3');
  tlTitle.innerHTML='Session Timeline <span class="pill">recent</span>';
  tlSection.appendChild(tlTitle);

  if(timeline.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.style.padding='24px 10px';
    empty.innerHTML='<h4>No session timeline yet</h4><p>Recent sessions with their skill sequences will appear here. Not captured — run sessions to populate.</p>';
    tlSection.appendChild(empty);
  } else {
    const tlList=document.createElement('div');
    tlList.className='timeline-list';
    tlList.setAttribute('role','list');
    tlList.setAttribute('aria-label','Recent sessions');
    for(const session of timeline){
      const item=document.createElement('div');
      item.className='timeline-item'+(session.primary_skill&&session.primary_skill!=='unknown'?' primary':'');
      item.setAttribute('role','listitem');
      item.setAttribute('aria-label','Session on '+session.date+': '+session.skills_used.length+' skills');

      const dateEl=document.createElement('div');
      dateEl.className='timeline-date';
      dateEl.textContent=session.date;

      const skillsEl=document.createElement('div');
      skillsEl.className='timeline-skills';
      for(const sk of (session.skills_used||[]).slice(0,8)){
        const chip=document.createElement('span');
        chip.className='timeline-skill-chip'+(sk===session.primary_skill?' primary-skill':'');
        chip.textContent=sk;
        skillsEl.appendChild(chip);
      }
      if((session.skills_used||[]).length>8){
        const more=document.createElement('span');
        more.className='timeline-skill-chip';
        more.style.fontStyle='italic';
        more.textContent='+'+(session.skills_used.length-8)+' more';
        skillsEl.appendChild(more);
      }

      const metaEl=document.createElement('div');
      metaEl.className='timeline-meta';
      if(session.duration_min>0){
        const durEl=document.createElement('div');
        durEl.textContent=session.duration_min+'min';
        metaEl.appendChild(durEl);
      }
      if(session.tool_calls>0){
        const tcEl=document.createElement('div');
        tcEl.style.marginTop='2px';
        tcEl.textContent=session.tool_calls+' calls';
        metaEl.appendChild(tcEl);
      }

      item.appendChild(dateEl);
      item.appendChild(skillsEl);
      item.appendChild(metaEl);
      tlList.appendChild(item);
    }
    tlSection.appendChild(tlList);
  }
  container.appendChild(tlSection);
}

// ── Improve tab (Phase 5a — data-driven anti-pattern cards) ──
function renderImprove(){
  const container=document.getElementById('improve-content');
  if(!container)return;

  const gates=D.gates||[];
  const freq=D.skillFrequency||[];
  const timeline=D.sessionTimeline||[];
  const chains=D.skillChains||[];
  // Use the embedded count (which comes from ALL_KNOWN_SKILLS.length server-side) — never a bare 64
  const totalInstalled=D.totalInstalledSkills||D.allCoreSkillNames?.length||63;
  const ov=D.overview||{};

  // ── Derive findings from REAL data only ──
  // SECURITY: f.body is innerHTML — EVERY string data interpolation MUST be esc()'d; only numbers may be raw.
  const findings=[];

  // 1. Gate coverage low
  const GATE_SKILLS=['sentinel','preflight','completion-gate','logic-guardian',
    'constraint-check','sast','integrity-check','hallucination-guard'];
  const activeFiredGates=gates.filter(g=>(g.fired||0)>0).map(g=>g.name);
  const coverageCount=activeFiredGates.length;
  if(gates.length>0&&coverageCount<4&&ov.total_sessions>=3){
    findings.push({
      icon:'&#9888;',
      sev:'warn',
      title:'Low gate coverage',
      body:'Only '+coverageCount+' of '+GATE_SKILLS.length+' gate skills have fired in the last '+(D.window_days||30)+' days. Gate skills (sentinel, preflight, completion-gate…) catch issues before they reach production.',
      action:'Add <b>sentinel</b> or <b>preflight</b> to your workflow as pre-commit checks.',
    });
  }

  // 2. Blocks caught → link to Govern
  const totalBlocks=gates.reduce((s,g)=>s+(g.blocked||0),0);
  if(totalBlocks>0){
    findings.push({
      icon:'&#128721;',
      sev:'warn',
      title:totalBlocks+' block event'+(totalBlocks!==1?'s':'')+' caught',
      body:'Your gates have blocked '+totalBlocks+' event'+(totalBlocks!==1?'s':'')+'. These are real policy violations your workflow caught — review them in the Govern tab.',
      action:'Open <b>Govern → Gate Ledger</b> to see which gate fired and what it stopped.',
    });
  }

  // 3. Context bloat — sessions with very high tool_calls
  const BLOAT_THRESHOLD=120;
  const bloatSessions=timeline.filter(s=>s.tool_calls>BLOAT_THRESHOLD);
  if(bloatSessions.length>0){
    const avg=Math.round(bloatSessions.reduce((s,x)=>s+x.tool_calls,0)/bloatSessions.length);
    findings.push({
      icon:'&#128165;',
      sev:'warn',
      title:'Context bloat detected in '+bloatSessions.length+' session'+(bloatSessions.length!==1?'s':''),
      body:bloatSessions.length+' session'+(bloatSessions.length!==1?'s have':' has')+' over '+BLOAT_THRESHOLD+' tool calls (avg '+avg+' in those sessions). Long sessions risk context window exhaustion and model drift.',
      action:'Use <b>context-engine</b> to checkpoint and compact at logical phase boundaries.',
    });
  }

  // 4. Dormant skills (from skill-ROI)
  const activeSet=new Set(freq.map(s=>s.skill));
  const dormantCount=Math.max(0,totalInstalled-activeSet.size);
  if(freq.length>0&&dormantCount>10){
    findings.push({
      icon:'&#128712;',
      sev:'info',
      title:dormantCount+' Rune core skills unused in this window',
      body:'Only '+activeSet.size+' of '+totalInstalled+' Rune core skills were invoked in the last '+(D.window_days||30)+' days. Many skills may solve problems you are currently solving manually.',
      action:'Browse dormant skills (Measure tab) — they may reduce redundant work.',
    });
  }

  // 5. Skill-discovery — repeated chain patterns (only if real data)
  const repeatChains=chains.filter(c=>c.count>=3);
  if(repeatChains.length>0){
    const top=repeatChains[0];
    findings.push({
      icon:'&#128304;',
      sev:'info',
      title:'Repeated workflow pattern detected',
      body:'The chain <span style="font-family:var(--font-mono);font-size:11px;color:var(--accent)">'+esc(top.chain)+'</span> appeared '+top.count+' time'+(top.count!==1?'s':'')+'. Repeated skill sequences are candidates for a custom skill.',
      action:'Run <b>skill-forge</b> to codify this pattern into a reusable skill.',
    });
  }

  // 6. No gate skills defined at all (not even zero-fired)
  if(gates.length===0&&ov.total_sessions>0){
    findings.push({
      icon:'&#9651;',
      sev:'info',
      title:'No gate activity recorded',
      body:'Sessions are being recorded but no gate skills (sentinel, preflight, etc.) have fired yet. Gate coverage is zero — quality checks are not integrated into the workflow.',
      action:'Install Rune hooks: <b>rune hooks install --preset gentle</b>.',
    });
  }

  // ── Render ──
  const header=document.createElement('div');
  header.className='improve-header';
  const h3=document.createElement('h3');
  h3.textContent='Improvement Insights';
  const count=document.createElement('span');
  count.className='improve-count';
  count.textContent=findings.length>0?findings.length+' finding'+(findings.length!==1?'s':''):'';
  header.appendChild(h3);
  header.appendChild(count);
  container.appendChild(header);

  const subhead=document.createElement('p');
  subhead.className='improve-subhead';
  subhead.textContent='Derived from your real session and governance data. Only findings with evidence are shown — no generic advice.';
  container.appendChild(subhead);

  if(findings.length===0){
    const emptyDiv=document.createElement('div');
    emptyDiv.className='empty';
    emptyDiv.innerHTML=
      '<h4>Not enough session data yet</h4>'+
      '<p>Improvement recommendations are derived from real gate events, session patterns, and skill chains. Run more sessions with Rune skills to surface data-driven insights here.</p>';
    container.appendChild(emptyDiv);
    return;
  }

  const grid=document.createElement('div');
  grid.className='improve-grid';
  grid.setAttribute('role','list');
  grid.setAttribute('aria-label','Improvement findings');

  for(const f of findings){
    const card=document.createElement('div');
    card.className='improve-card sev-'+f.sev;
    card.setAttribute('role','listitem');

    const hdr=document.createElement('div');
    hdr.className='improve-card-header';

    const iconEl=document.createElement('span');
    iconEl.className='improve-card-icon';
    iconEl.setAttribute('aria-hidden','true');
    iconEl.innerHTML=f.icon;

    const titleEl=document.createElement('span');
    titleEl.className='improve-card-title';
    titleEl.textContent=f.title;

    const sevBadge=document.createElement('span');
    sevBadge.className='improve-sev-badge '+f.sev;
    sevBadge.setAttribute('aria-label','Severity: '+f.sev);
    sevBadge.textContent=f.sev;

    hdr.appendChild(iconEl);
    hdr.appendChild(titleEl);
    hdr.appendChild(sevBadge);
    card.appendChild(hdr);

    const body=document.createElement('div');
    body.className='improve-card-body';
    // f.body may contain safe inline HTML (font-family span for chain display) — the chain text is escaped via esc()
    body.innerHTML=f.body;
    card.appendChild(body);

    if(f.action){
      const action=document.createElement('div');
      action.className='improve-card-action';
      // f.action uses <b> tags only, no interpolated user data
      action.innerHTML='<span>&#9654;</span><span>'+f.action+'</span>';
      card.appendChild(action);
    }

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

// ── Understand tab: module graph (Phase 4) ──
// Features: filters, domain view, guided tour, node inspector, export, search
let understandRendered=false;
function renderUnderstandGraph(){
  if(understandRendered)return;
  understandRendered=true;

  const container=document.getElementById('understand-content');
  if(!container)return;

  // ── Data normalisation ──
  const rawModules=Array.isArray(D.modules)?D.modules:[];
  const rawEdges=Array.isArray(D.edges)?D.edges:[];
  const rawDomains=Array.isArray(D.domains)?D.domains:[];
  const skillMesh=D.skillMesh||{nodes:[],edges:[]};

  // Prefer comprehension modules; fall back to skillMesh nodes (labelled as Rune skill mesh)
  const useComprehension=rawModules.length>0;
  const isMeshFallback=!useComprehension;

  // Build canonical nodes/edges arrays
  const allNodes=useComprehension
    ? rawModules.map(m=>({
        id:String(m.id||m.name||''),
        name:String(m.name||m.id||''),
        layer:String(m.layer||'module'),
        type:String(m.type||'module'),
        complexity:String(m.complexity||''),
        summary:String(m.summary||''),
        files:typeof m.files==='number'?m.files:null,
      }))
    : (skillMesh.nodes||[]).map(n=>({
        id:String(n.id||n.name||''),
        name:String(n.id||n.name||''),
        layer:String(n.layer||'L3'),
        type:'skill',
        complexity:'',
        summary:String(n.summary||''),
        files:null,
      }));

  const allRawEdges=useComprehension
    ? rawEdges.map(e=>({source:String(e.from||''),target:String(e.to||''),category:String(e.category||'structural')}))
    : (skillMesh.edges||[]).map(e=>({source:String(e.source||''),target:String(e.target||''),category:'structural'}));

  // ── Schema-defined dimensions ──
  const SCHEMA_TYPES=['file','function','class','module','service','table','endpoint','domain','flow','step','doc','config','skill'];
  const SCHEMA_CATS=['structural','behavioral','data-flow','dependency','semantic','infrastructure','domain','knowledge'];
  const SCHEMA_COMPLEXITY=['simple','moderate','complex'];

  // Present values (only for toggles)
  const presentTypes=[...new Set(allNodes.map(n=>n.type))].filter(t=>SCHEMA_TYPES.includes(t)||t==='skill');
  const presentCats=[...new Set(allRawEdges.map(e=>e.category))].filter(c=>SCHEMA_CATS.includes(c));
  const presentComplexity=[...new Set(allNodes.map(n=>n.complexity))].filter(c=>SCHEMA_COMPLEXITY.includes(c));

  // ── Filter state (session-only, no persistence) ──
  const filterTypes=new Set(presentTypes);
  const filterCats=new Set(presentCats);
  const filterComplexity=new Set(SCHEMA_COMPLEXITY); // all on by default (incl. empty/uncategorised)

  // ── View state ──
  let isDomainView=false;
  let tourActive=false;
  let tourStep=0;
  let selectedNode=null;
  let searchQuery='';
  let searchMatches=new Set(); // node ids matching search

  // ── Layer / type colour map ──
  const NODE_COLORS={
    file:'#2dd4bf',function:'#2dd4bf',class:'#60a5fa',module:'#2dd4bf',
    service:'#60a5fa',table:'#a78bfa',endpoint:'#38bdf8',
    domain:'#fbbf24',flow:'#f97316',step:'#f59e0b',
    doc:'#f472b6',config:'#94a3b8',concept:'#34d399',skill:'#60a5fa',
    // layer fallbacks
    code:'#2dd4bf',data:'#a78bfa',docs:'#f472b6',infra:'#38bdf8',
    api:'#60a5fa',
    L0:'#fbbf24',L1:'#f97316',L2:'#60a5fa',L3:'#a78bfa',L4:'#34d399',
  };
  const EDGE_CAT_COLORS={
    structural:'rgba(45,212,191,.35)',
    behavioral:'rgba(96,165,250,.35)',
    'data-flow':'rgba(167,139,250,.35)',
    dependency:'rgba(148,163,184,.25)',
    semantic:'rgba(244,114,182,.35)',
    infrastructure:'rgba(56,189,248,.35)',
    domain:'rgba(251,191,36,.35)',
    knowledge:'rgba(52,211,153,.35)',
  };
  const COMPLEXITY_RADIUS={simple:5,moderate:7,complex:9,'':6};

  // ── Compute node colour by type then layer ──
  function nodeColor(n){return NODE_COLORS[n.type]||NODE_COLORS[n.layer]||'#94a3b8';}

  // ── Topological sort for guided tour ──
  function topoSort(nodes,edges){
    const ids=nodes.map(n=>n.id);
    const idSet=new Set(ids);
    const indeg=new Map(ids.map(id=>[id,0]));
    const adj=new Map(ids.map(id=>[id,[]]));
    for(const e of edges){
      if(idSet.has(e.source)&&idSet.has(e.target)){
        adj.get(e.source).push(e.target);
        indeg.set(e.target,(indeg.get(e.target)||0)+1);
      }
    }
    const queue=ids.filter(id=>indeg.get(id)===0);
    const result=[];
    while(queue.length>0){
      const cur=queue.shift();
      result.push(cur);
      for(const nb of (adj.get(cur)||[])){
        const d=(indeg.get(nb)||1)-1;
        indeg.set(nb,d);
        if(d===0)queue.push(nb);
      }
    }
    // Append any remaining (cycles)
    for(const id of ids){if(!result.includes(id))result.push(id);}
    return result.map(id=>nodes.find(n=>n.id===id)).filter(Boolean);
  }

  // ── Compute filtered views ──
  function getFilteredNodes(){
    return allNodes.filter(n=>{
      if(presentTypes.length>0&&!filterTypes.has(n.type))return false;
      const cx=n.complexity||'';
      // If complexity filter active and node has a known complexity value, filter it
      if(presentComplexity.length>0&&cx&&!filterComplexity.has(cx))return false;
      // Search filter
      if(searchQuery){
        const q=searchQuery.toLowerCase();
        return n.name.toLowerCase().includes(q)||n.summary.toLowerCase().includes(q)||n.type.toLowerCase().includes(q);
      }
      return true;
    });
  }
  function getFilteredEdges(filteredNodeIds){
    const idSet=new Set(filteredNodeIds);
    return allRawEdges.filter(e=>{
      if(!idSet.has(e.source)||!idSet.has(e.target))return false;
      if(presentCats.length>0&&!filterCats.has(e.category))return false;
      return true;
    });
  }

  // ── Build full outer layout ──
  const section=document.createElement('div');
  section.className='panel';

  // Title row
  const titleRow=document.createElement('h3');
  titleRow.innerHTML=(useComprehension
    ?'Codebase Map'
    :'Rune Skill Mesh'
  )+' <span class="pill">understand</span>'
  +(isMeshFallback?' <span class="pill" style="background:rgba(148,163,184,.1);color:var(--text-tertiary)">mesh fallback</span>':'');
  section.appendChild(titleRow);

  // Empty state
  if(allNodes.length===0){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.innerHTML='<h4>No codebase graph yet</h4><p>Run <code>rune onboard</code> or <code>rune autopsy</code> to generate comprehension.json and populate this graph.</p>';
    section.appendChild(empty);
    container.appendChild(section);
    return;
  }

  // Two-column layout: filters | main
  const layout=document.createElement('div');
  layout.className='u-layout';

  // ── LEFT: Filter panel ──
  const filters=document.createElement('aside');
  filters.className='u-filters';
  filters.setAttribute('aria-label','Graph filter controls');

  function mkFilterGroup(label,items,stateSet,onChange){
    const grp=document.createElement('div');
    grp.className='u-filter-group';
    const hdr=document.createElement('div');
    hdr.className='u-filter-group-header';
    const lbl=document.createElement('span');
    lbl.className='u-filter-group-label';
    lbl.textContent=label;
    hdr.appendChild(lbl);
    const btns=document.createElement('span');
    btns.className='u-quick-btns';
    const allBtn=document.createElement('button');
    allBtn.className='u-quick-btn';
    allBtn.textContent='All';
    allBtn.setAttribute('aria-label','Select all '+label);
    allBtn.addEventListener('click',()=>{items.forEach(v=>stateSet.add(v));onChange();renderCheckboxes();});
    const noneBtn=document.createElement('button');
    noneBtn.className='u-quick-btn';
    noneBtn.textContent='None';
    noneBtn.setAttribute('aria-label','Deselect all '+label);
    noneBtn.addEventListener('click',()=>{stateSet.clear();onChange();renderCheckboxes();});
    btns.appendChild(allBtn);btns.appendChild(noneBtn);
    hdr.appendChild(btns);
    grp.appendChild(hdr);

    const checkWrap=document.createElement('div');
    checkWrap.className='u-checks';

    function renderCheckboxes(){
      checkWrap.innerHTML='';
      for(const v of items){
        const row=document.createElement('label');
        row.className='u-check-row';
        const cb=document.createElement('input');
        cb.type='checkbox';
        cb.checked=stateSet.has(v);
        cb.setAttribute('aria-label',v);
        cb.addEventListener('change',()=>{
          if(cb.checked)stateSet.add(v);else stateSet.delete(v);
          onChange();
        });
        const span=document.createElement('span');
        span.className='u-check-label';
        span.textContent=v;
        // Count badge
        const badge=document.createElement('span');
        badge.className='u-badge';
        const cnt=label==='Node types'
          ?allNodes.filter(n=>n.type===v).length
          :label==='Edge types'
          ?allRawEdges.filter(e=>e.category===v).length
          :allNodes.filter(n=>n.complexity===v).length;
        badge.textContent=String(cnt);
        row.appendChild(cb);row.appendChild(span);row.appendChild(badge);
        checkWrap.appendChild(row);
      }
    }
    renderCheckboxes();
    grp.appendChild(checkWrap);
    // Store ref for external re-render
    grp._renderCheckboxes=renderCheckboxes;
    return grp;
  }

  const filterGroups=[];
  if(presentTypes.length>0){
    filterGroups.push(mkFilterGroup('Node types',presentTypes,filterTypes,applyFilters));
  }
  if(presentCats.length>0){
    filterGroups.push(mkFilterGroup('Edge types',presentCats,filterCats,applyFilters));
  }
  if(presentComplexity.length>0){
    filterGroups.push(mkFilterGroup('Complexity',presentComplexity,filterComplexity,applyFilters));
  }
  for(const g of filterGroups)filters.appendChild(g);
  layout.appendChild(filters);

  // ── RIGHT: Main panel ──
  const main=document.createElement('div');
  main.className='u-main';

  // ── Toolbar ──
  const toolbar=document.createElement('div');
  toolbar.className='u-toolbar';

  // Search
  const searchWrap=document.createElement('div');
  searchWrap.className='u-search-wrap';
  const searchIcon=document.createElement('span');
  searchIcon.className='u-search-icon';
  searchIcon.setAttribute('aria-hidden','true');
  searchIcon.textContent='⌕';
  const searchInput=document.createElement('input');
  searchInput.type='search';
  searchInput.className='u-search';
  searchInput.placeholder='Search nodes…';
  searchInput.setAttribute('aria-label','Search nodes by name or type');
  let searchDebounce=null;
  searchInput.addEventListener('input',()=>{
    clearTimeout(searchDebounce);
    searchDebounce=setTimeout(()=>{
      searchQuery=searchInput.value.trim();
      applyFilters();
    },200);
  });
  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(searchInput);
  toolbar.appendChild(searchWrap);

  // Match count
  const matchCount=document.createElement('span');
  matchCount.className='u-search-match-count';
  matchCount.setAttribute('aria-live','polite');
  toolbar.appendChild(matchCount);

  // Domain view toggle
  const domainBtn=document.createElement('button');
  domainBtn.className='u-toggle-btn';
  domainBtn.textContent='Domain View';
  domainBtn.setAttribute('aria-pressed','false');
  domainBtn.addEventListener('click',()=>{
    isDomainView=!isDomainView;
    domainBtn.classList.toggle('active',isDomainView);
    domainBtn.setAttribute('aria-pressed',isDomainView?'true':'false');
    tourBtn.style.display=isDomainView?'none':'';
    graphArea.style.display=isDomainView?'none':'';
    legendWrap.style.display=isDomainView?'none':'';
    domainViewEl.style.display=isDomainView?'':'none';
    if(isDomainView)renderDomainView();
  });
  if(rawDomains.length===0)domainBtn.style.opacity='.4';
  toolbar.appendChild(domainBtn);

  // Tour button
  const tourBtn=document.createElement('button');
  tourBtn.className='u-toggle-btn';
  tourBtn.textContent='Start Tour';
  tourBtn.setAttribute('aria-label','Start guided dependency tour');
  tourBtn.addEventListener('click',()=>{
    tourPanel.classList.add('visible');
    tourActive=true;
    tourStep=0;
    buildTour();
    tourBtn.textContent='Exit Tour';
    tourBtn.classList.add('active');
  });
  toolbar.appendChild(tourBtn);

  // Export group
  const exportGroup=document.createElement('div');
  exportGroup.className='u-export-group';

  const exportPng=document.createElement('button');
  exportPng.className='u-export-btn';
  exportPng.textContent='PNG';
  exportPng.setAttribute('aria-label','Export graph as PNG image');
  exportPng.addEventListener('click',()=>{
    const c=document.getElementById('understand-canvas');
    if(!c)return;
    c.toBlob(blob=>{
      if(!blob)return;
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='codebase-graph.png';
      a.click();
      URL.revokeObjectURL(a.href);
    },'image/png');
  });

  const exportSvg=document.createElement('button');
  exportSvg.className='u-export-btn';
  exportSvg.textContent='SVG';
  exportSvg.setAttribute('aria-label','Export graph as SVG vector');
  exportSvg.addEventListener('click',()=>exportAsSvg());

  const exportJson=document.createElement('button');
  exportJson.className='u-export-btn';
  exportJson.textContent='JSON';
  exportJson.setAttribute('aria-label','Export filtered graph data as JSON');
  exportJson.addEventListener('click',()=>{
    const filtered=getFilteredNodes();
    const filteredEdges=getFilteredEdges(filtered.map(n=>n.id));
    const blob=new Blob([JSON.stringify({modules:filtered,edges:filteredEdges},null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='codebase-graph.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  exportGroup.appendChild(exportPng);
  exportGroup.appendChild(exportSvg);
  exportGroup.appendChild(exportJson);
  toolbar.appendChild(exportGroup);
  main.appendChild(toolbar);

  // ── Tour panel ──
  const tourPanel=document.createElement('div');
  tourPanel.className='u-tour-panel';
  tourPanel.setAttribute('role','region');
  tourPanel.setAttribute('aria-label','Guided tour');
  let tourNodes=[];
  let tourStepListEl=null;
  let tourDetailEl=null;
  let tourCounterEl=null;
  let tourPrevBtn=null;
  let tourNextBtn=null;

  function buildTour(){
    const filtered=getFilteredNodes();
    const filteredEdges=getFilteredEdges(filtered.map(n=>n.id));
    tourNodes=topoSort(filtered,filteredEdges);
    tourPanel.innerHTML='';
    if(tourNodes.length===0){
      tourPanel.innerHTML='<p style="color:var(--text-tertiary);font-size:12px">No nodes to tour with current filters.</p>';
      return;
    }
    const hdr=document.createElement('div');
    hdr.className='u-tour-header';
    const title=document.createElement('span');
    title.textContent='Guided Tour';
    hdr.appendChild(title);
    const closeBtn=document.createElement('button');
    closeBtn.className='u-tour-close';
    closeBtn.textContent='✕';
    closeBtn.setAttribute('aria-label','Close tour');
    closeBtn.addEventListener('click',closeTour);
    hdr.appendChild(closeBtn);
    tourPanel.appendChild(hdr);

    const body=document.createElement('div');
    body.className='u-tour-body';

    tourStepListEl=document.createElement('div');
    tourStepListEl.className='u-tour-steps';
    tourStepListEl.setAttribute('role','list');
    tourNodes.forEach((n,i)=>{
      const item=document.createElement('button');
      item.className='u-tour-step-item'+(i===0?' active':'');
      item.textContent=(i+1)+'. '+n.name.slice(0,18);
      item.setAttribute('role','listitem');
      item.setAttribute('tabindex','0');
      item.addEventListener('click',()=>{tourStep=i;updateTourStep();});
      item.setAttribute('aria-label','Step '+(i+1)+': '+n.name);
      tourStepListEl.appendChild(item);
    });
    body.appendChild(tourStepListEl);

    tourDetailEl=document.createElement('div');
    tourDetailEl.className='u-tour-detail';
    body.appendChild(tourDetailEl);
    tourPanel.appendChild(body);

    const nav=document.createElement('div');
    nav.className='u-tour-nav';
    tourPrevBtn=document.createElement('button');
    tourPrevBtn.className='u-tour-nav-btn';
    tourPrevBtn.textContent='← Prev';
    tourPrevBtn.setAttribute('aria-label','Previous step');
    tourPrevBtn.addEventListener('click',()=>{if(tourStep>0){tourStep--;updateTourStep();}});
    tourNextBtn=document.createElement('button');
    tourNextBtn.className='u-tour-nav-btn';
    tourNextBtn.textContent='Next →';
    tourNextBtn.setAttribute('aria-label','Next step');
    tourNextBtn.addEventListener('click',()=>{if(tourStep<tourNodes.length-1){tourStep++;updateTourStep();}});
    tourCounterEl=document.createElement('span');
    tourCounterEl.className='u-tour-counter';
    nav.appendChild(tourPrevBtn);nav.appendChild(tourNextBtn);nav.appendChild(tourCounterEl);
    tourPanel.appendChild(nav);
    updateTourStep();
  }

  function updateTourStep(){
    if(!tourNodes.length||!tourDetailEl)return;
    const n=tourNodes[tourStep];
    // Update step list highlight
    if(tourStepListEl){
      Array.from(tourStepListEl.children).forEach((el,i)=>{
        el.classList.toggle('active',i===tourStep);
      });
    }
    // Detail
    tourDetailEl.innerHTML='';
    const lbl=document.createElement('div');
    lbl.className='u-tour-step-label';
    lbl.textContent=esc(n.name);
    const summary=document.createElement('div');
    summary.className='u-tour-step-summary';
    summary.textContent=n.summary||('A '+esc(n.type)+' in the '+esc(n.layer)+' layer.');
    tourDetailEl.appendChild(lbl);
    tourDetailEl.appendChild(summary);
    // Meta chips
    if(n.type||n.complexity){
      const meta=document.createElement('div');
      meta.style.cssText='margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;';
      if(n.type){
        const chip=document.createElement('span');
        chip.className='pill';
        chip.textContent=esc(n.type);
        meta.appendChild(chip);
      }
      if(n.complexity){
        const c=document.createElement('span');
        c.className='u-complexity-badge '+n.complexity;
        c.textContent=esc(n.complexity);
        meta.appendChild(c);
      }
      tourDetailEl.appendChild(meta);
    }
    if(tourPrevBtn)tourPrevBtn.disabled=tourStep===0;
    if(tourNextBtn)tourNextBtn.disabled=tourStep===tourNodes.length-1;
    if(tourCounterEl)tourCounterEl.textContent=(tourStep+1)+' / '+tourNodes.length;
    // Highlight node on canvas
    highlightNode(n.id);
  }

  function closeTour(){
    tourPanel.classList.remove('visible');
    tourActive=false;
    tourBtn.textContent='Start Tour';
    tourBtn.classList.remove('active');
    highlightNode(null);
  }

  // Esc to exit tour
  document.addEventListener('keydown',function onKey(e){
    if(e.key==='Escape'){
      if(tourActive)closeTour();
      if(selectedNode!==null){selectedNode=null;inspectorPanel.classList.remove('visible');highlightNode(null);}
    }
  });

  main.appendChild(tourPanel);

  // ── Graph canvas area ──
  const graphArea=document.createElement('div');
  graphArea.className='u-graph-wrap';
  const canvas=document.createElement('canvas');
  canvas.id='understand-canvas';
  canvas.setAttribute('role','group');
  canvas.setAttribute('aria-label','Module dependency graph');
  graphArea.appendChild(canvas);
  main.appendChild(graphArea);

  // ── Legend ──
  const legendWrap=document.createElement('div');
  legendWrap.className='u-legend';
  legendWrap.setAttribute('aria-label','Graph legend');
  main.appendChild(legendWrap);

  function renderLegend(nodes){
    legendWrap.innerHTML='';
    const usedTypes=[...new Set(nodes.map(n=>n.type))].slice(0,8);
    for(const t of usedTypes){
      const color=NODE_COLORS[t]||'#94a3b8';
      legendWrap.innerHTML+='<span aria-label="'+esc(t)+' nodes"><i style="background:'+color+'" aria-hidden="true"></i>'+esc(t)+'</span>';
    }
  }

  // ── Node inspector panel ──
  const inspectorPanel=document.createElement('div');
  inspectorPanel.className='u-inspector';
  inspectorPanel.setAttribute('role','complementary');
  inspectorPanel.setAttribute('aria-label','Node inspector');
  main.appendChild(inspectorPanel);

  function showInspector(node,filtEdges){
    inspectorPanel.innerHTML='';
    inspectorPanel.classList.add('visible');
    const hdr=document.createElement('h4');
    hdr.textContent=esc(node.name);
    const close=document.createElement('button');
    close.className='u-inspector-close';
    close.textContent='✕';
    close.setAttribute('aria-label','Close inspector');
    close.addEventListener('click',()=>{
      inspectorPanel.classList.remove('visible');
      selectedNode=null;
      highlightNode(null);
    });
    hdr.appendChild(close);
    inspectorPanel.appendChild(hdr);

    function row(label,val){
      if(!val&&val!==0)return;
      const d=document.createElement('div');
      d.className='u-insp-row';
      const l=document.createElement('span');l.className='u-insp-label';l.textContent=label;
      const v=document.createElement('span');v.className='u-insp-val';v.textContent=String(val);
      d.appendChild(l);d.appendChild(v);
      inspectorPanel.appendChild(d);
    }
    row('Type',node.type);
    row('Layer',node.layer);
    row('Files',node.files!=null?node.files:null);
    // Complexity badge
    if(node.complexity){
      const d=document.createElement('div');d.className='u-insp-row';
      const l=document.createElement('span');l.className='u-insp-label';l.textContent='Complexity';
      const b=document.createElement('span');b.className='u-complexity-badge '+node.complexity;b.textContent=node.complexity;
      d.appendChild(l);d.appendChild(b);
      inspectorPanel.appendChild(d);
    }
    if(node.summary){
      const s=document.createElement('div');
      s.className='u-insp-summary';
      s.textContent=esc(node.summary);
      inspectorPanel.appendChild(s);
    }
    // Relationships
    const rels=filtEdges.filter(e=>e.source===node.id||e.target===node.id);
    if(rels.length>0){
      const relSec=document.createElement('div');
      relSec.className='u-insp-relations';
      const rLbl=document.createElement('div');
      rLbl.className='u-insp-relations-label';
      rLbl.textContent='Relationships ('+rels.length+')';
      relSec.appendChild(rLbl);
      for(const e of rels.slice(0,12)){
        const isOut=e.source===node.id;
        const otherId=isOut?e.target:e.source;
        const other=allNodes.find(n=>n.id===otherId);
        const item=document.createElement('div');
        item.className='u-rel-item';
        const dir=document.createElement('span');
        dir.className='u-rel-dir';
        dir.setAttribute('aria-label',isOut?'outgoing':'incoming');
        dir.textContent=isOut?'→':'←';
        const name=document.createElement('span');
        name.textContent=esc(other?other.name:otherId);
        name.style.flex='1';
        const cat=document.createElement('span');
        cat.style.cssText='font-size:9px;color:var(--text-tertiary);';
        cat.textContent=esc(e.category);
        item.appendChild(dir);item.appendChild(name);item.appendChild(cat);
        relSec.appendChild(item);
      }
      if(rels.length>12){
        const more=document.createElement('div');
        more.style.cssText='font-size:10px;color:var(--text-tertiary);padding:4px 0;';
        more.textContent='+'+(rels.length-12)+' more…';
        relSec.appendChild(more);
      }
      inspectorPanel.appendChild(relSec);
    }
  }

  // ── Domain view ──
  const domainViewEl=document.createElement('div');
  domainViewEl.className='u-domain-view';
  domainViewEl.style.display='none';
  main.appendChild(domainViewEl);

  function renderDomainView(){
    domainViewEl.innerHTML='';
    if(rawDomains.length===0){
      const empty=document.createElement('div');
      empty.className='empty';
      empty.style.gridColumn='1/-1';
      empty.innerHTML='<h4>No domain data</h4><p>Run <code>rune onboard</code> to generate domain/flow/step structure.</p>';
      domainViewEl.appendChild(empty);
      return;
    }
    for(const domain of rawDomains){
      const col=document.createElement('div');
      col.className='u-domain-col';
      const dName=document.createElement('div');
      dName.className='u-domain-name';
      dName.textContent=esc(domain.name||'');
      col.appendChild(dName);
      if(domain.summary){
        const dSum=document.createElement('div');
        dSum.className='u-domain-summary';
        dSum.textContent=esc(domain.summary);
        col.appendChild(dSum);
      }
      const flows=Array.isArray(domain.flows)?domain.flows:[];
      for(const flow of flows){
        const flowEl=document.createElement('div');
        flowEl.className='u-flow';
        const fName=document.createElement('div');
        fName.className='u-flow-name';
        fName.textContent=esc(flow.name||'');
        flowEl.appendChild(fName);
        const steps=Array.isArray(flow.steps)?flow.steps:[];
        steps.forEach((step,si)=>{
          const stepEl=document.createElement('div');
          stepEl.className='u-step';
          const num=document.createElement('span');
          num.className='u-step-num';
          num.textContent=(si+1)+'.';
          const txt=document.createElement('span');
          txt.textContent=esc(String(step));
          stepEl.appendChild(num);stepEl.appendChild(txt);
          flowEl.appendChild(stepEl);
        });
        col.appendChild(flowEl);
      }
      domainViewEl.appendChild(col);
    }
  }

  layout.appendChild(main);
  section.appendChild(layout);
  container.appendChild(section);

  // ── Canvas graph renderer ──
  let animFrameId=null;
  let graphNodes=[];
  let graphEdges=[];
  let hovered=null;
  let highlighted=null; // node id to highlight (tour / inspector)
  let kbFocusIdx=-1; // hoisted here so drawGraph can reference it without a TDZ typeof guard
  const ctx=canvas.getContext('2d');
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;

  function layoutNodes(nodes,W,H){
    const N=nodes.length;
    if(N===0)return;
    const cx=W/2,cy=H/2;
    // Layer-clustered circular layout
    const layerGroups=new Map();
    for(const n of nodes){
      const l=n.layer||'module';
      if(!layerGroups.has(l))layerGroups.set(l,[]);
      layerGroups.get(l).push(n);
    }
    const layerList=[...layerGroups.keys()];
    const rBase=Math.min(W,H)*0.34;
    let globalIdx=0;
    layerList.forEach((layer,li)=>{
      const members=layerGroups.get(layer);
      members.forEach((n,mi)=>{
        const baseAngle=(li/layerList.length)*Math.PI*2-Math.PI/2;
        const spread=(members.length>1?(mi/(members.length-1)-0.5)*0.6:0);
        const angle=baseAngle+spread;
        const r=rBase*(0.55+0.45*(globalIdx/Math.max(N-1,1)));
        n.x=cx+Math.cos(angle)*r;
        n.y=cy+Math.sin(angle)*r;
        n.color=nodeColor(n);
        n.radius=COMPLEXITY_RADIUS[n.complexity||'']||6;
        globalIdx++;
      });
    });
  }

  function drawGraph(ts){
    const W=canvas.width/(window.devicePixelRatio||1);
    const H=canvas.height/(window.devicePixelRatio||1);
    const dpr=window.devicePixelRatio||1;
    ctx.save();ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,W,H);
    const t=reducedMotion?0:(ts||0)*0.001;

    const nodeMap=new Map(graphNodes.map((n,i)=>[n.id,i]));

    // Edges
    for(const e of graphEdges){
      const ai=nodeMap.get(e.source);
      const bi=nodeMap.get(e.target);
      if(ai==null||bi==null)continue;
      const a=graphNodes[ai],b=graphNodes[bi];
      const hiSrc=hovered!=null&&(nodeMap.get(e.source)===hovered||nodeMap.get(e.target)===hovered);
      const hiHighlight=highlighted&&(e.source===highlighted||e.target===highlighted);
      const hi=hiSrc||hiHighlight;
      const color=hi?(EDGE_CAT_COLORS[e.category]||'rgba(45,212,191,.5)'):('rgba(148,163,184,.10)');
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.strokeStyle=color;
      ctx.lineWidth=hi?1.8:0.7;
      ctx.stroke();
    }

    // Nodes
    for(let i=0;i<graphNodes.length;i++){
      const n=graphNodes[i];
      const isH=hovered===i;
      const isHighlighted=highlighted===n.id;
      const isConnected=hovered!=null&&!isH&&graphEdges.some(e=>{
        const si=nodeMap.get(e.source),ti=nodeMap.get(e.target);
        return si===hovered&&ti===i||ti===hovered&&si===i;
      });
      const isSearch=searchQuery&&searchMatches.has(n.id);
      const dim=hovered!=null&&!isH&&!isConnected&&!isHighlighted;
      const pulse=reducedMotion?1:(isH||isHighlighted?1.3:(1+0.07*Math.sin(t*0.7+i*0.9)));
      const rad=n.radius*pulse;

      // Search ring
      if(isSearch&&!dim){
        ctx.beginPath();ctx.arc(n.x,n.y,rad+5,0,Math.PI*2);
        ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();
      }

      // Tour/inspector highlight ring
      if(isHighlighted){
        ctx.beginPath();ctx.arc(n.x,n.y,rad+7,0,Math.PI*2);
        ctx.strokeStyle='rgba(45,212,191,.8)';ctx.lineWidth=2;ctx.stroke();
      }

      if(!dim){
        // Glow
        const grd=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,rad*2.8);
        grd.addColorStop(0,n.color+(isH||isHighlighted?'50':'18'));
        grd.addColorStop(1,n.color+'00');
        ctx.fillStyle=grd;ctx.beginPath();ctx.arc(n.x,n.y,rad*2.8,0,Math.PI*2);ctx.fill();
      }

      ctx.globalAlpha=dim?0.2:0.9;
      ctx.fillStyle=dim?'#334155':n.color;
      ctx.beginPath();ctx.arc(n.x,n.y,rad,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;

      // Label
      if(isH||isHighlighted||n.radius>=9){
        ctx.font='500 9px system-ui,sans-serif';
        ctx.fillStyle=dim?'transparent':'#cbd5e1';
        ctx.textAlign='center';
        ctx.fillText(n.name.slice(0,16),n.x,n.y+rad+11);
      }
    }

    // ── Keyboard focus ring (drawn last, always on top) ──
    if(kbFocusIdx>=0&&kbFocusIdx<graphNodes.length){
      const fn=graphNodes[kbFocusIdx];
      if(fn&&fn.x!=null&&fn.y!=null){
        const fnRad=(fn.radius||6);
        ctx.beginPath();
        ctx.arc(fn.x,fn.y,fnRad+10,0,Math.PI*2);
        ctx.strokeStyle='rgba(45,212,191,.95)';
        ctx.lineWidth=2.5;
        ctx.setLineDash([4,3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font='bold 10px system-ui,sans-serif';
        ctx.fillStyle='#f1f5f9';
        ctx.textAlign='center';
        ctx.fillText(fn.name.slice(0,20),fn.x,fn.y+fnRad+24);
      }
    }

    ctx.restore();
    if(!reducedMotion)animFrameId=requestAnimationFrame(drawGraph);
  }

  function highlightNode(id){
    highlighted=id;
    if(reducedMotion)requestAnimationFrame(drawGraph);
  }

  function resizeCanvas(){
    if(canvas.parentElement){
      const dpr=window.devicePixelRatio||1;
      const W=canvas.parentElement.offsetWidth||600;
      const H=canvas.parentElement.offsetHeight||320;
      canvas.width=W*dpr;canvas.height=H*dpr;
      layoutNodes(graphNodes,W,H);
      if(reducedMotion)requestAnimationFrame(drawGraph);
    }
  }

  // ── Apply filters and re-render ──
  function applyFilters(){
    if(animFrameId!=null){cancelAnimationFrame(animFrameId);animFrameId=null;}
    graphNodes=getFilteredNodes();
    graphEdges=getFilteredEdges(graphNodes.map(n=>n.id));
    // Build search match set
    searchMatches=new Set();
    if(searchQuery){
      const q=searchQuery.toLowerCase();
      for(const n of graphNodes){
        if(n.name.toLowerCase().includes(q)||n.summary.toLowerCase().includes(q))searchMatches.add(n.id);
      }
    }
    // Match count
    if(searchQuery){
      matchCount.textContent=searchMatches.size+' match'+(searchMatches.size!==1?'es':'');
    }else{
      matchCount.textContent=graphNodes.length+' node'+(graphNodes.length!==1?'s':'');
    }
    // Rebuild tour if open
    if(tourActive)buildTour();
    renderLegend(graphNodes);
    resizeCanvas();
    if(!reducedMotion){animFrameId=requestAnimationFrame(drawGraph);}
    else{requestAnimationFrame(drawGraph);}
  }

  // ── Mouse interactions ──
  canvas.addEventListener('mousemove',(ev)=>{
    const rect=canvas.getBoundingClientRect();
    const mx=ev.clientX-rect.left,my=ev.clientY-rect.top;
    hovered=null;
    for(let i=0;i<graphNodes.length;i++){
      const n=graphNodes[i];
      const dx=mx-n.x,dy=my-n.y;
      if(dx*dx+dy*dy<(n.radius+8)**2){hovered=i;break;}
    }
    canvas.title=hovered!=null?graphNodes[hovered].name:'';
    canvas.style.cursor=hovered!=null?'pointer':'crosshair';
    if(reducedMotion)requestAnimationFrame(drawGraph);
  });

  canvas.addEventListener('mouseleave',()=>{
    hovered=null;
    canvas.title='';
    canvas.style.cursor='crosshair';
    if(reducedMotion)requestAnimationFrame(drawGraph);
  });

  canvas.addEventListener('click',()=>{
    if(hovered==null)return;
    const n=graphNodes[hovered];
    selectedNode=n.id;
    highlightNode(n.id);
    showInspector(n,graphEdges);
  });

  // ── Canvas keyboard accessibility (Phase 5a) ──
  canvas.setAttribute('tabindex','0');
  canvas.setAttribute('aria-label','Module dependency graph — Arrow keys to navigate nodes, Enter or Space to inspect, Escape to exit');

  // kbFocusIdx is hoisted above drawGraph so it's in scope without a TDZ typeof guard.
  function kbFocusNode(idx){
    kbFocusIdx=idx;
    highlighted=idx>=0&&idx<graphNodes.length?graphNodes[idx].id:null;
    if(reducedMotion)requestAnimationFrame(drawGraph);
  }

  canvas.addEventListener('keydown',(e)=>{
    const total=graphNodes.length;
    if(total===0)return;

    // Arrow keys ONLY for intra-graph node cycling — Tab/Shift+Tab must bubble
    // so keyboard focus can leave the canvas (WCAG 2.1.2 No Keyboard Trap).
    if(e.key==='ArrowRight'||e.key==='ArrowDown'){
      e.preventDefault();
      kbFocusIdx=(kbFocusIdx+1)%total;
      kbFocusNode(kbFocusIdx);
      // Announce to sr-only live region
      const node=graphNodes[kbFocusIdx];
      if(node&&srLiveEl){srLiveEl.textContent=node.name+', '+node.type+', '+(kbFocusIdx+1)+' of '+total;}
    } else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){
      e.preventDefault();
      kbFocusIdx=(kbFocusIdx-1+total)%total;
      kbFocusNode(kbFocusIdx);
      const node=graphNodes[kbFocusIdx];
      if(node&&srLiveEl){srLiveEl.textContent=node.name+', '+node.type+', '+(kbFocusIdx+1)+' of '+total;}
    } else if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      if(kbFocusIdx>=0&&kbFocusIdx<total){
        const n=graphNodes[kbFocusIdx];
        selectedNode=n.id;
        highlightNode(n.id);
        showInspector(n,graphEdges);
      }
    } else if(e.key==='Escape'){
      if(kbFocusIdx>=0){kbFocusIdx=-1;kbFocusNode(-1);}
      selectedNode=null;
      inspectorPanel.classList.remove('visible');
      highlightNode(null);
      e.stopPropagation(); // prevent double-fire with document-level Esc handler (~line 2637)
    }
  });

  canvas.addEventListener('blur',()=>{
    // Clear kb focus ring when canvas loses focus
    kbFocusIdx=-1;
    if(highlighted&&!selectedNode)highlightNode(null);
  });

  // ── Sr-only live region (ARIA announcements) ──
  const srLiveEl=document.createElement('div');
  srLiveEl.setAttribute('aria-live','polite');
  srLiveEl.setAttribute('aria-atomic','true');
  srLiveEl.className='sr-only';
  main.appendChild(srLiveEl);

  // ── Sr-only static node list (screen reader full graph access) ──
  const srListWrap=document.createElement('div');
  srListWrap.className='sr-only';
  srListWrap.setAttribute('aria-label','Graph node list');
  const srHeading=document.createElement('h4');
  srHeading.textContent='Graph nodes ('+allNodes.length+' total)';
  srListWrap.appendChild(srHeading);
  const srUl=document.createElement('ul');
  for(const n of allNodes){
    const li=document.createElement('li');
    // textContent only — no innerHTML here, safe for any node name
    li.textContent=n.name+' — '+n.type+(n.layer?' ('+n.layer+')':'');
    srUl.appendChild(li);
  }
  srListWrap.appendChild(srUl);
  main.appendChild(srListWrap);

  // ── SVG export ──
  function exportAsSvg(){
    const W=canvas.width/(window.devicePixelRatio||1)||600;
    const H=canvas.height/(window.devicePixelRatio||1)||320;
    const nodeMap=new Map(graphNodes.map((n,i)=>[n.id,i]));
    let svgLines=['<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http'+'://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">',
      '<rect width="'+W+'" height="'+H+'" fill="#080d1a"/>'];
    // Edges
    for(const e of graphEdges){
      const ai=nodeMap.get(e.source),bi=nodeMap.get(e.target);
      if(ai==null||bi==null)continue;
      const a=graphNodes[ai],b=graphNodes[bi];
      const color=EDGE_CAT_COLORS[e.category]||'rgba(148,163,184,.2)';
      svgLines.push('<line x1="'+a.x.toFixed(1)+'" y1="'+a.y.toFixed(1)+'" x2="'+b.x.toFixed(1)+'" y2="'+b.y.toFixed(1)+'" stroke="'+color+'" stroke-width="0.8"/>');
    }
    // Nodes
    for(const n of graphNodes){
      const r=n.radius||6;
      const escaped=n.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      svgLines.push('<circle cx="'+n.x.toFixed(1)+'" cy="'+n.y.toFixed(1)+'" r="'+r+'" fill="'+n.color+'"/>');
      svgLines.push('<text x="'+n.x.toFixed(1)+'" y="'+(n.y+r+11).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="system-ui,sans-serif">'+escaped.slice(0,16)+'</text>');
    }
    svgLines.push('</svg>');
    const blob=new Blob([svgLines.join('\n')],{type:'image/svg+xml'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='codebase-graph.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Initial render ──
  requestAnimationFrame(()=>{
    resizeCanvas();
    applyFilters();
    if(!reducedMotion)animFrameId=requestAnimationFrame(drawGraph);
  });

  // Resize observer (debounced)
  let resizeTimer=null;
  if(typeof ResizeObserver!=='undefined'){
    const ro=new ResizeObserver(()=>{
      clearTimeout(resizeTimer);
      resizeTimer=setTimeout(()=>resizeCanvas(),80);
    });
    ro.observe(graphArea);
  }
}

// ── Initial renders ──
renderGovern();
renderMeasure();
renderImprove();
// Materialize the persisted persona on load. renderGovern() applies the persona
// for the Business path, but early-returns the upsell for Free/Pro before reaching
// it — so a persisted My Lens (Pro) selection would otherwise not render. Re-apply
// here (idempotent for Business).
if(typeof applyPersona==='function'){applyPersona(currentProfile.persona);}
`;
