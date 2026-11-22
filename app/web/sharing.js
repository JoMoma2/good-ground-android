(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroundSharing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Transport-independent causal records. No discovery, network connection or
  // automatic sharing is performed here. An authenticated, mutually approved
  // native transport must supply the verified peer identity before merge.
  const FORMAT='good-ground-dog-exchange',MAJOR=1,MINOR=0;
  const REQUIRED=['causal-records-v1','trainer-progress-v1','tombstones-v1'];
  const PROFILE=['name','age','breed','health','comfort','rewards','equipment','history','help'];
  const MAX_OPS=6000,MAX_PACKET_BYTES=3*1024*1024;
  const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const canonical=x=>JSON.stringify(sort(x));
  const sort=x=>Array.isArray(x)?x.map(sort):plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;
  const equal=(a,b)=>canonical(a)===canonical(b);
  const idOK=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x);
  const text=(x,n)=>typeof x==='string'&&x.length<=n;
  const timestamp=x=>text(x,100)&&Number.isFinite(Date.parse(x));
  const ordered=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
  const fail=message=>{throw new Error(message||'The shared records are incomplete or use an unsupported format. No records were changed.');};
  function uuid(prefix){
    const bytes=new Uint8Array(16);
    if(!globalThis.crypto?.getRandomValues)fail('Secure identity generation is unavailable on this device.');
    globalThis.crypto.getRandomValues(bytes);
    return prefix+'_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  const newTrainer=()=>({id:uuid('trainer'),name:'',sequence:0});
  const empty=()=>({version:1,dogs:{}});
  const scopeKey=op=>op.kind+'\0'+(['progress'].includes(op.kind)?op.actor+'\0':'')+op.key;
  function valueOK(op,statuses){
    const v=op.value;
    if(op.deleted)return v===null;
    if(op.kind==='profile')return PROFILE.includes(op.key)&&text(v,30000);
    if(op.kind==='progress')return /^[A-Z0-9_-]{1,100}$/.test(op.key)&&plain(v)&&Object.keys(v).sort().join(',')==='completedAt,status,updatedAt'&&statuses.includes(v.status)&&text(v.updatedAt,100)&&text(v.completedAt,100);
    if(op.kind==='rule')return plain(v)&&Object.keys(v).sort().join(',')==='description,title'&&text(v.title,120)&&!!v.title.trim()&&text(v.description,4000);
    if(op.kind==='note')return plain(v)&&Object.keys(v).sort().join(',')==='skill,step,text'&&/^[A-Z0-9_-]{1,100}$/.test(v.skill)&&text(v.step,100)&&(!v.step||/^[A-Z0-9_-]{1,100}$/.test(v.step))&&text(v.text,4000)&&!!v.text.trim();
    return false;
  }
  function validateOps(ops,statuses){
    if(!Array.isArray(ops)||ops.length>MAX_OPS)fail('This dog’s shared history is too large or incomplete. No records were changed.');
    const known=new Map(),noteOwners=new Map();
    for(const op of ops){
      if(!plain(op)||!idOK(op.actor)||!Number.isSafeInteger(op.sequence)||op.sequence<1||op.sequence>1e12||op.id!==op.actor+':'+op.sequence||!['profile','progress','rule','note'].includes(op.kind)||!text(op.key,100)||!op.key||!Array.isArray(op.parents)||op.parents.length>100||new Set(op.parents).size!==op.parents.length||op.parents.some(p=>!text(p,120))||typeof op.deleted!=='boolean'||!timestamp(op.at)||!valueOK(op,statuses))fail();
      if(!['profile','progress'].includes(op.kind)&&!idOK(op.key))fail();
      if(op.kind==='profile'&&(!PROFILE.includes(op.key)||op.deleted)||op.kind==='progress'&&!/^[A-Z0-9_-]{1,100}$/.test(op.key))fail();
      if(known.has(op.id))fail('A shared operation ID was duplicated. No records were changed.');
      known.set(op.id,op);
      if(op.kind==='note'){
        if(noteOwners.has(op.key)&&noteOwners.get(op.key)!==op.actor)fail('A training note cannot change its author.');
        noteOwners.set(op.key,op.actor);
      }
    }
    const indegree=new Map(),children=new Map();
    for(const op of ops){
      indegree.set(op.id,op.parents.length);
      for(const id of op.parents){
        const parent=known.get(id);
        if(!parent||scopeKey(parent)!==scopeKey(op)||parent.actor===op.actor&&parent.sequence>=op.sequence)fail('Shared history has a missing or invalid earlier revision.');
        const list=children.get(id)||[];list.push(op.id);children.set(id,list);
      }
    }
    const ready=ops.filter(op=>!op.parents.length).map(op=>op.id);let visited=0;
    for(let i=0;i<ready.length;i++){visited++;for(const id of children.get(ready[i])||[]){indegree.set(id,indegree.get(id)-1);if(!indegree.get(id))ready.push(id);}}
    if(visited!==ops.length)fail('Shared history contains a circular revision.');
    return ops.map(op=>({id:op.id,actor:op.actor,sequence:op.sequence,kind:op.kind,key:op.key,parents:op.parents.slice().sort(),value:clone(op.value),deleted:op.deleted,at:op.at})).sort(ordered);
  }
  function validate(input,base,statuses){
    const t=input.trainer===undefined?{id:'',name:'',sequence:0}:input.trainer;
    if(!plain(t)||!(t.id===''||idOK(t.id))||!text(t.name,80)||!Number.isSafeInteger(t.sequence)||t.sequence<0||t.sequence>1e12)fail('The local trainer identity is invalid. Restore a readable backup.');
    const raw=input.collaboration===undefined?empty():input.collaboration;
    if(!plain(raw)||raw.version!==1||!plain(raw.dogs)||Object.keys(raw.dogs).length>50)fail();
    const dogIds=new Set([base.household.primaryId,...base.household.others.map(d=>d.id)]),scopes=new Set(),dogs={};let sequence=t.sequence;
    for(const [dogId,rawDog] of Object.entries(raw.dogs)){
      if(!dogIds.has(dogId)||!plain(rawDog)||!idOK(rawDog.id)||scopes.has(rawDog.id)||!t.id||!plain(rawDog.peers)||Object.keys(rawDog.peers).length>30||!plain(rawDog.baseline)||!plain(rawDog.receipts||{}))fail();
      scopes.add(rawDog.id);
      const peers={};
      for(const [id,p] of Object.entries(rawDog.peers)){
        if(!idOK(id)||id===t.id||!plain(p)||!text(p.name,80)||typeof p.approved!=='boolean'||!text(p.approvedAt,100)||!text(p.lastReceivedAt,100)||!text(p.lastSuccessfulSyncAt,100))fail();
        peers[id]={name:p.name,approved:p.approved,approvedAt:p.approvedAt,lastReceivedAt:p.lastReceivedAt,lastSuccessfulSyncAt:p.lastSuccessfulSyncAt};
      }
      const baseline={};for(const key of PROFILE){const value=rawDog.baseline[key]??'';if(!text(value,30000))fail();baseline[key]=value;}
      const ops=validateOps(rawDog.ops,statuses);
      for(const op of ops)if(op.actor===t.id)sequence=Math.max(sequence,op.sequence);
      const receipts={};
      for(const [id,p] of Object.entries(rawDog.receipts||{})){
        if(!Object.hasOwn(peers,id)||!plain(p)||!text(p.received,100)||!text(p.sent,100))fail();
        receipts[id]={received:p.received,sent:p.sent};
      }
      dogs[dogId]={id:rawDog.id,peers,baseline,ops,receipts};
    }
    return {...base,trainer:{id:t.id,name:t.name,sequence},collaboration:{version:1,dogs}};
  }
  function heads(ops,kind,key,actor){
    const records=ops.filter(o=>o.kind===kind&&o.key===key&&(!actor||o.actor===actor)),parents=new Set(records.flatMap(o=>o.parents));
    return records.filter(o=>!parents.has(o.id)).sort(ordered);
  }
  function versions(ops,kind,key,actor){
    const all=heads(ops,kind,key,actor),values=[];
    for(const op of all)if(!values.some(v=>v.deleted===op.deleted&&equal(v.value,op.value)))values.push(op);
    return {heads:all,versions:values,conflict:values.length>1,deleted:values.length===1&&values[0].deleted,value:values.length===1&&!values[0].deleted?clone(values[0].value):null};
  }
  function withCore(C){
    function identity(state){return state.trainer?.id?state:C.touch({...state,trainer:newTrainer(),collaboration:state.collaboration||empty()});}
    function checked(state){const next=C.validateState(state);if(!C.withinStorageLimit(next))fail('There is not enough local storage for this change. Export a backup and shorten records before continuing.');return next;}
    function mutate(state,fn){const next=clone(identity(state));fn(next);return checked(C.touch(next));}
    function data(state,dogId){C.dogState(state,dogId);return state.collaboration?.dogs[dogId]||null;}
    function append(state,share,kind,key,value,parents,deleted=false){
      if(share.ops.length>=MAX_OPS)fail('This dog’s shared revision history is full. Export a backup; no history was discarded.');
      const sequence=++state.trainer.sequence;
      const op={id:state.trainer.id+':'+sequence,actor:state.trainer.id,sequence,kind,key,parents:parents.slice().sort(),value:deleted?null:clone(value),deleted,at:new Date().toISOString()};
      share.ops.push(op);return op;
    }
    const progressValue=entry=>({status:entry.status,updatedAt:entry.updatedAt||'',completedAt:entry.completedAt||''});
    function capture(state,dogId){
      const share=data(state,dogId);if(!share)return;
      const dog=C.dogState(state,dogId),actor=state.trainer.id;
      const keys=new Set([...Object.keys(dog.progress),...share.ops.filter(o=>o.kind==='progress'&&o.actor===actor).map(o=>o.key)]);
      for(const key of keys){
        const v=versions(share.ops,'progress',key,actor),entry=dog.progress[key],value=entry?progressValue(entry):null;
        if(entry?(!v.conflict&&equal(v.value,value)):(!v.heads.length||v.deleted))continue;
        append(state,share,'progress',key,value,v.heads.map(o=>o.id),!entry);
      }
      for(const key of PROFILE){
        const value=dog.profile[key]||'';
        if(value===share.baseline[key])continue;
        const v=versions(share.ops,'profile',key),parents=v.conflict?v.heads.filter(o=>o.actor===actor):v.heads;
        append(state,share,'profile',key,value,parents.map(o=>o.id));share.baseline[key]=value;
      }
    }
    function initialize(state,dogId){
      if(data(state,dogId))return;
      const dog=C.dogState(state,dogId),share={id:uuid('dog'),peers:{},baseline:Object.fromEntries(PROFILE.map(k=>[k,dog.profile[k]||''])),ops:[],receipts:{}};
      state.collaboration.dogs[dogId]=share;
      for(const [key,value] of Object.entries(dog.progress))append(state,share,'progress',key,progressValue(value),[]);
      for(const key of PROFILE)if(dog.profile[key])append(state,share,'profile',key,dog.profile[key],[]);
    }
    function prepare(state){
      const ready=identity(state),ids=Object.keys(ready.collaboration.dogs);
      if(!ids.length)return ready;
      const next=clone(ready),before=canonical(next.collaboration);
      for(const id of ids)capture(next,id);
      return before===canonical(next.collaboration)?ready:checked(C.touch(next));
    }
    function setTrainerName(state,name){name=String(name).trim();if(!name||name.length>80)fail('Use a trainer name of 1–80 characters.');return mutate(state,s=>{s.trainer.name=name;});}
    function records(state,dogId,kind){
      const share=data(state,dogId);if(!share)return [];
      return [...new Set(share.ops.filter(o=>o.kind===kind).map(o=>o.key))].map(key=>({key,...versions(share.ops,kind,key),owner:kind==='note'?share.ops.find(o=>o.kind==='note'&&o.key===key).actor:null}));
    }
    function write(state,dogId,kind,key,value,options={}){
      if(!['rule','note','profile'].includes(kind))fail('Choose a rule, training note or profile field.');
      return mutate(prepare(state),s=>{
        initialize(s,dogId);const share=data(s,dogId);key=key||uuid(kind);
        const old=versions(share.ops,kind,key);
        if(kind==='note'&&old.heads.some(o=>o.actor!==s.trainer.id))fail('Only the author can change or remove this training note.');
        const parents=options.parents===undefined?old.heads.map(o=>o.id):options.parents;
        if(!Array.isArray(parents)||parents.some(id=>!share.ops.some(o=>o.id===id&&o.kind===kind&&o.key===key)))fail('The earlier revision for this edit is unavailable.');
        append(s,share,kind,key,value,parents,options.deleted===true);
        if(kind==='profile'){
          if(!PROFILE.includes(key)||options.deleted)fail('Choose a supported dog-profile field.');
          const updated=profileUpdate(s,dogId,{...C.dogState(s,dogId).profile,[key]:value});Object.assign(s,updated);share.baseline[key]=value;
        }
      });
    }
    function people(state,dogId){
      const share=data(state,dogId);
      return [{id:state.trainer.id,name:state.trainer.name||'You',local:true},...Object.entries(share?.peers||{}).map(([id,p])=>({id,...p,local:false}))];
    }
    function author(state,dogId,id){return id===state.trainer.id?'You':data(state,dogId)?.peers[id]?.name||'Trainer '+id.slice(-6);}
    function peerProgress(state,dogId,id){
      const share=data(state,dogId);if(!share||id===state.trainer.id)fail('Choose another trainer to view.');
      const progress={};
      for(const key of new Set(share.ops.filter(o=>o.kind==='progress'&&o.actor===id).map(o=>o.key))){
        const v=versions(share.ops,'progress',key,id);
        if(v.value&&!v.conflict)progress[key]={...v.value,notes:''};
      }
      return progress;
    }
    function approvePeer(state,dogId,peer,sharedId){
      if(!plain(peer)||!idOK(peer.id)||peer.id===state.trainer.id||!text(peer.name,80)||peer.mutualApproval!==true)fail('Both trainers must approve the verified connection.');
      return mutate(prepare(state),s=>{
        initialize(s,dogId);const share=data(s,dogId);
        if(sharedId&&sharedId!==share.id){
          if(!idOK(sharedId)||Object.values(s.collaboration.dogs).some(d=>d!==share&&d.id===sharedId)||Object.keys(share.peers).length)fail('This dog is already linked. Do not combine different shared dogs automatically.');
          share.id=sharedId;
        }
        const old=share.peers[peer.id];share.peers[peer.id]={name:peer.name,approved:true,approvedAt:old?.approvedAt||new Date().toISOString(),lastReceivedAt:old?.lastReceivedAt||'',lastSuccessfulSyncAt:old?.lastSuccessfulSyncAt||''};
      });
    }
    function disconnect(state,dogId,peerId){return mutate(state,s=>{
      const share=data(s,dogId);if(!share?.peers[peerId])fail('Choose a connected trainer.');
      share.peers[peerId].approved=false;delete share.receipts[peerId];
    });}
    function profileUpdate(state,dogId,profile){return C.updateDog(state,dogId,d=>({...d,profile,tailoring:{...d.tailoring,reviewedBreed:d.profile.breed===profile.breed?d.tailoring.reviewedBreed:''}}));}
    function saveProfile(state,dogId,profile,initial,parentsByField){
      return mutate(prepare(state),s=>{
        const current=C.dogState(s,dogId),share=data(s,dogId),next={...profile};
        for(const field of PROFILE){
          if(initial&&profile[field]===initial[field]){next[field]=current.profile[field];continue;}
          if(!share||next[field]===current.profile[field])continue;
          const parents=parentsByField?.[field]??heads(share.ops,'profile',field).map(o=>o.id);
          if(!Array.isArray(parents)||parents.some(id=>!share.ops.some(o=>o.id===id&&o.kind==='profile'&&o.key===field)))fail('The profile revision is no longer available.');
          append(s,share,'profile',field,next[field],parents);share.baseline[field]=next[field];
        }
        Object.assign(s,profileUpdate(s,dogId,next));
      });
    }
    function confirmExchange(state,dogId,peerId,sent,received){
      if(!/^[a-f0-9]{64}$/.test(sent)||!/^[a-f0-9]{64}$/.test(received))fail('The exchange acknowledgement is invalid.');
      return mutate(state,s=>{const share=data(s,dogId),peer=share?.peers[peerId];if(!peer?.approved)fail('This trainer is disconnected.');peer.lastSuccessfulSyncAt=new Date().toISOString();share.receipts[peerId]={sent,received};});
    }
    function exportPacket(state,dogId){
      const next=mutate(prepare(state),s=>initialize(s,dogId)),share=data(next,dogId);
      // Direct relationships only. Another person's private progress or authored
      // notes are not forwarded by an intermediary. Shared rule/profile revisions
      // carry their causal history so concurrent edits can still be resolved.
      const ops=share.ops.filter(o=>['profile','rule'].includes(o.kind)||o.actor===next.trainer.id);
      const packet={format:FORMAT,protocol:{major:MAJOR,minor:MINOR,required:REQUIRED.slice()},sender:{id:next.trainer.id,name:next.trainer.name||'Trainer'},dogId:share.id,ops:clone(ops)};
      if(new TextEncoder().encode(JSON.stringify(packet)).length>MAX_PACKET_BYTES)fail('This dog’s exchange exceeds the safe transfer size. No records were sent.');
      return {state:next,packet};
    }
    function validatePacket(packet){
      if(!plain(packet)||packet.format!==FORMAT||!plain(packet.protocol)||packet.protocol.major!==MAJOR||!Number.isInteger(packet.protocol.minor)||packet.protocol.minor<0||!Array.isArray(packet.protocol.required)||packet.protocol.required.length>20||packet.protocol.required.some(c=>!REQUIRED.includes(c)))fail('This exchange needs a newer compatible Good Ground format. Update before sharing.');
      if(!plain(packet.sender)||!idOK(packet.sender.id)||!text(packet.sender.name,80)||!idOK(packet.dogId))fail();
      if(new TextEncoder().encode(JSON.stringify(packet)).length>MAX_PACKET_BYTES)fail('The incoming dog exchange is too large.');
      return {...packet,ops:validateOps(packet.ops,C.STATUSES)};
    }
    function mergePacket(state,dogId,raw,verifiedPeerId){
      const packet=validatePacket(raw),ready=prepare(state),share=data(ready,dogId);
      if(!share||share.id!==packet.dogId)fail('This exchange belongs to a different shared dog.');
      if(packet.sender.id!==verifiedPeerId||!share.peers[verifiedPeerId]?.approved)fail('The sending trainer has not been mutually approved for this dog.');
      const known=new Map(share.ops.map(o=>[o.id,o]));let added=0;
      for(const op of packet.ops){
        const old=known.get(op.id);
        if(old){if(!equal(old,op))fail('A previously received revision changed. No data was merged.');continue;}
        if(op.actor===ready.trainer.id)fail('Another device is using this phone’s trainer identity. Re-establish separate identities before sharing.');
        if(['progress','note'].includes(op.kind)&&op.actor!==verifiedPeerId)fail('A trainer cannot submit another trainer’s progress or training notes.');
        known.set(op.id,op);added++;
      }
      const ops=validateOps([...known.values()],C.STATUSES);
      if(!added&&share.peers[verifiedPeerId].name===packet.sender.name)return ready;
      return mutate(ready,s=>{
        const target=data(s,dogId);target.ops=ops;target.peers[verifiedPeerId].name=packet.sender.name;target.peers[verifiedPeerId].lastReceivedAt=new Date().toISOString();
        target.receipts[verifiedPeerId]={received:'pending-acknowledgement',sent:''};
        let profile={...C.dogState(s,dogId).profile};
        for(const field of PROFILE){
          const v=versions(ops,'profile',field);
          if(v.value!==null&&!v.conflict&&!v.deleted)profile[field]=v.value;
          target.baseline[field]=profile[field]||'';
        }
        Object.assign(s,profileUpdate(s,dogId,profile));
      });
    }
    function restore(state,backup){
      const current=identity(state),incoming=C.validateState(backup),next=clone(incoming);
      next.trainer={...current.trainer,name:current.trainer.name||incoming.trainer.name,sequence:Math.max(current.trainer.sequence,incoming.trainer.id===current.trainer.id?incoming.trainer.sequence:0)};
      // Full backup recovery is explicit, unlike a dog exchange. Keep this
      // phone's identity; recover its selected local records without rewriting
      // historical shared-note authors. Trust must be re-established on a new phone.
      for(const [id,share] of Object.entries(next.collaboration.dogs)){
        const old=Object.values(current.collaboration.dogs).find(d=>d.id===share.id);
        if(old){const ops=new Map(old.ops.map(o=>[o.id,o]));for(const op of share.ops){if(ops.has(op.id)&&!equal(ops.get(op.id),op))fail('The backup conflicts with an immutable shared revision.');ops.set(op.id,op);}share.ops=[...ops.values()];}
        if(incoming.trainer.id!==current.trainer.id){
          delete share.peers[current.trainer.id];
          if(idOK(incoming.trainer.id)&&share.ops.some(o=>o.actor===incoming.trainer.id))share.peers[incoming.trainer.id]={name:incoming.trainer.name||'Previous trainer',approved:false,approvedAt:'',lastReceivedAt:'',lastSuccessfulSyncAt:''};
          for(const peer of Object.values(share.peers))peer.approved=false;share.receipts={};
        }
        for(const op of share.ops)if(op.actor===current.trainer.id)next.trainer.sequence=Math.max(next.trainer.sequence,op.sequence);
      }
      return prepare(checked(next));
    }
    return {identity,prepare,setTrainerName,data,records,write,people,author,peerProgress,approvePeer,disconnect,saveProfile,confirmExchange,exportPacket,mergePacket,validatePacket,restore,
      heads:(state,dogId,kind,key,actor)=>heads(data(state,dogId)?.ops||[],kind,key,actor),
      profileConflicts:(state,dogId)=>records(state,dogId,'profile').filter(r=>r.conflict)};
  }
  async function digest(bytes){if(!globalThis.crypto?.subtle)fail('Secure transfer checks are unavailable.');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
  const to64=bytes=>btoa(String.fromCharCode(...bytes));
  function from64(value){if(!text(value,24000)||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))fail('A transfer chunk is invalid.');return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
  async function encode(packet){
    const bytes=new TextEncoder().encode(JSON.stringify(packet));if(bytes.length>MAX_PACKET_BYTES)fail('The dog exchange is too large.');
    const parts=[];for(let i=0;i<bytes.length;i+=16384)parts.push(to64(bytes.slice(i,i+16384)));
    return {id:uuid('transfer'),sha256:await digest(bytes),bytes:bytes.length,count:parts.length,parts};
  }
  class IncomingTransfer {
    constructor(meta,now=Date.now()){
      if(!plain(meta)||!idOK(meta.id)||!Number.isInteger(meta.bytes)||meta.bytes<1||meta.bytes>MAX_PACKET_BYTES||!Number.isInteger(meta.count)||meta.count<1||meta.count>192||meta.count!==Math.ceil(meta.bytes/16384)||!text(meta.sha256,64)||!/^[0-9a-f]{64}$/.test(meta.sha256))fail('Transfer metadata is invalid.');
      this.meta={id:meta.id,bytes:meta.bytes,count:meta.count,sha256:meta.sha256};this.parts=new Map();this.started=now;this.closed=false;
    }
    add(index,value,now=Date.now()){
      if(this.closed||now-this.started>600000)fail('The incomplete transfer expired. Start a new exchange.');
      if(!Number.isInteger(index)||index<0||index>=this.meta.count)fail('A transfer chunk index is invalid.');
      const bytes=from64(value),expected=index===this.meta.count-1?this.meta.bytes-index*16384:16384;
      if(bytes.length!==expected)fail('A transfer chunk has the wrong size.');
      if(this.parts.has(index)&&this.parts.get(index).encoded!==value)fail('A repeated transfer chunk changed.');
      this.parts.set(index,{encoded:value,bytes});return this.parts.size;
    }
    cancel(){this.parts.clear();this.closed=true;}
    async finish(now=Date.now()){
      if(this.closed||now-this.started>600000||this.parts.size!==this.meta.count)fail('The transfer is incomplete. No dog records have been applied.');
      const bytes=new Uint8Array(this.meta.bytes);let offset=0;
      for(let i=0;i<this.meta.count;i++){const part=this.parts.get(i).bytes;bytes.set(part,offset);offset+=part.length;}
      if(await digest(bytes)!==this.meta.sha256)fail('The transfer integrity check failed. No records were changed.');
      let packet;try{packet=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('The transferred data is not valid JSON.');}
      this.cancel();return packet;
    }
  }
  return {newTrainer,empty,validate,withCore,encode,IncomingTransfer,FORMAT,MAJOR,MINOR,REQUIRED,PROFILE,MAX_PACKET_BYTES};
});
