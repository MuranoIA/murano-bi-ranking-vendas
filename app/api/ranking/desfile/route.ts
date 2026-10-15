import { quemConfigura, gravarDaFilial, lerDaFilial } from "@/lib/config";

export const dynamic = "force-dynamic";

// Dispara o "desfile" nas TVs da filial: grava bi_config.desfile_comando:<grupo> com um id único.
// Cada painel confere o comando da filial dele a cada ~6 s (edge fn ?comando=1) e roda o desfile
// das vendas de hoje dessa filial. Admin ou supervisor da filial.
// PAUSAR (15/10/2026): `{ acao: "parar" }` grava desfile_parar:<grupo>, e as TVs interrompem o
// desfile e voltam ao ranking. É uma chave separada: as TVs com o código antigo tratam qualquer
// mudança em desfile_comando como "rodar".
// GET devolve os dois ids (Date.now()), para a tela saber se há desfile rodando ao abrir.
const idDe = async (base: string, g: Parameters<typeof lerDaFilial>[1]) => {
  const { valor, herdado } = await lerDaFilial(base, g);
  return herdado ? null : Number(valor) || null;
};

export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  try {
    const [inicio, parado] = await Promise.all([idDe("desfile_comando", q.grupo), idDe("desfile_parar", q.grupo)]);
    return Response.json({ inicio, parado, agora: Date.now() });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  const b = await req.json().catch(() => ({}));
  const parar = b?.acao === "parar";
  const id = String(Date.now());
  const erro = await gravarDaFilial(parar ? "desfile_parar" : "desfile_comando", q.grupo, id);
  if (erro) return Response.json({ error: erro }, { status: 500 });
  return Response.json({ ok: true, id, grupo: q.grupo, acao: parar ? "parar" : "rodar" });
}
