const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),M=require('../app/web/sharing.js'),S=M.withCore(C),N=require('../app/web/nearby.js');
const dog='dog-1';
function pair(){let a=S.setTrainerName(C.freshState(),'Quinten'),b=S.setTrainerName(C.freshState(),'Abby');a.profile.name=b.profile.name='Buddy';const x=S.exportPacket(a,dog);a=x.state;b=S.approvePeer(b,dog,{id:a.trainer.id,name:'Quinten',mutualApproval:true},x.packet.dogId);a=S.approvePeer(a,dog,{id:b.trainer.id,name:'Abby',mutualApproval:true});return [a,b];}
function harness(options={}){
 const states=pair(),statuses=[[],[]],errors=[],queue=[];let blocked=false,failSave=-1,drop=()=>false;
 const clients=[0,1].map(i=>N.create({C,S,M,getState:()=>states[i],save:async s=>{if(failSave===i)throw new Error('Disk unavailable');states[i]=s;},send:async m=>{if(blocked)throw new Error('Socket closed');if(!drop(i,m)){queue.push([1-i,structuredClone(m)]);if(options.duplicates)queue.push([1-i,structuredClone(m)]);}},onStatus:s=>statuses[i].push(s),timeoutMs:options.timeoutMs||1500}));
 function open(){clients.forEach((c,i)=>c.open(dog,states[1-i].trainer.id));}open();
 async function drain(){for(let n=0;n<300;n++){await new Promise(r=>setTimeout(r,2));while(queue.length){const [i,m]=queue.shift();try{await clients[i].receive(m);}catch(e){errors.push(e);}}if(!clients.some(c=>c.status().syncing)&&!queue.length)return;}throw new Error('Exchange did not settle');}
 return {states,clients,statuses,errors,queue,drain,open,block:()=>{blocked=true;},failSave:i=>{failSave=i;},drop:f=>{drop=f;},close:()=>clients.forEach(c=>c.close())};
}
test('complete bidirectional durable exchange keeps independent step progress, rules and notes',async()=>{
 const h=harness();try{
 h.states[0]=S.prepare(C.setProgress(h.states[0],'SIT-1',C.STATUSES[3]));h.states[1]=S.prepare(C.setProgress(h.states[1],'HEEL-1',C.STATUSES[1]));
 h.states[0]=S.write(h.states[0],dog,'rule',null,{title:'Dinner',description:'Wait comfortably.'});h.states[1]=S.write(h.states[1],dog,'note',null,{skill:'SIT',step:'',text:'Stand in front.'});
 await h.clients[0].syncNow();await h.drain();assert.deepEqual(h.errors,[]);
 for(let i=0;i<2;i++){assert.equal(h.statuses[i].at(-1).phase,'synced');assert.ok(S.data(h.states[i],dog).peers[h.states[1-i].trainer.id].lastSuccessfulSyncAt);assert.equal(S.records(h.states[i],dog,'rule').length,1);assert.equal(S.records(h.states[i],dog,'note').length,1);}
 assert.equal(h.states[1].progress['SIT-1'],undefined);assert.equal(S.peerProgress(h.states[1],dog,h.states[0].trainer.id)['SIT-1'].status,C.STATUSES[3]);
 }finally{h.close();}
});
test('duplicate frames and repeated exchanges are idempotent',async()=>{const h=harness({duplicates:true});try{await h.clients[0].syncNow();await h.drain();assert.deepEqual(h.errors,[]);const count=h.states.map(s=>S.data(s,dog).ops.length);await h.clients[1].syncNow();await h.drain();assert.deepEqual(h.errors,[]);assert.deepEqual(h.states.map(s=>S.data(s,dog).ops.length),count);}finally{h.close();}});
test('simultaneous Sync Now converges on a single exchange',async()=>{const h=harness();try{await Promise.all(h.clients.map(c=>c.syncNow()));await h.drain();assert.deepEqual(h.errors,[]);assert.ok(h.statuses.every(s=>s.at(-1).phase==='synced'));}finally{h.close();}});
test('interrupted transfer never marks a successful sync and reconnect retries safely',async()=>{const h=harness();try{h.drop((i,m)=>m.kind==='chunk');await h.clients[0].syncNow();await new Promise(r=>setTimeout(r,10));while(h.queue.length){const [i,m]=h.queue.shift();await h.clients[i].receive(m);}h.close();assert.ok(h.states.every(s=>!Object.values(S.data(s,dog).peers).some(p=>p.lastSuccessfulSyncAt)));h.drop(()=>false);h.open();await h.clients[1].syncNow();await h.drain();assert.ok(h.statuses.every(s=>s.at(-1).phase==='synced'));}finally{h.close();}});
test('durable save failure cannot report success',async()=>{const h=harness();try{h.failSave(1);await h.clients[0].syncNow();await new Promise(r=>setTimeout(r,20));while(h.queue.length){const [i,m]=h.queue.shift();try{await h.clients[i].receive(m);}catch(e){h.errors.push(e);}}assert.ok(h.statuses[1].some(s=>s.phase==='error'));assert.ok(h.states.every(s=>!Object.values(S.data(s,dog).peers).some(p=>p.lastSuccessfulSyncAt)));}finally{h.close();}});
test('wrong dog, protocol version and unapproved peer fail closed',async()=>{const h=harness();try{assert.throws(()=>h.clients[0].open(dog,'trainer_'+'a'.repeat(32)),/Approve/);await assert.rejects(h.clients[0].receive({format:'good-ground-nearby',version:99,scope:'wrong',exchange:'exchange_'+'a'.repeat(32),kind:'request'}),/incompatible/);assert.equal(h.statuses[0].at(-1).phase,'error');}finally{h.close();}});
test('send failure and exchange timeout retain local records without a false sync date',async()=>{const h=harness({timeoutMs:20});try{const before=structuredClone(h.states);h.block();await assert.rejects(h.clients[0].syncNow(),/Socket closed/);assert.deepEqual(h.states,before);h.clients[0].close();h.open();h.drop(()=>true);await assert.rejects(h.clients[0].syncNow(),/Socket closed/);assert.ok(h.states.every(s=>!Object.values(S.data(s,dog).peers).some(p=>p.lastSuccessfulSyncAt)));}finally{h.close();}
 const t=harness({timeoutMs:20});try{t.drop(()=>true);await t.clients[0].syncNow();await new Promise(r=>setTimeout(r,35));assert.equal(t.statuses[0].at(-1).phase,'error');assert.match(t.statuses[0].at(-1).message,/timed out/);}finally{t.close();}
});

test('a corrupt transfer digest fails before applying its incoming dog operations',async()=>{
 const h=harness();try{
 h.states[0]=S.write(h.states[0],dog,'rule',null,{title:'Unverified incoming',description:'Must not apply after corruption.'});
 await h.clients[0].syncNow();
 for(let n=0;n<30;n++){
  await new Promise(r=>setTimeout(r,2));while(h.queue.length){const [i,m]=h.queue.shift();if(i===1&&m.kind==='manifest')m.meta.sha256='0'.repeat(64);try{await h.clients[i].receive(m);}catch(e){h.errors.push(e);}}
 }
 assert.ok(h.errors.some(e=>/integrity/.test(e.message)));assert.equal(S.records(h.states[1],dog,'rule').length,0);assert.ok(h.states.every(s=>!Object.values(S.data(s,dog).peers).some(p=>p.lastSuccessfulSyncAt)));
 }finally{h.close();}
});
