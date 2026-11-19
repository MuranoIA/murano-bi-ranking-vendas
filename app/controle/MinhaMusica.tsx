"use client";

import { useEffect, useRef, useState } from "react";
import { prepararTrecho } from "@/lib/musicaParabens";
import {
  SEG_MAX_VENDEDOR, SEG_PADRAO_VENDEDOR, erroDoTrecho, fmtTempo, idDoYoutube, inicioDoLink, lerTempo,
  type MusicaVendedor,
} from "@/lib/musicaVendedor";
import { comGrupo, type Grupo } from "@/lib/grupo";
import { slugCompleto } from "@/lib/slug";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CAMPO, CARTAO, CHIP, CHIP_DESLIGADO, CHIP_LIGADO, ROTULO, avisoDe } from "../../componentes/estilo";

type Aviso = { ok: boolean; texto: string } | null;
type Origem = "arquivo" | "youtube";

const MAX_ORIGEM = 40 * 1024 * 1024;

// A MÚSICA PRÓPRIA do consultor (lib/musicaVendedor.ts), ao lado da "Minha foto": toca nas TVs quando
// ELE vende; sem ela, toca a música da filial. Duas origens:
//  - arquivo MP3/MP4: o trecho é cortado aqui no navegador (lib/musicaParabens.ts, como na aba Música
//    do admin) e só ele sobe, direto ao Storage por URL assinada;
//  - link do YouTube: guardamos só o vídeo e o trecho; a TV toca com o player escondido (só o som).
// De quem é a música o servidor decide pela sessão (/api/minha-musica).
// `grupo`: quem configura (admin ou supervisor) escolhe o consultor da filial, como na foto; null = só a própria.
export function MinhaMusica({ grupo = null }: { grupo?: Grupo | null }) {
  const admin = grupo !== null;
  const [roster, setRoster] = useState<{ slug: string; nome: string }[]>([]);
  const [alvo, setAlvo] = useState(""); // "" = a própria
  // GET/DELETE levam o consultor na query; o POST leva no corpo. O grupo diz de qual filial o supervisor é.
  const rota = (comSlug: boolean) => comGrupo("/api/minha-musica" + (comSlug && alvo ? `?slug=${encodeURIComponent(alvo)}` : ""), grupo);
  const [slug, setSlug] = useState<string | null | undefined>(undefined);
  const [musica, setMusica] = useState<MusicaVendedor | null>(null);
  const [origem, setOrigem] = useState<Origem>("arquivo");
  const [inicio, setInicio] = useState("0:00");
  const [fim, setFim] = useState(fmtTempo(SEG_PADRAO_VENDEDOR));
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null); // URL local do arquivo escolhido
  const [ouvindoYt, setOuvindoYt] = useState(false);
  const [enviando, setEnviando] = useState<"" | "preparando" | "enviando">("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setAlvo("");
    if (!admin) return;
    // a mesma lista da foto: nome completo do ERP e RCA, de quem vendeu na filial
    fetch(comGrupo("/api/ranking/consultores", grupo), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { consultores: [] }))
      .then((j) => setRoster((j.consultores ?? []).map((c: any) => ({
        slug: slugCompleto(c.nome),
        nome: c.nome + (c.rca != null ? ` · RCA ${c.rca}` : "") + (c.aparece === false ? " (escondido no ranking)" : ""),
      }))))
      .catch(() => setRoster([]));
  }, [admin, grupo]);
  useEffect(() => {
    setAviso(null);
    setMusica(null);
    fetch(rota(true), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { slug: null, musica: null }))
      .then((j) => { setSlug(j.slug ?? null); setMusica(j.musica ?? null); })
      .catch(() => setSlug(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const ini = lerTempo(inicio), fi = lerTempo(fim);
  const erroTrecho = erroDoTrecho(ini, fi);
  const video = idDoYoutube(link);

  function trocarLink(v: string) {
    setLink(v);
    setOuvindoYt(false);
    const t = inicioDoLink(v); // link copiado "a partir deste minuto" já traz o início
    if (t > 0) { setInicio(fmtTempo(t)); setFim(fmtTempo(t + SEG_PADRAO_VENDEDOR)); }
  }

  function escolherArquivo(f: File | null | undefined) {
    setAviso(null);
    if (!f) return;
    if (f.size > MAX_ORIGEM) { setAviso({ ok: false, texto: `Arquivo muito grande (${(f.size / 1048576).toFixed(1)} MB). Máximo 40 MB.` }); return; }
    setFile(f);
    setPrevia((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
  }

  // ouve o trecho do arquivo escolhido: do início ao fim marcados
  function ouvirArquivo() {
    const el = audioRef.current;
    if (!el || erroTrecho) return;
    el.currentTime = ini;
    el.play().catch(() => {});
    const parar = () => { if (el.currentTime >= fi) { el.pause(); el.removeEventListener("timeupdate", parar); } };
    el.addEventListener("timeupdate", parar);
  }

  async function salvarArquivo() {
    if (!file || erroTrecho) return;
    setAviso(null);
    setEnviando("preparando");
    try {
      const trecho = await prepararTrecho(file, ini, fi - ini);
      if (!trecho && file.size > 20 * 1024 * 1024) {
        throw new Error("Não consegui extrair o áudio deste arquivo neste navegador, e ele é grande demais (máx. 20 MB) para subir inteiro. Converta para MP3 e tente de novo.");
      }
      const corpo: Blob = trecho ? trecho.blob : file;
      const mime = trecho ? "audio/wav" : file.type || "";
      setEnviando("enviando");
      const rAss = await fetch(rota(false), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "assinar", mime, slug: alvo || undefined }) });
      const jAss = await rAss.json().catch(() => ({}));
      if (!rAss.ok) throw new Error(jAss?.error ?? `Erro ${rAss.status}`);
      const rPut = await fetch(jAss.signedUrl, { method: "PUT", headers: { "content-type": mime || "application/octet-stream" }, body: corpo });
      if (!rPut.ok) throw new Error(`Falha ao enviar o arquivo (${rPut.status}). Tente de novo.`);
      const rConf = await fetch(rota(false), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "confirmar", slug: alvo || undefined, path: jAss.path, nome: file.name, cortado: !!trecho, inicio: ini, fim: fi }),
      });
      const j = await rConf.json().catch(() => ({}));
      if (!rConf.ok) throw new Error(j?.error ?? `Erro ${rConf.status}`);
      setMusica(j.musica);
      setFile(null);
      setPrevia((old) => { if (old) URL.revokeObjectURL(old); return null; });
      setAviso({ ok: true, texto: `🎵 Pronto — ${fmtTempo(fi - ini)} de “${file.name}”${trecho?.temVideo ? " (só o áudio; o vídeo foi descartado)" : ""}. Toca na sua próxima venda.` });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Falha: " + (e?.message ?? e) });
    } finally {
      setEnviando("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function salvarYoutube() {
    if (!video || erroTrecho) return;
    setAviso(null);
    setEnviando("enviando");
    try {
      const r = await fetch(rota(false), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "youtube", slug: alvo || undefined, link, inicio: ini, fim: fi }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Erro ${r.status}`);
      setMusica(j.musica);
      setOuvindoYt(false);
      setAviso({ ok: true, texto: `🎵 Pronto — de ${fmtTempo(ini)} a ${fmtTempo(fi)} do vídeo. Na TV só o som toca, o vídeo fica escondido. Vale na sua próxima venda.` });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Falha: " + (e?.message ?? e) });
    } finally {
      setEnviando("");
    }
  }

  async function remover() {
    if (!confirm("Tirar a sua música? Na sua venda volta a tocar a música da filial.")) return;
    setEnviando("enviando");
    setAviso(null);
    try {
      const r = await fetch(rota(true), { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Erro ${r.status}`);
      setMusica(null);
      setAviso({ ok: true, texto: "Música tirada. Na sua venda toca a música da filial." });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Falha: " + (e?.message ?? e) });
    } finally {
      setEnviando("");
    }
  }

  if (slug === undefined) return <section className={CARTAO + " text-[13px] text-v2-tinta-fraca"}>Carregando…</section>;
  const seletor = admin && (
    <label className="mt-3 block text-[13px] font-semibold">
      Consultor
      <select value={alvo} onChange={(e) => setAlvo(e.target.value)}
        className="mt-1 block h-10 w-full max-w-xs rounded-lg bg-v2-superficie px-3 text-[13.5px] font-normal ring-1 ring-inset ring-v2-linha-forte">
        <option value="">Eu mesmo</option>
        {roster.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
      </select>
    </label>
  );

  if (!slug && !admin) return null; // sem carteira de vendedor: a "Minha foto" já explica o que fazer
  if (!slug) {
    return (
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Música do consultor</h2>
        {seletor}
        <p className="mt-2 text-[13.5px] leading-5 text-v2-tinta-fraca">Escolha acima o consultor da filial para colocar, trocar ou tirar a música dele.</p>
      </section>
    );
  }

  return (
    <section className={CARTAO}>
      <h2 className="text-[18px] font-bold">{alvo ? "Música do consultor" : "Minha música"}</h2>
      {seletor}
      <p className="mt-1 max-w-2xl text-[13.5px] leading-5 text-v2-tinta-fraca">
        Toca nas TVs quando <b>{alvo ? "esse consultor" : "você"}</b> faz uma venda. Sem música própria, toca a música da filial. Envie um MP3 ou MP4 ou cole um link do
        YouTube (do vídeo só sai o som), e marque o trecho: até <b>{SEG_MAX_VENDEDOR} segundos</b>.
      </p>

      {musica ? (
        <div className="mt-4 rounded-xl p-3 ring-1 ring-v2-linha">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-v2-tinta-fraca">
            Sua música · {musica.tipo === "youtube" ? "YouTube" : "arquivo"} · de {fmtTempo(musica.inicio)} a {fmtTempo(musica.fim)}
          </div>
          <div className="mt-1 break-words text-[14px] font-bold">{musica.nome}</div>
          {musica.tipo === "arquivo" && musica.url && <audio controls preload="none" src={musica.url} className="mt-2 w-full" />}
          {musica.tipo === "youtube" && musica.video && (
            <a className="mt-1 inline-block text-[13px] font-semibold text-v2-azul underline" target="_blank" rel="noreferrer"
              href={`https://www.youtube.com/watch?v=${musica.video}&t=${Math.floor(musica.inicio)}s`}>
              Abrir no YouTube
            </a>
          )}
          <div className="mt-3">
            <button onClick={remover} disabled={!!enviando} data-ripple className={BOTAO_CONTORNO + " text-v2-erro"}>
              Tirar minha música
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-v2-linha-forte p-3 text-[13px] text-v2-tinta-fraca">
          Você ainda não escolheu — na sua venda toca a música da filial.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="De onde vem a música">
        {([["arquivo", "Arquivo MP3 ou MP4"], ["youtube", "Link do YouTube"]] as [Origem, string][]).map(([k, rot]) => (
          <button key={k} type="button" aria-pressed={origem === k} data-ripple onClick={() => { setOrigem(k); setAviso(null); }}
            className={[CHIP, origem === k ? CHIP_LIGADO : CHIP_DESLIGADO].join(" ")}>
            {rot}
          </button>
        ))}
      </div>

      {origem === "youtube" ? (
        <div className="mt-4">
          <label className={ROTULO} htmlFor="mm-link">Link do vídeo</label>
          <input id="mm-link" value={link} onChange={(e) => trocarLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={CAMPO + " w-full max-w-xl"} />
          {link && !video && <p className="mt-1 text-[12px] text-v2-erro">Não reconheci esse link do YouTube.</p>}
        </div>
      ) : (
        <div className="mt-4">
          <input ref={inputRef} type="file" hidden accept="audio/*,video/mp4,video/webm,video/quicktime,.mp3,.m4a,.wav,.ogg,.mp4"
            onChange={(e) => escolherArquivo(e.target.files?.[0])} />
          <button onClick={() => inputRef.current?.click()} disabled={!!enviando} data-ripple className={BOTAO_CONTORNO}>
            {file ? "Trocar arquivo" : "Escolher MP3 ou MP4"}
          </button>
          {file && <span className="ml-2 break-all text-[13px] font-semibold">{file.name}</span>}
          {previa && <audio ref={audioRef} src={previa} controls className="mt-2 w-full" />}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4">
        <div>
          <label className={ROTULO} htmlFor="mm-inicio">Começa em (min:seg)</label>
          <input id="mm-inicio" value={inicio} onChange={(e) => { setInicio(e.target.value); setOuvindoYt(false); }} placeholder="0:00" className={CAMPO + " max-w-32 tabular-nums"} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="mm-fim">Termina em (min:seg)</label>
          <input id="mm-fim" value={fim} onChange={(e) => { setFim(e.target.value); setOuvindoYt(false); }} placeholder="0:20" className={CAMPO + " max-w-32 tabular-nums"} />
        </div>
      </div>
      <p className={"mt-1 text-[12px] " + (erroTrecho ? "text-v2-erro" : "text-v2-tinta-fraca")}>
        {erroTrecho ?? `Toca ${fmtTempo(fi - ini)} — pule a introdução e pegue o refrão.`}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {origem === "youtube" ? (
          <>
            <button onClick={() => setOuvindoYt(true)} disabled={!video || !!erroTrecho} data-ripple className={BOTAO_CONTORNO}>Ouvir o trecho</button>
            <button onClick={salvarYoutube} disabled={!video || !!erroTrecho || !!enviando} data-ripple className={BOTAO_PRIMARIO}>
              {enviando ? "Salvando…" : "Usar esta música"}
            </button>
          </>
        ) : (
          <>
            <button onClick={ouvirArquivo} disabled={!file || !!erroTrecho} data-ripple className={BOTAO_CONTORNO}>Ouvir o trecho</button>
            <button onClick={salvarArquivo} disabled={!file || !!erroTrecho || !!enviando} data-ripple className={BOTAO_PRIMARIO}>
              {enviando === "preparando" ? "Cortando o trecho…" : enviando ? "Enviando…" : "Usar esta música"}
            </button>
          </>
        )}
      </div>

      {origem === "youtube" && ouvindoYt && video && !erroTrecho && (
        // aqui o vídeo aparece só para conferir o trecho; nas TVs o player fica escondido
        <iframe
          title="Trecho do YouTube"
          className="mt-3 aspect-video w-full max-w-md rounded-lg"
          src={`https://www.youtube.com/embed/${video}?autoplay=1&start=${Math.floor(ini)}&end=${Math.ceil(fi)}&rel=0`}
          allow="autoplay; encrypted-media"
        />
      )}
      {aviso && <p role="status" className={avisoDe(aviso.ok)}>{aviso.texto}</p>}
    </section>
  );
}
