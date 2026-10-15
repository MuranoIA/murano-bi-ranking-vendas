import { quemConfigura, gravarDaFilial, sb } from "@/lib/config";
import { filiaisDoGrupo } from "@/lib/grupo";
import { slugDe, slugsDoGrupo } from "@/lib/vendedores";

export const dynamic = "force-dynamic";

// Prévia da tela "BATEU A META" de um vendedor nas TVs da filial (botão do olho na aba Metas).
// Recebe { slug, nome, meta }, monta o payload (foto/elogio/total/posição do ranking ao vivo da
// filial) e grava bi_config.metabatida_comando:<grupo>. Admin ou supervisor; o supervisor só para
// vendedor da filial dele.
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const slug = slugDe(b?.slug || b?.nome);
  const metaVal = Math.max(0, Math.round(Number(b?.meta) || 0));
  if (!slug) return Response.json({ error: "vendedor inválido" }, { status: 400 });
  if (metaVal <= 0) return Response.json({ error: "Defina uma meta maior que zero para prever." }, { status: 400 });
  if (q.sessao.filiais) {
    try { if (!(await slugsDoGrupo(q.grupo)).has(slug)) return Response.json({ error: "Esse vendedor não é da sua filial." }, { status: 403 }); }
    catch (e: any) { return Response.json({ error: "Não foi possível conferir os vendedores da filial: " + (e?.message ?? e) }, { status: 502 }); }
  }

  // dados do vendedor no ranking ao vivo da filial (foto, elogio, total, posição)
  let entry: any = null;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/functions/v1/bi-ranking-vendas?filiais=${filiaisDoGrupo(q.grupo).join(",")}`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      const rk: any[] = Array.isArray(j?.ranking) ? j.ranking : [];
      const idx = rk.findIndex((e) => slugDe(e.nome) === slug);
      if (idx >= 0) entry = { ...rk[idx], posicao: idx + 1 };
    }
  } catch { /* segue com o mínimo */ }

  let nome: string, foto: string | null, elogio: any, total: number, pedidos: number, posicao: number | null;
  if (entry) {
    nome = entry.nome; foto = entry.foto ?? null; elogio = entry.elogio ?? null;
    total = Number(entry.liquido) || 0; pedidos = Number(entry.pedidos) || 0; posicao = entry.posicao ?? null;
  } else {
    const { data: f } = await sb().from("bi_fotos_ranking").select("url").eq("slug", slug).maybeSingle();
    nome = b?.nome ? String(b.nome) : cap(slug); foto = f?.url ?? null; elogio = null; total = 0; pedidos = 0; posicao = null;
  }

  const cmd = { id: String(Date.now()), venda: { nome, foto, elogio, meta: metaVal, total, pedidos, posicao } };
  const erro = await gravarDaFilial("metabatida_comando", q.grupo, JSON.stringify(cmd));
  if (erro) return Response.json({ error: erro }, { status: 500 });
  return Response.json({ ok: true, nome, meta: metaVal });
}
