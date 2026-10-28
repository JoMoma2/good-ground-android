const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),D=require('../app/web/data.json'),old=require('./fixtures/1.2.0-catalog.json'),I=C.index(D);
const step=id=>I.steps.get(id).step,done=(s,...ids)=>ids.reduce((a,id)=>C.setProgress(a,id,C.STATUSES[3]),s),ready=(s,id)=>C.availability(step(id),s);
test('every 1.2.0 step retains its instructions and record identity or remains active',()=>{
 const original=old.skills.flatMap(s=>s.steps);
 for(const st of original)assert.ok(I.steps.has(st.id)||I.archivedSteps.has(st.id),st.id);
 for(const skill of D.archivedSkills.filter(s=>!s.retirementReason))assert.deepEqual(skill,old.skills.find(s=>s.code===skill.code));
 assert.equal(I.archivedSteps.size,45);
});
test('training prop is a four-step assembly of independent opening, retrieval and optional closing skills',()=>{
 const p=C.projectPlan(D,C.freshState(),'DRINK');assert.equal(p.modules.flatMap(m=>m.steps).length,13);assert.equal(p.total,10);
 assert.equal(I.skills.get('OPEN').steps.length,3);assert.equal(I.skills.get('SHELF').steps.length,3);assert.equal(p.modules.find(m=>m.code==='CLOSE').optional,true);
 let s=done(C.freshState(),'FETCH-2','GIVE-2','OTARGET-2');assert.equal(ready(s,'SHELF-1'),'Ready to start');assert.equal(ready(s,'CLOSE-1'),'Ready to start');assert.equal(ready(s,'OPEN-4'),'Ready to start');
 s=done(s,'OPEN-4');assert.equal(ready(s,'OPEN-5'),'Build prerequisite');s=done(s,'PULL-3');assert.equal(ready(s,'OPEN-5'),'Ready to start');
 assert.ok(step('DRINK-6').deps.some(([id])=>id==='PULL-3'));
});
test('the first training prop assembly ending does not gate retrieval behind door pulling',()=>{
 let s=done(C.freshState(),'SHELF-4');assert.equal(ready(s,'DRINK-5'),'Ready to start');s=done(s,'DRINK-5');assert.equal(ready(s,'DRINK-6'),'Build prerequisite');
 s=done(s,'OPEN-6');assert.equal(ready(s,'DRINK-6'),'Build prerequisite');s=done(s,'PULL-3');assert.equal(ready(s,'DRINK-6'),'Ready to start');
 s=done(s,'DRINK-6');assert.equal(ready(s,'DRINK-7'),'Ready to start','Human closure needs no dog-closing grade');
});
test('separate loops and symbol pairings run in parallel but their combinations need both pieces',()=>{
 let s=done(C.freshState(),'MIDDLE-1','TOUCH-2');for(const id of ['WEAVE-1','WEAVE-2','CARDS-1','CARDS-2'])assert.equal(ready(s,id),'Ready to start',id);
 s=done(s,'WEAVE-2','CARDS-2');assert.equal(ready(s,'WEAVE-3'),'Build prerequisite');assert.equal(ready(s,'CARDS-3'),'Build prerequisite');
 s=done(s,'WEAVE-1','CARDS-1');assert.equal(ready(s,'WEAVE-3'),'Ready to start');assert.equal(ready(s,'CARDS-3'),'Ready to start');
});
test('equipment comfort stays a setup check while the taught participation signal remains a gate',()=>{
 let s=done(C.freshState(),'TURN-1','TEETH-1');assert.equal(ready(s,'TURN-2'),'Ready to start');assert.equal(ready(s,'TEETH-2'),'Build prerequisite');
 s=done(s,'HARNESS-3','CHIN-2');assert.equal(ready(s,'TURN-2'),'Ready to start');assert.equal(ready(s,'TEETH-2'),'Ready to start');assert.equal(ready(C.freshState(),'TEETH-1'),'Ready to start');
});
test('handover is independent of travel, while travel still needs carrying',()=>{
 let s=done(C.freshState(),'GIVE-2');for(const id of ['POUCH-1','MESSENGER-1'])assert.equal(ready(s,id),'Ready to start');
 s=done(s,'POUCH-1','MESSENGER-1');for(const id of ['POUCH-2','MESSENGER-2'])assert.equal(ready(s,id),'Build prerequisite');
 s=done(s,'CARRY-1');for(const id of ['POUCH-2','MESSENGER-2'])assert.equal(ready(s,id),'Ready to start');
});
test('the four advanced projects have independent components and distinct complete tasks',()=>{
 assert.deepEqual(D.skills.filter(s=>s.sheet==='Brainiacs').map(s=>s.code),['DRINK','SORTALL','COURIER','WALKREADY','RALLY','CIRCUIT','SCENTREPORT','ROUTINE']);assert.equal(D.skills.at(-1).sheet,'Brainiacs');
 for(const code of ['DRINK','SORTALL','COURIER','WALKREADY']){const p=C.projectPlan(D,C.freshState(),code);assert.ok(p.modules.length>=3);assert.equal(p.skill.steps.length,4);}
 assert.ok(step('COURIER-1').deps.some(([id])=>id==='PERSON-4'));
 assert.match(step('PERSON-4').teach,/farther|nearer/);assert.match(step('THIRDBIN-3').advance,/Six/);
 assert.match(step('WALKREADY-4').advance,/fitting.*doorway.*release/);
});
test('independent toy pairings, name pairings and kit skills do not require their siblings',()=>{
 let s=done(C.freshState(),'BOX-2','TAKE-2','GIVE-2');for(const id of ['SORT-A','SORT-B','THIRDBIN-1','PERSON-1','PERSON-2','EQUIP-1','HARNESS-1'])assert.equal(ready(s,id),'Ready to start',id);
 assert.equal(ready(s,'SORT-C'),'Build prerequisite');s=done(s,'SORT-A','SORT-B');assert.equal(ready(s,'SORT-C'),'Ready to start');
});
test('old grades credit only fully covered replacement groups, preserving original notes and timestamps',()=>{
 let s=C.freshState();const before={};for(const id of ['SORT-1','SORT-2']){s=done(s,id);s.progress[id].notes='original '+id;s.progress[id].completedAt='2026-09-01T12:00:00Z';before[id]=structuredClone(s.progress[id]);}
 const next=C.creditReplacements(D,s);assert.equal(next.progress['SORT-A'].status,C.STATUSES[3]);assert.equal(next.progress['SORT-A'].completedAt,'2026-09-01T12:00:00Z');assert.equal(next.progress['SORT-B'],undefined);
 for(const id of Object.keys(before))assert.deepEqual(next.progress[id],before[id]);assert.equal(s.progress['SORT-A'],undefined);assert.equal(C.creditReplacements(D,next),next);
});
test('pauses and explicit new progress survive migration without promotion',()=>{
 let s=C.setProgress(C.freshState(),'POST-4',C.STATUSES[4],'Pause this');s=C.creditReplacements(D,s);assert.equal(s.progress['POST-B'].status,C.STATUSES[4]);
 s=done(s,'SORT-1','SORT-2');s=C.setProgress(s,'SORT-A',C.STATUSES[0],'Start fresh');s=C.creditReplacements(D,s);assert.equal(s.progress['SORT-A'].status,C.STATUSES[0]);assert.equal(s.progress['SORT-A'].notes,'Start fresh');
});
test('migration remains per dog, preserves sessions/cues/favorites and cannot rewrite historical percentages',()=>{
 let s=C.freshState();s.profile.name='First';s=C.addDog(s,{name:'Second'});const other=C.dogs(s)[1].id;s=C.updateDog(s,other,d=>({...d,progress:{'POST-4':{status:C.STATUSES[4],notes:'keep',updatedAt:'2026-10-01'}}}));
 s.cues.POST='Deliver';s.favorites=['OPEN','POST'];s.progressHistory=[{date:'2026-10-01',curriculum:5,topics:{Brainiacs:[2,4]}}];
 const original=structuredClone(s.progressHistory);s=C.observeProgress(D,s,new Date('2026-10-22T12:00:00'));assert.equal(s.progress['POST-B'],undefined);assert.equal(C.dogs(s)[1].progress['POST-B'].status,C.STATUSES[4]);assert.deepEqual(s.progressHistory[0],original[0]);
 assert.deepEqual(s.favorites,['OPEN','POST']);assert.equal(s.cues.POST,'Deliver');assert.deepEqual(C.parseBackup(JSON.stringify(C.makeBackup(s,D))),C.validateState(s));
});
test('next-step navigation chooses a ready parallel gap and never skips to a blocked or paused step',()=>{
 const skill=I.skills.get('WEAVE');let s=done(C.freshState(),'MIDDLE-1','WEAVE-2');assert.equal(C.nextTeachingStep(skill,s,'WEAVE-2').id,'WEAVE-1');
 s=C.setProgress(s,'WEAVE-1',C.STATUSES[4]);assert.equal(C.nextTeachingStep(skill,s,'WEAVE-2'),null);
 s=done(s,'WEAVE-1');assert.equal(C.nextTeachingStep(skill,s,'WEAVE-2').id,'WEAVE-3');
});

test('toy naming and the first picture pairing can start independently, while discrimination waits for both labels',()=>{
 for(const id of ['TOYNAME-1','TWOOBJECT-1','CARDS-1'])assert.equal(ready(C.freshState(),id),'Ready to start');
 let s=done(C.freshState(),'TWOOBJECT-1');assert.equal(ready(s,'TWOOBJECT-2'),'Build prerequisite');s=done(s,'TOYNAME-2');assert.equal(ready(s,'TWOOBJECT-2'),'Ready to start');
});
test('hand carrier work stays separate from floor pickup, which requires the known retrieve',()=>{
 let s=done(C.freshState(),'GIVE-2','BOX-1','MESSENGER-3','POUCH-3');for(const id of ['SHELF-1','LAUNDRY-1'])assert.equal(ready(s,id),'Ready to start');assert.equal(ready(s,'POST-A'),'Build prerequisite');
 s=done(s,'SHELF-1','LAUNDRY-1');for(const id of ['SHELF-2','LAUNDRY-2'])assert.equal(ready(s,id),'Build prerequisite');s=done(s,'FETCH-2');for(const id of ['SHELF-2','LAUNDRY-2','POST-A'])assert.equal(ready(s,id),'Ready to start');
});

test('completion transfer does not assume a broader combined choice from early named-toy delivery alone',()=>{
 let s=done(C.freshState(),'NAMEDFIND-1','NAMEDFIND-2');s=C.creditReplacements(D,s);assert.equal(s.progress['NAMEDFIND-A'],undefined);
 s=done(s,'NAMEDFIND-6');s=C.creditReplacements(D,s);assert.equal(s.progress['NAMEDFIND-A'].status,C.STATUSES[3]);
});
