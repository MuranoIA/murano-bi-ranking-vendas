import { sb } from "./config";
import { filiaisDoGrupo, type Grupo } from "./grupo";

// Quem é vendedor de cada filial: quem lançou venda (padrão ou manifesto) nela nos últimos
// DIAS dias, no faturamento do v2 — a mesma tabela que o ranking usa. Não há cadastro de
// vendedor por filial; a venda é o que diz onde a pessoa trabalha. Guardado 10 min em memória.
const V2_URL = "https://jjvbmqycgjgkwidgcmif.supabase.co";
const DIAS = 45;
const VALIDADE_MS = 10 * 60 * 1000;
const cache = new Map<Grupo, { em: number; nomes: string[] }>();

export const normalizar = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
/** O slug do ranking é o 1º nome (bi_fotos_ranking, bi_meta_vendedor e a edge function usam o mesmo). */
export const slugDe = (nome: unknown) => normalizar(nome).split(" ")[0] || "";

/** Nomes (como no ERP) de quem vendeu na filial. Lança se o v2 não responder. */
export async function vendedoresDoGrupo(g: Grupo): Promise<string[]> {
  const c = cache.get(g);
  if (c && Date.now() - c.em < VALIDADE_MS) return c.nomes;
  const { data: cfg } = await sb().from("bi_config").select("valor").eq("chave", "v2_anon_key").maybeSingle();
  if (!cfg?.valor) throw new Error("bi_config sem v2_anon_key");
  const hdr = { apikey: cfg.valor, Authorization: "Bearer " + cfg.valor };
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);
  const nomes = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const q = `select=nome_usuario&tv=in.(1,14)&codfilial=in.(${filiaisDoGrupo(g).join(",")})&data_emissao=gte.${desde}&order=id.asc&limit=1000&offset=${offset}`;
    const r = await fetch(`${V2_URL}/rest/v1/faturamento?${q}`, { headers: hdr, cache: "no-store" });
    if (!r.ok) throw new Error("v2 HTTP " + r.status);
    const lote: { nome_usuario: string | null }[] = await r.json();
    for (const l of lote) if (l.nome_usuario && l.nome_usuario.trim()) nomes.add(l.nome_usuario.trim());
    if (lote.length < 1000) break;
  }
  const lista = [...nomes];
  cache.set(g, { em: Date.now(), nomes: lista });
  return lista;
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
  return new Set([...erp, ...cad].map(slugDe).filter(Boolean));
}
