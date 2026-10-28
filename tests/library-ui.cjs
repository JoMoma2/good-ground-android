const {chromium,webkit}=require('playwright'),{AxeBuilder}=require('@axe-core/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),web=process.env.GG_WEB_ROOT||root+'/app/web',C=require(web+'/core.js'),D=require(web+'/data.json'),engine=process.env.GG_BROWSER||'chromium',out=root+'/test-results';fs.mkdirSync(out,{recursive:true});
const report={engine,webRoot:web,checks:[],errors:[],externalRequests:[],accessibility:[]};
const full=(s,code)=>D.skills.find(x=>x.code===code).steps.reduce((a,st)=>C.setProgress(a,st.id,C.STATUSES[3]),s);
(async()=>{
 const browser=await ({chromium,webkit}[engine]).launch({headless:true});let context,page;
 function fresh(){const s=C.freshState();s.profile.name='Molly';s.household.setupComplete=true;s.household.tutorialSeenVersion=3;return s;}
 async function boot(s=fresh(),hash='#/learn'){
  if(context)await context.close();context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(s=>{window.GOOD_GROUND_BOOT={native:true,state:s};window.webkit={messageHandlers:{ground:{postMessage:()=>{}}}};},s);
  page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));await page.route('http{,s}://**',r=>{report.externalRequests.push(r.request().url());return r.abort();});
  await page.goto(pathToFileURL(web+'/index.html').href+hash);await page.waitForFunction(()=>GoodGround?.ready);if(await page.locator('#dog-choice-form').count())await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
 }
 async function nav(hash){await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(h=>{const [t,id='']=h.slice(2).split('/');return document.querySelector('#main')?.dataset.route===t&&document.querySelector('#main')?.dataset.pageId===decodeURIComponent(id);},hash);}
 const rows=()=>page.locator('[data-skill-code]'),codes=()=>rows().evaluateAll(els=>els.map(el=>el.dataset.skillCode)),snap=()=>page.evaluate(()=>GoodGround.snapshot());
 async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
 async function collectPages(){const all=[];for(let pageNo=0;pageNo<20;pageNo++){assert.ok(await rows().count()<=12);all.push(...await codes());const next=page.getByRole('button',{name:'Next',exact:true});if(!await next.count()||await next.isDisabled())return all;await next.click();assert.equal(await page.locator('#library-count').evaluate(e=>e===document.activeElement),true);}throw Error('Pagination did not finish');}
 try{
  await check('Lessons opens 14 compact topics with no 154-skill list, and keeps search and tools available',async()=>{
   await boot();assert.equal(await rows().count(),0);assert.equal(await page.locator('.library-topic').count(),14);assert.equal(await page.locator('.training-tools a').count(),4);assert.ok((await page.locator('.page-title').textContent()).includes('154 skills'));assert.ok((await page.locator('#learn-search').boundingBox()).y<300);await page.screenshot({path:out+'/library-directory-'+engine+'.png',fullPage:true});
  });
  await check('every one of 154 skills is reachable once through its topic in pages of at most 12',async()=>{
   const all=[];for(const topic of [...new Set(D.skills.map(s=>s.sheet))]){await nav('#/topic/'+encodeURIComponent(topic));all.push(...await collectPages());}
   assert.equal(all.length,154);assert.equal(new Set(all).size,154);assert.deepEqual(all.slice().sort(),D.skills.map(s=>s.code).sort());
  });
  await check('search ranks titles and handles punctuation, multiple words, custom cues and exact current/archived IDs',async()=>{
   const s=fresh();s.cues.HEEL='À côté';s.cues.SIT='坐下';s.cues.STAND='Стоять';await boot(s);const input=page.locator('#learn-search');
   await input.fill('heel');assert.equal((await codes())[0],'HEEL');await input.fill('loose leash');assert.ok((await codes()).includes('LOOSE'));await input.fill('cote');assert.deepEqual(await codes(),['HEEL']);await input.fill('坐下');assert.deepEqual(await codes(),['SIT']);await input.fill('стоять');assert.deepEqual(await codes(),['STAND']);await input.fill('???');assert.equal(await rows().count(),0);
   for(const id of ['LEAVE-2','HEEL-4','SORT-1']){await input.fill(id);assert.equal(await page.locator('#learn-results .lesson-card').count(),1);assert.equal(await page.locator('#learn-results .lesson-card').getAttribute('href'),'#/lesson/'+id);}
   await input.fill('sit');assert.equal((await codes())[0],'SIT');assert.ok(!(await codes()).includes('POSE'),'Substring in position must not swamp a sit search');await input.fill('');assert.equal(await rows().count(),0);assert.equal(await page.locator('.library-topic').count(),14);
  });
  await check('filters and topic selection narrow results; query/filter changes reset pagination and empty search recovers',async()=>{
   let s=full(full(fresh(),'SIT'),'HEEL');s.favorites=['HEEL','PULL'];await boot(s);const before=await snap();
   await page.getByRole('button',{name:'Learned',exact:true}).click();assert.deepEqual((await codes()).sort(),['HEEL','SIT']);await page.getByRole('button',{name:'Saved',exact:true}).click();assert.deepEqual((await codes()).sort(),['HEEL','PULL']);
   await page.getByRole('button',{name:'Ready / practicing',exact:true}).click();const topics=await page.locator('.library-topic').evaluateAll(links=>links.map(a=>a.getAttribute('href')));assert.ok(topics.length>0);const all=[];for(const topic of topics){await nav(topic);all.push(...await collectPages());}assert.equal(new Set(all).size,all.length);assert.ok(all.length>12);await nav('#/learn');
   await page.getByRole('button',{name:'All lessons',exact:true}).click();await page.locator('#learn-topic').selectOption('Foundations');assert.equal(await rows().count(),12);await page.getByRole('button',{name:'Next',exact:true}).click();
   await page.locator('#learn-search').fill('sit');assert.equal((await codes())[0],'SIT');assert.equal(await page.locator('.library-pagination').count(),0);
   await page.locator('#learn-search').fill('a nonexistent training phrase');await page.getByRole('button',{name:'Browse all topics',exact:true}).click();assert.equal(await page.locator('.library-topic').count(),14);assert.equal(await page.locator('#learn-search').inputValue(),'');assert.deepEqual(await snap(),before);
  });
  await check('topic search stays inside its category and ordinary lesson/project/back routes work',async()=>{
   await boot();await page.locator('.library-topic[href="#/topic/Walk%20skills"]').click();await page.locator('#topic-search').fill('heel');assert.equal((await codes())[0],'HEEL');await rows().first().click();await page.getByRole('heading',{name:'Heel on cue',exact:true}).waitFor();
   await nav('#/topic/Brainiacs');assert.equal(await page.locator('.project-card').count(),8);await page.locator('[data-skill-code=RALLY]').click();await page.locator('[data-module]').first().waitFor();assert.equal(await page.locator('[data-module]').count(),4);
   await nav('#/topic/Walk%20skills');await page.locator('#topic-search').fill('crate');assert.equal(await rows().count(),0);await page.getByRole('button',{name:'Clear search',exact:true}).click();assert.ok(await rows().count()>0);await page.getByRole('link',{name:'All topics',exact:true}).click();await page.locator('.library-topic').first().waitFor();
   await nav('#/topic/Fridge%20task');await page.getByRole('heading',{name:'Brainiacs',exact:true}).waitFor();
  });
  await check('learned filtering respects each selected dog and browsing does not alter their progress',async()=>{
   let s=full(fresh(),'HEEL');s=C.addDog(s,{name:'Poppy'});s=C.selectDogs(s,C.dogs(s).map(d=>d.id));await boot(s);const before=await snap();await page.getByRole('button',{name:'Learned',exact:true}).click();assert.equal(await rows().count(),0);assert.deepEqual(await snap(),before);
   s=C.selectDogs(s,[s.household.primaryId]);await boot(s);await page.getByRole('button',{name:'Learned',exact:true}).click();assert.deepEqual(await codes(),['HEEL']);
  });
  await check('directory, compact results and pagination fit narrow/large-text screens and pass accessibility checks',async()=>{
   const s=fresh();s.settings.textSize='large';s.settings.theme='dark';await boot(s);
   for(const width of [320,390,768]){await page.setViewportSize({width,height:844});for(const hash of ['#/learn','#/topic/Foundations']){await nav(hash);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();report.accessibility.push({width,hash,violations:a.violations.map(v=>v.id)});assert.deepEqual(a.violations.map(v=>v.id),[]);}}
   await page.setViewportSize({width:320,height:568});await page.screenshot({path:out+'/library-topic-large-'+engine+'.png',fullPage:true});
  });
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
 }finally{fs.writeFileSync(out+'/library-'+engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(out+'/library-'+engine+'.json',JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;});
