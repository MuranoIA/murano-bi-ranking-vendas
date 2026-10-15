import { quemConfigura, lerDaFilial, gravarDaFilial } from "@/lib/config";

export const dynamic = "force-dynamic";

// Meta do dia da filial (bi_config.meta_dia:<grupo>, em R$). Admin ou supervisor da filial.
// Sem meta própria vale a antiga, de todas as TVs. Escrita SÓ no murano-conversas (bi_config).
export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  try {
    const { valor, herdado } = await lerDaFilial("meta_dia", q.grupo);
    return Response.json({ meta: Number(valor ?? 0) || 0, herdado, grupo: q.grupo });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  let b: any;
  try { b = await req.json(); } catch { return Response.json({ error: "body inválido" }, { status: 400 }); }
  const meta = Math.max(0, Math.round(Number(b?.meta ?? 0)));
  if (!isFinite(meta)) return Response.json({ error: "meta inválida" }, { status: 400 });
  const erro = await gravarDaFilial("meta_dia", q.grupo, String(meta));
  if (erro) return Response.json({ error: erro }, { status: 500 });
  return Response.json({ ok: true, meta, grupo: q.grupo });
}
