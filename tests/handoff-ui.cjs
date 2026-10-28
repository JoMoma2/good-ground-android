// Focused acceptance checks for the development handoff using real Web Audio.
const {chromium,webkit,firefox}=require('playwright');
const {AxeBuilder}=require('@axe-core/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),web=process.env.GG_WEB_ROOT||root+'/app/web',C=require(web+'/core.js'),D=require(web+'/data.json'),engine=process.env.GG_BROWSER||'chromium';
const report={engine,webRoot:web,checks:[],errors:[],externalRequests:[],nativeRuntimeTested:false};
async function main(){
 const browser=await ({chromium,webkit,firefox}[engine]).launch({headless:true});let context,page;
 const out=root+'/test-results';fs.mkdirSync(out,{recursive:true});
 const fresh=()=>{const s=C.freshState();s.settings.lessonMode='detailed';s.household.setupComplete=true;s.household.tutorialSeenVersion=1;s.profile.name='Molly';return s;};
 async function boot(s=fresh(),hash='#/lesson/NAME-1'){
  if(context)await context.close();context=await browser.newContext({viewport:{width:390,height:844},isMobile:engine!=='firefox',hasTouch:true});
  await context.addInitScript(state=>{
   window.GOOD_GROUND_BOOT={native:true,state,error:null,smoke:false};window.__saved=state;
   window.webkit={messageHandlers:{ground:{postMessage:m=>{if(m.action==='save'){window.__saved=m.state;queueMicrotask(()=>GoodGround.nativeMessage({type:'saved',revision:m.state.revision}));}}}}};
   window.__starts=0;const Audio=window.AudioContext||window.webkitAudioContext;
   if(Audio)window.AudioContext=function(...args){const ctx=new Audio(...args);window.__audio=ctx;const analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.connect(ctx.destination);window.__analyser=analyser;const gainCreate=ctx.createGain.bind(ctx);ctx.createGain=()=>{const g=gainCreate(),connect=g.connect.bind(g);g.connect=target=>connect(target===ctx.destination?analyser:target);return g;};const create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(...args)=>{window.__starts++;start(...args);};return source;};return ctx;};
  },s);
  page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));
  await page.route('http{,s}://**',route=>{report.externalRequests.push(route.request().url());return route.abort();});
  await page.goto(pathToFileURL(web+'/index.html').href+hash);await page.waitForFunction(()=>GoodGround?.ready);
 }
 const snap=()=>page.evaluate(()=>GoodGround.snapshot());
 async function nav(hash){await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(h=>{const [type,id='']=h.replace('#/','').split('/'),main=document.querySelector('#main');return main?.dataset.route===type&&main?.dataset.pageId===decodeURIComponent(id);},hash);}
 async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
 try{
  await check('lesson marker gives immediate visible and readable feedback, exactly once per activation',async()=>{
   await boot();const marker=page.locator('.lesson-marker [data-marker]');
   await marker.tap();await page.waitForFunction(()=>window.__starts===1);
   assert.equal(await page.locator('#marker-feedback').textContent(),'Marked. Reward now.');
   assert.equal(await marker.locator('[data-marker-label]').textContent(),'Marked!');
   for(let i=0;i<8;i++)await marker.tap();assert.equal(await page.evaluate(()=>__starts),9);
   await marker.focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');
   await page.waitForFunction(()=>__starts===11);assert.equal((await snap()).sessions.length,0);assert.deepEqual((await snap()).progress,{});
   await page.screenshot({path:out+'/handoff-lesson-'+engine+'.png',fullPage:true});
  });
  await check('a real audio graph carries a nonzero ding signal after the marker gain',async()=>{
   const signal=await page.evaluate(async()=>{
    const values=new Float32Array(1024);let peak=0;
    const playback=GroundMarker.play('ding',.5);
    for(let i=0;i<80;i++){window.__analyser.getFloatTimeDomainData(values);for(const v of values)peak=Math.max(peak,Math.abs(v));await new Promise(r=>setTimeout(r,2));}
    await playback;return {peak,session:navigator.audioSession?.type||'unsupported',context:__audio.state};
   });assert.ok(signal.peak>.001,JSON.stringify(signal));assert.equal(signal.context,'running');if(signal.session!=='unsupported')assert.equal(signal.session,'playback');
   report.renderedDingPeak=signal.peak;report.audioSession=signal.session;report.physicalSpeakerTested=false;
  });
  await check('holding Enter or Space marks on keydown once, without marking while typing in fields',async()=>{
   const marker=page.locator('.lesson-marker [data-marker]');await marker.focus();
   for(const key of ['Enter','Space']){
    const before=await page.evaluate(()=>__starts);await page.keyboard.down(key);await page.waitForFunction(n=>__starts===n,before+1);
    for(let i=0;i<4;i++)await page.keyboard.down(key);assert.equal(await page.evaluate(()=>__starts),before+1);
    await page.keyboard.up(key);assert.equal(await page.evaluate(()=>__starts),before+1);
   }
   const before=await page.evaluate(()=>__starts);await page.locator('[data-cue-input]').fill('Molly come');assert.equal(await page.evaluate(()=>__starts),before);
  });
  await check('one floating control group docks after the criterion without covering navigation or trapping content',async()=>{
   report.lessonControls=[];
   for(const marker of [true,false]){
    const state=fresh();state.settings.lessonMarker=marker;await boot(state,'#/lesson/VISITOR-4');const controls=page.locator('.lesson-actions');
    for(const safeBottom of ['0px','34px']){
     await page.evaluate(value=>document.documentElement.style.setProperty('--safe-bottom',value),safeBottom);
     for(const dimensions of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
      await page.setViewportSize(dimensions);for(const text of ['normal','large']){
       await page.evaluate(t=>{document.documentElement.dataset.text=t;scrollTo({top:0,behavior:'instant'});},text);
       await page.waitForFunction(()=>document.querySelector('.lesson-actions').classList.contains('is-floating'));
       assert.equal(await controls.evaluate(e=>getComputedStyle(e).position),'fixed');assert.equal(await controls.count(),1);
       const floating=await controls.boundingBox(),nav=await page.locator('.tab-bar').boundingBox();assert.ok(floating.y>=0&&floating.y+floating.height<=nav.y-7,JSON.stringify({dimensions,text,marker,safeBottom,floating,nav}));
       await page.locator('.lesson-actions-slot').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.lesson-actions').dataset.docked==='true');
       const box=await controls.boundingBox(),bar=await page.locator('.tab-bar').boundingBox(),slot=await page.locator('.lesson-actions-slot').boundingBox();const geometry={marker,safeBottom,dimensions,text,box,bar,floating};
       assert.ok(box.y>=0&&box.y+box.height<=bar.y,JSON.stringify(geometry));assert.ok(Math.abs(slot.y-box.y)<1);assert.equal(await controls.evaluate(e=>getComputedStyle(e).position),'static');assert.equal(await page.locator('.lesson-marker [data-marker]').count(),marker?1:0);
       if(!marker)assert.ok(await controls.evaluate(e=>e.querySelector('button').getBoundingClientRect().width>=e.clientWidth-24));
       const targets=await controls.locator('button,a').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {label:el.textContent,reachable:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));assert.ok(targets.every(t=>t.reachable),JSON.stringify({geometry,targets}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.lessonControls.push(geometry);
      }
     }
    }
   }
   await page.evaluate(()=>document.documentElement.style.removeProperty('--safe-bottom'));await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Set progress',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  });
  await check('Settings can hide and restore the lesson marker, preserving the preference through backup',async()=>{
   await nav('#/settings');await page.locator('[name="lessonMarker"]').uncheck();await page.getByRole('button',{name:'Save settings',exact:true}).click();
   const hidden=await snap();assert.equal(C.parseBackup(JSON.stringify(C.makeBackup(hidden,D))).settings.lessonMarker,false);
   await boot(hidden);assert.equal(await page.locator('.lesson-marker').count(),0);assert.equal(await page.getByRole('link',{name:'Open clicker',exact:true}).count(),0);const progress=await page.getByRole('button',{name:'Set progress',exact:true}).boundingBox(),bar=await page.locator('.lesson-actions').boundingBox();assert.ok(progress.width>=bar.width-24,'Hidden marker must give Set progress the full row');await nav('#/learn');assert.equal(await page.locator('.training-tools a[href^="\#\/clicker"]').count(),0);
   await nav('#/settings');await page.locator('[name="lessonMarker"]').check();await page.getByRole('button',{name:'Save settings',exact:true}).click();await nav('#/lesson/NAME-1');assert.equal(await page.locator('.lesson-marker').count(),1);
  });
  await check('muted and unavailable audio show an error rather than false success or practice',async()=>{
   const s=fresh();s.settings.markerVolume=0;await boot(s);await page.locator('[data-marker]').tap();assert.ok((await page.locator('#marker-feedback').textContent()).includes('muted'));assert.equal(await page.evaluate(()=>__starts),0);
   await boot();await page.evaluate(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await page.locator('[data-marker]').tap();await page.waitForFunction(()=>document.querySelector('#marker-feedback').classList.contains('sound-error'));assert.ok((await page.locator('#marker-feedback').textContent()).includes('unavailable'));assert.ok(page.url().endsWith('#/lesson/NAME-1'),'An error reflow must not turn a marker release into navigation');assert.equal(await page.evaluate(()=>__starts),0);assert.equal((await snap()).sessions.length,0);
  });
  await check('clicker current-step criteria expand separately and training tools live under Lessons',async()=>{
   await boot();await page.getByRole('link',{name:'Open clicker',exact:true}).click();await page.locator('.marker-pad').waitFor();
   const criteria=page.locator('.marker-lesson details');assert.equal(await criteria.count(),2);
   await criteria.nth(0).locator('summary').click();assert.equal(await criteria.nth(0).getAttribute('open'),'');assert.equal(await criteria.nth(1).getAttribute('open'),null);
   await nav('#/learn');assert.equal(await page.locator('.training-tools a').count(),4);assert.equal(await page.locator('.tab-bar a').count(),4);
   assert.equal(await page.locator('.tab.active').textContent(),'Lessons');
   assert.equal(await page.locator('.library-topic').count(),14);assert.equal(await page.locator('#learn-results .lesson-card').count(),0);
   await page.locator('#learn-search').fill('NAME-1');assert.equal(await page.locator('#learn-results .lesson-card').getAttribute('href'),'#/lesson/NAME-1');
   await nav('#/more');assert.equal(await page.locator('.menu-row').count(),6);
   await page.getByRole('link',{name:/Source library/}).click();await page.getByRole('link',{name:'Evidence & limitations',exact:true}).waitFor();
  });
  await check('larger text scales headings, labels, controls and body text throughout the app',async()=>{
   await boot();for(const hash of ['#/lesson/NAME-1','#/settings','#/more','#/sources']){
    await nav(hash);const measure=()=>page.locator('h1,.button,.back-link,.eyebrow,.field>span,.menu-row strong,.source-card h3,.teaching-copy p').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().height>0).map(e=>parseFloat(getComputedStyle(e).fontSize)));
    await page.evaluate(()=>document.documentElement.dataset.text='normal');const normal=await measure();await page.evaluate(()=>document.documentElement.dataset.text='large');const large=await measure();
    assert.equal(normal.length,large.length);normal.forEach((size,i)=>assert.ok(large[i]>size,hash+' text did not grow: '+size));
   }
  });
  await check('dog names update default name cues while explicit custom cues survive renames',async()=>{
   await boot();assert.equal(await page.locator('[data-cue-input]').inputValue(),'Molly');
   await page.locator('[data-cue-input]').fill('');await page.locator('[data-cue-input]').blur();assert.equal(await page.locator('[data-cue-input]').inputValue(),'Molly');assert.equal((await snap()).cues.NAME,undefined);
   await nav('#/profile');await page.locator('[name="name"]').fill('Poppy');await page.getByRole('button',{name:'Save profile',exact:true}).click();await nav('#/lesson/NAME-1');assert.equal(await page.locator('[data-cue-input]').inputValue(),'Poppy');
   await page.locator('[data-cue-input]').fill('Pops');await page.locator('[data-cue-input]').blur();await nav('#/profile');await page.locator('[name="name"]').fill('Poppy II');await page.getByRole('button',{name:'Save profile',exact:true}).click();await nav('#/lesson/NAME-1');assert.equal(await page.locator('[data-cue-input]').inputValue(),'Pops');
  });
  await check('profile changes update relevant practice pieces; completed starting points disappear',async()=>{
   const s=fresh();s.tailoring.traits=['noise'];await boot(s,'#/lesson/SOUND-1');assert.equal(await page.locator('.tailored-teaching li').count(),3);assert.equal(await page.locator('.tailored-setup').count(),0);
   await nav('#/lesson/SIT-1');assert.equal(await page.locator('.tailored-teaching').count(),0);
   for(const id of D.skills.filter(x=>['SAFE','SOUND','STORM'].includes(x.code)).flatMap(x=>x.steps.map(st=>st.id)))s.progress[id]={status:C.STATUSES[3],notes:'',updatedAt:new Date().toISOString()};await boot(s,'#/today');assert.equal(await page.locator('.tailored-today').count(),0);
   await nav('#/profile');await page.locator('.support-fields summary').click();await page.locator('[name="trait"][value="noise"]').uncheck();await page.getByRole('button',{name:'Save profile',exact:true}).click();await nav('#/lesson/SOUND-1');assert.equal(await page.locator('.tailored-teaching').count(),0);
  });
  await check('changing breed through Unknown reopens a relevant check while unrelated edits do not',async()=>{
   const s=fresh();s.profile.breed='Lagotto Romagnolo';s.tailoring.reviewedBreed=s.profile.breed;await boot(s,'#/profile');
   await page.locator('[name="rewards"]').fill('A little tug game');await page.getByRole('button',{name:'Save profile',exact:true}).click();await nav('#/today');assert.equal(await page.getByRole('dialog').count(),0);
   const selectBreed=async(name)=>{await nav('#/profile');await page.locator('[data-action="choose-breed"]').click();await page.locator('#breed-search').fill(name);await page.locator('[data-action="pick-breed"]').filter({hasText:name}).first().click();await page.getByRole('button',{name:'Save profile',exact:true}).click();};
   await selectBreed('Unknown');await nav('#/today');assert.equal((await snap()).tailoring.reviewedBreed,'');
   await selectBreed('Lagotto Romagnolo');await page.getByRole('heading',{name:'Does this fit Molly?',exact:true}).waitFor();assert.deepEqual((await snap()).tailoring.traits,[]);
   await page.getByRole('button',{name:'Yes, that fits',exact:true}).click();await nav('#/lesson/SOUND-1');assert.equal(await page.locator('.tailored-teaching').count(),1);
  });
  await check('eight advanced projects appear last; legacy fridge routes and component cues survive',async()=>{
   const s=fresh();s.cues.OPEN='Fridge please';s.cues.CLOSE='Shut';s.cues.DRINK='A drink';
   await boot(s,'#/learn');assert.equal(await page.locator('.library-topic').last().getAttribute('href'),'#/topic/Brainiacs');assert.equal(await page.locator('#learn-results .lesson-card').count(),0);
   await nav('#/topic/Fridge%20task');assert.equal(await page.getByRole('heading',{name:'Brainiacs',exact:true}).count(),1);
   await nav('#/lesson/OPEN-4');assert.equal(await page.locator('[data-lesson-section=steps] .lesson-step-list a').count(),3);assert.equal(await page.locator('[data-cue-input]').inputValue(),'Fridge please');
   await nav('#/lesson/CLOSE-1');assert.equal(await page.locator('[data-cue-input]').inputValue(),'Shut');await page.locator('[data-cue-input]').fill('Close gently');await page.locator('[data-cue-input]').blur();assert.equal((await snap()).cues.CLOSE,'Close gently');
   await nav('#/lesson/DRINK-8');assert.equal(await page.locator('[data-cue-input]').inputValue(),'A drink');
   await nav('#/learn');await page.locator('#learn-search').fill('SHELF-2');assert.equal(await page.locator('#learn-results .lesson-card').first().getAttribute('href'),'#/lesson/SHELF-2');
   await nav('#/project/DRINK');assert.equal(await page.locator('[data-module]').count(),4);await page.locator('[data-module=OPEN] summary').click();assert.equal(await page.locator('[data-module=OPEN] a').count(),3);
   await nav('#/topic/Play%20and%20jobs');assert.equal(await page.getByRole('heading',{name:'Tug a rope handle',exact:true}).count(),1);
  });
  await check('foundations stay first while separate trouble-spot suggestions refresh with profile edits',async()=>{
   const s=fresh();s.profile.priorities=['Other dogs'];await boot(s,'#/today');
   const expected=C.startingAvailable(D,s).slice(0,3).map(x=>'#/lesson/'+x.step.id);
   assert.deepEqual(await page.locator('#main>.stack>.lesson-card').evaluateAll(els=>els.slice(0,3).map(el=>el.getAttribute('href'))),expected);
   const tailored=page.locator('.trouble-spots');await tailored.locator('summary').click();assert.ok((await tailored.textContent()).includes('Other dogs'));
   await nav('#/profile');await page.locator('[name="priority"][value="Other dogs"]').uncheck();await page.getByRole('button',{name:'Save profile',exact:true}).click();await nav('#/today');assert.equal(await page.locator('.trouble-spots').count(),0);
  });
  await check('breed search uses at least 16px without restricting viewport zoom; practice link focuses its section',async()=>{
   await boot(fresh(),'#/profile');await page.locator('[data-action="choose-breed"]').click();
   assert.ok(await page.locator('#breed-search').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
   assert.ok(!/maximum-scale|user-scalable=no/.test(await page.locator('meta[name="viewport"]').getAttribute('content')));await page.getByRole('button',{name:'Close dialog',exact:true}).click();
   await nav('#/practice');await page.getByRole('link',{name:'How practice reminders work',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.id==='practice-rhythms');
   const box=await page.locator('#practice-rhythms').boundingBox();assert.ok(box.y<600&&box.y+box.height>0);
  });
  await check('historical category lines use real dated snapshots, allow overlapping 100%, and provide a usable legend',async()=>{
   let s=fresh();s=C.observeProgress(D,s,new Date('2026-10-01T12:00:00'));
   for(const skill of D.skills)for(const st of skill.steps)s=C.setProgress(s,st.id,C.STATUSES[3]);
   s=C.observeProgress(D,s,new Date('2026-10-05T12:00:00'));await boot(s,'#/trends');
   const lines=page.locator('[data-history-series]');assert.equal(await lines.count(),new Set(D.skills.map(x=>x.sheet)).size);
   assert.ok(await page.locator('.topic-progress').isVisible());const first=lines.first();assert.match(await first.locator('path').getAttribute('d'),/V34H344$/);
   const toggle=page.locator('[data-history-toggle]').first();await toggle.uncheck();assert.equal(await first.isVisible(),false);await toggle.check();assert.equal(await first.isVisible(),true);
   await page.locator('.completion-history>details>summary').click();assert.ok((await page.locator('.history-table').first().textContent()).includes('100%'));await page.screenshot({path:out+'/history-'+engine+'.png',fullPage:true});
   const all=await snap();assert.equal(all.progressHistory[0].date,'2026-10-01');assert.equal(C.parseBackup(JSON.stringify(C.makeBackup(all,D))).progressHistory.length,2);
   await boot(fresh(),'#/trends');assert.equal((await snap()).progressHistory.length,1);assert.ok((await page.locator('.completion-history').textContent()).includes('Earlier changes were not logged'));
  });
  await check('lesson actions, clicker, settings and grouped library remain accessible at large text',async()=>{
   for(const hash of ['#/lesson/NAME-1','#/clicker','#/settings','#/learn','#/trends']){
    await nav(hash);await page.evaluate(()=>document.documentElement.dataset.text='large');const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.equal(report.violations.length,0,hash+': '+JSON.stringify(report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
  });
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
 }finally{fs.writeFileSync(out+'/handoff-'+engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
}
main().catch(e=>{report.failure=e.stack;fs.writeFileSync(root+'/test-results/handoff-'+engine+'.json',JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;});
