import { createClient } from "@supabase/supabase-js";
import { filiaisDoPapel, lerPapelRanking } from "./escopo";
import { slugCompleto, slugDe } from "./vendedores";
import { casarNoErp, vendedoresErp } from "./casarErp";
import type { Sessao } from "./sessao";

// ---------------------------------------------------------------------------
// O QUE CADA PESSOA VÊ NO RANKING (pedido do dono, 03/11/2026).
//
//  - supervisor do Maranhão: só o Maranhão; supervisor de Belém: só Belém
//    (rk_papel, configurado em `/ranking/admin` do hub);
//  - super admin: tudo, as duas filiais, o padrão das TVs e a aba "Acessos", onde
//    define quem é super admin, supervisor ou vendedor de cada filial.
//
// Antes, qualquer admin do `acesso` (a lista do Pulse) que não estivesse em
// rk_papel via as duas filiais e configurava as duas. Agora isso é só do super
// admin; o admin do `acesso` que tem filial em rk_papel configura a filial dele,
// e o que não tem filial nenhuma fica como consultor até ganhar uma no hub.
//
// Calculado no SSO e conferido de novo a cada abertura da tela (app/controle):
// quem ganhou ou trocou de filial no hub passa a valer na hora, sem esperar as
// 8 h do cookie vencerem.
// ---------------------------------------------------------------------------

/**
 * SUPER ADMINS: a lista mora em bi_config `ranking_super_admins` (JSON com os e-mails) e é editada
 * pela aba "Acessos" do próprio Ranking. O Romulo é fixo — nunca sai, para ninguém trancar a tela.
 */
export const CHAVE_SUPER_ADMINS = "ranking_super_admins";
export const SUPER_ADMIN_FIXO = "romuloalbuquerque@muranoprofessional.com.br";

export function lerListaSuperAdmins(valor: unknown): string[] {
  let arr: unknown = [];
  try { arr = typeof valor === "string" ? JSON.parse(valor) : valor; } catch { arr = []; }
  const lista = Array.isArray(arr) ? arr.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).filter(Boolean) : [];
  return [...new Set([SUPER_ADMIN_FIXO, ...lista])].sort();
}

export type Acesso = Omit<Sessao, "exp">;
export type ResultadoAcesso = { ok: true; acesso: Acesso } | { ok: false; msg: string; status: number };

export async function calcularAcesso(emailBruto: string): Promise<ResultadoAcesso> {
  const email = emailBruto.trim().toLowerCase();
  const sbUrl = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !chave) return { ok: false, msg: "Configuração ausente: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.", status: 500 };
  const sb = createClient(sbUrl, chave, { auth: { persistSession: false } });
  const [{ data: ac, error }, { data: rk, error: erroRk }, { data: us }, { data: cfg, error: erroCfg }] = await Promise.all([
    sb.from("acesso").select("papel,papeis,carteira,ativo").eq("email", email).maybeSingle(),
    // a filial que o admin do hub deu a esta pessoa (`/ranking/admin` lá, tabela rk_papel)
    sb.from("rk_papel").select("papel,nome,ativo").eq("email", email).maybeSingle(),
    sb.from("app_usuarios").select("nome").eq("email", email).maybeSingle(),
    sb.from("bi_config").select("valor").eq("chave", CHAVE_SUPER_ADMINS).maybeSingle(),
  ]);
  // Sem conseguir ler o recorte, NÃO entra: entrar sem ele mostraria as duas filiais a quem só pode ver uma.
  if (error || erroRk || erroCfg) return { ok: false, msg: "Não foi possível conferir o seu acesso agora. Tente de novo em instantes.", status: 500 };
  if (ac?.ativo === false) return { ok: false, msg: "Seu acesso ao Ranking está desativado. Fale com um administrador.", status: 403 };

  const papeis: string[] = Array.isArray(ac?.papeis) ? ac!.papeis : [];
  const adminAcesso = ac?.papel === "admin" || papeis.includes("admin");
  const superAdmin = lerListaSuperAdmins(cfg?.valor).includes(email);
  // rk_papel com ativo=false é "Sem acesso" dado pela aba Acessos: não ganha papel automático
  const bloqueado = rk?.ativo === false;
  let papelRk = bloqueado ? null : lerPapelRanking(rk?.papel);
  const nome = rk?.nome || us?.nome || email.split("@")[0];

  // Vendedor (do rk_papel, ou sem papel nenhum): procura no ERP quem ele é. Sem papel e vendendo em
  // UMA filial, vira vendedor dela sozinho (pedido do dono, 03/11/2026) — a aba Acessos muda ou bloqueia.
  let doErp: { nome: string } | null = null;
  if (!superAdmin && !bloqueado && (!papelRk || !papelRk.supervisor)) {
    const achado = casarNoErp(nome, await vendedoresErp(papelRk ? [papelRk.grupo as "belem" | "maranhao"] : undefined));
    if (achado) {
      doErp = achado;
      if (!papelRk) papelRk = { supervisor: false, grupo: achado.grupo };
    }
  }

  // De quem é a "Minha foto": a carteira do `acesso`; senão o vendedor do ERP pelo nome completo (a
  // chave da foto desde 15/10/2026, dois "Luis" não dividem foto); senão o 1º nome, como era.
  const carteira = typeof ac?.carteira === "string" && ac.carteira
    ? ac.carteira
    : papelRk && !papelRk.supervisor
      ? (doErp ? slugCompleto(doErp.nome) : slugDe(nome)) || null
      : null;

  if (superAdmin) return { ok: true, acesso: { email, admin: true, carteira, filiais: null, supervisor: false } };

  // Todo o resto vê só a filial que tem em rk_papel. Sem filial: [] (nenhuma) — nunca as duas.
  const filiais = filiaisDoPapel(papelRk) ?? [];
  return {
    ok: true,
    acesso: {
      email,
      // admin do `acesso` só conta com filial definida: configura a dele, como o supervisor
      admin: adminAcesso && papelRk !== null,
      carteira,
      filiais,
      supervisor: papelRk?.supervisor === true,
    },
  };
}

/** A sessão gravada ainda bate com o que o banco diz hoje? */
export function mesmoAcesso(a: Acesso, b: Acesso): boolean {
  const f = (x: number[] | null) => (x === null ? "*" : [...x].sort().join(","));
  // a carteira fica de fora: depende do ERP responder, e não muda o que a pessoa VÊ
  return a.admin === b.admin && a.supervisor === b.supervisor && f(a.filiais) === f(b.filiais);
}
