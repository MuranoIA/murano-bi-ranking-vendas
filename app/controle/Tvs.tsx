"use client";

import { useState } from "react";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";

type Aviso = { ok: boolean; texto: string } | null;

// Comandos que vão para TODAS as TVs: o painel grava o pedido e as TVs pegam
// pelo poll (~6 s).
export function Tvs() {
  const [desfile, setDesfile] = useState(false);
  const [avisoDesfile, setAvisoDesfile] = useState<Aviso>(null);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [avisoParabens, setAvisoParabens] = useState<Aviso>(null);

  // passa a tela de parabéns de cada venda de hoje em todas as TVs
  async function rodarDesfile() {
    setDesfile(true);
    setAvisoDesfile(null);
    try {
      const r = await fetch("/api/ranking/desfile", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAvisoDesfile({ ok: true, texto: "Desfile enviado às TVs." });
    } catch (e: any) {
      setAvisoDesfile({ ok: false, texto: "Não foi possível disparar o desfile: " + (e?.message ?? e) });
    } finally {
      setDesfile(false);
    }
  }

  // mostra a tela de parabéns da venda de hoje de uma cliente, pelo nome
  async function parabens() {
    const n = nome.trim();
    if (n.length < 2) {
      setAvisoParabens({ ok: false, texto: "Digite ao menos 2 letras do nome." });
      return;
    }
    setEnviando(true);
    setAvisoParabens(null);
    try {
      const r = await fetch("/api/ranking/parabens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: n }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Erro ${r.status}`);
      setAvisoParabens({
        ok: true,
        texto: `🎉 Parabéns de ${j.cliente} (venda de ${j.vendedor}, R$ ${Number(j.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) enviada às TVs.`,
      });
    } catch (e: any) {
      setAvisoParabens({ ok: false, texto: e?.message ?? String(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Rodar desfile</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Passa a tela de parabéns de cada venda de hoje, em sequência, em todas as TVs.
        </p>
        <button onClick={rodarDesfile} disabled={desfile} data-ripple className={BOTAO_PRIMARIO + " mt-4"}>
          {desfile ? "Enviando…" : "▶ Rodar nas TVs"}
        </button>
        {avisoDesfile && <p role="status" className={avisoDe(avisoDesfile.ok)}>{avisoDesfile.texto}</p>}
      </section>

      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Parabéns por cliente</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Digite o nome da cliente. Se houver venda hoje, a tela de parabéns dessa venda aparece nas TVs.
        </p>
        <label className={ROTULO + " mt-4"} htmlFor="rk-parabens">
          Nome da cliente
        </label>
        <input
          id="rk-parabens"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            if (avisoParabens) setAvisoParabens(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && !enviando && parabens()}
          placeholder="ex: Raquel Rodrigues"
          className={CAMPO}
        />
        <button onClick={parabens} disabled={enviando} data-ripple className={BOTAO_CONTORNO + " mt-3"}>
          {enviando ? "Buscando…" : "Mostrar parabéns"}
        </button>
        {avisoParabens && <p role="status" className={avisoDe(avisoParabens.ok)}>{avisoParabens.texto}</p>}
      </section>
    </div>
  );
}
