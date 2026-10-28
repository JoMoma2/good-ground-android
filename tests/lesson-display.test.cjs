const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),D=require('../app/web/data.json');
const records=s=>Object.fromEntries(['profile','progress','sessions','progressHistory','cues','plans','household','favorites','tailoring'].map(k=>[k,s[k]]));
function household(){let s=C.freshState();s.profile.name='Molly';s=C.setProgress(s,'NAME-1',C.STATUSES[2],'Keep this note');s=C.addDog(s,{name:'Poppy'});s.settings.textSize='large';s.settings.markerVolume=55;s.settings.lessonMarker=false;return s;}
test('obsolete Simple/Detailed overrides are retired without changing dogs or records',()=>{
 for(const mode of ['simple','detailed']){const s=household();s.settings.lessonMode=mode;s.settings.lessonSections={setup:false,easier:true,notes:true,sources:false};const copy=C.validateState(s);assert.deepEqual(records(copy),records(s));assert.equal('lessonMode' in copy.settings,false);assert.equal('lessonSections' in copy.settings,false);assert.equal(copy.settings.textSize,'large');assert.equal(copy.settings.lessonMarker,false);assert.equal(copy.settings.markerVolume,55);}
});
test('old backups and native storage retain records and active settings while dropping obsolete preferences',()=>{
 const s=household();s.settings.lessonMode='detailed';s.settings.lessonSections={easier:true};const copy=C.parseBackup(JSON.stringify(C.makeBackup(s,D)));assert.deepEqual(records(copy),records(s));const round=C.validateState(JSON.parse(JSON.stringify(C.storageState(copy))));assert.deepEqual(round.settings,copy.settings);assert.deepEqual(records(round),records(copy));assert.equal(C.LESSON_SECTIONS,undefined);assert.equal(C.lessonSections,undefined);
});
test('malformed retired display preferences are ignored and never invalidate training data',()=>{
 const s=household();s.settings.lessonMode={unknown:true};s.settings.lessonSections=['easier'];const copy=C.validateState(s);assert.deepEqual(records(copy),records(s));assert.deepEqual(copy.settings,household().settings);assert.equal('lessonMode' in C.freshState().settings,false);
});
