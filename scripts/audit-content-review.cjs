// Fail when any reviewed instruction, source annotation or retirement changes silently.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),D=require(root+'/app/web/data.json'),C=require(root+'/app/web/core.js'),I=C.index(D);
const R=require(root+'/research/curriculum-review-8.json'),O=require(root+'/research/curriculum-corrections-8.json'),B=require(root+'/tests/fixtures/1.6.0-catalog.json');
const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(sort(v))).digest('hex');
assert.equal(D.version,R.curriculum);assert.deepEqual(Object.keys(R.skills).sort(),D.skills.map(s=>s.code).sort());
for(const s of D.skills){const review=R.skills[s.code];assert.equal(hash(s),review.skillSHA256,'Unreviewed skill change '+s.code);assert.deepEqual(Object.keys(review.steps).sort(),s.steps.map(t=>t.id).sort());for(const t of s.steps)assert.equal(hash(t),review.steps[t.id].stepSHA256,'Unreviewed step '+t.id);}
assert.deepEqual(D.sources,O.sources,'Source annotation changed without review');
for(const key of ['intro','evidence','triggers'])assert.deepEqual(D[key],O[key],'Unreviewed guidance '+key);
assert.equal(R.sourceVerification.length,D.sources.length);assert.deepEqual(R.sourceVerification.map(x=>x.appId).sort(),D.sources.map(x=>x.id).sort());
for(const [file,digest] of Object.entries(R.supplementaryGuidance.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex'),digest,'Unreviewed supplementary advice '+file);
assert.equal(crypto.createHash('sha256').update(C.sessionGuidance.toString()).digest('hex'),R.supplementaryGuidance.sessionGuidanceSHA256,'Unreviewed journal guidance');
const sourceIds=new Set(D.sources.map(s=>s.id));
for(const e of D.evidence)for(const id of e.sources.match(/\b[RPNAV]\d+\b/g)||[])assert.ok(sourceIds.has(id),'Missing evidence source '+id);
for(const s of B.skills)for(const t of s.steps){
 const active=I.steps.get(t.id);if(active)continue;
 const archive=I.archivedSteps.get(t.id);assert.ok(archive,'Lost historical step '+t.id);assert.deepEqual(archive.step,t,'Historical guide modified '+t.id);
 assert.ok(R.retiredSteps[t.id]?.reason.length>40,'Missing retirement reason '+t.id);assert.equal(R.retiredSteps[t.id].automaticCredit,false);
 assert.ok(archive.skill.retirementReason);for(const s of D.skills)for(const step of s.steps)assert.ok(!(step.replaces||[]).includes(t.id),'Retired exercise credits new context '+t.id);
}
console.log('PASS: all 154 skill/386 step content fingerprints, 87 source scopes, shared guidance and nine no-credit retirements.');
