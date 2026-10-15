import { lerSessao, podeVerDia } from "@/lib/sessao";
import { recortar } from "@/lib/escopo";
import { diaValido, lerFiliais } from "@/lib/rankingFiliais";
import { lerCriterio } from "@/lib/criterio";

export const dynamic = "force-dynamic";

// Ranking de qualquer dia para o supervisor: GET ?dia=AAAA-MM-DD&filiais=1,2[&criterio=<json>].
// Sem `criterio`, vale o critério salvo (o mesmo das TVs); com ele, é a prévia da aba Critérios. A conta é a da edge function
// bi-ranking-vendas (a mesma regra do VendasPro), calculada na hora para a data pedida. Só admin.
export async function GET(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  if (!podeVerDia(sessao)) return Response.json({ error: "apenas supervisor" }, { status: 403 });

  const u = new URL(req.url);
  const dia = u.searchParams.get("dia");
  if (!diaValido(dia)) return Response.json({ error: "Data inválida." }, { status: 400 });
  const pedidas = lerFiliais(u.searchParams.get("filiais"));
  if (!pedidas) return Response.json({ error: "Marque ao menos uma filial." }, { status: 400 });
  const filiais = recortar(pedidas, sessao.filiais);
  if (!filiais.length) return Response.json({ error: "Você só vê a sua filial." }, { status: 403 });

  const critParam = u.searchParams.get("criterio");
  const criterio = critParam ? lerCriterio(critParam) : null;
  if (critParam && !criterio) return Response.json({ error: "Marque ao menos venda padrão ou venda de manifesto." }, { status: 400 });
  const extra = criterio ? "&criterio=" + encodeURIComponent(JSON.stringify(criterio)) : "";

  const base = process.env.SUPABASE_URL;
  try {
    const r = await fetch(`${base}/functions/v1/bi-ranking-vendas?dia=${dia}&filiais=${filiais.join(",")}${extra}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.erro) throw new Error(j?.erro ?? "HTTP " + r.status);
    return Response.json({
      dia: j.dia, aoVivo: !!j.aoVivo, filiais: j.filiais ?? filiais, geradoEm: j.geradoEm, semDados: !!j.semDados,
      criterio: j.criterioInfo ? { texto: j.criterioInfo.texto, rotulo: j.criterioInfo.rotulo ?? null, modo: j.criterioInfo.modo } : null,
      totais: j.totais, ranking: (j.ranking ?? []).map((e: any) => ({
        nome: e.nome, bruto: e.bruto, devolucoes: e.devolucoes, liquido: e.liquido, pedidos: e.pedidos, clientes: e.clientes,
      })),
    });
  } catch (e: any) {
    return Response.json({ error: "Não foi possível calcular o ranking: " + (e?.message ?? e) }, { status: 502 });
  }
}
