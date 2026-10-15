import { quemConfigura, sb } from "@/lib/config";
import { rotuloDoGrupo, type Grupo } from "@/lib/grupo";
import { normalizar } from "@/lib/vendedores";

export const dynamic = "force-dynamic";

// CONSULTORES DA FILIAL (pedido do dono, 15/10/2026): o supervisor adiciona e tira os
// vendedores da filial dele no Ranking, sem depender do admin do hub. É a mesma tabela que o
// admin do hub edita em `/ranking/admin` (rk_papel, migration 0189 do murano-app):
//  GET  ?grupo=           os consultores da filial; com &busca=texto, as contas do hub que batem
//  POST { email }         vira vendedor_<grupo> e ganha o card do Ranking no hub (sem o card a
//                         pessoa nem chega ao Ranking, que entra pelo hub)
//  DELETE ?email=         demite: desativa (só quem é vendedor DESTA filial) e tira o card do Ranking
// O supervisor nunca mexe em supervisor nem em gente da outra filial. Quem foi adicionado entra
// como consultor no próximo acesso (a sessão é refeita pelo hub).
const papelDo = (g: Grupo) => `vendedor_${g}`;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const descrever = (papel: string) => {
  const m = /^(supervisor|vendedor)_(belem|maranhao)$/.exec(papel);
  return m ? `${m[1] === "supervisor" ? "supervisor" : "consultor"} de ${rotuloDoGrupo(m[2] as Grupo)}` : papel;
};

export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  const c = sb();
  const busca = normalizar(new URL(req.url).searchParams.get("busca"));
  if (busca) {
    if (busca.length < 2) return Response.json({ contas: [] });
    const t = busca.replace(/[%_,()]/g, "");
    const { data, error } = await c.from("app_usuarios").select("email,nome").eq("ativo", true)
      .or(`nome.ilike.%${t}%,email.ilike.%${t}%`).order("nome").limit(15);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const emails = (data ?? []).map((u: any) => String(u.email).toLowerCase());
    const { data: rk } = emails.length ? await c.from("rk_papel").select("email,papel,ativo").in("email", emails) : { data: [] as any[] };
    const papelDe = new Map((rk ?? []).filter((r: any) => r.ativo).map((r: any) => [r.email, r.papel]));
    return Response.json({
      contas: (data ?? []).map((u: any) => {
        const email = String(u.email).toLowerCase();
        const papel = papelDe.get(email) as string | undefined;
        return { email, nome: u.nome ?? email, situacao: papel ? descrever(papel) : null, jaEhDaFilial: papel === papelDo(q.grupo) };
      }),
    });
  }

  const { data, error } = await c.from("rk_papel").select("email,nome").eq("papel", papelDo(q.grupo)).eq("ativo", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const emails = (data ?? []).map((r: any) => r.email);
  const { data: us } = emails.length ? await c.from("app_usuarios").select("email,nome").in("email", emails) : { data: [] as any[] };
  const nomeDe = new Map((us ?? []).map((u: any) => [String(u.email).toLowerCase(), u.nome]));
  const consultores = (data ?? [])
    .map((r: any) => ({ email: r.email, nome: r.nome || nomeDe.get(r.email) || r.email }))
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR"));
  return Response.json({ consultores, grupo: q.grupo });
}

export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const email = String(b?.email ?? "").trim().toLowerCase();
  if (!EMAIL_OK.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 400 });

  const c = sb();
  const { data: conta } = await c.from("app_usuarios").select("id,nome,ativo").eq("email", email).maybeSingle();
  if (!conta || conta.ativo === false) return Response.json({ error: "Essa pessoa não tem conta ativa no hub. Peça ao administrador do hub para criar a conta." }, { status: 404 });

  const { data: atual } = await c.from("rk_papel").select("papel,ativo").eq("email", email).maybeSingle();
  if (atual?.ativo && atual.papel !== papelDo(q.grupo)) {
    return Response.json({ error: `Essa pessoa já está no Ranking como ${descrever(atual.papel)}. Só o administrador do hub muda isso.` }, { status: 409 });
  }
  const { error } = await c.from("rk_papel").upsert({ email, papel: papelDo(q.grupo), nome: conta.nome ?? null, ativo: true }, { onConflict: "email" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // o card do Ranking no hub: é por ele que a pessoa entra
  const { error: erroCard } = await c.from("app_modulo_acesso")
    .upsert({ usuario_id: conta.id, modulo_slug: "ranking" }, { onConflict: "usuario_id,modulo_slug", ignoreDuplicates: true });
  return Response.json({ ok: true, email, nome: conta.nome ?? email, avisoCard: erroCard ? "Consultor adicionado, mas não consegui liberar o card do Ranking no hub: peça ao administrador." : null });
}

export async function DELETE(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  const email = String(new URL(req.url).searchParams.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_OK.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 400 });
  // só desativa vendedor desta filial (o filtro de papel garante)
  const { data, error } = await sb().from("rk_papel").update({ ativo: false }).eq("email", email).eq("papel", papelDo(q.grupo)).select("email");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data?.length) return Response.json({ error: "Essa pessoa não é consultora desta filial." }, { status: 404 });
  // tira o card do Ranking no hub (quem manda no card dos outros sistemas continua sendo o admin do hub)
  const { data: conta } = await sb().from("app_usuarios").select("id").eq("email", email).maybeSingle();
  if (conta?.id) await sb().from("app_modulo_acesso").delete().eq("usuario_id", conta.id).eq("modulo_slug", "ranking");
  return Response.json({ ok: true });
}
