import { gravarDaFilial, lerDaFilial, quemConfigura } from "@/lib/config";
import { chaveNome, vendedoresDetalhados } from "@/lib/vendedores";

export const dynamic = "force-dynamic";

// CONSULTORES DA FILIAL (pedido do dono, 15/10/2026): a lista vem do BANCO, não de cadastro.
// São as pessoas que lançaram venda na filial nos últimos 45 dias, no faturamento do v2 (a mesma
// fonte do ranking), cada uma com o RCA (codusr). A filial sai da venda: o RCA vende em uma filial
// só (o "Administrativo Venus" vende nas duas e aparece nas duas). O supervisor só decide quem
// APARECE no ranking da filial dele:
//  GET  ?grupo=              a lista, com `aparece`
//  PATCH { nome, aparece }   esconde ou volta a mostrar
// Os escondidos ficam em bi_config `ranking_ocultos:<grupo>` (JSON com os nomes em maiúsculas, a
// chave da edge function bi-ranking-vendas, que tira a pessoa da lista e da chamada de venda; as
// vendas dela continuam no total da filial).
const BASE = "ranking_ocultos";

async function lerOcultos(g: Parameters<typeof lerDaFilial>[1]): Promise<string[]> {
  const { valor, herdado } = await lerDaFilial(BASE, g);
  if (herdado || !valor) return [];
  try { const o = JSON.parse(valor); return Array.isArray(o) ? o.map(chaveNome).filter(Boolean) : []; } catch { return []; }
}

export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  try {
    const [erp, ocultos] = await Promise.all([vendedoresDetalhados(q.grupo), lerOcultos(q.grupo)]);
    const escondidos = new Set(ocultos);
    const vistos = new Set(erp.map((v) => chaveNome(v.nome)));
    const consultores = [
      ...erp.map((v) => ({ ...v, aparece: !escondidos.has(chaveNome(v.nome)) })),
      // escondido que não vendeu na janela: continua na lista, para poder voltar
      ...ocultos.filter((k) => !vistos.has(k)).map((k) => ({ nome: k, rca: null, pedidos: 0, ultima: "", aparece: false })),
    ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return Response.json({ consultores, grupo: q.grupo });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const k = chaveNome(b?.nome);
  if (!k || typeof b?.aparece !== "boolean") return Response.json({ error: "Informe nome e aparece." }, { status: 400 });
  try {
    const ocultos = new Set(await lerOcultos(q.grupo));
    if (b.aparece) ocultos.delete(k);
    else {
      // só esconde quem é da filial (ou já estava escondido)
      const daFilial = (await vendedoresDetalhados(q.grupo)).some((v) => chaveNome(v.nome) === k);
      if (!daFilial && !ocultos.has(k)) return Response.json({ error: "Esse consultor não vendeu nesta filial." }, { status: 404 });
      ocultos.add(k);
    }
    const erro = await gravarDaFilial(BASE, q.grupo, JSON.stringify([...ocultos].sort()));
    if (erro) return Response.json({ error: erro }, { status: 500 });
    return Response.json({ ok: true, nome: k, aparece: b.aparece });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 502 });
  }
}
