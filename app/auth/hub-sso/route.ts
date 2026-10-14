import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { COOKIE_SESSAO, opcoesDoCookie, valorDoCookie, verificarAssinado } from "@/lib/sessao";
import { telaSegura } from "@/lib/hub";

export const dynamic = "force-dynamic";

// Entrada vinda do hub: `/ranking/sso` de lá assina { email, exp } com
// RANKING_HUB_SSO_SECRET (o mesmo desenho do `/auth/hub-sso` do Pulse) e manda
// o quadro para cá. Conferida a assinatura, o papel sai da MESMA tabela que o
// Pulse usa (`acesso`, no banco do CRM): admin lá é admin aqui, e a carteira
// diz de quem é a "Minha foto".
//
// Quem está no hub mas não tem linha em `acesso` entra como consultor sem
// carteira: vê o ranking ao vivo, e a aba da foto explica que é para vendedores.
// Quem foi DESATIVADO no `acesso` não entra.
function pagina(msg: string, status: number) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ranking</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#3b1a2f"><p style="max-width:28rem;text-align:center;line-height:1.5">${msg}</p></body>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const segredo = process.env.RANKING_HUB_SSO_SECRET;
  if (!segredo) return pagina("Configuração ausente: RANKING_HUB_SSO_SECRET.", 500);

  const p = verificarAssinado(url.searchParams.get("token"), segredo);
  const email = typeof p?.email === "string" ? p.email.trim().toLowerCase() : null;
  if (!email) return pagina("O acesso expirou. Recarregue a página do hub para entrar de novo.", 401);

  const sbUrl = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !chave) return pagina("Configuração ausente: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.", 500);
  const sb = createClient(sbUrl, chave, { auth: { persistSession: false } });
  const { data: ac, error } = await sb.from("acesso").select("papel,papeis,carteira,ativo").eq("email", email).maybeSingle();
  if (error) return pagina("Não foi possível conferir o seu acesso agora. Tente de novo em instantes.", 500);
  if (ac?.ativo === false) return pagina("Seu acesso ao Ranking está desativado. Fale com um administrador.", 403);

  const papeis: string[] = Array.isArray(ac?.papeis) ? ac!.papeis : [];
  const admin = ac?.papel === "admin" || papeis.includes("admin");
  const carteira = typeof ac?.carteira === "string" && ac.carteira ? ac.carteira : null;

  const destino = telaSegura(url.searchParams.get("volta")) ?? "/controle";
  const res = NextResponse.redirect(new URL(destino, url.origin), { status: 303 });
  res.headers.set("cache-control", "no-store");
  res.cookies.set(COOKIE_SESSAO, valorDoCookie({ email, admin, carteira }), opcoesDoCookie);
  return res;
}
