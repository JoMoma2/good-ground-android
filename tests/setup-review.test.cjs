const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D=require('../app/web/data.json'),C=require('../app/web/core.js'),review=require('../research/step-setups.json');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
test('preparation review covers every current skill and exact step once',()=>{
 assert.equal(D.skills.length,154);assert.equal(C.index(D).steps.size,386);assert.equal(C.index(D).archivedSteps.size,45);assert.deepEqual(Object.keys(review.skills).sort(),D.skills.map(s=>s.code).sort());let count=0;
 for(const skill of D.skills){const entry=review.skills[skill.code];assert.ok(entry.sharedSetupReview.length>30);assert.equal(entry.previousSharedSetup,skill.setup);assert.deepEqual(entry.steps.map(s=>s.id),skill.steps.map(s=>s.id));for(const [i,row] of entry.steps.entries()){assert.equal(row.setup,skill.steps[i].setup);assert.ok(row.setup.split(/\s+/).length>=12);assert.notEqual(row.setup,skill.goal);assert.notEqual(row.setup,skill.steps[i].teach);count++;}}
 assert.equal(count,386);assert.equal(D.setupRevision,2);
});
test('setup additions preserve the reviewed original teaching, criteria and prerequisite content',()=>{
 for(const skill of D.skills)for(const step of skill.steps){const row=review.skills[skill.code].steps.find(s=>s.id===step.id);assert.equal(hash(step.teach),row.reviewedTeachingSHA256,step.id);const original=Object.fromEntries(Object.entries(step).filter(([k])=>k!=='setup').sort(([a],[b])=>a<b?-1:1));assert.equal(hash(JSON.stringify(original)),row.reviewedStepSHA256,step.id);}
});
test('step preparations distinguish components and retain important equipment safety',()=>{
 const step=id=>C.index(D).steps.get(id).step.setup;assert.match(step('TOUCH-1'),/palm empty|palm.*empty/);assert.notEqual(step('TOUCH-1'),step('TOUCH-2'));assert.match(step('MUZZLE-1'),/panting/);assert.match(step('MUZZLE-5'),/supervision/);assert.match(step('RAMP-1'),/flat/);assert.match(step('RAMP-2'),/very low/);assert.match(step('LIGHTPAD-2'),/disconnect/);assert.match(step('POST-B'),/pouch aside/);assert.match(step('SCENTMATCH-1'),/No oils|no oils/);assert.match(step('TEETH-3'),/veterinary/);
});
