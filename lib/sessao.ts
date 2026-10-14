import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// A SESSÃO DO RANKING (demanda #1 do VendasPro no Café Code, 14/10/2026).
//
// Quem entra aqui é sempre alguém já logado no HUB (decisão do dono: "pode
// levar em consideração o login do hub"). O hub assina um passe curto com o
// e-mail (`/ranking/sso` lá), `/auth/hub-sso` daqui confere e grava este cookie.
//
// Diferente do `crm_sessao` do Pulse, o cookie é ASSINADO: o valor carrega
// e-mail, se é admin e a carteira, e um cookie forjado à mão ("admin") não passa
// pela verificação da assinatura.
//
// SameSite=None + Partitioned: o Ranking abre em iframe dentro do hub, do Pulse
// e do VendasPro. Partitioned (CHIPS) guarda o cookie na "caixa" do site de topo
// (o hub), que é o que o Safari e o Chrome sem cookie de terceiro aceitam.
// ---------------------------------------------------------------------------

export const COOKIE_SESSAO = "rk_sessao";
export const DURACAO_SESSAO_S = 60 * 60 * 8; // 8h, igual ao Pulse

export type Sessao = {
  email: string;
  /** papel admin no `acesso` (a mesma lista do Pulse): Por dia, Filiais, Metas, TVs e Música */
  admin: boolean;
  /** slug do vendedor (`acesso.carteira`): de quem é a "Minha foto" */
  carteira: string | null;
  exp: number;
};

function segredo(): string {
  const s = process.env.RANKING_SESSAO_SECRET || process.env.RANKING_HUB_SSO_SECRET;
  if (!s) throw new Error("RANKING_SESSAO_SECRET ausente");
  return s;
}

function assinar(payloadB64: string, chave: string): string {
  return createHmac("sha256", chave).update(payloadB64).digest("hex");
}

/** Confere `payload.assinatura` com a chave dada; devolve o JSON ou null. */
export function verificarAssinado(token: string | null | undefined, chave: string): Record<string, unknown> | null {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(assinar(payloadB64, chave));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (typeof p?.exp !== "number" || Date.now() / 1000 > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export function valorDoCookie(s: Omit<Sessao, "exp">): string {
  const payload: Sessao = { ...s, exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO_S };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64}.${assinar(b64, segredo())}`;
}

export const opcoesDoCookie = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  partitioned: true,
  path: "/",
  maxAge: DURACAO_SESSAO_S,
};

/** A sessão de quem chamou, ou null (sem cookie, assinatura inválida ou vencida). */
export function lerSessao(): Sessao | null {
  let chave: string;
  try { chave = segredo(); } catch { return null; }
  const p = verificarAssinado(cookies().get(COOKIE_SESSAO)?.value, chave);
  if (!p || typeof p.email !== "string") return null;
  return {
    email: p.email,
    admin: p.admin === true,
    carteira: typeof p.carteira === "string" && p.carteira ? p.carteira : null,
    exp: p.exp as number,
  };
}

export const podeAdmin = (s: Sessao | null): boolean => s?.admin === true;
