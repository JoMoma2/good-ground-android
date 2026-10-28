const {chromium,webkit,firefox}=require('playwright'),{AxeBuilder}=require('@axe-core/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),web=process.env.GG_WEB_ROOT||root+'/app/web',C=require(web+'/core.js'),D=require(web+'/data.json'),engine=process.env.GG_BROWSER||'chromium';
const out=root+'/test-results',report={engine,webRoot:web,checks:[],errors:[],externalRequests:[],physicalDogTrainingTested:false,nativeRuntimeTested:false};fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await ({chromium,webkit,firefox}[engine]).launch({headless:true});let context,page;
 const fresh=()=>{const s=C.freshState();s.settings.lessonMode='detailed';s.profile.name='Molly';s.household.setupComplete=true;s.household.tutorialSeenVersion=1;return s;};
 const done=(s,...ids)=>ids.reduce((a,id)=>C.setProgress(a,id,C.STATUSES[3]),s);
 async function boot(s=fresh(),hash='#/topic/Brainiacs'){
  if(context)await context.close();context=await browser.newContext({viewport:{width:390,height:844},isMobile:engine!=='firefox',hasTouch:true});
  await context.addInitScript(state=>{window.GOOD_GROUND_BOOT={native:true,state,error:null,smoke:false};window.webkit={messageHandlers:{ground:{postMessage:m=>{if(m.action==='export')window.__export=m.json;}}}};},s);
  page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));
  await page.route('http{,s}://**',r=>{report.externalRequests.push(r.request().url());return r.abort();});
  await page.goto(pathToFileURL(web+'/index.html').href+hash);await page.waitForFunction(()=>window.GoodGround?.ready);
 }
 const snap=()=>page.evaluate(()=>GoodGround.snapshot());
 async function nav(hash){await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(h=>{const [type,id='']=h.slice(2).split('/');return document.querySelector('#main')?.dataset.route===type&&document.querySelector('#main')?.dataset.pageId===decodeURIComponent(id);},hash);}
 async function grade(value){await page.getByRole('button',{name:'Set progress',exact:true}).click();await page.locator('[data-action="set-progress"]').filter({has:page.getByText(C.LABELS[C.STATUSES.indexOf(value)],{exact:true})}).click();}
 async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
 try{
  await check('Brainiacs has eight distinct project overviews and a working component dropdown for every step',async()=>{
   await boot();assert.equal(await page.locator('.project-card').count(),8);await page.locator('[href="#/project/DRINK"]').click();await page.locator('[data-module=OPEN]').waitFor();
   const groups=page.locator('[data-module]');assert.equal(await groups.count(),4);assert.equal(await page.locator('[data-module][open]').count(),0);
   await page.locator('[data-module=SHELF] summary').click();assert.equal(await page.locator('[data-module=SHELF] a').count(),3);await page.locator('[data-module=SHELF] a').first().click();await nav('#/lesson/SHELF-1');assert.ok(page.url().endsWith('#/lesson/SHELF-1'));assert.equal(await page.locator('[data-lesson-section=steps] .lesson-step-list a').count(),3);
   await nav('#/project/DRINK');await page.locator('.project-foundations>summary').click();await page.locator('[data-foundation=PULL] summary').click();assert.equal(await page.locator('[data-foundation=PULL] [href="#/lesson/PULL-3"]').count(),1);await page.locator('[data-module=CLOSE] summary').click();assert.ok((await page.locator('[data-module=CLOSE] summary').textContent()).includes('optional'));await page.screenshot({path:out+'/curriculum-fridge-'+engine+'.png',fullPage:true});
   for(const code of ['SORTALL','COURIER','WALKREADY']){await nav('#/project/'+code);assert.ok(await page.locator('[data-module]').count()>=3);assert.equal(await page.locator('.tab.active').textContent(),'Lessons');}
  });
  await check('rope pulling is linked explicitly; independent retrieval remains available; pausing blocks door pulling',async()=>{
   let s=done(fresh(),'OPEN-4','FETCH-2','GIVE-2');await boot(s,'#/lesson/OPEN-5');assert.ok((await page.locator('.lesson-title').textContent()).includes('Build prerequisite'));
   assert.equal(await page.locator('.dependency[href="#/lesson/PULL-3"]').count(),1);await nav('#/lesson/SHELF-1');assert.ok((await page.locator('.lesson-title').textContent()).includes('Ready to start'));
   s=done(s,'PULL-3');await boot(s,'#/lesson/OPEN-5');assert.ok((await page.locator('.lesson-title').textContent()).includes('Ready to start'));
   await nav('#/lesson/PULL-3');await grade(C.STATUSES[4]);await nav('#/lesson/OPEN-5');assert.ok((await page.locator('.lesson-title').textContent()).includes('Build prerequisite'));
   await nav('#/lesson/DRINK-6');assert.equal(await page.locator('.dependency[href="#/lesson/PULL-3"]').count(),1);
  });
  await check('finishing a parallel branch opens a ready gap and cannot announce an incomplete skill as complete',async()=>{
   let s=done(fresh(),'MIDDLE-1');await boot(s,'#/lesson/WEAVE-2');assert.ok((await page.locator('.lesson-title').textContent()).includes('Ready to start'));
   await grade(C.STATUSES[3]);await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='WEAVE-1');assert.equal(await page.getByRole('dialog').count(),0);
   s=done(s,'WEAVE-2');s=C.setProgress(s,'WEAVE-1',C.STATUSES[4]);await boot(s,'#/lesson/WEAVE-3');await grade(C.STATUSES[3]);assert.equal(await page.getByRole('dialog').count(),0);assert.ok(page.url().endsWith('#/lesson/WEAVE-3'));
  });
  await check('completion of a supporting skill links back to its full project',async()=>{
   await boot(done(fresh(),'PULL-1','PULL-2'),'#/lesson/PULL-3');await grade(C.STATUSES[3]);await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').locator('[href="#/project/DRINK"]').count(),1);await page.getByRole('dialog').locator('[href="#/project/DRINK"]').click();await page.locator('[data-module=OPEN]').waitFor();
  });
  await check('shortened guides credit only completed groups and retain editable original notes on earlier pages',async()=>{
   const s=done(fresh(),'SORT-1','SORT-2');s.progress['SORT-1'].notes='Original basket note';s.cues.SORT='Put away';s.favorites=['OPEN'];await boot(s,'#/lesson/SORT-A');
   assert.equal((await snap()).progress['SORT-A'].status,C.STATUSES[3]);assert.equal((await snap()).progress['SORT-B'],undefined);assert.equal(await page.locator('[data-cue-input]').inputValue(),'Put away');
   await page.locator('.extra-information>summary').click();await page.locator('.earlier-records summary').click();await page.locator('.earlier-records [href="#/lesson/SORT-1"]').click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='SORT-1');assert.ok((await page.locator('.lesson-title').textContent()).includes('EARLIER GUIDE'));
   assert.equal(await page.locator('#step-notes').inputValue(),'Original basket note');await openNotes(page);await page.locator('#step-notes').fill('Original note, amended');await page.locator('#step-notes').blur();assert.equal((await snap()).progress['SORT-1'].notes,'Original note, amended');assert.equal((await snap()).progress['SORT-A'].notes,'');
   await page.getByRole('link',{name:'Open the current guide',exact:true}).click();await page.locator('.extra-information>summary').click();await page.locator('.earlier-records').waitFor();assert.deepEqual((await snap()).favorites,['OPEN']);
   await nav('#/learn');await page.locator('#learn-search').fill('SORT-1');await page.locator('#learn-results .lesson-card').click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='SORT-1');assert.ok(page.url().endsWith('#/lesson/SORT-1'));
  });
  await check('editing an old journal entry and exporting preserves its original step link and all notes',async()=>{
   const s=fresh();s.sessions=[C.normalizeSession({id:'earlier-log',date:'2026-10-01',stepId:'POST-4',observations:'Old return practice'})];s.progress['POST-4']={status:C.STATUSES[4],notes:'Keep this pause',updatedAt:'2026-10-01'};
   await boot(s,'#/edit-session/earlier-log');assert.equal(await page.locator('[name=stepId]').inputValue(),'POST-4');await page.locator('[name=observations]').fill('Amended return observation');await page.getByRole('button',{name:'Save session',exact:true}).click();
   assert.equal((await snap()).sessions[0].stepId,'POST-4');await nav('#/backup');await page.getByRole('button',{name:'Save backup to Files',exact:true}).click();const restored=C.parseBackup(await page.evaluate(()=>window.__export));assert.equal(restored.sessions[0].stepId,'POST-4');assert.equal(restored.progress['POST-4'].notes,'Keep this pause');assert.equal(restored.progress['POST-B'].status,C.STATUSES[4]);
  });
  await check('project progress follows the selected dogs and does not credit an untrained companion',async()=>{
   let s=done(fresh(),'OPEN-4');s=C.addDog(s,{name:'Poppy'});s=C.selectDogs(s,C.dogs(s).map(d=>d.id));await boot(s,'#/project/DRINK');
   // Cold opening asks which dogs; confirm the same selected group.
   await page.getByRole('button',{name:'Let’s practice',exact:true}).click();await nav('#/project/DRINK');assert.ok((await page.locator('[data-module=OPEN] summary').textContent()).includes('0/3'));
   assert.equal(C.dogs(await snap())[0].progress['OPEN-4'].status,C.STATUSES[3]);assert.equal(C.dogs(await snap())[1].progress['OPEN-4'],undefined);
  });
  await check('all preserved earlier pages resolve, and project maps stay accessible at narrow widths and large text',async()=>{
   await boot();for(const skill of D.archivedSkills)for(const st of skill.steps){await nav('#/lesson/'+st.id);assert.equal(await page.getByRole('heading',{name:skill.title,exact:true}).count(),1);}
   for(const code of ['DRINK','SORTALL','COURIER','WALKREADY']){
    await nav('#/project/'+code);await page.setViewportSize({width:320,height:568});await page.evaluate(()=>{document.documentElement.dataset.text='large';document.documentElement.dataset.theme='dark';document.querySelectorAll('[data-module]').forEach(d=>d.open=true);});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
   }
  });
  await check('retired appliance pages preserve records without crediting prop lessons; newly checked sources open',async()=>{
   const s=done(fresh(),'OPEN-1','OPEN-2','OPEN-3','DRINK-4');s.progress['OPEN-1'].notes='Historical appliance note';await boot(s,'#/lesson/OPEN-1');
   assert.ok((await page.locator('.lesson-title').textContent()).includes('Retired from current recommendations'));assert.equal(await page.getByRole('button',{name:'Set progress',exact:true}).count(),0);assert.equal(await page.locator('#step-notes').inputValue(),'Historical appliance note');
   await page.getByRole('link',{name:'Open the current guide',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='OPEN-4');assert.equal((await snap()).progress['OPEN-4'],undefined);assert.equal((await snap()).progress['OPEN-1'].notes,'Historical appliance note');
   await nav('#/lesson/WAIT-1');await page.locator('.extra-information>summary').click();await page.locator('[data-lesson-section=sources]>summary').click();await page.locator('[href="#/source/V112"]').click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='V112');assert.ok((await page.locator('#main').textContent()).includes('wait'));
   await nav('#/lesson/LEAVE-4');assert.ok((await page.locator('.criterion').textContent()).includes('not validated mastery tests'));
  });
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
 }finally{fs.writeFileSync(out+'/curriculum-'+engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
}
main().catch(e=>{report.failure=e.stack;fs.writeFileSync(out+'/curriculum-'+engine+'.json',JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;});

async function openNotes(page){const outer=page.locator('.extra-information');if(!await outer.count())return;if(await outer.getAttribute('open')===null)await outer.locator(':scope>summary').click();const notes=page.locator('[data-lesson-section=notes]');if(await notes.getAttribute('open')===null)await notes.locator(':scope>summary').click();}
