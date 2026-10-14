import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/sessao";
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
export default function PaginaControle() {
  const sessao = lerSessao();
  if (!sessao) redirect(entradaPeloHub("/controle"));
  const tema = temaChatDe(cookies().get(COOKIE_TEMA_CHAT)?.value);
  return <Ranking admin={sessao.admin} tema={tema} />;
}
