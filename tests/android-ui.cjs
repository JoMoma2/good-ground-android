// Uses the real bundled interface on Android's virtual HTTPS asset origin.
// The Java transport is simulated here; the emulator workflow tests its real implementation.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../app/web/core.js'),D=require('../app/web/data.json');
const root=path.resolve(__dirname,'..'),base='https://appassets.androidplatform.net/assets/web/';
const report={checks:[],errors:[],nativeAndroidRuntimeTested:false};
(async()=>{
 const browser=await chromium.launch({headless:true});let state=null,exported=null;
 const initial=C.freshState();initial.household.setupComplete=true;initial.household.tutorialSeenVersion=1;
 try{
  const context=await browser.newContext({viewport:{width:412,height:850},isMobile:true,hasTouch:true});
  await context.exposeBinding('javaTransport',async(_,json)=>{
   const m=JSON.parse(json);
   if(m.action==='save'){state=C.validateState(m.state);return {type:'saved',revision:state.revision};}
   if(m.action==='export'){C.parseBackup(m.json);exported=JSON.parse(m.json);return null;}
   return null;
  });
  await context.addInitScript(()=>{window.GroundAndroid={postMessage:json=>window.javaTransport(json).then(reply=>{if(reply)window.GoodGround?.nativeMessage(reply);})};});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!=='https://appassets.androidplatform.net')return route.abort();
   const file=url.pathname.slice('/assets/web/'.length);
   if(file==='native-boot.js')return route.fulfill({contentType:'text/javascript',body:'window.GOOD_GROUND_BOOT='+JSON.stringify({native:true,platform:'android',state:initial,error:null,lastRevision:0})+';'});
   if(file==='index.html'){
    let html=fs.readFileSync(root+'/app/web/index.html','utf8');
    assert.ok(html.includes('<script defer src="data.js">'));
    html=html.replace('<script defer src="data.js">','<script src="native-boot.js"></script><script defer src="data.js">');
    return route.fulfill({contentType:'text/html',body:html});
   }
   if(!['app.js','core.js','data.js','styles.css','mark.svg','marker.js','guide.js','tailoring.js','history.js','lesson-controls.js'].includes(file))return route.abort();
   return route.fulfill({path:root+'/app/web/'+file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/svg+xml'});
  });
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
  await check('Android bootstrap loads before the interface under the shipped content-security policy',async()=>{
   await p.goto(base+'index.html');await p.waitForFunction(()=>window.GoodGround?.ready);
   await p.getByRole('heading',{name:'Small steps. Better days.'}).waitFor();
   assert.equal(await p.evaluate(()=>GOOD_GROUND_BOOT.platform),'android');
  });
  await check('Android instructions describe local documents and omit iPhone-only backup controls',async()=>{
   await p.evaluate(()=>location.hash='#/backup');await p.getByText(/Android’s document picker/).waitFor();
   assert.equal(await p.getByText('On My iPhone',{exact:true}).count(),0);
   await p.evaluate(()=>location.hash='#/about');await p.getByRole('heading',{name:'On Android',exact:true}).waitFor();
   assert.equal(await p.getByRole('heading',{name:'In LiveContainer',exact:true}).count(),0);
  });
  await check('Android bridge saves profile changes and exports the shared backup format',async()=>{
   await p.evaluate(()=>location.hash='#/profile');await p.locator('[name=name]').fill('Android test dog');
   await p.getByRole('button',{name:'Save profile',exact:true}).click();
   await p.waitForFunction(()=>GoodGround.snapshot().profile.name==='Android test dog');await p.waitForTimeout(100);
   assert.equal(state.profile.name,'Android test dog');
   await p.evaluate(()=>location.hash='#/backup');await p.getByRole('button',{name:'Save backup to Files',exact:true}).click();
   await p.waitForTimeout(100);assert.equal(exported.state.profile.name,'Android test dog');assert.equal(exported.version,3);
  });
  await check('Android Back closes dialogs and guards unsaved forms',async()=>{
   await p.evaluate(()=>location.hash='#/learn');await p.waitForURL('**#/learn');
   await p.evaluate(()=>location.hash='#/profile');await p.locator('[name=name]').fill('Unsaved replacement');
   assert.equal(await p.evaluate(()=>GoodGround.handleBack()),true);
   await p.getByRole('dialog').waitFor();
   assert.equal(await p.evaluate(()=>GoodGround.handleBack()),true);assert.equal(await p.getByRole('dialog').count(),0);
   assert.equal(await p.locator('[name=name]').inputValue(),'Unsaved replacement');
   await p.evaluate(()=>GoodGround.handleBack());await p.getByRole('button',{name:'Leave without saving',exact:true}).click();
   await p.waitForURL('**#/learn');assert.equal(state.profile.name,'Android test dog');
  });
  await check('Android Back on Today allows the native activity to close',async()=>{
   await p.evaluate(()=>location.hash='#/today');await p.waitForURL('**#/today');assert.equal(await p.evaluate(()=>GoodGround.handleBack()),false);
  });
  await check('All current projects and their independent modules are present in Android',async()=>{
   assert.equal(D.skills.length,154);assert.equal(C.index(D).steps.size,386);
   for(const code of ['DRINK','SORTALL','COURIER','WALKREADY'])assert.ok(D.skills.find(s=>s.code===code),code);
  });
  await check('Android clicker produces a real nonzero audio signal on activation',async()=>{
   await p.evaluate(()=>location.hash='#/clicker');await p.locator('[data-marker]').first().waitFor();
   await p.evaluate(()=>{
    const Audio=window.AudioContext;window.__peak=0;window.__starts=0;
    window.AudioContext=function(...args){const ctx=new Audio(...args);const analyser=ctx.createAnalyser();analyser.connect(ctx.destination);window.__analyser=analyser;const gainCreate=ctx.createGain.bind(ctx);ctx.createGain=()=>{const g=gainCreate(),connect=g.connect.bind(g);g.connect=target=>connect(target===ctx.destination?analyser:target);return g;};const make=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=()=>{const s=make(),start=s.start.bind(s);s.start=(...a)=>{__starts++;start(...a);};return s;};return ctx;};
   });
   const sample=p.evaluate(async()=>{const v=new Float32Array(2048);for(let i=0;i<200;i++){if(window.__analyser){__analyser.getFloatTimeDomainData(v);for(const n of v)__peak=Math.max(__peak,Math.abs(n));}await new Promise(r=>setTimeout(r,2));}});
   await p.locator('[data-marker]').first().click();await sample;
   assert.equal(await p.evaluate(()=>__starts),1);assert.ok(await p.evaluate(()=>__peak>.001));
   report.renderedMarkerPeak=await p.evaluate(()=>__peak);report.physicalSpeakerTested=false;
  });
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;throw e;}
 finally{fs.mkdirSync(root+'/test-results',{recursive:true});fs.writeFileSync(root+'/test-results/android-ui.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
