// Exercises actual interfaces and exchange logic through a simulated native bridge.
// This deliberately does NOT assert Network.framework or LiveContainer connectivity.
const {chromium,webkit}=require('playwright'),{AxeBuilder}=require('@axe-core/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),web=process.env.GG_WEB_ROOT||root+'/app/web',C=require(web+'/core.js'),M=require(web+'/sharing.js'),S=M.withCore(C),D=require(web+'/data.json'),engine=process.env.GG_BROWSER||'chromium';
const report={engine,simulatedNative:true,physicalConnectivityTested:false,checks:[],errors:[]};
const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+(req.url.split('?')[0]==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));if(!f.startsWith(web+'/')){res.writeHead(403);return res.end();}fs.readFile(f,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'});res.end(err?'Missing':data);});});
function fresh(name){let s=S.setTrainerName(C.freshState(),name);s.profile.name='Buddy';s.household.setupComplete=true;s.household.tutorialSeenVersion=2;return s;}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await ({chromium,webkit}[engine]).launch();
 const pages=[],contexts=[],saved=[null,null],starts=[null,null],approved=[false,false],bound=[false,false],messages=[[],[]];let initiating=0;
 const emit=(i,m)=>pages[i].evaluate(m=>window.GoodGround?.nativeMessage(m),m);
 async function handle(i,m){
  messages[i].push(m);
  if(m.action==='save'){saved[i]=C.validateState(m.state);return {type:'saved',revision:saved[i].revision};}
  if(m.action==='nearbyStart'){starts[i]=m;setTimeout(async()=>{await emit(i,{type:'nearbySearching',address:'192.168.1.'+(20+i)+':50123'});if(starts.every(Boolean))for(let p=0;p<2;p++)await emit(p,{type:'nearbyDevices',devices:[{id:'device-'+(1-p),name:starts[1-p].trainerName}]});},0);}
  if(m.action==='nearbyConnect'){initiating=i;approved.fill(false);bound.fill(false);setTimeout(async()=>{for(let p=0;p<2;p++)await emit(p,{type:'nearbyPairRequest',token:'pair-token-'+p,name:starts[1-p].trainerName,code:'123456'});},0);}
  if(m.action==='nearbyApprove'){approved[i]=true;if(approved.every(Boolean))setTimeout(async()=>{for(let p=0;p<2;p++)await emit(p,{type:'nearbyApproved',token:'pair-token-'+p,peerId:starts[1-p].trainerId,name:starts[1-p].trainerName,dogId:starts[initiating].dogId});},0);}
  if(m.action==='nearbyBind'){bound[i]=true;if(bound.every(Boolean))setTimeout(async()=>{for(const p of [1-initiating,initiating])await emit(p,{type:'nearbyReady',peerId:starts[1-p].trainerId,name:starts[1-p].trainerName,initiator:p===initiating});},0);}
  if(m.action==='nearbySend'){setTimeout(()=>emit(1-i,{type:'nearbyMessage',message:m.message}),0);return {type:'nearbySent',requestId:m.requestId};}
  if(m.action==='nearbyDisconnect'){setTimeout(()=>emit(i,{type:'nearbyDisconnected',message:'Disconnected in test.'}),0);}
  return null;
 }
 async function boot(i,s,hash='#/today',supported=true){
  if(contexts[i])await contexts[i].close();const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});contexts[i]=ctx;
  await ctx.exposeBinding('mockNative',(_,m)=>handle(i,m));
  await ctx.addInitScript(({s,supported})=>{window.GOOD_GROUND_BOOT={native:true,nearbySupported:supported,state:s,error:null};window.webkit={messageHandlers:{ground:{postMessage:m=>window.mockNative(m).then(reply=>{if(reply)window.GoodGround?.nativeMessage(reply);})}}};},{s,supported});
  const p=await ctx.newPage();pages[i]=p;p.on('pageerror',e=>report.errors.push(e.message));p.setDefaultTimeout(8000);await p.goto(origin+'/'+hash);await p.waitForFunction(()=>window.GoodGround?.ready);
 }
 async function nav(i,hash){await pages[i].evaluate(h=>location.hash=h,hash);await pages[i].waitForFunction(h=>document.querySelector('#main')?.dataset.route===h.slice(2).split('/')[0],hash);}
 const snap=i=>pages[i].evaluate(()=>GoodGround.snapshot());
 async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
 async function rule(i,title,description){const p=pages[i];await nav(i,'#/household/dog-1');await p.getByRole('button',{name:'Add household rule',exact:true}).click();await p.locator('[name=title]').fill(title);await p.locator('[name=description]').fill(description);await p.getByRole('button',{name:'Save rule',exact:true}).click();}
 async function note(i,text){const p=pages[i];await nav(i,'#/lesson/SIT-1');await p.locator('.extra-information>summary').click();await p.locator('[data-lesson-section=notes]>summary').click();await p.getByRole('button',{name:'Add training note',exact:true}).click();await p.locator('[name=text]').fill(text);await p.getByRole('button',{name:'Save note',exact:true}).click();}
 try{
  await check('Skip for Now rotates only the queue, including wraparound and route changes',async()=>{
   let s=fresh('Quinten');for(const code of ['NAME','SIT','DOWN'])for(const st of D.skills.find(x=>x.code===code).steps)s=C.setProgress(s,st.id,C.STATUSES[3]);await boot(0,s);
   const p=pages[0],before=await snap(0),first=await p.locator('[data-daily-practice]').getAttribute('data-id');await p.getByRole('button',{name:'Skip for Now',exact:true}).click();const second=await p.locator('[data-daily-practice]').getAttribute('data-id');assert.notEqual(first,second);assert.deepEqual(await snap(0),before);
   await nav(0,'#/practice');assert.equal(await p.locator('[data-daily-practice]').getAttribute('data-id'),second);await p.getByRole('button',{name:'Skip for Now',exact:true}).click();await p.getByRole('button',{name:'Skip for Now',exact:true}).click();assert.equal(await p.locator('[data-daily-practice]').getAttribute('data-id'),first);assert.deepEqual(await snap(0),before);
   await p.locator('[data-daily-practice]').click();const after=await snap(0);assert.equal(after.sessions.length,before.sessions.length+1);assert.deepEqual(after.progress,before.progress);assert.notEqual(await p.locator('[data-daily-practice]').getAttribute('data-id'),first);
  });
  await check('one trainer identity, local household rules and authored notes work without pairing',async()=>{
   await boot(0,fresh('Quinten'));const id=(await snap(0)).trainer.id;await nav(0,'#/trainer');await pages[0].locator('[name=name]').fill('Q');await pages[0].getByRole('button',{name:'Save trainer name',exact:true}).click();assert.equal((await snap(0)).trainer.id,id);assert.equal(await pages[0].locator('select[name=trainer]').count(),0);
   await rule(0,'Dinner','Calm setup before food.');assert.equal(S.records(await snap(0),'dog-1','rule')[0].value.title,'Dinner');await note(0,'Stand in front and reward the sit.');assert.equal(S.records(await snap(0),'dog-1','note')[0].owner,id);
   const a=await new AxeBuilder({page:pages[0]}).analyze();assert.deepEqual(a.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
  });
  await check('pairing requires both approvals before any dog-data transfer',async()=>{
   await boot(1,fresh('Abby'));await note(1,'Works best after a sniff break.');for(let i=0;i<2;i++){await nav(i,'#/nearby/dog-1');await pages[i].getByRole('button',{name:'Look for Nearby Devices',exact:true}).click();}
   await pages[0].getByRole('button',{name:'Abby',exact:true}).click();for(const p of pages)await p.locator('.verification-code').waitFor();
   assert.ok(messages.every(ms=>!ms.some(m=>m.action==='nearbySend')));await pages[0].getByRole('button',{name:'Codes match — approve',exact:true}).click();assert.ok(messages.every(ms=>!ms.some(m=>m.action==='nearbySend')));await pages[1].getByRole('button',{name:'Codes match — approve',exact:true}).click();
   for(const p of pages)await p.waitForFunction(()=>document.querySelector('.nearby-status')?.textContent.includes('Exchange confirmed'));
   for(let i=0;i<2;i++){const s=await snap(i);assert.equal(S.records(s,'dog-1','note').length,2);assert.equal(S.records(s,'dog-1','rule').length,1);assert.ok(Object.values(S.data(s,'dog-1').peers)[0].lastSuccessfulSyncAt);}
  });
  await check('independent local progress is exchanged and displayed read only in Extra Information',async()=>{
   await nav(0,'#/lesson/SIT-1');await pages[0].getByRole('button',{name:'Set progress',exact:true}).click();await pages[0].locator('[data-action=set-progress]').nth(3).click();
   await nav(1,'#/lesson/HEEL-1');await pages[1].getByRole('button',{name:'Set progress',exact:true}).click();await pages[1].locator('[data-action=set-progress]').nth(1).click();
   for(let i=0;i<2;i++)await nav(i,'#/nearby/dog-1');await pages[1].getByRole('button',{name:'Sync Now',exact:true}).click();for(const p of pages)await p.waitForFunction(()=>document.querySelector('.nearby-status')?.textContent.includes('Exchange confirmed'));
   const a=await snap(0),b=await snap(1);assert.equal(a.progress['SIT-1'].status,C.STATUSES[3]);assert.equal(b.progress['SIT-1'],undefined);assert.equal(S.peerProgress(b,'dog-1',a.trainer.id)['SIT-1'].status,C.STATUSES[3]);assert.equal(a.progress['HEEL-1'],undefined);
   await nav(1,'#/lesson/SIT-1');await pages[1].locator('.extra-information>summary').click();await pages[1].locator('[data-lesson-section=notes]>summary').click();assert.ok((await pages[1].locator('.trainer-comparison').textContent()).includes('Q'));assert.equal(await pages[1].getByRole('button',{name:'Edit your note',exact:true}).count(),1);assert.equal(await pages[1].locator('.shared-note').count(),2);
  });
  await check('concurrent household edits preserve both revisions, resolution and deletion survive another exchange',async()=>{
   for(let i=0;i<2;i++){await nav(i,'#/household/dog-1');await pages[i].getByRole('button',{name:'Edit rule',exact:true}).click();await pages[i].locator('[name=description]').fill(i?'Abby revision':'Quinten revision');await pages[i].getByRole('button',{name:'Save rule',exact:true}).click();}
   for(let i=0;i<2;i++)await nav(i,'#/nearby/dog-1');await pages[0].getByRole('button',{name:'Sync Now',exact:true}).click();for(const p of pages)await p.waitForFunction(()=>document.querySelector('.nearby-status')?.textContent.includes('Exchange confirmed'));
   await nav(0,'#/household/dog-1');assert.equal(await pages[0].locator('.shared-version').count(),2);await pages[0].getByRole('button',{name:'Write a combined revision',exact:true}).click();await pages[0].locator('[name=description]').fill('Both observations combined.');await pages[0].getByRole('button',{name:'Save rule',exact:true}).click();await pages[0].getByRole('button',{name:'Remove rule',exact:true}).click();await pages[0].getByRole('dialog').getByRole('button',{name:'Remove rule',exact:true}).click();
   await nav(0,'#/nearby/dog-1');await pages[0].getByRole('button',{name:'Sync Now',exact:true}).click();for(const p of pages)await p.waitForFunction(()=>document.querySelector('.nearby-status')?.textContent.includes('Exchange confirmed'));assert.ok(S.records(await snap(1),'dog-1','rule')[0].deleted);
  });
  await check('disconnect revokes approval while retaining received read-only records',async()=>{
   await nav(0,'#/nearby/dog-1');await pages[0].getByRole('button',{name:'Disconnect trainer',exact:true}).click();await pages[0].getByRole('dialog').getByRole('button',{name:'Disconnect trainer',exact:true}).click();const a=await snap(0);assert.equal(Object.values(S.data(a,'dog-1').peers)[0].approved,false);assert.equal(S.records(a,'dog-1','note').length,2);assert.ok(messages[0].some(m=>m.action==='nearbyForget'));
  });
  await check('old native builds truthfully disable wireless discovery while retaining local rules',async()=>{await boot(0,fresh('Quinten'),'#/nearby/dog-1',false);assert.equal(await pages[0].getByRole('button',{name:'Look for Nearby Devices',exact:true}).count(),0);assert.ok((await pages[0].locator('#main').textContent()).includes('fresh iPhone build'));await rule(0,'Bedtime','Calm and comfortable.');});
  await check('More exposes independent Syncing with dog choice; profile is no longer its entry point',async()=>{
   let s=C.addDog(fresh('Quinten'),{name:'Poppy'});const other=C.dogs(s)[1].id;await boot(0,s,'#/more');const p=pages[0];
   if(await p.locator('#dog-choice-form').count())await p.getByRole('button',{name:'Let’s practice',exact:true}).click();
   await nav(0,'#/more');await p.getByRole('link',{name:/^Syncing/}).click();await p.getByRole('heading',{name:'Syncing.',exact:true}).waitFor();
   const before=await snap(0);await p.locator('[data-sync-dog]').selectOption(other);await p.waitForFunction(id=>document.querySelector('[data-sync-dog]')?.value===id,other);assert.deepEqual(await snap(0),before);
   await p.getByRole('button',{name:'Look for Nearby Devices',exact:true}).click();assert.equal(await p.locator('[data-sync-dog]').isDisabled(),true);assert.equal(messages[0].filter(x=>x.action==='nearbyStart').at(-1).dogId,S.data(await snap(0),other).id);
   await nav(0,'#/more');assert.ok(messages[0].some(x=>x.action==='nearbyStop'));
   await nav(0,'#/profile/dog-1');assert.equal(await p.locator('a[href^="#/household"],a[href^="#/nearby"]').count(),0);
  });
  await check('Journal shows dog-specific rules above sessions, and selectors never change training records',async()=>{
   let s=C.addDog(fresh('Quinten'),{name:'Poppy'});const other=C.dogs(s)[1].id;s=S.write(s,'dog-1','rule',null,{title:'Buddy dinner',description:'Wait comfortably.'});s=S.write(s,other,'rule',null,{title:'Poppy bedtime',description:'Settle with a comfortable routine.'});
   await boot(0,s,'#/journal');const p=pages[0];if(await p.locator('#dog-choice-form').count())await p.getByRole('button',{name:'Let’s practice',exact:true}).click();await nav(0,'#/journal');
   assert.ok((await p.locator('.journal-rules').textContent()).includes('Buddy dinner'));assert.ok(!(await p.locator('.journal-rules').textContent()).includes('Poppy bedtime'));
   assert.ok(await p.locator('.journal-rules').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('a[href="#/session"]'))&Node.DOCUMENT_POSITION_FOLLOWING)));
   const before=await snap(0);await p.locator('[data-rules-dog]').selectOption(other);assert.deepEqual(await snap(0),before);assert.ok((await p.locator('.journal-rules').textContent()).includes('Poppy bedtime'));assert.ok(!(await p.locator('.journal-rules').textContent()).includes('Buddy dinner'));
   await p.getByRole('link',{name:'Manage rules',exact:true}).click();await p.getByRole('heading',{name:'Household rules.',exact:true}).waitFor();assert.equal(await p.locator('[data-rules-dog]').inputValue(),other);assert.equal(await p.locator('.tab.active').textContent(),'Journal');assert.equal(await p.getByRole('heading',{name:'Trainers',exact:true}).count(),0);
   await p.getByRole('button',{name:'Add household rule',exact:true}).click();await p.locator('[name=title]').fill('Poppy mealtime');await p.getByRole('button',{name:'Save rule',exact:true}).click();const after=await snap(0);assert.equal(S.records(after,'dog-1','rule').length,1);assert.equal(S.records(after,other,'rule').length,2);assert.deepEqual(after.sessions,before.sessions);assert.deepEqual(after.progress,before.progress);
   const axe=await new AxeBuilder({page:p}).analyze();assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
  });
  assert.deepEqual(report.errors,[]);
 }finally{fs.mkdirSync(root+'/test-results',{recursive:true});fs.writeFileSync(root+'/test-results/sharing-'+engine+'.json',JSON.stringify(report,null,2));await browser.close();server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close();});
