import { sb } from "@/lib/config";
import { CHAVE_MUSICA_VENDEDOR, type MusicaVendedor } from "@/lib/musicaVendedor";

export const dynamic = "force-dynamic";

// PÚBLICA (o painel das TVs não tem login, como a edge function bi-ranking-vendas): as músicas
// próprias dos consultores, por slug (lib/musicaVendedor.ts). O painel procura pelo nome completo
// do ERP e depois pelo 1º nome, igual à foto. Só o necessário para tocar: nada de e-mail ou caminho.
const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export async function GET() {
  const { data, error } = await sb().from("bi_config").select("chave,valor").like("chave", CHAVE_MUSICA_VENDEDOR + "%");
  if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
  const musicas: Record<string, Pick<MusicaVendedor, "tipo" | "url" | "video" | "inicio" | "segundos" | "cortado">> = {};
  for (const r of data ?? []) {
    try {
      const m = JSON.parse(r.valor) as MusicaVendedor;
      const slug = String(r.chave).slice(CHAVE_MUSICA_VENDEDOR.length);
      if (m.tipo === "youtube" && m.video) musicas[slug] = { tipo: "youtube", video: m.video, inicio: m.inicio, segundos: m.segundos };
      else if (m.tipo === "arquivo" && m.url) musicas[slug] = { tipo: "arquivo", url: m.url, inicio: m.inicio, segundos: m.segundos, cortado: !!m.cortado };
    } catch { /* valor inválido: esse consultor fica com a música da filial */ }
  }
  return Response.json({ musicas }, { headers: CORS });
}

// DIAGNÓSTICO do YouTube nas TVs: cada vez que o painel tenta tocar uma música do YouTube, conta como
// foi (tocou, erro-150 = o vídeo não deixa incorporar, nao-comecou-10s = autoplay bloqueado ou rede,
// player-nao-pronto...). Guarda as 30 últimas em bi_config.musica_vendedor_diag, para ver no banco por
// que não tocou numa TV, sem precisar abrir o console dela. Público como o GET (a TV não tem login):
// só aceita valores curtos e de formato conhecido, e não grava nada além disso.
const CHAVE_DIAG = "musica_vendedor_diag";
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const motivo = String(b?.diag ?? "");
  if (!/^[a-z0-9-]{2,40}$/.test(motivo)) return Response.json({ error: "inválido" }, { status: 400, headers: CORS });
  const video = typeof b?.video === "string" && /^[A-Za-z0-9_-]{11}$/.test(b.video) ? b.video : null;
  const onde = b?.onde === "sozinho" ? "sozinho" : "dentro-de-quadro";
  const estados = String(b?.estados ?? "").replace(/[^0-9,-]/g, "").slice(0, 40);
  const client = sb();
  const { data } = await client.from("bi_config").select("valor").eq("chave", CHAVE_DIAG).maybeSingle();
  let lista: unknown[] = [];
  try { const v = JSON.parse(data?.valor ?? "[]"); if (Array.isArray(v)) lista = v; } catch { /* recomeça */ }
  lista.unshift({ em: new Date().toISOString(), motivo, video, onde, estados, navegador: (req.headers.get("user-agent") ?? "").slice(0, 160) });
  const agora = new Date().toISOString();
  await client.from("bi_config").upsert({ chave: CHAVE_DIAG, valor: JSON.stringify(lista.slice(0, 30)), atualizado_em: agora }, { onConflict: "chave" });
  return Response.json({ ok: true }, { headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" } });
}
