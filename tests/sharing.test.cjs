const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),M=require('../app/web/sharing.js'),S=M.withCore(C),D=require('../app/web/data.json'),OLD=require('./fixtures/1.7.1-core.cjs');
const dog='dog-1',copy=x=>structuredClone(x),state=name=>{let s=C.freshState();s.profile.name='Buddy';return S.setTrainerName(s,name);};
function pair(a=state('Quinten'),b=state('Abby')){
 const first=S.exportPacket(a,dog);a=first.state;
 b=S.approvePeer(b,dog,{id:a.trainer.id,name:a.trainer.name,mutualApproval:true},first.packet.dogId);
 a=S.approvePeer(a,dog,{id:b.trainer.id,name:b.trainer.name,mutualApproval:true});
 return [a,b];
}
function exchange(a,b){const x=S.exportPacket(a,dog),y=S.exportPacket(b,dog);return [S.mergePacket(x.state,dog,y.packet,b.trainer.id),S.mergePacket(y.state,dog,x.packet,a.trainer.id)];}
const rule=(s,title='Dinner',description='Use a comfortable routine.')=>S.write(s,dog,'rule',null,{title,description});
const note=(s,text='Observe and reward the requested action.')=>S.write(s,dog,'note',null,{skill:'SIT',step:'',text});
const first=(s,kind)=>S.records(s,dog,kind)[0];
const heads=(s,kind,key)=>S.heads(s,dog,kind,key).map(o=>o.id);

test('one stable trainer identity survives validation, renaming, backup and multiple dogs',()=>{
 let a=state('Quinten'),id=a.trainer.id;a=S.setTrainerName(a,'Q');a=C.addDog(a,{name:'Poppy'});
 assert.equal(a.trainer.id,id);assert.equal(C.validateState(a).trainer.id,id);assert.equal(C.parseBackup(JSON.stringify(C.makeBackup(a,D))).trainer.id,id);
 assert.equal(C.dogs(a).length,2);assert.equal(a.activeTrainer,undefined);assert.notEqual(state('Quinten').trainer.id,id);
});
test('legacy migration keeps progress, private notes, history, journals, cues and settings exactly',()=>{
 let old=OLD.freshState();old=OLD.setProgress(old,'SIT-1',OLD.STATUSES[3],'Private observation');old.cues.SIT='Sit here';old.settings.lessonMarker=false;old.profile.name='Buddy';
 old=OLD.addDog(old,{name:'Poppy'});old=OLD.updateDog(old,OLD.dogs(old)[1].id,d=>({...d,progress:{'NAME-1':{status:OLD.STATUSES[1],notes:'Poppy only',updatedAt:'2026-11-21',completedAt:''}}}));
 old=OLD.observeProgress(D,old,new Date('2026-11-21T12:00:00'));
 const migrated=S.identity(C.validateState(old));assert.ok(migrated.trainer.id);
 for(const field of ['profile','progress','sessions','cues','plans','settings','household','progressHistory'])assert.deepEqual(migrated[field],C.validateState(old)[field],field);
 assert.deepEqual(S.identity(C.validateState(C.storageState(migrated))),C.validateState(migrated));
});
test('backup version 4 rejects safely in 1.7.1 while the new reader accepts legacy 1–3',()=>{
 const s=state('Quinten');assert.equal(C.makeBackup(s,D).version,4);assert.throws(()=>OLD.parseBackup(JSON.stringify(C.makeBackup(s,D))));assert.throws(()=>OLD.validateState(C.storageState(s)));
 for(const version of [1,2,3]){const old=OLD.freshState();old.profile.name='Buddy';assert.equal(C.parseBackup(JSON.stringify({format:'good-ground-backup',version,state:old})).profile.name,'Buddy');}
});
test('single-trainer users need neither a connection nor a name to train',()=>{
 let s=C.freshState();s=C.setProgress(s,'SIT-1',C.STATUSES[3]);s=S.prepare(s);assert.equal(s.trainer.name,'');assert.equal(s.progress['SIT-1'].status,C.STATUSES[3]);assert.deepEqual(s.collaboration.dogs,{});
});
test('independent trainer progress cannot advance the local trainer or its prerequisite chain',()=>{
 let [a,b]=pair();a=C.setProgress(a,'SIT-1',C.STATUSES[3]);b=C.setProgress(b,'RECALL-1',C.STATUSES[3]);[a,b]=exchange(a,b);
 assert.equal(a.progress['SIT-1'].status,C.STATUSES[3]);assert.equal(a.progress['RECALL-1'],undefined);assert.equal(b.progress['SIT-1'],undefined);assert.equal(S.peerProgress(a,dog,b.trainer.id)['RECALL-1'].status,C.STATUSES[3]);
 const recall2=C.index(D).steps.get('RECALL-2').step;assert.equal(C.availability(recall2,a),'Build prerequisite');assert.equal(C.availability(recall2,b),'Ready to start');
});
test('each individual step is independent and can move backward without changing another trainer',()=>{
 let [a,b]=pair();for(const id of ['HEEL-1','HEEL-2'])a=C.setProgress(a,id,C.STATUSES[3]);a=C.setProgress(a,'HEEL-3',C.STATUSES[1]);b=C.setProgress(b,'HEEL-1',C.STATUSES[3]);[a,b]=exchange(a,b);
 assert.equal(S.peerProgress(a,dog,b.trainer.id)['HEEL-2'],undefined);a=C.setProgress(a,'HEEL-1',C.STATUSES[4]);[a,b]=exchange(a,b);assert.equal(b.progress['HEEL-1'].status,C.STATUSES[3]);assert.equal(S.peerProgress(b,dog,a.trainer.id)['HEEL-1'].status,C.STATUSES[4]);
});
test('private step notes, journal, cues, device settings and other dogs never enter dog packets',()=>{
 let a=state('Quinten');a=C.setProgress(a,'SIT-1',C.STATUSES[3],'PRIVATE STEP SECRET');a.sessions=[C.normalizeSession({date:'2026-11-21',observations:'PRIVATE JOURNAL SECRET'})];a.cues.SIT='PRIVATE CUE SECRET';a.settings.markerSound='buzz';a=C.addDog(a,{name:'OTHER DOG SECRET'});
 const result=S.exportPacket(a,dog),json=JSON.stringify(result.packet);for(const secret of ['PRIVATE STEP SECRET','PRIVATE JOURNAL SECRET','PRIVATE CUE SECRET','OTHER DOG SECRET','markerSound'])assert.ok(!json.includes(secret),secret);
 assert.equal(result.state.progress['SIT-1'].notes,'PRIVATE STEP SECRET');assert.equal(result.state.sessions[0].observations,'PRIVATE JOURNAL SECRET');
});
test('sharing scope cannot be confused with another dog or silently rebound after linking',()=>{
 let [a,b]=pair();b=C.addDog(b,{name:'Poppy'});const second=C.dogs(b)[1].id,packet=S.exportPacket(a,dog).packet;
 assert.throws(()=>S.mergePacket(b,second,packet,a.trainer.id),/different shared dog/);assert.throws(()=>S.approvePeer(b,dog,{id:a.trainer.id,name:'Q',mutualApproval:true},'different-dog-id'),/already linked/);
});
test('first link preserves substantial local progress and fresh trainer starts empty',()=>{
 let a=state('Quinten');for(const skill of D.skills.slice(0,10))for(const step of skill.steps)a=C.setProgress(a,step.id,C.STATUSES[3],'Legacy private note');
 let [host,guest]=pair(a,state('Abby'));[host,guest]=exchange(host,guest);assert.deepEqual(host.progress,a.progress);assert.deepEqual(guest.progress,{});assert.equal(Object.keys(S.peerProgress(guest,dog,host.trainer.id)).length,Object.keys(a.progress).length);
});
test('existing profiles on both phones retain different details as explicit conflicts',()=>{
 let a=state('Quinten'),b=state('Abby');a.profile.health='Health detail A';b.profile.health='Health detail B';[a,b]=pair(a,b);[a,b]=exchange(a,b);
 const conflict=S.profileConflicts(a,dog).find(r=>r.key==='health');assert.ok(conflict);assert.equal(a.profile.health,'Health detail A');assert.equal(b.profile.health,'Health detail B');
 a=S.write(a,dog,'profile','health','Both observations combined',{parents:heads(a,'profile','health')});[a,b]=exchange(a,b);assert.equal(a.profile.health,'Both observations combined');assert.equal(b.profile.health,'Both observations combined');assert.equal(S.profileConflicts(b,dog).length,0);
});
test('independent rule additions converge without duplicate records',()=>{
 let [a,b]=pair();a=rule(a,'Dinner');b=rule(b,'Bedtime');[a,b]=exchange(a,b);assert.equal(S.records(a,dog,'rule').length,2);assert.equal(S.records(b,dog,'rule').length,2);
 const originalOps=a.collaboration.dogs[dog].ops.length;for(let i=0;i<3;i++)[a,b]=exchange(a,b);assert.equal(a.collaboration.dogs[dog].ops.length,originalOps);
});
test('offline conflicting rule edits preserve both branches until explicit resolution',()=>{
 let [a,b]=pair();a=rule(a);[a,b]=exchange(a,b);const key=first(a,'rule').key;
 a=S.write(a,dog,'rule',key,{title:'Dinner A',description:'A'});b=S.write(b,dog,'rule',key,{title:'Dinner B',description:'B'});[a,b]=exchange(a,b);
 assert.equal(first(a,'rule').conflict,true);assert.deepEqual(new Set(first(a,'rule').versions.map(v=>v.value.description)),new Set(['A','B']));
 a=S.write(a,dog,'rule',key,{title:'Dinner agreed',description:'A and B'},{parents:heads(a,'rule',key)});[a,b]=exchange(a,b);assert.equal(first(b,'rule').value.description,'A and B');assert.equal(first(b,'rule').conflict,false);
});
test('delete tombstones survive stale packets and repeated transfers without resurrection',()=>{
 let [a,b]=pair();a=rule(a);[a,b]=exchange(a,b);const old=S.exportPacket(b,dog).packet,key=first(a,'rule').key;
 a=S.write(a,dog,'rule',key,null,{deleted:true});[a,b]=exchange(a,b);a=S.mergePacket(a,dog,old,b.trainer.id);assert.equal(first(a,'rule').deleted,true);assert.equal(first(b,'rule').deleted,true);
});
test('concurrent deletion and editing is a review conflict, never an automatic restored rule',()=>{
 let [a,b]=pair();a=rule(a);[a,b]=exchange(a,b);const key=first(a,'rule').key;
 a=S.write(a,dog,'rule',key,null,{deleted:true});b=S.write(b,dog,'rule',key,{title:'Changed offline',description:'Keep this observation'});[a,b]=exchange(a,b);const result=first(a,'rule');assert.equal(result.conflict,true);assert.equal(result.value,null);assert.ok(result.versions.some(v=>v.deleted));assert.ok(result.versions.some(v=>!v.deleted));
});
test('stale form parents cannot silently discard a newly arrived rule change',()=>{
 let [a,b]=pair();a=rule(a);[a,b]=exchange(a,b);const key=first(a,'rule').key,stale=heads(a,'rule',key);
 b=S.write(b,dog,'rule',key,{title:'New remote title',description:'Remote'});[a,b]=exchange(a,b);a=S.write(a,dog,'rule',key,{title:'Edited old form',description:'Local'},{parents:stale});assert.equal(first(a,'rule').conflict,true);
});
test('shared notes preserve separate authors and only their author can edit or delete',()=>{
 let [a,b]=pair();a=note(a,'Quinten observation');b=note(b,'Abby observation');[a,b]=exchange(a,b);assert.equal(S.records(a,dog,'note').length,2);
 const theirs=S.records(a,dog,'note').find(n=>n.owner===b.trainer.id);assert.throws(()=>S.write(a,dog,'note',theirs.key,{skill:'SIT',step:'',text:'Overwrite'}),/Only the author/);assert.throws(()=>S.write(a,dog,'note',theirs.key,null,{deleted:true}),/Only the author/);
 b=S.write(b,dog,'note',theirs.key,{skill:'SIT',step:'SIT-1',text:'Updated observation'});[a,b]=exchange(a,b);assert.equal(S.records(a,dog,'note').find(n=>n.key===theirs.key).value.text,'Updated observation');
 b=S.write(b,dog,'note',theirs.key,null,{deleted:true});[a,b]=exchange(a,b);assert.equal(S.records(a,dog,'note').find(n=>n.key===theirs.key).deleted,true);
});
test('normal profile editing while a conflict is pending preserves unseen peer branches',()=>{
 let [a,b]=pair();a=rule(a);[a,b]=exchange(a,b);a=C.updateDog(a,dog,d=>({...d,profile:{...d.profile,comfort:'A'}}));b=C.updateDog(b,dog,d=>({...d,profile:{...d.profile,comfort:'B'}}));[a,b]=exchange(a,b);
 a=C.updateDog(a,dog,d=>({...d,profile:{...d.profile,comfort:'A edited'}}));a=S.prepare(a);assert.equal(S.profileConflicts(a,dog).find(x=>x.key==='comfort').versions.length,2);
});
test('causal ordering is independent of phone clock skew',()=>{
 let [a,b]=pair();a=rule(a);[a,b]=exchange(a,b);const key=first(a,'rule').key;a=S.write(a,dog,'rule',key,{title:'Later edit',description:'Latest by ancestry'});
 for(const op of a.collaboration.dogs[dog].ops)if(op.kind==='rule'&&op.parents.length)op.at='2000-01-01T00:00:00Z';[a,b]=exchange(a,b);assert.equal(first(b,'rule').value.title,'Later edit');
});
test('duplicate operation IDs with changed contents fail atomically',()=>{
 let [a,b]=pair();a=rule(a);[a,b]=exchange(a,b);const raw=S.exportPacket(b,dog).packet;raw.ops.find(o=>o.kind==='rule').value.description='Tampered';const before=JSON.stringify(a);assert.throws(()=>S.mergePacket(a,dog,raw,b.trainer.id),/revision changed/);assert.equal(JSON.stringify(a),before);
});
test('unapproved, disconnected and mismatched senders cannot merge',()=>{
 let [a,b]=pair();const packet=S.exportPacket(b,dog).packet;assert.throws(()=>S.mergePacket(a,dog,packet,'wrong-trainer'),/not been mutually approved/);a=S.disconnect(a,dog,b.trainer.id);assert.throws(()=>S.mergePacket(a,dog,packet,b.trainer.id),/not been mutually approved/);assert.equal(S.data(a,dog).peers[b.trainer.id].lastSuccessfulSyncAt,'');
});
test('a peer cannot forge another trainer’s progress or claim a new local operation',()=>{
 let [a,b]=pair();b=C.setProgress(b,'SIT-1',C.STATUSES[3]);const packet=S.exportPacket(b,dog).packet;const op=packet.ops.find(o=>o.kind==='progress');op.actor=a.trainer.id;op.id=op.actor+':'+op.sequence;
 assert.throws(()=>S.mergePacket(a,dog,packet,b.trainer.id),/trainer identity/);
 op.actor='trainer_someone_else';op.id=op.actor+':'+op.sequence;assert.throws(()=>S.mergePacket(a,dog,packet,b.trainer.id),/another trainer/);
});
test('future app releases are accepted by protocol capability, not hard-coded app version',()=>{
 let [a,b]=pair();b=rule(b);const packet=S.exportPacket(b,dog).packet;packet.appVersion='9.0.0';packet.protocol.minor=7;assert.equal(S.records(S.mergePacket(a,dog,packet,b.trainer.id),dog,'rule').length,1);
 packet.protocol.required.push('unknown-required-feature');assert.throws(()=>S.mergePacket(a,dog,packet,b.trainer.id),/newer compatible/);packet.protocol.required=M.REQUIRED;packet.protocol.major=2;assert.throws(()=>S.mergePacket(a,dog,packet,b.trainer.id),/newer compatible/);
});
test('invalid DAG parents and cyclic/missing revisions reject without partial application',()=>{
 let [a,b]=pair();b=rule(b);const packet=S.exportPacket(b,dog).packet;const op=packet.ops.find(o=>o.kind==='rule');op.parents=['trainer_missing:1'];assert.throws(()=>S.mergePacket(a,dog,packet,b.trainer.id),/missing or invalid/);
});
test('cross-device backup recovery keeps this phone’s identity and shared-note authorship',()=>{
 let [a,b]=pair();a=note(a,'Historical author');a=C.setProgress(a,'SIT-1',C.STATUSES[3],'Recovered private note');a=S.prepare(a);const backup=C.parseBackup(JSON.stringify(C.makeBackup(a,D)));
 const recovered=S.restore(b,backup);assert.equal(recovered.trainer.id,b.trainer.id);assert.equal(recovered.progress['SIT-1'].notes,'Recovered private note');assert.equal(first(recovered,'note').owner,a.trainer.id);assert.equal(S.data(recovered,dog).peers[a.trainer.id].approved,false);assert.equal(S.data(recovered,dog).peers[b.trainer.id],undefined);
});
test('same-phone backup recovery does not reuse counters or erase newer shared revisions',()=>{
 let [a,b]=pair();a=rule(a);const backup=C.parseBackup(JSON.stringify(C.makeBackup(a,D)));const key=first(a,'rule').key;a=S.write(a,dog,'rule',key,{title:'Newer revision',description:'Keep history'});const sequence=a.trainer.sequence;
 const recovered=S.restore(a,backup);assert.ok(recovered.trainer.sequence>=sequence);assert.equal(first(recovered,'rule').value.title,'Newer revision');assert.ok(recovered.collaboration.dogs[dog].ops.length>=a.collaboration.dogs[dog].ops.length);
});
test('profile injection, unsafe actor identifiers and missing local identity are rejected',()=>{
 let a=rule(state('Quinten'));const bad=copy(a);bad.collaboration.dogs[dog].ops[0].actor='__proto__';assert.throws(()=>C.validateState(bad));const noIdentity=copy(a);noIdentity.trainer.id='';assert.throws(()=>C.validateState(noIdentity));
 const profile=copy(a);const op=profile.collaboration.dogs[dog].ops.find(o=>o.kind==='profile');op.key='__proto__';assert.throws(()=>C.validateState(profile));
});
test('interrupted or duplicate chunk delivery cannot apply partial data',async()=>{
 const [a,b]=pair();const packet=S.exportPacket(b,dog).packet;const encoded=await M.encode(packet),incoming=new M.IncomingTransfer(encoded);const before=JSON.stringify(a);
 await assert.rejects(()=>incoming.finish(),/incomplete/);assert.equal(JSON.stringify(a),before);
 for(let i=encoded.parts.length-1;i>=0;i--){incoming.add(i,encoded.parts[i]);incoming.add(i,encoded.parts[i]);}
 assert.deepEqual(await incoming.finish(),packet);assert.equal(JSON.stringify(a),before);
});
test('chunk framing preserves Unicode across large transfers and detects corruption',async()=>{
 let b=state('Abby');for(let i=0;i<12;i++)b=note(b,'🐕'.repeat(1000));const packet=S.exportPacket(b,dog).packet,encoded=await M.encode(packet);assert.ok(encoded.count>1);
 const incoming=new M.IncomingTransfer(encoded);for(let i=0;i<encoded.count;i++)incoming.add(i,encoded.parts[i]);assert.deepEqual(await incoming.finish(),packet);
 const corrupt=new M.IncomingTransfer({...encoded,sha256:'0'.repeat(64)});for(let i=0;i<encoded.count;i++)corrupt.add(i,encoded.parts[i]);await assert.rejects(()=>corrupt.finish(),/integrity/);
});
test('expired/cancelled transfers and changed duplicate chunks fail without state mutation',async()=>{
 const packet=S.exportPacket(state('Quinten'),dog).packet,e=await M.encode(packet),x=new M.IncomingTransfer(e,0);assert.throws(()=>x.add(0,e.parts[0],600001),/expired/);x.cancel();await assert.rejects(()=>x.finish(),/incomplete/);
 const y=new M.IncomingTransfer(e);y.add(0,e.parts[0]);const bytes=Uint8Array.from(Buffer.from(e.parts[0],'base64'));bytes[0]^=1;assert.throws(()=>y.add(0,Buffer.from(bytes).toString('base64')),/repeated transfer chunk changed/);
});

test('stale profile forms preserve unseen fields and retain concurrent edits for review',()=>{
 let [a,b]=pair();[a,b]=exchange(a,b);const initial=structuredClone(b.profile),parents=Object.fromEntries(M.PROFILE.map(k=>[k,S.heads(b,dog,'profile',k).map(o=>o.id)]));
 a=S.saveProfile(a,dog,{...a.profile,rewards:'Tug'},a.profile,{});b=S.mergePacket(b,dog,S.exportPacket(a,dog).packet,a.trainer.id);
 b=S.saveProfile(b,dog,{...initial,age:'Adult'},initial,parents);assert.equal(b.profile.rewards,'Tug');assert.equal(b.profile.age,'Adult');
 const old=structuredClone(b.profile),oldParents=Object.fromEntries(M.PROFILE.map(k=>[k,S.heads(b,dog,'profile',k).map(o=>o.id)]));
 a=S.saveProfile(a,dog,{...a.profile,rewards:'Sniffing'},a.profile,{});b=S.mergePacket(b,dog,S.exportPacket(a,dog).packet,a.trainer.id);
 b=S.saveProfile(b,dog,{...old,rewards:'Food'},old,oldParents);assert.equal(S.profileConflicts(b,dog).find(r=>r.key==='rewards').versions.length,2);
});
test('local and received breed changes clear only the previous breed review',()=>{
 let [a,b]=pair();[a,b]=exchange(a,b);b.profile.breed='Lagotto Romagnolo';b.tailoring.reviewedBreed='Lagotto Romagnolo';b.tailoring.traits=['noise'];b=S.prepare(b);[a,b]=exchange(a,b);
 a=S.saveProfile(a,dog,{...a.profile,breed:'Unknown'},a.profile,Object.fromEntries(M.PROFILE.map(k=>[k,S.heads(a,dog,'profile',k).map(o=>o.id)])));
 b=S.mergePacket(b,dog,S.exportPacket(a,dog).packet,a.trainer.id);assert.equal(b.profile.breed,'Unknown');assert.equal(b.tailoring.reviewedBreed,'');assert.deepEqual(b.tailoring.traits,['noise']);
 b.tailoring.reviewedBreed='Unknown';b=S.saveProfile(b,dog,{...b.profile,breed:'Whippet'},b.profile,{});assert.equal(b.tailoring.reviewedBreed,'');
});
