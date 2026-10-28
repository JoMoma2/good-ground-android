const {chromium,webkit}=require('playwright'),{AxeBuilder}=require('@axe-core/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),web=process.env.GG_WEB_ROOT||root+'/app/web',C=require(web+'/core.js'),D=require(web+'/data.json'),old=require('./fixtures/1.3.0-catalog.json'),engine=process.env.GG_BROWSER||'chromium',out=root+'/test-results';
fs.mkdirSync(out,{recursive:true});const report={engine,webRoot:web,checks:[],errors:[],externalRequests:[],accessibility:[]};
const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!f.startsWith(web+'/')){res.writeHead(403);return res.end();}fs.readFile(f,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'});res.end(err?'Missing':data);});});
const done=(s,code)=>D.skills.find(x=>x.code===code).steps.reduce((a,st)=>C.setProgress(a,st.id,C.STATUSES[3]),s);
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await ({chromium,webkit}[engine]).launch({headless:true});let context,page;
 const fresh=()=>{const s=C.freshState();s.profile.name='Molly';s.household.setupComplete=true;s.household.tutorialSeenVersion=2;return s;};
 async function boot(s=fresh(),hash='#/today'){
  if(context)await context.close();context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:'America/Detroit'});
  await context.addInitScript(s=>{if(!localStorage.getItem('good-ground-state-v1'))localStorage.setItem('good-ground-state-v1',JSON.stringify(s));},s);
  page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));await page.clock.install({time:new Date('2026-10-24T12:00:00-04:00')});
  await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();report.externalRequests.push(r.request().url());return r.abort();});
  await page.goto(origin+'/'+hash);await page.waitForFunction(()=>window.GoodGround?.ready);if(await page.locator('#dog-choice-form').count())await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
 }
 async function nav(hash){await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(h=>{const [t,id='']=h.slice(2).split('/');return document.querySelector('#main')?.dataset.route===t&&document.querySelector('#main')?.dataset.pageId===decodeURIComponent(id);},hash);}
 const snap=()=>page.evaluate(()=>GoodGround.snapshot());
 async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
 try{
  await check('all 50 additions are searchable and every new teaching step opens with usable controls',async()=>{
   await boot(fresh(),'#/learn');assert.ok((await page.locator('.page-title').textContent()).includes('154 skills'));
   for(const skill of D.skills.filter(s=>!old.skills.some(o=>o.code===s.code))){
    await nav('#/learn');await page.locator('#learn-search').fill(skill.code);assert.ok((await page.locator('#learn-results').textContent()).includes(skill.title),skill.code);
    for(const st of skill.steps){await nav('#/lesson/'+st.id);assert.equal(await page.getByRole('heading',{name:skill.title,exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Set progress',exact:true}).count(),1);assert.ok((await page.locator('.teaching-copy').textContent()).length>100);}
   }
   await nav('#/lesson/HEEL-1');assert.ok((await page.locator('.lesson-title').textContent()).includes('Ready to start'));await page.screenshot({path:out+'/expansion-heel-'+engine+'.png',fullPage:true});
  });
  await check('daily practice advances through learned dog-skill pairs, keeps grades and survives reload',async()=>{
   let s=done(done(done(done(fresh(),'SIT'),'NAME'),'HEEL'),'DOG');s=C.addDog(s,{name:'Poppy'});const other=C.dogs(s)[1].id;s=C.updateDog(s,other,d=>done(d,'SIT'));s=C.selectDogs(s,C.dogs(s).map(d=>d.id));await boot(s);
   const before=await snap();assert.equal(C.dailyPractice(D,before,new Date('2026-10-24T12:00:00-04:00')).pending.length,4);assert.ok((await page.locator('.daily-practice').textContent()).includes('0 of 4'));
   for(let i=0;i<4;i++){
    const button=page.locator('[data-daily-practice]'),dog=await button.getAttribute('data-dog-id');assert.ok((await button.textContent()).includes(C.dogs(before).find(d=>d.id===dog).profile.name));
    await button.click();assert.equal((await snap()).sessions.length+C.dogs(await snap())[1].sessions.length,i+1);assert.equal(await page.locator('#daily-practice-next').evaluate(e=>e===document.activeElement),true);
   }
   assert.equal(await page.locator('[data-daily-practice]').count(),0);assert.ok((await page.locator('.daily-practice').textContent()).includes('All familiar skills'));
   const after=await snap();for(const dog of C.dogs(before)){const x=C.dogs(after).find(d=>d.id===dog.id);assert.deepEqual(x.progress,dog.progress);assert.deepEqual(x.progressHistory,dog.progressHistory);}
   await page.evaluate(()=>GoodGround.flush());await page.reload();await page.waitForFunction(()=>GoodGround?.ready);if(await page.locator('#dog-choice-form').count())await page.getByRole('button',{name:'Let’s practice',exact:true}).click();assert.equal(await page.locator('[data-daily-practice]').count(),0);
   await nav('#/practice');await page.locator('.practice-library>summary').click();assert.equal(await page.locator('.practice-library .pill.complete').count(),4);await page.screenshot({path:out+'/expansion-practice-complete-'+engine+'.png',fullPage:true});
   await page.clock.setFixedTime(new Date('2026-10-25T12:00:00-04:00'));await page.clock.runFor(60001);assert.ok((await page.locator('.daily-practice').textContent()).includes('0 of 4'));
  });
  await check('regular journal practice counts and removing the log restores the daily choice',async()=>{
   let s=done(fresh(),'SIT');s.sessions=[C.normalizeSession({id:'today-sit',date:'2026-10-24',stepId:'SIT-1',observations:'Detailed familiar practice'})];await boot(s,'#/practice');assert.equal(await page.locator('[data-daily-practice]').count(),0);
   await nav('#/entry/today-sit');await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete session',exact:true}).click();await nav('#/practice');assert.equal(await page.locator('[data-daily-practice]').count(),1);
  });
  await check('new project maps expose shared ordinary components and independent branches',async()=>{
   await boot();for(const code of ['RALLY','CIRCUIT','SCENTREPORT','ROUTINE']){await nav('#/project/'+code);assert.equal(await page.locator('[data-module]').count(),4);await page.locator('[data-module]').first().locator('summary').click();assert.ok(await page.locator('[data-module][open] a').count()>=2);}
   await nav('#/lesson/LIGHTPAD-1');assert.ok((await page.locator('.lesson-title').textContent()).includes('Ready to start'));await nav('#/lesson/SCENTINDICATE-1');assert.ok((await page.locator('.lesson-title').textContent()).includes('Ready to start'));
  });
  await check('current 13-page tour is replayable without forcing it over existing users',async()=>{
   await boot();assert.equal(await page.locator('.tour-symbol').count(),0);await nav('#/tutorial');const count=await page.evaluate(()=>GROUND_GUIDE.pages.length);assert.equal(count,13);
   let copy='';for(let i=0;i<count;i++){copy+=await page.locator('#main').textContent();if(i<count-1)await page.getByRole('button',{name:'Next',exact:true}).click();}
   for(const term of ['Brainiacs','Familiar skills for today','Practice rhythm','Trends','Backup','backup'])assert.ok(copy.toLowerCase().includes(term.toLowerCase()),term);
   await page.locator('[data-action=finish-guide]').last().click();assert.equal((await snap()).household.tutorialSeenVersion,6);
  });
  await check('history tables preserve words and whole values at 320px, large text, dark mode and desktop widths',async()=>{
   let s=done(fresh(),'SIT');s.progressHistory=[{date:'2026-10-20',curriculum:6,topics:{'Care and equipment':[1,10],'Walk skills':[2,6]}},{date:'2026-10-23',curriculum:7,topics:{'Care and equipment':[1,17],'Walk skills':[2,12]}}];s.settings.textSize='large';s.settings.theme='dark';await boot(s,'#/trends');await page.locator('.completion-history>details>summary').click();assert.equal(await page.locator('.history-table').count(),1);
   for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));for(const region of await page.locator('.history-table').all()){
    assert.ok(await region.evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.equal(await region.locator('.history-date-group').count(),3);
   }}
   await page.setViewportSize({width:320,height:844});await page.screenshot({path:out+'/expansion-tables-'+engine+'.png',fullPage:true});
  });
  await check('practice, lessons, project and tour remain accessible with large text on a narrow phone',async()=>{
   const s=done(fresh(),'HEEL');s.settings.textSize='large';s.settings.theme='dark';await boot(s);await page.setViewportSize({width:320,height:568});
   for(const hash of ['#/today','#/practice','#/lesson/HEEL-4','#/project/RALLY','#/tutorial']){await nav(hash);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();report.accessibility.push({hash,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});assert.deepEqual(a.violations.map(v=>v.id),[]);}
   await page.screenshot({path:out+'/expansion-tour-'+engine+'.png',fullPage:true});
  });
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
 }finally{fs.writeFileSync(out+'/expansion-'+engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{report.failure=e.stack;fs.writeFileSync(out+'/expansion-'+engine+'.json',JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;server.close();});
