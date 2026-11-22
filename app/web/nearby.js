(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroundNearby=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // A complete exchange is applied only after framing and SHA-256 verification.
  // Success requires durable application on both phones, not just socket delivery.
  function create({C,S,M,getState,save,send,onStatus=()=>{},timeoutMs=60000}){
    let session=null,active=null,lastError='';
    const emit=(phase,message)=>onStatus({phase,message,peerId:session?.peerId||'',dogId:session?.dogId||'',exchange:active?.id||''});
    const id=()=>M.newTrainer().id.replace('trainer_','exchange_');
    function cancel(){if(active){clearTimeout(active.timer);active.incoming?.cancel();active=null;}}
    function fail(error){lastError=error.message||String(error);cancel();emit('error',lastError);}
    const live=x=>active===x&&session!==null;
    async function wire(x,kind,body={}){if(!live(x))return;await send({format:'good-ground-nearby',version:1,scope:session.scope,exchange:x.id,kind,...body});}
    function start(exchange){
      cancel();const x={id:exchange,incoming:null,incomingMeta:null,sentDigest:'',receivedDigest:'',sending:false,allSent:false,localApplied:false,remoteApplied:false,completeSent:false,completeDelivered:false,remoteComplete:false,finalizing:false};
      active=x;x.timer=setTimeout(()=>{if(live(x))fail(new Error('Synchronization timed out. Your saved records are intact; reconnect and try Sync Now again.'));},timeoutMs);
      emit('syncing','Synchronizing this dog…');return x;
    }
    async function finish(x){
      if(!live(x)||!x.allSent||!x.localApplied||!x.remoteApplied)return;
      if(!x.completeSent){x.completeSent=true;await wire(x,'complete',{sent:x.sentDigest,received:x.receivedDigest});x.completeDelivered=true;}
      if(!live(x)||!x.completeDelivered||!x.remoteComplete||x.finalizing)return;
      x.finalizing=true;const {dogId,peerId}=session;
      await save(S.confirmExchange(getState(),dogId,peerId,x.sentDigest,x.receivedDigest));
      if(live(x)){cancel();lastError='';emit('synced','Exchange confirmed on both phones. Changes recorded afterward will be sent next time.');}
    }
    async function outgoing(x){
      if(!live(x)||x.sending)return;x.sending=true;
      const exported=S.exportPacket(getState(),session.dogId);await save(exported.state);
      if(!live(x))return;
      const encoded=await M.encode(exported.packet);if(!live(x))return;
      x.sentDigest=encoded.sha256;
      await wire(x,'manifest',{meta:{id:encoded.id,sha256:encoded.sha256,bytes:encoded.bytes,count:encoded.count}});
      for(let i=0;i<encoded.parts.length;i++){if(!live(x))return;await wire(x,'chunk',{index:i,part:encoded.parts[i]});}
      x.allSent=true;await finish(x);
    }
    function open(dogId,peerId){
      const share=S.data(getState(),dogId);if(!share?.peers[peerId]?.approved)throw new Error('Approve this trainer and dog before exchanging data.');
      cancel();session={dogId,peerId,scope:share.id};lastError='';emit('connected','Connected securely. Choose Sync Now to exchange this dog’s records.');
    }
    function close(message='Disconnected. Your local records are available offline.'){cancel();session=null;emit('disconnected',message);}
    async function syncNow(){
      if(!session)throw new Error('Connect to an approved nearby trainer first.');
      if(active)return false;
      const x=start(id());
      try{await wire(x,'request');await outgoing(x);return true;}catch(error){if(live(x))fail(error);throw error;}
    }
    let receiveQueue=Promise.resolve();
    function receive(message){const current=session;const task=receiveQueue.then(()=>{if(current!==session)return;return receiveOne(message);});receiveQueue=task.catch(()=>{});return task;}
    async function receiveOne(message){
      try{
        if(!session)throw new Error('No approved nearby connection is active.');
        if(!message||typeof message!=='object'||Array.isArray(message)||message.format!=='good-ground-nearby'||message.version!==1||message.scope!==session.scope||typeof message.exchange!=='string'||!/^exchange_[a-f0-9]{32}$/.test(message.exchange))throw new Error('The nearby message is incompatible or belongs to another dog.');
        if(message.kind==='request'){
          // Simultaneous requests deterministically keep the lower exchange ID.
          // Abandoned transfers are harmless because all dog operations are idempotent.
          if(active&&active.id<=message.exchange)return;
          const x=start(message.exchange);void outgoing(x).catch(error=>{if(live(x))fail(error);});return;
        }
        const x=active;if(!x||x.id!==message.exchange)return;
        if(message.kind==='manifest'){
          if(x.incomingMeta){if(JSON.stringify(x.incomingMeta)!==JSON.stringify(message.meta))throw new Error('A transfer manifest changed during the exchange.');return;}
          x.incoming=new M.IncomingTransfer(message.meta);x.incomingMeta=message.meta;x.receivedDigest=message.meta.sha256;
        }else if(message.kind==='chunk'){
          if(!x.incoming)throw new Error('A data chunk arrived without a transfer manifest.');
          if(x.localApplied)return;
          x.incoming.add(message.index,message.part);
          if(x.incoming.parts.size===x.incomingMeta.count){
            const packet=await x.incoming.finish();if(!live(x))return;
            const merged=S.mergePacket(getState(),session.dogId,packet,session.peerId);
            await save(merged);if(!live(x))return;
            x.localApplied=true;await wire(x,'applied',{digest:x.receivedDigest});await finish(x);
          }
        }else if(message.kind==='applied'){
          if(!x.sentDigest||message.digest!==x.sentDigest)throw new Error('The other phone acknowledged a different transfer.');
          x.remoteApplied=true;await finish(x);
        }else if(message.kind==='complete'){
          if(message.sent!==x.receivedDigest||message.received!==x.sentDigest)throw new Error('The final exchange acknowledgement does not match.');
          x.remoteComplete=true;await finish(x);
        }else throw new Error('The nearby message type is unsupported. Update both apps before continuing.');
      }catch(error){fail(error);throw error;}
    }
    return {open,close,syncNow,receive,status:()=>({connected:!!session,syncing:!!active,lastError,session:session?{...session}:null})};
  }
  return {create};
});
