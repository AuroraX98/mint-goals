import { completionFields } from '../public/completion.mjs';
export const MAX_BYTES = 2_000_000;
function invalid(message) { throw new Error(message); }
function record(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function text(v, limit, required = false) {
  if (typeof v !== 'string' || v.length > limit || (required && !v.trim())) invalid('Invalid or overly long text.');
}
function keys(v, allowed) {
  if (!record(v) || Object.keys(v).some(k => !allowed.includes(k))) invalid('Unexpected state fields.');
}
function unique(items) {
  const ids = new Set();
  for (const item of items) { text(item.id, 128, true); if (ids.has(item.id)) invalid('Duplicate IDs.'); ids.add(item.id); }
}
export function validateState(state) {
  keys(state, ['version','goals','categories']);
  if (![1,2].includes(state.version) || !Array.isArray(state.goals) || state.goals.length > 200 || !Array.isArray(state.categories) || state.categories.length > 50) invalid('Invalid state or limits exceeded.');
  for (const c of state.categories) { keys(c, ['id','name']); text(c.name, 60, true); }
  unique(state.categories); unique(state.goals);
  const categories = new Set(state.categories.map(c => c.id));
  for (const g of state.goals) {
    keys(g, ['id','title','description','icon','categoryId','tasks','status','previousStatus','createdAt','completedAt','completionDate']);
    text(g.title, 140, true); text(g.description, 3000);
    if (g.icon !== undefined) text(g.icon, 40, true);
    if (g.categoryId !== undefined && g.categoryId !== null && g.categoryId !== '' && !categories.has(g.categoryId)) invalid('Unknown category.');
    if (!['active','completed','archived'].includes(g.status)) invalid('Invalid goal status.');
    if (g.previousStatus !== undefined && !['active','completed'].includes(g.previousStatus)) invalid('Invalid previous status.');
    text(g.createdAt, 40, true); if (!Number.isFinite(Date.parse(g.createdAt))) invalid('Invalid creation date.');
    completionFields(g);
    if (!Array.isArray(g.tasks) || g.tasks.length > 200) invalid('Too many steps.');
    unique(g.tasks);
    for (const t of g.tasks) { keys(t, ['id','text','emoji','done']); text(t.text, 300, true); text(t.emoji, 24); if (typeof t.done !== 'boolean') invalid('Invalid step status.'); }
  }
  if (new TextEncoder().encode(JSON.stringify(state)).byteLength > MAX_BYTES) invalid('State is too large.');
  return state;
}
export async function readState(db, ownerId) {
  const row = await db.prepare('SELECT state_json, revision FROM goal_states WHERE owner_id = ?').bind(ownerId).first();
  return row ? {state: JSON.parse(row.state_json), version: row.revision} : {state:null, version:0};
}
export async function writeState(db, ownerId, state, version) {
  validateState(state);
  if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) invalid('Invalid revision.');
  // Block stale pre-progress clients from dropping recorded dates. CAS still guards the write.
  const existing=await readState(db,ownerId);
  if(existing.state?.version===2 && state.version===1) return {conflict:true,...existing};
  const json = JSON.stringify(state), now = new Date().toISOString();
  // A single conditional SQL write is the concurrency boundary, not a preceding read.
  const result = version === 0
    ? await db.prepare('INSERT INTO goal_states (owner_id,state_json,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id) DO NOTHING').bind(ownerId,json,now).run()
    : await db.prepare('UPDATE goal_states SET state_json = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(json,now,ownerId,version).run();
  if (result.meta.changes !== 1) return {conflict:true, ...await readState(db,ownerId)};
  return {state, version:version + 1};
}
export async function handleStateRequest(request, db, ownerId) {
  const respond = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
  if (!ownerId) return respond({error:'unauthorized'},401);
  if (!db) return respond({error:'storage_unavailable'},503);
  try {
    if (request.method === 'GET') return respond(await readState(db,ownerId));
    if (request.method !== 'PUT') return respond({error:'method_not_allowed'},405);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return respond({error:'invalid_origin'},403);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return respond({error:'json_required'},415);
    if (Number(request.headers.get('content-length')) > MAX_BYTES) return respond({error:'too_large'},413);
    // Bound streaming input rather than allocating an unbounded request body.
    const reader = request.body?.getReader(); if (!reader) return respond({error:'invalid_body'},400);
    const chunks=[]; let size=0;
    while (true) { const {value,done}=await reader.read(); if(done) break; size+=value.byteLength; if(size>MAX_BYTES) { await reader.cancel(); return respond({error:'too_large'},413); } chunks.push(value); }
    const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let payload;
    try { payload=JSON.parse(new TextDecoder().decode(bytes)); keys(payload,['state','version']); validateState(payload.state); if(!Number.isSafeInteger(payload.version)||payload.version<0||payload.version>=Number.MAX_SAFE_INTEGER) invalid('Invalid revision.'); }
    catch(error) { return respond({error:'invalid_state',message:error.message},400); }
    const result=await writeState(db,ownerId,payload.state,payload.version);
    if(result.conflict) return respond({error:'conflict',state:result.state,version:result.version},409);
    return respond(result);
  } catch { return respond({error:'storage_error'},503); }
}
