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
    return {schema:1,revision:0,createdAt:new Date().toISOString(),cues:{},tailoring:{traits:[],reviewedBreed:''},household:{primaryId:'dog-1',others:[],selectedIds:['dog-1'],setupComplete:false,setupTarget:0,setupIndex:0,tutorialSeenVersion:0},profile:{name:'',age:'',breed:'',health:'',comfort:'',rewards:'',equipment:'',history:'',help:'',priorities:[]},progress:{},favorites:[],sessions:[],plans:{},settings:{theme:'light',textSize:'normal',markerSound:'click',markerVolume:25,lessonMarker:true,reminderDays:7,remindersDismissedOn:''}};
  }
  // Schema 1 remains the native file envelope. Primary dog fields stay at the
  // root for lossless migration; household.others holds complete additional dogs.
  // trainingView is a temporary projection: never save/export it. All dog writes
  // must name their owner through updateDog/setDogProgress. Backups use version 2
  // so older apps reject household records rather than silently dropping dogs.
  const DOG_FIELDS=['profile','progress','sessions','plans','cues','tailoring'];
  function dogs(state) {
    const first={id:state.household.primaryId,...Object.fromEntries(DOG_FIELDS.map(k=>[k,state[k]]))};
    return [first,...state.household.others];
  }
  function selectedDogs(state) {const ids=new Set(state.household.selectedIds);return dogs(state).filter(d=>ids.has(d.id));}
  function dogState(state,id) {const dog=dogs(state).find(d=>d.id===id);if(!dog)throw new Error('Choose an existing dog.');return {...state,...dog};}
  function updateDog(state,id,update) {
    const dog=dogs(state).find(d=>d.id===id);if(!dog)throw new Error('Choose an existing dog.');
    const next=update(dog),fields=Object.fromEntries(DOG_FIELDS.map(k=>[k,next[k]]));
    if(id===state.household.primaryId)return touch({...state,...fields});
    return touch({...state,household:{...state.household,others:state.household.others.map(d=>d.id===id?{id,...fields}:d)}});
  }
  function addDog(state,profile) {
    if(dogs(state).length>=50)throw new Error('This household already has 50 profiles.');
    const name=String(profile.name||'').trim();
    if(!name||dogs(state).some(d=>!d.profile.name.trim()))throw new Error('Every dog needs a name when there is more than one.');
    if(dogs(state).some(d=>d.profile.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('Use a distinct name or nickname so each dog’s records are easy to recognize.');
    const blank=freshState(),dog={id:uid(),profile:{...blank.profile,...profile,name},progress:{},sessions:[],plans:{},cues:{},tailoring:{traits:[],reviewedBreed:''}};
    return touch({...state,household:{...state.household,others:[...state.household.others,dog]}});
  }
  function selectDogs(state,ids) {
    const known=new Set(dogs(state).map(d=>d.id));
    if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!known.has(id)))throw new Error('Choose at least one dog to train.');
    return touch({...state,household:{...state.household,selectedIds:ids.slice()}});
  }
  function trainingView(state) {
    const chosen=selectedDogs(state);
    if(chosen.length===1)return dogState(state,chosen[0].id);
    const progress={};
    for(const id of new Set(chosen.flatMap(d=>Object.keys(d.progress)))){
      const records=chosen.map(d=>d.progress[id]||{status:STATUSES[0],notes:'',updatedAt:'',completedAt:''});
      const least=records.find(r=>r.status===STATUSES[4])||records.reduce((a,b)=>rank(a.status)<=rank(b.status)?a:b);
      progress[id]={...least,notes:''};
    }
    const profile={...chosen[0].profile,name:chosen.map(d=>d.profile.name||'Your dog').join(' & '),priorities:[...new Set(chosen.flatMap(d=>d.profile.priorities))]};
    return {...state,profile,progress,sessions:chosen.flatMap(d=>d.sessions.map(s=>({...s,dogId:d.id,dogName:d.profile.name}))),plans:{},cues:{},tailoring:{traits:[...new Set(chosen.flatMap(d=>d.tailoring.traits))],reviewedBreed:''}};
  }
  function trainingAvailable(data,state) {
    const choices=available(data,trainingView(state));
    if(selectedDogs(state).length===1)return choices;
    // Group recommendations follow the earliest available gap, rather than a later
    // dog's practiced skill outranking another dog's untouched foundation.
    const order=new Map(data.skills.flatMap(s=>s.steps).map((s,i)=>[s.id,i]));
    return choices.sort((a,b)=>order.get(a.step.id)-order.get(b.step.id));
  }
  function setDogProgress(state,dogIds,id,value) {
    let next=state;
    for(const dogId of dogIds)next=updateDog(next,dogId,()=>{
      const view=setProgress(dogState(next,dogId),id,value);return view;
    });
    return next;
  }
  function practiceRecords(data,state,now=new Date()) {
    return selectedDogs(state).flatMap(d=>maintenance(data,dogState(state,d.id),now).map(r=>({...r,dogId:d.id,dogName:d.profile.name}))).sort((a,b)=>(b.days??-1)-(a.days??-1));
  }
  const FORMAT_GUARD='GOOD_GROUND_FORMAT_V2',FORMAT_STATUS='Requires Good Ground 1.1';
  // The unchanged native shell requires schema 1. This reserved wire-only entry
  // makes an older JS validator stop safely instead of overwriting extra dogs.
  function storageState(state) {
    return {...state,progress:{...state.progress,[FORMAT_GUARD]:{status:FORMAT_STATUS,notes:'Open these records with Good Ground 1.1 or later.',updatedAt:'format-v2'}}};
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
    const old=state.progress[id],now=new Date().toISOString();
    const completedAt=value===STATUSES[3]?(old?.status===value?(old.completedAt||old.updatedAt):now):(old?.completedAt||'');
    return touch({...state,progress:{...state.progress,[id]:{status:value,notes:String(notes ?? old?.notes ?? ''),updatedAt:now,completedAt}}});
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
    const supportSkills=new Set((state.tailoring?.traits||[]).flatMap(t=>({noise:['SAFE','SOUND','STORM'],novelty:['SAFE','OBJECT'],handling:['CHIN','HARNESS']}[t]||[])));
    return data.skills.flatMap(skill => skill.steps.map(step=>({skill,step,available:availability(step,state)})))
      .filter(x=>['Continue','Ready to start'].includes(x.available))
      .sort((a,b)=> {
        const score=x=>(x.available==='Continue'?100:0)+(state.favorites.includes(x.skill.code)?40:0)+(triggerSkills.has(x.skill.code)?45:triggerTopics.has(x.skill.sheet)?25:0)+(x.skill.priority==='Core'?10:0)+(supportSkills.has(x.skill.code)?30:0);
        return score(b)-score(a);
      });
  }
  function nextChoices(data,state,finishedCode) {
    const finished=data.skills.find(s=>s.code===finishedCode),seen=new Set();
    const choices=available(data,state).filter(x=>x.skill.code!==finishedCode).filter(x=>{if(seen.has(x.skill.code))return false;seen.add(x.skill.code);return true;});
    const fun=choices.find(x=>['Enrichment','Optional trick'].includes(x.skill.priority));
    const practical=choices.filter(x=>!['Enrichment','Optional trick','Optional advanced'].includes(x.skill.priority))
      .sort((a,b)=>{
        const score=x=>(x.step.deps.some(([key])=>finished?.steps.some(s=>s.id===key))?30:0)+(x.skill.sheet===finished?.sheet?10:0)+(x.skill.priority==='Core'?5:0);
        return score(b)-score(a);
      }).slice(0,3);
    return {practical,fun};
  }
  function downstreamSkills(data,code) {
    const original=data.skills.find(s=>s.code===code);if(!original)return [];
    const ids=new Set(original.steps.map(s=>s.id));
    return data.skills.filter(s=>s.code!==code).map(skill=>({skill,step:skill.steps.find(st=>st.deps.some(([id])=>ids.has(id)))})).filter(x=>x.step);
  }
  const MAINTENANCE_CODES=new Set(['NAME','TOUCH','SIT','DOWN','STAND','FREE','DROP','LEAVE','WAIT','RECALL','OTARGET','MAT','SETTLE','CHECK','LOOSE','TURN','FIND','SIDE','CHIN','NAMECTX','RECALLCTX','MATCTX','WALKCTX']);
  function daysBetween(earlier,later) {
    if(!validDate(earlier)||!validDate(later))return null;
    return Math.floor((Date.parse(later+'T12:00:00Z')-Date.parse(earlier+'T12:00:00Z'))/86400000);
  }
  function practiceRecord(skill,state,now=new Date()) {
    const today=dateToday(now),ids=new Set(skill.steps.map(s=>s.id));
    const sessions=state.sessions.filter(s=>s.type==='Skill practice'&&ids.has(s.stepId)&&validDate(s.date)&&s.date<=today).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
    const learned=skill.steps.every(st=>status(state,st.id)===STATUSES[3]);
    const dates=learned?skill.steps.map(st=>state.progress[st.id]?.completedAt||state.progress[st.id]?.updatedAt).filter(v=>v&&Number.isFinite(+new Date(v))).map(v=>dateToday(new Date(v))).filter(d=>d<=today).sort():[];
    const learnedOn=dates.at(-1)||'',lastPractice=sessions[0]?.date||'';
    // Consistency starts the reminder clock, but is never presented as a practice log.
    const basisDate=[lastPractice,learnedOn].filter(Boolean).sort().at(-1)||'';
    return {skill,learned,lastPractice,learnedOn,basisDate,days:daysBetween(basisDate,today),practiceDays:daysBetween(lastPractice,today)};
  }
  function maintenance(data,state,now=new Date()) {
    return data.skills.filter(s=>MAINTENANCE_CODES.has(s.code)).map(s=>practiceRecord(s,state,now))
      .filter(x=>x.learned).sort((a,b)=>(b.days??-1)-(a.days??-1));
  }
  function elapsedLabel(days) {
    if(days===null)return 'No practice logged yet';
    if(days===0)return 'Today';if(days===1)return '1 day ago';
    if(days<14)return days+' days ago';
    if(days<60)return Math.floor(days/7)+' weeks ago';
    return Math.floor(days/30)+' months ago';
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
    for (const key of Object.keys(base.profile).filter(k=>k!=='priorities')) if (!(key==='breed'&&input.profile[key]===undefined)&&!text(input.profile[key])) fail();
    if (!Array.isArray(input.profile.priorities)||input.profile.priorities.length>50||input.profile.priorities.some(x=>!text(x,150))) fail();
    if (!['light','dark','system'].includes(input.settings.theme)||!['normal','large'].includes(input.settings.textSize)) fail();
    if (input.favorites.length>10000||input.favorites.some(x=>!text(x,150))) fail();
    for (const [key,v] of Object.entries(input.progress)) {
      if(key===FORMAT_GUARD){if(!plain(v)||v.status!==FORMAT_STATUS||!text(v.notes)||!text(v.updatedAt,100))fail();continue;}
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
    const result={
      schema:1,revision:input.revision,createdAt:text(input.createdAt,100)?input.createdAt:base.createdAt,
      lastSavedAt:text(input.lastSavedAt,100)?input.lastSavedAt:'',
      profile:Object.fromEntries(Object.keys(base.profile).map(k=>[k,k==='priorities'?input.profile[k].slice():k==='breed'?(input.profile[k]??''):input.profile[k]])),
      progress:Object.fromEntries(Object.entries(input.progress).filter(([k])=>k!==FORMAT_GUARD).map(([k,v])=>[k,{status:v.status,notes:v.notes,updatedAt:v.updatedAt,completedAt:text(v.completedAt,100)?v.completedAt:(v.status===STATUSES[3]?v.updatedAt:'')}])),
      favorites:input.favorites.slice(),sessions:input.sessions.map(s=>normalizeSession(s)),
      plans:Object.fromEntries(Object.entries(input.plans).map(([k,v])=>[k,Object.fromEntries(['setup','baseline','next','exit','notes'].map(n=>[n,v[n]??'']))])),
      settings:{theme:input.settings.theme,textSize:input.settings.textSize,markerSound:['click','ding','pop','buzz'].includes(input.settings.markerSound)?input.settings.markerSound:'click',markerVolume:Number.isFinite(input.settings.markerVolume)?Math.max(0,Math.min(100,input.settings.markerVolume)):25,lessonMarker:input.settings.lessonMarker!==false,reminderDays:[0,7,14,30].includes(input.settings.reminderDays)?input.settings.reminderDays:7,remindersDismissedOn:validDate(input.settings.remindersDismissedOn)?input.settings.remindersDismissedOn:''}
    };
    const cueCopy=raw=>{
      if(raw===undefined)return {};
      if(!plain(raw)||Object.keys(raw).length>10000)fail();
      for(const [key,value] of Object.entries(raw))if(!/^[A-Z0-9_-]{1,100}$/.test(key)||!text(value,200))fail();
      return Object.fromEntries(Object.entries(raw));
    };
    result.cues=cueCopy(input.cues);
    if(input.tailoring===undefined)result.tailoring={traits:[],reviewedBreed:''};
    else {
      const t=input.tailoring;
      if(!plain(t)||!Array.isArray(t.traits)||t.traits.length>3||new Set(t.traits).size!==t.traits.length||t.traits.some(x=>!['noise','novelty','handling'].includes(x))||!text(t.reviewedBreed,200))fail();
      result.tailoring={traits:t.traits.slice(),reviewedBreed:t.reviewedBreed};
    }
    if(input.household===undefined){
      // An existing single-dog save is already in use. Keep it intact and do not
      // force setup or the first-launch guide over a migrated user's work.
      result.household={...base.household,setupComplete:true,tutorialSeenVersion:1};
    }else{
      const h=input.household,idOK=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
      if(!plain(h)||!idOK(h.primaryId)||!Array.isArray(h.others)||h.others.length>49||!Array.isArray(h.selectedIds)||!h.selectedIds.length||h.selectedIds.length>50||typeof h.setupComplete!=='boolean'||!Number.isInteger(h.setupTarget)||h.setupTarget<0||h.setupTarget>50||!Number.isInteger(h.setupIndex)||h.setupIndex<0||h.setupIndex>h.setupTarget||!Number.isInteger(h.tutorialSeenVersion)||h.tutorialSeenVersion<0||h.tutorialSeenVersion>10000)fail();
      const ids=new Set([h.primaryId]),sessionIDs=new Set(result.sessions.map(s=>s.id)),others=[];
      for(const dog of h.others){
        if(!plain(dog)||!idOK(dog.id)||ids.has(dog.id))fail();ids.add(dog.id);
        const copy=validateState({schema:1,revision:0,createdAt:result.createdAt,profile:dog.profile,progress:dog.progress,sessions:dog.sessions,plans:dog.plans,cues:dog.cues,tailoring:dog.tailoring,settings:base.settings,favorites:[]});
        for(const entry of copy.sessions){if(sessionIDs.has(entry.id))fail();sessionIDs.add(entry.id);}
        others.push({id:dog.id,...Object.fromEntries(DOG_FIELDS.map(k=>[k,copy[k]]))});
      }
      if(h.selectedIds.some(id=>!ids.has(id))||new Set(h.selectedIds).size!==h.selectedIds.length)fail();
      const profiles=[result.profile,...others.map(d=>d.profile)];
      if(h.setupIndex>profiles.length||(h.setupComplete&&h.setupTarget>0&&h.setupIndex!==h.setupTarget))fail();
      if(h.setupTarget>1&&h.setupIndex){const names=profiles.slice(0,h.setupIndex).map(p=>p.name.trim().toLocaleLowerCase());if(names.some(n=>!n)||new Set(names).size!==names.length)fail();}
      // A previous native snapshot can fall between the old final index write and
      // completion write. All profiles exist: resume at the tour, not an extra dog.
      const setupComplete=h.setupComplete||(h.setupTarget>0&&h.setupIndex===h.setupTarget);
      if(h.others.length&&setupComplete){const names=[result.profile.name,...others.map(d=>d.profile.name)].map(n=>n.trim().toLocaleLowerCase());if(names.some(n=>!n)||new Set(names).size!==names.length)fail();}
      result.household={primaryId:h.primaryId,others,selectedIds:h.selectedIds.slice(),setupComplete,setupTarget:h.setupTarget,setupIndex:h.setupIndex,tutorialSeenVersion:h.tutorialSeenVersion};
    }
    return result;
  }
  const makeBackup = (state,data) => ({format:'good-ground-backup',version:2,exportedAt:new Date().toISOString(),curriculumVersion:data.version,state:validateState(state)});
  function parseBackup(text) {
    if (typeof text!=='string'||new TextEncoder().encode(text).length>5*1024*1024) throw new Error('Choose a Good Ground backup smaller than 5 MB.');
    let b; try {b=JSON.parse(text);} catch {throw new Error('This file is not valid JSON. Your current data has not been changed.');}
    if (!plain(b)||b.format!=='good-ground-backup'||![1,2].includes(b.version)) throw new Error('Choose a Good Ground backup file (version 1 or 2).');
    return validateState(b.state);
  }
  return {STORAGE_BYTES,withinStorageLimit,STATUSES,LABELS,rank,esc,uid,dateToday,validDate,freshState,storageState,FORMAT_GUARD,dogs,selectedDogs,dogState,updateDog,addDog,selectDogs,trainingView,trainingAvailable,setDogProgress,practiceRecords,index,status,availability,stageLabel,touch,setProgress,summary,available,nextChoices,downstreamSkills,daysBetween,practiceRecord,maintenance,elapsedLabel,MAINTENANCE_CODES,normalizeSession,sessionGuidance,observations,validateState,makeBackup,parseBackup};
});
