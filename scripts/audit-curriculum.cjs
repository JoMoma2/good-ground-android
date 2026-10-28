// Reproducible catalog-wide audit, including historical edges and archived guides.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=require(root+'/app/web/core.js'),D=require(root+'/app/web/data.json'),I=C.index(D),baselines=require(root+'/research/prerequisite-baselines.json');
const review=require(root+'/research/prerequisite-review.json'),reasons=review.historicalReasons;
const retired=require(root+'/research/curriculum-review-8.json').retiredSteps;
assert.equal(review.curriculum,D.version,'Review the current curriculum');
assert.deepEqual(Object.keys(review.skills).sort(),D.skills.map(s=>s.code).sort(),'Every skill needs an explicit editorial decision');
for(const skill of D.skills){
 const checked=review.skills[skill.code];assert.ok(checked.rationale.length>40,skill.code+' missing review');
 assert.deepEqual(Object.keys(checked.steps).sort(),skill.steps.map(st=>st.id).sort());
 for(const st of skill.steps){assert.deepEqual(checked.steps[st.id].deps,st.deps,'Unreviewed dependency change '+st.id);assert.ok(checked.steps[st.id].reason.length>30);}
}
const original=require(root+'/tests/fixtures/1.3.0-catalog.json'),newSkills=D.skills.filter(s=>!original.skills.some(o=>o.code===s.code));
assert.equal(newSkills.length,50,'Exactly 50 distinct additions to the 104-skill catalog');
assert.equal(D.skills.length,original.skills.length+50);
for(const skill of original.skills){assert.ok(I.skills.has(skill.code),'Existing skill lost '+skill.code);for(const st of skill.steps)assert.ok(I.steps.has(st.id)||(I.archivedSteps.has(st.id)&&retired[st.id]),'Existing step lost without reviewed retirement '+st.id);}

const result={curriculum:D.version,skills:D.skills.length,activeSteps:I.steps.size,archivedSteps:I.archivedSteps.size,baselines:{},newProjects:[]};
const replacement=new Map();for(const s of D.skills)for(const st of s.steps)for(const id of st.replaces||[]){assert.ok(!replacement.has(id),'Duplicate replacement '+id);replacement.set(id,st.id);}
for(const [version,old] of Object.entries(baselines)){
 const changes=[],missing=[];let unchanged=0;
 for(const s of old.skills)for(const st of s.steps){
  const current=I.steps.get(st.id);
  if(!current){assert.ok(I.archivedSteps.has(st.id)&&(replacement.has(st.id)||retired[st.id]),'Lost original step '+st.id);missing.push({id:st.id,disposition:retired[st.id]?'Retired from recommendations; original guide and records retained; no automatic credit':'Original guide and records retained',replacement:replacement.get(st.id)||null,reason:retired[st.id]?.reason});continue;}
  if(JSON.stringify(st.deps)===JSON.stringify(current.step.deps)){unchanged++;continue;}
  assert.ok(reasons[st.id],'Unreviewed prerequisite change: '+st.id);
  changes.push({id:st.id,before:st.deps,after:current.step.deps,reason:reasons[st.id]});
 }
 result.baselines[version]={commit:old.commit,unchanged,changes,archived:missing};
}
// Every literal lesson reference in every current teaching guide resolves.
for(const s of D.skills)for(const st of s.steps){
 for(const id of [s.setup,st.teach,st.advance,st.easier].join(' ').match(/\b[A-Z][A-Z0-9]*-[0-9]+\b/g)||[])assert.ok(I.steps.has(id),'Unresolved teaching reference '+st.id+' -> '+id);
 for(const old of st.replaces||[])assert.ok(I.archivedSteps.has(old));
}
const allSteps=new Map([...I.steps,...I.archivedSteps]),visited=new Set(),visiting=new Set();
function visit(id){
 assert.ok(!visiting.has(id),'Circular current/earlier dependency '+id);if(visited.has(id))return;
 visiting.add(id);for(const [parent,level] of allSteps.get(id).step.deps){assert.ok(allSteps.has(parent)&&[2,3].includes(level),'Broken current/earlier reference '+parent);visit(parent);}
 visiting.delete(id);visited.add(id);
}
for(const id of allSteps.keys())visit(id);
for(const {skill,step} of I.archivedSteps.values())for(const id of [skill.setup,step.teach,step.advance,step.easier].join(' ').match(/\b[A-Z][A-Z0-9]*-[0-9]+\b/g)||[])assert.ok(allSteps.has(id),'Broken earlier guide link '+id);
for(const s of D.skills.filter(s=>s.project)){
 const p=C.projectPlan(D,C.freshState(),s.code);
 result.newProjects.push({code:s.code,title:s.title,modules:p.modules.map(m=>({code:m.code,optional:!!m.optional,steps:m.steps.length})),requiredSteps:p.total,totalSteps:p.modules.reduce((n,m)=>n+m.steps.length,0),assemblySteps:s.steps.length});
}
const md=['# Full prerequisite audit — curriculum '+D.version,'',`Reviewed ${D.skills.length} current skills, ${I.steps.size} active teaching steps and ${I.archivedSteps.size} preserved earlier steps against versions 1.1.0, 1.1.1, 1.2.0 and 1.3.0. Active dependencies resolve and are acyclic. Every historical step has an active or preserved earlier page. No undocumented historical edge change is allowed by the audit script.`,'','## Historical changes',''];
for(const [v,r] of Object.entries(result.baselines)){
 md.push('### Compared with '+v,'',r.unchanged+' steps keep identical prerequisites; '+r.changes.length+' have reviewed changes; '+r.archived.length+' retain their original guides with reviewed replacement or retirement decisions.','', '| Step | Before | Now | Decision |','| --- | --- | --- | --- |');
 for(const c of r.changes)md.push(`| ${c.id} | ${JSON.stringify(c.before)} | ${JSON.stringify(c.after)} | ${c.reason} |`);
 md.push('');
}
md.push('## Every current skill','', '| Skill | Required component edges across its steps | Review |','| --- | --- | --- |');
for(const s of D.skills){
 const deps=s.steps.flatMap(st=>st.deps.filter(([id])=>I.steps.get(id).skill.code!==s.code).map(([id,level])=>id+(level===2?' (nearly there)':' (consistent)')));
 const decision=review.skills[s.code].rationale;
 md.push(`| ${s.code} · ${s.title} | ${[...new Set(deps)].join(', ')||'No external gate'} | ${decision} |`);
}
md.push('## Every active step', '', '| Step | Prerequisites | Editorial decision |', '| --- | --- | --- |');
for(const skill of D.skills)for(const st of skill.steps)md.push(`| ${st.id} · ${st.title} | ${st.deps.map(([id,level])=>id+' ('+(level===3?'consistent':'nearly there')+')').join(', ')||'Independent start'} | ${review.skills[skill.code].steps[st.id].reason} |`);
result.addedSkills=newSkills.map(s=>({code:s.code,title:s.title,category:s.sheet,steps:s.steps.length}));
if(process.argv.includes('--write')){
 fs.writeFileSync(root+'/research/PREREQUISITE_AUDIT.md',md.join('\n')+'\n');
 fs.writeFileSync(root+'/research/prerequisite-audit.json',JSON.stringify(result,null,2)+'\n');
}
console.log('PASS: full catalog audit;',result.skills,'skills,',result.activeSteps,'active steps,',result.archivedSteps,'preserved earlier steps; four historical baselines; all changes reviewed.');
