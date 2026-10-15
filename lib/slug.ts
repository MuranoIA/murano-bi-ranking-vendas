// Puro (vale na tela e no servidor): as chaves de nome do ranking.
export const normalizar = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
/** O slug do ranking é o 1º nome (bi_meta_vendedor e as fotos antigas usam o mesmo). */
export const slugDe = (nome: unknown) => normalizar(nome).split(" ")[0] || "";
/** A chave da FOTO desde 15/10/2026: o nome completo do ERP (dois "Luis" não dividem mais a foto).
 *  A edge function cai no 1º nome (slugDe) quando não há foto pelo nome completo. */
export const slugCompleto = (nome: unknown) => normalizar(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
