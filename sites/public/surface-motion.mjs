// Native state and focus change immediately. Closing copies are visual only.
const FALLBACK_EASING = 'cubic-bezier(.23,1,.32,1)';

export function attachSurfaceMotion({ dialog, toast, backups }) {
  const doc = (dialog || toast || backups).ownerDocument;
  const win = doc.defaultView;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const easing = win.getComputedStyle(doc.documentElement).getPropertyValue('--ease-out').trim() || FALLBACK_EASING;
  const entries = new Map();
  const ghosts = new Map();
  let modality = 'keyboard', toastTimer, disposed = false;
  let observedBackupsOpen = Boolean(backups?.open);

  const keyboard = () => { modality = 'keyboard'; };
  const pointer = () => { modality = 'pointer'; };
  const click = event => { modality = event.detail === 0 ? 'keyboard' : 'pointer'; };
  doc.addEventListener('keydown', keyboard, true);
  doc.addEventListener('pointerdown', pointer, true);
  doc.addEventListener('click', click, true);

  function stopEntry(node) {
    entries.get(node)?.cancel();
    entries.delete(node);
  }
  function clearGhost(kind) {
    ghosts.get(kind)?.();
    ghosts.delete(kind);
  }
  function animate(node, frames, milliseconds, complete = () => {}) {
    if (disposed || typeof node.animate !== 'function') { complete(); return null; }
    let animation;
    try {
      animation = node.animate(frames, { duration: reduced.matches ? 80 : milliseconds, easing });
    } catch { complete(); return null; }
    // Cancelled animations reject finished. Both paths release temporary nodes.
    animation.finished.then(complete, complete);
    return animation;
  }
  function enter(node, transform, duration, immediate = false) {
    stopEntry(node);
    if (immediate || disposed) return;
    const frames = reduced.matches
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform }, { opacity: 1, transform: node === toast ? 'translateX(-50%) translateY(0)' : 'none' }];
    let animation;
    animation = animate(node, frames, duration, () => {
      if (entries.get(node) === animation) entries.delete(node);
    });
    if (animation) entries.set(node, animation);
  }
  function snapshot(node) {
    const style = win.getComputedStyle(node);
    const state = { opacity: style.opacity, transform: style.transform };
    stopEntry(node);
    // Measure the resting box after cancelling its entry scale.
    return { ...state, rect: node.getBoundingClientRect(), scrollTop: node.scrollTop, scrollLeft: node.scrollLeft };
  }
  function visualCopy(node, kind, state) {
    const copy = node.cloneNode(true);
    copy.classList.add('surface-motion-ghost', `surface-${kind}-ghost`);
    for (const element of [copy, ...copy.querySelectorAll('*')]) {
      for (const attr of ['id', 'autofocus', 'aria-live', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'for', 'role']) element.removeAttribute(attr);
    }
    // cloneNode does not consistently preserve live form values.
    const sourceFields = node.querySelectorAll('input,textarea,select');
    const copiedFields = copy.querySelectorAll('input,textarea,select');
    sourceFields.forEach((field, index) => {
      const twin = copiedFields[index];
      if (field.type !== 'file') twin.value = field.value;
      if ('checked' in field) twin.checked = field.checked;
      if ('selectedIndex' in field) twin.selectedIndex = field.selectedIndex;
    });
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('inert', '');
    copy.removeAttribute('data-surface-dialog');
    copy.removeAttribute('data-surface-instant');
    const { rect } = state;
    Object.assign(copy.style, {
      position: 'fixed', margin: '0', left: `${rect.left}px`, top: `${rect.top}px`, right: 'auto', bottom: 'auto',
      width: `${rect.width}px`, height: `${rect.height}px`, maxWidth: 'none', maxHeight: 'none',
      transform: 'none', translate: 'none', pointerEvents: 'none', boxSizing: 'border-box'
    });
    doc.body.append(copy);
    copy.scrollTop = state.scrollTop;
    copy.scrollLeft = state.scrollLeft;
    const originalChildren = node.querySelectorAll('*');
    copy.querySelectorAll('*').forEach((element, index) => {
      element.scrollTop = originalChildren[index].scrollTop;
      element.scrollLeft = originalChildren[index].scrollLeft;
    });
    return copy;
  }
  function exitCopy(node, kind, duration, transform, { backdrop = false } = {}) {
    clearGhost(kind);
    const backdropOpacity = backdrop ? win.getComputedStyle(node, '::backdrop').opacity : '1';
    const state = snapshot(node);
    if (disposed || !state.rect.width || !state.rect.height || typeof node.animate !== 'function') return;
    const copy = visualCopy(node, kind, state);
    const animations = [];
    let shade;
    if (backdrop) {
      shade = doc.createElement('div');
      shade.className = 'surface-dialog-backdrop-ghost';
      shade.setAttribute('aria-hidden', 'true');
      shade.setAttribute('inert', '');
      doc.body.append(shade);
    }
    const cleanup = () => {
      if (ghosts.get(kind) !== cleanup) return;
      ghosts.delete(kind);
      for (const animation of animations) animation?.cancel();
      copy.remove();
      shade?.remove();
    };
    ghosts.set(kind, cleanup);
    // Toast's copy is positioned by its measured left edge, so its centering
    // translation must not be applied a second time.
    const toastOffset = kind === 'toast' && win.DOMMatrixReadOnly && state.transform !== 'none' ? new win.DOMMatrixReadOnly(state.transform).m42 : 0;
    const startingTransform = kind === 'toast' ? `translateY(${toastOffset}px)` : state.transform;
    const frames = reduced.matches
      ? [{ opacity: state.opacity }, { opacity: 0 }]
      : [{ opacity: state.opacity, transform: startingTransform }, { opacity: 0, transform }];
    if (shade) animations.push(animate(shade, [{ opacity: backdropOpacity }, { opacity: 0 }], duration));
    animations.push(animate(copy, frames, duration, cleanup));
  }

  if (dialog) dialog.dataset.surfaceDialog = '';
  function openDialog() {
    if (!dialog || disposed) return;
    clearGhost('dialog');
    const immediate = modality === 'keyboard';
    dialog.toggleAttribute('data-surface-instant', immediate);
    if (dialog.open) return;
    dialog.showModal();
    enter(dialog, 'scale(.97)', 200, immediate);
  }
  function closeDialog({ immediate = false } = {}) {
    if (!dialog?.open) return;
    clearGhost('dialog');
    if (!immediate && modality !== 'keyboard') exitCopy(dialog, 'dialog', 160, 'scale(.97)', { backdrop: true });
    else stopEntry(dialog);
    dialog.close();
  }
  const cancelDialog = () => { stopEntry(dialog); clearGhost('dialog'); };
  const dialogClosed = () => { if (!dialog.open) stopEntry(dialog); };
  dialog?.addEventListener('cancel', cancelDialog);
  dialog?.addEventListener('close', dialogClosed);

  function hideToast() {
    win.clearTimeout(toastTimer);
    if (!toast?.textContent) return;
    exitCopy(toast, 'toast', 120, 'translateY(20%)');
    toast.textContent = '';
  }
  function announce(message, { duration = 5500 } = {}) {
    if (!toast || disposed) return;
    win.clearTimeout(toastTimer);
    if (!message) { hideToast(); return; }
    const wasVisible = Boolean(toast.textContent);
    clearGhost('toast');
    toast.textContent = message;
    if (!wasVisible) enter(toast, 'translateX(-50%) translateY(20%)', 160);
    toastTimer = win.setTimeout(hideToast, duration);
  }

  const backupPanel = backups?.querySelector('.backup-actions');
  const backupSummary = backups?.querySelector('summary');
  function setBackupsOpen(open, { immediate = false } = {}) {
    if (!backups || disposed) return;
    clearGhost('backups');
    if (backups.open === open) return;
    const instant = immediate || modality === 'keyboard';
    if (!open && backupPanel) {
      if (!instant) exitCopy(backupPanel, 'backups', 125, 'scale(.97)');
      else stopEntry(backupPanel);
    }
    observedBackupsOpen = open;
    backups.open = open;
    if (open && backupPanel) enter(backupPanel, 'scale(.97)', 150, instant);
  }
  const toggleBackups = event => { event.preventDefault(); setBackupsOpen(!backups.open); };
  const externallyToggled = () => {
    if (backups.open === observedBackupsOpen) return;
    observedBackupsOpen = backups.open;
    clearGhost('backups');
    if (backups.open && backupPanel) enter(backupPanel, 'scale(.97)', 150, modality === 'keyboard');
    else if (backupPanel) stopEntry(backupPanel);
  };
  backupSummary?.addEventListener('click', toggleBackups);
  backups?.addEventListener('toggle', externallyToggled);

  const preferenceChanged = () => {
    for (const node of [...entries.keys()]) stopEntry(node);
    for (const kind of [...ghosts.keys()]) clearGhost(kind);
  };
  reduced.addEventListener('change', preferenceChanged);

  function destroy() {
    disposed = true;
    win.clearTimeout(toastTimer);
    preferenceChanged();
    doc.removeEventListener('keydown', keyboard, true);
    doc.removeEventListener('pointerdown', pointer, true);
    doc.removeEventListener('click', click, true);
    dialog?.removeEventListener('cancel', cancelDialog);
    dialog?.removeEventListener('close', dialogClosed);
    dialog?.removeAttribute('data-surface-dialog');
    dialog?.removeAttribute('data-surface-instant');
    backupSummary?.removeEventListener('click', toggleBackups);
    backups?.removeEventListener('toggle', externallyToggled);
    reduced.removeEventListener('change', preferenceChanged);
  }
  return { openDialog, closeDialog, announce, hideToast, closeBackups: options => setBackupsOpen(false, options), destroy };
}
