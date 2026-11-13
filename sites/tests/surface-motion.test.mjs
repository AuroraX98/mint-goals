import test from 'node:test';
import assert from 'node:assert/strict';
import { attachSurfaceMotion } from '../public/surface-motion.mjs';

// Small DOM stand-ins exercise the async lifecycle, including finished rejection
// on cancellation. Browser verification still covers layout and native focus.
class Node extends EventTarget {
  constructor(tag, doc) {
    super(); this.tagName = tag; this.ownerDocument = doc; this.children = []; this.style = {};
    this.dataset = {}; this.attrs = new Map(); this.className = ''; this.textContent = '';
    this.scrollTop = this.scrollLeft = 0; this.animations = []; this.open = false;
    this.classList = { add: (...names) => { this.className += ` ${names.join(' ')}`; } };
  }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  setAttribute(key, value) { this.attrs.set(key, value); }
  removeAttribute(key) { this.attrs.delete(key); }
  toggleAttribute(key, force) { if (force) this.setAttribute(key, ''); else this.removeAttribute(key); }
  querySelectorAll(selector) {
    const all = this.children.flatMap(node => [node, ...node.querySelectorAll('*')]);
    if (selector === '*') return all;
    return all.filter(node => selector.split(',').includes(node.tagName));
  }
  querySelector(selector) { return this.querySelectorAll('*').find(node => selector.startsWith('.') ? node.className.split(' ').includes(selector.slice(1)) : node.tagName === selector); }
  cloneNode(deep) {
    const copy = new Node(this.tagName, this.ownerDocument);
    copy.className = this.className; copy.textContent = this.textContent; copy.attrs = new Map(this.attrs); copy.open = this.open;
    if (deep) this.children.forEach(child => copy.append(child.cloneNode(true)));
    return copy;
  }
  getBoundingClientRect() { return { left: 100, top: 100, width: 300, height: 200 }; }
  showModal() { this.open = true; }
  close() { this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))); }
  animate(frames, options) {
    let finish, reject;
    const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
    const animation = { frames, options, finished, finish, cancelled: false, cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    this.animations.push(animation); return animation;
  }
}

function setup(reduce = false) {
  const doc = new EventTarget(), media = new EventTarget(); media.matches = reduce;
  doc.defaultView = {
    matchMedia: () => media, setTimeout, clearTimeout,
    getComputedStyle: node => ({ opacity: '1', transform: 'none', getPropertyValue: () => '' })
  };
  doc.createElement = tag => new Node(tag, doc);
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body');
  const dialog = doc.createElement('dialog'), toast = doc.createElement('div'), backups = doc.createElement('details');
  const form = doc.createElement('form'); form.setAttribute('id', 'editor-form'); dialog.append(form);
  const body = doc.createElement('div'); body.className = 'dialog-body'; body.scrollTop = 75; form.append(body);
  toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  const summary = doc.createElement('summary'), panel = doc.createElement('div'); panel.className = 'backup-actions';
  backups.append(summary, panel); doc.body.append(dialog, toast, backups);
  const motion = attachSurfaceMotion({ dialog, toast, backups });
  return { doc, media, dialog, toast, backups, summary, panel, motion,
    pointer() { doc.dispatchEvent(new Event('pointerdown')); }, keyboard() { doc.dispatchEvent(new Event('keydown')); },
    ghosts() { return doc.body.children.filter(node => node.className.includes('ghost')); }
  };
}
const flush = () => new Promise(resolve => queueMicrotask(resolve));

test('dialog closes synchronously; visual copies are inert and finish independently', async () => {
  const s = setup(); s.pointer(); s.motion.openDialog();
  assert.equal(s.dialog.open, true); assert.equal(s.dialog.animations[0].options.duration, 200);
  s.motion.closeDialog();
  assert.equal(s.dialog.open, false);
  const copy = s.ghosts().find(node => node.tagName === 'dialog');
  assert.equal(copy.attrs.get('aria-hidden'), 'true'); assert.equal(copy.attrs.has('inert'), true);
  assert.equal(copy.querySelector('form').attrs.has('id'), false);
  assert.equal(copy.querySelector('.dialog-body').scrollTop, 75);
  assert.equal(copy.style.translate, 'none'); assert.equal(copy.animations[0].options.duration, 160);
  copy.animations[0].finish(); await flush();
  assert.equal(s.ghosts().length, 0); s.motion.destroy();
});

test('rapid close and reopen removes stale copies without cancelling the new opening', async () => {
  const s = setup(); s.pointer(); s.motion.openDialog(); s.motion.closeDialog();
  const stale = s.ghosts().find(node => node.tagName === 'dialog').animations[0];
  s.motion.openDialog(); const newest = s.dialog.animations.at(-1);
  await flush();
  assert.equal(stale.cancelled, true); assert.equal(s.ghosts().length, 0);
  assert.equal(s.dialog.open, true); assert.equal(newest.cancelled, false);
  s.motion.destroy();
});

test('keyboard openings and native Escape cancellation are immediate', () => {
  const s = setup(); s.motion.openDialog(); assert.equal(s.dialog.animations.length, 0);
  s.motion.closeDialog(); assert.equal(s.ghosts().length, 0);
  s.pointer(); s.motion.openDialog(); const entry = s.dialog.animations.at(-1);
  s.dialog.dispatchEvent(new Event('cancel')); s.dialog.close();
  assert.equal(entry.cancelled, true); assert.equal(s.ghosts().length, 0);
  s.motion.destroy();
});

test('toast replacement updates its live text immediately without replaying entrance', async () => {
  const s = setup(); s.motion.announce('First'); s.motion.announce('Replacement');
  assert.equal(s.toast.textContent, 'Replacement'); assert.equal(s.toast.animations.length, 1);
  s.motion.hideToast(); assert.equal(s.toast.textContent, '');
  const copy = s.ghosts()[0]; assert.equal(copy.attrs.has('aria-live'), false); assert.equal(copy.attrs.has('role'), false);
  assert.equal(copy.animations[0].options.duration, 120);
  s.motion.announce('Again'); await flush();
  assert.equal(s.toast.textContent, 'Again'); assert.equal(s.ghosts().length, 0);
  assert.equal(s.toast.animations.at(-1).cancelled, false); s.motion.destroy();
});

test('replacement toast deadline cannot be cleared by an old timer', async () => {
  const s = setup(); s.motion.announce('Old', { duration: 1 }); s.motion.announce('New', { duration: 1000 });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(s.toast.textContent, 'New'); s.motion.destroy();
});

test('Backups native state changes immediately and a quick reopen cancels its exit', async () => {
  const s = setup(); s.pointer(); s.summary.dispatchEvent(new Event('click', { cancelable: true }));
  assert.equal(s.backups.open, true); assert.equal(s.panel.animations[0].options.duration, 150);
  s.motion.closeBackups(); assert.equal(s.backups.open, false);
  assert.equal(s.ghosts()[0].animations[0].options.duration, 125);
  s.summary.dispatchEvent(new Event('click', { cancelable: true })); await flush();
  assert.equal(s.backups.open, true); assert.equal(s.ghosts().length, 0);
  s.motion.closeBackups({ immediate: true }); assert.equal(s.ghosts().length, 0);
  s.motion.destroy();
});

test('reduced-motion openings and exits use 80 ms opacity-only frames', () => {
  const s = setup(true); s.pointer(); s.motion.openDialog(); s.motion.closeDialog(); s.motion.announce('Saved');
  const animations = [...s.dialog.animations, ...s.toast.animations, ...s.ghosts().flatMap(node => node.animations)];
  assert.ok(animations.length >= 4);
  for (const animation of animations) {
    assert.equal(animation.options.duration, 80);
    assert.ok(animation.frames.every(frame => !('transform' in frame)));
  }
  s.motion.destroy();
});

test('preference changes cancel running motion and discard closing copies', () => {
  const s = setup(); s.pointer(); s.motion.openDialog(); s.motion.announce('Saved'); s.motion.closeDialog();
  s.media.matches = true; s.media.dispatchEvent(new Event('change'));
  assert.equal(s.ghosts().length, 0); assert.equal(s.toast.animations[0].cancelled, true);
  assert.equal(s.toast.textContent, 'Saved'); s.motion.destroy();
});
