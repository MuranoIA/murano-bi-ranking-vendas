import { createClient } from "@supabase/supabase-js";
import { lerSessao, podeAdmin } from "@/lib/sessao";
import { CRITERIO_PADRAO, lerCriterio } from "@/lib/criterio";

export const dynamic = "force-dynamic";

// O critério do ranking (bi_config.ranking_criterio). Só admin (supervisor). Vale para todas as TVs:
// a edge function bi-ranking-vendas lê esta chave a cada atualização do painel (~1 min).
function sb() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase envs ausentes");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  if (!podeAdmin(sessao)) return Response.json({ error: "apenas admin" }, { status: 403 });
  const { data, error } = await sb().from("bi_config").select("valor").eq("chave", "ranking_criterio").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ criterio: lerCriterio(data?.valor) ?? CRITERIO_PADRAO });
}

export async function POST(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  if (!podeAdmin(sessao)) return Response.json({ error: "apenas admin" }, { status: 403 });
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const criterio = lerCriterio(b?.criterio);
  if (!criterio) return Response.json({ error: "Marque ao menos venda padrão ou venda de manifesto." }, { status: 400 });
  const { error } = await sb().from("bi_config")
    .upsert({ chave: "ranking_criterio", valor: JSON.stringify(criterio), atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, criterio });
}
