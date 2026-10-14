"use client";

import { useEffect, useState } from "react";
import { BOTAO_PRIMARIO, CARTAO, avisoDe } from "../../componentes/estilo";
import { FILIAIS_PADRAO } from "@/lib/rankingFiliais";
import { SeletorFiliais } from "./SeletorFiliais";

type Aviso = { ok: boolean; texto: string } | null;

// Quais filiais aparecem no ranking. Duas escolhas independentes:
//  - a SUA, usada na aba "Por dia" (cada supervisor marca a dele);
//  - o padrão das TVs, lido pelo painel público.
export function Filiais({ ativa }: { ativa: boolean }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [minha, setMinha] = useState<number[]>(FILIAIS_PADRAO);
  const [tv, setTv] = useState<number[]>(FILIAIS_PADRAO);
  const [carregou, setCarregou] = useState(false);
  const [salvando, setSalvando] = useState<"minha" | "tv" | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);
  useEffect(() => {
    if (!jaAbriu) return;
    fetch("/api/ranking/filiais")
      .then((r) => r.json())
      .then((j) => {
        if (j?.error) throw new Error(j.error);
        setMinha(j.minha); setTv(j.tv); setCarregou(true);
      })
      .catch((e) => setAviso({ ok: false, texto: "Não consegui ler as filiais: " + (e?.message ?? e) }));
  }, [jaAbriu]);

  async function salvar(escopo: "minha" | "tv", filiais: number[]) {
    setSalvando(escopo);
    setAviso(null);
    try {
      const r = await fetch("/api/ranking/filiais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escopo, filiais }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAviso({ ok: true, texto: escopo === "tv" ? "Padrão das TVs salvo." : "Sua escolha foi salva." });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Não foi possível salvar: " + (e?.message ?? e) });
    } finally {
      setSalvando(null);
    }
  }

  if (!jaAbriu) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Minhas filiais</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          O que aparece para você na aba “Por dia”. O supervisor de Belém marca só Belém; o do Maranhão, só Maranhão.
        </p>
        <div className="mt-4"><SeletorFiliais valor={minha} aoMudar={setMinha} desabilitado={!carregou} /></div>
        <button onClick={() => salvar("minha", minha)} disabled={!carregou || salvando !== null} data-ripple className={BOTAO_PRIMARIO + " mt-4"}>
          {salvando === "minha" ? "Salvando…" : "Salvar minha escolha"}
        </button>
      </section>
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Painel das TVs</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          As filiais que o painel público mostra por padrão. Vale para todas as TVs ligadas a este endereço.
        </p>
        <div className="mt-4"><SeletorFiliais valor={tv} aoMudar={setTv} desabilitado={!carregou} /></div>
        <button onClick={() => salvar("tv", tv)} disabled={!carregou || salvando !== null} data-ripple className={BOTAO_PRIMARIO + " mt-4"}>
          {salvando === "tv" ? "Salvando…" : "Salvar padrão das TVs"}
        </button>
      </section>
      {aviso && <p role="status" className={avisoDe(aviso.ok) + " lg:col-span-2"}>{aviso.texto}</p>}
    </div>
  );
}
