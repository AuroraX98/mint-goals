import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleStateRequest } from '../../../lib/goal-store.mjs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const user = await getChatGPTUser();
  return handleStateRequest(request, env.DB, user?.userId);
}
export const GET = handle;
export const PUT = handle;
