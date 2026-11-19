import { sb } from "@/lib/config";
import { lerSessao } from "@/lib/sessao";
import { podeMexerEm, slugDoVendedor } from "@/lib/alvoConsultor";
import { CHAVE_MUSICA_VENDEDOR, erroDoTrecho, idDoYoutube, type MusicaVendedor } from "@/lib/musicaVendedor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// A MÚSICA PRÓPRIA do consultor (lib/musicaVendedor.ts): toca nas TVs quando ELE vende.
// De quem é a música vem da sessão, como a foto (/api/foto): o vendedor só mexe na dele; admin e
// supervisor da filial podem apontar outro (`?slug=`), pela mesma regra (lib/alvoConsultor.ts).
//
//   GET                         -> { slug, musica }
//   POST {acao:"assinar", mime} -> URL de upload assinada (o arquivo vai DIRETO ao Storage, como na
//                                  aba Música: pela função da Vercel passaria do teto de ~4,5 MB)
//   POST {acao:"confirmar", path, nome, cortado, inicio, fim} -> grava o ponteiro do arquivo
//   POST {acao:"youtube", link, inicio, fim, nome?}           -> grava o vídeo do YouTube e o trecho
//   DELETE                      -> volta à música da filial
const BUCKET = "ranking-musica";
const MAX = 20 * 1024 * 1024;
const MIMES: Record<string, string> = {
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a",
  "audio/ogg": "ogg", "audio/webm": "weba",
  "video/mp4": "mp4", "video/x-m4v": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

const chave = (slug: string) => CHAVE_MUSICA_VENDEDOR + slug;

async function ler(slug: string): Promise<MusicaVendedor | null> {
  const { data } = await sb().from("bi_config").select("valor").eq("chave", chave(slug)).maybeSingle();
  try { return data?.valor ? (JSON.parse(data.valor) as MusicaVendedor) : null; } catch { return null; }
}

async function apagarArquivo(path?: string | null) {
  if (!path) return;
  try { await sb().storage.from(BUCKET).remove([path]); } catch { /* órfão no bucket, sem impacto */ }
}

async function gravar(slug: string, m: MusicaVendedor): Promise<string | null> {
  const { error } = await sb().from("bi_config")
    .upsert({ chave: chave(slug), valor: JSON.stringify(m), atualizado_em: m.atualizado_em }, { onConflict: "chave" });
  return error?.message ?? null;
}

// De quem é a música desta requisição, ou a resposta de erro.
async function alvo(req: Request, slugPedido?: string | null): Promise<string | Response> {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  const u = new URL(req.url);
  const pedido = slugPedido ?? u.searchParams.get("slug");
  if (pedido) {
    const nao = await podeMexerEm(sessao, pedido, u.searchParams.get("grupo"));
    return nao ?? pedido;
  }
  const meu = await slugDoVendedor();
  if (!meu) return Response.json({ error: "A música própria é para vendedores — entre com o seu usuário de vendedor." }, { status: 403 });
  return meu;
}

export async function GET(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  const s = await alvo(req);
  if (s instanceof Response) return s.status === 403 && !new URL(req.url).searchParams.get("slug") ? Response.json({ slug: null, musica: null }) : s;
  return Response.json({ slug: s, musica: await ler(s) });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  const s = await alvo(req, typeof b.slug === "string" && b.slug ? b.slug : null);
  if (s instanceof Response) return s;

  if (b.acao === "assinar") {
    const ext = MIMES[String(b.mime ?? "")];
    if (!ext) return Response.json({ error: `Formato não suportado (${b.mime || "desconhecido"}). Use MP3, M4A, WAV, OGG ou MP4.` }, { status: 400 });
    const path = `vendedor-${s}-${Date.now()}.${ext}`;
    const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return Response.json({ error: "Falha ao preparar o upload: " + (error?.message ?? "sem resposta") }, { status: 500 });
    return Response.json({ ok: true, path, signedUrl: data.signedUrl });
  }

  const inicio = Number(b.inicio), fim = Number(b.fim);
  const erroTrecho = erroDoTrecho(inicio, fim);

  if (b.acao === "confirmar") {
    const path = String(b.path ?? "");
    // só um caminho que esta rota criou PARA ESTE consultor
    if (!new RegExp(`^vendedor-${s}-\\d+\\.[a-z0-9]{2,4}$`).test(path)) return Response.json({ error: "Caminho inválido." }, { status: 400 });
    if (erroTrecho) { await apagarArquivo(path); return Response.json({ error: erroTrecho }, { status: 400 }); }
    const client = sb();
    const { data: achados } = await client.storage.from(BUCKET).list("", { search: path, limit: 1 });
    const obj = achados?.find((f) => f.name === path);
    if (!obj) return Response.json({ error: "O arquivo não chegou ao servidor. Tente enviar de novo." }, { status: 400 });
    const tamanho = Number(obj.metadata?.size ?? 0);
    if (!tamanho || tamanho > MAX) {
      await apagarArquivo(path);
      return Response.json({ error: tamanho ? "Arquivo muito grande (máx. 20 MB)." : "Arquivo vazio." }, { status: 400 });
    }
    const anterior = await ler(s);
    const m: MusicaVendedor = {
      tipo: "arquivo", nome: String(b.nome ?? "musica").slice(0, 120), inicio, fim, segundos: fim - inicio,
      url: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path, cortado: b.cortado === true,
      atualizado_em: new Date().toISOString(),
    };
    const erro = await gravar(s, m);
    if (erro) { await apagarArquivo(path); return Response.json({ error: "Falha ao salvar: " + erro }, { status: 500 }); }
    if (anterior?.path && anterior.path !== path) await apagarArquivo(anterior.path);
    return Response.json({ ok: true, slug: s, musica: m });
  }

  if (b.acao === "youtube") {
    const video = idDoYoutube(String(b.link ?? ""));
    if (!video) return Response.json({ error: "Não reconheci o link do YouTube. Copie o endereço do vídeo (youtube.com/watch?v=… ou youtu.be/…)." }, { status: 400 });
    if (erroTrecho) return Response.json({ error: erroTrecho }, { status: 400 });
    const anterior = await ler(s);
    const m: MusicaVendedor = {
      tipo: "youtube", nome: String(b.nome ?? "").trim().slice(0, 120) || "Vídeo do YouTube", inicio, fim, segundos: fim - inicio,
      video, atualizado_em: new Date().toISOString(),
    };
    const erro = await gravar(s, m);
    if (erro) return Response.json({ error: "Falha ao salvar: " + erro }, { status: 500 });
    if (anterior?.path) await apagarArquivo(anterior.path);
    return Response.json({ ok: true, slug: s, musica: m });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const s = await alvo(req);
  if (s instanceof Response) return s;
  const anterior = await ler(s);
  const { error } = await sb().from("bi_config").delete().eq("chave", chave(s));
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await apagarArquivo(anterior?.path);
  return Response.json({ ok: true, slug: s, musica: null });
}
