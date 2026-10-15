import { createClient } from "@supabase/supabase-js";
import { lerSessao, podeConfigurar, type Sessao } from "@/lib/sessao";
import { escolherGrupo } from "@/lib/grupo";
import { slugsDoGrupo } from "@/lib/vendedores";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Upload da foto do vendedor para o ranking. O slug (de QUEM é a foto) vem da
// sessão no servidor, então um vendedor só altera a PRÓPRIA foto. Exceção: o admin
// e o supervisor apontam outro consultor (`slug` no form / na query) — o supervisor só
// os vendedores da filial dele (lib/vendedores.ts). DELETE tira a foto.
// Grava no bucket ranking-fotos + tabela bi_fotos_ranking (a edge fn do ranking lê dali).
const BUCKET = "ranking-fotos";
const MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

function sb() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase envs ausentes");
  return createClient(url, key, { auth: { persistSession: false } });
}

// slug do vendedor logado: carteira da sessão; senão, e-mail -> acesso.carteira.
async function slugDoVendedor(): Promise<string | null> {
  const sessao = lerSessao();
  if (!sessao) return null;
  if (sessao.carteira) return sessao.carteira;
  const { data } = await sb().from("acesso").select("carteira").eq("email", sessao.email).maybeSingle();
  return (data?.carteira as string) ?? null;
}

const SLUG_OK = /^[a-z0-9-]{1,40}$/;

// Pode mexer na foto de `slug`? A própria sempre; a de outro, admin ou supervisor da filial do consultor.
async function podeMexerEm(sessao: Sessao, slug: string, grupoPedido: string | null): Promise<Response | null> {
  if (!SLUG_OK.test(slug)) return Response.json({ error: "consultor inválido" }, { status: 400 });
  if (slug === (await slugDoVendedor())) return null;
  if (!podeConfigurar(sessao)) return Response.json({ error: "Só o administrador ou o supervisor troca a foto de outro consultor." }, { status: 403 });
  if (!sessao.filiais) return null; // admin sem recorte: qualquer consultor
  const grupo = escolherGrupo(grupoPedido, sessao.filiais);
  try {
    if (grupo && (await slugsDoGrupo(grupo)).has(slug)) return null;
  } catch (e: any) {
    return Response.json({ error: "Não foi possível conferir os vendedores da filial: " + (e?.message ?? e) }, { status: 502 });
  }
  return Response.json({ error: "Esse consultor não é da sua filial." }, { status: 403 });
}

export async function GET(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  const u = new URL(req.url);
  const pedido = u.searchParams.get("slug");
  if (pedido) {
    const nao = await podeMexerEm(sessao, pedido, u.searchParams.get("grupo"));
    if (nao) return nao;
  }
  const slug = pedido || (await slugDoVendedor());
  if (!slug) return Response.json({ slug: null, url: null });
  const { data } = await sb().from("bi_fotos_ranking").select("url,atualizado_em").eq("slug", slug).maybeSingle();
  return Response.json({ slug, url: data?.url ?? null, atualizado_em: data?.atualizado_em ?? null });
}

export async function POST(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const alvo = form?.get("slug");
  let slug: string | null;
  if (typeof alvo === "string" && alvo) {
    const nao = await podeMexerEm(sessao, alvo, new URL(req.url).searchParams.get("grupo"));
    if (nao) return nao;
    slug = alvo;
  } else {
    slug = await slugDoVendedor();
  }
  if (!slug) {
    return Response.json({ error: "Este utilitário é para vendedores — a foto vai ao lado do seu nome no ranking. Entre com o seu usuário de vendedor." }, { status: 403 });
  }

  const file = form?.get("foto");
  if (!(file instanceof File)) return Response.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
  if (!MIMES.includes(file.type)) return Response.json({ error: "Formato inválido. Use JPG, PNG ou WEBP." }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "Imagem muito grande (máx. 5 MB)." }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const buf = new Uint8Array(await file.arrayBuffer());
  const path = `${slug}-${Date.now()}.${ext}`;

  const client = sb();
  const { error: upErr } = await client.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return Response.json({ error: "Falha no upload: " + upErr.message }, { status: 500 });

  const url = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: dbErr } = await client.from("bi_fotos_ranking")
    .upsert({ slug, url, atualizado_em: new Date().toISOString() }, { onConflict: "slug" });
  if (dbErr) return Response.json({ error: "Falha ao salvar: " + dbErr.message }, { status: 500 });

  return Response.json({ ok: true, slug, url });
}

// Tira a foto do consultor (o ranking volta a mostrar as iniciais). Mesma regra do POST.
export async function DELETE(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  const u = new URL(req.url);
  const pedido = u.searchParams.get("slug");
  let slug: string | null;
  if (pedido) {
    const nao = await podeMexerEm(sessao, pedido, u.searchParams.get("grupo"));
    if (nao) return nao;
    slug = pedido;
  } else {
    slug = await slugDoVendedor();
  }
  if (!slug) return Response.json({ error: "Nenhum consultor escolhido." }, { status: 400 });

  const client = sb();
  const { data: atual } = await client.from("bi_fotos_ranking").select("url").eq("slug", slug).maybeSingle();
  const { error } = await client.from("bi_fotos_ranking").delete().eq("slug", slug);
  if (error) return Response.json({ error: "Falha ao tirar a foto: " + error.message }, { status: 500 });
  // apaga o arquivo do bucket (best-effort: um órfão lá não aparece em lugar nenhum)
  const marca = `/${BUCKET}/`;
  const i = atual?.url ? atual.url.indexOf(marca) : -1;
  if (i >= 0) { try { await client.storage.from(BUCKET).remove([atual!.url.slice(i + marca.length)]); } catch { /* órfão */ } }
  return Response.json({ ok: true, slug });
}
