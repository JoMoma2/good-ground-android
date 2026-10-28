(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GroundMarker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Original synthesized sounds: no downloads, recordings, licenses or network access.
  const sounds = [
    {id:'click', name:'Click', description:'A short, crisp marker'},
    {id:'ding', name:'Soft ding', description:'A gentle bell-like tone'},
    {id:'pop', name:'Pop', description:'A small, rounded pop'},
    {id:'buzz', name:'Gentle buzz', description:'A brief, low tone'}
  ];
  function samples(id, rate=44100) {
    if (!sounds.some(s=>s.id===id)) throw new Error('Choose a marker sound.');
    const duration={click:.035,ding:.32,pop:.09,buzz:.12}[id];
    const data=new Float32Array(Math.ceil(rate*duration));
    let seed=19123,phase=0;
    for(let i=0;i<data.length;i++) {
      const t=i/rate,attack=Math.min(1,t/.002),release=Math.min(1,(duration-t)/.012);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const noise=(seed/4294967296)*2-1;
      let value;
      if(id==='click') value=noise*Math.exp(-t*160)*.8;
      if(id==='ding') value=(Math.sin(2*Math.PI*880*t)+.22*Math.sin(2*Math.PI*1760*t))*Math.exp(-t*15)*.48;
      if(id==='pop') {phase+=2*Math.PI*(620*Math.exp(-t*27))/rate;value=Math.sin(phase)*Math.exp(-t*48)*.7;}
      if(id==='buzz') value=(Math.sin(2*Math.PI*180*t)+.16*Math.sin(2*Math.PI*540*t))*Math.exp(-t*16)*.5;
      data[i]=value*attack*release;
    }
    return data;
  }
  // Set the audio policy before creating/resuming Web Audio. Supported by iOS
  // 17+; older engines retain ordinary playback and may obey Silent mode.
  function requestPlayback() {
    try {
      const session=globalThis.navigator?.audioSession;
      if(!session)return false;
      if(session.type!=='playback')session.type='playback';
      return session.type==='playback';
    } catch {return false;}
  }
  let context=null, buffers=new Map(), voices=new Set();
  async function play(id,volume=.25) {
    requestPlayback();
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Audio)throw new Error('Sound is unavailable here. Use a spoken marker or a physical clicker.');
    if(!context||context.state==='closed'){context=new Audio({latencyHint:'interactive'});buffers=new Map();}
    // Resume inside the user gesture, including after an iPhone locks or backgrounds.
    if(context.state!=='running'){
      // Never play a delayed marker after an audio unlock stalls or the app hides.
      let timeout;
      try{await Promise.race([context.resume(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Sound did not start in time. Try again before training.')),1000);})]);}
      finally{clearTimeout(timeout);}
    }
    if(globalThis.document?.hidden)throw new Error('Return to the app and try the marker again.');
    if(context.state!=='running')throw new Error('Sound could not start. Check your phone volume and try again.');
    let buffer=buffers.get(id);
    if(!buffer){const pcm=samples(id,context.sampleRate);buffer=context.createBuffer(1,pcm.length,context.sampleRate);buffer.getChannelData(0).set(pcm);buffers.set(id,buffer);}
    const source=context.createBufferSource(),gain=context.createGain();
    gain.gain.value=Math.max(0,Math.min(1,Number(volume)||0));source.buffer=buffer;
    source.connect(gain);gain.connect(context.destination);
    // Avoid stacked loudness when several family members press rapidly.
    for(const voice of voices){try{voice.stop();}catch{}}
    voices.clear();voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};
    try{source.start();}catch(error){voices.delete(source);source.disconnect();gain.disconnect();throw error;}
    return true;
  }
  return {sounds,samples,play,requestPlayback};
});
