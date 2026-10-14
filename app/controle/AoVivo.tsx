"use client";

import { useState } from "react";
import { rankingHref } from "@/lib/rankingUrl";
import { BOTAO_CONTORNO, BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO } from "../../componentes/estilo";

// Abrir o painel das TVs. Reusa a MESMA aba pelo nome "ranking_murano": se já
// estiver aberta, só se atualiza com a nova data — como o botão do funil fazia.
function abrir(dia?: string) {
  window.open(rankingHref(dia), "ranking_murano");
}

export function AoVivo({ admin }: { admin: boolean }) {
  const [dia, setDia] = useState("");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="text-[18px] font-bold">Ranking ao vivo</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
          O painel de vendas do dia, o mesmo que passa nas TVs. Abre em outra aba.
        </p>
        <button onClick={() => abrir()} data-ripple className={BOTAO_PRIMARIO + " mt-4 w-full sm:w-auto"}>
          Abrir o ranking ↗
        </button>
      </section>

      {admin && (
        <section className={CARTAO}>
          <h2 className="text-[18px] font-bold">Ver um dia anterior</h2>
          <p className="mt-1 text-[13.5px] leading-5 text-v2-tinta-fraca">
            O estado de fim de dia da data escolhida. Histórico a partir de 25/07/2026.
          </p>
          <label className={ROTULO + " mt-4"} htmlFor="rk-dia">
            Data
          </label>
          <input
            id="rk-dia"
            type="date"
            value={dia}
            max={new Date().toISOString().slice(0, 10)}
            min="2026-07-25"
            onChange={(e) => setDia(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dia && abrir(dia)}
            className={CAMPO}
          />
          <button
            onClick={() => dia && abrir(dia)}
            disabled={!dia}
            data-ripple
            className={BOTAO_CONTORNO + " mt-3 w-full sm:w-auto"}
          >
            Abrir o ranking desse dia ↗
          </button>
        </section>
      )}
    </div>
  );
}
