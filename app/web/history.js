/* Calendar-spaced daily skill-completion history. Uses only saved observations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroundHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const palette=['#246c50','#91602c','#366cb1','#a04969','#6c5aa7','#8c6238','#32717c','#a44f2b','#527335','#866198','#3b6588','#927122','#a34747','#397567','#6c6797'];
 function series(history,today){
  const rows=history.filter(r=>r.date<=today),names=[...new Set(rows.flatMap(r=>Object.keys(r.topics)))];
  return names.map((name,i)=>({name,index:i,active:Object.hasOwn(rows.at(-1).topics,name),points:rows.filter(r=>r.topics[name]).map(r=>({date:r.date,value:100*r.topics[name][0]/r.topics[name][1],complete:r.topics[name][0],total:r.topics[name][1],curriculum:r.curriculum}))}));
 }
 // Horizontal segments show unchanged status; vertical joins show a recorded daily change.
 // A missing/new category has no invented zero before its first observation.
 function geometry(points,start,end,extend=true){
  const day=s=>Date.parse(s+'T12:00:00Z')/86400000,first=day(start),last=day(end),span=Math.max(1,last-first);
  const x=d=>40+(day(d)-first)*304/span,y=v=>242-v*2.08;
  let d='';points.forEach((p,i)=>{d+=(i?'H'+x(p.date)+'V'+y(p.value):'M'+x(p.date)+' '+y(p.value));});
  if(extend&&points.length&&points.at(-1).date<end)d+='H'+x(end);
  return {d,dots:points.map(p=>({...p,x:x(p.date),y:y(p.value)}))};
 }
 function catalogChanges(rows){
  return rows.flatMap((row,i)=>{
   const previous=rows[i-1],names=[...new Set([...Object.keys(previous?.topics||{}),...Object.keys(row.topics)])];
   const changes=names.filter(name=>previous?.topics[name]?.[1]!==row.topics[name]?.[1]).map(name=>({name,before:previous?.topics[name]?.[1]??null,after:row.topics[name]?.[1]??null}));
   return !previous||previous.curriculum!==row.curriculum||changes.length?[{...row,baseline:!previous,changes}]:[];
  });
 }
 function render(history,today,esc,formatDate,topicIndex){
  const rows=history.filter(r=>r.date<=today),lines=series(rows,today);
  if(!rows.length)return '<section class="chart-card"><h2>Skills over time</h2><p>No dated progress observations are available yet.</p></section>';
  const start=rows[0].date,end=today<start?start:today;
  const color=name=>`var(--topic-${topicIndex(name)})`,pct=p=>Math.round(p.value*10)/10+'%';
  const values=lines.map(line=>({...line,...geometry(line.points,start,end,line.active)}));
  return `<section class="chart-card completion-history"><h2>Skills over time</h2><p class="fineprint">Fully completed skills in each category · 0–100%</p>
  <svg viewBox="0 0 360 294" role="img" aria-labelledby="history-title history-desc"><title id="history-title">Category skill completion over time</title><desc id="history-desc">Dates run from ${esc(start)} to ${esc(end)}. Lines show each category’s percentage of fully completed skills. Recorded values are available below the chart.</desc>
  ${[0,25,50,75,100].map(v=>`<path d="M40 ${242-v*2.08}H344" class="grid-line"/><text x="34" y="${246-v*2.08}" text-anchor="end">${v}%</text>`).join('')}
  ${values.map(line=>`<g data-history-series="${esc(line.name)}"><path d="${line.d}" fill="none" stroke="${color(line.name)}" stroke-width="3" stroke-linejoin="round" stroke-dasharray="${['none','9 3','3 3'][line.index%3]}"/>${line.dots.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color(line.name)}"><title>${esc(line.name)} · ${esc(p.date)} · ${pct(p)} (${p.complete}/${p.total} skills)</title></circle>`).join('')}</g>`).join('')}
  <text x="40" y="268">${esc(formatDate(start))}</text>${end!==start?`<text x="344" y="268" text-anchor="end">${esc(formatDate(end))}</text>`:''}<text x="192" y="290" text-anchor="middle">Date</text></svg>
  <fieldset class="history-key"><legend>Show categories</legend>${lines.map(line=>`<label><input type="checkbox" data-history-toggle="${esc(line.name)}" checked><span class="history-swatch" style="border-color:${color(line.name)};border-top-style:${['solid','dashed','dotted'][line.index%3]}"></span><span>${esc(line.name)}${line.active?'':' (previous catalog)'}</span></label>`).join('')}</fieldset>
  <p class="fineprint">History starts ${esc(formatDate(start))}. Earlier changes were not logged. Each point is the last observed state on that date; flat lines carry the latest recorded value forward. A skill is complete when all its steps are consistent. Changes within one day share one point.</p>
  <details><summary>Recorded values</summary><p class="fineprint">Latest 30 observation dates. Each group keeps its original counts and library version; backups keep the full history. Future dates appear when their date arrives.</p>
  <div class="history-table" role="region" aria-label="Recorded completion values" tabindex="0"><table><caption class="sr-only">Recorded category completion, grouped by date and library version</caption><thead><tr><th scope="col">Category</th><th scope="col">Learned skills</th></tr></thead>${rows.slice(-30).reverse().map(row=>`<tbody><tr class="history-date-group"><th colspan="2" scope="rowgroup">${esc(formatDate(row.date))}<small>Lesson library version ${row.curriculum}</small></th></tr>${Object.entries(row.topics).map(([name,[complete,total]])=>`<tr><th scope="row" class="history-category">${esc(name)}</th><td class="history-number"><strong>${Math.round(1000*complete/total)/10}%</strong><small><span>${complete}</span> of <span>${total}</span> skills</small></td></tr>`).join('')}</tbody>`).join('')}</table></div>
  <details class="catalog-explanation"><summary>Why percentages can change</summary><p>An app update can add skills or move them between categories. Five learned skills out of ten is 50%; the same five out of twelve is about 42%. Your learning records are kept, and earlier chart points retain their original counts.</p><p class="fineprint">“Lesson library version” identifies the set of lessons used for each observation. These are library changes, separate from your dog’s progress. Latest 30 observed revisions:</p><ul class="catalog-revisions">${catalogChanges(rows).slice(-30).reverse().map(row=>`<li><strong>${esc(formatDate(row.date))} · library ${row.curriculum}</strong>${row.baseline?'<small>First recorded library on this device.</small>':''}<ul>${row.changes.map(c=>`<li>${esc(c.name)}: ${row.baseline?c.after+' skills':c.before===null?'added with '+c.after+' skills':c.after===null?'previous category; '+c.before+' skills before this update':c.before+' → '+c.after+' skills'}</li>`).join('')||'<li>Category sizes stayed the same.</li>'}</ul></li>`).join('')}</ul></details></details></section>`;
 }
 return {palette,series,geometry,catalogChanges,render};
});
