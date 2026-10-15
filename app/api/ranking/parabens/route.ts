import { quemConfigura, gravarDaFilial } from "@/lib/config";
import { filiaisDoGrupo, type Grupo } from "@/lib/grupo";

export const dynamic = "force-dynamic";

// Parabéns por cliente, nas TVs da filial.
//  GET:  as vendas de HOJE da filial (edge fn ?vendas=1&filiais=), uma linha por pedido, para a tela
//        mostrar a lista das clientes que compraram hoje.
//  POST { pedido }: grava bi_config.parabens_comando:<grupo> com a venda + id único; os painéis da
//        filial conferem via ?comando=1 (~6 s) e mostram a tela de parabéns dessa venda.
// Admin ou supervisor da filial. Escrita SÓ no murano-conversas (bi_config).
async function vendasDeHoje(g: Grupo): Promise<any[]> {
  const r = await fetch(`${process.env.SUPABASE_URL}/functions/v1/bi-ranking-vendas?vendas=1&filiais=${filiaisDoGrupo(g).join(",")}`, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return Array.isArray(j?.vendas) ? j.vendas : [];
}

export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  try {
    const vendas = (await vendasDeHoje(q.grupo))
      .map((v) => ({ pedido: v.pedido, cliente: v.cliente, vendedor: v.vendedor, valor: v.valor }))
      .sort((a, b) => b.pedido - a.pedido); // a mais recente primeiro
    return Response.json({ vendas, grupo: q.grupo });
  } catch (e: any) {
    return Response.json({ error: "Não foi possível ler as vendas de hoje: " + (e?.message ?? e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const pedido = Number(b?.pedido);
  if (!Number.isInteger(pedido) || pedido <= 0) return Response.json({ error: "Escolha uma venda da lista." }, { status: 400 });

  let vendas: any[];
  try { vendas = await vendasDeHoje(q.grupo); }
  catch (e: any) { return Response.json({ error: "Não foi possível ler as vendas de hoje: " + (e?.message ?? e) }, { status: 502 }); }
  // só uma venda de hoje da própria filial: o pedido vem do navegador
  const venda = vendas.find((v) => Number(v.pedido) === pedido);
  if (!venda) return Response.json({ error: "Essa venda não está mais entre as de hoje desta filial. Atualize a lista." }, { status: 404 });

  const erro = await gravarDaFilial("parabens_comando", q.grupo, JSON.stringify({ id: String(Date.now()), venda }));
  if (erro) return Response.json({ error: erro }, { status: 500 });
  return Response.json({ ok: true, cliente: venda.cliente, vendedor: venda.vendedor, valor: venda.valor });
}
