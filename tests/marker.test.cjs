const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise stalled audio unlocks without waiting a real second or accepting late markers.
function harness(){
 let starts=0,resume,clock;const doc={hidden:false};
 const audio={state:'suspended',sampleRate:44100,resume:()=>new Promise(resolve=>{resume=()=>{audio.state='running';resolve();};}),createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:()=>({connect(){},disconnect(){},stop(){},start(){starts++;}}),createGain:()=>({gain:{},connect(){},disconnect(){}}),destination:{}};
 const sandbox={module:{exports:{}},document:doc,AudioContext:function(){return audio;},setTimeout:fn=>{clock=fn;return 1;},clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../app/web/marker.js','utf8'),sandbox);
 return {play:sandbox.module.exports.play,doc,audio,starts:()=>starts,resume:()=>resume(),expire:()=>clock()};
}
test('an audio unlock timeout cannot schedule a stale marker after resume eventually succeeds',async()=>{
 const h=harness(),pending=h.play('click');h.expire();await assert.rejects(pending,/did not start in time/);h.resume();await Promise.resolve();assert.equal(h.starts(),0);
 await h.play('click');assert.equal(h.starts(),1);
});
test('backgrounding during audio unlock cannot play an unattended marker',async()=>{
 const h=harness(),pending=h.play('ding');h.doc.hidden=true;h.resume();await assert.rejects(pending,/Return to the app/);assert.equal(h.starts(),0);
 h.doc.hidden=false;await h.play('ding');assert.equal(h.starts(),1);
});

test('Silent-mode playback is requested before constructing the audio context',async()=>{
 const events=[],audio={state:'running',sampleRate:44100,createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:()=>({connect(){},disconnect(){},stop(){},start(){events.push('start');}}),createGain:()=>({gain:{},connect(){},disconnect(){}}),destination:{}};
 let type='ambient';const session={get type(){return type;},set type(value){events.push(value);type=value;}};
 const sandbox={module:{exports:{}},navigator:{audioSession:session},document:{hidden:false},AudioContext:function(){events.push('context');assert.equal(type,'playback');return audio;},setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../app/web/marker.js','utf8'),sandbox);
 await sandbox.module.exports.play('ding');assert.deepEqual(events,['playback','context','start']);
 type='ambient';await sandbox.module.exports.play('click');assert.equal(type,'playback');
});
test('unsupported or rejected audio-session policies do not prevent ordinary playback',()=>{
 for(const navigator of [{},{audioSession:{get type(){return 'ambient';},set type(_){throw new Error('Unsupported');}}}]){
  const sandbox={module:{exports:{}},navigator,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(__dirname+'/../app/web/marker.js','utf8'),sandbox);
  assert.equal(sandbox.module.exports.requestPlayback(),false);
 }
});
