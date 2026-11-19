import { sb } from "./config";
import { lerSessao, podeConfigurar, type Sessao } from "./sessao";
import { escolherGrupo } from "./grupo";
import { slugsDoGrupo } from "./vendedores";

// DE QUEM é a foto / a música que esta requisição mexe. Usado por /api/foto e /api/minha-musica.
// O slug vem da sessão no servidor, então um vendedor só altera o que é DELE. Exceção: o admin e o
// supervisor apontam outro consultor (`slug`) — o supervisor só os vendedores da filial dele.

export const SLUG_OK = /^[a-z0-9-]{1,80}$/;

/** slug do vendedor logado: carteira da sessão; senão, e-mail -> acesso.carteira. */
export async function slugDoVendedor(): Promise<string | null> {
  const sessao = lerSessao();
  if (!sessao) return null;
  if (sessao.carteira) return sessao.carteira;
  const { data } = await sb().from("acesso").select("carteira").eq("email", sessao.email).maybeSingle();
  return (data?.carteira as string) ?? null;
}

/** null = pode; senão a resposta de erro. O próprio sempre; outro, admin ou supervisor da filial dele. */
export async function podeMexerEm(sessao: Sessao, slug: string, grupoPedido: string | null): Promise<Response | null> {
  if (!SLUG_OK.test(slug)) return Response.json({ error: "consultor inválido" }, { status: 400 });
  if (slug === (await slugDoVendedor())) return null;
  if (!podeConfigurar(sessao)) return Response.json({ error: "Só o administrador ou o supervisor mexe no de outro consultor." }, { status: 403 });
  if (!sessao.filiais) return null; // admin sem recorte: qualquer consultor
  const grupo = escolherGrupo(grupoPedido, sessao.filiais);
  try {
    if (grupo && (await slugsDoGrupo(grupo)).has(slug)) return null;
  } catch (e: any) {
    return Response.json({ error: "Não foi possível conferir os vendedores da filial: " + (e?.message ?? e) }, { status: 502 });
  }
  return Response.json({ error: "Esse consultor não é da sua filial." }, { status: 403 });
}
