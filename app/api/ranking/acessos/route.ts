import { sb } from "@/lib/config";
import { ehSuperAdminSessao, lerSessao } from "@/lib/sessao";
import { normalizar, vendedoresDetalhados } from "@/lib/vendedores";
import type { Grupo } from "@/lib/grupo";
import { CHAVE_SUPER_ADMINS, SUPER_ADMIN_FIXO, lerListaSuperAdmins } from "@/lib/acessoRanking";

export const dynamic = "force-dynamic";

// ACESSOS DO RANKING (pedido do dono, 03/11/2026): o super admin define aqui, sem pedir por chat,
// o que cada pessoa do hub vê no Ranking.
//  GET                       as pessoas do hub (app_usuarios ativos + quem já tem papel) com o papel de cada uma
//  PATCH { email, papel }    papel = super_admin | supervisor_belem | supervisor_maranhao |
//                            vendedor_belem | vendedor_maranhao | nenhum
// Supervisor e vendedor ficam em `rk_papel` (a mesma tabela do `/ranking/admin` do hub, então os dois
// lugares mostram a mesma coisa); super admin fica em bi_config `ranking_super_admins`.
// Vale na próxima vez que a pessoa abrir a tela (app/controle confere o acesso a cada abertura).
const PAPEIS_RK = ["supervisor_belem", "supervisor_maranhao", "vendedor_belem", "vendedor_maranhao"] as const;
type Papel = (typeof PAPEIS_RK)[number] | "super_admin" | "nenhum";
const ehPapel = (v: unknown): v is Papel => v === "super_admin" || v === "nenhum" || (PAPEIS_RK as readonly string[]).includes(v as string);

function quemGere() {
  const sessao = lerSessao();
  if (!sessao) return { erro: Response.json({ error: "não autenticado" }, { status: 401 }) };
  if (!ehSuperAdminSessao(sessao)) return { erro: Response.json({ error: "Só o super admin configura os acessos." }, { status: 403 }) };
  return { sessao };
}

// SUGESTÃO pela venda: quem não tem papel mas vendeu numa filial nos últimos 45 dias (faturamento
// do ERP). O nome do hub ("Andre de Souza") e o do ERP ("ANDRE DE SOUSA BARROSO") nem sempre batem,
// então é só sugestão — o super admin confirma. Casa o 1º nome e, se o hub tiver sobrenome, o
// começo (4 letras) de algum sobrenome; só sugere quando há UMA pessoa do ERP compatível.
type Sugestao = { papel: Papel; erp: string };
function sugerir(nome: string, erp: { grupo: Grupo; nome: string }[]): Sugestao | null {
  const [primeiro, ...resto] = normalizar(nome).split(" ").filter(Boolean);
  if (!primeiro) return null;
  const achados = erp.filter((v) => {
    const [p, ...sob] = normalizar(v.nome).split(" ");
    if (p !== primeiro) return false;
    return resto.length === 0 || resto.some((r) => sob.some((x) => x.slice(0, 4) === r.slice(0, 4)));
  });
  const nomes = new Set(achados.map((a) => a.nome.toUpperCase()));
  const grupos = new Set(achados.map((a) => a.grupo));
  if (nomes.size !== 1 || grupos.size !== 1) return null;
  return { papel: `vendedor_${achados[0].grupo}` as Papel, erp: achados[0].nome };
}

async function lerSuperAdmins(): Promise<string[]> {
  const { data, error } = await sb().from("bi_config").select("valor").eq("chave", CHAVE_SUPER_ADMINS).maybeSingle();
  if (error) throw new Error(error.message);
  return lerListaSuperAdmins(data?.valor);
}

export async function GET() {
  const q = quemGere();
  if (q.erro) return q.erro;
  try {
    const c = sb();
    const [{ data: us, error: e1 }, { data: rk, error: e2 }, supers] = await Promise.all([
      c.from("app_usuarios").select("email,nome").eq("ativo", true),
      c.from("rk_papel").select("email,papel,nome,ativo"),
      lerSuperAdmins(),
    ]);
    if (e1 || e2) throw new Error((e1 ?? e2)!.message);
    const pessoas = new Map<string, { email: string; nome: string; papel: Papel }>();
    for (const u of us ?? []) {
      const email = String(u.email ?? "").trim().toLowerCase();
      if (email) pessoas.set(email, { email, nome: u.nome || email.split("@")[0], papel: "nenhum" });
    }
    for (const r of rk ?? []) {
      const email = String(r.email ?? "").trim().toLowerCase();
      if (!email) continue;
      const p = pessoas.get(email) ?? { email, nome: r.nome || email.split("@")[0], papel: "nenhum" as Papel };
      p.papel = r.ativo === false || !ehPapel(r.papel) ? "nenhum" : r.papel;
      pessoas.set(email, p);
    }
    for (const email of supers) {
      const p = pessoas.get(email) ?? { email, nome: email.split("@")[0], papel: "nenhum" as Papel };
      p.papel = "super_admin";
      pessoas.set(email, p);
    }
    // a venda do ERP só para sugerir; se o ERP não responder, a tela funciona sem a sugestão
    const erp: { grupo: Grupo; nome: string }[] = [];
    await Promise.all((["belem", "maranhao"] as Grupo[]).map(async (g) => {
      try { for (const v of await vendedoresDetalhados(g)) erp.push({ grupo: g, nome: v.nome }); } catch { /* sem sugestão */ }
    }));
    const lista = [...pessoas.values()]
      .map((p) => ({ ...p, sugestao: p.papel === "nenhum" ? sugerir(p.nome, erp) : null }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return Response.json({ pessoas: lista, fixo: SUPER_ADMIN_FIXO, eu: q.sessao.email });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const q = quemGere();
  if (q.erro) return q.erro;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  const papel = b?.papel;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !ehPapel(papel)) return Response.json({ error: "Informe e-mail e papel." }, { status: 400 });
  if (email === SUPER_ADMIN_FIXO && papel !== "super_admin") return Response.json({ error: "O Romulo é super admin fixo." }, { status: 400 });
  if (email === q.sessao.email && papel !== "super_admin") return Response.json({ error: "Você não pode tirar o seu próprio acesso de super admin." }, { status: 400 });
  try {
    const c = sb();
    const supers = await lerSuperAdmins();
    const novaLista = papel === "super_admin" ? [...new Set([...supers, email])] : supers.filter((e) => e !== email);
    if (novaLista.join() !== supers.join()) {
      const { error } = await c.from("bi_config")
        .upsert({ chave: CHAVE_SUPER_ADMINS, valor: JSON.stringify(novaLista.sort()), atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
      if (error) throw new Error(error.message);
    }
    if (papel === "super_admin" || papel === "nenhum") {
      const { error } = await c.from("rk_papel").delete().eq("email", email);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await c.from("rk_papel").upsert({ email, papel, ativo: true }, { onConflict: "email" });
      if (error) throw new Error(error.message);
    }
    return Response.json({ ok: true, email, papel });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
