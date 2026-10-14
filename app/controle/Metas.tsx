"use client";

import { useEffect, useState } from "react";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";

type Aviso = { ok: boolean; texto: string } | null;
type MetaVendedor = { slug: string; nome: string; meta: number };

const brl = (n: number) => "R$ " + n.toLocaleString("pt-BR");
const soDigitos = (t: string) => Math.max(0, Math.round(Number(t.replace(/[^\d]/g, "")) || 0));

// Meta do dia (a barra de progresso do painel) e metas individuais (a tela
// "BATEU A META"). Carregadas só quando a aba abre.
export function Metas({ ativa }: { ativa: boolean }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);
  if (!jaAbriu) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MetaDoDia />
      <MetasIndividuais />
    </div>
  );
}

function MetaDoDia() {
  const [atual, setAtual] = useState<number | null>(null);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((j) => {
        const m = Number(j?.meta ?? 0) || 0;
        setAtual(m);
        setValor(m ? String(m) : "");
      })
      .catch(() => setAviso({ ok: false, texto: "Não consegui ler a meta atual." }));
  }, []);

  // 0 = sem meta: o quadro da meta some do painel
  async function salvar(m: number) {
    setSalvando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta: m }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAtual(j.meta);
      setValor(j.meta ? String(j.meta) : "");
      setAviso({ ok: true, texto: j.meta ? `Meta do dia: ${brl(j.meta)}.` : "Sem meta: o quadro some do ranking." });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Não foi possível salvar a meta: " + (e?.message ?? e) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className={CARTAO}>
      <h2 className="text-[18px] font-bold">Meta do dia</h2>
      <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
        Aparece no ranking como barra de progresso. Vale para todos os dias até você mudar.
      </p>
      <p className="mt-3 text-[13px] text-v2-tinta-fraca">
        Atual:{" "}
        <b className="tabular-nums text-v2-tinta">
          {atual == null ? "carregando…" : atual ? brl(atual) : "sem meta (barra oculta)"}
        </b>
      </p>
      <label className={ROTULO + " mt-3"} htmlFor="rk-meta">
        Novo valor (R$)
      </label>
      <input
        id="rk-meta"
        inputMode="numeric"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !salvando && salvar(soDigitos(valor))}
        placeholder="ex: 50000"
        className={CAMPO + " tabular-nums"}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => salvar(soDigitos(valor))} disabled={salvando} data-ripple className={BOTAO_PRIMARIO}>
          {salvando ? "Salvando…" : "Salvar meta"}
        </button>
        <button
          onClick={() => salvar(0)}
          disabled={salvando}
          data-ripple
          title="Nenhuma meta — o quadro da meta some do ranking"
          className={BOTAO_CONTORNO}
        >
          Sem meta
        </button>
      </div>
      {aviso && <p role="status" className={avisoDe(aviso.ok)}>{aviso.texto}</p>}
    </section>
  );
}

function MetasIndividuais() {
  const [metas, setMetas] = useState<MetaVendedor[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    fetch("/api/ranking/metas-individuais")
      .then((r) => r.json())
      .then((j) => setMetas(Array.isArray(j?.metas) ? j.metas : []))
      .catch(() => {
        setMetas([]);
        setAviso({ ok: false, texto: "Não consegui ler os vendedores." });
      });
  }, []);

  async function salvar() {
    setSalvando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/ranking/metas-individuais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metas }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAviso({ ok: true, texto: "Metas salvas." });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Não foi possível salvar as metas: " + (e?.message ?? e) });
    } finally {
      setSalvando(false);
    }
  }

  // mostra a tela "BATEU A META" nas TVs com o valor digitado, mesmo sem salvar
  async function prever(m: MetaVendedor) {
    if (!m.meta) return;
    setAviso(null);
    try {
      const r = await fetch("/api/ranking/metabatida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: m.slug, nome: m.nome, meta: m.meta }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAviso({ ok: true, texto: `Tela de meta batida de ${m.nome} enviada às TVs.` });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Não foi possível exibir a tela: " + (e?.message ?? e) });
    }
  }

  return (
    <section className={CARTAO}>
      <h2 className="text-[18px] font-bold">Metas individuais</h2>
      <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
        Meta de vendas (R$) por vendedor. Ao atingir, a tela <b>BATEU A META</b> aparece nas TVs. Vazio ou 0 é sem
        meta.
      </p>
      <div className="mt-3 divide-y divide-v2-linha">
        {metas === null ? (
          <p className="py-3 text-[13px] text-v2-tinta-fraca">Carregando vendedores…</p>
        ) : metas.length === 0 ? (
          <p className="py-3 text-[13px] text-v2-tinta-fraca">Nenhum vendedor encontrado.</p>
        ) : (
          metas.map((m, i) => (
            <div key={m.slug} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{m.nome}</span>
              <span className="text-[12px] text-v2-tinta-fraca">R$</span>
              <input
                aria-label={`Meta de ${m.nome}`}
                inputMode="numeric"
                value={m.meta ? String(m.meta) : ""}
                onChange={(e) => {
                  const v = soDigitos(e.target.value);
                  setMetas((p) => (p ? p.map((x, ix) => (ix === i ? { ...x, meta: v } : x)) : p));
                }}
                placeholder="0"
                className="h-11 w-28 rounded-lg border border-v2-linha-forte bg-v2-superficie px-3 text-right text-base font-bold tabular-nums outline-none focus:border-v2-azul"
              />
              <button
                onClick={() => prever(m)}
                disabled={!m.meta}
                data-ripple
                aria-label={`Ver a tela de meta batida de ${m.nome} nas TVs`}
                title={m.meta ? `Ver a tela BATEU A META de ${m.nome} nas TVs` : "Defina uma meta para ver a tela"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[16px] ring-1 ring-inset ring-v2-linha-forte hover:bg-v2-azul-claro disabled:opacity-40"
              >
                👁
              </button>
            </div>
          ))
        )}
      </div>
      <button
        onClick={salvar}
        disabled={salvando || metas === null || metas.length === 0}
        data-ripple
        className={BOTAO_PRIMARIO + " mt-3"}
      >
        {salvando ? "Salvando…" : "Salvar metas"}
      </button>
      {aviso && <p role="status" className={avisoDe(aviso.ok)}>{aviso.texto}</p>}
    </section>
  );
}
