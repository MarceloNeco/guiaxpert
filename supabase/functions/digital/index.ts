// SolverONE — digital (ou rosto) CONFERIDA NO SERVIDOR, para confirmar que é você antes de mexer nas chaves do serviço.
// POST /functions/v1/digital  { acao: 'opcoes-cadastro' | 'cadastrar' | 'opcoes-entrar' | 'entrar', resposta? }
//
// Como funciona (WebAuthn / passkey):
//  - Cadastrar: só quem é dono/admin da equipe e acabou de confirmar a identidade (senha ou código, 15 min).
//    O celular cria uma chave de acesso presa a solverone.com.br; o servidor guarda só a parte PÚBLICA.
//  - Confirmar: o servidor manda um desafio de uso único (5 min); o celular assina depois da digital/rosto;
//    o servidor confere a assinatura com a parte pública e libera "login recente" por 15 min
//    (tabela confirmacao_recente, lida por _exigir_login_recente). Nada de digital sai do celular.
// Tabelas só o servidor lê e grava (RLS ligado, sem política): digital_credenciais, digital_desafios, confirmacao_recente.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as lib from "npm:@simplewebauthn/server@13.3.3";
import { criarNucleo } from "./nucleo.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const URL_ = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const nucleo = criarNucleo(lib, {
  rpID: Deno.env.get("DIGITAL_RP_ID") || "solverone.com.br",
  origens: (Deno.env.get("DIGITAL_ORIGENS") || "https://solverone.com.br,https://www.solverone.com.br").split(",").map((s) => s.trim()).filter(Boolean),
});
const PRAZO_DESAFIO_MS = 5 * 60_000, PRAZO_CONFIRMACAO_MS = 15 * 60_000;

// banco com a chave do servidor (só aqui dentro)
async function bd(caminho: string, op: { method?: string; body?: unknown; prefer?: string } = {}) {
  const r = await fetch(URL_ + "/rest/v1/" + caminho, {
    method: op.method || "GET",
    headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json", ...(op.prefer ? { Prefer: op.prefer } : {}) },
    body: op.body === undefined ? undefined : JSON.stringify(op.body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error("bd-" + r.status + ": " + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
// RPC com o token da pessoa (auth.uid() vale lá dentro)
async function rpcPessoa(auth: string, nome: string) {
  const r = await fetch(URL_ + "/rest/v1/rpc/" + nome, { method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  const t = await r.text();
  return { ok: r.ok, texto: t };
}
async function quemE(auth: string): Promise<{ id: string; email: string } | null> {
  const r = await fetch(URL_ + "/auth/v1/user", { headers: { apikey: ANON, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id, email: u.email || "" } : null;
}
async function guardarDesafio(uid: string, tipo: string, desafio: string) {
  await bd("digital_desafios", { method: "POST", prefer: "resolution=merge-duplicates",
    body: { user_id: uid, tipo, desafio, expira: new Date(Date.now() + PRAZO_DESAFIO_MS).toISOString() } });
}
// tira o desafio do banco ao usar: vale uma vez só
async function usarDesafio(uid: string, tipo: string): Promise<string | null> {
  const linhas = await bd(`digital_desafios?user_id=eq.${uid}&tipo=eq.${tipo}`, { method: "DELETE", prefer: "return=representation" });
  const d = Array.isArray(linhas) ? linhas[0] : null;
  if (!d || Date.parse(d.expira) < Date.now()) return null;
  return d.desafio;
}
async function registrar(uid: string, acao: string, depois: unknown) {
  try { await bd("acesso_log", { method: "POST", body: { quem: uid, acao, depois } }); } catch (_) { /* o log não pode derrubar a confirmação */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const eu = auth.startsWith("Bearer ") ? await quemE(auth) : null;
  if (!eu) return json({ erro: "sem-sessao" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ erro: "json" }, 400); }

  try {
    if (b.acao === "opcoes-cadastro" || b.acao === "cadastrar") {
      // cadastrar exige ser da equipe e ter confirmado a identidade há pouco (o banco decide)
      const p = await rpcPessoa(auth, "pode_cadastrar_digital");
      if (!p.ok) return json({ erro: /login-recente/.test(p.texto) ? "login-recente" : "sem-permissao" }, 403);
      if (b.acao === "opcoes-cadastro") {
        const existentes = await bd(`digital_credenciais?user_id=eq.${eu.id}&select=id,transportes`);
        const op = await nucleo.opcoesCadastro(eu, existentes);
        await guardarDesafio(eu.id, "cadastro", op.challenge);
        return json(op);
      }
      const desafio = await usarDesafio(eu.id, "cadastro");
      if (!desafio) return json({ erro: "desafio-expirou" }, 400);
      const c = await nucleo.conferirCadastro(b.resposta, desafio);
      const nome = String(b.nome || "").slice(0, 60) || null;
      await bd("digital_credenciais", { method: "POST", body: { ...c, user_id: eu.id, nome } });
      await registrar(eu.id, "digital-cadastrada", { app: String(b.app || "").slice(0, 40), nome, final: c.id.slice(-6) });
      return json({ ok: true, id: c.id });
    }

    if (b.acao === "opcoes-entrar") {
      const creds = await bd(`digital_credenciais?user_id=eq.${eu.id}&select=id,transportes`);
      if (!creds || !creds.length) return json({ erro: "sem-digital" }, 404);
      const op = await nucleo.opcoesEntrar(creds);
      await guardarDesafio(eu.id, "entrar", op.challenge);
      return json(op);
    }

    if (b.acao === "entrar") {
      const desafio = await usarDesafio(eu.id, "entrar");
      if (!desafio) return json({ erro: "desafio-expirou" }, 400);
      const idResp = String(b.resposta && b.resposta.id || "");
      const linhas = await bd(`digital_credenciais?user_id=eq.${eu.id}&id=eq.${encodeURIComponent(idResp)}&select=id,chave_publica,contador,transportes`);
      const cred = Array.isArray(linhas) ? linhas[0] : null;
      if (!cred) return json({ erro: "digital-desconhecida" }, 403);
      let r;
      try { r = await nucleo.conferirEntrar(b.resposta, desafio, cred); }
      catch (_) { await registrar(eu.id, "digital-recusada", { final: idResp.slice(-6) }); return json({ erro: "digital-recusada" }, 403); }
      const agora = new Date();
      await bd(`digital_credenciais?id=eq.${encodeURIComponent(cred.id)}`, { method: "PATCH", body: { contador: r.contador, usado_em: agora.toISOString() } });
      await bd("confirmacao_recente", { method: "POST", prefer: "resolution=merge-duplicates",
        body: { user_id: eu.id, ate: new Date(agora.getTime() + PRAZO_CONFIRMACAO_MS).toISOString(), como: "digital" } });
      await registrar(eu.id, "digital-confirmou", { final: cred.id.slice(-6) });
      return json({ ok: true, ate: new Date(agora.getTime() + PRAZO_CONFIRMACAO_MS).toISOString() });
    }
    return json({ erro: "acao" }, 400);
  } catch (e) {
    console.log("digital: falhou", b && b.acao, String(e && (e as Error).message || e).slice(0, 200));
    return json({ erro: "falhou" }, 500);
  }
});
