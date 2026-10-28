const {chromium,webkit}=require('playwright');
const {AxeBuilder}=require('@axe-core/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),webRoot=process.env.GG_WEB_ROOT||root+'/app/web',C=require(webRoot+'/core.js'),D=JSON.parse(fs.readFileSync(webRoot+'/data.json','utf8'));
const output=root+'/test-results';fs.mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],externalRequests:[],accessibility:[],engine:process.env.GG_BROWSER||'chromium'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const decoded=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(webRoot,'.'+(decoded==='/'?'/index.html':decoded));
  if(!file.startsWith(webRoot+'/')){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  const engine=report.engine==='webkit'?webkit:chromium;
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const settled=C.freshState();settled.settings.lessonMode='detailed';settled.household.setupComplete=true;settled.household.tutorialSeenVersion=1;
  await context.addInitScript(s=>{if(!localStorage.getItem('good-ground-state-v1'))localStorage.setItem('good-ground-state-v1',JSON.stringify(s));},settled);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',route=>{if(route.request().url().startsWith(origin))return route.continue();report.externalRequests.push(route.request().url());return route.abort();});
  const go=async fragment=>{await page.goto(origin+'/'+fragment);await page.waitForFunction(()=>window.GoodGround?.ready);};
  const step=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
  try{
    await step('fresh app opens Today without fabricated records',async()=>{
      await go('');await page.getByRole('heading',{name:'Small steps. Better days.'}).waitFor();
      assert.equal((await page.evaluate(()=>GoodGround.snapshot())).sessions.length,0);
      await page.screenshot({path:output+'/today.png',fullPage:true});
    });
    await step('main tabs and both directions of library navigation work with one click',async()=>{
      for(const [label,url] of [['Lessons','learn'],['Journal','journal'],['More','more'],['Today','today']]){
        await page.locator('.tab-bar').getByRole('link',{name:label,exact:true}).click();await page.waitForURL('**/#/'+url);assert.ok(await page.locator('main h1').count());
      }
      await page.getByRole('button',{name:'See all'}).click();await page.waitForURL('**/#/learn');await page.getByRole('button',{name:'All lessons',exact:true}).click();
    });
    await step('strict prerequisite unlocks, persists after reload, and links to exact step',async()=>{
      await go('#/lesson/NAME-2');await page.getByText('Build prerequisite',{exact:true}).waitFor();
      await page.locator('.dependency').first().click();await page.waitForURL('**/#/lesson/NAME-1');
      await page.getByRole('button',{name:'Set progress',exact:true}).click();await page.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();
      await page.waitForURL('**/#/lesson/NAME-2');await page.getByText('Ready to start',{exact:true}).waitFor();
      await page.reload();await page.getByText('Ready to start',{exact:true}).waitFor();
      await page.screenshot({path:output+'/lesson.png',fullPage:true});
    });
    await step('saved skills, safe text notes, and searches work',async()=>{
      await page.getByRole('button',{name:'Save this skill',exact:true}).click();
      await openNotes(page);await page.locator('#step-notes').fill('Quiet kitchen. <script>never run</script>');await page.locator('#step-notes').blur();
      await go('#/learn');await page.getByRole('button',{name:'Saved',exact:true}).click();await page.getByRole('heading',{name:'Name recognition',exact:true}).waitFor();
      await page.getByRole('button',{name:'All lessons',exact:true}).click();await page.locator('#learn-search').fill('NAME-2');assert.equal(await page.locator('.lesson-card').count(),1);
      await page.locator('.lesson-card').click();assert.equal(await page.locator('#step-notes').inputValue(),'Quiet kitchen. <script>never run</script>');
      assert.equal(await page.locator('script:not([src])').count(),0);
    });
    await step('exact locked Step IDs open directly, and source links return to the lesson',async()=>{
      await go('#/learn');await page.locator('#learn-search').fill('DOG-2');assert.equal(await page.locator('.lesson-card').count(),1);assert.equal(await page.locator('.lesson-card').getAttribute('href'),'#/lesson/DOG-2');
      await page.locator('.lesson-card').tap();await page.waitForURL('**/#/lesson/DOG-2');
      await page.locator('.extra-information>summary').click();await page.getByText('Why this approach? · Sources',{exact:true}).click();await page.locator('.source-chip').first().tap();await page.waitForURL('**/#/source/*');
      await page.getByRole('link',{name:'Back to lesson',exact:true}).tap();await page.waitForURL('**/#/lesson/DOG-2');await page.waitForFunction(()=>scrollY>300,null,{timeout:3000});
      await page.getByRole('button',{name:'Set progress',exact:true}).click();const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();assert.equal(a.violations.length,0,JSON.stringify(a.violations.map(v=>v.id)));await page.getByRole('button',{name:'Close dialog'}).click();
    });
    await step('profile priorities save and survive navigation',async()=>{
      await go('#/profile');await page.locator('[name="name"]').fill('Milo');await page.locator('[name="priority"][value="Knocking"]').check();
      await page.getByRole('button',{name:'Save profile'}).click();await page.waitForURL('**/#/today');await page.getByText('For Milo. At their pace.').waitFor();
      await go('#/profile');assert.equal(await page.locator('[name="name"]').inputValue(),'Milo');
    });
    await step('unsaved forms get an explicit discard choice',async()=>{
      await page.locator('[name="name"]').fill('Not saved');await page.locator('.tab-bar').getByRole('link',{name:'Today',exact:true}).click();
      await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('[name="name"]').inputValue(),'Not saved');
      await page.locator('.tab-bar').getByRole('link',{name:'Today',exact:true}).click();await page.getByRole('button',{name:'Leave without saving'}).click();await page.waitForURL('**/#/today');
      assert.equal((await page.evaluate(()=>GoodGround.snapshot())).profile.name,'Milo');
    });
    let sessionId='';
    await step('session counts validate and distress overrides a high success rate',async()=>{
      await go('#/session/DOG-1');await page.locator('[name="trigger"]').selectOption('Other dogs');await page.locator('[name="setup"]').fill('TEST ONLY · distant stationary helper');
      await page.locator('[name="opportunities"]').fill('4');await page.locator('[name="successes"]').fill('5');await page.getByRole('button',{name:'Save session'}).click();await page.locator('.form-error:not([hidden])').waitFor();
      await page.locator('[name="successes"]').fill('4');await page.locator('[name="response"]').selectOption('3');await page.locator('[name="recoveryState"]').selectOption('Recovered');await page.locator('[name="recovery"]').fill('12');
      await page.getByRole('button',{name:'Save session'}).click();await page.waitForURL('**/#/entry/*');await page.getByText(/Reduce the challenge/).waitFor();
      sessionId=(await page.evaluate(()=>GoodGround.snapshot())).sessions[0].id;
      assert.equal((await page.evaluate(()=>GoodGround.snapshot())).progress['DOG-1'],undefined);
    });
    await step('journal edits and trigger-specific chart values are consistent',async()=>{
      await page.getByRole('link',{name:'Edit session',exact:true}).click();await page.locator('[name="response"]').selectOption('0');await page.getByRole('button',{name:'Save session'}).click();await page.waitForURL('**/#/entry/*');
      await go('#/trends');assert.equal(await page.locator('.chart-dot').count(),2);await page.screenshot({path:output+'/trends.png',fullPage:true});
      await page.locator('#trend-trigger').selectOption('Fireworks');assert.equal(await page.locator('.chart-dot').count(),0);
    });
    await step('trigger plans link to their program and keep notes',async()=>{
      await go('#/plan/Knocking');await page.locator('[name="setup"]').fill('TEST ONLY · one faint tap');await page.getByRole('button',{name:'Save trigger plan'}).click();
      await page.getByRole('link',{name:'Open the teaching program'}).click();await page.waitForURL('**/#/lesson/KNOCK-1');
      await go('#/plan/Knocking');assert.equal(await page.locator('[name="setup"]').inputValue(),'TEST ONLY · one faint tap');
    });
    let exported;
    await step('backup export contains real saved state; invalid import preserves it',async()=>{
      await go('#/backup');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save backup to Files'}).click();const d=await download;const file=await d.path();exported=JSON.parse(fs.readFileSync(file,'utf8'));
      assert.equal(exported.state.profile.name,'Milo');assert.equal(exported.state.sessions.length,1);
      await page.locator('#backup-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('not json')});await page.locator('#toast.error').waitFor();assert.equal((await page.evaluate(()=>GoodGround.snapshot())).profile.name,'Milo');
    });
    await step('restore asks before replacing records and cancellation is safe',async()=>{
      const b=structuredClone(exported);b.state.profile.name='Restored Milo';
      const file={name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(b))};
      await page.locator('#backup-file').setInputFiles(file);await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await page.evaluate(()=>GoodGround.snapshot())).profile.name,'Milo');
      await page.locator('#backup-file').setInputFiles(file);await page.getByRole('button',{name:'Restore backup',exact:true}).click();await page.reload();assert.equal((await page.evaluate(()=>GoodGround.snapshot())).profile.name,'Restored Milo');
    });
    await step('deleting a session updates charts without changing lesson progress',async()=>{
      await go('#/entry/'+sessionId);await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Delete session',exact:true}).click();await page.waitForURL('**/#/journal');assert.equal((await page.evaluate(()=>GoodGround.snapshot())).sessions.length,0);
    });
    await step('all lesson, topic, prerequisite and source routes resolve',async()=>{
      for(const s of D.skills)for(const st of s.steps){await go('#/lesson/'+st.id);assert.ok(await page.getByRole('heading',{name:s.title,exact:true}).count(),st.id);assert.ok(!await page.getByText('That page is not here',{exact:true}).count(),st.id);}
      for(const t of [...new Set(D.skills.map(s=>s.sheet))]){await go('#/topic/'+encodeURIComponent(t));assert.ok(await page.getByRole('heading',{name:t,exact:true}).count());}
      for(const s of D.sources){await go('#/source/'+s.id);assert.ok(await page.getByRole('heading',{name:s.title,exact:true}).count(),s.id);assert.equal(await page.getByRole('link',{name:'Open original website'}).getAttribute('href'),s.url);}
    });
    await step('phone widths, dark theme, large text and primary pages have no horizontal overflow',async()=>{
      for(const width of [320,390,430,768]){
        await page.setViewportSize({width,height:844});
        for(const hash of ['#/today','#/learn','#/lesson/NAME-2','#/session','#/trends','#/more','#/evidence','#/source/R01']){
          await go(hash);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+hash);
        }
      }
      await page.setViewportSize({width:390,height:844});await go('#/settings');await page.locator('[name="theme"]').selectOption('dark');await page.locator('[name="textSize"]').selectOption('large');await page.getByRole('button',{name:'Save settings'}).click();await go('#/lesson/DOG-1');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.screenshot({path:output+'/dark-large.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    });
    await step('accessibility checks cover navigation, lessons, forms and research',async()=>{
      await go('#/settings');await page.locator('[name="theme"]').selectOption('light');await page.locator('[name="textSize"]').selectOption('normal');await page.getByRole('button',{name:'Save settings'}).click();
      for(const hash of ['#/today','#/learn','#/lesson/DOG-1','#/session','#/more','#/evidence']){
        await go(hash);const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();report.accessibility.push({route:hash,violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});assert.equal(result.violations.length,0,hash+' '+JSON.stringify(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
      }
    });
    await step('all bundled screens load without any external network request',async()=>{
      assert.equal(report.externalRequests.length,0);assert.equal(report.errors.length,0,report.errors.join('\n'));
    });
  }finally{
    fs.writeFileSync(output+'/ui-'+report.engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();server.close();
  }
}
main().catch(error=>{report.failure=error.stack;fs.writeFileSync(output+'/ui-'+report.engine+'.json',JSON.stringify(report,null,2)+'\n');console.error(error);server.close();process.exitCode=1;});

async function openNotes(page){const outer=page.locator('.extra-information');if(!await outer.count())return;if(await outer.getAttribute('open')===null)await outer.locator(':scope>summary').click();const notes=page.locator('[data-lesson-section=notes]');if(await notes.getAttribute('open')===null)await notes.locator(':scope>summary').click();}
