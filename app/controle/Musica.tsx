"use client";

import { useEffect, useRef, useState } from "react";
import { prepararTrecho, segundosFmt, SEGUNDOS_PARABENS } from "@/lib/musicaParabens";
import { BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";

type Aviso = { ok: boolean; texto: string } | null;
type MusicaAtual = {
  url: string;
  nome: string;
  segundos: number;
  cortado: boolean;
  origem?: string;
  atualizado_em: string;
};

const MAX_ORIGEM = 40 * 1024 * 1024;

// aceita "80", "1:20" ou "1:20,5" -> segundos
function inicioEmSegundos(txt: string) {
  const t = txt.trim().replace(",", ".");
  if (!t) return 0;
  const p = t.split(":").map((x) => Number(x) || 0);
  return Math.max(0, p.length > 1 ? p[0] * 60 + p[1] : p[0]);
}

// A música da tela de parabéns. O corte acontece AQUI no navegador
// (lib/musicaParabens.ts): de um .mp4 só o áudio é decodificado, e só o trecho
// sobe — direto para o Storage por URL assinada, porque passar por /api devolvia
// 413 acima de ~4,5 MB. O ponteiro só muda no fim: se o envio falhar, a música
// atual continua.
export function Musica({ ativa }: { ativa: boolean }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [musica, setMusica] = useState<MusicaAtual | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<"" | "preparando" | "enviando">("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [inicio, setInicio] = useState("0:00");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);
  useEffect(() => {
    if (!jaAbriu) return;
    fetch("/api/ranking/musica")
      .then((r) => r.json())
      .then((j) => setMusica(j?.musica ?? null))
      .catch(() => setMusica(null))
      .finally(() => setCarregando(false));
  }, [jaAbriu]);

  async function enviar(file: File) {
    if (file.size > MAX_ORIGEM) {
      setAviso({ ok: false, texto: `Arquivo muito grande (${(file.size / 1048576).toFixed(1)} MB). Máximo 40 MB.` });
      return;
    }
    setAviso(null);
    setEnviando("preparando");
    try {
      const trecho = await prepararTrecho(file, inicioEmSegundos(inicio));
      // sem trecho (codec que este navegador não decodifica) o original sobe
      // inteiro, e vale o teto do bucket (20 MB)
      if (!trecho && file.size > 20 * 1024 * 1024) {
        setAviso({
          ok: false,
          texto:
            "Não consegui extrair o áudio deste arquivo neste navegador, e ele é grande demais (máx. 20 MB) para subir inteiro. Converta para MP3 e tente de novo.",
        });
        return;
      }
      const corpo: Blob = trecho ? trecho.blob : file;
      const mime = trecho ? "audio/wav" : file.type || "";

      setEnviando("enviando");
      const rAss = await fetch("/api/ranking/musica", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "assinar", mime }),
      });
      const jAss = await rAss.json().catch(() => ({}));
      if (!rAss.ok) throw new Error(jAss?.error ?? `Erro ${rAss.status}`);

      const rPut = await fetch(jAss.signedUrl, {
        method: "PUT",
        headers: { "content-type": mime || "application/octet-stream" },
        body: corpo,
      });
      if (!rPut.ok) throw new Error(`Falha ao enviar o arquivo (${rPut.status}). Tente de novo.`);

      const rConf = await fetch("/api/ranking/musica", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "confirmar", path: jAss.path, nome: file.name, cortado: !!trecho, origem: file.type || "" }),
      });
      const j = await rConf.json().catch(() => ({}));
      if (!rConf.ok) throw new Error(j?.error ?? `Erro ${rConf.status}`);
      setMusica(j.musica);
      setAviso({
        ok: true,
        texto: trecho
          ? `🎵 Pronto — ${segundosFmt(trecho.segundos)} de “${file.name}”${trecho.temVideo ? " (só o áudio; o vídeo foi descartado)" : ""}. Já vale na próxima venda.`
          : `🎵 Enviado “${file.name}”. Não deu para cortar aqui, então o painel corta em ${SEGUNDOS_PARABENS}s na hora de tocar.`,
      });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Falha: " + (e?.message ?? e) });
    } finally {
      setEnviando("");
      if (inputRef.current) inputRef.current.value = ""; // permite reenviar o mesmo arquivo
    }
  }

  async function remover() {
    if (!confirm("Voltar ao som padrão (samba sintetizado) na tela de parabéns?")) return;
    setEnviando("enviando");
    setAviso(null);
    try {
      const r = await fetch("/api/ranking/musica", { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Erro ${r.status}`);
      setMusica(null);
      setAviso({ ok: true, texto: "Som padrão restaurado." });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Falha: " + (e?.message ?? e) });
    } finally {
      setEnviando("");
    }
  }

  return (
    <section className={CARTAO}>
      <h2 className="text-[18px] font-bold">Música dos parabéns</h2>
      <p className="mt-1 max-w-2xl text-[13.5px] leading-5 text-v2-tinta-fraca">
        Toca nas TVs quando entra uma venda nova. Envie um <b>MP3</b> ou um <b>MP4</b> — de vídeo só aproveitamos o
        áudio. Tocam <b>{SEGUNDOS_PARABENS} segundos</b>, com fade no fim.
      </p>

      {carregando ? (
        <p className="mt-4 text-[13px] text-v2-tinta-fraca">Carregando…</p>
      ) : musica ? (
        <div className="mt-4 rounded-xl p-3 ring-1 ring-v2-linha">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-v2-tinta-fraca">Tocando hoje</div>
          <div className="mt-1 break-words text-[14px] font-bold">{musica.nome}</div>
          <audio controls preload="none" src={musica.url} className="mt-2 w-full" />
          <div className="mt-2 text-[12px] text-v2-tinta-fraca">
            {musica.cortado
              ? `Trecho de ${musica.segundos}s já recortado.`
              : `Arquivo inteiro — o painel corta em ${musica.segundos}s ao tocar.`}
            {" · "}atualizada em{" "}
            {new Date(musica.atualizado_em).toLocaleString("pt-BR", { timeZone: "America/Belem" })}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-v2-linha-forte p-3 text-[13px] text-v2-tinta-fraca">
          Nenhuma música enviada — as TVs usam o som padrão (samba/pagode sintetizado).
        </p>
      )}

      <label className={ROTULO + " mt-4"} htmlFor="rk-inicio">
        Começar em (mm:ss)
      </label>
      <input
        id="rk-inicio"
        value={inicio}
        onChange={(e) => setInicio(e.target.value)}
        placeholder="0:00"
        className={CAMPO + " max-w-32 tabular-nums"}
      />
      <p className="mt-1 text-[12px] text-v2-tinta-fraca">Pule a introdução e pegue o refrão.</p>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept="audio/*,video/mp4,video/webm,video/quicktime,.mp3,.m4a,.wav,.ogg,.mp4"
        disabled={!!enviando}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) enviar(f);
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => inputRef.current?.click()} disabled={!!enviando} data-ripple className={BOTAO_PRIMARIO}>
          Escolher MP3 ou MP4
        </button>
        {musica && (
          <button
            onClick={remover}
            disabled={!!enviando}
            data-ripple
            title="Apaga a música e volta ao som sintetizado"
            className="flex h-10 items-center rounded-lg px-4 text-[13.5px] font-semibold text-v2-erro ring-1 ring-inset ring-v2-erro/35 hover:bg-v2-erro-claro disabled:opacity-50"
          >
            Voltar ao som padrão
          </button>
        )}
      </div>
      <p className="mt-2 text-[12px] text-v2-tinta-fraca">Até 40 MB. O corte acontece no seu navegador — só o trecho sobe.</p>
      {enviando && (
        <p className="mt-3 text-[13px] font-semibold text-v2-vinho-texto">
          {enviando === "preparando" ? "Extraindo o áudio e cortando o trecho…" : "Enviando para as TVs…"}
        </p>
      )}
      {aviso && <p role="status" className={avisoDe(aviso.ok)}>{aviso.texto}</p>}
    </section>
  );
}
