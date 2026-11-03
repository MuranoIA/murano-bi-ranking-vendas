import { normalizar, vendedoresDetalhados } from "./vendedores";
import type { Grupo } from "./grupo";

// ---------------------------------------------------------------------------
// QUEM DO HUB É QUAL VENDEDOR DO ERP (pedido do dono, 03/11/2026: consultores do
// Maranhão sem papel não conseguiam pôr foto nem abrir o ranking da filial).
//
// O nome do hub ("Luis Wagner") e o do ERP ("LUIS WAGNER SILVA NOGUEIRA") nem
// sempre são iguais. Casa o 1º nome e, se o hub tiver sobrenome, o começo (3
// letras) de algum sobrenome do ERP. Só vale quando sobra UMA pessoa do ERP, de
// UMA filial — dois "Luis" sem sobrenome no hub não casam com ninguém.
// ---------------------------------------------------------------------------

export type VendedorDaFilial = { grupo: Grupo; nome: string };

/** Quem vendeu em cada filial nos últimos 45 dias. Filial que não responder fica de fora. */
export async function vendedoresErp(grupos: Grupo[] = ["belem", "maranhao"]): Promise<VendedorDaFilial[]> {
  const out: VendedorDaFilial[] = [];
  await Promise.all(grupos.map(async (g) => {
    try { for (const v of await vendedoresDetalhados(g)) out.push({ grupo: g, nome: v.nome }); } catch { /* sem ERP */ }
  }));
  return out;
}

export function casarNoErp(nome: unknown, erp: VendedorDaFilial[]): VendedorDaFilial | null {
  const [primeiro, ...sobrenomes] = normalizar(nome).split(" ").filter(Boolean);
  const resto = sobrenomes.filter((x) => x.length > 2); // "de", "da" não contam
  if (!primeiro) return null;
  const achados = erp.filter((v) => {
    const [p, ...sob] = normalizar(v.nome).split(" ");
    if (p !== primeiro) return false;
    return resto.length === 0 || resto.some((r) => sob.some((x) => x.length > 2 && x.slice(0, 3) === r.slice(0, 3)));
  });
  const nomes = new Set(achados.map((a) => normalizar(a.nome)));
  if (nomes.size !== 1 || new Set(achados.map((a) => a.grupo)).size !== 1) return null;
  return achados[0];
}
