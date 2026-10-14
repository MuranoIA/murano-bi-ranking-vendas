"use client";

import { CHIP, CHIP_DESLIGADO, CHIP_LIGADO } from "../../componentes/estilo";
import { GRUPOS_FILIAL, filiaisDosGrupos, gruposMarcados } from "@/lib/rankingFiliais";

// Chips Belém / Maranhão. Pelo menos um fica ligado: sem filial não há ranking.
export function SeletorFiliais({ valor, aoMudar, desabilitado }: { valor: number[]; aoMudar: (f: number[]) => void; desabilitado?: boolean }) {
  const ligados = gruposMarcados(valor);
  function alternar(id: string) {
    const novo = ligados.includes(id) ? ligados.filter((x) => x !== id) : [...ligados, id];
    if (novo.length) aoMudar(filiaisDosGrupos(novo));
  }
  return (
    <div role="group" aria-label="Filiais" className="flex flex-wrap gap-2">
      {GRUPOS_FILIAL.map((g) => (
        <button
          key={g.id}
          type="button"
          disabled={desabilitado}
          aria-pressed={ligados.includes(g.id)}
          onClick={() => alternar(g.id)}
          data-ripple
          className={[CHIP, "disabled:opacity-50", ligados.includes(g.id) ? CHIP_LIGADO : CHIP_DESLIGADO].join(" ")}
        >
          {g.rotulo}
        </button>
      ))}
    </div>
  );
}
