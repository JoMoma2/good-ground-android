const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../app/web/core.js');
const D=JSON.parse(fs.readFileSync(__dirname+'/../app/web/data.json','utf8'));
const I=C.index(D);
const st=id=>I.steps.get(id).step;
const session=extra=>C.normalizeSession({date:'2026-10-20',...extra});
test('all content has unique IDs, valid prerequisites and no prerequisite cycles',()=>{
  assert.ok(I.skills.size>=63);assert.ok(I.steps.size>=149);
});
test('name acquisition remains two steps; transfer is a separate skill',()=>{
  assert.equal(I.skills.get('NAME').steps.length,2);
  assert.equal(I.skills.get('NAMECTX').sheet,'Practice elsewhere');
});
test('strict prerequisite blocks until consistent',()=>{
  let s=C.freshState();assert.equal(C.availability(st('NAME-2'),s),'Build prerequisite');
  s=C.setProgress(s,'NAME-1',C.STATUSES[2]);assert.equal(C.availability(st('NAME-2'),s),'Build prerequisite');
  s=C.setProgress(s,'NAME-1',C.STATUSES[3]);assert.equal(C.availability(st('NAME-2'),s),'Ready to start');
});
test('parallel prerequisites permit nearly-consistent components, strict transfer waits',()=>{
  let s=C.setProgress(C.freshState(),'NAME-2',C.STATUSES[2]);
  assert.equal(C.availability(st('RECALL-1'),s),'Ready to start');
  assert.equal(C.availability(st('NAMECTX-1'),s),'Build prerequisite');
});
test('paused stages block dependencies and stay paused themselves',()=>{
  const s=C.setProgress(C.freshState(),'HOLD-1',C.STATUSES[4]);
  assert.equal(C.availability(st('HOLD-1'),s),'Paused');
  assert.equal(C.availability(st('GIVE-1'),s),'Build prerequisite');
});
test('progress updates preserve previous state and notes',()=>{
  const original=C.freshState(),next=C.setProgress(original,'NAME-1',C.STATUSES[1],'Quiet kitchen');
  assert.equal(original.progress['NAME-1'],undefined);assert.equal(next.revision,1);
  assert.equal(C.setProgress(next,'NAME-1',C.STATUSES[2]).progress['NAME-1'].notes,'Quiet kitchen');
});
test('starting counts have no fabricated progress or journal history',()=>{
  const s=C.freshState(),sum=C.summary(D,s);
  assert.equal(sum.counts.complete,0);assert.equal(sum.counts.skills,0);assert.equal(s.sessions.length,0);
  assert.equal(sum.counts.total,I.steps.size);assert.ok(sum.counts.ready>0);
});
test('complete counts agree across stages, skills, and topic totals',()=>{
  let s=C.freshState();for(const id of I.steps.keys())s=C.setProgress(s,id,C.STATUSES[3]);
  const {counts,topics}=C.summary(D,s);
  assert.equal(counts.complete,I.steps.size);assert.equal(counts.skills,I.skills.size);assert.equal(counts.ready,0);
  assert.equal(topics.reduce((n,t)=>n+t.complete,0),I.steps.size);
});
test('Today prioritizes practice, saved skills, and chosen trigger topics',()=>{
  let s=C.setProgress(C.freshState(),'NAME-1',C.STATUSES[1]);
  assert.equal(C.available(D,s)[0].step.id,'NAME-1');
  s=C.freshState();s.favorites=['SIT'];assert.equal(C.available(D,s)[0].skill.code,'SIT');
  s=C.freshState();s.profile.priorities=['Other dogs'];assert.equal(C.available(D,s)[0].skill.sheet,'Other dogs');
});
test('unknown observations remain null; recorded zero stays zero',()=>{
  const s=session({opportunities:'',successes:'',response:'',recovery:''});
  assert.equal(s.response,null);assert.equal(s.recovery,null);
  const zero=session({response:'0',recovery:'0',recoveryState:'Recovered'});
  assert.equal(zero.response,0);assert.equal(zero.recovery,0);
});
test('session validation rejects impossible dates and counts',()=>{
  for(const date of ['2026-02-30','2026-13-02','xx','2026-1-1'])assert.throws(()=>session({date}));
  for(const v of [{opportunities:2,successes:3},{successes:1},{opportunities:1.5},{response:5},{response:-1},{recovery:4,recoveryState:'Not yet recovered'}])assert.throws(()=>session(v));
  assert.equal(C.validDate('2024-02-29'),true);assert.equal(C.validDate('2025-02-29'),false);
});
test('distress guidance overrides a high success percentage',()=>{
  const s=session({opportunities:5,successes:5,response:3});assert.match(C.sessionGuidance(s),/Reduce the challenge/);
});
test('high percentages still require the lesson criterion',()=>{
  assert.match(C.sessionGuidance(session({opportunities:5,successes:4})),/actual advancement criterion/);
});
test('observations filter triggers and omit unknown or unrecovered recovery',()=>{
  const s=C.freshState();s.sessions=[session({trigger:'Other dogs',response:0,recovery:0,recoveryState:'Recovered'}),session({trigger:'Other dogs',response:2,recoveryState:'Not yet recovered'}),session({trigger:'Fireworks',response:4,recovery:30,recoveryState:'Recovered'})];
  const o=C.observations(s,'Other dogs');assert.equal(o.response.length,2);assert.equal(o.recovery.length,1);assert.equal(o.recovery[0].value,0);
});
test('a complete backup round trip preserves all personal records',()=>{
  let s=C.setProgress(C.freshState(),'NAME-1',C.STATUSES[3],'Easy room');
  s.profile.name='Buddy';s.favorites=['SIT'];s.plans.Knocking={setup:'faint tap',baseline:'soft',next:'one more tap',exit:'quiet room',notes:'helper'};
  s.sessions=[session({stepId:'NAME-1',opportunities:5,successes:4})];
  const restored=C.parseBackup(JSON.stringify(C.makeBackup(s,D)));assert.deepEqual(restored,C.validateState(s));
});
test('bad, future, duplicate-session, and oversized backups are rejected',()=>{
  for(const text of ['not json','{}',JSON.stringify({format:'good-ground-backup',version:99,state:C.freshState()}),' '.repeat(5*1024*1024+1)])assert.throws(()=>C.parseBackup(text));
  const s=C.freshState();s.sessions=[session({id:'same'}),session({id:'same'})];assert.throws(()=>C.validateState(s));
});
test('restore validation does not mutate the current records',()=>{
  const s=C.freshState(),before=JSON.stringify(s);assert.throws(()=>C.parseBackup('{bad}'));assert.equal(JSON.stringify(s),before);
});
test('HTML strings are escaped, including profile and observation content',()=>{
  assert.equal(C.esc('<img src=x onerror="x"> &'), '&lt;img src=x onerror=&quot;x&quot;&gt; &amp;');
});
test('unsafe progress keys and prototype pollution are rejected',()=>{
  const s=JSON.parse(JSON.stringify(C.freshState()));s.progress.__proto__={status:C.STATUSES[3]};assert.throws(()=>C.validateState(s));
  const text=JSON.stringify({format:'good-ground-backup',version:1,state:C.freshState()}).replace('"progress":{}','"progress":{"__proto__":{"status":"Consistent - move on","notes":"","updatedAt":""}}');
  assert.throws(()=>C.parseBackup(text));assert.equal({}.polluted,undefined);
});
test('an exact chosen trigger ranks its own program before other programs in the topic',()=>{
  const s=C.freshState();s.profile.priorities=['Knocking'];assert.equal(C.available(D,s)[0].skill.code,'KNOCK');
});
test('storage allowance leaves room for a compact restorable backup',()=>{
  const s=C.freshState();assert.equal(C.withinStorageLimit(s),true);
  const large={...s,extra:'x'.repeat(C.STORAGE_BYTES+1)};assert.equal(C.withinStorageLimit(large),false);
  const near=C.setProgress(s,'NAME-1',C.STATUSES[1],'n'.repeat(30000));assert.deepEqual(C.parseBackup(JSON.stringify(C.makeBackup(near,D))),C.validateState(near));
});
