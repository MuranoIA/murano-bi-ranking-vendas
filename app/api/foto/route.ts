import { createClient } from "@supabase/supabase-js";
import { lerSessao } from "@/lib/sessao";
import { podeMexerEm, slugDoVendedor } from "@/lib/alvoConsultor";

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
  let { data } = await sb().from("bi_fotos_ranking").select("url,atualizado_em").eq("slug", slug).maybeSingle();
  // a PRÓPRIA foto: quem passou a ter a chave pelo nome completo do ERP (lib/acessoRanking.ts) ainda vê a
  // foto antiga, do 1º nome — é a que a TV mostra até ele mandar outra (a edge function faz o mesmo)
  if (!data && !pedido && slug.includes("-")) {
    ({ data } = await sb().from("bi_fotos_ranking").select("url,atualizado_em").eq("slug", slug.split("-")[0]).maybeSingle());
  }
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
