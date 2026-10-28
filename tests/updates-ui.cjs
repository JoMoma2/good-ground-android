// iPhone update acceptance tests. Chromium and WebKit emulate touch-sized screens;
// the final physical iPhone/audio check remains separate.
const {chromium,webkit}=require('playwright');
const {AxeBuilder}=require('@axe-core/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),web=process.env.GG_WEB_ROOT||root+'/app/web',C=require(web+'/core.js'),D=require(web+'/data.json');
const report={engine:process.env.GG_BROWSER||'chromium',checks:[],errors:[],externalRequests:[],accessibility:[]};
const output=root+'/test-results';fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+(req.url.split('?')[0]==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));
  if(!file.startsWith(web+'/')){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,body)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':body);});
});
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await (report.engine==='webkit'?webkit:chromium).launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let page=await context.newPage();page.setDefaultTimeout(7000);
  page.on('pageerror',e=>report.errors.push(e.stack||e.message));
  await page.route('**/*',route=>{if(route.request().url().startsWith(origin))return route.continue();report.externalRequests.push(route.request().url());return route.abort();});
  const go=async hash=>{await page.goto(origin+'/'+(hash||''));await page.waitForFunction(()=>GoodGround?.ready);};
  const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
  const state=()=>page.evaluate(()=>GoodGround.snapshot());
  const seed=async s=>{s.household.setupComplete=true;s.household.tutorialSeenVersion=1;await go('');await page.evaluate(json=>GoodGround.nativeMessage({type:'import',json}),JSON.stringify(C.makeBackup(s,D)));await page.getByRole('button',{name:'Restore backup',exact:true}).click();};
  try{
    await check('all shipped training guidance is breed neutral',async()=>{
      assert.doesNotMatch(fs.readFileSync(web+'/data.json','utf8'),/pit bull|staffy|staffies/i);
    });
    await check('first launch offers a skippable single-dog profile before the editable tour',async()=>{
      await go('');await page.getByRole('heading',{name:'Good days start together.'}).waitFor();
      assert.equal(await page.locator('.tab-bar').isVisible(),false);
      await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#setup-profile-form').waitFor();
      await page.getByRole('button',{name:'Skip profile for now',exact:true}).click();await page.locator('.tour-symbol').waitFor();
      const guidePages=await page.evaluate(()=>GROUND_GUIDE.pages.length);for(let i=0;i<guidePages-1;i++)await page.getByRole('button',{name:'Next',exact:true}).click();
      if(guidePages>1){await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();}
      await page.getByRole('button',{name:'Let’s begin',exact:true}).click();await page.getByRole('heading',{name:'Small steps. Better days.'}).waitFor();
      assert.equal((await state()).profile.name,'');assert.equal((await state()).household.tutorialSeenVersion,await page.evaluate(()=>GROUND_GUIDE.version));
      await page.reload();assert.equal(await page.locator('.tour-symbol').count(),0);
      await page.screenshot({path:output+'/updated-today-'+report.engine+'.png',fullPage:true});
    });
    await check('clicker has four saved sound choices and no fabricated practice logs',async()=>{
      await go('#/clicker');assert.equal(await page.locator('.marker-pad').count(),1);
      for(const sound of ['click','ding','pop','buzz']){
        await page.locator('[name="markerSound"]').selectOption(sound);
        await page.locator('.marker-pad').tap();await page.waitForFunction(()=>document.querySelector('#marker-feedback').textContent==='Marked. Reward now.');
        assert.equal((await state()).settings.markerSound,sound);
      }
      await page.locator('#marker-volume').fill('15');await page.locator('#marker-volume').dispatchEvent('change');
      await page.reload();assert.equal((await state()).settings.markerVolume,15);
      assert.equal((await state()).sessions.length,0);
    });
    await check('keyboard marker and lesson reference work; inline marker is optional',async()=>{
      await go('#/lesson/NAME-1');assert.equal(await page.locator('.lesson-marker').count(),1);
      await page.locator('.lesson-marker').getByRole('link',{name:'Open clicker',exact:true}).click();
      assert.ok((await page.locator('.marker-lesson').textContent()).includes('Name recognition'));
      await page.locator('.marker-pad').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#marker-feedback').textContent==='Marked. Reward now.');
      await page.locator('#lesson-marker-toggle').check();
      await page.getByRole('link',{name:'Return to lesson',exact:true}).click();await page.locator('.lesson-marker').waitFor();assert.equal(await page.locator('.lesson-marker').count(),1);
      await page.locator('.lesson-marker').getByRole('link',{name:'Open clicker'}).click();await page.locator('#lesson-marker-toggle').click();await page.getByRole('heading',{name:'Clicker hidden.',exact:true}).waitFor();assert.equal((await state()).settings.lessonMarker,false);
      await page.getByRole('link',{name:'Return to lesson',exact:true}).click();await page.waitForURL('**/#/lesson/NAME-1');await page.locator('.lesson-title').waitFor();assert.equal(await page.locator('.lesson-marker').count(),0);
    });
    await check('clicker is accessible and fits narrow screens with larger text',async()=>{
      await go('#/settings');await page.locator('[name=lessonMarker]').check();await page.getByRole('button',{name:'Save settings',exact:true}).click();await go('#/clicker');const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
      report.accessibility.push({page:'clicker',violations:a.violations.map(v=>v.id)});assert.equal(a.violations.length,0,JSON.stringify(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
      for(const width of [320,390,430,768]){await page.setViewportSize({width,height:844});await page.evaluate(()=>document.documentElement.dataset.text='large');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow at '+width);}
      await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/updated-clicker-'+report.engine+'.png',fullPage:true});
    });
    await check('completing a teaching step opens the next step and keeps notes',async()=>{
      await go('#/settings');await page.getByRole('button',{name:'Save settings',exact:true}).click();await go('#/lesson/NAME-1');await openNotes(page);await page.locator('#step-notes').fill('Keep these notes after completion.');await page.locator('#step-notes').blur();
      await page.getByRole('button',{name:'Set progress',exact:true}).click();await page.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();
      await page.waitForURL('**/#/lesson/NAME-2');await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='NAME-2');await page.getByText('Ready to start',{exact:true}).waitFor();
      const s=await state();assert.equal(s.progress['NAME-1'].notes,'Keep these notes after completion.');assert.equal(s.progress['NAME-1'].status,C.STATUSES[3]);
    });
    await check('last-step completion offers three useful choices and optional fun or rest',async()=>{
      await page.getByRole('button',{name:'Set progress',exact:true}).click();await page.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();
      await page.getByRole('heading',{name:'A little milestone.',exact:true}).waitFor();
      assert.equal(await page.locator('.completion-choices .lesson-card').count(),3);assert.equal(await page.locator('.completion-fun a').count(),1);
      const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.equal(a.violations.length,0,JSON.stringify(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
      await page.getByRole('button',{name:'Enough for today',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
      await page.reload();assert.equal((await state()).progress['NAME-2'].status,C.STATUSES[3]);
    });
    await check('learned skills show accurate gentle refreshers and support quick practice logs',async()=>{
      const s=C.freshState();for(const st of D.skills.find(s=>s.code==='SIT').steps)s.progress[st.id]={status:C.STATUSES[3],notes:'',updatedAt:'2026-09-01T12:00:00Z',completedAt:'2026-09-01T12:00:00Z'};
      await seed(s);await go('#/today');await page.getByRole('heading',{name:'A gentle refresher?',exact:true}).waitFor();
      assert.ok((await page.locator('.refresher-note').textContent()).includes('Sit'));
      await go('#/practice');await page.locator('[data-daily-practice]').click();
      await page.waitForFunction(()=>GoodGround.snapshot().sessions.length===1);
      await page.locator('.practice-library>summary').click();assert.equal(await page.locator('.practice-library .pill.complete').count(),1);assert.equal((await state()).sessions.length,1);
      await go('#/today');assert.equal(await page.locator('.refresher-note').count(),0);
      await go('#/practice');assert.ok((await page.locator('main').textContent()).includes('Last practice logged today'));
    });
    await check('reminders can be dismissed for today or switched off persistently',async()=>{
      let s=await state();s.sessions=[];await seed(s);await go('#/today');await page.getByRole('button',{name:'Hide reminders for today',exact:true}).click();
      await page.locator('.refresher-note').waitFor({state:'detached'});await page.reload();assert.equal(await page.locator('.refresher-note').count(),0);
      await go('#/settings');await page.locator('[name="reminderDays"]').selectOption('0');await page.getByRole('button',{name:'Save settings',exact:true}).click();
      s=await state();assert.equal(s.settings.reminderDays,0);s.settings.remindersDismissedOn='';await seed(s);await go('#/today');assert.equal(await page.locator('.refresher-note').count(),0);
    });
    const nav=async hash=>{await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(h=>{const [type,id='']=h.replace('#/','').split('/');const main=document.querySelector('#main');return location.hash===h&&main?.dataset.route===type&&main?.dataset.pageId===decodeURIComponent(id);},hash);};
    let dogIDs=[];
    await check('multiple dogs are prompted sequentially, require distinct names and allow optional details',async()=>{
      const multi=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      page=await multi.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));
      await page.route('**/*',route=>{if(route.request().url().startsWith(origin))return route.continue();report.externalRequests.push(route.request().url());return route.abort();});
      await go('');await page.locator('[name="householdSize"][value="multiple"]').check();await page.locator('[name="dogCount"]').fill('3');
      await page.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await page.locator('#setup-profile-form [name="name"]').getAttribute('required'),'');
      assert.equal(await page.locator('[name="name"]').count(),1);await page.getByRole('button',{name:'Save & meet the next dog',exact:true}).click();assert.equal((await state()).profile.name,'');
      await page.locator('[name="name"]').fill('Molly');await page.locator('[name="rewards"]').fill('Tiny treats');await page.getByRole('button',{name:'Save & meet the next dog',exact:true}).click();
      await page.locator('[name="name"]').fill('molly');await page.getByRole('button',{name:'Save & meet the next dog',exact:true}).click();await page.locator('.form-error:not([hidden])').waitFor();
      await page.locator('[name="name"]').fill('Spot');await page.getByRole('button',{name:'Save & meet the next dog',exact:true}).click();
      await page.locator('[name="name"]').fill('Pip');await page.getByRole('button',{name:'Save & take a quick tour',exact:true}).click();await page.getByRole('button',{name:'Skip tour',exact:true}).click();
      await page.getByRole('heading',{name:'Who are you training today?'}).waitFor();
      const snapshot=await state();dogIDs=C.dogs(snapshot).map(d=>d.id);assert.deepEqual(C.dogs(snapshot).map(d=>d.profile.name),['Molly','Spot','Pip']);
      const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.equal(a.violations.length,0,JSON.stringify(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
      await page.locator('[name="dogId"][value="'+dogIDs[1]+'"]').check();await page.getByRole('button',{name:'Let’s practice',exact:true}).click();await page.locator('.home-heading').waitFor();
      assert.deepEqual((await state()).household.selectedIds,dogIDs.slice(0,2));
      await page.screenshot({path:output+'/updated-household-'+report.engine+'.png',fullPage:true});
    });
    await check('a cold opening asks who to train; single-dog progress never credits other dogs',async()=>{
      await page.reload();await page.locator('#dog-choice-form').waitFor();
      await page.locator('[name="dogId"][value="'+dogIDs[0]+'"]').uncheck();await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
      await nav('#/lesson/NAME-1');await page.getByRole('button',{name:'Set progress',exact:true}).click();await page.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();await page.waitForURL('**/#/lesson/NAME-2');await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='NAME-2');
      const snapshot=await state();assert.equal(C.status(C.dogState(snapshot,dogIDs[1]),'NAME-1'),C.STATUSES[3]);
      for(const id of [dogIDs[0],dogIDs[2]])assert.equal(C.status(C.dogState(snapshot,id),'NAME-1'),C.STATUSES[0]);
    });
    await check('group recommendations follow the earliest gap and show who already knows the step',async()=>{
      await page.locator('.training-context button').click();await page.locator('[name="dogId"][value="'+dogIDs[0]+'"]').check();await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
      await nav('#/today');await page.locator('.home-heading').waitFor();assert.equal(await page.locator('.lesson-card').first().getAttribute('href'),'#/lesson/NAME-1');
      assert.ok((await page.locator('.lesson-card').first().textContent()).includes('Spot already has this step recorded as consistent.'));
      await page.locator('.lesson-card').first().click();await page.getByRole('button',{name:'Set progress',exact:true}).click();
      assert.equal(await page.locator('[name="progressDog"][value="'+dogIDs[0]+'"]').isChecked(),true);assert.equal(await page.locator('[name="progressDog"][value="'+dogIDs[1]+'"]').isChecked(),false);
      await page.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();await page.waitForURL('**/#/lesson/NAME-2');await page.waitForFunction(()=>document.querySelector('#main')?.dataset.pageId==='NAME-2');
      const snapshot=await state();assert.equal(C.status(C.dogState(snapshot,dogIDs[0]),'NAME-1'),C.STATUSES[3]);assert.equal(C.status(C.dogState(snapshot,dogIDs[2]),'NAME-1'),C.STATUSES[0]);
    });
    await check('group lesson notes remain separate for each dog',async()=>{
      await page.locator('.extra-guidance>summary').click();await page.locator('[data-lesson-section=notes]>summary').click();await page.locator('[data-step-notes][data-dog-id="'+dogIDs[0]+'"]').fill('Molly likes the kitchen.');await page.locator('[data-step-notes][data-dog-id="'+dogIDs[0]+'"]').blur();
      await page.locator('[data-step-notes][data-dog-id="'+dogIDs[1]+'"]').fill('Spot likes the garden.');await page.locator('[data-step-notes][data-dog-id="'+dogIDs[1]+'"]').blur();
      const snapshot=await state();assert.equal(C.dogState(snapshot,dogIDs[0]).progress['NAME-2'].notes,'Molly likes the kitchen.');assert.equal(C.dogState(snapshot,dogIDs[1]).progress['NAME-2'].notes,'Spot likes the garden.');assert.equal(C.dogState(snapshot,dogIDs[2]).progress['NAME-2'],undefined);
    });
    await check('sessions can credit a chosen subset and grouped journal entries stay identifiable',async()=>{
      await nav('#/session/NAME-2');await page.locator('[name="sessionDog"][value="'+dogIDs[0]+'"]').uncheck();await page.locator('[name="setup"]').fill('Only Spot practiced.');await page.getByRole('button',{name:'Save session',exact:true}).click();await page.waitForURL('**/#/entry/*');
      let snapshot=await state();assert.equal(C.dogState(snapshot,dogIDs[0]).sessions.length,0);assert.equal(C.dogState(snapshot,dogIDs[1]).sessions.length,1);assert.equal(C.dogState(snapshot,dogIDs[2]).sessions.length,0);
      await nav('#/journal');await page.locator('.session-card').waitFor();assert.equal(await page.locator('.session-card').count(),1);assert.ok((await page.locator('.session-card').textContent()).includes('Spot'));
      await nav('#/session/NAME-2');await page.locator('[name="setup"]').fill('Comfortable practice together.');await page.getByRole('button',{name:'Save session',exact:true}).click();await page.waitForURL('**/#/entry/*');
      snapshot=await state();assert.equal(C.dogState(snapshot,dogIDs[0]).sessions.length,1);assert.equal(C.dogState(snapshot,dogIDs[1]).sessions.length,2);assert.equal(new Set(C.dogs(snapshot).flatMap(d=>d.sessions.map(s=>s.id))).size,3);
    });
    await check('trigger plans and trends select one dog and never merge observations',async()=>{
      await nav('#/plans');await page.locator('[name="planDog"]').selectOption(dogIDs[1]);await page.getByRole('link',{name:/Knocking/}).click();await page.locator('[name="setup"]').fill('Spot: a faint tap from another room.');await page.getByRole('button',{name:'Save trigger plan',exact:true}).click();
      const snapshot=await state();assert.ok(C.dogState(snapshot,dogIDs[1]).plans.Knocking.setup.includes('Spot'));assert.equal(C.dogState(snapshot,dogIDs[0]).plans.Knocking,undefined);
      await nav('#/trends');await page.locator('[name="trendDog"]').selectOption(dogIDs[1]);assert.equal(await page.locator('[name="trendDog"]').inputValue(),dogIDs[1]);
      for(const width of [320,430,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
      await page.setViewportSize({width:390,height:844});
    });
    await check('a restored household retains every dog, notes, plans, sessions and the selected subset',async()=>{
      const before=await state();await seed(before);await page.locator('#dog-choice-form').waitFor();assert.equal(await page.locator('[name="dogId"][value="'+dogIDs[2]+'"]').isChecked(),false);
      await page.getByRole('button',{name:'Let’s practice',exact:true}).click();const after=await state();
      for(const id of dogIDs){const a=C.dogState(before,id),b=C.dogState(after,id);for(const key of ['profile','progress','sessions','plans','cues'])assert.deepEqual(b[key],a[key]);}
    });
    await check('suggested cue boxes quietly support separate custom cues for each dog',async()=>{
      await nav('#/lesson/SIT-1');const first=page.locator('[data-cue-input][data-dog-id="'+dogIDs[0]+'"]'),second=page.locator('[data-cue-input][data-dog-id="'+dogIDs[1]+'"]');
      assert.equal(await first.inputValue(),'Sit');assert.equal(await second.inputValue(),'Sit');
      await first.fill('Park');await first.blur();await second.fill('Perch');await second.blur();
      const snapshot=await state();assert.equal(C.dogState(snapshot,dogIDs[0]).cues.SIT,'Park');assert.equal(C.dogState(snapshot,dogIDs[1]).cues.SIT,'Perch');assert.equal(C.dogState(snapshot,dogIDs[2]).cues.SIT,undefined);
      await nav('#/learn');await page.locator('#learn-search').fill('Park');assert.equal(await page.locator('.lesson-card[href="#/lesson/SIT-1"]').count(),1);
      await page.locator('.lesson-card[href="#/lesson/SIT-1"]').click();await page.locator('[data-cue-input]').first().waitFor();assert.equal(await first.inputValue(),'Park');
      await first.fill('');await first.blur();assert.equal(await first.inputValue(),'Sit');assert.equal(C.dogState(await state(),dogIDs[0]).cues.SIT,undefined);
      assert.equal(C.parseBackup(JSON.stringify(C.makeBackup(await state(),D))).household.others[0].cues.SIT,'Perch');
    });
    await check('foundational lessons link quietly to their dependent advanced lessons',async()=>{
      await nav('#/lesson/NAME-1');assert.equal(await page.locator('.downstream-skills').count(),1);
      assert.equal(await page.locator('.downstream-skills').getAttribute('open'),null);
      await page.locator('.extra-guidance>summary').click();await page.getByText('Where this skill can lead',{exact:true}).click();
      const links=await page.locator('.downstream-skills a').evaluateAll(xs=>xs.map(x=>({text:x.textContent,href:x.getAttribute('href')})));
      assert.ok(links.some(x=>x.text==='Name response in new settings'&&x.href==='#/lesson/NAMECTX-1'));
      await page.locator('.downstream-skills a[href="#/lesson/NAMECTX-1"]').click();await page.waitForURL('**/#/lesson/NAMECTX-1');await page.locator('.dependency').first().waitFor();
      assert.ok(await page.locator('.dependency').count()>0);
    });
    const chooseBreed=async(query,choice)=>{
      await page.locator('[data-action="choose-breed"]').click();await page.locator('#breed-search').fill(query);await page.locator('[data-action="pick-breed"]').filter({hasText:choice}).filter({has:page.locator('svg')}).first().click();
    };
    await check('searchable breeds invite optional checks without automatically assigning traits',async()=>{
      await nav('#/profile/'+dogIDs[0]);await chooseBreed('Lagotto','Lagotto Romagnolo');await page.getByRole('button',{name:'Save profile',exact:true}).click();
      await page.getByRole('heading',{name:'Does this fit Molly?',exact:true}).waitFor();let snapshot=await state();assert.equal(C.dogState(snapshot,dogIDs[0]).profile.breed,'Lagotto Romagnolo');assert.deepEqual(C.dogState(snapshot,dogIDs[0]).tailoring.traits,[]);
      const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.equal(a.violations.length,0,JSON.stringify(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
      await page.getByRole('button',{name:'Doesn’t fit my dog',exact:true}).click();await page.waitForURL('**/#/today');assert.deepEqual(C.dogState(await state(),dogIDs[0]).tailoring.traits,[]);
      await nav('#/profile/'+dogIDs[0]);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.waitForURL('**/#/today');assert.equal(await page.getByRole('dialog').count(),0);
    });
    await check('confirmed preferences tailor setups for the right dog and can be removed',async()=>{
      await nav('#/profile/'+dogIDs[0]);await chooseBreed('Spanish Water','Spanish Water Dog');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('button',{name:'Yes, that fits',exact:true}).click();await page.waitForURL('**/#/today');
      let snapshot=await state();assert.deepEqual(C.dogState(snapshot,dogIDs[0]).tailoring.traits,['novelty']);assert.deepEqual(C.dogState(snapshot,dogIDs[1]).tailoring.traits,[]);
      await page.locator('.tailored-today').waitFor();assert.ok((await page.locator('.tailored-today').textContent()).includes('For Molly'));
      await nav('#/lesson/NAME-1');assert.equal(await page.locator('.tailored-setup').count(),0);await nav('#/lesson/OBJECT-1');await page.locator('.tailored-teaching').waitFor();assert.ok((await page.locator('.tailored-teaching').textContent()).includes('Molly'));await nav('#/lesson/NAME-1');
      assert.ok((await page.locator('.criterion').textContent()).includes(D.skills.find(s=>s.code==='NAME').steps[0].advance));
      await nav('#/profile/'+dogIDs[0]);await page.locator('.support-fields summary').click();await page.locator('[name="trait"][value="novelty"]').uncheck();await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.waitForURL('**/#/today');assert.deepEqual(C.dogState(await state(),dogIDs[0]).tailoring.traits,[]);
    });
    await check('individual support works for unknown breeds and marks the clicker as optional',async()=>{
      await nav('#/profile/'+dogIDs[1]);await chooseBreed('Unknown','Unknown');await page.locator('.support-fields summary').click();await page.locator('[name="trait"][value="noise"]').check();await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.waitForURL('**/#/today');
      let snapshot=await state();assert.deepEqual(C.dogState(snapshot,dogIDs[1]).tailoring.traits,['noise']);assert.equal(C.dogState(snapshot,dogIDs[1]).profile.breed,'Unknown');
      await nav('#/clicker');await page.locator('.marker-sensitivity').waitFor();await page.locator('.marker-pad').waitFor();
      const restored=C.parseBackup(JSON.stringify(C.makeBackup(snapshot,D)));assert.deepEqual(C.dogState(restored,dogIDs[1]).tailoring,C.dogState(snapshot,dogIDs[1]).tailoring);
    });
    await check('breed search accepts custom mixes and is accessible with keyboard navigation',async()=>{
      await nav('#/profile/'+dogIDs[1]);await page.locator('[data-action="choose-breed"]').click();await page.locator('#breed-search').fill('Collie / spaniel mix');
      const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.equal(a.violations.length,0,JSON.stringify(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
      await page.locator('[data-action="pick-breed"]').getByText('Use “Collie / spaniel mix”',{exact:true}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.waitForURL('**/#/today');
      assert.equal(C.dogState(await state(),dogIDs[1]).profile.breed,'Collie / spaniel mix');
      await page.screenshot({path:output+'/updated-tailoring-'+report.engine+'.png',fullPage:true});
    });
    await check('a breed check during first-run setup continues into the guide after confirmation',async()=>{
      const fresh=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await fresh.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));
      await page.route('**/*',route=>{if(route.request().url().startsWith(origin))return route.continue();report.externalRequests.push(route.request().url());return route.abort();});
      await go('');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('[name="name"]').fill('Luna');await chooseBreed('Lagotto','Lagotto Romagnolo');await page.getByRole('button',{name:'Save & take a quick tour',exact:true}).click();
      await page.getByRole('button',{name:'Yes, that fits',exact:true}).click();await page.locator('.tour-symbol').waitFor();await page.getByRole('button',{name:'Skip tour',exact:true}).click();await page.locator('.home-heading').waitFor();
      assert.deepEqual((await state()).tailoring.traits,['noise']);assert.equal((await state()).household.setupComplete,true);assert.equal((await state()).profile.name,'Luna');
    });
    // Additional acceptance scenarios are appended here as priorities are completed.
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
  }finally{fs.writeFileSync(output+'/updates-'+report.engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
}
main().catch(e=>{report.failure=e.stack;fs.writeFileSync(output+'/updates-'+report.engine+'.json',JSON.stringify(report,null,2)+'\n');console.error(e);server.close();process.exitCode=1;});

async function openNotes(page){const outer=page.locator('.extra-information');if(!await outer.count())return;if(await outer.getAttribute('open')===null)await outer.locator(':scope>summary').click();const notes=page.locator('[data-lesson-section=notes]');if(await notes.getAttribute('open')===null)await notes.locator(':scope>summary').click();}
