// Endereço do painel das TVs. Desde que o Ranking virou sistema próprio
// (ranking.muranoprofessional.com.br), o painel e esta tela de controle moram
// na MESMA origem: o painel é a raiz `/` (public/index.html).
export const RANKING_URL = "/";

/**
 * dia = 'AAAA-MM-DD' abre o estado de fim de dia daquela data; sem dia = ao vivo.
 * filiais = o recorte de quem abre (lib/escopo.ts): o painel mostra só aquelas; sem = padrão das TVs.
 */
export const rankingHref = (dia?: string, filiais?: number[] | null) => {
  const q = [dia ? "dia=" + encodeURIComponent(dia) : "", filiais?.length ? "filiais=" + filiais.join(",") : ""].filter(Boolean);
  return RANKING_URL + (q.length ? "?" + q.join("&") : "");
};
