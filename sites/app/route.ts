import html from '../public/index.html?raw';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  await requireChatGPTUser('/');
  return new Response(html, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
}
