"use client";

import { useEffect, useState } from "react";
import { Ripple } from "../../componentes/Ripple";
import { SeletorTema } from "../../componentes/SeletorTema";
import type { TemaChat } from "@/lib/temaChat";
import { AoVivo } from "./AoVivo";
import { Foto } from "./Foto";
import { Metas } from "./Metas";
import { Tvs } from "./Tvs";
import { Musica } from "./Musica";
import { PorDia } from "./PorDia";
import { Filiais } from "./Filiais";
import { Criterios } from "./Criterios";

type Aba = "ao-vivo" | "por-dia" | "foto" | "filiais" | "criterios" | "metas" | "tvs" | "musica";

// ---------------------------------------------------------------------------
// A TELA DO RANKING. Mesmo esqueleto do admin novo: barra fina de marca, título
// grande no conteúdo, seções em abas quadradas, cada bloco num cartão.
//
// O que é só do administrador (metas, TVs, música) some para os demais; o
// servidor confere de novo em cada rota. A foto é de todos os consultores: a
// rota deduz DE QUEM é a foto da sessão, nunca do cliente.
// ---------------------------------------------------------------------------
export function Ranking({ admin, tema: temaInicial }: { admin: boolean; tema: TemaChat }) {
  const [tema, setTema] = useState<TemaChat>(temaInicial);
  // a aba mora no `#`: recarregar ou mandar o link abre na mesma seção. Lida só
  // depois de montar — o servidor não vê o `#`.
  const [aba, setAba] = useState<Aba>("ao-vivo");
  const ABAS: { k: Aba; rotulo: string }[] = [
    { k: "ao-vivo", rotulo: "Ao vivo" },
    ...(admin ? ([{ k: "por-dia", rotulo: "Por dia" }] as { k: Aba; rotulo: string }[]) : []),
    { k: "foto", rotulo: "Minha foto" },
    ...(admin
      ? ([
          { k: "filiais", rotulo: "Filiais" },
          { k: "criterios", rotulo: "Critérios" },
          { k: "metas", rotulo: "Metas" },
          { k: "tvs", rotulo: "TVs" },
          { k: "musica", rotulo: "Música" },
        ] as { k: Aba; rotulo: string }[])
      : []),
  ];
  useEffect(() => {
    const h = window.location.hash.slice(1) as Aba;
    if (ABAS.some((a) => a.k === h)) setAba(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function escolher(a: Aba) {
    setAba(a);
    history.replaceState(null, "", a !== "ao-vivo" ? `#${a}` : window.location.pathname + window.location.search);
  }

  return (
    <div className="v2 min-h-dvh bg-v2-fundo text-v2-tinta" data-tema={tema}>
      <Ripple />
      <header className="sticky top-0 z-10 bg-v2-vinho pt-[env(safe-area-inset-top)] text-white shadow-e2">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <span className="min-w-0 truncate text-[15px] font-extrabold tracking-[-0.01em]">Ranking</span>
          <div className="ml-auto shrink-0">
            <SeletorTema tema={tema} aoTrocar={setTema} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-5 sm:px-6 sm:pt-8">
        <h1 className="text-[28px] font-black leading-tight tracking-[-0.03em] sm:text-[34px]">Ranking de vendas</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-5 text-v2-tinta-fraca">
          {admin
            ? "O painel das TVs e tudo o que o controla: ranking de qualquer dia, filiais, foto dos consultores, metas, desfile e a música dos parabéns."
            : "O painel de vendas ao vivo e a sua foto, que aparece ao lado do seu nome."}
        </p>

        <div role="tablist" aria-label="Seções do ranking" className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {ABAS.map((a) => (
            <button
              key={a.k}
              role="tab"
              id={`aba-${a.k}`}
              aria-selected={aba === a.k}
              aria-controls={`secao-${a.k}`}
              data-ripple
              onClick={() => escolher(a.k)}
              className={[
                "flex h-10 shrink-0 items-center rounded-lg px-4 text-[13.5px] font-semibold transition-colors",
                aba === a.k
                  ? "bg-v2-vinho text-white shadow-e1"
                  : "bg-v2-superficie text-v2-tinta ring-1 ring-inset ring-v2-linha-forte hover:bg-v2-vinho-claro",
              ].join(" ")}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {/* As seções ficam montadas e a aba só esconde: um envio de música em
            andamento roda NESTA página, e desmontar a seção o perderia. */}
        <div id="secao-ao-vivo" role="tabpanel" aria-labelledby="aba-ao-vivo" hidden={aba !== "ao-vivo"} className="mt-4">
          <AoVivo admin={admin} />
        </div>
        <div id="secao-foto" role="tabpanel" aria-labelledby="aba-foto" hidden={aba !== "foto"} className="mt-4">
          <Foto admin={admin} />
        </div>
        {admin && (
          <>
            <div id="secao-por-dia" role="tabpanel" aria-labelledby="aba-por-dia" hidden={aba !== "por-dia"} className="mt-4">
              <PorDia ativa={aba === "por-dia"} />
            </div>
            <div id="secao-filiais" role="tabpanel" aria-labelledby="aba-filiais" hidden={aba !== "filiais"} className="mt-4">
              <Filiais ativa={aba === "filiais"} />
            </div>
            <div id="secao-criterios" role="tabpanel" aria-labelledby="aba-criterios" hidden={aba !== "criterios"} className="mt-4">
              <Criterios ativa={aba === "criterios"} />
            </div>
            <div id="secao-metas" role="tabpanel" aria-labelledby="aba-metas" hidden={aba !== "metas"} className="mt-4">
              <Metas ativa={aba === "metas"} />
            </div>
            <div id="secao-tvs" role="tabpanel" aria-labelledby="aba-tvs" hidden={aba !== "tvs"} className="mt-4">
              <Tvs />
            </div>
            <div id="secao-musica" role="tabpanel" aria-labelledby="aba-musica" hidden={aba !== "musica"} className="mt-4">
              <Musica ativa={aba === "musica"} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
