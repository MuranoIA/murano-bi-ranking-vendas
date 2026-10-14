import { createClient } from "@supabase/supabase-js";
import { lerSessao, podeAdmin } from "@/lib/sessao";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Upload da foto do vendedor para o ranking. O slug (de QUEM é a foto) vem da
// sessão no servidor, então um vendedor só altera a PRÓPRIA foto. Única exceção: o
// admin pode apontar o slug de qualquer consultor (`slug` no form / na query).
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

export async function GET(req: Request) {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  const pedido = new URL(req.url).searchParams.get("slug");
  if (pedido) {
    if (!podeAdmin(sessao)) return Response.json({ error: "apenas admin" }, { status: 403 });
    if (!SLUG_OK.test(pedido)) return Response.json({ error: "consultor inválido" }, { status: 400 });
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
    if (!podeAdmin(sessao)) return Response.json({ error: "apenas admin pode trocar a foto de outro consultor" }, { status: 403 });
    if (!SLUG_OK.test(alvo)) return Response.json({ error: "consultor inválido" }, { status: 400 });
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
