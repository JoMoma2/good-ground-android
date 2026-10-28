const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),H=require('../app/web/history.js'),D=require('../app/web/data.json'),I=C.index(D);
const now=d=>new Date(d+'T12:00:00'),full=(s,code)=>D.skills.find(x=>x.code===code).steps.reduce((a,step)=>C.setProgress(a,step.id,C.STATUSES[3]),s);
function oldCore(){return require('./fixtures/1.1.1-core.cjs');}
test('new anxiety observations do not replace the three initial foundational recommendations',()=>{
 const s=C.freshState(),baseline=C.startingAvailable(D,s).slice(0,3).map(x=>x.step.id);
 s.profile.priorities=['Other dogs'];s.tailoring.traits=['noise','handling'];
 assert.deepEqual(C.startingAvailable(D,s).slice(0,3).map(x=>x.step.id),baseline);
 const tailored=C.personalizedAvailable(D,s);assert.ok(tailored.some(x=>x.skill.sheet==='Other dogs'));assert.ok(tailored.some(x=>x.skill.code==='SOUND'));
 s.profile.priorities=[];s.tailoring.traits=[];assert.deepEqual(C.personalizedAvailable(D,s),[]);
});
test('all original steps and cues survive through active or historical guides',()=>{
 for(const id of require('./fixtures/1.1.1-step-ids.json'))assert.ok(I.steps.has(id)||I.archivedSteps.has(id),id);
 const fridge=I.skills.get('DRINK');assert.equal(fridge.steps.length,4);assert.equal(fridge.sheet,'Brainiacs');
 assert.deepEqual(fridge.project.modules.map(c=>c.code),['OPEN','SHELF','CLOSE','DRINK']);
 assert.equal(C.projectPlan(D,C.freshState(),'DRINK').modules.flatMap(m=>m.steps).length,13);
 const s=C.freshState();s.cues={OPEN:'Fridge',CLOSE:'Shut',SHELF:'Bottle',DRINK:'A drink'};s.favorites=['OPEN','SHELF'];s.progress['OPEN-1']={status:C.STATUSES[3],notes:'Kept',updatedAt:'2026-10-20'};
 const upgraded=C.observeProgress(D,s,now('2026-10-22'));assert.deepEqual(upgraded.favorites,['OPEN','SHELF']);assert.deepEqual(upgraded.cues,s.cues);assert.deepEqual(upgraded.progress,s.progress);
});
test('Brainiacs is last and contains eight substantial acyclic projects tied to component skills',()=>{
 assert.equal(D.skills.at(-1).sheet,'Brainiacs');const projects=D.skills.filter(s=>s.sheet==='Brainiacs');assert.equal(projects.length,8);
 for(const skill of projects){const stages=C.projectPlan(D,C.freshState(),skill.code).modules.flatMap(m=>m.steps);assert.equal(new Set(stages.map(x=>x.step.id)).size,stages.length);assert.ok(stages.length>skill.steps.length);assert.ok(skill.steps.some(st=>st.deps.some(([id])=>I.steps.get(id).skill!==skill)));}
 assert.equal(C.availability(I.steps.get('OPEN-4').step,C.freshState()),'Ready to start');
 assert.equal(C.availability(I.steps.get('OPEN-5').step,C.freshState()),'Build prerequisite');
});
test('baseline starts at the observed date and never infers a past curve from completion timestamps',()=>{
 let s=full(C.freshState(),'NAME');s.progress['NAME-1'].completedAt='2025-01-01';s=C.observeProgress(D,s,now('2026-10-22'));
 assert.equal(s.progressHistory.length,1);assert.equal(s.progressHistory[0].date,'2026-10-22');assert.equal(s.progressHistory[0].topics.Foundations[0],1);
 assert.equal(C.observeProgress(D,s,now('2026-10-23')),s,'No invented daily changes');
});
test('daily skill percentages accumulate, remain at 100%, and can reflect deliberate progress rollback',()=>{
 const toy={version:1,skills:[{code:'A',sheet:'One',steps:[{id:'A-1',deps:[]}]},{code:'B',sheet:'One',steps:[{id:'B-1',deps:[]}]}]};
 let s=C.observeProgress(toy,C.freshState(),now('2026-10-01'));
 s=C.observeProgress(toy,C.setProgress(s,'A-1',C.STATUSES[3]),now('2026-10-05'));
 s=C.observeProgress(toy,C.setProgress(s,'B-1',C.STATUSES[3]),now('2026-10-10'));
 let line=H.series(s.progressHistory,'2026-10-20')[0];assert.deepEqual(line.points.map(p=>p.value),[0,50,100]);
 const g=H.geometry(line.points,'2026-10-01','2026-10-20');assert.ok(g.d.endsWith('H344'),'Complete category extends level through today');
 s=C.observeProgress(toy,C.setProgress(s,'A-1',C.STATUSES[1]),now('2026-10-21'));assert.equal(H.series(s.progressHistory,'2026-10-21')[0].points.at(-1).value,50);
});
test('partial steps and notes do not count as completed skills or introduce extra history',()=>{
 let s=C.observeProgress(D,C.freshState(),now('2026-10-01'));
 s=C.observeProgress(D,C.setProgress(s,'NAME-1',C.STATUSES[3]),now('2026-10-02'));assert.equal(s.progressHistory.length,1);
 s=full(s,'NAME');s=C.observeProgress(D,s,now('2026-10-03'));assert.equal(s.progressHistory.length,2);
 s=C.setProgress(s,'NAME-1',C.STATUSES[3],'A note');assert.equal(C.observeProgress(D,s,now('2026-10-04')),s);
 s=C.observeProgress(D,full(s,'TOUCH'),now('2026-10-03'));assert.equal(s.progressHistory.length,2);assert.equal(s.progressHistory.at(-1).topics.Foundations[0],2);
});
test('catalog changes freeze past denominators and new categories begin at their first real observation',()=>{
 const a={version:1,skills:[{sheet:'One',steps:[{id:'A',deps:[]}]}]},b={version:2,skills:[...a.skills,{sheet:'One',steps:[{id:'B',deps:[]}]},{sheet:'New',steps:[{id:'C',deps:[]}]}]};
 let s=C.observeProgress(a,C.setProgress(C.freshState(),'A',C.STATUSES[3]),now('2026-10-01'));
 s=C.observeProgress(b,s,now('2026-10-02'));assert.deepEqual(s.progressHistory[0].topics.One,[1,1]);assert.deepEqual(s.progressHistory[1].topics.One,[1,2]);assert.equal(H.series(s.progressHistory,'2026-10-03')[1].points[0].date,'2026-10-02');
});
test('calendar spacing uses days, and future-dated records are excluded from the current chart',()=>{
 const points=[{date:'2026-10-01',value:0},{date:'2026-10-02',value:25},{date:'2026-10-11',value:50}];const g=H.geometry(points,points[0].date,points[2].date);assert.ok(Math.abs((g.dots[1].x-g.dots[0].x)/(g.dots[2].x-g.dots[0].x)-.1)<1e-8);
 const rows=points.map(p=>({date:p.date,curriculum:1,topics:{One:[p.value,100]}}));assert.equal(H.series(rows,'2026-10-02')[0].points.length,2);
});
test('history is per dog, survives backups, and old formats migrate without losing existing records',()=>{
 let s=C.freshState();s.profile.name='Molly';s=C.addDog(s,{name:'Poppy'});s=C.observeProgress(D,s,now('2026-10-01'));
 const other=C.dogs(s)[1].id;s=C.updateDog(s,other,d=>full(d,'NAME'));s=C.observeProgress(D,s,now('2026-10-02'));
 assert.equal(s.progressHistory.length,1);assert.equal(C.dogs(s)[1].progressHistory.length,2);
 assert.deepEqual(C.parseBackup(JSON.stringify(C.makeBackup(s,D))),C.validateState(s));
 const old=oldCore().freshState();assert.deepEqual(C.parseBackup(JSON.stringify({format:'good-ground-backup',version:2,state:old})).progressHistory,[]);
 assert.throws(()=>oldCore().validateState(JSON.parse(JSON.stringify(C.storageState(s)))));
});
test('malformed or duplicate history is rejected before replacing saved data',()=>{
 const base=C.observeProgress(D,C.freshState(),now('2026-10-22'));
 for(const bad of [r=>r.date='2026-02-30',r=>r.topics.Foundations=[4,2],r=>r.topics.Foundations=[-1,2],r=>r.curriculum=0]){const s=structuredClone(base);bad(s.progressHistory[0]);assert.throws(()=>C.validateState(s));}
 const s=structuredClone(base);s.progressHistory.push(s.progressHistory[0]);assert.throws(()=>C.validateState(s));assert.equal(base.progressHistory.length,1);
});

test('removed categories stop at their actual last observation on the shared date axis',()=>{
 const rows=[{date:'2026-10-01',curriculum:1,topics:{Old:[1,1],Kept:[0,1]}},{date:'2026-10-05',curriculum:2,topics:{Kept:[1,1]}}];
 const retired=H.series(rows,'2026-10-22').find(x=>x.name==='Old');assert.equal(retired.active,false);
 const g=H.geometry(retired.points,'2026-10-01','2026-10-22',retired.active);assert.equal(g.d,'M40 34');
});
