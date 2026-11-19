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

export function OPTIONS() {
  return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
