// O hub (murano-app) é a porta de entrada do Ranking: o login é o dele.
export const HUB_URL = (process.env.HUB_URL || "https://app.muranoprofessional.com.br").replace(/\/$/, "");

/** Caminho interno seguro do Ranking para voltar depois do login (nunca outro site). */
export function telaSegura(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = valor.trim();
  if (d.length > 300 || !d.startsWith("/") || d.startsWith("//") || d.includes("\\")) return null;
  if (/[\r\n\t]/.test(d)) return null;
  if (/^\/(auth|api)(\/|$|\?)/.test(d)) return null;
  return d;
}

/** Endereço do hub que assina a entrada e devolve o quadro para `volta`. */
export const entradaPeloHub = (volta: string) =>
  `${HUB_URL}/ranking/sso?volta=${encodeURIComponent(telaSegura(volta) ?? "/controle")}`;
