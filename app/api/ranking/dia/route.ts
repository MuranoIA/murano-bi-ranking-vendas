import { lerSessao, podeAdmin } from "@/lib/sessao";
import { diaValido, lerFiliais } from "@/lib/rankingFiliais";

export const dynamic = "force-dynamic";

// Ranking de qualquer dia para o supervisor: GET ?dia=AAAA-MM-DD&filiais=1,2. A conta é a da edge function
// bi-ranking-vendas (a mesma regra do VendasPro), calculada na hora para a data pedida. Só admin.
export async function GET(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  if (!podeAdmin(sessao)) return Response.json({ error: "apenas admin" }, { status: 403 });

  const u = new URL(req.url);
  const dia = u.searchParams.get("dia");
  if (!diaValido(dia)) return Response.json({ error: "Data inválida." }, { status: 400 });
  const filiais = lerFiliais(u.searchParams.get("filiais"));
  if (!filiais) return Response.json({ error: "Marque ao menos uma filial." }, { status: 400 });

  const base = process.env.SUPABASE_URL;
  try {
    const r = await fetch(`${base}/functions/v1/bi-ranking-vendas?dia=${dia}&filiais=${filiais.join(",")}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.erro) throw new Error(j?.erro ?? "HTTP " + r.status);
    return Response.json({
      dia: j.dia, aoVivo: !!j.aoVivo, filiais: j.filiais ?? filiais, geradoEm: j.geradoEm, semDados: !!j.semDados,
      totais: j.totais, ranking: (j.ranking ?? []).map((e: any) => ({
        nome: e.nome, bruto: e.bruto, devolucoes: e.devolucoes, liquido: e.liquido, pedidos: e.pedidos, clientes: e.clientes,
      })),
    });
  } catch (e: any) {
    return Response.json({ error: "Não foi possível calcular o ranking: " + (e?.message ?? e) }, { status: 502 });
  }
}
