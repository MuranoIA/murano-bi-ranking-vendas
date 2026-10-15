import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lerSessao, podeConfigurar, type Sessao } from "./sessao";
import { chaveDoGrupo, escolherGrupo, type Grupo } from "./grupo";

// Leitura e escrita de bi_config por filial (lib/grupo.ts). Só servidor.
export function sb(): SupabaseClient {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase envs ausentes");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * A sessão e o grupo que esta requisição configura, ou a resposta de erro.
 * O grupo vem de `?grupo=`, mas só entre os que a pessoa pode (o supervisor tem só o da filial dele).
 */
export function quemConfigura(req: Request): { sessao: Sessao; grupo: Grupo } | Response {
  const sessao = lerSessao();
  if (!sessao) return Response.json({ error: "não autenticado" }, { status: 401 });
  if (!podeConfigurar(sessao)) return Response.json({ error: "apenas administrador ou supervisor" }, { status: 403 });
  const grupo = escolherGrupo(new URL(req.url).searchParams.get("grupo"), sessao.filiais);
  if (!grupo) return Response.json({ error: "Nenhuma filial definida para você." }, { status: 403 });
  return { sessao, grupo };
}

/** Valor da filial; sem ele, a chave antiga sem sufixo (`herdado: true`). */
export async function lerDaFilial(base: string, g: Grupo): Promise<{ valor: string | null; herdado: boolean }> {
  const proprio = chaveDoGrupo(base, g);
  const { data, error } = await sb().from("bi_config").select("chave,valor").in("chave", [proprio, base]);
  if (error) throw new Error(error.message);
  const m = new Map((data ?? []).map((r: any) => [r.chave, r.valor as string]));
  if (m.has(proprio)) return { valor: m.get(proprio) ?? null, herdado: false };
  return { valor: m.get(base) ?? null, herdado: m.has(base) };
}

export async function gravarDaFilial(base: string, g: Grupo, valor: string): Promise<string | null> {
  const { error } = await sb().from("bi_config")
    .upsert({ chave: chaveDoGrupo(base, g), valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  return error?.message ?? null;
}
