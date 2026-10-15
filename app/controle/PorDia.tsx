"use client";

import { useCallback, useEffect, useState } from "react";
import { BOTAO_CONTORNO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";
import { FILIAIS_PADRAO } from "@/lib/rankingFiliais";
import { SeletorFiliais } from "./SeletorFiliais";
import { gruposPermitidos, rotuloDoGrupo } from "@/lib/grupo";

type Linha = { nome: string; bruto: number; devolucoes: number; liquido: number; pedidos: number; clientes: number };
type Resposta = {
  dia: string; aoVivo: boolean; semDados?: boolean; geradoEm?: string; filiais: number[];
  criterio?: { texto: string; rotulo: string | null; modo: "padrao" | "personalizado" } | null;
  totais: { bruto: number; devolucoes: number; liquido: number; pedidos: number; clientes: number };
  ranking: Linha[];
};

const brl = (n: number) => "R$ " + (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// hoje no fuso de Belém (UTC-3), que é o dia do ranking
const hojeBelem = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const somaDias = (d: string, n: number) => {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const MIN = "2025-01-13"; // primeiro dia com dado no ERP espelhado

// O ranking de QUALQUER dia, para o supervisor. Mesma conta do painel das TVs e do VendasPro.
export function PorDia({ ativa }: { ativa: boolean }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [dia, setDia] = useState(hojeBelem());
  const [filiais, setFiliais] = useState<number[]>(FILIAIS_PADRAO);
  const [permitidas, setPermitidas] = useState<number[] | null>(null);
  const [prontoFiliais, setProntoFiliais] = useState(false);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);

  // começa pelas filiais que a pessoa guardou na aba "Filiais"
  useEffect(() => {
    if (!jaAbriu) return;
    fetch("/api/ranking/filiais")
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.minha)) setFiliais(j.minha); if (Array.isArray(j?.permitidas)) setPermitidas(j.permitidas); })
      .catch(() => {})
      .finally(() => setProntoFiliais(true));
  }, [jaAbriu]);

  const carregar = useCallback(async (d: string, f: number[]) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/ranking/dia?dia=${d}&filiais=${f.join(",")}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setDados(j);
    } catch (e: any) {
      setDados(null);
      setErro(e?.message ?? String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (jaAbriu && prontoFiliais && dia) carregar(dia, filiais);
  }, [jaAbriu, prontoFiliais, dia, filiais, carregar]);

  if (!jaAbriu) return null;
  const hoje = hojeBelem();
  const t = dados?.totais;
  return (
    <div className="grid gap-4">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Ranking de um dia</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Escolha qualquer data. Vale o critério da aba “Critérios” (o mesmo das TVs); abaixo do resultado aparece qual foi usado.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className={ROTULO} htmlFor="rk-por-dia">Data</label>
            <input
              id="rk-por-dia"
              type="date"
              value={dia}
              min={MIN}
              max={hoje}
              onChange={(e) => e.target.value && setDia(e.target.value)}
              className={CAMPO + " sm:w-52"}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDia(somaDias(dia, -1))} disabled={dia <= MIN} data-ripple className={BOTAO_CONTORNO} aria-label="Dia anterior">← Anterior</button>
            <button onClick={() => setDia(somaDias(dia, 1))} disabled={dia >= hoje} data-ripple className={BOTAO_CONTORNO} aria-label="Próximo dia">Próximo →</button>
            <button onClick={() => setDia(hoje)} disabled={dia === hoje} data-ripple className={BOTAO_CONTORNO}>Hoje</button>
          </div>
        </div>
        <div className="mt-4">
          {/* o supervisor tem uma filial só: aparece o nome dela, sem botões para escolher */}
          {gruposPermitidos(permitidas).length === 1 ? (
            <>
              <span className={ROTULO}>Filial</span>
              <p className="mt-1.5 text-[15px] font-semibold">{rotuloDoGrupo(gruposPermitidos(permitidas)[0])}</p>
            </>
          ) : (
            <>
              <span className={ROTULO}>Filiais</span>
              <div className="mt-1.5"><SeletorFiliais valor={filiais} aoMudar={setFiliais} permitidas={permitidas} /></div>
            </>
          )}
        </div>
      </section>

      {erro && <p role="alert" className={avisoDe(false)}>{erro}</p>}

      <section className={CARTAO} aria-busy={carregando}>
        {carregando && !dados && <p className="text-[14px] text-v2-tinta-fraca">Calculando…</p>}
        {dados && t && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Líquido", brl(t.liquido)],
                ["Vendas (bruto)", brl(t.bruto)],
                ["Devoluções", brl(t.devolucoes)],
                ["Pedidos · clientes", `${t.pedidos} · ${t.clientes}`],
              ].map(([r, v]) => (
                <div key={r}>
                  <div className={ROTULO}>{r}</div>
                  <div className="mt-1 text-[18px] font-extrabold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            {dados.ranking.length === 0 ? (
              <p className="mt-4 text-[14px] text-v2-tinta-fraca">
                {dados.semDados ? "Sem vendas nem devoluções nesse dia nas filiais marcadas." : "Ninguém vendeu ainda nesse dia."}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[14px]">
                  <thead>
                    <tr className="text-left text-[12px] font-bold uppercase tracking-[0.08em] text-v2-tinta-fraca">
                      <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Vendedor</th>
                      <th className="py-2 pr-2 text-right">Líquido</th><th className="py-2 pr-2 text-right">Bruto</th>
                      <th className="py-2 pr-2 text-right">Devol.</th><th className="py-2 pr-2 text-right">Pedidos</th>
                      <th className="py-2 text-right">Clientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.ranking.map((e, i) => (
                      <tr key={e.nome} className="border-t border-v2-linha tabular-nums">
                        <td className="py-2 pr-2 font-bold">{i + 1}</td>
                        <td className="py-2 pr-2 font-semibold">{e.nome}</td>
                        <td className="py-2 pr-2 text-right font-bold">{brl(e.liquido)}</td>
                        <td className="py-2 pr-2 text-right">{brl(e.bruto)}</td>
                        <td className="py-2 pr-2 text-right">{e.devolucoes ? brl(e.devolucoes) : "—"}</td>
                        <td className="py-2 pr-2 text-right">{e.pedidos}</td>
                        <td className="py-2 text-right">{e.clientes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {dados.criterio && (
              <p className="mt-3 rounded-lg bg-v2-vinho-claro px-3 py-2 text-[12.5px] leading-5">
                <strong>Critério usado:</strong>{" "}
                {dados.criterio.modo === "padrao" ? "Padrão (VendasPro)" : (dados.criterio.rotulo ?? "Personalizado")}
                <span className="block text-v2-tinta-fraca">{dados.criterio.texto.replace(/^[^:]*: /, "")}</span>
              </p>
            )}
            <p className="mt-3 text-[12px] text-v2-tinta-fraca">
              {dados.aoVivo ? "Hoje, ao vivo. " : ""}Calculado agora a partir do ERP; um dia passado pode mudar se uma nota for cancelada depois.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
