// One control group moves between its reserved in-page slot and the viewport.
// Its measured height also protects focused/scrolled content from the overlay.
window.GroundLessonControls=(()=>{
  let slot=null,bar=null,frame=0;
  const root=document.documentElement;
  function update(){
    frame=0;
    if(!slot?.isConnected||!bar?.isConnected){root.style.setProperty('--floating-controls-height','0px');return;}
    const rect=slot.getBoundingClientRect();
    slot.style.setProperty('--controls-left',rect.left+'px');slot.style.setProperty('--controls-width',rect.width+'px');
    const height=bar.getBoundingClientRect().height;
    if(slot.style.height!==height+'px')slot.style.height=height+'px';
    const nav=document.querySelector('.tab-bar'),bottom=(nav?.getBoundingClientRect().top||innerHeight)-8;
    const floating=rect.top+height>bottom&&bottom>height+60;
    bar.classList.toggle('is-floating',floating);bar.dataset.docked=String(!floating);
    root.style.setProperty('--floating-controls-height',floating?height+16+'px':'0px');
  }
  function refresh(){if(!frame)frame=requestAnimationFrame(update);}
  const observer=new ResizeObserver(refresh);
  function mount(){observer.disconnect();slot=document.querySelector('.lesson-actions-slot');bar=slot?.querySelector('.lesson-actions');if(bar)observer.observe(bar);update();}
  addEventListener('scroll',refresh,{passive:true});addEventListener('resize',refresh);window.visualViewport?.addEventListener('resize',refresh);
  return {mount,refresh};
})();
