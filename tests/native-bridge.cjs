// Exercises the shipped file:// UI and bridge contract. Swift is checked separately
// by scripts/simulator-smoke.sh on a macOS runner; this is not a device test.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const web=process.env.GG_WEB_ROOT||path.resolve(__dirname,'../app/web'),C=require(web+'/core.js'),D=require(web+'/data.json');
const root=path.resolve(__dirname,'..'),engineName=process.env.GG_BROWSER||'chromium';
const result={engine:engineName,checks:[],errors:[],swiftRuntimeTested:false};
async function main(){
  const b=await (engineName==='webkit'?webkit:chromium).launch({headless:true});
  let context,p;
  let saved=null,failSave=false,exported=null,importFile=null,messages=[];
  const handleNative=async(_,message)=>{
    messages.push(message);
    if(message.action==='save'){
      if(failSave)return {type:'saveError',message:'Simulated test write failure. Export or retry.'};
      saved=C.validateState(message.state);return {type:'saved',revision:saved.revision};
    }
    if(message.action==='export'){exported=C.parseBackup(message.json);return null;}
    if(message.action==='import'&&importFile)return {type:'import',json:importFile};
    return null;
  };
  async function newSession(state){
    if(!state){state=C.freshState();state.settings.lessonMode='detailed';state.household.setupComplete=true;state.household.tutorialSeenVersion=1;}
    if(context)await context.close();
    context=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.exposeBinding('mockNative',handleNative);
    await context.addInitScript(state=>{
    window.GOOD_GROUND_BOOT={native:true,state,error:null,smoke:false,lastRevision:state?.revision||0};
    window.webkit={messageHandlers:{ground:{postMessage:message=>{window.mockNative(message).then(reply=>{if(reply)window.GoodGround?.nativeMessage(reply);});}}}};
  },state);
    p=await context.newPage();p.on('pageerror',e=>result.errors.push(e.message));
  }
  await newSession(null);
  const file=pathToFileURL(web+'/index.html').href;
  const go=async hash=>{if(p.url().startsWith(file)){await p.evaluate(h=>location.hash=h,hash||'');await p.waitForTimeout(30);}else{await p.goto(file+(hash||''));await p.waitForFunction(()=>window.GoodGround?.ready);}};
  const check=async(name,fn)=>{await fn();result.checks.push(name);console.log('PASS '+name);};
  try{
    await check('bundled local file opens with the native bridge and no server',async()=>{await go('');await p.getByRole('heading',{name:'Small steps. Better days.'}).waitFor();assert.equal(await p.getByText('Works offline. Saved on your phone.').count(),1);});
    await check('native save sends complete valid state and receives acknowledgement',async()=>{
      await go('#/lesson/NAME-1');await p.getByRole('button',{name:'Set progress',exact:true}).click();await p.locator('[data-action="set-progress"][data-value="Consistent - move on"]').click();
      await p.waitForTimeout(100);assert.equal(saved.progress['NAME-1'].status,C.STATUSES[3]);assert.equal(await p.locator('#save-warning').isVisible(),false);
    });
    await newSession(saved);
    await check('cold boot uses the state supplied by the native file store',async()=>{await go('#/lesson/NAME-2');await p.getByText('Ready to start',{exact:true}).waitFor();assert.equal((await p.evaluate(()=>GoodGround.snapshot())).progress['NAME-1'].status,C.STATUSES[3]);});
    await check('lesson swipes navigate and never alter progress',async()=>{
      await p.locator('.teaching-copy').evaluate(el=>{
        for(const [type,x] of [['touchstart',80],['touchend',270]]){
          const event=new Event(type,{bubbles:true});Object.defineProperty(event,'touches',{value:[{clientX:x,clientY:300}]});Object.defineProperty(event,'changedTouches',{value:[{clientX:x,clientY:300}]});el.dispatchEvent(event);
        }
      });await p.waitForURL('**#/lesson/NAME-1');assert.equal((await p.evaluate(()=>GoodGround.snapshot())).progress['NAME-2'],undefined);
    });
    await check('write failures stay visible and an older acknowledgement cannot hide them',async()=>{
      failSave=true;await p.getByRole('button',{name:'Set progress',exact:true}).click();await p.locator('[data-action="set-progress"][data-value="Working on"]').click();await p.locator('#save-warning').waitFor();
      await p.evaluate(()=>GoodGround.nativeMessage({type:'saved',revision:-1}));assert.equal(await p.locator('#save-warning').isVisible(),true);
      failSave=false;await p.getByRole('button',{name:'Retry save',exact:true}).click();await p.waitForTimeout(100);assert.equal(await p.locator('#save-warning').isVisible(),false);assert.equal(saved.progress['NAME-1'].status,C.STATUSES[1]);
    });
    await check('native export includes current records without requesting a web download',async()=>{await go('#/backup');await p.getByRole('button',{name:'Save backup to Files',exact:true}).click();await p.waitForTimeout(100);assert.ok(exported);assert.equal(exported.progress['NAME-1'].status,C.STATUSES[1]);});
    await check('native import confirms and restores at a newer save revision',async()=>{
      const s=C.freshState();s.settings.lessonMode='detailed';s.household.setupComplete=true;s.household.tutorialSeenVersion=1;s.profile.name='Imported native test';s.revision=500;importFile=JSON.stringify(C.makeBackup(s,D));
      await p.getByRole('button',{name:'Choose backup file',exact:true}).click();await p.getByRole('dialog').waitFor();assert.notEqual((await p.evaluate(()=>GoodGround.snapshot())).profile.name,s.profile.name);
      await p.getByRole('button',{name:'Restore backup',exact:true}).click();await p.waitForTimeout(100);assert.equal(saved.profile.name,s.profile.name);assert.ok(saved.revision>500);
    });
    await check('corrupt saved records are not silently replaced or exported as an empty backup',async()=>{
      await newSession({schema:1,revision:700,broken:true});
      const before=messages.filter(x=>x.action==='save').length;await go('#/profile');await p.locator('.load-error strong').getByText('Saved data needs attention.').waitFor();
      await p.locator('[name="name"]').fill('Must not overwrite');await p.getByRole('button',{name:'Save profile',exact:true}).click();assert.equal(messages.filter(x=>x.action==='save').length,before);
      await go('#/backup');await p.getByRole('button',{name:'Leave without saving',exact:true}).click();await p.getByRole('button',{name:'Save backup to Files',exact:true}).waitFor();exported=null;await p.getByRole('button',{name:'Save backup to Files',exact:true}).click();await p.waitForTimeout(100);assert.equal(exported,null);
      importFile=JSON.stringify(C.makeBackup(C.freshState(),D));await p.getByRole('button',{name:'Choose backup file',exact:true}).click();await p.getByRole('button',{name:'Restore backup',exact:true}).click();await p.waitForTimeout(100);assert.ok(saved.revision>700,'Restoring over a corrupt high-revision file must advance the native save revision');
    });
    assert.equal(result.errors.length,0,result.errors.join('\n'));
  }finally{fs.mkdirSync(root+'/test-results',{recursive:true});fs.writeFileSync(root+'/test-results/bridge-'+engineName+'.json',JSON.stringify(result,null,2)+'\n');await b.close();}
}
main().catch(e=>{result.failure=e.stack;fs.writeFileSync(root+'/test-results/bridge-'+engineName+'.json',JSON.stringify(result,null,2)+'\n');console.error(e);process.exitCode=1;});
