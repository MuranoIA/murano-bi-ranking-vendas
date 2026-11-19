// Puro (vale na tela e no servidor): a MÚSICA PRÓPRIA do consultor no ranking (19/11/2026).
//
// Cada consultor escolhe a música que toca nas TVs quando ELE vende, na aba "Minha foto" — do mesmo
// jeito que troca a própria foto. Sem música própria, toca a música da filial (aba Música, do admin).
// Fica em bi_config, uma chave por consultor: `musica_vendedor:<slug>` (o mesmo slug da foto), sem
// tabela nova. Duas origens:
//   - arquivo: MP3/MP4 cortado no navegador (lib/musicaParabens.ts) e guardado no bucket ranking-musica;
//   - youtube: só o id do vídeo e o trecho. O painel das TVs toca com o player do YouTube escondido
//     (o vídeo não aparece, só o som sai).
// Vale só na comemoração de VENDA nova; a de meta batida segue com a música da filial.

export const CHAVE_MUSICA_VENDEDOR = "musica_vendedor:";

/** A tela de parabéns fica 30 s na TV (public/index.html, enfileirarFesta): mais que isso não toca. */
export const SEG_MAX_VENDEDOR = 30;
export const SEG_PADRAO_VENDEDOR = 20;

export type MusicaVendedor = {
  tipo: "arquivo" | "youtube";
  nome: string;
  /** trecho escolhido na música original, em segundos */
  inicio: number;
  fim: number;
  /** quanto toca (fim - inicio, até SEG_MAX_VENDEDOR) */
  segundos: number;
  /** arquivo: URL pública e caminho no bucket; `cortado` = o trecho já foi recortado (toca do 0) */
  url?: string;
  path?: string;
  cortado?: boolean;
  /** youtube: o id do vídeo (11 caracteres) */
  video?: string;
  atualizado_em: string;
};

const ID_YT = /^[A-Za-z0-9_-]{11}$/;

/** Tira o id do vídeo de um link do YouTube (watch, youtu.be, shorts, embed, music). null = não é. */
export function idDoYoutube(link: string): string | null {
  const t = String(link ?? "").trim();
  if (ID_YT.test(t)) return t;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v");
    if (!id) {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = m ? m[1] : null;
    }
  }
  return id && ID_YT.test(id) ? id : null;
}

/** O `t=` do link do YouTube (ex.: t=75 ou t=1m15s), em segundos; 0 sem ele. */
export function inicioDoLink(link: string): number {
  try {
    const t = new URL(/^https?:\/\//i.test(link.trim()) ? link.trim() : "https://" + link.trim()).searchParams.get("t") ?? "";
    if (/^\d+s?$/.test(t)) return parseInt(t, 10);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m ? (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) : 0;
  } catch { return 0; }
}

/** "80", "1:20", "1:20,5" ou "1:02:03" -> segundos. NaN quando não dá para ler. */
export function lerTempo(txt: string): number {
  const t = String(txt ?? "").trim().replace(",", ".");
  if (!t) return NaN;
  if (!/^\d+(?:\.\d+)?$|^\d+:\d{1,2}(?:\.\d+)?$|^\d+:\d{1,2}:\d{1,2}(?:\.\d+)?$/.test(t)) return NaN;
  return t.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

/** 75 -> "1:15" */
export function fmtTempo(s: number): string {
  const v = Math.max(0, Math.round(s));
  const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), r = v % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Confere o trecho; devolve a mensagem de erro ou null. */
export function erroDoTrecho(inicio: number, fim: number): string | null {
  if (!Number.isFinite(inicio) || inicio < 0) return "O início não está num formato válido (ex.: 1:15).";
  if (!Number.isFinite(fim)) return "O fim não está num formato válido (ex.: 1:35).";
  if (fim <= inicio) return "O fim precisa vir depois do início.";
  if (fim - inicio < 3) return "O trecho precisa ter pelo menos 3 segundos.";
  if (fim - inicio > SEG_MAX_VENDEDOR) return `O trecho pode ter no máximo ${SEG_MAX_VENDEDOR} segundos (é o tempo que a tela de parabéns fica na TV).`;
  return null;
}
