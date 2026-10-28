const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/web/core.js'),M=require('../app/web/marker.js'),D=require('../app/web/data.json');

test('original sound waveforms are finite, bounded, and fade to silence',()=>{
  for(const sound of M.sounds){
    for(const rate of [22050,44100,48000]){
      const pcm=M.samples(sound.id,rate);
      assert.ok(pcm.length>500);assert.ok(pcm.every(Number.isFinite));
      assert.ok(pcm.some(x=>Math.abs(x)>.1));assert.ok(pcm.every(x=>Math.abs(x)<1));
      assert.equal(pcm[0],0);assert.ok(Math.abs(pcm.at(-1))<.003);
    }
  }
  assert.throws(()=>M.samples('untrusted-sound'));
});
test('marker preferences survive backup and old backups get gentle defaults',()=>{
  const s=C.freshState();s.settings.markerSound='ding';s.settings.markerVolume=15;s.settings.lessonMarker=true;
  assert.deepEqual(C.parseBackup(JSON.stringify(C.makeBackup(s,D))).settings,s.settings);
  delete s.settings.markerSound;delete s.settings.markerVolume;delete s.settings.lessonMarker;
  const legacy=C.validateState(s);assert.equal(legacy.settings.markerVolume,25);assert.equal(legacy.settings.lessonMarker,true);
});
test('completion ideas are distinct, available practical skills and one fun choice',()=>{
  let s=C.freshState();for(const st of D.skills.find(s=>s.code==='NAME').steps)s=C.setProgress(s,st.id,C.STATUSES[3]);
  const choices=C.nextChoices(D,s,'NAME');assert.equal(choices.practical.length,3);
  assert.equal(new Set(choices.practical.map(x=>x.skill.code)).size,3);
  for(const x of choices.practical){assert.notEqual(x.skill.code,'NAME');assert.ok(['Ready to start','Continue'].includes(C.availability(x.step,s)));assert.ok(!['Optional trick','Enrichment','Optional advanced'].includes(x.skill.priority));}
  assert.ok(['Optional trick','Enrichment'].includes(choices.fun.skill.priority));
});
test('editing notes does not reset the consistency timestamp',()=>{
  let s=C.setProgress(C.freshState(),'NAME-1',C.STATUSES[3]);const first=s.progress['NAME-1'].completedAt;
  s=C.setProgress(s,'NAME-1',C.STATUSES[3],'An ordinary note');assert.equal(s.progress['NAME-1'].completedAt,first);
  assert.equal(C.validateState(s).progress['NAME-1'].completedAt,first);
});

function learnedSkill(code,date='2026-10-01') {
  const s=C.freshState(),skill=D.skills.find(x=>x.code===code);
  for(const st of skill.steps)s.progress[st.id]={status:C.STATUSES[3],notes:'',updatedAt:date+'T12:00:00Z',completedAt:date+'T12:00:00Z'};
  return s;
}
test('maintenance uses real practice, ignores note edits and future or unrelated logs',()=>{
  const now=new Date('2026-10-21T12:00:00'),skill=D.skills.find(s=>s.code==='SIT');
  let s=learnedSkill('SIT');assert.equal(C.maintenance(D,s,now)[0].days,20);
  s=C.setProgress(s,'SIT-1',C.STATUSES[3],'An edit much later');assert.equal(C.maintenance(D,s,now)[0].days,20);
  for(const input of [{date:'2026-10-25',stepId:'SIT-1',type:'Skill practice'},{date:'2026-10-20',stepId:'DOWN-1',type:'Skill practice'},{date:'2026-10-20',stepId:'SIT-1',type:'Management / event'}])s.sessions.push(C.normalizeSession(input));
  assert.equal(C.practiceRecord(skill,s,now).days,20);
  s.sessions.push(C.normalizeSession({date:'2026-10-19',stepId:'SIT-1',type:'Skill practice'}));
  assert.equal(C.practiceRecord(skill,s,now).days,2);assert.equal(C.practiceRecord(skill,s,now).practiceDays,2);
});
test('maintenance excludes incomplete, paused and fear exposure programs',()=>{
  const now=new Date('2026-10-21T12:00:00');
  assert.equal(C.maintenance(D,C.freshState(),now).length,0);
  let s=learnedSkill('DOG');assert.equal(C.maintenance(D,s,now).length,0);
  s=learnedSkill('SIT');s.progress['SIT-1'].status=C.STATUSES[4];assert.equal(C.maintenance(D,s,now).length,0);
});
test('calendar elapsed days handle leap years, daylight saving and unknown dates',()=>{
  assert.equal(C.daysBetween('2024-02-28','2024-03-01'),2);
  assert.equal(C.daysBetween('2026-03-07','2026-03-09'),2);
  assert.equal(C.daysBetween('2026-10-31','2026-11-02'),2);
  assert.equal(C.daysBetween('','2026-10-21'),null);assert.equal(C.elapsedLabel(null),'No practice logged yet');
});

function household(names=['Molly','Spot','Pip']) {
  let s=C.freshState();s.profile.name=names[0];
  for(const name of names.slice(1))s=C.addDog(s,{name});
  s.household.setupComplete=true;return C.selectDogs(s,C.dogs(s).map(d=>d.id));
}
test('legacy saves migrate without losing profile, progress, notes or session IDs',()=>{
  let legacy=learnedSkill('SIT');legacy.profile.name='Existing dog';delete legacy.household;delete legacy.cues;
  const migrated=C.validateState(legacy);assert.equal(C.dogs(migrated).length,1);assert.equal(migrated.household.setupComplete,true);
  assert.deepEqual(migrated.progress,legacy.progress);assert.equal(migrated.profile.name,'Existing dog');
});
test('each dog keeps independent progress, notes and practice history',()=>{
  let s=household();const ids=C.dogs(s).map(d=>d.id);
  s=C.setDogProgress(s,[ids[0]],'NAME-1',C.STATUSES[3]);
  assert.equal(C.status(C.dogState(s,ids[0]),'NAME-1'),C.STATUSES[3]);
  for(const id of ids.slice(1))assert.equal(C.status(C.dogState(s,id),'NAME-1'),C.STATUSES[0]);
  s=C.updateDog(s,ids[1],d=>({...d,sessions:[C.normalizeSession({date:'2026-10-21',stepId:'SIT-1',type:'Skill practice'})]}));
  assert.equal(s.sessions.length,0);assert.equal(C.dogState(s,ids[1]).sessions.length,1);
});
test('training two of three dogs excludes the unselected dog and follows the earliest gap',()=>{
  let s=household();const ids=C.dogs(s).map(d=>d.id);
  s=C.setDogProgress(s,[ids[0]],'NAME-1',C.STATUSES[3]);
  s=C.setDogProgress(s,[ids[0]],'SIT-1',C.STATUSES[1]);
  s=C.selectDogs(s,ids.slice(0,2));assert.equal(C.selectedDogs(s).length,2);
  assert.equal(C.trainingAvailable(D,s)[0].step.id,'NAME-1');
  s=C.setDogProgress(s,ids.slice(0,2),'NAME-1',C.STATUSES[3]);
  assert.equal(C.status(C.trainingView(s),'NAME-1'),C.STATUSES[3]);
  assert.equal(C.status(C.dogState(s,ids[2]),'NAME-1'),C.STATUSES[0]);
});
test('a paused dog blocks group practice of that step without erasing others’ progress',()=>{
  let s=household(['Molly','Spot']);const ids=C.dogs(s).map(d=>d.id);
  s=C.setDogProgress(s,[ids[0]],'NAME-1',C.STATUSES[4]);
  assert.equal(C.status(C.trainingView(s),'NAME-1'),C.STATUSES[4]);
  assert.ok(!C.trainingAvailable(D,s).some(x=>x.step.id==='NAME-1'));
});
test('multi-dog backups round trip all dogs, selected subset and cues',()=>{
  let s=household();const ids=C.dogs(s).map(d=>d.id);
  s=C.updateDog(s,ids[1],d=>({...d,cues:{SIT:'Park'}}));s=C.selectDogs(s,[ids[1],ids[2]]);
  const backup=C.makeBackup(s,D);assert.equal(backup.version,3);
  assert.deepEqual(C.parseBackup(JSON.stringify(backup)),C.validateState(s));
});
test('invalid household names, IDs, selections and duplicate journal IDs are rejected',()=>{
  const s=household();
  for(const mutate of [x=>x.household.selectedIds=[],x=>x.household.selectedIds=['missing'],x=>x.household.others[0].id=x.household.primaryId,x=>x.household.others[0].profile.name='',x=>x.household.others[0].profile.name='molly',x=>x.cues={SIT:{bad:true}}]){
    const bad=JSON.parse(JSON.stringify(s));mutate(bad);assert.throws(()=>C.validateState(bad));
  }
  s.sessions=[C.normalizeSession({id:'same',date:'2026-10-21'})];s.household.others[0].sessions=s.sessions.slice();assert.throws(()=>C.validateState(s));
  assert.throws(()=>C.addDog(household(),{name:'Molly'}));assert.throws(()=>C.selectDogs(s,[]));
});
test('all reverse links target a real prerequisite edge without duplicates',()=>{
  for(const skill of D.skills){const links=C.downstreamSkills(D,skill.code),ids=new Set(skill.steps.map(s=>s.id));assert.equal(new Set(links.map(x=>x.skill.code)).size,links.length);for(const x of links){assert.notEqual(x.skill.code,skill.code);assert.ok(x.step.deps.some(([id])=>ids.has(id)));}}
});
test('the breed catalog is searchable, accepts aliases and never assigns traits',()=>{
  const T=require('../app/web/tailoring.js');assert.ok(T.breeds.length>100);assert.equal(new Set(T.breeds).size,T.breeds.length);
  assert.ok(T.search('staffy').includes('Staffordshire Bull Terrier'));assert.ok(T.search('sheltie').includes('Shetland Sheepdog'));assert.ok(T.search('lowchen').includes('Löwchen'));assert.ok(T.search('soft-coated wheaten').includes('Soft Coated Wheaten Terrier'));
  for(const trait of T.traits)for(const id of trait.sources)assert.ok(D.sources.some(s=>s.id===id));
  let s=C.freshState();s.profile.breed='Lagotto Romagnolo';assert.equal(C.available(D,s)[0].skill.code,'NAME');assert.deepEqual(s.tailoring.traits,[]);
  assert.equal(T.hintFor('__proto__'),null);assert.equal(T.hintFor('constructor'),null);
  assert.deepEqual(Object.keys(T.hints).sort(),['Lagotto Romagnolo','Shetland Sheepdog','Soft Coated Wheaten Terrier','Spanish Water Dog']);
});
test('confirmed observations adapt suggestions; breed alone never changes advancement',()=>{
  const s=C.freshState(),before=JSON.stringify(D);s.tailoring.traits=['noise'];
  assert.equal(C.available(D,s)[0].skill.code,'SAFE');assert.ok(C.available(D,s).slice(0,3).some(x=>x.skill.code==='SOUND'));
  assert.equal(JSON.stringify(D),before);
  const legacy=C.freshState();delete legacy.profile.breed;delete legacy.tailoring;delete legacy.cues;delete legacy.household;
  const restored=C.validateState(legacy);assert.equal(restored.profile.breed,'');assert.deepEqual(restored.tailoring.traits,[]);
});
test('individual tailoring survives multi-dog backup and rejects unknown settings',()=>{
  let s=household();const id=C.dogs(s)[1].id;
  s=C.updateDog(s,id,d=>({...d,profile:{...d.profile,breed:'My own mix'},tailoring:{traits:['novelty'],reviewedBreed:'My own mix'}}));
  const restored=C.parseBackup(JSON.stringify(C.makeBackup(s,D)));assert.deepEqual(C.dogState(restored,id).tailoring,{traits:['novelty'],reviewedBreed:'My own mix'});
  const bad=structuredClone(s);bad.tailoring.traits=['lazy'];assert.throws(()=>C.validateState(bad));
});
test('all combinations of three dogs’ stages preserve the least advanced or paused group stage',()=>{
  const original=household(),ids=C.dogs(original).map(d=>d.id);
  for(const a of C.STATUSES)for(const b of C.STATUSES)for(const c of C.STATUSES){
    let s=original;const stages=[a,b,c];
    for(let i=0;i<ids.length;i++)s=C.setDogProgress(s,[ids[i]],'NAME-1',stages[i]);
    const expected=stages.includes(C.STATUSES[4])?C.STATUSES[4]:stages.reduce((x,y)=>C.rank(x)<=C.rank(y)?x:y);
    assert.equal(C.status(C.trainingView(s),'NAME-1'),expected);
    assert.equal(C.availability(D.skills.find(s=>s.code==='NAME').steps[1],C.trainingView(s)),stages.every(x=>x===C.STATUSES[3])?'Ready to start':'Build prerequisite');
  }
});
test('hundreds of varied group updates cannot modify an unselected dog’s records',()=>{
  let s=household(['A','B','C','D','E','F','G','H']),seed=421;
  const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;},steps=D.skills.flatMap(s=>s.steps.map(st=>st.id));
  for(let i=0;i<500;i++){
    const dogs=C.dogs(s),chosen=dogs.filter(()=>random(3)===0).map(d=>d.id);if(!chosen.length)chosen.push(dogs[random(dogs.length)].id);
    const before=new Map(dogs.map(d=>[d.id,JSON.stringify(d)]));
    s=C.setDogProgress(s,chosen,steps[random(steps.length)],C.STATUSES[random(C.STATUSES.length)]);
    for(const d of C.dogs(s))if(!chosen.includes(d.id))assert.equal(JSON.stringify(d),before.get(d.id));
    if(i%50===0)assert.deepEqual(C.parseBackup(JSON.stringify(C.makeBackup(s,D))),C.validateState(s));
  }
});
test('individual support and refresher dates never leak from unselected dogs',()=>{
  let s=household(['Molly','Spot']);const ids=C.dogs(s).map(d=>d.id);
  s=C.updateDog(s,ids[0],d=>({...d,tailoring:{traits:['noise'],reviewedBreed:''}}));
  s=C.selectDogs(s,[ids[1]]);assert.equal(C.trainingAvailable(D,s)[0].skill.code,'NAME');
  s=C.selectDogs(s,[ids[0]]);assert.equal(C.trainingAvailable(D,s)[0].skill.code,'SAFE');
  const learned=learnedSkill('SIT','2026-10-01');s=C.updateDog(s,ids[0],d=>({...d,progress:learned.progress}));
  s=C.selectDogs(s,ids);assert.deepEqual(C.practiceRecords(D,s,new Date('2026-10-21T12:00:00Z')).map(r=>r.dogId),[ids[0]]);
  s=C.selectDogs(s,[ids[1]]);assert.equal(C.practiceRecords(D,s).length,0);
});
test('recovery of the final setup snapshot opens the tour without creating an extra dog',()=>{
  const s=C.freshState();s.profile.name='Ready companion';s.household.setupTarget=1;s.household.setupIndex=1;
  const restored=C.validateState(s);assert.equal(restored.household.setupComplete,true);assert.equal(C.dogs(restored).length,1);assert.equal(restored.household.tutorialSeenVersion,0);
  const missing=C.freshState();missing.household.setupTarget=3;missing.household.setupIndex=3;assert.throws(()=>C.validateState(missing));
  const inconsistent=household();inconsistent.household.setupTarget=3;inconsistent.household.setupIndex=1;assert.throws(()=>C.validateState(inconsistent));
});
test('the original app refuses new native records instead of silently dropping extra dogs',()=>{
  const legacy=require('./fixtures/v1-core.cjs');let s=household();const before=JSON.stringify(s),wire=C.storageState(s);
  assert.equal(JSON.stringify(s),before);assert.throws(()=>legacy.validateState(wire));
  assert.deepEqual(C.validateState(wire),C.validateState(s));assert.equal(C.validateState(wire).progress[C.FORMAT_GUARD],undefined);
  assert.throws(()=>legacy.parseBackup(JSON.stringify(C.makeBackup(s,D))));
  assert.equal(C.dogs(C.parseBackup(JSON.stringify({format:'good-ground-backup',version:1,state:wire}))).length,3);
});

test('basket release can be learned before retrieval, but pickup still waits for its component',()=>{
  const I=C.index(D),step=id=>I.steps.get(id).step;
  let s=C.setProgress(C.freshState(),'GIVE-2',C.STATUSES[3]);
  assert.equal(C.availability(step('BOX-1'),s),'Ready to start');
  s=C.setProgress(s,'BOX-1',C.STATUSES[3]);
  assert.equal(C.availability(step('BOX-2'),s),'Build prerequisite');
  s=C.setProgress(s,'FETCH-2',C.STATUSES[3]);
  assert.equal(C.availability(step('BOX-2'),s),'Ready to start');
});
test('release does not force a sit and door targeting builds on the independent object target',()=>{
  const I=C.index(D),step=id=>I.steps.get(id).step;
  let s=C.freshState();assert.equal(C.availability(step('FREE-1'),s),'Ready to start');
  s=C.setProgress(s,'TOUCH-2',C.STATUSES[3]);assert.equal(C.availability(step('CLOSE-1'),s),'Build prerequisite');
  s=C.setProgress(s,'OTARGET-2',C.STATUSES[3]);assert.equal(C.availability(step('CLOSE-1'),s),'Ready to start');
});
test('smaller practice actions are limited to real relevant steps and never selected by breed',()=>{
  const T=require('../app/web/tailoring.js'),I=C.index(D);
  for(const {step} of I.steps.values()){
    assert.deepEqual(T.practicePieces(step.id,[]),[]);
    const pieces=T.practicePieces(step.id,['noise','novelty','handling']);
    if(pieces.length){assert.equal(pieces.length,3);assert.ok(pieces.every(p=>typeof p==='string'&&p.length>30));}
  }
  assert.deepEqual(T.practicePieces('SIT-1',['noise','novelty','handling']),[]);
  const changed=T.practicePieces('SOUND-1',['noise']);changed.pop();
  assert.equal(T.practicePieces('SOUND-1',['noise']).length,3);
});
test('an explicit hidden marker preference survives validation while missing preferences enable the shortcut',()=>{
  const s=C.freshState();s.settings.lessonMarker=false;assert.equal(C.validateState(s).settings.lessonMarker,false);
  delete s.settings.lessonMarker;assert.equal(C.validateState(s).settings.lessonMarker,true);
});
