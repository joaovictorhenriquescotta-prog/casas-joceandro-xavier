import { checkPassword, issueToken, json } from './_lib.js';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!process.env.ADMIN_PASSWORD?.trim()) return json({ error: 'Defina ADMIN_PASSWORD nas variáveis de ambiente da Vercel.' }, 500);
  // pequeno atraso contra tentativas em sequência
  await new Promise((r) => setTimeout(r, 400));
  if (!checkPassword(body.password)) return json({ error: 'Senha incorreta.' }, 401);
  return json({ token: issueToken() });
}
