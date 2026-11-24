(function(root){
  'use strict';
  function create({C,S,getState,commit,render,navigate,toast,openModal,closeModal,link,backBar,formError,data,onDisconnect=()=>{}}){
    const E=C.esc;
    const state=()=>getState();
    const record=(dog,kind,key)=>S.records(state(),dog,kind).find(r=>r.key===key);
    const dogName=id=>C.dogState(state(),id).profile.name||'Your dog';
    const context=(dog,kind,key)=>S.heads(state(),dog,kind,key).map(o=>o.id);
    const attr=(dog,kind,key,extra='')=>`data-dog="${E(dog)}" data-kind="${kind}" data-key="${E(key||'')}" ${extra}`;
    function author(dog,id){return E(S.author(state(),dog,id));}
    function date(value){const d=new Date(value);return Number.isFinite(+d)?E(d.toLocaleDateString()):'Not received yet';}
    function noteCount(skill){return C.selectedDogs(state()).reduce((n,d)=>n+S.records(state(),d.id,'note').filter(r=>!r.deleted&&(r.value?.skill===skill||r.versions.some(v=>v.value?.skill===skill))).length,0);}
    function trainerView(){
      const t=state().trainer;
      return `${backBar('more','','More')}<div class="page-title"><span class="eyebrow">YOUR PHONE, YOUR TRAINING</span><h1>Your trainer profile.</h1><p>This phone records your progress. Other trainers keep their own progress on their phones.</p></div><form id="trainer-form" class="form-card">${formError()}<label class="field"><span>Your trainer name</span><input name="name" value="${E(t.name)}" maxlength="80" autocomplete="given-name" placeholder="Your name" required></label><p class="fineprint">A name is optional for training alone. Your identity stays the same when you edit your name; there is no trainer switch.</p><button class="button" type="submit">Save trainer name</button></form><section class="reading-card"><h2>Sharing status</h2><p>${window.GOOD_GROUND_BOOT?.platform==='android'||window.GroundAndroid?'This Android build keeps household rules and authored notes locally. Nearby wireless is not implemented here.':'Experimental nearby sharing is available in a fresh native iPhone build. It still needs testing on your two LiveContainer installations.'}</p><p>Only a dog you explicitly choose will be shared. Private step notes, journal entries, cues and device preferences stay on this phone.</p></section>`;
    }
    function conflictCard(dog,kind,r){
      const label=kind==='profile'?'Profile: '+r.key:kind==='note'?'Training note':'Household rule';
      const canResolve=kind!=='note'||r.owner===state().trainer.id;
      return `<article class="reading-card shared-conflict"><h3>${E(label)} · review differences</h3><p class="fineprint">Both edits are preserved. Choose a version or write a combined revision.</p>${r.versions.map(v=>`<div class="shared-version"><strong>${author(dog,v.actor)}</strong><p>${v.deleted?'Removed this record':kind==='profile'?E(v.value):kind==='rule'?`<strong>${E(v.value.title)}</strong><br>${E(v.value.description)}`:E(v.value.text)}</p>${canResolve?`<button class="button secondary" data-action="share-resolve" ${attr(dog,kind,r.key,`data-operation="${E(v.id)}"`)}>${v.deleted?'Resolve by removing':'Keep this version'}</button>`:''}</div>`).join('')}${canResolve?`<button class="text-button" data-action="share-edit" ${attr(dog,kind,r.key)}>Write a combined revision</button>`:''}</article>`;
    }
    const chooseDog=id=>(C.dogs(state()).find(d=>d.id===id)||C.selectedDogs(state())[0]).id;
    function dogPicker(dog,destination){return C.dogs(state()).length<2?'':`<label class="field"><span>Household rules for</span><select data-rules-dog data-destination="${destination}">${C.dogs(state()).map(d=>`<option value="${E(d.id)}" ${d.id===dog?'selected':''}>${E(d.profile.name)}</option>`).join('')}</select></label>`;}
    function journalRules(id){
      const dog=chooseDog(id),rules=S.records(state(),dog,'rule'),active=rules.filter(r=>!r.deleted&&!r.conflict),conflicts=rules.filter(r=>r.conflict).length;
      return `<section class="reading-card journal-rules" aria-labelledby="journal-rules-title"><div class="section-heading"><h2 id="journal-rules-title">Household rules</h2>${link('household',dog,'Manage rules','text-link')}</div>${dogPicker(dog,'journal')}<p class="fineprint">For ${E(dogName(dog))} · shared routines and expectations.</p>${active.length?`<ul class="journal-rule-list">${active.slice(0,3).map(r=>`<li><strong>${E(r.value.title)}</strong>${r.value.description?`<p>${E(r.value.description.length>180?r.value.description.slice(0,177)+'…':r.value.description)}</p>`:''}</li>`).join('')}</ul>`:'<p class="quiet">No household rules for this dog yet.</p>'}${conflicts?`<p>${link('household',dog,conflicts+' rule '+(conflicts===1?'difference needs':'differences need')+' review','text-link')}</p>`:''}${active.length>3?link('household',dog,'View all '+active.length+' rules','text-link'):''}</section>`;
    }
    function trainersView(dog){
      dog=chooseDog(dog);const peers=S.people(state(),dog).filter(p=>!p.local);
      return `<section class="reading-card"><h2>Trainers</h2><p><strong>${E(state().trainer.name||'You')}</strong> · this phone</p>${peers.map(p=>`<div class="shared-trainer"><p><strong>${E(p.name||'Other trainer')}</strong> · ${p.approved?'Approved connection':'Disconnected'}</p><p class="fineprint">${p.lastReceivedAt?'Last received: '+date(p.lastReceivedAt):'No exchange received.'}${p.lastSuccessfulSyncAt?' · Last confirmed sync: '+date(p.lastSuccessfulSyncAt):''}</p>${link('trainer-progress',dog+'~'+p.id,'View '+E(p.name||'trainer')+'’s progress','text-link')}${p.approved?`<button class="text-button" data-action="share-disconnect" data-dog="${E(dog)}" data-peer="${E(p.id)}">Disconnect trainer</button>`:''}</div>`).join('')}</section>`;
    }
    function householdView(dog){
      dog=chooseDog(dog);
      const rules=S.records(state(),dog,'rule'),active=rules.filter(r=>!r.deleted&&!r.conflict),conflicts=[...rules.filter(r=>r.conflict).map(r=>({kind:'rule',record:r})),...S.profileConflicts(state(),dog).map(r=>({kind:'profile',record:r}))];
      return `${backBar('journal','','Journal')}<div class="page-title"><span class="eyebrow">FOR ${E(dogName(dog))}</span><h1>Household rules.</h1><p>Write the routines and expectations that help everyone care for this dog consistently.</p></div>${dogPicker(dog,'household')}<button class="button" data-action="share-add-rule" data-dog="${E(dog)}">Add household rule</button><div class="stack shared-rules">${active.length?active.map(r=>`<article class="reading-card"><h2>${E(r.value.title)}</h2><p class="shared-text">${E(r.value.description)}</p><p class="fineprint">Latest revision: ${author(dog,r.heads.at(-1).actor)}</p><div class="button-row"><button class="text-button" data-action="share-edit" ${attr(dog,'rule',r.key)}>Edit rule</button><button class="text-button" data-action="share-remove" ${attr(dog,'rule',r.key)}>Remove rule</button></div></article>`).join(''):'<p class="quiet">No household rules yet. Add only the routines that are useful to you and your dog.</p>'}</div>${conflicts.length?`<section aria-label="Shared differences"><h2>Needs review</h2><div class="stack">${conflicts.map(x=>conflictCard(dog,x.kind,x.record)).join('')}</div></section>`:''}`;
    }
    function peerView(value){
      const [dog,id]=value.split('~');if(!C.dogs(state()).some(d=>d.id===dog))return '<p>Choose an existing dog.</p>';const peer=S.people(state(),dog).find(p=>p.id===id&&!p.local);
      if(!peer)return '<p>Choose a trainer connected to this dog.</p>';
      const remote=S.peerProgress(state(),dog,id),local=C.dogState(state(),dog);
      return `${backBar('nearby',dog,'Syncing')}<div class="page-title"><span class="eyebrow">FOR ${E(dogName(dog))}</span><h1>${E(peer.name||'Trainer')}’s progress.</h1><p>These are their recorded responses with this dog. Your progress and prerequisites stay your own.</p><p class="fineprint">Read only · ${peer.lastReceivedAt?'Last received '+date(peer.lastReceivedAt):'No exchange received yet.'}</p></div><div class="stack">${data.skills.filter(skill=>skill.steps.some(st=>remote[st.id])).map(skill=>`<details class="reading-card"><summary>${E(skill.title)}</summary><ul class="shared-step-list">${skill.steps.map(st=>`<li><strong>${E(st.title)}</strong><small>Your progress: ${E(C.stageLabel(C.status(local,st.id)))}</small><small>${E(peer.name||'Trainer')}: ${E(C.stageLabel(remote[st.id]?.status||C.STATUSES[0]))}</small></li>`).join('')}</ul></details>`).join('')||'<p class="quiet">No step progress received from this trainer yet.</p>'}</div>`;
    }
    function lessonExtras(skill,step){
      return C.selectedDogs(state()).map(d=>{
        const notes=S.records(state(),d.id,'note').filter(n=>!n.deleted&&(n.value?.skill===skill.code||n.versions.some(v=>v.value?.skill===skill.code))),peers=S.people(state(),d.id).filter(p=>!p.local);
        return `<section class="training-notes" aria-label="Training notes for ${E(d.profile.name||'this dog')}"><h3>${C.selectedDogs(state()).length>1?E(d.profile.name)+' · ':''}Training notes</h3><p class="fineprint">Authored notes for this skill. Your private step notes above stay on this phone.</p>${notes.map(n=>n.conflict?conflictCard(d.id,'note',n):`<article class="shared-note"><p><strong>${author(d.id,n.owner)}</strong>${n.value.step?` · ${E(n.value.step)}`:''}</p><p class="shared-text">${E(n.value.text)}</p>${n.owner===state().trainer.id?`<div class="button-row"><button class="text-button" data-action="share-edit" ${attr(d.id,'note',n.key)}>Edit your note</button><button class="text-button" data-action="share-remove" ${attr(d.id,'note',n.key)}>Remove your note</button></div>`:'<small>Only its author can edit this note.</small>'}</article>`).join('')||'<p class="quiet">No training notes for this skill yet.</p>'}<button class="text-button" data-action="share-add-note" data-dog="${E(d.id)}" data-skill="${E(skill.code)}" data-step="${E(step.id)}">Add training note</button>${peers.length?`<div class="trainer-comparison"><h3>Trainer progress</h3><p>Your progress: <strong>${E(C.stageLabel(C.status(d,step.id)))}</strong></p>${peers.map(p=>`<p>${E(p.name||'Trainer')}: <strong>${E(C.stageLabel(S.peerProgress(state(),d.id,p.id)[step.id]?.status||C.STATUSES[0]))}</strong> · ${link('trainer-progress',d.id+'~'+p.id,'View steps','text-link')}</p>`).join('')}<p class="fineprint">Other trainers’ records are read only and do not advance your steps.</p></div>`:''}</section>`;
      }).join('');
    }
    function editor(dog,kind,key,skill='',step=''){
      const r=key?record(dog,kind,key):null,value=r?.value||r?.versions.find(v=>!v.deleted)?.value;
      if(kind==='note'&&r?.owner!==undefined&&r.owner!==state().trainer.id){toast('Only the author can edit this note.',true);return;}
      const fields=kind==='rule'?`<label class="field"><span>Rule title</span><input name="title" maxlength="120" value="${E(value?.title||'')}" required></label><label class="field"><span>Description</span><textarea name="description" maxlength="4000" rows="4">${E(value?.description||'')}</textarea></label>`:kind==='profile'?`<p>Resolve the shared ${E(key)} field.</p><label class="field"><span>Combined value</span><textarea name="value" maxlength="30000" rows="4">${E(value??C.dogState(state(),dog).profile[key])}</textarea></label>`:`<label class="field"><span>Training note</span><textarea name="text" maxlength="4000" rows="4" required>${E(value?.text||'')}</textarea></label><label class="check-chip"><input type="checkbox" name="stepOnly" ${value?.step?'checked':''}><span>Reference this teaching step${step?' · '+E(step):''}</span></label><input type="hidden" name="skill" value="${E(value?.skill||skill)}"><input type="hidden" name="step" value="${E(value?.step||step)}">`;
      openModal(kind==='note'?'Training note':kind==='profile'?'Resolve profile difference':'Household rule',`<form id="shared-record-form" ${attr(dog,kind,key)} data-parents="${E(JSON.stringify(key?context(dog,kind,key):[]))}">${formError()}${fields}<div class="button-row"><button class="button" type="submit">Save ${kind==='note'?'note':kind==='profile'?'profile value':'rule'}</button><button class="button secondary" type="button" data-action="close-modal">Cancel</button></div></form>`);
    }
    function action(el){
      const a=el.dataset.action,dog=el.dataset.dog,kind=el.dataset.kind,key=el.dataset.key;
      if(!a?.startsWith('share-'))return false;
      try{
        if(a==='share-add-rule')editor(dog,'rule','');
        else if(a==='share-add-note')editor(dog,'note','',el.dataset.skill,el.dataset.step);
        else if(a==='share-edit')editor(dog,kind,key);
        else if(a==='share-remove'){
          const r=record(dog,kind,key);if(kind==='note'&&r.owner!==state().trainer.id)throw new Error('Only the author can remove this note.');
          openModal('Remove this '+kind+'?',`<p>This removal will be retained so an older exchange cannot bring the record back. Concurrent edits will remain available for review.</p><button class="button" data-action="share-remove-confirm" ${attr(dog,kind,key,`data-parents="${E(JSON.stringify(context(dog,kind,key)))}"`)}>Remove ${kind}</button>`);
        }else if(a==='share-remove-confirm'){
          if(commit(S.write(state(),dog,kind,key,null,{deleted:true,parents:JSON.parse(el.dataset.parents)}))){closeModal();render({preserveScroll:true});toast('Removed.');}
        }else if(a==='share-resolve'){
          const r=record(dog,kind,key),op=r.versions.find(v=>v.id===el.dataset.operation);
          if(!op)throw new Error('That revision is no longer available. Review the current differences.');
          if(commit(S.write(state(),dog,kind,key,op.value,{deleted:op.deleted,parents:context(dog,kind,key)}))){render({preserveScroll:true});toast('Difference resolved.');}
        }else if(a==='share-disconnect'){
          openModal('Disconnect this trainer?',`<p>Previously received records stay available to read. Further exchanges will require approval again.</p><button class="button" data-action="share-disconnect-confirm" data-dog="${E(dog)}" data-peer="${E(el.dataset.peer)}">Disconnect trainer</button>`);
        }else if(a==='share-disconnect-confirm'){
          if(commit(S.disconnect(state(),dog,el.dataset.peer))){onDisconnect(dog,el.dataset.peer);closeModal();render({preserveScroll:true});toast('Trainer disconnected.');}
        }
      }catch(error){toast(error.message,true);}
      return true;
    }
    function submit(form){
      if(form.id!=='trainer-form'&&form.id!=='shared-record-form')return false;
      try{
        const f=new FormData(form);
        if(form.id==='trainer-form'){
          if(commit(S.setTrainerName(state(),String(f.get('name')||'')))){render();toast('Trainer name saved.');}
        }else{
          const {dog,kind,key}=form.dataset;
          const value=kind==='rule'?{title:String(f.get('title')||'').trim(),description:String(f.get('description')||'').trim()}:kind==='profile'?String(f.get('value')||''):{skill:String(f.get('skill')||''),step:f.has('stepOnly')?String(f.get('step')||''):'',text:String(f.get('text')||'').trim()};
          if(commit(S.write(state(),dog,kind,key,value,{parents:JSON.parse(form.dataset.parents)}))){closeModal();render({preserveScroll:true});toast('Saved.');}
        }
      }catch(error){const box=form.querySelector('.form-error');if(box){box.hidden=false;box.textContent=error.message;}else toast(error.message,true);}
      return true;
    }
    return {trainerView,householdView,peerView,journalRules,trainersView,lessonExtras,noteCount,action,submit};
  }
  root.GroundCollaborationUI={create};
})(typeof globalThis!=='undefined'?globalThis:this);
