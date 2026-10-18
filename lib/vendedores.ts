import { sb } from "./config";
import { filiaisDoGrupo, type Grupo } from "./grupo";
import { slugCompleto, slugDe } from "./slug";

export { normalizar, slugDe, slugCompleto } from "./slug";

// Quem é vendedor de cada filial: quem lançou venda (padrão ou manifesto) nela nos últimos
// DIAS dias, no faturamento do v2 — a mesma tabela que o ranking usa. Não há cadastro de
// vendedor por filial; a venda é o que diz onde a pessoa trabalha. Guardado 10 min em memória.
const V2_URL = "https://api-clientes.muranoprofessional.com.br";
const DIAS = 45;
const VALIDADE_MS = 10 * 60 * 1000;
export type VendedorErp = { nome: string; rca: number | null; pedidos: number; ultima: string };
const cache = new Map<Grupo, { em: number; lista: VendedorErp[] }>();

/** A chave do vendedor na edge function do ranking: o nome do ERP aparado e em maiúsculas. */
export const chaveNome = (n: unknown) => String(n ?? "").trim().toUpperCase();

/** Quem vendeu na filial (nome do ERP, RCA = codusr, pedidos e última venda). Lança se o v2 não responder. */
export async function vendedoresDetalhados(g: Grupo): Promise<VendedorErp[]> {
  const c = cache.get(g);
  if (c && Date.now() - c.em < VALIDADE_MS) return c.lista;
  const { data: cfg } = await sb().from("bi_config").select("valor").eq("chave", "v2_anon_key").maybeSingle();
  if (!cfg?.valor) throw new Error("bi_config sem v2_anon_key");
  const hdr = { apikey: cfg.valor, Authorization: "Bearer " + cfg.valor };
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);
  const porNome = new Map<string, { nome: string; rcas: Map<number, number>; pedidos: Set<number>; ultima: string }>();
  for (let offset = 0; ; offset += 1000) {
    const q = `select=nome_usuario,codusr,pedido,data_emissao&tv=in.(1,14)&codfilial=in.(${filiaisDoGrupo(g).join(",")})&data_emissao=gte.${desde}&order=id.asc&limit=1000&offset=${offset}`;
    const r = await fetch(`${V2_URL}/rest/v1/faturamento?${q}`, { headers: hdr, cache: "no-store" });
    if (!r.ok) throw new Error("v2 HTTP " + r.status);
    const lote: { nome_usuario: string | null; codusr: number | null; pedido: number | null; data_emissao: string | null }[] = await r.json();
    for (const l of lote) {
      if (!l.nome_usuario || !l.nome_usuario.trim()) continue;
      const k = chaveNome(l.nome_usuario);
      const v = porNome.get(k) ?? { nome: l.nome_usuario.trim(), rcas: new Map(), pedidos: new Set(), ultima: "" };
      if (l.codusr != null) v.rcas.set(l.codusr, (v.rcas.get(l.codusr) ?? 0) + 1);
      if (l.pedido != null) v.pedidos.add(l.pedido);
      if (l.data_emissao && l.data_emissao > v.ultima) v.ultima = l.data_emissao;
      porNome.set(k, v);
    }
    if (lote.length < 1000) break;
  }
  // o RCA é o mais frequente do nome (um nome com dois codusr é raro e quase sempre digitação)
  const lista = [...porNome.values()].map((v) => ({
    nome: v.nome,
    rca: [...v.rcas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    pedidos: v.pedidos.size,
    ultima: v.ultima.slice(0, 10),
  }));
  cache.set(g, { em: Date.now(), lista });
  return lista;
}

/** Nomes (como no ERP) de quem vendeu na filial. Lança se o v2 não responder. */
export async function vendedoresDoGrupo(g: Grupo): Promise<string[]> {
  return (await vendedoresDetalhados(g)).map((v) => v.nome);
}

/** Nomes dos consultores que o admin ou o supervisor cadastrou na filial (rk_papel vendedor_<grupo>). */
export async function consultoresCadastrados(g: Grupo): Promise<string[]> {
  const c = sb();
  const { data } = await c.from("rk_papel").select("email,nome").eq("papel", `vendedor_${g}`).eq("ativo", true);
  const semNome = (data ?? []).filter((r: any) => !r.nome).map((r: any) => r.email);
  const { data: us } = semNome.length ? await c.from("app_usuarios").select("email,nome").in("email", semNome) : { data: [] as any[] };
  const nomeDe = new Map((us ?? []).map((u: any) => [String(u.email).toLowerCase(), u.nome]));
  return (data ?? []).map((r: any) => r.nome || nomeDe.get(r.email) || String(r.email).split("@")[0]).filter(Boolean);
}

/** Slugs dos vendedores da filial: quem vendeu nela e quem foi cadastrado como consultor dela. */
export async function slugsDoGrupo(g: Grupo): Promise<Set<string>> {
  const [erp, cad] = await Promise.all([vendedoresDoGrupo(g), consultoresCadastrados(g)]);
  return new Set([...[...erp, ...cad].map(slugDe), ...erp.map(slugCompleto)].filter(Boolean));
}
