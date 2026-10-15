"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CARTAO, avisoDe } from "../../componentes/estilo";
import { comGrupo, type Grupo } from "@/lib/grupo";
import { slugCompleto } from "@/lib/slug";

type Sess = { slug: string | null; url: string | null };

// A foto do consultor ao lado do nome no ranking. De QUEM é a foto o servidor
// decide pela sessão (rota /api/foto) — aqui ninguém escolhe
// a foto de outra pessoa. Substitui a página solta /utilitarios/foto-ranking.
// `grupo`: quem configura (admin ou supervisor) escolhe entre os consultores dessa filial; null = só a própria.
export function Foto({ grupo = null }: { grupo?: Grupo | null }) {
  const admin = grupo !== null;
  const [sess, setSess] = useState<Sess | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // admin: escolhe de qual consultor é a foto ("" = a própria, se tiver carteira)
  const [roster, setRoster] = useState<{ slug: string; nome: string }[]>([]);
  const [alvo, setAlvo] = useState("");

  useEffect(() => {
    setAlvo("");
    if (!admin) return;
    // a mesma lista da aba Consultores: nome completo do ERP e RCA, de quem vendeu na filial
    fetch(comGrupo("/api/ranking/consultores", grupo), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { consultores: [] }))
      .then((j) => setRoster((j.consultores ?? []).map((c: any) => ({
        slug: slugCompleto(c.nome),
        nome: c.nome + (c.rca != null ? ` · RCA ${c.rca}` : "") + (c.aparece === false ? " (escondido no ranking)" : ""),
      }))))
      .catch(() => setRoster([]));
  }, [admin, grupo]);

  useEffect(() => {
    setFile(null);
    setMsg(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    fetch(comGrupo("/api/foto" + (alvo ? `?slug=${encodeURIComponent(alvo)}` : ""), grupo), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { slug: null, url: null }))
      .then((j) => setSess({ slug: j.slug ?? null, url: j.url ?? null }))
      .catch(() => setSess({ slug: null, url: null }));
  }, [alvo]);

  const escolher = useCallback((f: File | null | undefined) => {
    setMsg(null);
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setMsg({ ok: false, texto: "Formato inválido. Use JPG, PNG ou WEBP." });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setMsg({ ok: false, texto: "Imagem muito grande (máx. 5 MB)." });
      return;
    }
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }, []);

  // colar (Ctrl+V) uma imagem da área de transferência
  useEffect(() => {
    if (!sess?.slug) return;
    const colar = (e: ClipboardEvent) => {
      for (const it of e.clipboardData?.items ?? []) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            escolher(f);
            e.preventDefault();
          }
          return;
        }
      }
    };
    window.addEventListener("paste", colar);
    return () => window.removeEventListener("paste", colar);
  }, [sess?.slug, escolher]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function subir() {
    if (!file) return;
    setEnviando(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      if (alvo) fd.append("slug", alvo);
      const r = await fetch(comGrupo("/api/foto", grupo), { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, texto: j?.error ?? `Erro ${r.status}` });
        return;
      }
      setSess((s) => (s ? { ...s, url: j.url } : s));
      setFile(null);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      setMsg({ ok: true, texto: "Foto atualizada! Ela já aparece no ranking (a TV atualiza em segundos)." });
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message ?? String(e) });
    } finally {
      setEnviando(false);
    }
  }

  // tira a foto: o ranking volta a mostrar as iniciais
  async function tirar() {
    if (!sess?.url || !confirm("Tirar a foto do ranking?")) return;
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch(comGrupo("/api/foto" + (alvo ? `?slug=${encodeURIComponent(alvo)}` : ""), grupo), { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Erro ${r.status}`);
      setSess((s) => (s ? { ...s, url: null } : s));
      setMsg({ ok: true, texto: "Foto tirada. A TV volta a mostrar as iniciais em segundos." });
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message ?? String(e) });
    } finally {
      setEnviando(false);
    }
  }

  const mostra = preview ?? sess?.url ?? null;


  const seletor = admin && (
    <label className="mb-4 block text-[13px] font-semibold">
      Consultor
      <select
        value={alvo}
        onChange={(e) => setAlvo(e.target.value)}
        className="mt-1 block h-10 w-full max-w-xs rounded-lg bg-v2-superficie px-3 text-[13.5px] font-normal ring-1 ring-inset ring-v2-linha-forte"
      >
        <option value="">Eu mesmo</option>
        {roster.map((c) => (
          <option key={c.slug} value={c.slug}>{c.nome}</option>
        ))}
      </select>
    </label>
  );

  if (!sess) return <section className={CARTAO + " text-[13px] text-v2-tinta-fraca"}>Carregando…</section>;
  if (!sess.slug) {
    return (
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">{admin ? "Foto no ranking" : "Minha foto"}</h2>
        <div className="mt-3">{seletor}</div>
        <p className="mt-2 text-[13.5px] leading-5 text-v2-tinta-fraca">
          {admin
            ? "Escolha acima o consultor da filial para colocar, trocar ou tirar a foto dele."
            : "A foto vai ao lado do nome de quem vende. Peça ao administrador do hub para marcar você como vendedor no Ranking (Configuração dos módulos → Ranking)."}
        </p>
      </section>
    );
  }

  return (
    <section className={CARTAO}>
      <h2 className="text-[18px] font-bold">{alvo ? "Foto do consultor no ranking" : "Minha foto no ranking"}</h2>
      <p className="mt-1 mb-4 text-[13.5px] leading-5 text-v2-tinta-fraca">
        Aparece ao lado do {alvo ? "nome do consultor" : "seu nome"} no painel das TVs. JPG, PNG ou WEBP, até 5 MB. Dá para arrastar a imagem, escolher
        um arquivo ou colar com Ctrl+V.
      </p>

      {seletor}
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-v2-superficie-2 ring-1 ring-v2-linha">
          {mostra ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mostra} alt="Foto no ranking" className="h-full w-full object-cover" />
          ) : (
            <span className="px-3 text-center text-[12.5px] text-v2-tinta-fraca">Sem foto ainda</span>
          )}
        </div>

        <div className="min-w-0 flex-1 self-stretch">
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); escolher(e.dataTransfer.files?.[0]); }}
            className={[
              "flex min-h-24 items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center text-[13.5px]",
              arrastando ? "border-v2-azul bg-v2-azul-claro" : "border-v2-linha-forte bg-v2-superficie-2",
            ].join(" ")}
          >
            {file ? (
              <span className="break-all font-semibold">{file.name}</span>
            ) : (
              <span className="text-v2-tinta-fraca">Solte a imagem aqui</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => inputRef.current?.click()} data-ripple className={BOTAO_CONTORNO}>
              Escolher arquivo
            </button>
            <button onClick={subir} disabled={!file || enviando} data-ripple className={BOTAO_PRIMARIO}>
              {enviando ? "Enviando…" : "Enviar foto"}
            </button>
            {sess.url && !file && (
              <button onClick={tirar} disabled={enviando} data-ripple className={BOTAO_CONTORNO + " text-v2-erro"}>
                Tirar foto
              </button>
            )}
          </div>
        </div>
      </div>
      {msg && <p role="status" className={avisoDe(msg.ok)}>{msg.texto}</p>}
    </section>
  );
}
