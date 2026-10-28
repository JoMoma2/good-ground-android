// Real native/WebView checks on an explicitly selected disposable emulator.
// Run scripts/android-smoke.sh first. Only the separate .debug edition is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),serial=process.env.ANDROID_SERIAL,adb=process.env.ANDROID_HOME+'/platform-tools/adb',pkg='local.goodground.training.debug',out=root+'/build/android-validation';
assert.match(serial||'',/^emulator-\d+$/);const ad=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8'}).trim();assert.equal(ad('shell','getprop','ro.kernel.qemu'),'1');
fs.mkdirSync(out,{recursive:true});let socket,id=0;const pending=new Map(),report={checks:[],errors:[],nativeAndroidRuntimeTested:true,physicalSpeakerTested:false};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});}
async function ev(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await pause(100);}throw Error('Timed out: '+expression);}
async function connect(){
 for(let i=0;i<100;i++){
  let pid='';try{pid=ad('shell','pidof',pkg);}catch{}if(pid){ad('forward','tcp:9223','localabstract:webview_devtools_remote_'+pid);try{const pages=await (await fetch('http://127.0.0.1:9223/json/list')).json();const page=pages.find(p=>p.url.includes('appassets.androidplatform.net'));if(page){socket=new WebSocket(page.webSocketDebuggerUrl);break;}}catch{}}
  await pause(100);
 }
 assert.ok(socket);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(JSON.stringify(m.error)));else p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails.text);};
 await cdp('Runtime.enable');await until('window.GoodGround?.ready===true');await ev("document.documentElement.style.scrollBehavior='auto'");
}
async function restart(){socket?.close();socket=null;ad('shell','am','force-stop',pkg);ad('shell','am','start','-W','-f','0x10008000','-n',pkg+'/local.goodground.training.MainActivity');await connect();}
async function nav(hash){await ev("if(document.querySelector('[role=dialog]'))GoodGround.handleBack();");await ev('location.hash='+JSON.stringify(hash));const [type,page='']=hash.slice(2).split('/');await until(`document.querySelector('#main')?.dataset.route===${JSON.stringify(type)}&&document.querySelector('#main')?.dataset.pageId===${JSON.stringify(page)}`);}
async function tap(selector){
 await pause(250);
 await ev(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'});`);await pause(300);
 const point=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!document.elementFromPoint(x,y)?.closest(${JSON.stringify(selector)}))throw Error('Target is covered');return {x,y};})()`);
 await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(450);
}
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
(async()=>{
 try{
  await connect();
  // Seed only this emulator's debug store; the release app is never cleared or changed.
  await ev(`(()=>{const C=GroundCore,s=GoodGround.snapshot();s.household.setupComplete=true;s.household.tutorialSeenVersion=1;s.profile.name='Android emulator dog';s.settings.lessonMarker=true;GroundAndroid.postMessage(JSON.stringify({action:'save',state:C.storageState(C.touch(s))}));})()`);
  for(let i=0;i<50;i++){try{if(JSON.parse(ad('exec-out','run-as',pkg,'cat','no_backup/GoodGround/progress.json')).profile.name==='Android emulator dog')break;}catch{}await pause(100);}
  await restart();
  await check('Current app boots from Android private storage with every current project',async()=>{
   assert.equal(await ev('GoodGround.snapshot().profile.name'),'Android emulator dog');assert.equal(await ev('GOOD_GROUND_DATA.skills.length'),154);assert.equal(await ev('GroundCore.index(GOOD_GROUND_DATA).steps.size'),386);
   await nav('#/project/DRINK');assert.equal(await ev("document.querySelectorAll('[data-module]').length"),4);assert.equal(await ev("document.querySelectorAll('[data-foundation=PULL]').length"),1);
  });
  await check('Native Lessons opens compact topics and searches directly to Heel',async()=>{
   await nav('#/learn');assert.equal(await ev("document.querySelectorAll('.library-topic').length"),14);assert.equal(await ev("document.querySelectorAll('[data-skill-code]').length"),0);
   await tap('#learn-search');await until("document.activeElement?.id==='learn-search'");await pause(600);ad('shell','input','text','heel');await until("document.querySelector('[data-skill-code=HEEL]')!==null");assert.ok(await ev("document.querySelectorAll('[data-skill-code]').length<=12"));
   await tap('[data-skill-code=HEEL]');await until("document.querySelector('#main')?.dataset.route==='lesson'");assert.equal(await ev("document.querySelector('.lesson-title h1').textContent"),'Heel on cue');
  });
  await check('Progress and actual history save through the real Java bridge',async()=>{
   await nav('#/lesson/NAME-2');await tap('.lesson-actions [data-action="progress"]');await until("!!document.querySelector('[data-action=\"set-progress\"]')");await tap('[data-action="set-progress"][data-value="Consistent - move on"]');
   await until("GoodGround.snapshot().progress['NAME-2']?.status==='Consistent - move on'");
   for(let i=0;i<50;i++){const saved=JSON.parse(ad('exec-out','run-as',pkg,'cat','no_backup/GoodGround/progress.json'));if(saved.revision===await ev('GoodGround.snapshot().revision'))break;await pause(100);}
   const s=JSON.parse(ad('exec-out','run-as',pkg,'cat','no_backup/GoodGround/progress.json'));
   assert.equal(s.progress['NAME-2'].status,'Consistent - move on');assert.ok(s.progressHistory.length);report.savedRevision=s.revision;
  });
  await check('Hardware Back closes the progress dialog and protects a dirty profile',async()=>{
   await nav('#/lesson/NAME-2');await tap('.lesson-actions [data-action="progress"]');await until("document.querySelector('#modal-title')?.textContent==='How is this step going?'");ad('shell','input','keyevent','4');await until("!document.querySelector('[role=dialog]')");
   await nav('#/profile');await ev(`(()=>{const e=document.querySelector('[name=name]');e.value='Do not save';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
   ad('shell','input','keyevent','4');await until("!!document.querySelector('[role=dialog]')");assert.ok(await ev("document.querySelector('[role=dialog]').textContent.includes('Leave without saving')"));
   ad('shell','input','keyevent','4');await until("!document.querySelector('[role=dialog]')");assert.equal(await ev("document.querySelector('[name=name]').value"),'Do not save');
   ad('shell','input','keyevent','4');await until("!!document.querySelector('[data-action=\"discard-form\"]')");await tap('[data-action="discard-form"]');await until("document.querySelector('#main').dataset.route==='lesson'");
   assert.equal(await ev('GoodGround.snapshot().profile.name'),'Android emulator dog');
  });
  await check('Android WebView renders a nonzero marker signal from a real touch',async()=>{
   await nav('#/clicker');await ev(`(()=>{const e=document.querySelector('[name=markerSound]');e.value='ding';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await until("GoodGround.snapshot().settings.markerSound==='ding'");await ev(`(()=>{const Audio=window.AudioContext;window.__peak=0;window.__starts=0;window.AudioContext=function(...args){const ctx=new Audio(...args),a=ctx.createAnalyser();a.connect(ctx.destination);window.__audio=ctx;window.__analyser=a;const make=ctx.createGain.bind(ctx);ctx.createGain=()=>{const g=make(),connect=g.connect.bind(g);g.connect=t=>connect(t===ctx.destination?a:t);return g;};const create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=()=>{const s=create(),start=s.start.bind(s);s.start=(...a)=>{__starts++;start(...a);};return s;};return ctx;};window.__samples=new Promise(async r=>{const v=new Float32Array(2048);for(let i=0;i<1000;i++){if(window.__analyser){__analyser.getFloatTimeDomainData(v);for(const n of v)__peak=Math.max(__peak,Math.abs(n));}await new Promise(r=>setTimeout(r,4));}r(__peak);});})()`);
   await tap('[data-marker]');report.renderedMarkerPeak=await ev('__samples');assert.ok(report.renderedMarkerPeak>.001);assert.equal(await ev('__starts'),1);assert.equal(await ev('__audio.state'),'running');
  });
  await check('Hidden clicker leaves Set progress the full action-row width',async()=>{
   await nav('#/settings');if(await ev("document.querySelector('[name=lessonMarker]').checked"))await tap('[name=lessonMarker]');await tap('#settings-form button[type=submit]');await until("!document.querySelector('#settings-form select').disabled");await nav('#/lesson/NAME-2');
   assert.equal(await ev("document.querySelectorAll('[data-marker]').length"),0);
   const size=await ev(`(()=>{const e=document.querySelector('.lesson-actions [data-action=progress]'),p=e.parentElement,r=e.getBoundingClientRect(),s=p.getBoundingClientRect(),c=getComputedStyle(p);return {button:r.width,available:s.width-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight)};})()`);assert.ok(Math.abs(size.button-size.available)<3,JSON.stringify(size));
  });
  await check('Android document picker opens for native backup export',async()=>{
   await nav('#/backup');await ev("document.querySelector('[data-action=export]').click()");let ui='';for(let i=0;i<50;i++){ui=ad('shell','dumpsys','activity','activities');if(/(?:topResumedActivity|ResumedActivity)[^\n]*com.google.android.documentsui/.test(ui))break;await pause(100);}assert.match(ui,/(?:topResumedActivity|ResumedActivity)[^\n]*com.google.android.documentsui/);// The first Back may dismiss the filename keyboard; cancel the picker too.
   let returned=false;for(let i=0;i<3;i++){
    ad('shell','input','keyevent','4');await pause(350);
    const top=ad('shell','dumpsys','activity','activities');
    if(/(?:topResumedActivity|ResumedActivity)[^\n]*local\.goodground\.training\.debug/.test(top)){returned=true;break;}
   }assert.ok(returned,'Document picker cancellation returned to the app');await pause(250);
  });
  await restart();await check('Saved progress and settings survive Android process death',async()=>{
   assert.equal(await ev("GoodGround.snapshot().progress['NAME-2'].status"),'Consistent - move on');assert.equal(await ev('GoodGround.snapshot().settings.lessonMarker'),false);assert.ok(await ev('GoodGround.snapshot().progressHistory.length>0'));
  });
  await check('Daily Heel practice saves through the native bridge and survives restart without changing grades',async()=>{
   await ev(`(()=>{const C=GroundCore,D=GOOD_GROUND_DATA;let s=GoodGround.snapshot();for(const st of D.skills.find(x=>x.code==='HEEL').steps)s=C.setProgress(s,st.id,C.STATUSES[3]);GroundAndroid.postMessage(JSON.stringify({action:'save',state:C.storageState(C.touch(s))}));})()`);
   let saved=false;for(let i=0;i<50;i++){const state=JSON.parse(ad('exec-out','run-as',pkg,'cat','no_backup/GoodGround/progress.json'));if(state.progress['HEEL-4']?.status==='Consistent - move on'){saved=true;break;}await pause(100);}assert.ok(saved);
   await restart();await nav('#/practice');await until("!!document.querySelector('[data-daily-practice][data-id=\"HEEL-4\"]')");
   const before=await ev('GoodGround.snapshot().progress');await tap('[data-daily-practice][data-id="HEEL-4"]');
   await until("GoodGround.snapshot().sessions.some(s=>s.stepId==='HEEL-4'&&s.date===GroundCore.dateToday())");assert.deepEqual(await ev('GoodGround.snapshot().progress'),before);
   for(let i=0;i<50;i++){const state=JSON.parse(ad('exec-out','run-as',pkg,'cat','no_backup/GoodGround/progress.json'));if(state.sessions.some(s=>s.stepId==='HEEL-4'&&s.type==='Skill practice'))break;await pause(100);}
   await restart();await nav('#/practice');assert.ok(await ev("GoodGround.snapshot().sessions.some(s=>s.stepId==='HEEL-4'&&s.date===GroundCore.dateToday())"));assert.deepEqual(await ev('GoodGround.snapshot().progress'),before);assert.equal(await ev("document.querySelectorAll('[data-daily-practice][data-id=\"HEEL-4\"]').length"),0);
  });
  await check('Native Save and Exit persists before Back navigation; one lesson layout survives restart with clicker preference',async()=>{
   await nav('#/settings');const before=await ev('GoodGround.snapshot().progress');assert.equal(await ev("document.querySelectorAll('[name=lessonMode],[name=lessonSection]').length"),0);
   await ev("(()=>{const e=document.querySelector('[name=textSize]');e.value='large';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
   ad('shell','input','keyevent','4');await until("!!document.querySelector('[data-action=save-settings-exit]')");await tap('[data-action=save-settings-exit]');await until("document.querySelector('#main').dataset.route!=='settings'");
   const persisted=JSON.parse(ad('exec-out','run-as',pkg,'cat','no_backup/GoodGround/progress.json'));assert.equal(persisted.settings.textSize,'large');assert.equal('lessonMode' in persisted.settings,false);
   await restart();await nav('#/lesson/NAME-1');assert.equal(await ev("document.querySelector('.lesson-setup>p').textContent===GOOD_GROUND_DATA.skills[0].steps[0].setup"),true);assert.equal(await ev("document.querySelector('.extra-information').open"),false);assert.equal(await ev("document.querySelectorAll('.lesson-actions').length"),1);
   await nav('#/settings');if(await ev("document.querySelector('[name=lessonMarker]').checked"))await tap('[name=lessonMarker]');await tap('#settings-form button[type=submit]');await until("!document.querySelector('#settings-form select').disabled");await restart();await nav('#/lesson/NAME-1');assert.equal(await ev("document.querySelectorAll('.lesson-marker').length"),0);assert.equal(await ev("document.querySelectorAll('.practice-recency,#main a[href^=\"#/session/\"]').length"),0);assert.deepEqual(await ev('GoodGround.snapshot().progress'),before);
  });
  await check('Native history and category count fit the screen, and configured feedback is enabled without sending automatically',async()=>{
   await nav('#/trends');await tap('.completion-history>details>summary');assert.equal(await ev("(()=>{const e=document.querySelector('.history-table');return e.scrollWidth<=e.clientWidth+1;})()"),true);
   await nav('#/topic/Foundations');assert.equal(await ev("(()=>{const a=document.querySelector('.result-count').getBoundingClientRect(),b=document.querySelector('.library-skill').getBoundingClientRect();return a.bottom<=b.top;})()"),true);
   await nav('#/more');await tap('a[href=\"#/feedback\"]');await until("document.querySelector('#main').dataset.route==='feedback'");assert.equal(await ev("document.querySelector('#feedback-form button[type=submit]').disabled"),false);
   await ev("(()=>{const e=document.querySelector('[name=message]');e.value='Native draft only';e.dispatchEvent(new Event('input',{bubbles:true}));})()");await nav('#/more');await nav('#/feedback');assert.equal(await ev("document.querySelector('[name=message]').value"),'Native draft only');
  });
  await nav('#/learn');const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/android-catalog.png',Buffer.from(screenshot.data,'base64'));report.webView=ad('shell','dumpsys','webviewupdate').match(/Current WebView package \(name, version\): (.*)/)?.[1];report.androidRelease=ad('shell','getprop','ro.build.version.release');assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;throw e;}
 finally{fs.writeFileSync(out+'/runtime-result.json',JSON.stringify(report,null,2)+'\n');socket?.close();ad('forward','--remove','tcp:9223');}
})().catch(e=>{console.error(e);process.exitCode=1;});
