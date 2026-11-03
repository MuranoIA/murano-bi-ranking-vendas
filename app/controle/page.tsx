import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ehSuperAdminSessao, lerSessao, podeVerDia } from "@/lib/sessao";
import { calcularAcesso, mesmoAcesso } from "@/lib/acessoRanking";
import { entradaPeloHub } from "@/lib/hub";
import { COOKIE_TEMA_CHAT, temaChatDe } from "@/lib/temaChat";
import { Ranking } from "./Ranking";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// A TELA DE CONTROLE DO RANKING. Veio do Pulse (`/ranking` do murano-crm,
// demanda #108 de lá) quando o Ranking virou sistema próprio: abre em iframe
// no hub, no Pulse e no VendasPro, e o login é sempre o do hub.
//
// Sem sessão, a tela não pede senha: manda o quadro para `/ranking/sso` do hub,
// que confere quem está logado lá e volta para cá com um passe assinado. Quem
// não tem sessão no hub vê a mensagem do hub pedindo para entrar.
// ---------------------------------------------------------------------------
//
// A cada abertura o acesso é conferido de novo no banco (lib/acessoRanking.ts): se a filial ou o
// papel mudou no hub desde o login, passa de novo pelo SSO e o cookie sai com o recorte de hoje.
export default async function PaginaControle() {
  const sessao = lerSessao();
  if (!sessao) redirect(entradaPeloHub("/controle"));
  const agora = await calcularAcesso(sessao.email);
  if (!agora.ok || !mesmoAcesso(sessao, agora.acesso)) redirect(entradaPeloHub("/controle"));
  const tema = temaChatDe(cookies().get(COOKIE_TEMA_CHAT)?.value);
  return <Ranking admin={sessao.admin} porDia={podeVerDia(sessao)} superAdmin={ehSuperAdminSessao(sessao)} filiais={sessao.filiais} tema={tema} />;
}
