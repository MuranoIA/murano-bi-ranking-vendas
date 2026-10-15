import { GRUPOS_FILIAL } from "./rankingFiliais";

// ---------------------------------------------------------------------------
// CADA FILIAL COM A SUA CONFIGURAÇÃO (pedido do dono, 15/10/2026).
//
// As mesmas telas para todos os supervisores, mas o que um supervisor muda vale
// só para a filial dele: critério, meta do dia, música dos parabéns e os
// comandos das TVs (desfile, parabéns, meta batida). Em bi_config cada chave
// ganha o sufixo do grupo — `ranking_criterio:belem`, `meta_dia:maranhao`… A
// edge function bi-ranking-vendas (repo murano-crm) lê a do grupo do painel e,
// sem ela, a chave antiga sem sufixo (que valia para todas as TVs).
//
// Quem configura: admin do `acesso` ou supervisor de filial (rk_papel). O
// supervisor só tem os grupos da filial dele; o admin sem recorte escolhe na tela.
// ---------------------------------------------------------------------------

export type Grupo = "belem" | "maranhao";

export const ehGrupo = (v: unknown): v is Grupo => GRUPOS_FILIAL.some((g) => g.id === v);

/** Os grupos inteiros dentro de um conjunto de filiais; null = todos. */
export function gruposPermitidos(filiais: number[] | null): Grupo[] {
  return GRUPOS_FILIAL.filter((g) => !filiais || g.filiais.every((f) => filiais.includes(f))).map((g) => g.id as Grupo);
}

/** O grupo pedido, se a pessoa pode; senão o primeiro que ela pode. null = nenhum. */
export function escolherGrupo(pedido: unknown, filiais: number[] | null): Grupo | null {
  const pode = gruposPermitidos(filiais);
  if (ehGrupo(pedido) && pode.includes(pedido)) return pedido;
  return pode[0] ?? null;
}

export const filiaisDoGrupo = (g: Grupo): number[] => [...(GRUPOS_FILIAL.find((x) => x.id === g)?.filiais ?? [])];
export const rotuloDoGrupo = (g: Grupo): string => GRUPOS_FILIAL.find((x) => x.id === g)?.rotulo ?? g;

/** Chave de bi_config da filial. */
export const chaveDoGrupo = (base: string, g: Grupo): string => `${base}:${g}`;

/** Acrescenta `grupo=` a um caminho da API (lado do navegador). */
export const comGrupo = (u: string, g: Grupo | null) => (g ? u + (u.includes("?") ? "&" : "?") + "grupo=" + g : u);
