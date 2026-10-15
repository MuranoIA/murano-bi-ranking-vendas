import { quemConfigura, sb } from "@/lib/config";
import { consultoresCadastrados, slugDe, slugsDoGrupo, vendedoresDoGrupo } from "@/lib/vendedores";

export const dynamic = "force-dynamic";

// Metas individuais por vendedor (bi_meta_vendedor, slug = 1º nome), da filial (lib/grupo.ts).
// GET: os vendedores da filial (quem vendeu nela nos últimos dias e os consultores cadastrados nela,
//      lib/vendedores.ts) e a meta de cada.
//      É também a lista de consultores da aba "Minha foto".
// POST { metas:[{slug,nome,meta}] }: grava só vendedores da filial. Admin ou supervisor.
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const primeiroNome = (nome: any) => cap((String(nome ?? "").trim().split(/\s+/)[0] || "").toLowerCase());

export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let nomes: string[];
  try { nomes = [...(await vendedoresDoGrupo(q.grupo)), ...(await consultoresCadastrados(q.grupo))]; }
  catch (e: any) { return Response.json({ error: "Não foi possível ler os vendedores da filial: " + (e?.message ?? e) }, { status: 502 }); }

  const roster = new Map<string, { slug: string; nome: string; meta: number }>();
  for (const n of nomes) { const s = slugDe(n); if (s && !roster.has(s)) roster.set(s, { slug: s, nome: primeiroNome(n), meta: 0 }); }
  const { data: metas } = await sb().from("bi_meta_vendedor").select("slug,nome,meta").in("slug", [...roster.keys()]);
  for (const m of (metas ?? [])) { const cur = roster.get(m.slug); if (cur) { cur.meta = Number(m.meta) || 0; if (m.nome) cur.nome = m.nome; } }

  const lista = [...roster.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return Response.json({ metas: lista, grupo: q.grupo });
}

export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const metas = Array.isArray(b?.metas) ? b.metas : null;
  if (!metas) return Response.json({ error: "metas inválidas" }, { status: 400 });

  let daFilial: Set<string>;
  try { daFilial = await slugsDoGrupo(q.grupo); }
  catch (e: any) { return Response.json({ error: "Não foi possível conferir os vendedores da filial: " + (e?.message ?? e) }, { status: 502 }); }

  const rows = metas
    .map((m: any) => ({ slug: slugDe(m.slug || m.nome), nome: m.nome ? String(m.nome) : null, meta: Math.max(0, Math.round(Number(m.meta) || 0)), atualizado_em: new Date().toISOString() }))
    .filter((r: any) => r.slug);
  const fora = rows.filter((r: any) => !daFilial.has(r.slug));
  if (fora.length) return Response.json({ error: "Só dá para mudar a meta de vendedores desta filial: " + fora.map((r: any) => r.slug).join(", ") }, { status: 403 });
  if (rows.length) {
    const { error } = await sb().from("bi_meta_vendedor").upsert(rows, { onConflict: "slug" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, count: rows.length });
}
