// Delegated dismissal avoids adding document listeners each time cards render.
export function mountStepOptions(root=document) {
  const closeOthers=except=>root.querySelectorAll('.step-options[open]').forEach(menu=>{if(menu!==except)menu.open=false;});
  root.addEventListener('toggle',event=>{
    const menu=event.target;
    if(!menu.matches?.('.step-options[open]'))return;
    closeOthers(menu);
    const panel=menu.querySelector('.step-options-panel'),box=menu.getBoundingClientRect();
    const viewport=window.visualViewport;
    const top=viewport?.offsetTop||0,bottom=top+(viewport?.height||window.innerHeight);
    menu.classList.toggle('opens-up',box.bottom+panel.offsetHeight+8>bottom&&box.top-top>panel.offsetHeight+8);
  },true);
  root.addEventListener('pointerdown',event=>closeOthers(event.target.closest?.('.step-options')));
  root.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const menu=event.target.closest?.('.step-options[open]');
    if(menu){event.preventDefault();menu.open=false;menu.querySelector('summary').focus();}
  });
  root.addEventListener('focusin',event=>closeOthers(event.target.closest?.('.step-options')));
}

export function appendStepOptions(container,{document,task,index,total,onMove,onEdit}) {
  const menu=document.createElement('details');menu.className='step-options';menu.dataset.task=task.id;
  const trigger=document.createElement('summary');trigger.setAttribute('aria-label',`Options for ${task.text}`);menu.append(trigger);
  const panel=document.createElement('div');panel.className='step-options-panel';
  const action=(text,callback,disabled=false)=>{
    const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;
    b.addEventListener('click',()=>{menu.open=false;callback();});panel.append(b);return b;
  };
  action('Edit step',onEdit);
  action('Move up',()=>onMove(-1),index===0);
  action('Move down',()=>onMove(1),index===total-1);
  menu.append(panel);container.append(menu);
  return menu;
}

export function trackDialogViewport(dialog) {
  const view=window.visualViewport;
  if(!view)return;
  const update=()=>{
    dialog.style.setProperty('--dialog-viewport-height',`${view.height}px`);
    dialog.style.setProperty('--dialog-viewport-offset',`${view.offsetTop}px`);
  };
  view.addEventListener('resize',update);view.addEventListener('scroll',update);update();
}
