// The buttons keep their native click and keyboard behavior. Only this glass layer moves.
export function mountGlassSwitch(rail, select, attribute = 'data-filter') {
  const selector = 'button[' + attribute + ']';
  const buttons = Array.from(rail.querySelectorAll(selector));
  const pill = document.createElement('span');
  pill.className = 'filter-pill';
  pill.setAttribute('aria-hidden','true');
  rail.prepend(pill);

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;
  let motion = null;
  let gesture = null;
  let suppressClick = false;

  const center = button => button.offsetLeft + button.offsetWidth / 2;
  const pose = (x, width, height = 1) =>
    'translateX(' + x + 'px) scale(' + width / 100 + ',' + height + ')';
  const restingPose = button => pose(button.offsetLeft, button.offsetWidth);
  function stop() {
    motion?.cancel();
    motion = null;
  }
  function settle(button, animate = true) {
    const width = button.offsetWidth;
    if (!width) return;
    const box = pill.getBoundingClientRect();
    const start = box.left - rail.getBoundingClientRect().left - rail.clientLeft;
    const distance = button.offsetLeft - start;
    const end = restingPose(button);
    stop();
    pill.style.transform = end;
    pill.style.top = button.offsetTop + 'px';
    pill.style.height = button.offsetHeight + 'px';
    if (active && animate && !still.matches && pill.animate && (Math.abs(distance) > 1 || gesture)) {
      const direction = Math.sign(distance);
      const stretch = Math.min(24, Math.abs(distance) * .27);
      const earlyWidth = box.width * .94;
      const midWidth = (box.width + width) / 2 + stretch;
      const midCenter = start + box.width / 2 + (center(button) - start - box.width / 2) * .51;
      const frames = [
        {transform:pose(start,box.width),offset:0},
        {transform:pose(start + (box.width-earlyWidth)/2 + distance*.045,earlyWidth,1.045),offset:.13},
        {transform:pose(midCenter-midWidth/2,midWidth,.94),offset:.45},
        {transform:pose(button.offsetLeft+direction*2.5,width*.985,1.02),offset:.78},
        {transform:end,offset:1}
      ];
      motion = pill.animate(frames,{duration:380,easing:'cubic-bezier(.25,.72,.32,1)'});
    }
    active = button;
    rail.classList.add('has-pill');
  }
  function sync(value) {
    const button = buttons.find(item => item.getAttribute(attribute) === value);
    if (!button) return;
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    if (button !== active) settle(button);
  }
  function nearest(x) {
    const local = x - rail.getBoundingClientRect().left - rail.clientLeft;
    return buttons.reduce((best,next) => Math.abs(center(next)-local) < Math.abs(center(best)-local) ? next : best);
  }
  function preview(x, pressed) {
    if (!active || still.matches || motion?.playState === 'running') return;
    const local = x - rail.getBoundingClientRect().left - rail.clientLeft;
    const shift = Math.max(-1,Math.min(1,(local-center(active))/active.offsetWidth));
    const nudge = shift * (pressed ? 8 : 3);
    const width = active.offsetWidth + Math.abs(shift) * (pressed ? -6 : 2);
    pill.style.transform = pose(center(active)-width/2+nudge,width,pressed ? 1.035 : 1);
  }
  rail.addEventListener('click',event => {
    if (suppressClick && event.detail) {suppressClick=false;return;}
    const button=event.target.closest(selector);
    if (button) select(button.getAttribute(attribute));
  });
  rail.addEventListener('pointerdown',event => {
    if (!event.isPrimary || event.button!==0 || !active) return;
    suppressClick=false;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,start:active,dragging:false};
    preview(event.clientX,true);
  });
  rail.addEventListener('pointermove',event => {
    if (!gesture) {if (event.pointerType==='mouse') preview(event.clientX,false);return;}
    if (gesture.id!==event.pointerId) return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if (!gesture.dragging && Math.abs(dy)>8 && Math.abs(dy)>Math.abs(dx)) {cancel();return;}
    if (!gesture.dragging && Math.abs(dx)<6) return;
    if (!gesture.dragging) {gesture.dragging=true;rail.setPointerCapture(event.pointerId);stop();}
    if (still.matches) return;
    const left=buttons[0].offsetLeft,last=buttons.at(-1),right=last.offsetLeft+last.offsetWidth;
    const width=gesture.start.offsetWidth+Math.min(18,Math.abs(dx)*.23);
    const x=Math.max(left,Math.min(right-width,center(gesture.start)+dx-width/2));
    pill.style.transform=pose(x,width,.96);
  });
  function cancel() {
    if (!gesture) return;
    gesture=null;
    if (active) settle(active,false);
  }
  rail.addEventListener('pointerup',event => {
    if (event.pointerId!==gesture?.id) return;
    if (gesture.dragging) {
      const target=nearest(event.clientX);
      suppressClick=true;
      if (target===active) settle(target);else select(target.getAttribute(attribute));
      target.focus({preventScroll:true});
    } else if (active && motion?.playState!=='running') pill.style.transform=restingPose(active);
    gesture=null;
  });
  rail.addEventListener('pointerleave',() => {
    if (gesture?.dragging) return;
    gesture=null;if (active && motion?.playState!=='running') pill.style.transform=restingPose(active);
  });
  rail.addEventListener('pointercancel',cancel);
  rail.addEventListener('lostpointercapture',cancel);
  rail.addEventListener('keydown',event => {
    const index=buttons.indexOf(event.target);
    if (index<0) return;
    const targets={ArrowLeft:(index+buttons.length-1)%buttons.length,ArrowRight:(index+1)%buttons.length,Home:0,End:buttons.length-1};
    if (!(event.key in targets)) return;
    event.preventDefault();
    const next=buttons[targets[event.key]];next.focus();next.click();
  });
  const layout=()=>{
    const selected=buttons.find(item=>item.getAttribute('aria-pressed')==='true');
    if(selected)settle(selected,false);
  };
  const observer=new ResizeObserver(layout);
  buttons.forEach(button=>observer.observe(button));
  still.addEventListener('change',layout);
  return sync;
}

// An already-open older client can still import the original name.
export {mountGlassSwitch as mountFilters};
