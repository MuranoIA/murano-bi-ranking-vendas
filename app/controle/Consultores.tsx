"use client";

import { useEffect, useState } from "react";
import { CARTAO, CAMPO, avisoDe } from "../../componentes/estilo";
import { comGrupo, rotuloDoGrupo, type Grupo } from "@/lib/grupo";

type Aviso = { ok: boolean; texto: string } | null;
type Consultor = { nome: string; rca: number | null; pedidos: number; ultima: string; aparece: boolean };

const dataBr = (d: string) => (d ? d.split("-").reverse().join("/") : "");

// Os consultores da filial vêm do BANCO: quem lançou venda nela nos últimos 45 dias, com o RCA.
// Não se cadastra ninguém aqui; o supervisor só escolhe quem aparece no ranking da filial.
export function Consultores({ ativa, grupo }: { ativa: boolean; grupo: Grupo }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [lista, setLista] = useState<Consultor[] | null>(null);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);

  useEffect(() => {
    if (!jaAbriu) return;
    setLista(null);
    fetch(comGrupo("/api/ranking/consultores", grupo), { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j?.error) throw new Error(j.error); setLista(j.consultores); })
      .catch((e) => { setLista([]); setAviso({ ok: false, texto: "Não consegui ler os consultores: " + (e?.message ?? e) }); });
  }, [jaAbriu, grupo]);

  async function alternar(c: Consultor) {
    const aparece = !c.aparece;
    setOcupado(c.nome); setAviso(null);
    setLista((l) => l?.map((x) => (x.nome === c.nome ? { ...x, aparece } : x)) ?? l);
    try {
      const r = await fetch(comGrupo("/api/ranking/consultores", grupo), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: c.nome, aparece }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAviso({ ok: true, texto: `${c.nome} ${aparece ? "volta a aparecer" : "não aparece mais"} no ranking de ${rotuloDoGrupo(grupo)}.` });
    } catch (e: any) {
      setLista((l) => l?.map((x) => (x.nome === c.nome ? { ...x, aparece: c.aparece } : x)) ?? l);
      setAviso({ ok: false, texto: e?.message ?? String(e) });
    } finally { setOcupado(null); }
  }

  if (!jaAbriu) return null;
  const t = busca.trim().toLowerCase();
  const visiveis = (lista ?? []).filter((c) => !t || c.nome.toLowerCase().includes(t) || String(c.rca ?? "").includes(t));
  const escondidos = (lista ?? []).filter((c) => !c.aparece).length;
  return (
    <section className={CARTAO}>
      <h2 className="text-[18px] font-bold">Consultores de {rotuloDoGrupo(grupo)}</h2>
      <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
        Quem lançou venda nesta filial nos últimos 45 dias, pelo faturamento do ERP. Desmarque quem não deve aparecer no
        ranking: a pessoa sai da lista e da chamada de venda, e as vendas dela continuam no total da filial.
      </p>
      {lista && lista.length > 8 && (
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por nome ou RCA" className={CAMPO + " mt-3"} autoComplete="off" aria-label="Procurar consultor" />
      )}
      <div className="mt-3 divide-y divide-v2-linha">
        {lista === null ? (
          <p className="py-3 text-[13px] text-v2-tinta-fraca">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="py-3 text-[13px] text-v2-tinta-fraca">Ninguém lançou venda nesta filial nos últimos 45 dias.</p>
        ) : (
          visiveis.map((c) => (
            <label key={c.nome} className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={c.aparece}
                disabled={ocupado !== null}
                onChange={() => alternar(c)}
                className="h-5 w-5 shrink-0 accent-[var(--color-v2-azul)]"
              />
              <div className="min-w-0 flex-1">
                <div className={"truncate text-[14px] font-semibold" + (c.aparece ? "" : " text-v2-tinta-fraca line-through")}>{c.nome}</div>
                <div className="truncate text-[12px] tabular-nums text-v2-tinta-fraca">
                  {c.rca != null ? `RCA ${c.rca}` : "sem venda nos últimos 45 dias"}
                  {c.pedidos > 0 && ` · ${c.pedidos} pedido${c.pedidos === 1 ? "" : "s"} · última venda ${dataBr(c.ultima)}`}
                </div>
              </div>
              <span className="shrink-0 text-[12px] font-medium text-v2-tinta-fraca">{c.aparece ? "aparece" : "escondido"}</span>
            </label>
          ))
        )}
      </div>
      {lista && lista.length > 0 && (
        <p className="mt-2 text-[12.5px] text-v2-tinta-fraca">
          {lista.length} consultor{lista.length === 1 ? "" : "es"}{escondidos > 0 ? ` · ${escondidos} escondido${escondidos === 1 ? "" : "s"}` : ""}
        </p>
      )}
      {aviso && <p role="status" className={avisoDe(aviso.ok) + " mt-3"}>{aviso.texto}</p>}
    </section>
  );
}
