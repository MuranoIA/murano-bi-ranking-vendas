import { quemConfigura, lerDaFilial, gravarDaFilial } from "@/lib/config";
import { CRITERIO_PADRAO, lerCriterio } from "@/lib/criterio";

export const dynamic = "force-dynamic";

// O critério do ranking da filial (bi_config.ranking_criterio:<grupo>, lib/grupo.ts). Admin ou
// supervisor da filial. Sem critério próprio vale o antigo, de todas as TVs (`herdado`).
// A edge function bi-ranking-vendas lê a chave da filial a cada atualização do painel (~1 min).
export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  try {
    const { valor, herdado } = await lerDaFilial("ranking_criterio", q.grupo);
    return Response.json({ criterio: lerCriterio(valor) ?? CRITERIO_PADRAO, herdado, grupo: q.grupo });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const criterio = lerCriterio(b?.criterio);
  if (!criterio) return Response.json({ error: "Marque ao menos venda padrão ou venda de manifesto." }, { status: 400 });
  const erro = await gravarDaFilial("ranking_criterio", q.grupo, JSON.stringify(criterio));
  if (erro) return Response.json({ error: erro }, { status: 500 });
  return Response.json({ ok: true, criterio, grupo: q.grupo });
}
