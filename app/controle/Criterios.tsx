"use client";

import { useEffect, useState } from "react";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CARTAO, CHIP, CHIP_DESLIGADO, CHIP_LIGADO, ROTULO, avisoDe } from "../../componentes/estilo";
import { CRITERIO_PADRAO, rotuloDoCriterio, type Criterio } from "@/lib/criterio";
import { FILIAIS_PADRAO } from "@/lib/rankingFiliais";

type Aviso = { ok: boolean; texto: string } | null;
type Linha = { nome: string; liquido: number };
type Previa = { totais: { bruto: number; devolucoes: number; liquido: number; pedidos: number }; ranking: Linha[] };

const brl = (n: number) => "R$ " + (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hojeBelem = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

// Os itens do modo Personalizado (decisão do dono: os 5 abaixo). Bonificação, simples remessa e
// consignada ficaram de fora porque vêm com valor zero e não mudariam o ranking.
const ITENS: { k: "venda" | "manifesto" | "devolucoes" | "soFaturados"; rotulo: string; ajuda: string }[] = [
  { k: "venda", rotulo: "Venda padrão", ajuda: "Pedidos de venda comum (TV 1)." },
  { k: "manifesto", rotulo: "Venda de manifesto", ajuda: "Pedidos de venda de manifesto (TV 14)." },
  { k: "devolucoes", rotulo: "Descontar devoluções", ajuda: "Tira do vendedor as devoluções lançadas no dia." },
  { k: "soFaturados", rotulo: "Só pedidos já faturados", ajuda: "Deixa de fora pedidos liberados ou bloqueados que ainda não viraram nota." },
];

// ---------------------------------------------------------------------------
// O CRITÉRIO DO RANKING. Padrão = a regra do VendasPro; Personalizado = o que o supervisor marcar.
// Vale para todas as TVs e para os dias anteriores. Antes de salvar, a prévia mostra o ranking de
// hoje com o critério escolhido ao lado do padrão, para ninguém mandar às TVs um número sem ver.
// ---------------------------------------------------------------------------
export function Criterios({ ativa }: { ativa: boolean }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [crit, setCrit] = useState<Criterio>(CRITERIO_PADRAO);
  const [salvo, setSalvo] = useState<Criterio | null>(null);
  const [filiaisTv, setFiliaisTv] = useState<number[]>(FILIAIS_PADRAO);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<{ padrao: Previa; escolhido: Previa } | null>(null);
  const [calculando, setCalculando] = useState(false);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);

  useEffect(() => {
    if (!jaAbriu) return;
    fetch("/api/ranking/criterio")
      .then((r) => r.json())
      .then((j) => { if (j?.error) throw new Error(j.error); setCrit(j.criterio); setSalvo(j.criterio); })
      .catch((e) => setAviso({ ok: false, texto: "Não consegui ler o critério: " + (e?.message ?? e) }));
    fetch("/api/ranking/filiais")
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.tv)) setFiliaisTv(j.tv); })
      .catch(() => {});
  }, [jaAbriu]);

  const nenhumTipo = crit.modo === "personalizado" && !crit.venda && !crit.manifesto;
  const mudou = salvo !== null && JSON.stringify(crit) !== JSON.stringify(salvo);
  const mudar = (p: Partial<Criterio>) => { setCrit((c) => ({ ...c, ...p })); setPrevia(null); setAviso(null); };

  async function calcular(c: Criterio): Promise<Previa> {
    const r = await fetch(`/api/ranking/dia?dia=${hojeBelem()}&filiais=${filiaisTv.join(",")}&criterio=${encodeURIComponent(JSON.stringify(c))}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
    return j;
  }
  async function verPrevia() {
    setCalculando(true);
    setAviso(null);
    try {
      const [padrao, escolhido] = await Promise.all([calcular(CRITERIO_PADRAO), calcular(crit)]);
      setPrevia({ padrao, escolhido });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Não foi possível calcular a prévia: " + (e?.message ?? e) });
    } finally {
      setCalculando(false);
    }
  }
  async function salvar() {
    setSalvando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/ranking/criterio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ criterio: crit }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setCrit(j.criterio); setSalvo(j.criterio);
      setAviso({ ok: true, texto: "Critério salvo. As TVs passam a usar em até 1 minuto." });
    } catch (e: any) {
      setAviso({ ok: false, texto: "Não foi possível salvar: " + (e?.message ?? e) });
    } finally {
      setSalvando(false);
    }
  }

  if (!jaAbriu) return null;
  const rotulo = rotuloDoCriterio(crit);
  return (
    <div className="grid gap-4">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">O que compõe o valor do ranking</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Vale para todas as TVs e também para os dias anteriores (aba “Por dia”).
        </p>

        <div role="radiogroup" aria-label="Modo do critério" className="mt-4 grid gap-2 sm:grid-cols-2">
          {([
            ["padrao", "Padrão (VendasPro)", "Venda padrão + manifesto emitidas no dia, sem canceladas, menos as devoluções lançadas no dia. Bate com o Dashboard do VendasPro."],
            ["personalizado", "Personalizado", "Você escolhe abaixo o que entra na conta."],
          ] as const).map(([m, titulo, texto]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={crit.modo === m}
              data-ripple
              onClick={() => mudar(m === "padrao" ? CRITERIO_PADRAO : { ...crit, modo: "personalizado" })}
              className={[
                "rounded-xl p-3 text-left ring-1 ring-inset transition-colors",
                crit.modo === m ? "bg-v2-vinho-claro ring-v2-vinho" : "bg-v2-superficie ring-v2-linha-forte hover:bg-v2-vinho-claro",
              ].join(" ")}
            >
              <span className="block text-[14px] font-bold">{titulo}</span>
              <span className="mt-0.5 block text-[12.5px] leading-5 text-v2-tinta-fraca">{texto}</span>
            </button>
          ))}
        </div>

        {crit.modo === "personalizado" && (
          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              {ITENS.map((it) => (
                <label key={it.k} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-v2-vinho-claro">
                  <input
                    type="checkbox"
                    checked={crit[it.k]}
                    onChange={(e) => mudar({ [it.k]: e.target.checked } as Partial<Criterio>)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#621244]"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold">{it.rotulo}</span>
                    <span className="block text-[12.5px] leading-5 text-v2-tinta-fraca">{it.ajuda}</span>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <span className={ROTULO}>Dia do pedido pela data de</span>
              <div role="group" aria-label="Data" className="mt-2 flex flex-wrap gap-2">
                {([["emissao", "Emissão"], ["faturamento", "Faturamento"]] as const).map(([v, r]) => (
                  <button key={v} type="button" aria-pressed={crit.data === v} data-ripple onClick={() => mudar({ data: v })}
                    className={[CHIP, crit.data === v ? CHIP_LIGADO : CHIP_DESLIGADO].join(" ")}>{r}</button>
                ))}
              </div>
            </div>
            {nenhumTipo && <p role="alert" className={avisoDe(false)}>Marque ao menos venda padrão ou venda de manifesto.</p>}
            {rotulo && <p className="text-[12.5px] text-v2-tinta-fraca">Nas TVs vai aparecer, discreto: <strong className="text-v2-tinta">{rotulo}</strong></p>}
          </div>
        )}

        <p className="mt-4 text-[12.5px] leading-5 text-v2-tinta-fraca">
          A meta do dia continua em reais: um critério que tira as devoluções, por exemplo, deixa a meta mais fácil de bater.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={verPrevia} disabled={nenhumTipo || calculando} data-ripple className={BOTAO_CONTORNO}>
            {calculando ? "Calculando…" : "Ver prévia de hoje"}
          </button>
          <button onClick={salvar} disabled={nenhumTipo || salvando || !mudou} data-ripple className={BOTAO_PRIMARIO}>
            {salvando ? "Salvando…" : "Salvar para as TVs"}
          </button>
        </div>
        {aviso && <p role="status" className={avisoDe(aviso.ok) + " mt-3"}>{aviso.texto}</p>}
      </section>

      {previa && (
        <section className={CARTAO}>
          <h2 className="text-[18px] font-bold">Prévia de hoje</h2>
          <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">Filiais das TVs. Nada foi salvo ainda.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {([["Padrão (VendasPro)", previa.padrao], [crit.modo === "padrao" ? "Padrão (VendasPro)" : "Com o seu critério", previa.escolhido]] as const).map(([titulo, p]) => (
              <div key={titulo + p.totais.liquido} className="rounded-xl p-3 ring-1 ring-inset ring-v2-linha">
                <div className="text-[13px] font-bold">{titulo}</div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.02em]">{brl(p.totais.liquido)}</div>
                <div className="text-[12px] text-v2-tinta-fraca">{p.totais.pedidos} pedidos · devoluções {brl(p.totais.devolucoes)}</div>
                <ol className="mt-3 grid gap-1 text-[13px]">
                  {p.ranking.slice(0, 5).map((l, i) => (
                    <li key={l.nome} className="flex justify-between gap-2">
                      <span className="truncate">{i + 1}. {l.nome}</span>
                      <span className="shrink-0 tabular-nums">{brl(l.liquido)}</span>
                    </li>
                  ))}
                  {p.ranking.length === 0 && <li className="text-v2-tinta-fraca">Nenhuma venda ainda.</li>}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
