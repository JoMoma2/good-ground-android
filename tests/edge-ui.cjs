// Additional acceptance checks against the actual bundled file:// page.
// Native storage is simulated; audio uses the real browser Web Audio engine.
const {chromium,webkit}=require('playwright');
const {AxeBuilder}=require('@axe-core/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),web=process.env.GG_WEB_ROOT||root+'/app/web';
const C=require(web+'/core.js'),D=require(web+'/data.json'),engine=process.env.GG_BROWSER||'chromium';
const report={engine,checks:[],errors:[],externalRequests:[],nativeRuntimeTested:false};
const out=root+'/test-results';fs.mkdirSync(out,{recursive:true});
function settled(){const s=C.freshState();s.settings.lessonMode='detailed';s.household.setupComplete=true;s.household.tutorialSeenVersion=1;return s;}
function twoDogs(){let s=settled();s.profile.name='Molly';s=C.addDog(s,{name:'Spot'});return C.selectDogs(s,C.dogs(s).map(d=>d.id));}
async function main(){
  const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});let context,page,saves=[];
  const file=pathToFileURL(web+'/index.html').href;
  async function boot(s=settled(),hash=''){
    if(context)await context.close();
    context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.exposeBinding('edgeSave',(_,message)=>{if(message.action==='save'){saves.push(C.validateState(message.state));return {type:'saved',revision:message.state.revision};}return null;});
    await context.addInitScript(state=>{
      window.GOOD_GROUND_BOOT={native:true,state,error:null,smoke:false,lastRevision:state?.revision||0};
      window.webkit={messageHandlers:{ground:{postMessage:m=>window.edgeSave(m).then(reply=>{if(reply)window.GoodGround?.nativeMessage(reply);})}}};
      window.__soundStarts=0;const Audio=window.AudioContext||window.webkitAudioContext;
      if(Audio)window.AudioContext=function(...args){const ctx=new Audio(...args);window.__testAudio=ctx;const create=ctx.createBufferSource.bind(ctx);ctx.createBufferSource=function(){const node=create(),start=node.start.bind(node);node.start=(...a)=>{window.__soundStarts++;return start(...a);};return node;};return ctx;};
      window.__timeOffset=0;const ActualDate=Date;
      window.Date=class extends ActualDate{constructor(...args){super(...(args.length?args:[ActualDate.now()+window.__timeOffset]));}static now(){return ActualDate.now()+window.__timeOffset;}};
    },s);
    page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));
    await page.route('http{,s}://**',route=>{report.externalRequests.push(route.request().url());return route.abort();});
    await page.goto(file+hash);await page.waitForFunction(()=>GoodGround?.ready);
  }
  const snapshot=()=>page.evaluate(()=>GoodGround.snapshot());
  const nav=async hash=>{await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(h=>{const [type,id='']=h.replace('#/','').split('/'),main=document.querySelector('#main');return main?.dataset.route===type&&main?.dataset.pageId===decodeURIComponent(id);},hash);};
  const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
  try{
    await check('each touch, keyboard, held and assistive click schedules exactly one sound',async()=>{
      await boot(settled(),'#/clicker');const pad=page.locator('.marker-pad');
      await pad.tap();await page.waitForFunction(()=>window.__soundStarts===1);
      await pad.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.__soundStarts===2);
      await pad.dispatchEvent('click',{detail:1});await page.waitForFunction(()=>window.__soundStarts===3);
      const box=await pad.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
      await page.waitForFunction(()=>window.__soundStarts===4);
      for(let i=0;i<12;i++)await pad.tap();assert.equal(await page.evaluate(()=>window.__soundStarts),16);
      assert.equal((await snapshot()).sessions.length,0);
    });
    await check('a suspended audio context resumes after a real gesture and playback failures stay honest',async()=>{
      await page.evaluate(()=>window.__testAudio.suspend());await page.locator('.marker-pad').tap();await page.waitForFunction(()=>window.__testAudio.state==='running'&&window.__soundStarts===17);
      await page.evaluate(async()=>{await window.__testAudio.suspend();window.__testAudio.resume=()=>Promise.reject(new Error('Test playback unavailable'));});
      await page.locator('.marker-pad').tap();await page.getByText('Test playback unavailable',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__soundStarts),17);
      assert.equal((await snapshot()).sessions.length,0);
    });
    await check('setup resumes at the next dog and changing the count keeps saved profiles',async()=>{
      await boot(C.freshState());await page.locator('[name="householdSize"][value="multiple"]').check();await page.getByRole('button',{name:'Continue',exact:true}).click();
      await page.locator('[name="name"]').fill('Roxy');await page.locator('[name="rewards"]').fill('A small toy');await page.getByRole('button',{name:'Save & meet the next dog',exact:true}).click();
      const saved=await snapshot();assert.equal(saved.household.setupIndex,1);await boot(saved);
      assert.equal(await page.locator('[name="name"]').inputValue(),'');assert.equal((await snapshot()).profile.name,'Roxy');
      await page.getByRole('button',{name:'Change number of dogs',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
      assert.equal(await page.locator('[name="name"]').inputValue(),'Roxy');await page.getByRole('button',{name:'Skip profile for now',exact:true}).click();await page.getByRole('button',{name:'Skip tour',exact:true}).click();
      assert.equal((await snapshot()).profile.rewards,'A small toy');assert.equal(C.dogs(await snapshot()).length,1);
    });
    await check('switching from an invalid multi-dog count to one dog does not block setup',async()=>{
      await boot(C.freshState());await page.locator('[name="householdSize"][value="multiple"]').check();await page.locator('[name="dogCount"]').fill('1');await page.locator('[name="householdSize"][value="one"]').check();
      await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#setup-profile-form').waitFor();
    });
    await check('paused dogs are not selected for group progress changes without an explicit choice',async()=>{
      let s=twoDogs();const ids=C.dogs(s).map(d=>d.id);s=C.setDogProgress(s,[ids[0]],'NAME-1',C.STATUSES[4]);await boot(s,'#/lesson/NAME-1');
      await page.getByRole('button',{name:'Let’s practice',exact:true}).click();await page.locator('.lesson-title').waitFor();await page.getByRole('button',{name:'Set progress',exact:true}).click();
      assert.equal(await page.locator('[name="progressDog"][value="'+ids[0]+'"]').isChecked(),false);assert.equal(await page.locator('[name="progressDog"][value="'+ids[1]+'"]').isChecked(),true);
      await page.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();const after=await snapshot();assert.equal(C.status(C.dogState(after,ids[0]),'NAME-1'),C.STATUSES[4]);assert.equal(C.status(C.dogState(after,ids[1]),'NAME-1'),C.STATUSES[3]);assert.equal(page.url().endsWith('#/lesson/NAME-1'),true);
    });
    await check('choosing zero dogs shows a recoverable error without altering the selection',async()=>{
      await page.locator('.training-context button').click();const before=(await snapshot()).household.selectedIds;
      for(const input of await page.locator('[name="dogId"]').all())await input.uncheck();await page.getByRole('button',{name:'Let’s practice',exact:true}).click();await page.locator('.form-error:not([hidden])').waitFor();assert.deepEqual((await snapshot()).household.selectedIds,before);
      await page.locator('[name="dogId"]').first().check();await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
    });
    await check('a long background break asks who to train while preserving all dog records',async()=>{
      await nav('#/today');const before=await snapshot();
      await page.evaluate(()=>{window.__hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});document.dispatchEvent(new Event('visibilitychange'));window.__timeOffset+=31*60*1000;window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
      await page.locator('#dog-choice-form').waitFor();const after=await snapshot();assert.deepEqual(C.dogs(after),C.dogs(before));
      await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
    });
    await check('practice reminders refresh after backgrounding across a calendar week',async()=>{
      const s=settled(),date=C.dateToday(),skill=D.skills.find(x=>x.code==='SIT');
      for(const st of skill.steps)s.progress[st.id]={status:C.STATUSES[3],notes:'',updatedAt:new Date().toISOString(),completedAt:new Date().toISOString()};
      await boot(s,'#/today');assert.equal(await page.locator('.refresher-note').count(),0);
      await page.evaluate(()=>{window.__hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});document.dispatchEvent(new Event('visibilitychange'));window.__timeOffset+=8*86400000;window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
      await page.getByRole('heading',{name:'A gentle refresher?',exact:true}).waitFor();assert.equal((await snapshot()).sessions.length,0);
    });
    await check('a genuine legacy single-dog save opens with all records and no forced setup',async()=>{
      const s=settled();s.profile.name='Legacy companion';s.progress['NAME-1']={status:C.STATUSES[3],notes:'Keep this note',updatedAt:'2026-10-01T12:00:00Z'};s.sessions=[C.normalizeSession({id:'legacy-session',date:'2026-10-01',stepId:'NAME-1'})];
      delete s.household;delete s.cues;delete s.tailoring;delete s.profile.breed;s.settings={theme:'light',textSize:'normal'};
      await boot(s,'#/today');await page.locator('.home-heading').waitFor();const after=await snapshot();assert.equal(after.profile.name,'Legacy companion');assert.equal(after.sessions[0].id,'legacy-session');assert.equal(after.progress['NAME-1'].notes,'Keep this note');assert.equal(after.settings.markerVolume,25);assert.equal(await page.locator('#setup-profile-form').count(),0);
    });
    await check('fully learned curriculum still offers rest without inventing new lessons',async()=>{
      const s=settled();for(const skill of D.skills)for(const st of skill.steps)s.progress[st.id]={status:C.STATUSES[3],notes:'',updatedAt:'2026-10-01T12:00:00Z',completedAt:'2026-10-01T12:00:00Z'};
      await boot(s,'#/lesson/NAME-2');await page.getByRole('button',{name:'Set progress',exact:true}).click();await page.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();
      await page.getByRole('button',{name:'Enough for today',exact:true}).waitFor();assert.equal(await page.locator('.completion-choices .lesson-card').count(),0);assert.ok((await page.locator('.completion-fun').textContent()).includes('resting together'));
      await page.getByRole('button',{name:'Enough for today',exact:true}).click();
    });
    await check('an interrupted breed question never confirms a trait or skips an unfinished setup',async()=>{
      await boot(C.freshState());await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('[name="name"]').fill('Luna');
      await page.locator('[data-action="choose-breed"]').click();await page.locator('#breed-search').fill('Lagotto');await page.locator('[data-action="pick-breed"][data-value="Lagotto Romagnolo"]').click();await page.getByRole('button',{name:'Save & take a quick tour',exact:true}).click();
      await page.getByRole('heading',{name:'Does this fit Luna?',exact:true}).waitFor();const partial=await snapshot();assert.equal(partial.household.setupComplete,false);assert.equal(partial.household.setupIndex,0);assert.deepEqual(partial.tailoring.traits,[]);
      await boot(partial);assert.equal(await page.locator('[name="name"]').inputValue(),'Luna');await page.getByRole('button',{name:'Save & take a quick tour',exact:true}).click();await page.locator('.tour-symbol').waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual((await snapshot()).tailoring.traits,[]);
    });
    await check('an unnamed single dog can gain a named companion without losing the first record',async()=>{
      const s=settled();s.progress['NAME-1']={status:C.STATUSES[1],notes:'Keep the first dog’s notes.',updatedAt:'2026-10-01T12:00:00Z'};await boot(s,'#/dogs');await page.getByRole('button',{name:'Add a dog',exact:true}).click();await page.locator('#add-dog-form[data-rename-first="true"]').waitFor();
      await page.locator('[name="name"]').fill('First companion');await page.getByRole('button',{name:'Save & add the next dog',exact:true}).click();await page.locator('#add-dog-form[data-rename-first="false"]').waitFor();await page.locator('[name="name"]').fill('Second companion');await page.getByRole('button',{name:'Add this dog',exact:true}).click();await page.locator('#dog-choice-form').waitFor();
      const after=await snapshot();assert.deepEqual(C.dogs(after).map(d=>d.profile.name),['First companion','Second companion']);assert.equal(after.progress['NAME-1'].notes,'Keep the first dog’s notes.');assert.deepEqual(after.household.others[0].progress,{});
    });
    await check('five-dog first use still permits training just two companions',async()=>{
      await boot(C.freshState());await page.locator('[name="householdSize"][value="multiple"]').check();await page.locator('[name="dogCount"]').fill('5');await page.getByRole('button',{name:'Continue',exact:true}).click();
      for(let i=0;i<5;i++){await page.locator('[name="name"]').fill('Companion '+(i+1));await page.getByRole('button',{name:i===4?'Save & take a quick tour':'Save & meet the next dog',exact:true}).click();}
      await page.getByRole('button',{name:'Skip tour',exact:true}).click();await page.locator('#dog-choice-form').waitFor();const ids=C.dogs(await snapshot()).map(d=>d.id);await page.locator('[name="dogId"][value="'+ids[0]+'"]').uncheck();for(const i of [1,3])await page.locator('[name="dogId"][value="'+ids[i]+'"]').check();await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
      assert.deepEqual((await snapshot()).household.selectedIds,[ids[1],ids[3]]);assert.equal(C.dogs(await snapshot()).length,5);
    });
    await check('a full record store keeps an oversized note on screen until it can be saved',async()=>{
      const s=settled(),target=C.STORAGE_BYTES-1024;
      for(const st of D.skills.flatMap(s=>s.steps).filter(st=>st.id!=='SIT-1')){
        s.progress[st.id]={status:C.STATUSES[0],notes:'',updatedAt:'2026-10-01T12:00:00Z',completedAt:''};
        const remaining=target-new TextEncoder().encode(JSON.stringify(s)).length;
        if(remaining<=0){delete s.progress[st.id];break;}s.progress[st.id].notes='n'.repeat(Math.min(30000,remaining));
        if(remaining<=30000)break;
      }
      assert.ok(C.withinStorageLimit(s));await boot(s,'#/lesson/SIT-1');await openNotes(page);await page.locator('#step-notes').fill('a'.repeat(2000));await page.locator('#step-notes').blur();
      await page.locator('.tab-bar').getByRole('link',{name:'Today',exact:true}).click();assert.equal(page.url().endsWith('#/lesson/SIT-1'),true);assert.equal(await page.locator('#step-notes').inputValue(),'a'.repeat(2000));assert.equal((await snapshot()).progress['SIT-1'],undefined);
      await openNotes(page);await page.locator('#step-notes').fill('A shorter useful note.');await page.locator('#step-notes').blur();await page.locator('.tab-bar').getByRole('link',{name:'Today',exact:true}).click();await page.waitForURL('**#/today');assert.equal((await snapshot()).progress['SIT-1'].notes,'A shorter useful note.');
    });
    await check('new screens fit compact landscape and dark larger text without accessibility errors',async()=>{
      const s=twoDogs();s.profile.name='M'.repeat(100);s.tailoring.traits=['noise','novelty','handling'];s.household.others[0].profile.name='S'.repeat(100);s.settings.theme='dark';s.settings.textSize='large';await boot(s);await page.getByRole('button',{name:'Let’s practice',exact:true}).click();
      for(const dimensions of [{width:320,height:568},{width:568,height:320},{width:768,height:1024}]){
        await page.setViewportSize(dimensions);for(const hash of ['#/today','#/lesson/SIT-1','#/clicker','#/dogs','#/practice','#/profile/dog-1']){await nav(hash);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),hash+' '+JSON.stringify(dimensions));}
      }
      await page.setViewportSize({width:390,height:844});for(const hash of ['#/today','#/lesson/SIT-1','#/profile/dog-1','#/clicker','#/dogs','#/practice']){await nav(hash);const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.equal(a.violations.length,0,hash+': '+JSON.stringify(a.violations.map(v=>v.id)));}
      await nav('#/lesson/SIT-1');await page.screenshot({path:out+'/updated-dark-household-'+engine+'.png',fullPage:true});
    });
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);assert.ok(saves.length>0);for(const save of saves)C.validateState(save);
  }catch(error){
    report.failure=error.stack;
    report.layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1;}).slice(0,30).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,100),width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}));
    await page.screenshot({path:out+'/edge-failure-'+engine+'.png',fullPage:true});throw error;
  }finally{fs.writeFileSync(out+'/edge-'+engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
}
main().catch(e=>{report.failure=e.stack;fs.writeFileSync(out+'/edge-'+engine+'.json',JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;});

async function openNotes(page){const outer=page.locator('.extra-information');if(!await outer.count())return;if(await outer.getAttribute('open')===null)await outer.locator(':scope>summary').click();const notes=page.locator('[data-lesson-section=notes]');if(await notes.getAttribute('open')===null)await notes.locator(':scope>summary').click();}
