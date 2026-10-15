// Filiais do ranking (demanda #111). Código = codfilial do ERP (tabela faturamento do v2).
// Belém soma a Vênus (1) e a MADA (2), que são a mesma operação; a Exclusiva (3) é do Maranhão.
export type GrupoFilial = { id: string; rotulo: string; filiais: number[] };

export const GRUPOS_FILIAL: readonly GrupoFilial[] = [
  { id: "belem", rotulo: "Belém (Vênus + MADA)", filiais: [1, 2] },
  { id: "maranhao", rotulo: "Maranhão (Exclusiva)", filiais: [3] },
] as const;

/** Padrão quando nada foi configurado: só Belém, como o painel sempre foi. */
export const FILIAIS_PADRAO: number[] = [1, 2];

const VALIDAS = GRUPOS_FILIAL.flatMap((g) => g.filiais);

/** Aceita array ou texto JSON/CSV; devolve só filiais conhecidas, sem repetir e em ordem. Vazio -> null. */
export function lerFiliais(v: unknown): number[] | null {
  let arr: unknown = v;
  if (typeof v === "string") {
    try { arr = JSON.parse(v); } catch { arr = v.split(","); }
  }
  // "3" e JSON valido (o numero 3), nao um array: sem isto uma filial so era ignorada
  if (typeof arr === "number") arr = [arr];
  if (!Array.isArray(arr)) return null;
  const f = [...new Set(arr.map((x) => Number(x)).filter((x) => VALIDAS.includes(x)))].sort((a, b) => a - b);
  return f.length ? f : null;
}

/** Quais grupos estão totalmente marcados num conjunto de filiais. */
export const gruposMarcados = (filiais: number[]): string[] =>
  GRUPOS_FILIAL.filter((g) => g.filiais.every((f) => filiais.includes(f))).map((g) => g.id);

/** Junta os grupos escolhidos nas filiais correspondentes. */
export const filiaisDosGrupos = (ids: string[]): number[] =>
  [...new Set(GRUPOS_FILIAL.filter((g) => ids.includes(g.id)).flatMap((g) => g.filiais))].sort((a, b) => a - b);

/** Chave em bi_config: uma por pessoa (e-mail do login) e uma para o painel das TVs. */
export const chaveFiliais = (email?: string | null): string =>
  email ? `ranking_filiais:${email.trim().toLowerCase()}` : "ranking_filiais";

/** AAAA-MM-DD válido (e que existe no calendário). */
export function diaValido(d: unknown): d is string {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + "T12:00:00Z");
  return !isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}
