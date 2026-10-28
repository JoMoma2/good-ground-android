(function () {
  'use strict';
  const C=GroundCore, D=GOOD_GROUND_DATA, I=C.index(D), $=s=>document.querySelector(s), E=C.esc;
  const itemFor=id=>I.steps.get(id)||I.archivedSteps.get(id);
  const native=!!window.GOOD_GROUND_BOOT?.native, STORAGE='good-ground-state-v1';
  let currentLesson='',training,profileDogId='',planDogId='',trendDogId='';
  let learnPage=0;const topicPages=new Map(),topicQueries=new Map(),LIBRARY_PAGE_SIZE=12;
  let state, loadError='', dirty=false, pendingBackup=null, modalReturn=null, timer=null;
  const routePositions=new Map(),routeTrail=[];let returningBack=false,pendingScroll=0,sourceContext=null,renderedHash=location.hash||'#/today';
  let saveStatus=native?'Saved on this phone':'Saved in this browser', acknowledged=-1, route='', learnQuery='', learnFilter='all', learnTopic='', journalFilter='', trendTrigger='Other dogs';
  try {
    const initial=native?window.GOOD_GROUND_BOOT.state:JSON.parse(localStorage.getItem(STORAGE)||'null');
    state=initial?C.validateState(initial):C.freshState();
    loadError=window.GOOD_GROUND_BOOT?.error||'';
  } catch {state=C.freshState();loadError='Your saved data could not be read. Import a backup before making new changes; the original saved data has been kept.';}
  if(loadError)saveStatus='Saved records need recovery';
  let settingsSaveBusy=false,settingsWaiter=null;
  let needsDogChoice=C.dogs(state).length>1,guideIndex=0,profileContinuation=null,breedTarget=null,breedQuery='',markerPointer=null,markerKey=null;
  const icons={
    home:'<path d="m3 11 9-8 9 8v9H6v-9M9 20v-7h6v7"/>',
    learn:'<path d="M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4zM12 6v16"/>',
    journal:'<path d="M7 4h13v17H7zM4 7h6M4 12h6M4 17h6M13 8h4M13 12h4"/>',
    chart:'<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
    more:'<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
    arrow:'<path d="m9 5 7 7-7 7"/>',back:'<path d="m15 5-7 7 7 7"/>',
    check:'<path d="m5 12 4 4L20 5"/>',plus:'<path d="M12 4v16M4 12h16"/>',close:'<path d="m5 5 14 14M5 19 19 5"/>',
    heart:'<path d="M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-5 5 8 15 8 15S25 10 20 5Z"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    leaf:'<path d="M19 3C4 2 1 10 6 15s14 0 13-12ZM5 20 16 7"/>',
    dog:'<path d="m6 10-3-7 7 2h6l5-2-2 8v7l-5 3h-4l-4-3Z"/><path d="M9 12h.1M15 12h.1M10 16h4l-2 2Z"/>',
    shield:'<path d="m12 3 8 3v7c0 5-8 9-8 9S4 18 4 13V6zM8 12l3 3 5-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    sound:'<path d="m4 9 4 0 5-5v16l-5-5H4zM17 8c3 2 3 6 0 8M20 5c5 5 5 9 0 14"/>',
    door:'<path d="M5 21V3h13v18M3 21h18M14 12h.1"/>',
    walk:'<path d="m6 20 4-7 4 1 4 6M5 10l5-3 4 4 5-2M10 7v6"/><circle cx="12" cy="3" r="2"/>',
    star:'<path d="m12 3 3 6 6 1-4.5 4.5 1 6.5L12 18l-5.5 3 1-6.5L3 10l6-1Z"/>',
    care:'<path d="M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z"/>',
    box:'<path d="m3 7 9-4 9 4-9 4ZM3 7v12l9 3 9-3V7M12 11v11"/>',
    restore:'<path d="M4 5v6h6M4 11a8 8 0 1 1 1 7M12 8v5l3 2"/>',
    save:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    book:'<path d="M4 3h13l3 3v15H4zM8 8h8M8 12h8M8 16h5"/>',
    tune:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  };
  function icon(name,cls='') {return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.leaf}</svg>`;}
  const topicNames=[...new Set(D.skills.map(s=>s.sheet))];
  const topicIndex=name=>{const i=topicNames.indexOf(name);return i>=0?i:14;};
  GroundHistory.palette.forEach((color,i)=>document.documentElement.style.setProperty('--topic-'+i,color));
  const topicIcon=name=>({'Foundations':'learn','Calm at home':'home','Walk skills':'walk','Other dogs':'dog','People and door':'door','Sounds and novelty':'sound','Care and equipment':'care','Play and jobs':'star','Fridge task':'box','Practice elsewhere':'leaf','Clever companions':'star','Useful little jobs':'box','Scent adventures':'search','Body awareness':'walk'}[name]||'star');
  const topicSubtitle=name=>({'Foundations':'A shared language','Calm at home':'Rest, choice & predictability','Walk skills':'Room to explore','Other dogs':'Comfort at a distance','People and door':'Quieter arrivals','Sounds and novelty':'One gentle change at a time','Care and equipment':'Cooperation comes first','Play and jobs':'Joy with a purpose','Fridge task':'A complete retrieval chain','Practice elsewhere':'Take a known skill somewhere new','Brainiacs':'Big projects, small teaching steps','Clever companions':'Little moments of brilliance','Useful little jobs':'A helping paw','Scent adventures':'Follow their favorite sense','Body awareness':'Easy, comfortable movement'}[name]||'Explore something enjoyable');
  const path=(type,id)=>'#/'+type+(id?'/'+encodeURIComponent(id):'');
  const link=(type,id,label,cls='')=>`<a class="${cls}" href="${path(type,id)}">${label}</a>`;
  const pill=(text,cls='')=>`<span class="pill ${cls}">${E(text)}</span>`;
  const badge=avail=>pill(avail,avail==='Complete'?'complete':['Ready to start','Continue'].includes(avail)?'ready':'muted');
  const empty=(title,body,action='')=>`<div class="empty">${icon('leaf')}<h3>${E(title)}</h3><p>${E(body)}</p>${action}</div>`;
  const section=(title,action='')=>`<div class="section-heading"><h2>${title}</h2>${action}</div>`;
  const statLabel=value=>C.stageLabel(value);
  const sourceIDs=text=>(text||'').match(/\b[RPNAV]\d+\b/g)||[];
  const sourceLinks=text=>`<div class="source-chips">${sourceIDs(text).map(id=>link('source',id,E(id),'source-chip')).join('')}</div>`;
  function dateLabel(value) {const d=new Date(value+'T12:00:00');return isNaN(+d)?value:d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
  function send(action,payload={}) {
    const message={action,...payload};
    if(window.GroundAndroid?.postMessage)window.GroundAndroid.postMessage(JSON.stringify(message));
    else window.webkit?.messageHandlers?.ground?.postMessage(message);
  }
  function applySettings() {
    const theme=state.settings.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):state.settings.theme;
    document.documentElement.dataset.theme=theme;
    document.documentElement.dataset.text=state.settings.textSize;
    send('theme',{theme:state.settings.theme});
  }
  function showSave() {const warning=$('#save-warning');if(warning)warning.hidden=!saveStatus.includes('not');document.querySelectorAll('[data-save-indicator]').forEach(el=>{el.textContent=saveStatus;el.classList.toggle('save-error',saveStatus.includes('not'));});}
  function flush() {
    if (loadError) return;
    if (native) {saveStatus='Saving on this phone…';send('save',{state:C.storageState(state)});}
    else {
      try {localStorage.setItem(STORAGE,JSON.stringify(C.storageState(state)));saveStatus='Saved in this browser';acknowledged=state.revision;}
      catch {saveStatus='Could not save — export a backup';toast('Browser storage is unavailable. Export a backup to keep these changes.',true);}
    }
    showSave();
  }
  function commit(next) {try{next=C.observeProgress(D,next);}catch(error){toast(error.message,true);return false;}if(!C.withinStorageLimit(next)){toast('Records are at the storage limit. Export a backup, then shorten notes or remove older sessions before saving more.',true);return false;}if(loadError){toast('Restore a backup before making changes.',true);return false;}state=next;flush();return true;}
  function toast(message,error=false) {const el=$('#toast');el.textContent=message;el.className=error?'visible error':'visible';clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>el.className='',error?6500:3200);}
  function openModal(title,body,wide=false) {
    modalReturn=document.activeElement;
    $('#modal-root').innerHTML=`<div class="modal-shade"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><h2 id="modal-title">${E(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>${body}</section></div>`;
    document.body.classList.add('modal-open');$('#app').inert=true;
    requestAnimationFrame(()=>($('#modal-root [autofocus]')||$('#modal-root button, #modal-root input, #modal-root select'))?.focus());
  }
  function closeModal() {$('#modal-root').innerHTML='';document.body.classList.remove('modal-open');$('#app').inert=false;modalReturn?.focus?.();const resume=profileContinuation;profileContinuation=null;if(resume)resume();}
  function confirmAction(title,body,action,label='Continue',danger=false) {openModal(title,`<p>${E(body)}</p><div class="button-row"><button class="button secondary" data-action="close-modal">Cancel</button><button class="button ${danger?'danger':''}" data-action="${action}">${E(label)}</button></div>`);}
  function selectOptions(items,value,blank) {return (blank!==undefined?`<option value="">${E(blank)}</option>`:'')+items.map(item=>{const [v,label]=Array.isArray(item)?item:[item,item];return `<option value="${E(v)}" ${v===value?'selected':''}>${E(label)}</option>`;}).join('');}
  function inputField(label,name,value='',type='text',hint='') {return `<label class="field"><span>${E(label)}</span><input name="${name}" type="${type}" value="${E(value)}" ${type==='number'?'min="0" step="any"':''} maxlength="5000">${hint?`<small>${E(hint)}</small>`:''}</label>`;}
  function textField(label,name,value='',hint='') {return `<label class="field"><span>${E(label)}</span><textarea name="${name}" rows="3" maxlength="30000">${E(value)}</textarea>${hint?`<small>${E(hint)}</small>`:''}</label>`;}
  function selectField(label,name,items,value='',blank) {return `<label class="field"><span>${E(label)}</span><select name="${name}">${selectOptions(items,value,blank)}</select></label>`;}
  const formError=()=>'<p class="form-error" role="alert" hidden></p>';
  function failForm(form,message) {const el=form.querySelector('.form-error');if(el){el.textContent=message;el.hidden=false;el.scrollIntoView({block:'center',behavior:'smooth'});}else if(route!=='feedback')toast(message,true);}
  function lessonCard(skill,step,compact=false) {
    const a=C.availability(step,training);
    return link('lesson',step.id,`<div class="lesson-symbol">${icon(topicIcon(skill.sheet))}</div><div class="card-copy"><div class="eyebrow">${E(skill.sheet)}</div><h3>${E(skill.title)}</h3><p>${E(step.title)}</p>${competentNote(step.id)}<div class="card-meta">${badge(a)}<span>Step ${skill.steps.indexOf(step)+1} of ${skill.steps.length}</span></div></div>${icon('arrow','chevron')}`,'lesson-card '+(compact?'compact':''));
  }
  function competentNote(id) {
    const selected=C.selectedDogs(state);if(selected.length<2)return '';
    const known=selected.filter(d=>C.status(C.dogState(state,d.id),id)===C.STATUSES[3]);
    if(!known.length||known.length===selected.length)return '';
    return `<small class="already-known">${E(known.map(d=>d.profile.name).join(', '))} ${known.length===1?'already has':'already have'} this step recorded as consistent.</small>`;
  }
  function trainingContext() {
    if(C.dogs(state).length<2)return '';
    return `<div class="training-context"><button data-action="choose-dogs">${icon('dog')}<span>Training · ${E(C.selectedDogs(state).map(d=>d.profile.name).join(' + '))}</span>${icon('tune')}</button></div>`;
  }
  function dogNotes(id) {
    return C.selectedDogs(state).map((dog,i)=>`<label class="field"><span class="${C.selectedDogs(state).length===1?'sr-only':''}">${C.selectedDogs(state).length===1?'Notes for this teaching step':E(dog.profile.name)+'’s notes'}</span><textarea ${i===0?'id="step-notes"':''} data-step-notes data-id="${E(id)}" data-dog-id="${E(dog.id)}" rows="3" maxlength="30000" placeholder="What made this comfortable? What helped?">${E(dog.progress[id]?.notes||'')}</textarea><small>Saved for ${E(dog.profile.name||'your dog')} when you leave this field.</small></label>`).join('');
  }
  function cueSkill(code) {return I.skills.get(code);}
  function defaultCue(skill,dog) {return ['NAME','NAMECTX'].includes(skill.code)&&dog.profile.name?dog.profile.name:skill.cue;}
  function cueFields(skill) {
    const chosen=C.selectedDogs(state);
    return chosen.map(d=>{
      const fallback=defaultCue(skill,d),cue=d.cues[skill.code]??fallback,custom=cue!==fallback;
      return `<div class="cue-row"><label class="cue-line"><span>${chosen.length>1?E(d.profile.name)+'’s cue':'Cue'}</span><input class="cue-input" data-cue-input data-skill="${E(skill.code)}" data-dog-id="${E(d.id)}" value="${E(cue)}" maxlength="200" aria-label="Cue for ${E(skill.title)}, ${E(d.profile.name||'your dog')}" autocomplete="off" spellcheck="false"></label><small class="custom-cue-note" ${custom?'':'hidden'}>${custom?'Use “'+E(cue)+'” where the guide suggests “'+E(skill.cue)+'”.':''}</small></div>`;
    }).join('');
  }
  function heroArt() {return `<svg class="hero-art" viewBox="0 0 180 165" aria-hidden="true"><path d="M6 144c32-14 118-14 169 0" fill="none" stroke="#b6cec0" stroke-width="2"/><path d="M142 142c-1-29 13-37 14-57M143 116l-13-13M150 103l13-14" stroke="#7eaa8a" stroke-width="3" fill="none"/><ellipse cx="86" cy="124" rx="43" ry="8" fill="#183e35" opacity=".11"/><path d="M54 87c-15 1-24-9-22-22 10 14 21 7 29 9" fill="#294b40"/><path d="M54 81c9-11 24-8 33-2l22 1c14 1 14 17 3 21l-7 21H94l2-26H76l-6 26H59l-1-25" fill="#294b40"/><path d="M83 76V53c-3-20 33-23 35-2l9 12c2 5-3 9-12 9l-6 14Z" fill="#294b40"/><path d="M86 46 78 26c-10 0-13 26 6 31M108 43l12-11c7 10 3 18-5 21" fill="#183b33"/><path d="m97 70 1 18 11-4 7-12" fill="#ebdebd"/><circle cx="108" cy="53" r="2.2" fill="#fcf8e8"/><path d="m122 61 6 1-2 4" fill="#162e29"/><path d="m86 79 24 5" stroke="#dd996c" stroke-width="5"/><path d="M23 133c0-23 12-19 12-36M25 115l-8-8" stroke="#95b89d" stroke-width="3" fill="none"/><circle cx="142" cy="28" r="13" fill="#f0c99a"/></svg>`;}
  function todayView() {
    const sum=C.summary(D,training), choices=C.startingAvailable(D,state), inProgress=choices.filter(x=>x.available==='Continue');
    const greeting=training.profile.name?`For ${E(training.profile.name)}. At their pace.`:'A little practice. A lot of kindness.';
    return `<div class="home-heading"><div><span class="brand-kicker">GOOD GROUND</span><p class="quiet">${greeting}</p></div><button class="icon-button profile-button" data-go="dogs" aria-label="Your dogs and profiles">${icon('dog')}</button></div>
    <section class="hero"><div class="hero-copy"><span class="eyebrow">ONE COMFORTABLE STEP</span><h1>Small steps.<br>Better days.</h1><p>Build confidence, find the fun, and learn together.</p></div>${heroArt()}</section>
    ${!training.profile.name?`<a href="#/profile" class="intro-link">${icon('tune')}<span>Make this your dog’s space<small>Add their name, rewards, and priorities</small></span>${icon('arrow')}</a>`:''}
    <div class="stat-strip"><div><strong>${sum.counts.complete}</strong><span>steps learned</span></div><div><strong>${sum.counts.practicing}</strong><span>in practice</span></div><div><strong>${training.sessions.length}</strong><span>${C.selectedDogs(state).length>1?'practice records':'sessions logged'}</span></div></div>${C.selectedDogs(state).length>1?'<p class="shared-progress-note">A shared step is learned when each selected dog is consistent.</p>':''}
    ${dailyPracticeCard()}${refresherNotice()}
    ${section(C.selectedDogs(state).length>1?'A good place to begin together':inProgress.length?'Pick up where you left off':'A good place to begin',`<button class="text-button" data-action="available">See all ${icon('arrow')}</button>`)}
    <div class="stack">${choices.slice(0,3).map(x=>lessonCard(x.skill,x.step,true)).join('')||empty('Room for something new','Browse the library, revisit a favorite, or simply enjoy a restful day.',link('learn','','Explore lessons','button'))}</div>
    ${tailoredToday()}${funSuggestion(C.trainingAvailable(D,state))}
    <a class="comfort-note" href="#/basics">${icon('leaf')}<span><strong>Comfort comes before consistency.</strong><small>Food-taking, silence, or a sit alone do not establish calm. Learn what to watch for.</small></span>${icon('arrow')}</a>
    ${section('Explore together',link('learn','','All lessons '+icon('arrow'),'text-link'))}
    <div class="topic-grid">${['Other dogs','People and door','Sounds and novelty','Play and jobs'].map(t=>`<a class="topic-card" href="${path('topic',t)}"><div class="topic-symbol">${icon(topicIcon(t))}</div><h3>${E(t)}</h3><p>${topicSubtitle(t)}</p></a>`).join('')}</div>
    <div class="footer-note">${icon('shield')}<span>${native?'Works offline. Saved on your phone.':'Browser preview · data stays in this browser.'}</span></div>`;
  }
  function funSuggestion(choices) {
    const play=choices.filter(x=>['Enrichment','Optional trick'].includes(x.skill.priority));
    if(!play.length)return '';
    const seed=[...C.dateToday()].reduce((sum,c)=>sum+c.charCodeAt(0),0),choice=play[seed%play.length];
    return `${section('Just for the joy of it',`<button class="text-button" data-action="fun-pick">Another idea ${icon('restore')}</button>`)}<div id="fun-suggestion">${lessonCard(choice.skill,choice.step,true)}</div>`;
  }
  function trainingTools() {
    return `<nav class="training-tools" aria-label="Training tools">${state.settings.lessonMarker?link('clicker',currentLesson,icon('sound')+'Clicker','button secondary'):''}${link('trends','',icon('chart')+'Trends','button secondary')}${link('plans','',icon('tune')+'Trigger plans','button secondary')}${link('practice','',icon('clock')+'Practice rhythm','button secondary')}</nav>`;
  }
  function learnView() {
    return `<div class="page-title library-heading"><span class="eyebrow">THE LESSON LIBRARY</span><h1>Lessons</h1><p>${D.skills.length} skills. Search for one or choose a topic.</p></div>
    <label class="search-field">${icon('search')}<span class="sr-only">Search skills, goals, cues, or Step IDs</span><input id="learn-search" type="search" placeholder="Find a skill, cue, or Step ID" value="${E(learnQuery)}" autocomplete="off" aria-controls="learn-results"></label>
    <div class="filter-row" aria-label="Filter lessons">${[['all','All lessons'],['available','Ready / practicing'],['favorites','Saved'],['complete','Learned']].map(([id,label])=>`<button data-action="learn-filter" data-value="${id}" class="filter-chip ${learnFilter===id?'selected':''}" aria-pressed="${learnFilter===id}">${label}</button>`).join('')}</div>
    <label class="field topic-select"><span class="sr-only">Choose a topic</span><select id="learn-topic" aria-controls="learn-results">${selectOptions(topicNames,learnTopic,'All topics')}</select></label>
    <div id="learn-results">${learnResults()}</div><div class="library-tools"><h2>Practice tools</h2>${trainingTools()}</div>`;
  }
  const searchWords=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\p{M}\p{S}]+/gu,' ').trim().split(/\s+/).filter(Boolean);
  function librarySelection(query='',topic='',filter='all') {
    const exactStep=itemFor(query.trim().toUpperCase()),terms=searchWords(query);
    const skills=D.skills.filter(skill=>{
      if(topic&&skill.sheet!==topic||exactStep&&skill.code!==exactStep.skill.code)return false;
      if(filter==='favorites'&&!state.favorites.includes(skill.code))return false;
      if(filter==='complete'&&!skill.steps.every(st=>C.status(training,st.id)===C.STATUSES[3]))return false;
      if(filter==='available'&&!skill.steps.some(st=>['Ready to start','Continue'].includes(C.availability(st,training))))return false;
      if(exactStep)return true;if(!terms.length)return !query.trim();
      const words=searchWords([skill.title,skill.goal,skill.cue,skill.sheet,skill.code,...C.selectedDogs(state).map(d=>d.cues[skill.code]||''),...(skill.project?[...skill.project.modules.map(m=>m.code),...skill.project.foundations].map(code=>I.skills.get(code).title):[]),...skill.steps.map(st=>st.id+' '+st.title)].join(' '));
      return terms.every(term=>words.some(word=>word.startsWith(term)));
    });
    if(terms.length&&!exactStep){
      const phrase=terms.join(' '),score=skill=>skill.code.toLowerCase()===query.trim().toLowerCase()?0:searchWords(skill.title).join(' ')===phrase?1:searchWords(skill.title).join(' ').startsWith(phrase)?2:3;
      skills.sort((a,b)=>score(a)-score(b));
    }
    return {skills,exactStep};
  }
  function learnResults() {
    const query=learnQuery.trim();
    if(!query&&!learnTopic&&learnFilter==='available'&&!librarySelection('','',learnFilter).skills.length)return empty('No ready or practicing skills','Browse all lessons to revisit a learned skill or choose another starting point.','<button class="button secondary" data-action="learn-filter" data-value="all">Show all lessons</button>');
    if(!query&&!learnTopic&&['all','available'].includes(learnFilter))return `<section class="library-directory" aria-labelledby="library-topics-title"><h2 id="library-topics-title">Browse by topic</h2><p class="fineprint">Open one topic to see its skills. Search above to look across the whole library.</p><div class="library-topic-grid">${topicNames.map(topic=>{
      const skills=librarySelection('',topic,learnFilter).skills;if(!skills.length)return '';const complete=skills.filter(s=>s.steps.every(st=>C.status(training,st.id)===C.STATUSES[3])).length;
      return link('topic',topic,`${icon(topicIcon(topic))}<strong>${E(topic)}</strong><small>${skills.length} ${skills.length===1?'skill':'skills'}${learnFilter==='available'?' ready / practicing':complete?' · '+complete+' learned':''}</small>`,'library-topic');
    }).join('')}</div></section>`;
    const selected=librarySelection(query,learnTopic,learnFilter);
    if(selected.exactStep?.archived)return '<p class="fineprint">Earlier guide · saved records remain available.</p>'+lessonCard(selected.exactStep.skill,selected.exactStep.step,true);
    return libraryResults(selected,{page:learnPage,kind:'learn'});
  }
  function librarySkillRows(skills,exactStep=null) {
    return `<div class="stack library-skill-list">${skills.map(skill=>{
      const step=exactStep?.step||skill.steps.find(st=>['Continue','Ready to start'].includes(C.availability(st,training)))||skill.steps.find(st=>C.status(training,st.id)!==C.STATUSES[3])||skill.steps[0];
      const complete=skill.steps.filter(st=>C.status(training,st.id)===C.STATUSES[3]).length,project=skill.project&&!exactStep;
      const label=complete===skill.steps.length?'Learned':C.availability(step,training);
      return link(project?'project':'lesson',project?skill.code:step.id,`<div class="card-copy"><h3>${E(skill.title)}</h3><p class="library-meta">${exactStep?E(step.id)+' · '+E(step.title):E(label)+' · '+complete+'/'+skill.steps.length+' steps consistent'}${project?' · Project':''}</p></div>${icon('arrow')}`,'lesson-card library-skill'+(project?' project-card':'')).replace('<a ',`<a data-skill-code="${E(skill.code)}" `);
    }).join('')}</div>`;
  }
  function libraryResults({skills,exactStep},{page=0,kind='learn',topic=''}={}) {
    if(!skills.length)return empty('No matching skills','Try fewer words, a different topic, or All lessons. Paused and prerequisite steps remain available to read.',kind==='learn'?'<button class="button secondary" data-action="library-reset">Browse all topics</button>':'<button class="button secondary" data-action="topic-clear" data-topic="'+E(topic)+'">Clear search</button>');
    const pages=Math.ceil(skills.length/LIBRARY_PAGE_SIZE),current=Math.max(0,Math.min(page,pages-1)),start=current*LIBRARY_PAGE_SIZE,end=Math.min(start+LIBRARY_PAGE_SIZE,skills.length);
    return `<p class="result-count" id="library-count" tabindex="-1" role="status">${skills.length} ${skills.length===1?'skill':'skills'}${pages>1?' · showing '+(start+1)+'–'+end:''}</p>${librarySkillRows(skills.slice(start,end),exactStep)}${pages>1?`<nav class="library-pagination" aria-label="Skill results pages"><button class="button secondary" data-action="library-page" data-kind="${kind}" data-topic="${E(topic)}" data-value="${current-1}" ${current===0?'disabled':''}>${icon('back')}Previous</button><span>Page ${current+1} of ${pages}</span><button class="button secondary" data-action="library-page" data-kind="${kind}" data-topic="${E(topic)}" data-value="${current+1}" ${current===pages-1?'disabled':''}>Next${icon('arrow')}</button></nav>`:''}`;
  }
  function skillCards(skills,{exactStep=null,compact=false}={}) {
    const card=skill=>{
      const step=exactStep?.step||skill.steps.find(x=>['Continue','Ready to start'].includes(C.availability(x,training)))||skill.steps.find(x=>C.status(training,x.id)!==C.STATUSES[3])||skill.steps[0];
      return skill.project&&!exactStep?link('project',skill.code,`<div class="card-copy"><div class="eyebrow">MULTI-BEHAVIOR PROJECT</div><h3>${E(skill.title)}</h3><p>${E(skill.goal)}</p><small>${skill.project.modules.length} component groups · choose a ready step</small></div>${icon('arrow')}`,'lesson-card project-card'):lessonCard(skill,step,compact);
    };
    return '<div class="stack">'+skills.map(card).join('')+'</div>';
  }
  function topicView(name) {
    if(name==='Fridge task')name='Brainiacs';
    if(!topicNames.includes(name))return notFound();
    const query=topicQueries.get(name)||'';
    return `${backBar('learn','','All topics')}<div class="page-title library-heading"><div class="topic-symbol large">${icon(topicIcon(name))}</div><h1>${E(name)}</h1><p>${topicSubtitle(name)}</p></div><label class="search-field">${icon('search')}<span class="sr-only">Search this topic</span><input id="topic-search" data-topic="${E(name)}" type="search" placeholder="Find a skill in this topic" value="${E(query)}" autocomplete="off" aria-controls="topic-results"></label><div id="topic-results">${libraryResults(librarySelection(query,name,learnFilter),{page:topicPages.get(name)||0,kind:'topic',topic:name})}</div>`;
  }
  function backBar(type,id,label,extra='') {return `<div class="back-bar">${link(type,id,icon('back')+E(label),'back-link').replace('<a ','<a data-restore="true" ')}${extra}</div>`;}
  function projectOutline(skill,current='') {
    const plan=C.projectPlan(D,training,skill.code);if(!plan)return '';
    return `<section class="project-outline" aria-label="Project components"><p>${E(skill.project.parallel)}</p><p class="fineprint">${plan.complete} / ${plan.total} required component steps consistent.${plan.modules.some(m=>m.optional)?' Optional closing is extra.':''} Open any group to choose a step; reading never records progress.</p><div class="project-modules">${plan.modules.map(m=>`<details data-module="${E(m.code)}" ${m.skill.steps.some(s=>s.id===current)?'open':''}><summary><span>${E(m.skill.title)}${m.optional?' · optional':''}</span><small>${m.steps.filter(x=>C.status(training,x.step.id)===C.STATUSES[3]).length}/${m.steps.length} consistent</small></summary><ol>${m.steps.map(({step,available})=>`<li>${link('lesson',step.id,`<strong>${E(step.title)}</strong><small>${E(available)} · ${E(statLabel(C.status(training,step.id)))}</small>`,step.id===current?'current':'')}</li>`).join('')}</ol></details>`).join('')}</div></section>`;
  }
  function projectView(code) {
    const skill=I.skills.get(code);if(!skill?.project)return notFound();
    return `${backBar('topic','Brainiacs','Brainiacs')}<div class="page-title"><span class="eyebrow">A COMPLETE TRAINING PROJECT</span><h1>${E(skill.title)}</h1><p>${E(skill.goal)}</p></div>${projectOutline(skill)}<details class="project-foundations"><summary>Reusable foundations</summary><p>These are ordinary skills you can learn separately. Each teaching step lists the exact prerequisites it needs.</p><div class="project-modules">${skill.project.foundations.map(c=>{const component=I.skills.get(c);return `<details data-foundation="${E(c)}"><summary><span>${E(component.title)}</span><small>${component.steps.filter(st=>C.status(training,st.id)===C.STATUSES[3]).length}/${component.steps.length} consistent</small></summary><ol>${component.steps.map(st=>`<li>${link('lesson',st.id,`<strong>${E(st.title)}</strong><small>${E(C.availability(st,training))}</small>`)}</li>`).join('')}</ol></details>`;}).join('')}</div></details>`;
  }
  function earlierLesson(item) {
    const {skill,step}=item,current=I.skills.get(skill.code);
    return `${backBar('learn','','Lessons')}<div class="lesson-title"><span class="eyebrow">EARLIER GUIDE · ${E(step.id)}</span><h1>${E(skill.title)}</h1><p>${E(skill.retirementReason||'This guide has been shortened. Its original instructions and your records stay here; use the current guide for new practice.')}</p>${current?link('lesson',current.steps[0].id,'Open the current guide','button secondary'):''}<p>${pill(statLabel(C.status(training,step.id)))}</p></div><section class="lesson-section"><p>${E(skill.setup)}</p><h2>${E(step.title)}</h2><p>${E(step.teach)}</p><h3>Move on when</h3><p>${E(step.advance)}</p><h3>Make it easier</h3><p>${E(step.easier)}</p></section><section class="lesson-section"><h2>Your original notes</h2>${dogNotes(step.id)}</section>${sourceLinks(skill.sources)}`;
  }
  function lessonView(id) {
    const item=itemFor(id);if(!item)return notFound();
    if(item.archived)return earlierLesson(item);
    const {skill,step}=item,n=skill.steps.indexOf(step),avail=C.availability(step,training),v=C.status(training,id);
    const dependencyLinks=(onlyMissing=false)=>step.deps.filter(([key,min])=>onlyMissing==='met'?C.rank(C.status(training,key))>=min:!onlyMissing||C.rank(C.status(training,key))<min).map(([key,min])=>{
      const dep=itemFor(key),met=C.rank(C.status(training,key))>=min;
      return `<a href="${path('lesson',key)}" class="dependency ${met?'met':''}">${icon(met?'check':'learn')}<span><strong>${E(dep.skill.title)} · ${E(dep.step.title)}</strong><small>${min===2?'Nearly there permits easy parallel practice':'Meet this step’s consistency criterion'} · ${E(statLabel(C.status(training,key)))}</small></span>${icon('arrow')}</a>`;
    }).join('');
    // Keep stop/avoidance advice in adaptations visible as well as the full
    // adaptation in Extra Information. Teaching and advancement text stay intact.
    const safetyEasier=step.easier.split(/(?<=[.!?])\s+/).filter(t=>/\b(stop|skip|never|avoid|pain|panic|distress|guarding|swallow|chewing|veterinar|vet|medical|breath|force|traffic|road|supervis|unsafe)\w*\b|\bdo not (?:force|restrain|hold|pull|push|grab|lift|attach|trap|block|fasten|provoke|chase)\b|\bno (?:force|hold|pull|jump|restraint)/i.test(t)).join(' ');
    const stepList=`<nav class="lesson-step-list" aria-label="All teaching steps">${skill.steps.map((st,i)=>link('lesson',st.id,`<span>${i+1}. ${E(st.title)}</span><small>${E(st.id)} · ${E(statLabel(C.status(training,st.id)))}</small>`,st.id===id?'current':'').replace('<a ',`<a ${st.id===id?'aria-current="step"':''} `)).join('')}</nav>`;
    const projects=C.relatedProjects(D,skill.code),downstream=C.downstreamSkills(D,skill.code);
    const blocks={
      overview:{title:'About this skill',body:`<p>${E(skill.goal)}</p><h3>General equipment and safety notes</h3><p>${E(skill.setup)}</p>`},
      easier:{title:'Make it easier',body:`<p>${E(step.easier)}</p>`},
      prerequisites:dependencyLinks('met')?{title:'Build on these prerequisites',body:`<p>These earlier steps support this lesson. Missing prerequisites stay visible above.</p><div class="stack">${dependencyLinks('met')}</div>`}:null,
      notes:{title:'Your notes',body:dogNotes(id)},
      sources:{title:'Why this approach? · Sources',body:`<p>These references support the teaching approach. This step sequence is an original practical adaptation, not a promise of treatment success.</p>${sourceLinks(skill.sources)}`},
      downstream:downstream.length?{title:'Where this skill can lead',body:`<p>Explore whenever you’re curious; each lesson’s own prerequisites still apply.</p><ul>${downstream.map(x=>`<li>${link('lesson',x.step.id,E(x.skill.title))}</li>`).join('')}</ul>`}:null,
      steps:{title:'All steps and project maps',body:stepList+projects.map(project=>`<div class="lesson-project">${link('project',project.code,E(project.title)+' · project overview','text-link')}${projectOutline(project,id)}</div>`).join('')},
      earlier:step.replaces?.length?{title:'Earlier guides and saved notes',body:`<p>Completed earlier groups can credit this step. Original notes remain on their original pages.</p><ul>${step.replaces.map(old=>`<li>${link('lesson',old,E(itemFor(old).step.title))}</li>`).join('')}</ul>`}:null
    };
    const block=key=>{const b=blocks[key];return b?`<details class="lesson-extra ${key==='downstream'?'downstream-skills':key==='earlier'?'earlier-records':''}" data-lesson-section="${key}"><summary>${E(b.title)}</summary>${b.body}</details>`:'';};
    return `${backBar('topic',skill.sheet,skill.sheet,`<button class="icon-button favorite ${state.favorites.includes(skill.code)?'active':''}" data-action="favorite" data-id="${E(skill.code)}" aria-label="${state.favorites.includes(skill.code)?'Unsave':'Save'} this skill" aria-pressed="${state.favorites.includes(skill.code)}">${icon('heart')}</button>`)}
    ${competentNote(id)}<div class="lesson-title focused-title"><h1>${E(skill.title)}</h1><div class="lesson-step-heading"><span>Step ${n+1} of ${skill.steps.length}</span>${badge(avail)}<button class="text-button" data-action="choose-step" data-id="${E(id)}">Change step</button></div></div>
    <section class="lesson-setup" aria-labelledby="setup-title"><h2 id="setup-title">Setup</h2><p>${E(step.setup)}</p>${safetyEasier?`<aside class="lesson-safety"><strong>Keep it safe</strong><p>${E(safetyEasier)}</p></aside>`:''}
    ${dependencyLinks(true)?`<aside class="notice amber required-prerequisites"><strong>Build the earlier piece first.</strong><p>You can read ahead. Before practicing this step, follow the links to the missing prerequisites. Comfortable management and easy anxiety pairings do not require perfect obedience.</p><div class="stack">${dependencyLinks(true)}</div></aside>`:''}
    </section><section class="lesson-cue" aria-label="Training cue">${cueFields(skill)}</section>
    <section class="lesson-section teaching"><h2>${E(step.title)}</h2><div class="teaching-copy">${teachingCopy(skill,step)}</div></section>
    <section class="criterion"><div class="criterion-icon">${icon('check')}</div><div><span class="eyebrow">MOVE ON WHEN</span><p>${E(step.advance)}</p><p class="fineprint">Numbers and session checks are adjustable practice targets, not validated mastery tests. Simplify sooner for errors or discomfort; a grade covers this step and setting.</p></div></section>
    <div class="lesson-actions-slot"><div class="lesson-actions ${state.settings.lessonMarker?'':'without-marker'}" role="group" aria-label="Training controls">${state.settings.lessonMarker?`<div class="lesson-marker"><button class="button" data-marker aria-label="Play marker sound" aria-describedby="marker-feedback">${icon('sound')}<span data-marker-label>Mark & reward</span></button>${link('clicker',id,'Open clicker','text-link')}</div>`:''}<button class="button secondary" data-action="progress" data-id="${E(id)}">${icon('check')}Set progress</button>${state.settings.lessonMarker?'<p id="marker-feedback" class="marker-feedback" role="status" aria-live="polite" aria-atomic="true">Tap to mark, then reward.</p>':''}</div></div>
    <nav class="step-navigation" aria-label="Previous and next teaching step">${n>0?link('lesson',skill.steps[n-1].id,icon('back')+'Previous','button ghost'):'<span></span>'}${n<skill.steps.length-1?link('lesson',skill.steps[n+1].id,'Next step'+icon('arrow'),'button ghost'):link('topic',skill.sheet,'More in this topic'+icon('arrow'),'button ghost')}</nav>
    <p class="fineprint">A recorded stage is a planning aid. Your dog’s comfort, health, and ability to leave always come first. ${link('basics','','Read the training essentials')}</p>
    <details class="extra-information extra-guidance"><summary>Extra Information <small>Help, notes and background</small></summary>${['easier','notes','prerequisites','downstream','sources','overview','steps','earlier'].map(block).join('')}</details>`;
  }
  function chooseStep(id) {
    const item=itemFor(id);if(!item)return;
    openModal('Choose a teaching step',`<p class="fineprint">${E(item.skill.title)} · Viewing a step never records progress.</p><nav class="lesson-step-list" aria-label="Choose a teaching step">${item.skill.steps.map((st,i)=>link('lesson',st.id,`<span>${i+1}. ${E(st.title)}</span><small>${E(C.availability(st,training))} · ${E(statLabel(C.status(training,st.id)))}</small>`,st.id===id?'current':'').replace('<a ',`<a ${st.id===id?'aria-current="step"':''} `)).join('')}</nav>`);
  }
  function clickerView(id) {
    const item=itemFor(id)||itemFor(currentLesson), sound=GroundMarker.sounds.find(s=>s.id===state.settings.markerSound);
    if(item)currentLesson=item.step.id;
    if(!state.settings.lessonMarker)return `${backBar('learn','','Lessons')}<div class="page-title"><h1>Clicker hidden.</h1><p>You can enable the marker in Settings whenever you need it.</p></div>${link('settings','','Open Settings','button secondary full')}${item?link('lesson',item.step.id,'Return to lesson','button secondary full'):''}`;
    return `${backBar('learn','','Lessons')}<div class="page-title clicker-heading"><span class="eyebrow">RIGHT MOMENT. KIND REWARD.</span><h1>A little click.<br>A clear yes.</h1><p>Mark the moment you like, then give your dog a reward.</p></div>
    ${C.selectedDogs(state).some(d=>d.tailoring.traits.includes('noise'))?`<p class="marker-sensitivity">${icon('leaf')}For the sound-sensitive dog you selected, a soft spoken “yes” may feel better. Quiet rewards work too.</p>`:''}<button class="marker-pad" data-marker aria-describedby="marker-feedback" aria-label="Play ${E(sound.name)} marker">${icon('sound')}<strong data-marker-label>Mark</strong><span>${E(sound.name)} · tap once, then reward</span></button>
    <p id="marker-feedback" class="marker-feedback" role="status" aria-live="polite" aria-atomic="true">Try quietly away from your dog first.</p>
    <div class="marker-controls">${selectField('Marker sound','markerSound',GroundMarker.sounds.map(s=>[s.id,s.name+' · '+s.description]),state.settings.markerSound)}<label class="field"><span>Marker volume · <output id="marker-volume-label">${state.settings.markerVolume}%</output></span><input id="marker-volume" type="range" min="0" max="100" step="5" value="${state.settings.markerVolume}" aria-label="Marker volume"><small>Your phone’s media volume also affects the sound.</small></label></div>
    <details class="reading-card"><summary>Using a sound marker</summary><p>Start with a few easy pairings: make the sound once, then offer a small reward. When teaching, mark the action you wanted and follow each marker with a reward. The sound is a promise, not a cue to repeat or a way to interrupt barking.</p><p>If your dog startles or avoids the sound, stop and use a soft spoken “yes” instead. Choose a quiet setting and comfortable volume. A marker is optional; clear rewards still work without one.</p><p>The marker uses Android’s media sound. Use the phone’s volume buttons while Good Ground is open to adjust media volume; the ringtone volume is separate. Silent ringtone mode normally leaves media available, but Do Not Disturb or device policies can mute it. Check the sound before training.</p><p>${link('lesson','MARK-1','Teach the reward marker','text-link')}</p></details>
    ${item?`<section class="reading-card marker-lesson"><span class="eyebrow">YOUR CURRENT STEP</span><h2>${E(item.skill.title)} · ${E(item.step.title)}</h2><div class="teaching-copy">${teachingCopy(item.skill,item.step)}</div><details><summary>Move on when</summary><p>${E(item.step.advance)}</p></details><details><summary>Make it easier</summary><p>${E(item.step.easier)}</p></details><div class="button-row">${link('lesson',item.step.id,'Return to lesson','button secondary')}${link('session',item.step.id,'Log practice','button secondary')}</div></section>`:`<p class="fineprint">Open any teaching step in Lessons, then return here to keep its instructions beside the button.</p>`}
    <label class="check-chip"><input id="lesson-marker-toggle" type="checkbox" ${state.settings.lessonMarker?'checked':''}><span>Also show a small marker button in lessons</span></label>`;
  }
  const markerTimers=new WeakMap();
  async function playMarker(button) {
    const feedback=$('#marker-feedback'),label=button.querySelector('[data-marker-label]');
    clearTimeout(markerTimers.get(button));
    button.classList.remove('sounded');button.classList.add('marker-pressed');
    if(feedback){feedback.textContent='Starting sound…';feedback.classList.remove('sound-error');}
    const original=button.classList.contains('marker-pad')?'Mark':'Mark & reward';
    try {
      if(state.settings.markerVolume===0)throw new Error('Marker volume is muted. Raise it before training.');
      await GroundMarker.play(state.settings.markerSound,state.settings.markerVolume/100);
      button.classList.add('sounded');if(label)label.textContent='Marked!';
      markerTimers.set(button,setTimeout(()=>{button.classList.remove('sounded');if(label)label.textContent=original;},600));
      if(feedback){feedback.replaceChildren(document.createTextNode('Marked. Reward now.'));feedback.classList.remove('sound-error');}
    }catch(error){if(label)label.textContent=original;if(feedback){feedback.textContent=error.message;feedback.classList.add('sound-error');}else toast(error.message,true);}
    finally{button.classList.remove('marker-pressed');}
  }
  function practiceRecency(skill) {
    const record=C.practiceRecord(skill,training),has=!!record.lastPractice;
    return `<section class="practice-recency"><div>${icon('clock')}<span><strong>Last logged practice${C.selectedDogs(state).length>1?' · selected dogs':''}</strong><small>${C.selectedDogs(state).length>1?'See each dog’s dates in Practice rhythm.':has?E(C.elapsedLabel(record.practiceDays))+' · '+E(dateLabel(record.lastPractice)):'No practice logged for this skill yet.'}</small></span></div><div class="recency-actions"><button class="text-button" data-action="quick-practice" data-id="${E(skill.steps[0].id)}">Practiced today</button>${link('session',skill.steps[0].id,'Add details','text-link')}</div>${C.selectedDogs(state).length>1?`<small>Logs for ${E(C.selectedDogs(state).map(d=>d.profile.name).join(' + '))}. Use Add details to choose fewer dogs.</small>`:''}</section>`;
  }
  function refresherNotice() {
    if(!state.settings.reminderDays||state.settings.remindersDismissedOn===C.dateToday())return '';
    const due=C.practiceRecords(D,state).filter(x=>x.days!==null&&x.days>=state.settings.reminderDays);if(!due.length)return '';
    return `<aside class="refresher-note" aria-labelledby="refresher-title"><div class="section-heading"><h2 id="refresher-title">A gentle refresher?</h2><button class="icon-button" data-action="dismiss-reminders" aria-label="Hide reminders for today">${icon('close')}</button></div><p>A few familiar skills have no recent practice log. A comfortable, easy refresher could fit today.</p><ul>${due.slice(0,3).map(x=>`<li>${link('lesson',x.skill.steps[0].id,E(x.skill.title))}${C.dogs(state).length>1?`<small>${E(x.dogName)}</small>`:''}<small>${x.lastPractice?'Last logged '+E(C.elapsedLabel(x.practiceDays).toLowerCase()):'Consistency recorded '+E(C.elapsedLabel(x.days).toLowerCase())+'; no practice log yet'}</small></li>`).join('')}</ul>${link('practice','',due.length>3?'See all '+due.length+' skills':'Your practice rhythm','text-link')}<small>A missing log doesn’t mean your dog has forgotten. Rest is always an option.</small></aside>`;
  }
  function dailyPracticeCard(queue=C.dailyPractice(D,state)) {
    if(!queue.records.length)return '';
    const next=queue.pending[0],name=next?.dogName||'Your dog',skill=next?.skill;
    return `<section class="daily-practice" aria-labelledby="daily-practice-title"><div class="section-heading"><h2 id="daily-practice-title">Familiar skills for today</h2>${link('practice','','Practice rhythm','text-link')}</div>
    <p class="fineprint">${queue.practiced} of ${queue.records.length} learned ${C.selectedDogs(state).length>1?'dog-and-skill pairs':'skills'} practiced today · ${E(dateLabel(queue.today))}. Choose a comfortable refresher or rest; completion stays learned.</p>
    <div id="daily-practice-next" tabindex="-1">${next?`<p class="eyebrow">FOR ${E(name)}</p><h3>${E(skill.title)}</h3><p>${E(skill.goal)}</p><p class="fineprint">${next.lastPractice?'Last practice: '+E(dateLabel(next.lastPractice)):'No practice logged yet.'}</p><details class="daily-review"><summary>Review the familiar exercise</summary><p><strong>Your cue:</strong> ${E(C.dogState(state,next.dogId).cues[skill.code]||skill.cue)}</p><p>${E(skill.steps.at(-1).teach)}</p><p><strong>Keep it comfortable:</strong> ${E(skill.steps.at(-1).easier)}</p>${link('lesson',skill.steps.at(-1).id,'Open the full lesson','text-link')}</details><button class="button full" data-action="quick-practice" data-id="${E(skill.steps.at(-1).id)}" data-dog-id="${E(next.dogId)}" data-daily-practice>Practiced today · ${E(name)}</button>`:'<h3>All familiar skills have a practice log today.</h3><p>Enjoy a rest or choose something fun. Your next set appears on a new day.</p>'}</div></section>`;
  }
  function practiceView() {
    const queue=C.dailyPractice(D,state),records=queue.records;
    return `${backBar('learn','','Lessons')}<div class="page-title"><span class="eyebrow">KEEP THE FAMILIAR FEELING GOOD</span><h1>Your practice<br>rhythm.</h1><p>Revisit completed foundations and walk skills, including Heel. One comfortable refresher is enough to log a practice day; nothing here resets learning.</p></div>${dailyPracticeCard(queue)}${records.length?`<details class="practice-library"><summary>All learned fundamentals · ${records.length}</summary>${records.map(x=>`<section class="reading-card"><h2>${E(x.skill.title)}</h2>${C.dogs(state).length>1?`<p class="quiet">For ${E(x.dogName)}</p>`:''}<p>${x.lastPractice?'Last practice logged '+E(C.elapsedLabel(x.practiceDays).toLowerCase())+' · '+E(dateLabel(x.lastPractice)):'No practice logged yet. '+(x.learnedOn?'Consistency recorded '+E(dateLabel(x.learnedOn))+'.':'')}</p><div class="button-row">${x.lastPractice===queue.today?pill('Practiced today','complete'):`<button class="button secondary" data-action="quick-practice" data-id="${E(x.skill.steps.at(-1).id)}" data-dog-id="${E(x.dogId)}">Practiced today</button>`}${link('lesson',x.skill.steps.at(-1).id,'Review lesson','text-link')}</div></section>`).join('')}</details>`:empty('Room for a rhythm','Once all steps of a foundation or walk skill are recorded as consistent for a selected dog, it appears here. Use Journal → Add a session for other practice.',link('learn','','Explore lessons','button secondary'))}<p class="fineprint">Practice is recorded separately for each dog in Journal. Detailed Skill practice entries for any step of a skill count too. Edit or remove a journal entry to correct a practice date. The list follows the local date on this device.</p><p class="fineprint">${link('basics','practice-rhythms','How practice reminders work')} · ${link('settings','','Change reminders')}</p>`;
  }
  function progressModal(id) {
    if(I.archivedSteps.has(id)){toast('Use the current guide to record new progress.');return;}
    const {step}=itemFor(id);
    const chosen=C.selectedDogs(state),unfinished=chosen.filter(d=>![C.STATUSES[3],C.STATUSES[4]].includes(C.status(C.dogState(state,d.id),id))),defaults=unfinished.length?unfinished:chosen.every(d=>C.status(C.dogState(state,d.id),id)===C.STATUSES[3])?chosen:[];
    openModal('How is this step going?',`${chosen.length>1?`<fieldset class="progress-dogs"><legend>Record this stage for</legend>${chosen.map(d=>`<label class="check-chip"><input type="checkbox" name="progressDog" value="${E(d.id)}" ${defaults.some(x=>x.id===d.id)?'checked':''}><span>${E(d.profile.name)} · ${E(C.stageLabel(C.status(C.dogState(state,d.id),id)))}</span></label>`).join('')}<small>Only checked dogs receive this change.</small></fieldset>`:''}<div class="mini-criterion"><strong>Move on when</strong><p>${E(step.advance)}</p></div><p class="quiet">Choose the stage that matches this step in its stated setting. You can revise it later.</p><div class="status-options">${C.STATUSES.map((v,i)=>`<button class="status-option ${C.status(training,id)===v?'selected':''}" data-action="set-progress" data-id="${E(id)}" data-value="${E(v)}"><span class="status-dot stage-${i}">${i===3?icon('check'):''}</span><span><strong>${C.LABELS[i]}</strong><small>${['We have not worked on this yet.','Learning the action or building comfort.','Getting reliable; keep it easy.','Meets this exact advancement criterion.','Take a break; dependent stages stay blocked.'][i]}</small></span>${C.status(training,id)===v?icon('check'):''}</button>`).join('')}</div>`);
  }
  function completionSuggestions(skill) {
    const {practical,fun}=C.nextChoices(D,C.trainingView(state),skill.code),complete=skill.steps.every(st=>C.status(training,st.id)===C.STATUSES[3]);
    openModal(complete?'A little milestone.':'Step complete.',`<p>${complete?'You’ve recorded every step in this skill as consistent.':'This step is recorded as consistent.'} Celebrate what you’ve built together. Take a break, revisit a favorite, or try another skill if your dog is comfortable and interested.</p>${C.relatedProjects(D,skill.code).length?`<div class="completed-components"><p>This component contributes to:</p>${C.relatedProjects(D,skill.code).map(p=>link('project',p.code,E(p.title)+' · project map','button secondary full')).join('')}</div>`:''}<div class="completion-choices">${practical.map(x=>lessonCard(x.skill,x.step,true)).join('')||'<p class="quiet">Revisit a favorite or explore the library whenever you are ready.</p>'}</div><div class="completion-fun">${icon('star')}<div><strong>Give your dog a break. Try something fun.</strong>${fun?link('lesson',fun.step.id,E(fun.skill.title)+' '+icon('arrow'),'text-link'):'<p class="quiet">A relaxed sniff, familiar toy, or simply resting together counts too.</p>'}</div></div><button class="button secondary full" data-action="close-modal">Enough for today</button>`);
  }
  function breedField(value='') {
    return `<div class="field breed-field"><span id="breed-label">Breed / mix · optional</span><input type="hidden" name="breed" value="${E(value)}"><button type="button" class="breed-picker" data-action="choose-breed" aria-labelledby="breed-label breed-value"><span id="breed-value" class="breed-value">${E(value||'Choose or search a breed')}</span>${icon('arrow')}</button><small>Mixed, unknown and unlisted dogs are welcome.</small></div>`;
  }
  function breedResults() {
    const results=GroundTailoring.search(breedQuery),q=breedQuery.trim().slice(0,200);
    return `${!q?'<button type="button" data-action="pick-breed" data-value="">Leave unspecified</button>':''}${q&&!results.some(v=>v.toLocaleLowerCase()===q.toLocaleLowerCase())?`<button type="button" data-action="pick-breed" data-value="${E(q)}">Use “${E(q)}”</button>`:''}${results.map(v=>`<button type="button" data-action="pick-breed" data-value="${E(v)}">${E(v)}${icon('plus')}</button>`).join('')}`;
  }
  function supportFields(tailoring={traits:[]}) {
    return `<details class="profile-details support-fields"><summary>What helps them learn? · optional</summary><p class="fineprint">Choose only what you’ve noticed in this dog. These add gentler setups and relevant suggestions, whatever their breed.</p><fieldset><legend class="sr-only">Individual support preferences</legend><div class="stack">${GroundTailoring.traits.map(t=>`<label class="check-chip"><input type="checkbox" name="trait" value="${t.id}" ${tailoring.traits.includes(t.id)?'checked':''}><span>${E(t.label)}</span></label>`).join('')}</div></fieldset></details>`;
  }
  function maybeBreedHint(dogId,continueProfile) {
    const dog=C.dogState(state,dogId),hint=GroundTailoring.hintFor(dog.profile.breed);
    if(!hint||dog.tailoring.reviewedBreed===dog.profile.breed){continueProfile();return;}
    if(dog.tailoring.traits.includes(hint.trait)){
      commit(C.updateDog(state,dogId,d=>({...d,tailoring:{...d.tailoring,reviewedBreed:d.profile.breed}})));continueProfile();return;
    }
    // Remember that the question was offered, including if the owner closes it.
    if(!commit(C.updateDog(state,dogId,d=>({...d,tailoring:{...d.tailoring,reviewedBreed:d.profile.breed}})))){continueProfile();return;}
    profileContinuation=continueProfile;
    openModal('Does this fit '+(dog.profile.name||'your dog')+'?',`<p>One Finnish owner survey reported more ${E(hint.topic)} in this breed than in some others. That describes a population, not ${E(dog.profile.name||'your dog')}.</p><div class="mini-criterion"><strong>${hint.trait==='noise'?'Do everyday sounds sometimes worry them?':'Do unfamiliar people, dogs or situations often worry them?'}</strong><p>If this fits, we can suggest quieter, more gradual setups. Their actual comfort still sets the pace.</p></div><p class="fineprint">Breed alone never changes training. The survey and an ancestry study both have important limits.</p><small>Research notes R09 and R08 are available in More → Source library.</small><div class="hint-actions"><button class="button full" data-action="confirm-support" data-dog-id="${E(dogId)}" data-trait="${hint.trait}">Yes, that fits</button><button class="button secondary full" data-action="close-modal">Doesn’t fit my dog</button><button class="text-button" data-action="close-modal">Not sure · keep the usual plan</button></div>`);
  }
  function teachingCopy(skill,step) {
    const original=E(step.teach).split(/\n\n+/).map(p=>`<p>${p}</p>`).join('');
    const adapted=C.selectedDogs(state).map(d=>({dog:d,pieces:GroundTailoring.practicePieces(step.id,d.tailoring.traits)})).filter(x=>x.pieces.length);
    if(!adapted.length)return original;
    return `<div class="tailored-teaching">${adapted.map(({dog,pieces})=>`<div><span class="eyebrow">SMALLER PRACTICE STEPS${C.selectedDogs(state).length>1?' · '+E(dog.profile.name):''}</span><ol>${pieces.map(p=>`<li>${E(p)}</li>`).join('')}</ol></div>`).join('')}</div><div class="original-teaching"><h3>Teaching guide</h3>${original}</div>`;
  }
  function tailoredToday() {
    const choices=C.personalizedAvailable(D,state).slice(0,3);if(!choices.length)return '';
    return `<details class="tailored-today trouble-spots"><summary>For your dog’s trouble spots</summary><p class="fineprint">For ${E(C.selectedDogs(state).map(d=>d.profile.name||'your dog').join(' + '))} · optional support alongside foundations.</p><div class="stack">${choices.map(x=>lessonCard(x.skill,x.step,true)).join('')}</div></details>`;
  }
  function softProfileFields(p,{nameRequired=false,tailoring={traits:[]}}={}) {
    return `<label class="field"><span>Their name${nameRequired?' · required':''}</span><input name="name" value="${E(p.name)}" maxlength="100" autocomplete="off" ${nameRequired?'required':''}></label>${inputField('Age / life stage','age',p.age)}${breedField(p.breed)}${textField('Favorite rewards','rewards',p.rewards,'Food, play, sniffing, or something else they safely enjoy.')}${supportFields(tailoring)}<details class="profile-details"><summary>A little more about them · optional</summary>${textField('Their comfortable baseline','comfort',p.comfort)}${textField('Health, pain, movement, or veterinary directions','health',p.health)}${textField('Equipment and safe retreat','equipment',p.equipment)}${textField('History to share with your professional','history',p.history)}${textField('Your veterinary / behavior support','help',p.help)}<fieldset><legend>Current priorities · optional</legend><div class="choice-grid">${D.triggers.map(t=>`<label class="check-chip"><input type="checkbox" name="priority" value="${E(t.name)}" ${p.priorities.includes(t.name)?'checked':''}><span>${E(t.name)}</span></label>`).join('')}</div></fieldset></details>`;
  }
  function setupView() {
    const h=state.household;
    if(!h.setupTarget)return `<div class="welcome-mark">${icon('leaf')}</div><div class="page-title"><span class="brand-kicker">WELCOME TO GOOD GROUND</span><h1>Good days<br>start together.</h1><p>First, a little space for the dogs in your life. How many dogs do you have?</p></div><form id="household-count-form" class="form-card">${formError()}<div class="household-count"><label class="count-choice"><input type="radio" name="householdSize" value="one" checked><strong>Just one</strong><small>One lovely training companion</small></label><label class="count-choice"><input type="radio" name="householdSize" value="multiple"><strong>More than one</strong><small>A separate record for every dog</small></label></div><label class="field" id="dog-count-field" hidden><span>How many dogs?</span><input name="dogCount" type="number" min="2" max="50" step="1" value="2" disabled><small>You can add dogs later from More → Your dogs.</small></label><button class="button" type="submit">Continue</button></form><p class="fineprint">No account needed. Profiles and training stay on this phone.</p><button class="text-button" data-action="import">Already have a backup? Restore it</button>`;
    const i=h.setupIndex,p=C.dogs(state)[i]?.profile||C.freshState().profile,multiple=h.setupTarget>1;
    return `<div class="welcome-mark">${icon('dog')}</div><div class="page-title"><span class="eyebrow">${multiple?'DOG '+(i+1)+' OF '+h.setupTarget:'YOUR OWN LITTLE COMPANION'}</span><h1>${multiple?'Let’s meet<br>'+ (i===0?'your first dog.':'your next dog.'):'Tell us a little<br>about your dog.'}</h1><p>${multiple?'A name is all we need to keep their training separate. Everything else can wait.':'Share whatever feels useful. You can fill this in later, or skip it for now.'}</p></div><form id="setup-profile-form" class="form-card">${formError()}${softProfileFields(p,{nameRequired:multiple,tailoring:C.dogs(state)[i]?.tailoring||{traits:[]}})}<button class="button" type="submit">${i+1<h.setupTarget?'Save & meet the next dog':'Save & take a quick tour'}</button>${!multiple?'<button class="button ghost" type="button" data-action="skip-profile">Skip profile for now</button>':''}</form><button class="text-button" data-action="change-dog-count">Change number of dogs</button>`;
  }
  function guideView() {
    const pages=GROUND_GUIDE.pages;guideIndex=Math.max(0,Math.min(guideIndex,pages.length-1));const page=pages[guideIndex];
    return `<div class="tour-top"><span class="brand-kicker">A LITTLE LOOK AROUND</span><button class="text-button" data-action="finish-guide">Skip tour</button></div><div class="tour-symbol">${icon(page.icon)}</div><div class="page-title"><span class="eyebrow">${E(page.eyebrow)}</span><h1>${E(page.title)}</h1><p>${E(C.dogs(state).length===1&&page.singleBody?page.singleBody:page.body)}</p></div><div class="tour-detail"><p>${E(C.dogs(state).length===1&&page.singleDetail?page.singleDetail:page.detail)}</p></div><p class="tour-page-number">${guideIndex+1} of ${pages.length}</p><div class="tour-dots" role="img" aria-label="Tour page ${guideIndex+1} of ${pages.length}">${pages.map((_,i)=>`<span class="${i===guideIndex?'current':''}"></span>`).join('')}</div><div class="tour-actions">${guideIndex?'<button class="button secondary" data-action="guide-back">Back</button>':'<span></span>'}<button class="button" data-action="${guideIndex===pages.length-1?'finish-guide':'guide-next'}">${guideIndex===pages.length-1?'Let’s begin':'Next'}${icon('arrow')}</button></div><p class="fineprint">You can reopen this tour anytime in More.</p>`;
  }
  function dogChooserView() {
    const selected=new Set(state.household.selectedIds);
    return `<div class="welcome-mark">${icon('dog')}</div><div class="page-title"><span class="eyebrow">A MOMENT TOGETHER</span><h1>Who are you<br>training today?</h1><p>Choose one dog or a few. Each keeps their own progress, even when you practice together.</p></div><form id="dog-choice-form" class="form-card">${formError()}<fieldset class="dog-choice-list"><legend class="sr-only">Dogs to train</legend>${C.dogs(state).map(d=>`<label class="dog-choice"><input type="checkbox" name="dogId" value="${E(d.id)}" ${selected.has(d.id)?'checked':''}><span><strong>${E(d.profile.name||'Your dog')}</strong><small>${C.summary(D,C.dogState(state,d.id)).counts.complete} steps learned</small></span>${icon('dog')}</label>`).join('')}</fieldset><button class="button" type="submit">Let’s practice</button></form>`;
  }
  function dogsView() {
    return `${backBar('more','','More')}<div class="page-title"><span class="eyebrow">A SPACE FOR EVERY COMPANION</span><h1>Your dogs.</h1><p>Separate profiles, progress, notes, practice and trigger plans. Tap a dog to edit their details.</p></div><div class="stack">${C.dogs(state).map(d=>link('profile',d.id,`${icon('dog')}<span><strong>${E(d.profile.name||'Your dog')}</strong><small>${E(d.profile.age||'Add their details anytime')}</small></span>${icon('arrow')}`,'menu-row dog-profile-row')).join('')}</div><button class="button secondary full add-dog" data-action="add-dog">${icon('plus')}Add a dog</button>${C.dogs(state).length>1?'<button class="button full" data-action="choose-dogs">Choose who to train</button>':''}`;
  }
  function addDogView() {
    const primary=C.dogs(state)[0],needsName=!primary.profile.name.trim();
    return `${backBar('dogs','','Your dogs')}<div class="page-title"><span class="eyebrow">A NEW LITTLE SPACE</span><h1>${needsName?'First, a name<br>for your first dog.':'Meet your<br>next companion.'}</h1><p>Every dog needs a distinct name or nickname when you have more than one. Other details are optional.</p></div><form id="add-dog-form" data-rename-first="${needsName}" class="form-card">${formError()}${softProfileFields(needsName?primary.profile:C.freshState().profile,{nameRequired:true,tailoring:needsName?primary.tailoring:{traits:[]}})}<button class="button" type="submit">${needsName?'Save & add the next dog':'Add this dog'}</button></form>`;
  }
  function readProfile(form) {
    const f=new FormData(form),profile={...C.freshState().profile};
    for(const key of Object.keys(profile).filter(k=>k!=='priorities'))profile[key]=String(f.get(key)||'').trim();
    profile.priorities=f.getAll('priority');return profile;
  }
  function completeSetup() {
    if(commit(C.touch({...state,household:{...state.household,setupComplete:true,setupIndex:state.household.setupTarget}}))){dirty=false;guideIndex=0;needsDogChoice=C.dogs(state).length>1;render();}
  }
  function profileView(id) {
    const dog=C.dogs(state).find(d=>d.id===id)||C.selectedDogs(state)[0];profileDogId=dog.id;
    const p=dog.profile;
    return `${backBar('more','','More')}<div class="page-title"><span class="eyebrow">THE INDIVIDUAL IN FRONT OF YOU</span><h1>Your dog,<br>their own way.</h1><p>${C.dogs(state).length>1?'Profile for '+E(p.name)+'. ':''}Optional notes help you choose useful lessons. No diagnosis or starting distance is assumed.</p></div>
    <form id="profile-form" data-dog-id="${E(profileDogId)}" class="form-card">${formError()}${inputField('Their name','name',p.name)}${inputField('Age / life stage','age',p.age)}${breedField(p.breed)}${textField('Favorite rewards','rewards',p.rewards,'Food, play, sniffing, contact, or distance—whatever they safely enjoy.')}${supportFields(dog.tailoring)}
    <fieldset><legend>Current priorities</legend><p class="quiet">These bring relevant available lessons nearer the top of Today.</p><div class="choice-grid">${D.triggers.map(t=>`<label class="check-chip"><input type="checkbox" name="priority" value="${E(t.name)}" ${p.priorities.includes(t.name)?'checked':''}><span>${E(t.name)}</span></label>`).join('')}</div></fieldset>
    ${textField('Their comfortable baseline','comfort',p.comfort,'Face, posture, movement, sniffing, food-taking, and ordinary recovery.')}${textField('Health, pain, movement, or veterinary directions','health',p.health)}${textField('Equipment and safe retreat','equipment',p.equipment)}${textField('History to share with your professional','history',p.history,'Include bites, attempted bites, redirection, guarding, or sudden changes if relevant.')}${textField('Your veterinary / behavior support','help',p.help)}<button class="button" type="submit">Save profile</button><p class="fineprint">Stored locally. Export a backup from More to keep a separate copy.</p></form>`;
  }
  function journalView() {
    const logs=training.sessions.filter(s=>!journalFilter||s.trigger===journalFilter).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
    return `<div class="page-title"><span class="eyebrow">NOTICE THE SMALL THINGS</span><h1>Your practice<br>journal.</h1><p>Capture the setup and the dog’s comfort—not just whether they followed a cue.</p></div><a href="#/session" class="button full">${icon('plus')}Record a session</a>
    <label class="field journal-filter"><span>Show sessions</span><select id="journal-filter">${selectOptions(D.triggers.map(t=>t.name),journalFilter,'All triggers and skills')}</select></label>
    <div class="stack">${logs.length?logs.map(s=>sessionCard(s)).join(''):empty('A fresh page','No sample history here. Your first session can be as simple as a few comfortable repetitions.')}</div>`;
  }
  function sessionCard(s) {
    const item=itemFor(s.stepId);
    return link('entry',s.id,`<div class="session-date">${icon('journal')}<span>${E(dateLabel(s.date))}</span></div><h3>${E(item?.skill.title||s.trigger||s.type)}</h3>${C.dogs(state).length>1?`<small class="journal-dog">${E(s.dogName||C.selectedDogs(state)[0].profile.name)}</small>`:''}<p>${E(s.setup||'No setup note recorded.')}</p><div class="card-meta">${s.trigger?pill(s.trigger):''}${s.response!==null?pill('Response '+s.response):''}${s.recovery!==null?pill(s.recovery+' sec recovery'):''}</div>`,'session-card');
  }
  function sessionForm(id='',editing=false) {
    const existing=editing?training.sessions.find(s=>s.id===id):null;
    if(editing&&!existing)return notFound();
    const item=itemFor(id);
    const s=existing||{date:C.dateToday(),stepId:item?id:'',type:item?'Skill practice':'Trigger exposure',trigger:'',setup:'',opportunities:'',successes:'',response:'',recovery:'',recoveryState:'',observations:'',next:''};
    return `${backBar(editing?'entry':'journal',editing?id:'',editing?'Session':'Journal')}<div class="page-title"><span class="eyebrow">A FEW HONEST NOTES</span><h1>${editing?'Edit session':'How did it feel?'}</h1><p>Unknown observations stay blank. Logging does not automatically change lesson progress.</p></div><form id="session-form" data-id="${E(existing?.id||'')}" data-dog-id="${E(existing?.dogId||C.selectedDogs(state)[0].id)}" class="form-card">${formError()}${!editing&&C.selectedDogs(state).length>1?`<fieldset><legend>Who practiced?</legend><div class="choice-grid">${C.selectedDogs(state).map(d=>`<label class="check-chip"><input type="checkbox" name="sessionDog" value="${E(d.id)}" checked><span>${E(d.profile.name)}</span></label>`).join('')}</div><p class="fineprint">This entry is copied to each checked dog. Log separately when their counts or observations differ.</p></fieldset>`:C.dogs(state).length>1?`<p class="quiet">For ${E(existing?.dogName||C.selectedDogs(state)[0].profile.name)}</p>`:''}
    ${inputField('Date','date',s.date,'date')}${selectField('Teaching step (optional)','stepId',[...D.skills.flatMap(sk=>sk.steps.map(st=>[st.id,sk.title+' · '+st.title])),...(I.archivedSteps.has(s.stepId)?[[s.stepId,'Earlier guide · '+I.archivedSteps.get(s.stepId).step.title]]:[])],s.stepId,'No linked lesson')}
    ${selectField('Session type','type',['Skill practice','Trigger exposure','Management / event'],s.type)}${selectField('Trigger (if relevant)','trigger',D.triggers.map(t=>t.name),s.trigger,'No trigger recorded')}
    ${textField('Exact setup','setup',s.setup,'Distance, volume, room, helper, equipment, or other context that makes sessions comparable.')}
    <div class="field-pair">${inputField('Opportunities','opportunities',s.opportunities??'','number')}${inputField('Successful / comfortable','successes',s.successes??'','number')}</div><p class="fineprint">Counts mean successful skill responses or comfortable exposure observations, depending on the session. Leave unknown counts blank.</p>
    ${selectField('Observed response (optional)','response',[[0,'0 · Comfortable baseline'],[1,'1 · Briefly alert, recovers'],[2,'2 · Concerned / sticky attention'],[3,'3 · Strong reaction'],[4,'4 · Panic / not recovering']].map(([v,l])=>[String(v),l]),s.response===null?'':String(s.response),'Unknown / not measured')}
    <p class="fineprint">A custom description, not a clinical scale or a safety assessment. Consider the whole dog.</p>
    ${selectField('Recovery state','recoveryState',['Recovered','Not yet recovered','Not measured'],s.recoveryState,'Unknown')}${inputField('Recovery seconds (only if recovered)','recovery',s.recovery??'','number','Time after the event ends until their ordinary comfortable baseline returns. Silence alone is insufficient.')}
    ${textField('Body language and observations','observations',s.observations)}${textField('One next change','next',s.next)}<button class="button" type="submit">Save session</button></form>`;
  }
  function entryView(id) {
    const s=training.sessions.find(x=>x.id===id);if(!s)return notFound();
    const item=itemFor(s.stepId);
    return `${backBar('journal','','Journal')}<div class="page-title"><span class="eyebrow">${E(dateLabel(s.date))}</span><h1>${E(item?.skill.title||s.trigger||s.type)}</h1>${C.dogs(state).length>1?`<p>For ${E(s.dogName||C.selectedDogs(state)[0].profile.name)}</p>`:''}<p>${E(s.type)}${s.trigger?' · '+E(s.trigger):''}</p></div>
    <div class="notice"><strong>For the next session</strong><p>${E(C.sessionGuidance(s))}</p></div><div class="details-card">${[['Setup',s.setup],['Opportunities',s.opportunities],['Successful / comfortable',s.successes],['Observed response',s.response===null?'Not measured':s.response+' / 4 (custom)'],['Recovery',s.recovery!==null?s.recovery+' seconds':s.recoveryState||'Not measured'],['Body language',s.observations],['Next change',s.next]].map(([k,v])=>`<div class="detail-row"><span>${E(k)}</span><p>${E(v??'Not recorded')||'Not recorded'}</p></div>`).join('')}</div>
    ${item?link('lesson',s.stepId,'Open linked teaching step '+icon('arrow'),'button secondary full'):''}<div class="button-row">${link('edit-session',id,'Edit session','button secondary')}<button class="button ghost danger-text" data-action="delete-entry" data-id="${E(id)}">Delete</button></div>`;
  }
  function chart(points,title,unit,maxValue) {
    if(!points.length)return `<section class="chart-card"><h3>${E(title)}</h3>${empty('No observations yet','Record dated sessions with this trigger. Unknown values are omitted rather than drawn as zero.')}</section>`;
    const shown=points.slice(-30), w=340,h=170,l=36,r=12,t=20,b=32,max=maxValue??Math.max(1,...shown.map(p=>p.value))*1.12;
    const x=i=>l+(shown.length===1?(w-l-r)/2:i*(w-l-r)/(shown.length-1)),y=v=>h-b-v*(h-t-b)/max;
    const ticks=[0,max/2,max];
    return `<section class="chart-card"><h3>${E(title)}</h3><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${E(title)}: ${shown.length} observations. ${E(unit)}."><title>${E(title)}</title>${ticks.map(v=>`<path d="M${l} ${y(v)}H${w-r}" class="grid-line"/><text x="${l-6}" y="${y(v)+4}" text-anchor="end">${Math.round(v*10)/10}</text>`).join('')}<polyline points="${shown.map((p,i)=>x(i)+','+y(p.value)).join(' ')}" class="chart-line"/>${shown.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="4" class="chart-dot"><title>${E(p.date)}: ${p.value} ${E(unit)}</title></circle>`).join('')}<text x="${l}" y="${h-6}">${E(shown[0].date.slice(5))}</text><text x="${w-r}" y="${h-6}" text-anchor="end">${E(shown.at(-1).date.slice(5))}</text></svg><p class="fineprint">Latest ${shown.length} recorded observations · ${E(unit)} · linked in observation order, not evenly spaced calendar time.</p><details><summary>View recorded values</summary><table><thead><tr><th>Date</th><th>${E(unit)}</th></tr></thead><tbody>${shown.map(p=>`<tr><td>${link('entry',p.id,E(dateLabel(p.date)))}</td><td>${p.value}</td></tr>`).join('')}</tbody></table></details></section>`;
  }
  function trendsView() {
    const chosen=C.selectedDogs(state);if(!chosen.some(d=>d.id===trendDogId))trendDogId=chosen[0].id;
    const trendState=C.dogState(state,trendDogId),sum=C.summary(D,trendState),obs=C.observations(trendState,trendTrigger);
    return `${backBar('learn','','Lessons')}<div class="page-title"><span class="eyebrow">PROGRESS, WITH CONTEXT</span><h1>Look for<br>comfortable change.</h1><p>Learning a step and feeling less anxious are different things.</p></div>
    ${C.selectedDogs(state).length>1?selectField('Show one dog’s trends','trendDog',C.selectedDogs(state).map(d=>[d.id,d.profile.name]),trendDogId):''}<section class="progress-overview"><div class="progress-number">${sum.counts.complete}<span> / ${sum.counts.total}</span></div><h2>teaching steps marked consistent</h2><p>${sum.counts.skills} complete skills · this is not a percentage cure of anxiety.</p></section>
    ${section('Learning by topic')}<div class="topic-progress">${sum.topics.map(t=>link('topic',t.name,`<div class="progress-label"><strong>${E(t.name)}</strong><span>${t.complete} / ${t.total}</span></div><div class="progress-track"><span style="width:${100*t.complete/t.total}%;background:var(--topic-${topicIndex(t.name)})"></span></div>`,'topic-progress-row')).join('')}</div>
    ${GroundHistory.render(trendState.progressHistory,C.dateToday(),E,dateLabel,topicIndex)}
    ${section('Trigger observations')}<label class="field"><span>Choose a trigger</span><select id="trend-trigger">${selectOptions(D.triggers.map(t=>t.name),trendTrigger)}</select></label><p class="fineprint">Compare similar contexts. Easier conditions can lower a response without showing comfort in harder conditions. These charts make no clinical judgment.</p>
    ${chart(obs.recovery,'Recovery after the event','seconds')}${chart(obs.response,'Observed response','custom response 0–4',4)}
    <div class="notice"><strong>Describe more than the number.</strong><p>Recovery means returning to their ordinary comfortable behavior after the event ends. The 0–4 description is a personal tracking aid. Keep the setup and body-language notes alongside it.</p></div>`;
  }
  // The form ID is public routing information, never an account/API credential.
  // Public Formspree form ID lives in the bundled HTML; no private credentials.
  const feedbackFormId=document.querySelector('meta[name="good-ground-feedback-form"]')?.content||'';
  const feedbackEndpoint=/^[a-z0-9]{6,64}$/.test(feedbackFormId)?'https://formspree.io/f/'+feedbackFormId:'';
  let feedbackDraft={message:'',email:'',consent:false},feedbackPending=false,feedbackStatus='',feedbackLastSent=0;
  function feedbackView() {
    return `${backBar('more','','More')}<div class="page-title"><span class="eyebrow">HELP GOOD GROUND GROW</span><h1>Feedback.</h1><p>Share an idea, something confusing, or a problem you found.</p></div>${!feedbackEndpoint?'<aside class="notice"><strong>Feedback delivery is not connected yet.</strong><p>You can write and copy your message. Nothing will be sent until the app owner connects the feedback inbox.</p></aside>':''}<form id="feedback-form" class="form-card">${formError()}<label class="field"><span>Your feedback</span><textarea name="message" rows="6" maxlength="5000" required>${E(feedbackDraft.message)}</textarea><small>Please leave out passwords, health records and other sensitive details. Your draft stays only while this app page remains open.</small></label><label class="field"><span>Email for a reply · optional</span><input type="email" name="email" maxlength="254" autocomplete="email" value="${E(feedbackDraft.email)}"><small>Leave blank to send without a reply address.</small></label><div class="feedback-honeypot" aria-hidden="true"><label>Leave this empty<input name="_gotcha" type="text" tabindex="-1" autocomplete="off"></label></div><p class="fineprint" id="feedback-privacy">Submit sends your message and optional reply address through Formspree to the app owner. Formspree also receives connection information such as your IP address. Dog profiles, progress and journal entries are never attached. <a href="https://formspree.io/legal/privacy-policy/" rel="noopener noreferrer">Formspree privacy policy ↗</a></p><label class="check-chip"><input name="consent" type="checkbox" ${feedbackDraft.consent?'checked':''} aria-describedby="feedback-privacy"><span>I agree to send this feedback through Formspree.</span></label><p id="feedback-status" role="status" aria-live="polite">${E(feedbackStatus)}</p><button type="submit" class="button" ${!feedbackEndpoint||feedbackPending?'disabled':''}>${feedbackPending?'Sending…':'Submit feedback'}</button><button type="button" class="button secondary full" data-action="copy-feedback" ${feedbackPending?'disabled':''}>Copy feedback</button></form>`;
  }
  function rememberFeedback(form) {
    if(feedbackPending)return;
    const fields=new FormData(form);feedbackDraft={message:String(fields.get('message')||''),email:String(fields.get('email')||''),consent:fields.has('consent')};
  }
  async function submitFeedback(form) {
    if(feedbackPending)return;
    rememberFeedback(form);feedbackStatus='';
    const error=form.querySelector('.form-error');error.hidden=true;
    if(!feedbackEndpoint){failForm(form,'Feedback delivery is not connected yet. You can copy your message.');return;}
    const message=feedbackDraft.message.trim(),email=feedbackDraft.email.trim();
    if(!message||message.length>5000){failForm(form,'Write a message of up to 5,000 characters.');return;}
    if(!form.reportValidity())return;
    if(!feedbackDraft.consent){failForm(form,'Please agree to send your feedback through Formspree.');return;}
    if(new FormData(form).get('_gotcha')){failForm(form,'This submission could not be sent.');return;}
    if(feedbackLastSent&&Date.now()-feedbackLastSent<30000){failForm(form,'Please wait a moment before sending another message.');return;}
    if(navigator.onLine===false){failForm(form,'You appear to be offline. Your draft is still here; connect and try again.');return;}
    feedbackPending=true;
    const button=form.querySelector('[type=submit]'),status=form.querySelector('#feedback-status');
    button.disabled=true;button.textContent='Sending…';form.setAttribute('aria-busy','true');status.textContent='Sending feedback…';
    // Freeze this draft until the request finishes, so a successful response
    // cannot erase changes typed while it was in flight.
    form.querySelectorAll('textarea,input').forEach(el=>el.disabled=true);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(feedbackEndpoint,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({message,...(email?{email}:{}),_subject:'Good Ground feedback',_gotcha:''}),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
      let result;try{result=await response.json();}catch{throw new Error('Delivery could not be confirmed. Your draft is still here; the message may have arrived. Check before retrying.');}
      if(!response.ok||result?.ok!==true){
        if(response.status===429)throw new Error('The feedback service is busy or its allowance is full. Your draft is still here; try again later.');
        if(result?.errors?.some(e=>/captcha/i.test(e.code||e.message||'')))throw new Error('The service requires a verification this app cannot show. Your draft is still here; the app owner needs to check the feedback setup.');
        throw new Error('The service did not accept this message. Your draft is still here; please try later.');
      }
      feedbackLastSent=Date.now();feedbackDraft={message:'',email:'',consent:false};feedbackStatus='Feedback received by our form service. Thank you!';
      if(form.isConnected){form.reset();form.querySelector('[name=message]').value='';form.querySelector('[name=email]').value='';form.querySelector('[name=consent]').checked=false;status.textContent=feedbackStatus;}else if(route!=='feedback')toast(feedbackStatus);
    } catch(error) {
      const message=error instanceof TypeError||error.name==='AbortError'?'Delivery could not be confirmed. Your draft is still here; the message may have arrived. Connect and check before retrying.':error.message;
      feedbackStatus=message;if(form.isConnected){status.textContent='';failForm(form,message);}else if(route!=='feedback')toast(message,true);
    } finally {
      clearTimeout(timeout);feedbackPending=false;
      if(form.isConnected){form.querySelectorAll('textarea,input').forEach(el=>el.disabled=false);button.disabled=false;button.textContent='Submit feedback';form.removeAttribute('aria-busy');}
      if(route==='feedback'&&$('#feedback-form')!==form)render({preserveScroll:true});
    }
  }
  function moreView() {
    const rows=[['settings','tune','Settings','Lesson display, appearance, clicker and backups'],['sources','book','Source library','Training essentials, evidence and references'],['dogs','dog','Your dogs','Profiles and separate training records'],['tutorial','learn','How to use Good Ground','A brief, practical tour you can replay'],['feedback','heart','Feedback','Share an idea or report a problem'],['about','shield','About Good Ground','Privacy, app guide and compatibility']];
    return `<div class="page-title"><span class="eyebrow">YOUR COMPANION TOOLKIT</span><h1>A little more<br>good ground.</h1><p>The useful details, all in one place.</p></div><div class="menu-list">${rows.map(([p,i,t,d])=>link(p,'',`<div class="menu-icon">${icon(i)}</div><span><strong>${E(t)}</strong><small>${E(d)}</small></span>${icon('arrow')}`,'menu-row')).join('')}</div><div class="local-card">${icon('shield')}<h2>At home on your phone.</h2><p>No account needed for training. No analytics or background uploads. Training records stay local; feedback is sent only when you choose Submit.</p><small data-save-indicator>${E(saveStatus)}</small></div>`;
  }
  function plansView() {
    const chosen=C.selectedDogs(state);if(!chosen.some(d=>d.id===planDogId))planDogId=chosen[0].id;const dog=C.dogState(state,planDogId);
    return `${backBar('learn','','Lessons')}<div class="page-title"><span class="eyebrow">MAKE THE START MANAGEABLE</span><h1>Trigger plans.</h1><p>Use safe existing observations. Never provoke a reaction to measure a threshold. Change one feature at a time.</p></div>${C.selectedDogs(state).length>1?selectField('Plans for','planDog',C.selectedDogs(state).map(d=>[d.id,d.profile.name]),planDogId):''}<div class="stack">${D.triggers.map(t=>link('plan',t.name,`<div class="menu-icon">${icon(topicIcon(itemFor(t.step)?.skill.sheet))}</div><span><strong>${E(t.name)}</strong><small>${dog.plans[t.name]?.setup?'Your plan is started':E(t.example)}</small></span>${icon('arrow')}`,'menu-row')).join('')}</div>`;
  }
  function planView(name) {
    const t=D.triggers.find(x=>x.name===name);if(!t)return notFound();
    if(!C.selectedDogs(state).some(d=>d.id===planDogId))planDogId=C.selectedDogs(state)[0].id;
    const dog=C.dogState(state,planDogId),p=dog.plans[name]||{};
    return `${backBar('plans','','Trigger plans')}<div class="page-title"><h1>${E(name)}</h1>${C.dogs(state).length>1?`<p>For ${E(dog.profile.name)}</p>`:''}<p>${E(t.example)} This is an example, not a prescribed starting distance or intensity.</p></div>${link('lesson',t.step,'Open the teaching program '+icon('arrow'),'button secondary full')}
    <form id="plan-form" data-dog-id="${E(planDogId)}" data-id="${E(name)}" class="form-card">${formError()}${textField('A version my dog can handle comfortably','setup',p.setup)}${textField('Their comfortable body language','baseline',p.baseline)}${textField('One small next change','next',p.next)}${textField('Exit, space, and management','exit',p.exit)}${textField('Notes and support','notes',p.notes)}<button type="submit" class="button">Save trigger plan</button></form>`;
  }
  function basicsView() {
    return `${backBar('sources','','Source library')}<div class="page-title"><span class="eyebrow">THE WAY WE PRACTICE</span><h1>Kindness is<br>part of the method.</h1><p>A useful cue and a comfortable emotional response are different learning goals.</p></div><div class="reading-stack">${D.intro.map(x=>`<section class="reading-card"><h2>${E(x.title)}</h2><p>${E(x.body)}</p></section>`).join('')}</div>
    <section class="reading-card"><h2>Read the progress stages</h2><p>Practicing and Nearly there describe a step in its stated setting. Consistent means it meets the adjacent advancement criterion. Almost-consistent prerequisites permit easy parallel work where the lesson allows it; strict prerequisites need consistency. Paused blocks dependent steps.</p><p>The usual four-in-five rule is a practical planning aid, not a validated scientific cutoff. Comfort overrides every count and availability badge.</p></section><section class="reading-card" id="practice-rhythms" tabindex="-1"><h2>Practice rhythms</h2><p>Comfortable refreshers can help keep familiar skills rewarding. The weekly reminder is a practical nudge you can change or turn off. It does not predict forgetting. Keep practice short and rewarding, allow rest, and choose a comfortable setting.</p><p>Dates reflect linked skill-practice records. A missing log does not mean your dog has forgotten. Fear and exposure programs are left out of automatic refreshers.</p>${sourceLinks('R13; R27; P33')}${link('settings','','Change reminders','text-link')}</section>${link('evidence','','Read evidence & limitations '+icon('arrow'),'button secondary full')}`;
  }
  function evidenceView() {
    return `${backBar('sources','','Source library')}<div class="page-title"><span class="eyebrow">RESEARCH, WITHOUT THE OVERCLAIM</span><h1>Evidence &<br>limitations.</h1><p>A focused review with professional guidance, studies, and original teaching adaptations. It is not an exhaustive systematic review.</p></div><div class="reading-stack">${D.evidence.map(x=>`<section class="reading-card"><h2>${E(x.topic)}</h2><p>${E(x.conclusion)}</p><details><summary>Strength and limits</summary><p>${E(x.limits)}</p></details>${sourceLinks(x.sources)}</section>`).join('')}</div>`;
  }
  function sourcesView() {
    return `${backBar('more','','More')}<div class="page-title"><span class="eyebrow">THE REFERENCE SHELF</span><h1>Read the<br>original thinking.</h1><p>Summaries work offline. Original websites require a connection and may have access restrictions.</p></div><nav class="training-tools" aria-label="Training resources">${link('basics','','Training essentials','button secondary')}${link('evidence','','Evidence & limitations','button secondary')}</nav><label class="search-field">${icon('search')}<span class="sr-only">Search references</span><input id="source-search" type="search" placeholder="Search title, topic, or source ID"></label><div id="source-results" class="stack">${sourcesResults('')}</div>`;
  }
  function sourcesResults(query) {
    const sources=D.sources.filter(s=>[s.id,s.title,s.author,s.finding].join(' ').toLowerCase().includes(query.toLowerCase()));
    return sources.map(s=>link('source',s.id,`<span class="reference-id">${E(s.id)}</span><div class="card-copy"><h3>${E(s.title)}</h3><p>${E(s.author)} · ${E(s.year)}</p><small>${E(s.type)}</small></div>${icon('arrow')}`,'source-card')).join('')||empty('No matching references','Try a shorter title or a source ID.');
  }
  function sourceView(id) {
    const s=D.sources.find(x=>x.id===id);if(!s)return notFound();
    const safeURL=/^https?:\/\//i.test(s.url);
    return `${sourceContext?backBar(sourceContext.type,sourceContext.id,sourceContext.type==='lesson'?'Back to lesson':'Evidence & limitations'):backBar('sources','','Source library')}<div class="page-title"><span class="eyebrow">${E(s.id)} · ${E(s.type)}</span><h1 class="source-title">${E(s.title)}</h1><p>${E(s.author)} · ${E(s.year)}</p></div><div class="reading-stack">${[['Finding',s.finding],['Limits to keep in mind',s.limits],['What was reviewed',s.access],['Use in this guide',s.use]].map(([h,b])=>`<section class="reading-card"><h2>${E(h)}</h2><p>${E(b)}</p></section>`).join('')}</div>${safeURL?`<a class="button secondary full" href="${E(s.url)}" rel="noopener noreferrer">Open original website ↗</a><p class="fineprint">Opens your browser. This is the only part of the guide that needs the original website.</p>`:''}`;
  }
  function backupView() {
    return `${backBar('settings','','Settings')}<div class="page-title"><span class="eyebrow">KEEP WHAT YOU’VE LEARNED</span><h1>A copy of<br>your good work.</h1><p>Lessons come with the app. A backup keeps your personal progress, progress history, notes, profile, trigger plans, and journal.</p></div>
    <section class="reading-card"><h2>Export a backup</h2><p>Save a JSON file with Android’s document picker. Choose a folder on this device to keep the copy local, or a storage provider you trust. Export a backup before uninstalling or clearing the app’s storage. Backups can be restored in either Good Ground app; sharing a file does not synchronize later changes.</p><button class="button" data-action="export">${icon('save')}Save backup to Files</button></section>
    <section class="reading-card"><h2>Restore a backup</h2><p>The file is validated first. You’ll see a summary and confirm before it replaces current records. Canceling leaves your records untouched.</p><button class="button secondary" data-action="import">${icon('restore')}Choose backup file</button></section>${native?'<section class="reading-card"><h2>Previous local save</h2><p>If a recent change or damaged file needs recovery, you can preview the previous local snapshot before deciding whether to restore it.</p><button class="button secondary" data-action="recover-previous">Preview previous save</button></section>':''}<p class="fineprint" data-save-indicator>${E(saveStatus)}</p>`;
  }
  function requestLeave(destination) {
    if(settingsSaveBusy)return;
    pendingNavigation=destination;
    if(route==='settings')openModal('Save your settings?',`<p>Save these changes before leaving, discard them, or keep editing.</p>${formError()}<p id="settings-save-status" role="status" aria-live="polite"></p><div class="button-row"><button class="button secondary" data-action="close-modal">Stay in Settings</button><button class="button secondary" data-action="discard-form">Discard changes</button><button class="button" data-action="save-settings-exit">Save and Exit</button></div>`);
    else confirmAction('Leave this form?','Save your changes first, or leave without saving.','discard-form','Leave without saving');
  }
  function waitForSettingsSave(revision) {
    if(acknowledged>=revision)return Promise.resolve();
    if(saveStatus.includes('not'))return Promise.reject(new Error('The changes could not be saved. Keep editing here and try again.'));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{settingsWaiter=null;reject(new Error('Saving could not be confirmed. Your changes are still here; retry before leaving.'));},10000);
      settingsWaiter={revision,resolve:()=>{clearTimeout(timer);settingsWaiter=null;resolve();},reject:()=>{clearTimeout(timer);settingsWaiter=null;reject(new Error('The changes could not be saved. Your choices are still here; retry before leaving.'));}};
    });
  }
  async function saveSettings(form,destination='') {
    if(settingsSaveBusy||!form?.reportValidity())return;
    const fields=new FormData(form),before={...state.settings};
    const settings={...before,theme:String(fields.get('theme')),textSize:String(fields.get('textSize')),lessonMarker:fields.has('lessonMarker'),reminderDays:Number(fields.get('reminderDays'))};
    settingsSaveBusy=true;form.setAttribute('aria-busy','true');
    document.querySelectorAll('#settings-form .form-error,#modal-root .form-error').forEach(e=>e.hidden=true);
    form.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);
    document.querySelectorAll('#modal-root button').forEach(e=>e.disabled=true);
    const status=$('#settings-save-status');if(status)status.textContent='Saving settings…';
    let staged=false;
    try {
      const next=C.validateState(C.touch({...state,settings}));
      if(!commit(next))throw new Error('These settings could not be saved. Your choices are still here.');
      staged=true;await waitForSettingsSave(state.revision);
      dirty=false;settingsSaveBusy=false;
      closeModal();applySettings();
      if(destination){if(destination==='native-back')goBack();else location.hash=destination;}else render({preserveScroll:true});
      toast('Settings saved.');
    }catch(error){
      if(staged)state=C.touch({...state,settings:before});
      dirty=true;saveStatus='Could not save — keep these settings open';showSave();
      const target=$('#modal-root .form-error')?$('#modal-root'):form;failForm(target,error.message);
      if(status)status.textContent='';
    }finally{
      settingsSaveBusy=false;form.removeAttribute('aria-busy');
      if(form.isConnected)form.querySelectorAll('input,select,button').forEach(e=>e.disabled=false);
      document.querySelectorAll('#modal-root button').forEach(e=>e.disabled=false);
    }
  }
  function settingsView() {
    return `${backBar('more','','More')}<div class="page-title"><span class="eyebrow">COMFORTABLE TO READ</span><h1>Make yourself<br>at home.</h1><p>Appearance changes never change your training records.</p></div><form id="settings-form" class="form-card">${formError()}${selectField('Color theme','theme',[['light','Warm light'],['dark','Quiet dark'],['system','Follow device appearance']],state.settings.theme)}${selectField('Text size','textSize',[['normal','Comfortable'],['large','Larger']],state.settings.textSize)}${selectField('Gentle refresher reminders','reminderDays',[[7,'After a week without a recent record'],[14,'After two weeks'],[30,'After a month'],[0,'Turn reminders off']].map(([v,t])=>[String(v),t]),String(state.settings.reminderDays))}<p class="fineprint">A practical nudge for learned foundations and walk skills, not a scientific forgetting deadline.</p><label class="check-chip"><input name="lessonMarker" type="checkbox" ${state.settings.lessonMarker?'checked':''}><span>Show the clicker and lesson marker</span></label><p class="fineprint">Mark & reward stays within reach alongside Set progress. ${state.settings.lessonMarker?'Choose a sound and volume in '+link('clicker','','Clicker')+'.':'Enable the marker to show its training controls.'}</p><button class="button" type="submit">Save settings</button></form>${link('backup','',icon('save')+'Backup & restore','button secondary full')}`;
  }
  function aboutView() {
    return `${backBar('more','','More')}<div class="page-title"><span class="brand-kicker">GOOD GROUND</span><h1>Practice kindly.<br>Keep it local.</h1><p>A personal dog-training companion built around comfortable progress and useful teaching guides.</p></div><div class="reading-stack"><section class="reading-card"><h2>On this phone</h2><p>Version 1.7.1 · Curriculum ${D.version} · Updated ${E(D.updated)}.</p><p>${D.skills.length} skills and programs · ${I.steps.size} teaching steps · ${D.sources.length} reference records.</p><p>Your records are stored privately on this phone. It has no analytics, remote fonts, advertising or background data uploads. Optional feedback sends only what you type to Formspree when you submit it. Android’s automatic app backup and device transfer are disabled for these records; you control any exported files.</p></section><section class="reading-card"><h2>Built for real life</h2><p>The lessons are educational planning guides. Sudden changes, pain, severe panic, bites or redirection, and no comfortable starting setup deserve individual veterinary and behavior support. Secure equipment, barriers, and distance can help while arranging that care.</p></section><section class="reading-card"><h2>On Android</h2><p>Records stay in this app’s private storage. Install updates over the existing app to retain them. Uninstalling or clearing storage removes those records, so export a backup first. Android’s document picker handles backup files. Keep Android System WebView or Chrome updated for the bundled interface.</p></section></div>`;
  }
  function notFound() {return empty('That page is not here','Return to the library to find the lesson you need.',link('learn','','Open the library','button'));}
  function currentTab(type) {return ['project','lesson','topic','learn','clicker','trends','plans','plan','practice'].includes(type)?'learn':['journal','session','entry','edit-session'].includes(type)?'journal':type==='today'?'today':'more';}
  const navObserver=new ResizeObserver(entries=>{for(const entry of entries)document.documentElement.style.setProperty('--nav-height',entry.target.getBoundingClientRect().height+'px');GroundLessonControls.refresh();});
  function render(options={}) {
    if(!loadError){try{const observed=C.observeProgress(D,state);if(observed!==state)commit(observed);}catch(error){toast(error.message,true);}}
    const previousY=scrollY;dirty=false;training=C.trainingView(state);
    const [part,raw='']=location.hash.replace(/^#\/?/,'').split('/');let type=part||'today';let id='';try{id=decodeURIComponent(raw);}catch{}
    if(!loadError&&!window.GOOD_GROUND_BOOT?.smoke){if(!state.household.setupComplete)type='setup';else if(!state.household.tutorialSeenVersion)type='tutorial';else if(needsDogChoice)type='choose-dogs';}
    const startup=['setup','tutorial','choose-dogs'].includes(type);
    route=type;renderedHash=location.hash||'#/today';
    const views={feedback:feedbackView,setup:setupView,tutorial:guideView,'choose-dogs':dogChooserView,'add-dog':addDogView,practice:practiceView,clicker:()=>clickerView(id),today:todayView,learn:learnView,topic:()=>topicView(id),project:()=>projectView(id),lesson:()=>lessonView(id),journal:journalView,session:()=>sessionForm(id),entry:()=>entryView(id),'edit-session':()=>sessionForm(id,true),trends:trendsView,more:moreView,profile:()=>profileView(id),dogs:dogsView,plans:plansView,plan:()=>planView(id),basics:basicsView,evidence:evidenceView,sources:sourcesView,source:()=>sourceView(id),backup:backupView,settings:settingsView,about:aboutView};
    $('#app').innerHTML=`<div class="app-shell"><div class="top-safe"></div><div id="save-warning" class="load-error" role="alert" ${saveStatus.includes('not')?'':'hidden'}><strong>This change could not be saved.</strong><p>Keep the app open. Retry, or export a backup to protect your work.</p><button class="button secondary" data-action="retry-save">Retry save</button> <button class="button secondary" data-action="export">Export backup</button></div>${loadError?`<div class="load-error" role="alert"><strong>Saved data needs attention.</strong><p>${E(loadError)}</p><button class="button secondary" data-action="import">Restore a backup</button></div>`:''}<main id="main" data-route="${E(type)}" data-page-id="${E(id)}" class="page ${type==='today'?'home-page':''}" tabindex="-1">${!startup?trainingContext():''}${(views[type]||notFound)()}</main><nav class="tab-bar" aria-label="Main navigation" ${startup?'hidden':''}>${[['today','home','Today'],['learn','learn','Lessons'],['journal','journal','Journal'],['more','more','More']].map(([p,i,t])=>`<a href="${path(p)}" class="tab ${currentTab(type)===p?'active':''}" ${currentTab(type)===p?'aria-current="page"':''}>${icon(i)}<span>${t}</span></a>`).join('')}</nav></div>`;
    if(type==='feedback'&&feedbackPending)document.querySelectorAll('#feedback-form textarea,#feedback-form input').forEach(el=>el.disabled=true);
    applySettings();
    navObserver.disconnect();const nav=$('.tab-bar');if(nav&&!startup)navObserver.observe(nav);GroundLessonControls.mount();
    document.title=(type==='lesson'?itemFor(id)?.skill.title||'Lesson':type.charAt(0).toUpperCase()+type.slice(1))+' · Good Ground';
    window.scrollTo(0,options.preserveScroll?previousY:0);
    if(type==='basics'&&id==='practice-rhythms')requestAnimationFrame(()=>{const target=$('#practice-rhythms');target?.scrollIntoView({block:'start',behavior:'instant'});target?.focus({preventScroll:true});});
  }
  function navigate(type,id) {routePositions.set(location.hash||'#/today',scrollY);pendingScroll=0;location.hash=path(type,id);}
  function stageNotes() {
    let next=state;
    document.querySelectorAll('[data-step-notes]').forEach(el=>{
      const dog=C.dogState(next,el.dataset.dogId);
      if(el.value!==(dog.progress[el.dataset.id]?.notes||''))next=C.updateDog(next,el.dataset.dogId,()=>C.setProgress(dog,el.dataset.id,C.status(dog,el.dataset.id),el.value));
    });
    document.querySelectorAll('[data-cue-input]').forEach(el=>{
      const dog=C.dogState(next,el.dataset.dogId),skill=cueSkill(el.dataset.skill),fallback=defaultCue(skill,dog),cue=el.value.trim()||fallback;
      if(cue!==(dog.cues[skill.code]??fallback))next=C.updateDog(next,el.dataset.dogId,d=>{
        const cues={...d.cues};if(cue===fallback)delete cues[skill.code];else cues[skill.code]=cue;return {...d,cues};
      });
      el.value=cue;const note=el.closest('.cue-row').querySelector('.custom-cue-note');note.hidden=cue===fallback;note.textContent=note.hidden?'':'Use “'+cue+'” where the guide suggests “'+skill.cue+'”.';
    });
    return next===state||commit(next);
  }
  async function importText(text) {
    try {
      pendingBackup=C.parseBackup(text);
      const backupDogs=C.dogs(pendingBackup),sessionCount=backupDogs.reduce((n,d)=>n+d.sessions.length,0),stepCount=backupDogs.reduce((n,d)=>n+Object.keys(d.progress).length,0);
      openModal('Restore this backup?',`<p>This file contains <strong>${backupDogs.length} dog ${backupDogs.length===1?'profile':'profiles'}</strong>, <strong>${sessionCount} sessions</strong>, and <strong>${stepCount} recorded steps</strong>.</p><p>${backupDogs.map(d=>E(d.profile.name||'Your dog')).join(', ')}</p><p>Restoring replaces all current dog profiles, progress, progress history, notes, plans, cues, and journals. Export your current records first if you want to keep both.</p><div class="button-row"><button class="button secondary" data-action="close-modal">Cancel</button><button class="button" data-action="restore-confirm">Restore backup</button></div>`);
    } catch(error){toast(error.message,true);}
  }
  document.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    const button=event.target.closest('[data-marker]');if(!button){markerPointer=null;return;}
    markerPointer={button,id:event.pointerId,releasedAt:null};playMarker(button);
  });
  document.addEventListener('pointerup',event=>{
    if(markerPointer?.id!==event.pointerId)return;
    const press=markerPointer;press.releasedAt=performance.now();
    setTimeout(()=>{if(markerPointer===press)markerPointer=null;},500);
  });
  document.addEventListener('pointercancel',()=>{markerPointer=null;});
  window.addEventListener('blur',()=>{markerPointer=null;markerKey=null;});
  document.addEventListener('click',event=>{
    // A status change can move this sticky control during a touch (WebKit).
    // The release still belongs to the marker press, never to a link beneath it.
    if(markerPointer&&!event.target.closest('[data-marker]')){event.preventDefault();markerPointer=null;return;}
    const marker=event.target.closest('[data-marker]');if(marker){const alreadyMarked=markerPointer?.button===marker;markerPointer=null;if(!alreadyMarked)playMarker(marker);return;}
    const control=event.target.closest('a[href^="#/"],[data-go],[data-action]');
    if(control&&!['export','close-modal'].includes(control.dataset.action)&&!stageNotes()){event.preventDefault();return;}
    const anchor=event.target.closest('a[href^="#/"]');
    if(settingsSaveBusy&&control){event.preventDefault();return;}
    if(anchor&&dirty){event.preventDefault();requestLeave(anchor.getAttribute('href'));return;}
    if(anchor){
      routePositions.set(location.hash||'#/today',scrollY);
      pendingScroll=anchor.dataset.restore==='true'?(routePositions.get(anchor.getAttribute('href'))||0):0;
      if(anchor.getAttribute('href').startsWith('#/source/')){
        sourceContext=['lesson','evidence'].includes(route)?{type:route,id:decodeURIComponent(location.hash.split('/')[2]||'')}:null;
      }
      stageNotes();if(anchor.closest('#modal-root')&&anchor.getAttribute('href')===location.hash){event.preventDefault();closeModal();}
    }
    const go=event.target.closest('[data-go]');if(go){if(dirty){requestLeave(path(go.dataset.go));}else navigate(go.dataset.go);return;}
    const el=event.target.closest('[data-action]');if(!el)return;
    const {action,id,value}=el.dataset;
    switch(action){
      case 'change-dog-count':{
        if(dirty){confirmAction('Change the household size?','Names and profiles you already saved are kept. Unsaved changes on this page will be discarded.','change-count-confirm','Change dog count');break;}
        if(commit(C.touch({...state,household:{...state.household,setupTarget:0,setupIndex:0}})))render();break;
      }
      case 'change-count-confirm':{
        dirty=false;closeModal();if(commit(C.touch({...state,household:{...state.household,setupTarget:0,setupIndex:0}})))render();break;
      }
      case 'choose-breed':{
        breedTarget=el.closest('form');breedQuery='';openModal('A little about their breed',`<label class="search-field">${icon('search')}<span class="sr-only">Search breeds or enter a mix</span><input id="breed-search" type="search" placeholder="Search breeds or enter a mix" maxlength="200" autocomplete="off" autofocus></label><p class="fineprint">Choose a name, or type your own mix. This does not assign a temperament.</p><div id="breed-results" class="breed-options">${breedResults()}</div>`);break;
      }
      case 'pick-breed':{
        if(breedTarget?.isConnected){breedTarget.querySelector('[name="breed"]').value=value;breedTarget.querySelector('.breed-value').textContent=value||'Choose or search a breed';dirty=true;}closeModal();break;
      }
      case 'confirm-support':{
        const dogId=el.dataset.dogId,trait=el.dataset.trait;
        if(['noise','novelty','handling'].includes(trait)&&commit(C.updateDog(state,dogId,d=>({...d,tailoring:{...d.tailoring,traits:[...new Set([...d.tailoring.traits,trait])]}}))))closeModal();break;
      }
      case 'choose-dogs':{
        if(dirty){requestLeave('#/choose-dogs');break;}
        stageNotes();needsDogChoice=true;render();break;
      }
      case 'add-dog':navigate('add-dog');break;
      case 'skip-profile':completeSetup();break;
      case 'guide-next':guideIndex++;render();$('#main').focus();break;
      case 'guide-back':guideIndex--;render();$('#main').focus();break;
      case 'finish-guide':{
        if(commit(C.touch({...state,household:{...state.household,tutorialSeenVersion:GROUND_GUIDE.version}}))){guideIndex=0;if(location.hash==='#/tutorial')navigate('today');else render();}break;
      }
      case 'dismiss-reminders':if(commit(C.touch({...state,settings:{...state.settings,remindersDismissedOn:C.dateToday()}})))render({preserveScroll:true});break;
      case 'quick-practice':{
        const ids=el.dataset.dogId?[el.dataset.dogId]:C.selectedDogs(state).map(d=>d.id),daily=el.hasAttribute('data-daily-practice');
        try{
          const logged=C.logPracticeToday(D,state,ids,id);
          if(!logged.added){toast('Already logged today. You can add more detail in Journal.');break;}
          if(commit(logged.state)){
            render({preserveScroll:true});
            if(daily)$('#daily-practice-next')?.focus({preventScroll:true});
            toast('Today’s practice logged for '+logged.added+(logged.added===1?' dog.':' dogs.'));
          }
        }catch(error){toast(error.message,true);}break;
      }
      case 'close-modal': closeModal();break;
      case 'copy-feedback':{
        const form=$('#feedback-form');rememberFeedback(form);
        if(!feedbackDraft.message.trim()){failForm(form,'Write your feedback first.');break;}
        const copy=feedbackDraft.message+(feedbackDraft.email?'\n\nReply to: '+feedbackDraft.email:'');
        if(navigator.clipboard?.writeText)navigator.clipboard.writeText(copy).then(()=>toast('Feedback copied.')).catch(()=>{const field=form.querySelector('textarea');field.focus();field.select();toast('Your message is selected. Use your device’s Copy command.');});
        else {const field=form.querySelector('textarea');field.focus();field.select();toast('Your message is selected. Use your device’s Copy command.');}break;
      }
      case 'choose-step':chooseStep(id);break;
      case 'retry-save':flush();break;
      case 'recover-previous':send('recoverPrevious');break;
      case 'save-settings-exit':saveSettings($('#settings-form'),pendingNavigation);break;
      case 'discard-form':dirty=false;closeModal();if(pendingNavigation==='native-back')goBack();else location.hash=pendingNavigation;break;
      case 'available':learnPage=0;learnFilter='available';learnTopic='';learnQuery='';navigate('learn');break;
      case 'fun-pick':{
        const play=C.trainingAvailable(D,state).filter(x=>['Enrichment','Optional trick'].includes(x.skill.priority));
        if(play.length){const choice=play[Math.floor(Math.random()*play.length)];$('#fun-suggestion').innerHTML=lessonCard(choice.skill,choice.step,true);}break;
      }
      case 'learn-filter':learnPage=0;learnFilter=value;render();break;
      case 'library-reset':learnPage=0;learnQuery='';learnTopic='';learnFilter='all';render();$('#learn-search')?.focus();break;
      case 'topic-clear':topicQueries.delete(el.dataset.topic);topicPages.delete(el.dataset.topic);render();$('#topic-search')?.focus();break;
      case 'library-page':{
        const page=Number(value);if(!Number.isInteger(page)||page<0)break;
        if(el.dataset.kind==='topic')topicPages.set(el.dataset.topic,page);else learnPage=page;
        render();$('#library-count')?.focus({preventScroll:true});break;
      }
      case 'progress':stageNotes();progressModal(id);break;
      case 'set-progress':{
        const chosen=C.selectedDogs(state),ids=chosen.length>1?[...document.querySelectorAll('[name="progressDog"]:checked')].map(x=>x.value):[chosen[0].id];
        if(!ids.length){toast('Choose at least one dog for this change.',true);break;}
        if(commit(C.setDogProgress(state,ids,id,value))){
          training=C.trainingView(state);
          closeModal();
          if(value===C.STATUSES[3]&&C.status(training,id)===C.STATUSES[3]){
            const item=itemFor(id),next=C.nextTeachingStep(item.skill,training,id);
            if(next){navigate('lesson',next.id);toast('Step complete. Here’s your next step.');}
            else {render({preserveScroll:true});if(item.skill.steps.every(s=>C.status(training,s.id)===C.STATUSES[3]))completionSuggestions(item.skill);else toast('Step recorded. Other steps still need their prerequisites.');}
          }else{render({preserveScroll:true});$('.lesson-actions [data-action="progress"]')?.focus({preventScroll:true});toast('Progress saved.');}
        }break;
      }
      case 'favorite':{
        const favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];
        if(commit(C.touch({...state,favorites}))){render({preserveScroll:true});$('[data-action="favorite"]')?.focus({preventScroll:true});toast(favorites.includes(id)?'Skill saved to your library.':'Skill removed from Saved.');}break;
      }
      case 'delete-entry':pendingDelete=id;confirmAction('Delete this session?','This removes the session from your journal and charts. Lesson progress stays as recorded.','delete-confirm','Delete session',true);break;
      case 'delete-confirm':{const dog=C.selectedDogs(state).find(d=>d.sessions.some(s=>s.id===pendingDelete));if(dog&&commit(C.updateDog(state,dog.id,d=>({...d,sessions:d.sessions.filter(s=>s.id!==pendingDelete)})))){closeModal();navigate('journal');toast('Session deleted.');}break;}
      case 'export':{
        if(loadError){toast('The saved records could not be read. Preview a previous local save or import a backup first.',true);break;}
        try {
          const draftSaved=stageNotes(),json=JSON.stringify(C.makeBackup(state,D));
          if(native){send('export',{json});toast(draftSaved?'Choose where to save your backup.':'Choose a backup location. This copy contains saved records; the oversized note is still unsaved.',!draftSaved);}
          else {const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Good-Ground-backup-'+C.dateToday()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast(draftSaved?'Backup prepared for download.':'Backup prepared from saved records. Shorten the oversized note to save it.',!draftSaved);}
        }catch(error){toast(error.message,true);}break;
      }
      case 'import':if(native)send('import');else $('#backup-file').click();break;
      case 'restore-confirm':{
        if(!pendingBackup)break;
        const next={...pendingBackup,revision:Math.max(state.revision,pendingBackup.revision,Number(window.GOOD_GROUND_BOOT?.lastRevision)||0)+1,lastSavedAt:new Date().toISOString()};
        loadError='';state=C.validateState(next);needsDogChoice=C.dogs(state).length>1;guideIndex=0;pendingBackup=null;flush();closeModal();render();toast('Backup restored.');break;
      }
    }
  });
  let pendingNavigation='',pendingDelete='';
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.closest('#feedback-form')){rememberFeedback(el.closest('form'));}
    else if(el.id==='breed-search'){breedQuery=el.value;$('#breed-results').innerHTML=breedResults();}
    else if(el.id==='marker-volume'){const value=Number(el.value);$('#marker-volume-label').textContent=value+'%';}
    else if(el.id==='learn-search'){learnPage=0;learnQuery=el.value;$('#learn-results').innerHTML=learnResults();}
    else if(el.id==='topic-search'){const topic=el.dataset.topic;topicQueries.set(topic,el.value);topicPages.set(topic,0);$('#topic-results').innerHTML=libraryResults(librarySelection(el.value,topic,learnFilter),{kind:'topic',topic});}
    else if(el.id==='source-search')$('#source-results').innerHTML=sourcesResults(el.value);
    else if(el.closest('form')&&!['dog-choice-form','household-count-form'].includes(el.closest('form').id))dirty=true;
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.closest('#feedback-form')){if(!feedbackPending)rememberFeedback(el.closest('form'));}
    else if(el.matches('[data-history-toggle]')){document.querySelectorAll('[data-history-series]').forEach(g=>{if(g.dataset.historySeries===el.dataset.historyToggle)g.style.display=el.checked?'':'none';});}
    else if(el.name==='householdSize'){$('#dog-count-field').hidden=el.value!=='multiple';$('#dog-count-field input').disabled=el.value!=='multiple';}
    else if(el.name==='markerSound'){if(commit(C.touch({...state,settings:{...state.settings,markerSound:el.value}})))render({preserveScroll:true});}
    else if(el.id==='marker-volume'){commit(C.touch({...state,settings:{...state.settings,markerVolume:Number(el.value)}}));}
    else if(el.id==='lesson-marker-toggle'){if(commit(C.touch({...state,settings:{...state.settings,lessonMarker:el.checked}})))render({preserveScroll:true});}
    else if(el.matches('[data-step-notes],[data-cue-input]'))stageNotes();
    else if(el.id==='learn-topic'){learnPage=0;learnTopic=el.value;$('#learn-results').innerHTML=learnResults();}
    else if(el.id==='journal-filter'){journalFilter=el.value;render();}
    else if(el.name==='trendDog'){trendDogId=el.value;render();}
    else if(el.name==='planDog'){planDogId=el.value;render();}
    else if(el.id==='trend-trigger'){trendTrigger=el.value;render({preserveScroll:true});}
    else if(el.closest('form')&&!['dog-choice-form','household-count-form'].includes(el.closest('form').id))dirty=true;
    if(el.id==='backup-file'&&el.files?.[0]){
      const file=el.files[0];if(file.size>5*1024*1024)toast('Choose a backup smaller than 5 MB.',true);else file.text().then(importText).catch(()=>toast('The backup file could not be read.',true));el.value='';
    }
  });
  document.addEventListener('submit',event=>{
    event.preventDefault();const form=event.target;if(form.id==='feedback-form'){submitFeedback(form);return;}const f=new FormData(form),get=key=>String(f.get(key)||'').trim();
    if(loadError){toast('Restore a readable backup before saving new changes.',true);return;}
    try{
      if(form.id==='household-count-form'){
        const count=get('householdSize')==='one'?1:Number(get('dogCount'));
        if(!Number.isInteger(count)||count<1||count>50)throw new Error('Choose a whole number of dogs from 1 to 50.');
        if(count<C.dogs(state).length)throw new Error('You’ve already saved '+C.dogs(state).length+' dog profiles. Choose at least that many; their records are kept.');
        if(commit(C.touch({...state,household:{...state.household,setupTarget:count,setupIndex:0}}))){dirty=false;render();$('#main').focus();}
      }else if(form.id==='setup-profile-form'){
        const profile=readProfile(form),h=state.household,index=h.setupIndex,existing=C.dogs(state)[index];
        if(h.setupTarget>1&&!profile.name)throw new Error('A name keeps this dog’s progress separate. Please enter their name.');
        if(profile.name&&C.dogs(state).some(d=>d.id!==existing?.id&&d.profile.name.trim().toLocaleLowerCase()===profile.name.toLocaleLowerCase()))throw new Error('Use a distinct name or nickname for this dog.');
        let next=existing?C.updateDog(state,existing.id,d=>({...d,profile,tailoring:{...d.tailoring,traits:f.getAll('trait'),reviewedBreed:d.profile.breed===profile.breed?d.tailoring.reviewedBreed:''}})):C.addDog(state,profile);
        const dogId=C.dogs(next)[index].id;
        if(!existing)next=C.updateDog(next,dogId,d=>({...d,tailoring:{...d.tailoring,traits:f.getAll('trait'),reviewedBreed:d.profile.breed===profile.breed?d.tailoring.reviewedBreed:''}}));
        if(commit(next)){dirty=false;maybeBreedHint(dogId,()=>{
          const finished=index+1>=h.setupTarget;
          if(commit(C.touch({...state,household:{...state.household,setupIndex:index+1,setupComplete:finished}}))){if(finished){guideIndex=0;needsDogChoice=C.dogs(state).length>1;}render();$('#main').focus();}
        });}
      }else if(form.id==='dog-choice-form'){
        if(commit(C.selectDogs(state,f.getAll('dogId')))){needsDogChoice=false;dirty=false;if(location.hash==='#/choose-dogs')navigate('today');else render();$('#main').focus();}
      }else if(form.id==='add-dog-form'){
        const profile=readProfile(form);if(!profile.name)throw new Error('Please enter this dog’s name.');
        if(form.dataset.renameFirst==='true'){
          if(commit(C.updateDog(state,state.household.primaryId,d=>({...d,profile,tailoring:{...d.tailoring,traits:f.getAll('trait'),reviewedBreed:d.profile.breed===profile.breed?d.tailoring.reviewedBreed:''}})))){dirty=false;maybeBreedHint(state.household.primaryId,()=>render());}
        }else {
          let next=C.addDog(state,profile);const dogId=C.dogs(next).at(-1).id;next=C.updateDog(next,dogId,d=>({...d,tailoring:{...d.tailoring,traits:f.getAll('trait'),reviewedBreed:d.profile.breed===profile.breed?d.tailoring.reviewedBreed:''}}));
          if(commit(next)){dirty=false;maybeBreedHint(dogId,()=>{needsDogChoice=true;navigate('today');});}
        }
      }else if(form.id==='profile-form'){
        const dog=C.dogState(state,form.dataset.dogId),profile={...dog.profile};for(const key of Object.keys(profile).filter(k=>k!=='priorities'))profile[key]=get(key);profile.priorities=f.getAll('priority');
        if(C.dogs(state).length>1&&!profile.name)throw new Error('Please give every dog a name.');
        if(profile.name&&C.dogs(state).some(d=>d.id!==form.dataset.dogId&&d.profile.name.trim().toLocaleLowerCase()===profile.name.toLocaleLowerCase()))throw new Error('Choose a distinct name or nickname for this dog.');
        if(commit(C.updateDog(state,form.dataset.dogId,d=>({...d,profile,tailoring:{...d.tailoring,traits:f.getAll('trait'),reviewedBreed:d.profile.breed===profile.breed?d.tailoring.reviewedBreed:''}})))){dirty=false;maybeBreedHint(form.dataset.dogId,()=>{navigate('today');toast('Profile saved.');});}
      }else if(form.id==='plan-form'){
        const plan=Object.fromEntries(['setup','baseline','next','exit','notes'].map(k=>[k,get(k)]));
        if(commit(C.updateDog(state,form.dataset.dogId,d=>({...d,plans:{...d.plans,[form.dataset.id]:plan}})))){dirty=false;toast('Trigger plan saved.');}
      }else if(form.id==='session-form'){
        const old=training.sessions.find(s=>s.id===form.dataset.id),ids=old?[form.dataset.dogId]:C.selectedDogs(state).length>1?f.getAll('sessionDog'):[C.selectedDogs(state)[0].id];
        if(!ids.length)throw new Error('Choose at least one dog for this session.');
        let next=state,firstId='';
        for(const dogId of ids){
          const dog=C.dogState(next,dogId),session=C.normalizeSession({...Object.fromEntries(f),id:old?.id||'',createdAt:old?.createdAt||''});
          const sessions=old?dog.sessions.map(x=>x.id===old.id?session:x):[...dog.sessions,session];
          if(sessions.length>10000)throw new Error('This dog’s journal has reached 10,000 sessions. Export a backup before removing older entries.');
          next=C.updateDog(next,dogId,d=>({...d,sessions}));firstId=firstId||session.id;
        }
        if(commit(next)){dirty=false;navigate('entry',firstId);toast(ids.length>1?'Session saved separately for each checked dog.':'Session saved.');}
      }else if(form.id==='settings-form'){
        saveSettings(form);
      }
    }catch(error){failForm(form,error.message);}
  });
  document.addEventListener('keyup',event=>{
    if(markerKey?.key===event.key){event.preventDefault();markerKey=null;}
  });
  document.addEventListener('keydown',event=>{
    const marker=event.target.closest('[data-marker]');
    if(marker&&['Enter',' '].includes(event.key)&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
      event.preventDefault();
      if(!event.repeat&&!markerKey){markerKey={key:event.key,button:marker};playMarker(marker);}
      return;
    }
    if(event.key==='Escape'&&$('#modal-root').children.length){event.preventDefault();if(!settingsSaveBusy)closeModal();}
    if(event.key==='Tab'&&$('#modal-root').children.length){
      const focusable=[...$('#modal-root').querySelectorAll('button,a,input,select,textarea,[tabindex="0"]')].filter(x=>!x.disabled);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();}
      else if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();}
    }
  });
  // Swipes only change which lesson is being read; they never mark progress.
  // Horizontal step pills, controls, text selection and vertical reading are excluded.
  let swipeStart=null;
  document.addEventListener('touchstart',event=>{
    if(route!=='lesson'||event.touches.length!==1||event.target.closest('a,button,input,textarea,select,summary,.step-strip,.modal')){swipeStart=null;return;}
    const t=event.touches[0];swipeStart={x:t.clientX,y:t.clientY,time:Date.now()};
  },{passive:true});
  document.addEventListener('touchend',event=>{
    if(!swipeStart||event.changedTouches.length!==1)return;
    const start=swipeStart;swipeStart=null;
    if(route!=='lesson'||Date.now()-start.time>700||window.getSelection()?.toString())return;
    const end=event.changedTouches[0],dx=end.clientX-start.x,dy=end.clientY-start.y;
    if(Math.abs(dx)<90||Math.abs(dy)>40||Math.abs(dx)<Math.abs(dy)*2)return;
    let current;try{current=decodeURIComponent(location.hash.split('/')[2]||'');}catch{return;}const item=itemFor(current);
    if(!item)return;
    const next=item.skill.steps[item.skill.steps.indexOf(item.step)+(dx<0?1:-1)];
    if(next){stageNotes();navigate('lesson',next.id);}
  },{passive:true});
  window.addEventListener('hashchange',()=>{if(dirty){const destination=location.hash;history.replaceState(null,'',renderedHash);if(!settingsSaveBusy)requestLeave(destination);return;}if(!stageNotes()){returningBack=false;history.replaceState(null,'',renderedHash);return;}if(returningBack)returningBack=false;else if(renderedHash!==location.hash){routeTrail.push(renderedHash);if(routeTrail.length>100)routeTrail.shift();}const restoreY=pendingScroll;pendingScroll=0;closeModal();render();$('#main')?.focus({preventScroll:true});if(restoreY)requestAnimationFrame(()=>scrollTo(0,restoreY));});
  window.addEventListener('pagehide',()=>{stageNotes();flush();});
  let backgroundedAt=0,renderedDay=C.dateToday();
  // Refresh a visible practice list across midnight or a device date change.
  setInterval(()=>{
    if(document.hidden||dirty||$('#modal-root').children.length||C.dateToday()===renderedDay||!['today','practice','lesson'].includes(route))return;
    if(!stageNotes())return;renderedDay=C.dateToday();render({preserveScroll:true});
  },60000);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){backgroundedAt=Date.now();stageNotes();flush();}
    else if(!dirty&&!$('#modal-root').children.length){
      if(!stageNotes())return;
      const longBreak=backgroundedAt&&Date.now()-backgroundedAt>=30*60*1000;
      if(longBreak&&C.dogs(state).length>1)needsDogChoice=true;
      if(longBreak||['today','practice','lesson'].includes(route))render({preserveScroll:true});
      backgroundedAt=0;
    }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applySettings);
  function goBack() {
    if(!stageNotes())return true;
    if(route==='today')return false;
    const previous=routeTrail.pop();
    if(previous){returningBack=true;routePositions.set(location.hash,scrollY);pendingScroll=routePositions.get(previous)||0;location.hash=previous;}
    else navigate('today');
    return true;
  }
  window.GoodGround={
    handleBack(){
      if(settingsSaveBusy)return true;
      if($('#modal-root').children.length){closeModal();return true;}
      if(dirty){requestLeave('native-back');return true;}
      return goBack();
    },
    flush:()=>{stageNotes();flush();},
    nativeMessage(message){
      if(message.type==='saved'){acknowledged=Math.max(acknowledged,message.revision);if(settingsWaiter&&message.revision>=settingsWaiter.revision)settingsWaiter.resolve();if(acknowledged>=state.revision){saveStatus='Saved on this phone';showSave();}}
      else if(message.type==='saveError'){settingsWaiter?.reject();saveStatus='Could not save — export a backup';showSave();toast(message.message,true);}
      else if(message.type==='import')importText(message.json);
      else if(message.type==='error')toast(message.message,true);
    },
    // Read-only diagnostics support browser tests and optional simulator smoke checks.
    snapshot:()=>C.validateState(state),
    ready:true
  };
  render();
  if(window.GOOD_GROUND_BOOT?.smoke){
    setTimeout(async()=>{
      const result={loaded:!!document.querySelector('h1'),skills:D.skills.length,steps:I.steps.size,bridge:false,lesson:false,restored:false,errors:[]};
      try{
        const probe=C.setProgress(state,'NAME-1',C.STATUSES[3]);state=probe;flush();
        location.hash='#/lesson/NAME-2';await new Promise(r=>setTimeout(r,500));
        result.lesson=document.body.textContent.includes('Reward the head turn')&&document.body.textContent.includes('Ready to start');
        result.restored=C.parseBackup(JSON.stringify(C.makeBackup(state,D))).progress['NAME-1'].status===C.STATUSES[3];
        for(let attempt=0;attempt<40&&acknowledged<state.revision;attempt++)await new Promise(r=>setTimeout(r,100));result.bridge=acknowledged>=state.revision;
      }catch(error){result.errors.push(error.message);}
      send('smokeResult',{result});
    },650);
  }
})();
