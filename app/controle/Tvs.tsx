"use client";

import { useEffect, useState } from "react";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";
import { comGrupo, rotuloDoGrupo, type Grupo } from "@/lib/grupo";

type Aviso = { ok: boolean; texto: string } | null;
type Venda = { pedido: number; cliente: string; vendedor: string; valor: number };

const brl = (n: number) => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Comandos para as TVs da filial: a tela grava o pedido e os painéis daquela filial pegam pelo poll (~6 s).
export function Tvs({ ativa, grupo }: { ativa: boolean; grupo: Grupo }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [desfile, setDesfile] = useState(false);
  const [avisoDesfile, setAvisoDesfile] = useState<Aviso>(null);
  const [vendas, setVendas] = useState<Venda[] | null>(null);
  const [escolhida, setEscolhida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [avisoParabens, setAvisoParabens] = useState<Aviso>(null);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);

  // as vendas de hoje da filial, para escolher de quem é o parabéns
  function carregarVendas() {
    setVendas(null);
    fetch(comGrupo("/api/ranking/parabens", grupo), { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j?.error) throw new Error(j.error); setVendas(j.vendas ?? []); })
      .catch((e) => { setVendas([]); setAvisoParabens({ ok: false, texto: e?.message ?? String(e) }); });
  }
  useEffect(() => { if (jaAbriu) { setEscolhida(""); carregarVendas(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [jaAbriu, grupo]);

  async function rodarDesfile() {
    setDesfile(true);
    setAvisoDesfile(null);
    try {
      const r = await fetch(comGrupo("/api/ranking/desfile", grupo), { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAvisoDesfile({ ok: true, texto: `Desfile enviado às TVs de ${rotuloDoGrupo(grupo)}.` });
    } catch (e: any) {
      setAvisoDesfile({ ok: false, texto: "Não foi possível disparar o desfile: " + (e?.message ?? e) });
    } finally {
      setDesfile(false);
    }
  }

  async function parabens() {
    if (!escolhida) { setAvisoParabens({ ok: false, texto: "Escolha a cliente na lista." }); return; }
    setEnviando(true);
    setAvisoParabens(null);
    try {
      const r = await fetch(comGrupo("/api/ranking/parabens", grupo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido: Number(escolhida) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Erro ${r.status}`);
      setAvisoParabens({ ok: true, texto: `🎉 Parabéns de ${j.cliente} (venda de ${j.vendedor}, ${brl(j.valor)}) enviada às TVs.` });
    } catch (e: any) {
      setAvisoParabens({ ok: false, texto: e?.message ?? String(e) });
    } finally {
      setEnviando(false);
    }
  }

  if (!jaAbriu) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Rodar desfile</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Passa a tela de parabéns de cada venda de hoje de <b>{rotuloDoGrupo(grupo)}</b>, em sequência, nas TVs dessa filial.
        </p>
        <button onClick={rodarDesfile} disabled={desfile} data-ripple className={BOTAO_PRIMARIO + " mt-4"}>
          {desfile ? "Enviando…" : "▶ Rodar nas TVs"}
        </button>
        {avisoDesfile && <p role="status" className={avisoDe(avisoDesfile.ok)}>{avisoDesfile.texto}</p>}
      </section>

      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Parabéns por cliente</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Escolha uma das clientes que compraram hoje em {rotuloDoGrupo(grupo)}: a tela de parabéns dessa venda aparece nas TVs da filial.
        </p>
        <label className={ROTULO + " mt-4"} htmlFor="rk-parabens">Cliente</label>
        <select
          id="rk-parabens"
          value={escolhida}
          onChange={(e) => { setEscolhida(e.target.value); if (avisoParabens) setAvisoParabens(null); }}
          disabled={!vendas || vendas.length === 0}
          className={CAMPO}
        >
          <option value="">{vendas === null ? "Carregando as vendas de hoje…" : vendas.length ? "Escolha a cliente" : "Nenhuma venda hoje ainda"}</option>
          {(vendas ?? []).map((v) => (
            <option key={v.pedido} value={v.pedido}>{v.cliente} · {v.vendedor} · {brl(v.valor)}</option>
          ))}
        </select>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={parabens} disabled={enviando || !escolhida} data-ripple className={BOTAO_PRIMARIO}>
            {enviando ? "Enviando…" : "Mostrar parabéns"}
          </button>
          <button onClick={carregarVendas} disabled={vendas === null} data-ripple className={BOTAO_CONTORNO}>Atualizar lista</button>
        </div>
        {avisoParabens && <p role="status" className={avisoDe(avisoParabens.ok)}>{avisoParabens.texto}</p>}
      </section>
    </div>
  );
}
