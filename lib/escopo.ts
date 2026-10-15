import { GRUPOS_FILIAL } from "./rankingFiliais";

// ---------------------------------------------------------------------------
// QUEM VÊ QUAL FILIAL (pedido do dono, 15/10/2026).
//
// O admin do hub configura em `/ranking/admin` (murano-app, tabela `rk_papel`,
// chaveada por e-mail) quem é supervisor e quem é vendedor de cada filial:
// Katiucia supervisora do Maranhão vê só o Maranhão; o Angelo, só Belém.
//
// Quem NÃO está na tabela continua como sempre foi: vê as duas filiais (os
// admins do `acesso` do CRM, como o dono). Estar na tabela RECORTA — é o
// que a configuração existe para fazer.
//
//  - supervisor_<filial>: ganha o "Por dia" e as "Minhas filiais", só da filial;
//  - vendedor_<filial>:   o ranking ao vivo da filial e a própria foto.
// As abas de configuração (Critérios, Metas, TVs, Música) continuam do admin
// do `acesso`; o padrão das TVs vale para todas as filiais, então só quem não
// tem recorte mexe nele.
// ---------------------------------------------------------------------------

export type PapelRanking = { supervisor: boolean; grupo: string };

/** Os valores de `rk_papel.papel` (CHECK da migration 0189 do murano-app). */
export function lerPapelRanking(papel: unknown): PapelRanking | null {
  if (typeof papel !== "string") return null;
  const m = /^(supervisor|vendedor)_([a-z]+)$/.exec(papel);
  if (!m || !GRUPOS_FILIAL.some((g) => g.id === m[2])) return null;
  return { supervisor: m[1] === "supervisor", grupo: m[2] };
}

/** As filiais (codfilial) de um papel; null = sem recorte. */
export function filiaisDoPapel(p: PapelRanking | null): number[] | null {
  if (!p) return null;
  return [...(GRUPOS_FILIAL.find((g) => g.id === p.grupo)?.filiais ?? [])];
}

/**
 * O que sobra do pedido dentro do permitido. `permitidas` null = tudo.
 * Vazio quando nada do pedido é permitido (a rota responde 403).
 */
export function recortar(pedidas: number[], permitidas: number[] | null): number[] {
  return permitidas ? pedidas.filter((f) => permitidas.includes(f)) : pedidas;
}
