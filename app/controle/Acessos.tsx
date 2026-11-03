"use client";

import { useEffect, useState } from "react";
import { BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO, avisoDe } from "../../componentes/estilo";

type Papel = "super_admin" | "supervisor_belem" | "supervisor_maranhao" | "vendedor_belem" | "vendedor_maranhao" | "nenhum";
type Pessoa = { email: string; nome: string; papel: Papel; sugestao?: { papel: Papel; erp: string } | null };
type Aviso = { ok: boolean; texto: string } | null;

const PAPEIS: { v: Papel; rotulo: string; explica: string }[] = [
  { v: "super_admin", rotulo: "Super admin", explica: "Vê as duas filiais, configura tudo e mexe nestes acessos." },
  { v: "supervisor_belem", rotulo: "Supervisor · Belém", explica: "Vê e configura só Belém." },
  { v: "supervisor_maranhao", rotulo: "Supervisor · Maranhão", explica: "Vê e configura só o Maranhão." },
  { v: "vendedor_belem", rotulo: "Vendedor · Belém", explica: "Vê o ranking ao vivo de Belém e cuida da própria foto." },
  { v: "vendedor_maranhao", rotulo: "Vendedor · Maranhão", explica: "Vê o ranking ao vivo do Maranhão e cuida da própria foto." },
  { v: "nenhum", rotulo: "Sem acesso", explica: "Não vê filial nenhuma no Ranking." },
];
const rotulo = (p: Papel) => PAPEIS.find((x) => x.v === p)?.rotulo ?? p;

// QUEM VÊ O QUÊ NO RANKING — só do super admin. As pessoas são as do hub; o papel daqui é o mesmo
// do `/ranking/admin` do hub (tabela rk_papel), e vale na próxima vez que a pessoa abrir a tela.
export function Acessos({ ativa }: { ativa: boolean }) {
  const [jaAbriu, setJaAbriu] = useState(false);
  const [lista, setLista] = useState<Pessoa[] | null>(null);
  const [fixo, setFixo] = useState("");
  const [eu, setEu] = useState("");
  const [busca, setBusca] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoPapel, setNovoPapel] = useState<Papel>("vendedor_belem");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => { if (ativa) setJaAbriu(true); }, [ativa]);

  useEffect(() => {
    if (!jaAbriu) return;
    fetch("/api/ranking/acessos", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j?.error) throw new Error(j.error); setLista(j.pessoas); setFixo(j.fixo); setEu(j.eu); })
      .catch((e) => { setLista([]); setAviso({ ok: false, texto: "Não consegui ler os acessos: " + (e?.message ?? e) }); });
  }, [jaAbriu]);

  async function trocar(email: string, papel: Papel, nome?: string) {
    setOcupado(email); setAviso(null);
    try {
      const r = await fetch("/api/ranking/acessos", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, papel }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `erro ${r.status}`);
      setLista((l) => {
        const atual = l ?? [];
        if (atual.some((p) => p.email === email)) return atual.map((p) => (p.email === email ? { ...p, papel, sugestao: null } : p));
        return [...atual, { email, nome: nome || email.split("@")[0], papel }].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      });
      setAviso({ ok: true, texto: `${nome || email}: ${rotulo(papel)}. Vale na próxima vez que a pessoa abrir o Ranking.` });
      return true;
    } catch (e: any) {
      setAviso({ ok: false, texto: e?.message ?? String(e) });
      return false;
    } finally { setOcupado(null); }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    if (await trocar(email, novoPapel)) setNovoEmail("");
  }

  if (!jaAbriu) return null;
  const t = busca.trim().toLowerCase();
  const visiveis = (lista ?? []).filter((p) => !t || p.nome.toLowerCase().includes(t) || p.email.includes(t) || rotulo(p.papel).toLowerCase().includes(t));
  const sugeridos = (lista ?? []).filter((p) => p.sugestao).length;
  const conta = (p: Papel) => (lista ?? []).filter((x) => x.papel === p).length;

  return (
    <div className="grid gap-4">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Acessos ao Ranking</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          Defina o que cada pessoa do hub vê aqui. A mudança vale na próxima vez que ela abrir o Ranking.
        </p>
        <ul className="mt-3 grid gap-1 text-[13px] leading-5 text-v2-tinta-fraca">
          {PAPEIS.map((p) => (
            <li key={p.v}><b className="text-v2-tinta">{p.rotulo}:</b> {p.explica}</li>
          ))}
        </ul>
      </section>

      <section className={CARTAO}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por nome, e-mail ou papel" className={CAMPO + " mt-0"} autoComplete="off" aria-label="Procurar pessoa" />
        {lista && lista.length > 0 && (
          <p className="mt-2 text-[12.5px] text-v2-tinta-fraca">
            {conta("super_admin")} super admin · {conta("supervisor_belem") + conta("supervisor_maranhao")} supervisores ·{" "}
            {conta("vendedor_belem") + conta("vendedor_maranhao")} vendedores · {conta("nenhum")} sem acesso
            {sugeridos > 0 && <> · <b className="text-v2-tinta">{sugeridos} sem acesso que venderam no ERP</b> (veja a sugestão)</>}
          </p>
        )}
        <div className="mt-2 divide-y divide-v2-linha">
          {lista === null ? (
            <p className="py-3 text-[13px] text-v2-tinta-fraca">Carregando…</p>
          ) : visiveis.length === 0 ? (
            <p className="py-3 text-[13px] text-v2-tinta-fraca">Ninguém encontrado.</p>
          ) : (
            visiveis.map((p) => {
              const travado = p.email === fixo || p.email === eu;
              return (
                <div key={p.email} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{p.nome}</div>
                    <div className="truncate text-[12px] text-v2-tinta-fraca">{p.email}</div>
                    {p.sugestao && (
                      <button type="button" disabled={ocupado !== null} onClick={() => trocar(p.email, p.sugestao!.papel, p.nome)} data-ripple
                        className="mt-1 text-left text-[12.5px] font-semibold text-v2-azul underline-offset-2 hover:underline disabled:opacity-50">
                        Sugestão: {rotulo(p.sugestao.papel)} — vendeu como {p.sugestao.erp} nos últimos 45 dias. Aplicar
                      </button>
                    )}
                  </div>
                  <select
                    value={p.papel}
                    disabled={ocupado !== null || travado}
                    onChange={(e) => trocar(p.email, e.target.value as Papel, p.nome)}
                    aria-label={`Papel de ${p.nome}`}
                    title={travado ? (p.email === fixo ? "O Romulo é super admin fixo." : "Você não pode mudar o seu próprio acesso.") : undefined}
                    className="h-11 w-full rounded-lg border border-v2-linha-forte bg-v2-superficie px-3 text-base text-v2-tinta outline-none focus:border-v2-azul disabled:opacity-60 sm:w-60"
                  >
                    {PAPEIS.map((x) => <option key={x.v} value={x.v}>{x.rotulo}</option>)}
                  </select>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className={CARTAO}>
        <h3 className="text-[16px] font-bold">Pessoa que não está na lista</h3>
        <p className="mt-1 text-[13px] leading-5 text-v2-tinta-fraca">A lista traz quem está ativo no hub. Para outra pessoa, informe o e-mail com que ela entra no hub.</p>
        <form onSubmit={adicionar} className="mt-3 grid gap-3 sm:grid-cols-[1fr_15rem_auto] sm:items-end">
          <label className="block">
            <span className={ROTULO}>E-mail</span>
            <input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="nome@muranoprofessional.com.br" className={CAMPO} autoComplete="off" />
          </label>
          <label className="block">
            <span className={ROTULO}>Papel</span>
            <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as Papel)} className={CAMPO}>
              {PAPEIS.filter((x) => x.v !== "nenhum").map((x) => <option key={x.v} value={x.v}>{x.rotulo}</option>)}
            </select>
          </label>
          <button type="submit" disabled={!novoEmail.trim() || ocupado !== null} data-ripple className={BOTAO_PRIMARIO + " h-12"}>Salvar</button>
        </form>
      </section>

      {aviso && <p role="status" className={avisoDe(aviso.ok)}>{aviso.texto}</p>}
    </div>
  );
}
