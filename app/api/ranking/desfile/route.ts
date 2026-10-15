import { quemConfigura, gravarDaFilial } from "@/lib/config";

export const dynamic = "force-dynamic";

// Dispara o "desfile" nas TVs da filial: grava bi_config.desfile_comando:<grupo> com um id único.
// Cada painel confere o comando da filial dele a cada ~6 s (edge fn ?comando=1) e roda o desfile
// das vendas de hoje dessa filial. Admin ou supervisor da filial.
export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  const id = String(Date.now());
  const erro = await gravarDaFilial("desfile_comando", q.grupo, id);
  if (erro) return Response.json({ error: erro }, { status: 500 });
  return Response.json({ ok: true, id, grupo: q.grupo });
}
