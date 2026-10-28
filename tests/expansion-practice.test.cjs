const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),H=require('../app/web/history.js'),D=require('../app/web/data.json'),old=require('./fixtures/1.3.0-catalog.json'),review=require('../research/prerequisite-review.json'),I=C.index(D);
const at=d=>new Date(d+'T12:00:00'),done=(s,...ids)=>ids.reduce((a,id)=>C.setProgress(a,id,C.STATUSES[3]),s),full=(s,code)=>done(s,...I.skills.get(code).steps.map(st=>st.id));
const newSkills=D.skills.filter(s=>!old.skills.some(o=>o.code===s.code));
test('50 distinct skill additions remain while reviewed retirements preserve existing identities',()=>{
 assert.equal(old.skills.length,104);assert.equal(newSkills.length,50);assert.equal(D.skills.length,154);assert.equal(I.steps.size,386);
 assert.equal(new Set(D.skills.map(s=>s.title.toLocaleLowerCase())).size,D.skills.length);
 for(const skill of old.skills){const current=I.skills.get(skill.code);for(const st of skill.steps)assert.ok(I.steps.has(st.id)||I.archivedSteps.has(st.id),st.id);assert.equal(current.sheet,skill.sheet);}
 for(const s of newSkills){assert.ok(s.goal&&s.setup&&s.cue&&s.sources);assert.ok(s.steps.length>=2);for(const st of s.steps){assert.ok(st.teach.split(/\s+/).length>=25);assert.ok(st.advance.length>25&&st.easier.length>20);}}
});
test('every active prerequisite has an editorial decision and every branch can be reached',()=>{
 let state=C.freshState(),remaining=new Set(I.steps.keys());assert.equal(review.curriculum,D.version);
 while(remaining.size){let n=0;for(const id of remaining){const {skill,step}=I.steps.get(id);assert.deepEqual(review.skills[skill.code].steps[id].deps,step.deps);if(C.availability(step,state)==='Ready to start'){state=done(state,id);remaining.delete(id);n++;}}assert.ok(n,'No circular or unreachable branch');}
 assert.equal(C.summary(D,state).counts.complete,386);
});
test('floor leave is independent of harness and all unnecessary recorded equipment gates are removed',()=>{
 for(const id of ['LEAVE-2','TURN-2','LOOSE-1','RECALLCTX-1'])assert.ok(!I.steps.get(id).step.deps.some(([key])=>key.startsWith('HARNESS-')));
 assert.equal(C.availability(I.steps.get('LEAVE-2').step,done(C.freshState(),'LEAVE-1')),'Ready to start');
 assert.match(I.steps.get('LEAVE-2').step.teach,/barrier|cover/);
 for(const id of ['RECALL-1','RESTHEAD-1','SETTLE-1','BOXFIND-1','STORM-1','HOOP-1','NAIL-2','HEEL-1'])assert.equal(C.availability(I.steps.get(id).step,C.freshState()),'Ready to start',id);
});
test('the mat rest and slipper retrieve components are required at the steps that use them',()=>{
 let s=done(C.freshState(),'MAT-2','GIVE-2');assert.equal(C.availability(I.steps.get('MATCTX-1').step,s),'Ready to start');assert.equal(C.availability(I.steps.get('SLIPPERS-1').step,s),'Ready to start');
 s=done(s,'MATCTX-1','SLIPPERS-1');for(const id of ['MATCTX-2','SLIPPERS-2'])assert.equal(C.availability(I.steps.get(id).step,s),'Build prerequisite');
 s=done(s,'SETTLE-2','FETCH-2');for(const id of ['MATCTX-2','SLIPPERS-2'])assert.equal(C.availability(I.steps.get(id).step,s),'Ready to start');
});
test('independent components remain parallel and combining needs all actual components',()=>{
 const cases=[['LEFTRIGHT-1','LEFTRIGHT-2','LEFTRIGHT-3',['MAT-2']],['LIGHTPAD-1','LIGHTPAD-2','LIGHTPAD-3',['BUTTON-3']]];
 for(const [a,b,joined,deps] of cases){let s=done(C.freshState(),...deps);for(const id of [a,b])assert.equal(C.availability(I.steps.get(id).step,s),'Ready to start');s=done(s,b);assert.equal(C.availability(I.steps.get(joined).step,s),'Build prerequisite');s=done(s,a);assert.equal(C.availability(I.steps.get(joined).step,s),'Ready to start');}
 assert.equal(C.availability(I.steps.get('PULL-1').step,done(C.freshState(),'TAKE-2','DROP-2')),'Ready to start');
});
test('Heel has entry, verbal cue transfer, brief movement and a distinct release rather than loose-leash grades',()=>{
 const heel=I.skills.get('HEEL');assert.equal(heel.steps.length,4);assert.equal(heel.sheet,'Walk skills');assert.equal(heel.maintenance,true);
 assert.ok(heel.steps.every(st=>st.deps.every(([id])=>!id.startsWith('LOOSE-'))));
 let s=done(C.freshState(),'HEEL-1','HEEL-2','HEEL-3');assert.equal(C.availability(heel.steps[3],s),'Build prerequisite');s=done(s,'FREE-2');assert.equal(C.availability(heel.steps[3],s),'Ready to start');
});
test('existing completed and paused records, notes, cues, favorites and journal links are preserved',()=>{
 let s=C.freshState();s.profile.name='First';s=C.addDog(s,{name:'Second'});const other=C.dogs(s)[1].id;
 for(const skill of old.skills)for(const st of skill.steps)s=C.setProgress(s,st.id,C.STATUSES[3],'Original '+st.id);
 s=C.setProgress(s,'NAIL-1',C.STATUSES[4],'Keep paused');s.cues.LEAVE='Ignore';s.favorites=['PULL','LEAVE'];s.sessions=[C.normalizeSession({date:'2026-10-01',stepId:'POST-4',observations:'Earlier link'})];
 s=C.updateDog(s,other,d=>({...d,progress:{'TURN-2':{status:C.STATUSES[3],notes:'Different dog',updatedAt:'2026-09-01'}}}));
 const before=structuredClone(C.dogs(s)),next=C.observeProgress(D,s,at('2026-10-24'));
 for(const dog of before){const current=C.dogs(next).find(d=>d.id===dog.id);assert.deepEqual(current.progress,dog.progress);assert.deepEqual(current.sessions,dog.sessions);assert.deepEqual(current.cues,dog.cues);}
 assert.deepEqual(next.favorites,s.favorites);assert.deepEqual(C.parseBackup(JSON.stringify(C.makeBackup(next,D))),C.validateState(next));
});
test('catalog expansion changes denominators without inventing completion or rewriting prior dates',()=>{
 let s=full(C.freshState(),'NAME');s=C.observeProgress(old,s,at('2026-10-23'));const prior=structuredClone(s.progressHistory[0]);s=C.observeProgress(D,s,at('2026-10-24'));
 assert.deepEqual(s.progressHistory[0],prior);assert.equal(Object.values(s.progressHistory[1].topics).reduce((n,x)=>n+x[1],0),154);
 assert.equal(Object.values(s.progressHistory[1].topics).reduce((n,x)=>n+x[0],0),1);assert.equal(C.summary(D,s).counts.total,386);
 const changes=H.catalogChanges(s.progressHistory);assert.equal(changes.length,2);assert.ok(changes[1].changes.some(c=>c.name==='Walk skills'&&c.after-c.before===6));
});
test('daily queue includes only fully learned maintained skills for selected dogs, including Heel',()=>{
 let s=full(full(full(C.freshState(),'SIT'),'HEEL'),'DOG');s=done(s,'NAME-1');s=full(s,'TURN');s=C.setProgress(s,'TURN-2',C.STATUSES[4]);
 assert.deepEqual(C.dailyPractice(D,s,at('2026-10-24')).pending.map(x=>x.skill.code).sort(),['HEEL','SIT']);
 s.profile.name='First';s=C.addDog(s,{name:'Second'});const other=C.dogs(s)[1].id;s=C.updateDog(s,other,d=>full(d,'NAME'));s=C.selectDogs(s,[other]);
 assert.deepEqual(C.dailyPractice(D,s,at('2026-10-24')).pending.map(x=>[x.dogId,x.skill.code]),[[other,'NAME']]);
});
test('daily quick logs are idempotent per dog, update recency and never alter completion/history',()=>{
 let s=full(full(C.freshState(),'SIT'),'HEEL');s=C.observeProgress(D,s,at('2026-10-23'));const progress=structuredClone(s.progress),history=structuredClone(s.progressHistory),id=s.household.primaryId;
 const result=C.logPracticeToday(D,s,[id],'HEEL-4',at('2026-10-24'));assert.equal(result.added,1);s=result.state;
 assert.equal(s.sessions[0].date,'2026-10-24');assert.equal(s.sessions[0].stepId,'HEEL-4');assert.equal(s.sessions[0].opportunities,null);
 assert.deepEqual(s.progress,progress);assert.deepEqual(s.progressHistory,history);assert.equal(C.dailyPractice(D,s,at('2026-10-24')).pending.length,1);
 assert.equal(C.logPracticeToday(D,s,[id],'HEEL-1',at('2026-10-24')).state,s);assert.equal(C.logPracticeToday(D,s,[id],'HEEL-4',at('2026-10-25')).added,1);
});
test('regular linked logs count; trigger, note-only, unlinked and future records do not count as today practice',()=>{
 let s=full(C.freshState(),'SIT');s.sessions=[C.normalizeSession({date:'2026-10-25',stepId:'SIT-2'}),C.normalizeSession({date:'2026-10-24',stepId:'SIT-1',type:'Trigger event'}),C.normalizeSession({date:'2026-10-24',type:'Skill practice'})];
 assert.equal(C.dailyPractice(D,s,at('2026-10-24')).pending.length,1);
 s.sessions.push(C.normalizeSession({date:'2026-10-24',stepId:'SIT-1',observations:'Detailed practice'}));assert.equal(C.dailyPractice(D,s,at('2026-10-24')).pending.length,0);
 assert.equal(C.logPracticeToday(D,s,[s.household.primaryId],'SIT-2',at('2026-10-24')).added,0);
 s.sessions.pop();assert.equal(C.dailyPractice(D,s,at('2026-10-24')).pending.length,1);
});
test('multi-dog practice logs only the named dog and backs up through the existing journal format',()=>{
 let s=full(C.freshState(),'SIT');s.profile.name='One';s=C.addDog(s,{name:'Two'});const other=C.dogs(s)[1].id;s=C.updateDog(s,other,d=>full(d,'SIT'));s=C.selectDogs(s,C.dogs(s).map(d=>d.id));
 s=C.logPracticeToday(D,s,[other],'SIT-2',at('2026-10-24')).state;assert.equal(s.sessions.length,0);assert.equal(C.dogs(s)[1].sessions.length,1);
 assert.equal(C.dailyPractice(D,s,at('2026-10-24')).pending[0].dogId,s.household.primaryId);
 assert.deepEqual(C.parseBackup(JSON.stringify(C.makeBackup(s,D))),C.validateState(s));
});
test('failed journal-capacity or ownership checks cannot partially modify a household',()=>{
 let s=full(C.freshState(),'SIT');s.profile.name='One';s=C.addDog(s,{name:'Two'});const ids=C.dogs(s).map(d=>d.id);
 s=C.updateDog(s,ids[1],d=>({...d,sessions:Array.from({length:10000},(_,i)=>C.normalizeSession({id:'log-'+i,date:'2026-10-01'}))}));
 assert.throws(()=>C.logPracticeToday(D,s,ids,'SIT-2',at('2026-10-24')),/full/);assert.equal(s.sessions.length,0);
 assert.throws(()=>C.logPracticeToday(D,s,['missing'],'SIT-2',at('2026-10-24')));assert.throws(()=>C.logPracticeToday(D,s,ids,'missing',at('2026-10-24')));
});
test('calendar days survive DST changes and learned timestamps never substitute for practice',()=>{
 assert.equal(C.daysBetween('2026-03-08','2026-03-09'),1);assert.equal(C.daysBetween('2026-11-01','2026-11-02'),1);
 let s=full(C.freshState(),'SIT');for(const p of Object.values(s.progress))p.completedAt=at('2026-10-24').toISOString();
 assert.equal(C.dailyPractice(D,s,at('2026-10-24')).pending.length,1);
 s=C.logPracticeToday(D,s,[s.household.primaryId],'SIT-2',at('2026-11-01')).state;assert.equal(C.dailyPractice(D,s,at('2026-11-02')).pending.length,1);
});

test('floor pickup and stationary dog passing stay independent of travel and moving-dog work',()=>{
 let s=done(C.freshState(),'GIVE-2','DOG-2','TURN-2');
 for(const id of ['FETCH-1','PASS-1'])assert.equal(C.availability(I.steps.get(id).step,s),'Ready to start');
 s=done(s,'FETCH-1','PASS-1');for(const id of ['FETCH-2','PASS-2'])assert.equal(C.availability(I.steps.get(id).step,s),'Build prerequisite');
 s=done(s,'CARRY-2','DOG-3');for(const id of ['FETCH-2','PASS-2'])assert.equal(C.availability(I.steps.get(id).step,s),'Ready to start');
});
