const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),D=require('../app/web/data.json'),B=require('./fixtures/1.6.0-catalog.json'),R=require('../research/curriculum-review-8.json'),I=C.index(D);
const step=id=>I.steps.get(id).step,done=(s,...ids)=>ids.reduce((a,id)=>C.setProgress(a,id,C.STATUSES[3]),s);
test('retired appliance records, notes and journal links survive without credit for new prop contexts',()=>{
 let s=C.freshState();for(const id of Object.keys(R.retiredSteps)){s=done(s,id);s.progress[id].notes='Original '+id;s.progress[id].completedAt='2026-10-20T12:00:00Z';}
 s.sessions=[C.normalizeSession({id:'appliance-record',date:'2026-10-20',stepId:'DRINK-4',observations:'Historical routine'})];
 const before=structuredClone(s);s=C.creditReplacements(D,s);
 assert.deepEqual(s.progress,before.progress);assert.deepEqual(s.sessions,before.sessions);
 for(const id of ['OPEN-4','OPEN-5','OPEN-6','CLOSE-4','SHELF-4','DRINK-5','DRINK-6','DRINK-7','DRINK-8'])assert.equal(s.progress[id],undefined,id);
 const restored=C.parseBackup(JSON.stringify(C.makeBackup(s,D)));assert.deepEqual(restored.progress,before.progress);assert.equal(restored.sessions[0].stepId,'DRINK-4');
 for(const [id,record] of Object.entries(R.retiredSteps)){assert.equal(record.automaticCredit,false);const old=B.skills.flatMap(s=>s.steps).find(t=>t.id===id);assert.deepEqual(I.archivedSteps.get(id).step,old);}
});
test('independent departure actions and sound-only conditioning are available without unrelated exposure grades',()=>{
 const s=C.freshState();for(const id of ['ALONE-3','OBJECT-3'])assert.equal(C.availability(step(id),s),'Ready to start',id);
 assert.equal(C.availability(step('ALONE-2'),s),'Build prerequisite');assert.equal(C.availability(step('OBJECT-2'),s),'Build prerequisite');
});
test('indoor crossing does not require real-curb exposure, while outdoor crossing still does',()=>{
 let s=done(C.freshState(),'CURB-1','LOOSE-2');assert.equal(C.availability(step('CROSS-1'),s),'Ready to start');
 s=done(s,'CROSS-1');assert.equal(C.availability(step('CROSS-2'),s),'Build prerequisite');s=done(s,'CURB-2');assert.equal(C.availability(step('CROSS-2'),s),'Ready to start');
});
test('fully separated visitor practice need not pass an optional view or stranger-approach gate',()=>{
 const s=done(C.freshState(),'VISITOR-2');assert.equal(C.availability(step('VISITOR-4'),s),'Ready to start');assert.equal(C.availability(step('VISITOR-3'),s),'Build prerequisite');
 assert.match(step('VISITOR-4').teach,/No view is required/);
});
test('learning the leave cue does not imply offered context transfer or absent-handler safety',()=>{
 let s=done(C.freshState(),'LEAVE-1','LEAVE-2');assert.equal(s.progress['LEAVE-3'],undefined);assert.equal(C.availability(step('LEAVE-3'),s),'Ready to start');assert.equal(C.availability(step('LEAVE-4'),s),'Build prerequisite');
 s=done(s,'LEAVE-3');assert.equal(C.availability(step('LEAVE-4'),s),'Ready to start');assert.match(step('LEAVE-4').teach,/do not add absence/);
});
test('verified new references and current evidence citations are real bundled source records',()=>{
 const sources=new Map(D.sources.map(s=>[s.id,s]));for(const id of ['V058','V086','V112','V109','V132','V133','V134','V138','V093'])assert.ok(sources.get(id)?.access,id);
 assert.ok(!I.skills.get('SOUND').sources.includes('P26'));assert.match(sources.get('P26').use,/Historical cross-check only/);
 assert.match(I.skills.get('SCENTMATCH').goal,/not general matching/);assert.match(step('CARDS-3').teach,/same position for both cards/);
});
