import { quemConfigura, sb } from "@/lib/config";
import { chaveDoGrupo, type Grupo } from "@/lib/grupo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Música da tela de parabéns do Ranking (menu Ranking → 🎵 Música dos parabéns).
// Guarda o arquivo no bucket público `ranking-musica` e o ponteiro em
// bi_config.parabens_musica (JSON). A edge fn `bi-ranking-vendas` devolve esse
// JSON para os painéis, que tocam por SEGUNDOS e voltam ao som sintetizado
// quando a chave não existe.
//
// POR FILIAL (15/10/2026): cada filial tem a sua música em parabens_musica:<grupo> (lib/grupo.ts),
// trocada pelo admin ou pelo supervisor da filial. Sem música própria, a filial toca a "música
// padrão": a chave antiga sem sufixo, que era de todas as TVs. "Voltar à música padrão" apaga só a
// da filial.
//
// O corte de 90s acontece no navegador do admin (web/lib/musicaParabens.ts):
// decodifica, corta e sobe um WAV — é lá também que a trilha de VÍDEO de um
// .mp4 é descartada, porque só o áudio é decodificado. Quando o navegador não
// dá conta do codec, o original sobe com `cortado:false` e o painel aplica o
// teto de 90s no player (e usa <audio>, que ignora o vídeo do container).
//
// ⚠️ O ARQUIVO NÃO PASSA POR ESTA ROTA. O corpo de uma função da Vercel tem
// teto de ~4,5 MB, e um WAV mono passa disso já com 47 s a 48 kHz — subir por aqui
// devolvia 413 (e o limite piora a cada segundo que o trecho ganha). Então o
// navegador sobe DIRETO para o Storage, em dois passos:
//   POST {acao:"assinar"}   -> devolve uma URL de upload assinada (2h)
//   PUT  <signedUrl>        -> o navegador manda os bytes ao Supabase
//   POST {acao:"confirmar"} -> conferimos que o objeto existe e gravamos o ponteiro
// A service_role nunca sai daqui: o que vai para o navegador é um token de
// escrita para UM caminho só, que nasce nesta rota depois da guarda de admin.
const BUCKET = "ranking-musica";
const CHAVE = "parabens_musica";
const SEGUNDOS = 90; // teto de reprodução na TV (não exportar: rota do Next só aceita handlers + config)
const MAX = 20 * 1024 * 1024; // o mesmo file_size_limit do bucket: acima disso o PUT já teria falhado
const MIMES: Record<string, string> = {
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a",
  "audio/ogg": "ogg", "audio/webm": "weba",
  "video/mp4": "mp4", "video/x-m4v": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

type Musica = { url: string; path: string; nome: string; segundos: number; cortado: boolean; origem: string; atualizado_em: string };

const lerMusica = (v: unknown): Musica | null => { if (typeof v !== "string" || !v) return null; try { return JSON.parse(v) as Musica; } catch { return null; } };

// A música própria da filial (null = não tem).
async function atual(g: Grupo): Promise<Musica | null> {
  const { data } = await sb().from("bi_config").select("valor").eq("chave", chaveDoGrupo(CHAVE, g)).maybeSingle();
  return lerMusica(data?.valor);
}

// A música padrão (chave antiga, sem filial).
async function padrao(): Promise<Musica | null> {
  const { data } = await sb().from("bi_config").select("valor").eq("chave", CHAVE).maybeSingle();
  return lerMusica(data?.valor);
}

// Apaga o arquivo antigo depois de trocar/remover. Best-effort: o bucket ficar
// com um órfão é bem menos grave que a troca falhar por causa da limpeza.
async function apagarArquivo(path?: string | null) {
  if (!path) return;
  try { await sb().storage.from(BUCKET).remove([path]); } catch { /* órfão no bucket, sem impacto */ }
}

export async function GET(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;
  const [propria, pad] = await Promise.all([atual(q.grupo), padrao()]);
  // `musica` = o que toca nas TVs da filial; `propria` diz se é a da filial ou a padrão
  return Response.json({ musica: propria ?? pad, propria: !!propria, padrao: pad, segundos: SEGUNDOS, grupo: q.grupo });
}

// Caminho novo (JSON, dois passos). Multipart era o caminho antigo: se chegar,
// é uma aba que ficou aberta desde antes do deploy — dizer isso é mais útil que
// um erro de campo faltando.
export async function POST(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;

  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) {
    return Response.json({ error: "Esta página está desatualizada. Recarregue com Ctrl+Shift+R e envie de novo." }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { acao?: string; mime?: string; path?: string; nome?: string; cortado?: boolean; origem?: string } | null;
  if (body?.acao === "assinar") return assinar(body, q.grupo);
  if (body?.acao === "confirmar") return confirmar(body, q.grupo);
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}

// Passo 1: reserva o caminho e devolve a URL de escrita assinada.
async function assinar(body: { mime?: string }, g: Grupo) {
  const ext = MIMES[String(body.mime ?? "")];
  if (!ext) return Response.json({ error: `Formato não suportado (${body.mime || "desconhecido"}). Use MP3, M4A, WAV, OGG ou MP4.` }, { status: 400 });

  const path = `parabens-${g}-${Date.now()}.${ext}`;
  const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return Response.json({ error: "Falha ao preparar o upload: " + (error?.message ?? "sem resposta") }, { status: 500 });
  return Response.json({ ok: true, path, signedUrl: data.signedUrl });
}

// Passo 2: o objeto já está no bucket — conferimos e gravamos o ponteiro.
async function confirmar(body: { path?: string; nome?: string; cortado?: boolean; origem?: string }, g: Grupo) {
  const path = String(body.path ?? "");
  // só um caminho que ESTA rota poderia ter criado; sem isso o ponteiro poderia
  // apontar para qualquer objeto do bucket.
  // e só da própria filial: o supervisor de uma não aponta o arquivo subido pela outra.
  if (!new RegExp(`^parabens-${g}-\\d+\\.[a-z0-9]{2,4}$`).test(path)) return Response.json({ error: "Caminho inválido." }, { status: 400 });

  const client = sb();
  const { data: achados } = await client.storage.from(BUCKET).list("", { search: path, limit: 1 });
  const obj = achados?.find((f) => f.name === path);
  if (!obj) return Response.json({ error: "O arquivo não chegou ao servidor. Tente enviar de novo." }, { status: 400 });

  const tamanho = Number(obj.metadata?.size ?? 0);
  if (!tamanho) { await apagarArquivo(path); return Response.json({ error: "Arquivo vazio." }, { status: 400 }); }
  if (tamanho > MAX) { await apagarArquivo(path); return Response.json({ error: `Arquivo muito grande (${(tamanho / 1048576).toFixed(1)} MB). Máximo 20 MB.` }, { status: 400 }); }

  const anterior = await atual(g);
  const musica: Musica = {
    url: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    path,
    nome: String(body.nome ?? "musica").slice(0, 120),
    segundos: SEGUNDOS,
    cortado: body.cortado === true,
    origem: String(body.origem ?? "").slice(0, 120),
    atualizado_em: new Date().toISOString(),
  };
  const { error: dbErr } = await client.from("bi_config")
    .upsert({ chave: chaveDoGrupo(CHAVE, g), valor: JSON.stringify(musica), atualizado_em: musica.atualizado_em }, { onConflict: "chave" });
  if (dbErr) {
    await apagarArquivo(path); // não deixa arquivo pendurado se o ponteiro não gravou
    return Response.json({ error: "Falha ao salvar: " + dbErr.message }, { status: 500 });
  }

  if (anterior?.path && anterior.path !== path) await apagarArquivo(anterior.path);
  return Response.json({ ok: true, musica });
}

// Volta à música padrão: apaga só a da filial (a padrão e a da outra filial ficam).
export async function DELETE(req: Request) {
  const q = quemConfigura(req);
  if (q instanceof Response) return q;

  const anterior = await atual(q.grupo);
  const { error } = await sb().from("bi_config").delete().eq("chave", chaveDoGrupo(CHAVE, q.grupo));
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await apagarArquivo(anterior?.path);
  const pad = await padrao();
  return Response.json({ ok: true, musica: pad, propria: false, padrao: pad });
}
