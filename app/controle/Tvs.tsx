"use client";

import { useEffect, useMemo, useState } from "react";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";
import { comGrupo, rotuloDoGrupo, type Grupo } from "@/lib/grupo";

type Aviso = { ok: boolean; texto: string } | null;
type Venda = { pedido: number; cliente: string; vendedor: string; valor: number };

// cada venda fica 3 s na tela (DESFILE_MS do painel); a TV leva até ~6 s para ver o comando e mais a busca
const MS_POR_VENDA = 3000;
const FOLGA_MS = 10000;

const brl = (n: number) => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Comandos para as TVs da filial: a tela grava o pedido e os painéis daquela filial pegam pelo poll (~6 s).
export function Tvs({ ativa, grupo }: { ativa: boolean; grupo: Grupo }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [desfile, setDesfile] = useState(false);
  const [avisoDesfile, setAvisoDesfile] = useState<Aviso>(null);
  const [vendas, setVendas] = useState<Venda[] | null>(null);
  const [escolhida, setEscolhida] = useState("");
  const [vendedor, setVendedor] = useState("");
  // até quando o desfile deve estar rodando nas TVs (estimativa; null = parado)
  const [rodandoAte, setRodandoAte] = useState<number | null>(null);
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
  useEffect(() => { if (jaAbriu) { setEscolhida(""); setVendedor(""); setRodandoAte(null); carregarVendas(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [jaAbriu, grupo]);

  const duracao = (n: number) => n * MS_POR_VENDA + FOLGA_MS;

  // ao abrir: se um desfile começou há pouco e ninguém pausou, o botão já nasce como "Pausar"
  useEffect(() => {
    if (!jaAbriu || vendas === null) return;
    fetch(comGrupo("/api/ranking/desfile", grupo), { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.inicio || (j.parado && j.parado >= j.inicio)) return;
        const fim = j.inicio + duracao(vendas.length);
        if (fim > j.agora) setRodandoAte(Date.now() + (fim - j.agora));
      })
      .catch(() => {});
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [jaAbriu, grupo, vendas === null]);

  // quando o tempo estimado acaba, o botão volta a "Rodar"
  useEffect(() => {
    if (rodandoAte === null) return;
    const t = setTimeout(() => setRodandoAte(null), Math.max(0, rodandoAte - Date.now()));
    return () => clearTimeout(t);
  }, [rodandoAte]);

  async function comandoDesfile(parar: boolean) {
    setDesfile(true);
    setAvisoDesfile(null);
    try {
      const r = await fetch(comGrupo("/api/ranking/desfile", grupo), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: parar ? "parar" : "rodar" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      if (parar) {
        setRodandoAte(null);
        setAvisoDesfile({ ok: true, texto: `Desfile pausado: as TVs de ${rotuloDoGrupo(grupo)} voltam ao ranking em alguns segundos.` });
      } else {
        setRodandoAte(Date.now() + duracao(vendas?.length ?? 0));
        setAvisoDesfile({ ok: true, texto: `Desfile enviado às TVs de ${rotuloDoGrupo(grupo)}.` });
      }
    } catch (e: any) {
      setAvisoDesfile({ ok: false, texto: (parar ? "Não foi possível pausar o desfile: " : "Não foi possível disparar o desfile: ") + (e?.message ?? e) });
    } finally {
      setDesfile(false);
    }
  }

  // vendedores com venda hoje, e as clientes do vendedor escolhido
  const vendedores = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vendas ?? []) m.set(v.vendedor, (m.get(v.vendedor) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [vendas]);
  const clientes = useMemo(() => (vendas ?? []).filter((v) => !vendedor || v.vendedor === vendedor), [vendas, vendedor]);

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
        {rodandoAte === null ? (
          <button onClick={() => comandoDesfile(false)} disabled={desfile} data-ripple className={BOTAO_PRIMARIO + " mt-4"}>
            {desfile ? "Enviando…" : "▶ Rodar nas TVs"}
          </button>
        ) : (
          <button onClick={() => comandoDesfile(true)} disabled={desfile} data-ripple className={BOTAO_PRIMARIO + " mt-4"}>
            {desfile ? "Pausando…" : "❚❚ Pausar nas TVs"}
          </button>
        )}
        {avisoDesfile && <p role="status" className={avisoDe(avisoDesfile.ok)}>{avisoDesfile.texto}</p>}
      </section>

      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Parabéns por cliente</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Escolha uma das clientes que compraram hoje em {rotuloDoGrupo(grupo)}: a tela de parabéns dessa venda aparece nas TVs da filial.
        </p>
        <label className={ROTULO + " mt-4"} htmlFor="rk-parabens-vendedor">Vendedor</label>
        <select
          id="rk-parabens-vendedor"
          value={vendedor}
          onChange={(e) => { setVendedor(e.target.value); setEscolhida(""); if (avisoParabens) setAvisoParabens(null); }}
          disabled={!vendas || vendas.length === 0}
          className={CAMPO}
        >
          <option value="">Todos os vendedores</option>
          {vendedores.map(([nome, n]) => (
            <option key={nome} value={nome}>{nome} · {n} venda{n === 1 ? "" : "s"}</option>
          ))}
        </select>
        <label className={ROTULO + " mt-3"} htmlFor="rk-parabens">Cliente</label>
        <select
          id="rk-parabens"
          value={escolhida}
          onChange={(e) => { setEscolhida(e.target.value); if (avisoParabens) setAvisoParabens(null); }}
          disabled={!vendas || vendas.length === 0}
          className={CAMPO}
        >
          <option value="">{vendas === null ? "Carregando as vendas de hoje…" : vendas.length ? "Escolha a cliente" : "Nenhuma venda hoje ainda"}</option>
          {clientes.map((v) => (
            <option key={v.pedido} value={v.pedido}>{v.cliente}{vendedor ? "" : ` · ${v.vendedor}`} · {brl(v.valor)}</option>
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
