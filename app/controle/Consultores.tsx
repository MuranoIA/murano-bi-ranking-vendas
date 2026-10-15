"use client";

import { useEffect, useState } from "react";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";
import { comGrupo, rotuloDoGrupo, type Grupo } from "@/lib/grupo";

type Aviso = { ok: boolean; texto: string } | null;
type Consultor = { email: string; nome: string };
type Conta = { email: string; nome: string; situacao: string | null; jaEhDaFilial: boolean };

// Os consultores (vendedores) da filial: o supervisor admite e demite quem vende com ele.
// Admitir = entra no Ranking como consultor da filial (foto, metas) e ganha o card do Ranking no hub.
export function Consultores({ ativa, grupo }: { ativa: boolean; grupo: Grupo }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [lista, setLista] = useState<Consultor[] | null>(null);
  const [busca, setBusca] = useState("");
  const [contas, setContas] = useState<Conta[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);

  function carregar() {
    fetch(comGrupo("/api/ranking/consultores", grupo), { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j?.error) throw new Error(j.error); setLista(j.consultores); })
      .catch((e) => { setLista([]); setAviso({ ok: false, texto: "Não consegui ler os consultores: " + (e?.message ?? e) }); });
  }
  useEffect(() => { if (jaAbriu) carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [jaAbriu, grupo]);

  // procura contas do hub enquanto digita (a partir de 2 letras)
  useEffect(() => {
    const t = busca.trim();
    if (t.length < 2) { setContas([]); return; }
    const id = setTimeout(() => {
      fetch(comGrupo(`/api/ranking/consultores?busca=${encodeURIComponent(t)}`, grupo), { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setContas(Array.isArray(j?.contas) ? j.contas : []))
        .catch(() => setContas([]));
    }, 300);
    return () => clearTimeout(id);
  }, [busca, grupo]);

  async function admitir(c: Conta) {
    setOcupado(c.email); setAviso(null);
    try {
      const r = await fetch(comGrupo("/api/ranking/consultores", grupo), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: c.email }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAviso({ ok: !j.avisoCard, texto: j.avisoCard ?? `${j.nome} agora é consultor(a) de ${rotuloDoGrupo(grupo)}. Vale no próximo acesso dela ao Ranking.` });
      setBusca(""); setContas([]); carregar();
    } catch (e: any) {
      setAviso({ ok: false, texto: e?.message ?? String(e) });
    } finally { setOcupado(null); }
  }

  async function demitir(c: Consultor) {
    if (!confirm(`Tirar ${c.nome} dos consultores de ${rotuloDoGrupo(grupo)}? A pessoa perde o card do Ranking no hub.`)) return;
    setOcupado(c.email); setAviso(null);
    try {
      const r = await fetch(comGrupo(`/api/ranking/consultores?email=${encodeURIComponent(c.email)}`, grupo), { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setAviso({ ok: true, texto: `${c.nome} saiu dos consultores de ${rotuloDoGrupo(grupo)}.` });
      carregar();
    } catch (e: any) {
      setAviso({ ok: false, texto: e?.message ?? String(e) });
    } finally { setOcupado(null); }
  }

  if (!jaAbriu) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Consultores de {rotuloDoGrupo(grupo)}</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Quem vende nesta filial. Eles entram no Ranking pelo hub, veem o painel ao vivo e colocam a própria foto.
        </p>
        <div className="mt-3 divide-y divide-v2-linha">
          {lista === null ? (
            <p className="py-3 text-[13px] text-v2-tinta-fraca">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="py-3 text-[13px] text-v2-tinta-fraca">Nenhum consultor cadastrado nesta filial.</p>
          ) : (
            lista.map((c) => (
              <div key={c.email} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{c.nome}</div>
                  <div className="truncate text-[12px] text-v2-tinta-fraca">{c.email}</div>
                </div>
                <button onClick={() => demitir(c)} disabled={ocupado !== null} data-ripple className={BOTAO_CONTORNO + " text-v2-erro"}>
                  {ocupado === c.email ? "Tirando…" : "Tirar"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Adicionar consultor</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Procure pelo nome ou e-mail da conta no hub. Quem ainda não tem conta precisa ser cadastrado pelo administrador do hub.
        </p>
        <label className={ROTULO + " mt-4"} htmlFor="rk-consultor">Nome ou e-mail</label>
        <input id="rk-consultor" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex: Patrícia" className={CAMPO} autoComplete="off" />
        {contas.length > 0 && (
          <ul className="mt-2 divide-y divide-v2-linha rounded-lg ring-1 ring-v2-linha">
            {contas.map((c) => (
              <li key={c.email} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{c.nome}</div>
                  <div className="truncate text-[12px] text-v2-tinta-fraca">{c.situacao ? `já é ${c.situacao}` : c.email}</div>
                </div>
                <button
                  onClick={() => admitir(c)}
                  disabled={ocupado !== null || (c.situacao !== null && !c.jaEhDaFilial) || c.jaEhDaFilial}
                  data-ripple
                  className={BOTAO_PRIMARIO}
                >
                  {c.jaEhDaFilial ? "Já está" : ocupado === c.email ? "Adicionando…" : "Adicionar"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {busca.trim().length >= 2 && contas.length === 0 && <p className="mt-2 text-[13px] text-v2-tinta-fraca">Nenhuma conta encontrada.</p>}
      </section>
      {aviso && <p role="status" className={avisoDe(aviso.ok) + " lg:col-span-2"}>{aviso.texto}</p>}
    </div>
  );
}
