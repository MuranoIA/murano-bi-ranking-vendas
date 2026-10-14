// Endereço do painel das TVs. Desde que o Ranking virou sistema próprio
// (ranking.muranoprofessional.com.br), o painel e esta tela de controle moram
// na MESMA origem: o painel é a raiz `/` (public/index.html).
export const RANKING_URL = "/";

/** dia = 'AAAA-MM-DD' abre o estado de fim de dia daquela data; sem dia = ao vivo */
export const rankingHref = (dia?: string) => RANKING_URL + (dia ? "?dia=" + encodeURIComponent(dia) : "");
