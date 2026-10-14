// O critério que compõe o valor do ranking (Café Code, demanda #1 do Ranking, 14/10/2026).
//
// Guardado em bi_config.ranking_criterio e lido pela edge function bi-ranking-vendas (repo
// murano-crm), que aplica a MESMA regra. Vale para todas as TVs e para os dias anteriores
// (decisões do dono). "padrao" = a regra do VendasPro; "personalizado" = os itens marcados.
export type Criterio = {
  modo: "padrao" | "personalizado";
  venda: boolean; // venda padrão (TV 1)
  manifesto: boolean; // venda de manifesto (TV 14)
  devolucoes: boolean; // descontar devoluções lançadas no dia
  soFaturados: boolean; // deixar de fora pedidos ainda não faturados (Liberado, Bloqueado…)
  data: "emissao" | "faturamento"; // qual data define o dia do pedido
};

export const CRITERIO_PADRAO: Criterio = { modo: "padrao", venda: true, manifesto: true, devolucoes: true, soFaturados: false, data: "emissao" };

/** Lê e valida; null = inválido (nenhum tipo de venda marcado ou formato errado). */
export function lerCriterio(v: unknown): Criterio | null {
  let o: any = v;
  if (typeof v === "string") { try { o = JSON.parse(v); } catch { return null; } }
  if (!o || typeof o !== "object") return null;
  if (o.modo !== "personalizado") return CRITERIO_PADRAO;
  const c: Criterio = {
    modo: "personalizado",
    venda: o.venda !== false,
    manifesto: o.manifesto !== false,
    devolucoes: o.devolucoes !== false,
    soFaturados: o.soFaturados === true,
    data: o.data === "faturamento" ? "faturamento" : "emissao",
  };
  return c.venda || c.manifesto ? c : null;
}

/** A etiqueta que a TV mostra; null no padrão. Mesmo texto da edge function. */
export function rotuloDoCriterio(c: Criterio): string | null {
  if (c.modo === "padrao") return null;
  const dif: string[] = [];
  if (!c.venda) dif.push("sem venda padrão");
  if (!c.manifesto) dif.push("sem manifesto");
  if (!c.devolucoes) dif.push("sem devoluções");
  if (c.soFaturados) dif.push("só faturados");
  if (c.data === "faturamento") dif.push("pela data de faturamento");
  return "Critério personalizado" + (dif.length ? ": " + dif.join(" · ") : "");
}
