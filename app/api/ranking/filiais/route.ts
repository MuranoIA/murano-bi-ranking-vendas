import { createClient } from "@supabase/supabase-js";
import { lerSessao, podeAdmin } from "@/lib/sessao";
import { FILIAIS_PADRAO, chaveFiliais, lerFiliais } from "@/lib/rankingFiliais";

export const dynamic = "force-dynamic";

// Filiais que aparecem no ranking (bi_config). Só admin (supervisor).
//  - escopo "minha": a escolha de quem está logado, usada na tela "Por dia" e no "Abrir o ranking" daqui;
//  - escopo "tv": o padrão do painel público das TVs (a edge function bi-ranking-vendas lê a chave
//    `ranking_filiais`). O supervisor de Belém deixa Belém e o do Maranhão, Maranhão.
// GET devolve as duas. POST { escopo, filiais:number[] } grava. Escrita SÓ no murano-conversas (bi_config).
function sb() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase envs ausentes");
  return createClient(url, key, { auth: { persistSession: false } });
}

function quem() {
  const sessao = lerSessao();
  return { sessao, email: sessao?.email ?? null };
}

export async function GET() {
  const { sessao, email } = quem();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  if (!podeAdmin(sessao)) return Response.json({ error: "apenas admin" }, { status: 403 });

  const chaves = ["ranking_filiais", ...(email ? [chaveFiliais(email)] : [])];
  const { data, error } = await sb().from("bi_config").select("chave,valor").in("chave", chaves);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const m = new Map((data ?? []).map((r: any) => [r.chave, r.valor]));
  const tv = lerFiliais(m.get("ranking_filiais")) ?? FILIAIS_PADRAO;
  // sem escolha própria, a pessoa começa pelo padrão das TVs
  const minha = (email ? lerFiliais(m.get(chaveFiliais(email))) : null) ?? tv;
  return Response.json({ tv, minha, email });
}

export async function POST(req: Request) {
  const { sessao, email } = quem();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  if (!podeAdmin(sessao)) return Response.json({ error: "apenas admin" }, { status: 403 });

  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const filiais = lerFiliais(b?.filiais);
  if (!filiais) return Response.json({ error: "Marque ao menos uma filial." }, { status: 400 });
  const escopo = b?.escopo === "tv" ? "tv" : "minha";
  if (escopo === "minha" && !email) return Response.json({ error: "Sessão sem e-mail: não dá para guardar a sua escolha." }, { status: 400 });

  const { error } = await sb().from("bi_config")
    .upsert({ chave: escopo === "tv" ? "ranking_filiais" : chaveFiliais(email), valor: JSON.stringify(filiais), atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, escopo, filiais });
}
