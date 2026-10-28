(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GroundCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_BYTES = 5*1024*1024-65536;
  const withinStorageLimit = state => new TextEncoder().encode(JSON.stringify(state)).length <= STORAGE_BYTES;
  const STATUSES = ['Not started', 'Working on', 'Almost consistent', 'Consistent - move on', 'Paused'];
  const LABELS = ['Not started', 'Practicing', 'Nearly there', 'Consistent', 'Paused'];
  const rank = s => [0, 1, 2, 3, 0][STATUSES.indexOf(s)] || 0;
  const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateToday = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T12:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0,10) === s && +s.slice(0,4) >= 1900 && +s.slice(0,4) <= 2100;
  }
  function freshState() {
    return {schema:1,revision:0,createdAt:new Date().toISOString(),profile:{name:'',age:'',health:'',comfort:'',rewards:'',equipment:'',history:'',help:'',priorities:[]},progress:{},favorites:[],sessions:[],plans:{},settings:{theme:'light',textSize:'normal'}};
  }
  function index(data) {
    const skills = new Map(), steps = new Map();
    for (const skill of data.skills) {
      if (skills.has(skill.code)) throw new Error('Duplicate skill: ' + skill.code);
      skills.set(skill.code, skill);
      for (const step of skill.steps) {
        if (steps.has(step.id)) throw new Error('Duplicate teaching step: ' + step.id);
        steps.set(step.id, {skill, step});
      }
    }
    for (const {step} of steps.values()) for (const [id, level] of step.deps) {
      if (!steps.has(id) || ![2,3].includes(level)) throw new Error('Invalid prerequisite: '+id);
    }
    const visited = new Set(), active = new Set();
    function visit(id) {
      if (active.has(id)) throw new Error('Circular prerequisites: ' + id);
      if (visited.has(id)) return;
      active.add(id);
      for (const [key] of steps.get(id).step.deps) visit(key);
      active.delete(id); visited.add(id);
    }
    for (const id of steps.keys()) visit(id);
    return {skills,steps};
  }
  const status = (state, id) => state.progress[id]?.status || STATUSES[0];
  function availability(step,state) {
    if (status(state,step.id) === STATUSES[4]) return 'Paused';
    if (status(state,step.id) === STATUSES[3]) return 'Complete';
    if (step.deps.some(([id,min]) => rank(status(state,id)) < min)) return 'Build prerequisite';
    return status(state,step.id) === STATUSES[0] ? 'Ready to start' : 'Continue';
  }
  const stageLabel = value => LABELS[STATUSES.indexOf(value)] || LABELS[0];
  function touch(state) { return {...state,revision:state.revision+1,lastSavedAt:new Date().toISOString()}; }
  function setProgress(state,id,value,notes) {
    if (!STATUSES.includes(value)) throw new Error('Choose a valid progress stage.');
    return touch({...state,progress:{...state.progress,[id]:{status:value,notes:String(notes ?? state.progress[id]?.notes ?? ''),updatedAt:new Date().toISOString()}}});
  }
  function summary(data,state) {
    const counts = {total:0,complete:0,practicing:0,ready:0,paused:0,skills:0};
    const topics = [];
    for (const name of [...new Set(data.skills.map(s=>s.sheet))]) {
      const t={name,total:0,complete:0,practicing:0,paused:0};
      for (const skill of data.skills.filter(s=>s.sheet===name)) {
        if (skill.steps.every(st=>status(state,st.id)===STATUSES[3])) counts.skills++;
        for (const step of skill.steps) {
          t.total++; counts.total++;
          const v = status(state,step.id);
          if (v===STATUSES[3]) { t.complete++; counts.complete++; }
          if ([STATUSES[1],STATUSES[2]].includes(v)) {t.practicing++;counts.practicing++;}
          if (v===STATUSES[4]) {t.paused++;counts.paused++;}
          if (['Ready to start','Continue'].includes(availability(step,state))) counts.ready++;
        }
      }
      topics.push(t);
    }
    return {counts,topics};
  }
  function available(data,state) {
    const triggerTopics = new Set(), triggerSkills = new Set();
    for (const name of state.profile.priorities) {
      const trigger=data.triggers.find(t=>t.name===name);
      const skill=data.skills.find(s=>s.steps.some(st=>st.id===trigger?.step));
      if (skill) {triggerTopics.add(skill.sheet);triggerSkills.add(skill.code);}
    }
    return data.skills.flatMap(skill => skill.steps.map(step=>({skill,step,available:availability(step,state)})))
      .filter(x=>['Continue','Ready to start'].includes(x.available))
      .sort((a,b)=> {
        const score=x=>(x.available==='Continue'?100:0)+(state.favorites.includes(x.skill.code)?40:0)+(triggerSkills.has(x.skill.code)?45:triggerTopics.has(x.skill.sheet)?25:0)+(x.skill.priority==='Core'?10:0);
        return score(b)-score(a);
      });
  }
  function normalizeSession(input) {
    const text = key => String(input[key] ?? '').trim();
    const number = key => {
      if (input[key] === '' || input[key] === null || input[key] === undefined) return null;
      const v = Number(input[key]);
      if (!Number.isFinite(v) || v < 0 || v > Number.MAX_SAFE_INTEGER) throw new Error('Counts and recovery time must be zero or greater.');
      return v;
    };
    const s = {id:text('id')||uid(),date:text('date'),stepId:text('stepId'),type:text('type')||'Skill practice',trigger:text('trigger'),setup:text('setup'),opportunities:number('opportunities'),successes:number('successes'),response:number('response'),recovery:number('recovery'),recoveryState:text('recoveryState'),observations:text('observations'),next:text('next'),createdAt:text('createdAt')||new Date().toISOString()};
    if (!validDate(s.date)) throw new Error('Choose a valid session date.');
    if (s.opportunities !== null && (!Number.isInteger(s.opportunities)||s.opportunities>10000)) throw new Error('Opportunities must be a whole number up to 10,000.');
    if (s.successes !== null && (!Number.isInteger(s.successes)||s.opportunities===null||s.successes>s.opportunities)) throw new Error('Enter opportunities first. Successful or comfortable observations cannot exceed that total.');
    if (s.response !== null && (!Number.isInteger(s.response)||s.response>4)) throw new Error('Choose a response from 0 to 4, or leave it unknown.');
    if (!['','Recovered','Not yet recovered','Not measured'].includes(s.recoveryState)) throw new Error('Choose a valid recovery state.');
    if (s.recovery !== null && s.recoveryState !== 'Recovered') throw new Error('Only record recovery seconds after the dog has recovered; otherwise leave seconds blank.');
    return s;
  }
  function sessionGuidance(s) {
    if (s.recoveryState==='Not yet recovered'||(s.response!==null&&s.response>=2)) return 'Reduce the challenge. Create space or end the exposure, and review the support your dog needs.';
    if (s.opportunities>0&&s.successes!==null&&s.successes/s.opportunities>=.8) return 'Check the lesson’s actual advancement criterion. A good percentage alone does not mean comfort or readiness.';
    return 'Use the lesson criterion and body language to choose an easier or similar next session.';
  }
  function observations(state,trigger) {
    const sessions = state.sessions.filter(s=>s.trigger===trigger).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
    return {
      recovery:sessions.filter(s=>s.recoveryState==='Recovered'&&s.recovery!==null).map(s=>({date:s.date,value:s.recovery,id:s.id})),
      response:sessions.filter(s=>s.response!==null).map(s=>({date:s.date,value:s.response,id:s.id}))
    };
  }
  function validateState(input) {
    const fail=()=>{throw new Error('This backup is incomplete or uses an unsupported format. Your current data has not been changed.');};
    if (!plain(input)||input.schema!==1||!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>1e12||!plain(input.profile)||!plain(input.progress)||!plain(input.plans)||!plain(input.settings)||!Array.isArray(input.sessions)||!Array.isArray(input.favorites)) fail();
    const text=(v,max=30000)=>typeof v==='string'&&v.length<=max;
    const base=freshState();
    for (const key of Object.keys(base.profile).filter(k=>k!=='priorities')) if (!text(input.profile[key])) fail();
    if (!Array.isArray(input.profile.priorities)||input.profile.priorities.length>50||input.profile.priorities.some(x=>!text(x,150))) fail();
    if (!['light','dark','system'].includes(input.settings.theme)||!['normal','large'].includes(input.settings.textSize)) fail();
    if (input.favorites.length>10000||input.favorites.some(x=>!text(x,150))) fail();
    for (const [key,v] of Object.entries(input.progress)) {
      if (!/^[A-Z0-9_-]{1,100}$/.test(key)||!plain(v)||!STATUSES.includes(v.status)||!text(v.notes)||!text(v.updatedAt,100)) fail();
    }
    for (const [key,v] of Object.entries(input.plans)) {
      if (!text(key,150)||!plain(v)) fail();
      for (const k of ['setup','baseline','next','exit','notes']) if (!text(v[k]??'')) fail();
    }
    if (input.sessions.length>10000) fail();
    const sessionIDs=new Set();
    for (const s of input.sessions) {
      if (!plain(s)||!text(s.id,150)||!s.id||sessionIDs.has(s.id)) fail();
      for (const k of ['date','stepId','type','trigger','setup','recoveryState','observations','next','createdAt']) if (!text(s[k])) fail();
      for (const k of ['opportunities','successes','response','recovery']) if (s[k]!==null && (typeof s[k]!=='number'||!Number.isFinite(s[k]))) fail();
      normalizeSession(s);sessionIDs.add(s.id);
    }
    // Copy only defined schema fields. Untrusted keys never become application properties.
    return {
      schema:1,revision:input.revision,createdAt:text(input.createdAt,100)?input.createdAt:base.createdAt,
      lastSavedAt:text(input.lastSavedAt,100)?input.lastSavedAt:'',
      profile:Object.fromEntries(Object.keys(base.profile).map(k=>[k,k==='priorities'?input.profile[k].slice():input.profile[k]])),
      progress:Object.fromEntries(Object.entries(input.progress).map(([k,v])=>[k,{status:v.status,notes:v.notes,updatedAt:v.updatedAt}])),
      favorites:input.favorites.slice(),sessions:input.sessions.map(s=>normalizeSession(s)),
      plans:Object.fromEntries(Object.entries(input.plans).map(([k,v])=>[k,Object.fromEntries(['setup','baseline','next','exit','notes'].map(n=>[n,v[n]??'']))])),
      settings:{theme:input.settings.theme,textSize:input.settings.textSize}
    };
  }
  const makeBackup = (state,data) => ({format:'good-ground-backup',version:1,exportedAt:new Date().toISOString(),curriculumVersion:data.version,state:validateState(state)});
  function parseBackup(text) {
    if (typeof text!=='string'||new TextEncoder().encode(text).length>5*1024*1024) throw new Error('Choose a Good Ground backup smaller than 5 MB.');
    let b; try {b=JSON.parse(text);} catch {throw new Error('This file is not valid JSON. Your current data has not been changed.');}
    if (!plain(b)||b.format!=='good-ground-backup'||b.version!==1) throw new Error('Choose a Good Ground backup file (version 1).');
    return validateState(b.state);
  }
  return {STORAGE_BYTES,withinStorageLimit,STATUSES,LABELS,rank,esc,uid,dateToday,validDate,freshState,index,status,availability,stageLabel,touch,setProgress,summary,available,normalizeSession,sessionGuidance,observations,validateState,makeBackup,parseBackup};
});
