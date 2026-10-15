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
import { Consultores } from "./Consultores";
import { CHIP, CHIP_DESLIGADO, CHIP_LIGADO } from "../../componentes/estilo";
import { escolherGrupo, filiaisDoGrupo, gruposPermitidos, rotuloDoGrupo, type Grupo } from "@/lib/grupo";

type Aba = "ao-vivo" | "por-dia" | "foto" | "consultores" | "filiais" | "criterios" | "metas" | "tvs" | "musica";

// ---------------------------------------------------------------------------
// A TELA DO RANKING. Mesmo esqueleto do admin novo: barra fina de marca, título
// grande no conteúdo, seções em abas quadradas, cada bloco num cartão.
//
// O que é só do administrador (metas, TVs, música) some para os demais; o
// servidor confere de novo em cada rota. A foto é de todos os consultores: a
// rota deduz DE QUEM é a foto da sessão, nunca do cliente.
// ---------------------------------------------------------------------------
// `porDia`: admin ou supervisor de filial — quem configura. `filiais`: o recorte de quem entrou
// (null = as duas), configurado no admin do hub (lib/escopo.ts) — a tela só mostra, quem recorta é o
// servidor. Cada filial tem a sua configuração (lib/grupo.ts): o supervisor mexe só na dele; o
// admin sem recorte escolhe no topo qual filial está configurando.
export function Ranking({ admin, porDia, filiais, tema: temaInicial }: { admin: boolean; porDia: boolean; filiais: number[] | null; tema: TemaChat }) {
  const [tema, setTema] = useState<TemaChat>(temaInicial);
  // a aba mora no `#`: recarregar ou mandar o link abre na mesma seção. Lida só
  // depois de montar — o servidor não vê o `#`.
  const [aba, setAba] = useState<Aba>("ao-vivo");
  const grupos = porDia ? gruposPermitidos(filiais) : [];
  const [grupo, setGrupo] = useState<Grupo | null>(() => (porDia ? escolherGrupo(null, filiais) : null));
  const config = porDia && grupo !== null;
  const ABAS: { k: Aba; rotulo: string }[] = [
    { k: "ao-vivo", rotulo: "Ao vivo" },
    ...(config ? ([{ k: "por-dia", rotulo: "Por dia" }] as { k: Aba; rotulo: string }[]) : []),
    { k: "foto", rotulo: "Minha foto" },
    ...(config
      ? ([
          { k: "consultores", rotulo: "Consultores" },
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
          {config
            ? "O painel das TVs e tudo o que o controla: ranking de qualquer dia, consultores, fotos, critério, metas, desfile e a música dos parabéns — de cada filial."
            : "O painel de vendas ao vivo e a sua foto, que aparece ao lado do seu nome."}
        </p>

        {config && grupo && (
          grupos.length > 1 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filial que você está configurando">
              <span className="text-[13px] font-semibold text-v2-tinta-fraca">Configurando:</span>
              {grupos.map((g) => (
                <button key={g} type="button" aria-pressed={grupo === g} onClick={() => setGrupo(g)} data-ripple
                  className={[CHIP, grupo === g ? CHIP_LIGADO : CHIP_DESLIGADO].join(" ")}>
                  {rotuloDoGrupo(g)}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[13.5px]"><span className="text-v2-tinta-fraca">Sua filial:</span> <b>{rotuloDoGrupo(grupo)}</b></p>
          )
        )}

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
          <AoVivo porDia={config} filiais={grupo ? filiaisDoGrupo(grupo) : filiais} />
        </div>
        <div id="secao-foto" role="tabpanel" aria-labelledby="aba-foto" hidden={aba !== "foto"} className="mt-4">
          <Foto key={grupo ?? "-"} grupo={config ? grupo : null} />
        </div>
        {config && grupo && (
          <>
            <div id="secao-por-dia" role="tabpanel" aria-labelledby="aba-por-dia" hidden={aba !== "por-dia"} className="mt-4">
              <PorDia ativa={aba === "por-dia"} />
            </div>
            <div id="secao-consultores" role="tabpanel" aria-labelledby="aba-consultores" hidden={aba !== "consultores"} className="mt-4">
              <Consultores ativa={aba === "consultores"} grupo={grupo} />
            </div>
            <div id="secao-filiais" role="tabpanel" aria-labelledby="aba-filiais" hidden={aba !== "filiais"} className="mt-4">
              <Filiais ativa={aba === "filiais"} />
            </div>
            <div id="secao-criterios" role="tabpanel" aria-labelledby="aba-criterios" hidden={aba !== "criterios"} className="mt-4">
              <Criterios key={grupo} ativa={aba === "criterios"} grupo={grupo} />
            </div>
            <div id="secao-metas" role="tabpanel" aria-labelledby="aba-metas" hidden={aba !== "metas"} className="mt-4">
              <Metas key={grupo} ativa={aba === "metas"} grupo={grupo} />
            </div>
            <div id="secao-tvs" role="tabpanel" aria-labelledby="aba-tvs" hidden={aba !== "tvs"} className="mt-4">
              <Tvs ativa={aba === "tvs"} grupo={grupo} />
            </div>
            <div id="secao-musica" role="tabpanel" aria-labelledby="aba-musica" hidden={aba !== "musica"} className="mt-4">
              <Musica ativa={aba === "musica"} grupo={grupo} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
