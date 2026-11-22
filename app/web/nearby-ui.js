(function(root){
  'use strict';
  function create({C,S,M,getState,save,sendNative,refresh,toast,openModal,closeModal,isBusy,link,backBar}){
    const android=window.GOOD_GROUND_BOOT?.platform==='android'||!!window.GroundAndroid;
    const E=C.esc,supported=!android&&window.GOOD_GROUND_BOOT?.nearbySupported===true;
    let dogId='',phase='idle',message='Choose a dog, then deliberately search on both phones.',devices=[],address='',pendingPair=null,connected=null,requestCounter=0;
    const pending=new Map(),logs=[];
    const state=()=>getState();
    function log(value){logs.push(new Date().toISOString()+' '+String(value).slice(0,500));if(logs.length>150)logs.shift();}
    function update(p,m){phase=p;message=m;log(p+': '+m);refresh();}
    function send(message){
      return new Promise((resolve,reject)=>{
        const requestId='nearby-'+(++requestCounter),timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('The native connection did not confirm sending this message.'));},10000);
        pending.set(requestId,{resolve,reject,timer});sendNative('nearbySend',{requestId,message});
      });
    }
    const protocol=GroundNearby.create({C,S,M,getState:state,save,send,onStatus:s=>update(s.phase,s.message)});
    function rejectPending(reason){for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error(reason));}pending.clear();}
    function view(id){
      const chosen=C.dogs(state()).find(d=>d.id===id)||C.selectedDogs(state())[0];
      if(dogId&&dogId!==chosen.id&&(connected||phase==='searching'))return `${backBar('household',chosen.id,'Household rules')}<h1>One dog at a time.</h1><p>The current nearby connection is for ${E(C.dogState(state(),dogId).profile.name||'another dog')}. Disconnect it before choosing a different dog.</p><button class="button" data-action="nearby-disconnect">Disconnect</button>`;
      dogId=chosen.id;const peer=connected?S.data(state(),dogId)?.peers[connected.id]:null;
      return `${backBar('household',dogId,'Household rules & trainers')}<div class="page-title"><span class="eyebrow">FOR ${E(chosen.profile.name||'YOUR DOG')}</span><h1>Nearby sharing.</h1><p>${android?'Nearby wireless is not implemented in this Android version. Training, household rules and authored notes work locally.':'Experimental wireless sharing. Compatibility with your two LiveContainer installations still needs physical-device testing.'}</p></div><section class="reading-card"><h2>Connection</h2><p class="nearby-status" role="status">${E(message)}</p>${supported?`${connected?`<p>Connected to <strong>${E(connected.name)}</strong>.</p><div class="button-row"><button class="button" data-action="nearby-sync" ${phase==='syncing'?'disabled':''}>${phase==='syncing'?'Synchronizing…':'Sync Now'}</button><button class="button secondary" data-action="nearby-disconnect">Disconnect</button></div>`:`<div class="button-row"><button class="button" data-action="nearby-search" ${phase==='searching'?'disabled':''}>Look for Nearby Devices</button>${phase==='searching'?'<button class="button secondary" data-action="nearby-stop">Stop searching</button>':''}</div>`}`:`<p>${android?'This Android build has no wireless transport. No discovery or synchronization is running. Your local records remain available offline.':'This build does not expose native nearby networking. Install a fresh iPhone build of 1.8 to test wireless sharing; the web preview supports local training only.'}</p>`}${peer?.lastSuccessfulSyncAt?`<p class="fineprint">Last confirmed exchange: ${E(new Date(peer.lastSuccessfulSyncAt).toLocaleString())}.</p>`:''}</section>${!state().trainer.name?`<p>${link('trainer','','Add your trainer name','text-link')} before pairing. Training alone does not require it.</p>`:''}${devices.length&&!connected?`<section class="reading-card"><h2>Available devices</h2><p class="fineprint">Only devices deliberately searching are advertised. Compare the verification code after selecting a device.</p><div class="stack">${devices.map(d=>`<button class="button secondary" data-action="nearby-connect" data-device="${E(d.id)}">${E(d.name)}</button>`).join('')}</div></section>`:''}<section class="reading-card"><h2>What this shares</h2><p>Only this dog’s profile, your step progress, household rules and authored Training Notes. Each trainer’s progress stays separate.</p><p class="fineprint">Private step notes, journal entries, cues, other dogs and device preferences stay local. Keep both apps open during an exchange. A failed or interrupted exchange can be retried.</p></section>${supported&&!connected?`<details class="reading-card"><summary>If discovery finds nothing</summary><p>LiveContainer may block the Bonjour service used for automatic discovery. On the same Wi-Fi, keep both phones searching and enter the other phone’s Wi-Fi address and port below. This uses the same encrypted connection and approval process.</p><p class="fineprint">This phone: <strong>${E(address||'Start searching to obtain an address.')}</strong></p><label class="field"><span>Other phone’s Wi-Fi address and port</span><input id="nearby-address" inputmode="text" placeholder="192.168.1.20:50123" autocomplete="off"></label><button class="button secondary" data-action="nearby-address">Connect by address</button></details>`:''}<details class="reading-card"><summary>Connection diagnostics</summary><p class="fineprint">Diagnostics describe connection stages and errors, never training-note contents or secret keys.</p><button class="button secondary" data-action="nearby-diagnostics">View diagnostics</button></details>`;
    }
    async function search(){
      if(!supported)throw new Error('A fresh native iPhone build is required for nearby networking.');
      if(!state().trainer.name)throw new Error('Add your trainer name in More → Your trainer profile before pairing.');
      const exported=S.exportPacket(state(),dogId);await save(exported.state);
      devices=[];address='';pendingPair=null;connected=null;protocol.close('Starting a deliberate discovery window.');
      sendNative('nearbyStart',{trainerId:state().trainer.id,trainerName:state().trainer.name,dogId:exported.packet.dogId});update('searching','Starting nearby discovery…');
    }
    async function action(el){
      const a=el.dataset.action;if(!a?.startsWith('nearby-'))return false;
      try{
        if(a==='nearby-search')await search();
        else if(a==='nearby-stop'){sendNative('nearbyStop');devices=[];update('idle','Discovery stopped.');}
        else if(a==='nearby-connect')sendNative('nearbyConnect',{deviceId:el.dataset.device});
        else if(a==='nearby-address'){
          const value=document.querySelector('#nearby-address')?.value.trim();sendNative('nearbyConnectAddress',{address:value||''});
        }else if(a==='nearby-approve'){
          if(!pendingPair)return true;const token=pendingPair.token;pendingPair=null;closeModal();sendNative('nearbyApprove',{token});update('approving','Waiting for approval on both phones…');
        }else if(a==='nearby-decline'){
          if(pendingPair)sendNative('nearbyDecline',{token:pendingPair.token});pendingPair=null;closeModal();
        }else if(a==='nearby-sync')await protocol.syncNow();
        else if(a==='nearby-disconnect'){sendNative('nearbyDisconnect');connected=null;protocol.close();refresh();}
        else if(a==='nearby-diagnostics')openModal('Nearby diagnostics',`<label class="field"><span>Copy these connection details if testing fails</span><textarea rows="12" readonly>${E(logs.join('\n')||'No connection attempts in this session.')}</textarea></label>`);
      }catch(error){update('error',error.message);toast(error.message,true);}
      return true;
    }
    async function event(m){
      if(!m.type?.startsWith('nearby'))return false;
      try{
        if(m.type==='nearbySent'){
          const p=pending.get(m.requestId);if(p){clearTimeout(p.timer);pending.delete(m.requestId);if(m.error)p.reject(new Error(m.error));else p.resolve();}
        }else if(m.type==='nearbyDevices'){devices=Array.isArray(m.devices)?m.devices:[];refresh();}
        else if(m.type==='nearbySearching'){address=m.address||'';update('searching','Searching for up to two minutes. Start searching on the other phone too.');}
        else if(m.type==='nearbyDiscoveryWarning'){address=m.address||address;update('searching',m.message+' You can try the same-Wi-Fi address option.');}
        else if(m.type==='nearbyPairRequest'){
          if(isBusy()){sendNative('nearbyDecline',{token:m.token});update('error','Finish editing, then try the connection again.');return true;}
          pendingPair=m;openModal('Approve this trainer?',`<p>Confirm you both selected the same dog. Connect <strong>${E(C.dogState(state(),dogId).profile.name||'this dog')}</strong> with <strong>${E(m.name)}</strong>?</p><p>Compare this code on both phones:</p><p class="verification-code">${E(m.code)}</p><p class="fineprint">Approve only if the codes match and you recognize the other trainer. No dog data is shared until both approve.</p><div class="button-row"><button class="button" data-action="nearby-approve">Codes match — approve</button><button class="button secondary" data-action="nearby-decline">Decline</button></div>`);
        }else if(m.type==='nearbyApproved'){
          const next=S.approvePeer(state(),dogId,{id:m.peerId,name:m.name,mutualApproval:true},m.dogId);await save(next);
          sendNative('nearbyBind',{token:m.token,dogId:m.dogId});update('approving','Approval saved. Waiting for the other phone’s dog link…');
        }else if(m.type==='nearbyReady'){
          pendingPair=null;connected={id:m.peerId,name:m.name};devices=[];protocol.open(dogId,m.peerId);
          if(m.initiator)await protocol.syncNow();
        }else if(m.type==='nearbyMessage')await protocol.receive(m.message);
        else if(m.type==='nearbyDisconnected'){const pairing=!!pendingPair;pendingPair=null;if(pairing)closeModal();connected=null;devices=[];rejectPending('The nearby connection closed.');protocol.close(m.message||'Disconnected. Your local records are available offline.');}
        else if(m.type==='nearbyError'){const pairing=!!pendingPair;pendingPair=null;if(pairing)closeModal();connected=null;rejectPending(m.message||'Nearby connection failed.');protocol.close();update('error',m.message||'Nearby connection failed.');}
        else if(m.type==='nearbyLog')log(m.message);
      }catch(error){rejectPending(error.message);protocol.close();sendNative('nearbyDisconnect');update('error',error.message);toast(error.message,true);}
      return true;
    }
    function forget(dog,peerId){const share=S.data(state(),dog);sendNative('nearbyForget',{peerId,dogId:share?.id||''});if(connected?.id===peerId){connected=null;protocol.close();}}
    function onRoute(type){if(type!=='nearby'&&phase==='searching'&&!connected){sendNative('nearbyStop');devices=[];phase='idle';message='Discovery stopped when you left Nearby sharing.';}}
    function modalClosed(){if(pendingPair){sendNative('nearbyDecline',{token:pendingPair.token});pendingPair=null;}}
    return {view,action,event,forget,onRoute,modalClosed,available:supported};
  }
  root.GroundNearbyUI={create};
})(typeof globalThis!=='undefined'?globalThis:this);
