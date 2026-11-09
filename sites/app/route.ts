import html from '../public/index.html?raw';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  await requireChatGPTUser('/');
  const cover = new URL('/mint-goals-cover.jpg', request.url);
  const page = html.replace('content="/mint-goals-cover.jpg"', () => `content="${cover.href}"`);
  return new Response(page, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
}
