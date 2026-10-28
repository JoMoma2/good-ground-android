const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),C=require(root+'/app/web/core.js');
const D=JSON.parse(fs.readFileSync(root+'/app/web/data.json','utf8')),I=C.index(D);
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(root+'/app/web/data.js','utf8'),sandbox);
assert.equal(JSON.stringify(sandbox.window.GOOD_GROUND_DATA),JSON.stringify(D),'data.js/data.json differ');
const sources=new Set(D.sources.map(s=>s.id));assert.equal(sources.size,D.sources.length);
for(const s of D.skills){
  for(const key of ['code','title','sheet','goal','cue','setup','sources','priority'])assert.ok(typeof s[key]==='string'&&s[key].trim(),s.code+' '+key);
  for(const id of s.sources.split(';').map(x=>x.trim()).filter(Boolean))assert.ok(sources.has(id),s.code+' missing source '+id);
  for(const st of s.steps){
    assert.ok(typeof st.setup==='string'&&st.setup.trim().split(/\s+/).length>=12,st.id+' lacks reviewed preparation');
    assert.ok(st.teach.trim().split(/\s+/).length>=25,st.id+' is not a teaching guide');
    assert.ok(st.advance.length>=25&&st.easier.length>=20,st.id+' lacks criteria/adaptation');
  }
}
for(const t of D.triggers)assert.ok(I.steps.has(t.step),t.name+' bad trigger link');
for(const s of D.sources)assert.match(s.url,/^https?:\/\//);
for(const f of ['index.html','styles.css','app.js','core.js','data.js','marker.js','guide.js','tailoring.js','history.js','lesson-controls.js'])assert.ok(fs.existsSync(root+'/app/web/'+f));
const html=fs.readFileSync(root+'/app/web/index.html','utf8');assert.ok(html.includes("connect-src https://formspree.io/f/;"));assert.ok(html.includes('name="good-ground-feedback-form"'));
for(const f of ['app.js','core.js','marker.js','guide.js','tailoring.js','history.js','lesson-controls.js','styles.css']){
  const content=fs.readFileSync(root+'/app/web/'+f,'utf8');assert.ok(!/https?:\/\//.test(f==='app.js'?content.replaceAll('https://formspree.io/f/','').replaceAll('https://formspree.io/legal/privacy-policy/',''):content),'Unexpected remote code/resource in '+f);
}
console.log(`PASS: ${I.skills.size} skills, ${I.steps.size} real teaching steps, ${sources.size} source records, valid prerequisites, bundled offline resources.`);

// Every bundled dependency must also be allowed by the Android resource boundary.
const nativeActivity=path.join(root,'android/app/src/main/java/local/goodground/training/MainActivity.java');
if(fs.existsSync(nativeActivity)){const activity=fs.readFileSync(nativeActivity,'utf8'),allowed=activity.match(/ASSETS = new HashSet[\s\S]*?;/)[0];for(const match of html.matchAll(/(?:src|href)="([^"/]+\.(?:js|css|svg))"/g))assert.ok(allowed.includes('"'+match[1]+'"'),'Android blocks bundled resource '+match[1]);}
