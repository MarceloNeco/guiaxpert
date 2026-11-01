// SolverONE — proxy de IA: a chave fica aqui, a pessoa não cria chave nenhuma.
// POST /functions/v1/ia  { provedor, modelo, sistema, mensagens:[{papel:'pessoa'|'ia', texto}], app, limite, web }
// Responde { texto }. Chave GEMINI_API_KEY: cadastrada pelo app (cofre cifrado) ou nos Secrets (GEMINI_API_KEY ou GEMINI_KEY). Cota por pessoa: RPC ia_consumir (tabela ia_uso).
// Só logado (verify_jwt). "web: true" liga a busca na web do Gemini (grounding com Google Search).
// Nada da conversa é guardado; só a contagem de chamadas.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ---- chaves do serviço: primeiro o cofre cifrado (Vault, cadastrado pelo app), depois os Secrets ----
const cacheChaves = new Map<string, { v: string; ate: number }>();
async function chave(nome: string, ...alternativas: string[]): Promise<string> {
  const c = cacheChaves.get(nome); if (c && c.ate > Date.now()) return c.v;
  let v = "";
  const url = Deno.env.get("SUPABASE_URL"), srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && srv) {
    for (const cab of [{ apikey: srv }, { apikey: srv, Authorization: "Bearer " + srv }]) {
      try {
        const r = await fetch(url + "/rest/v1/rpc/chave_servico", { method: "POST", headers: { ...cab, "Content-Type": "application/json" }, body: JSON.stringify({ p_nome: nome }) });
        if (r.ok) { const j = await r.json(); if (typeof j === "string") v = j; break; }
      } catch (_) { /* tenta o próximo jeito */ }
    }
  }
  if (!v) for (const n of [nome, ...alternativas]) { const e = Deno.env.get(n); if (e) { v = e; break; } }
  cacheChaves.set(nome, { v, ate: Date.now() + (v ? 60_000 : 15_000) });
  return v;
}

// ---- quem pode GASTAR as chaves do serviço: a equipe e quem ela convidou para as viagens dela ----
// (ninguém recebe a chave; outras famílias usam a própria chave de IA ou ficam só com a busca aberta)
const cacheAcesso = new Map<string, number>();
async function podeUsar(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const ate = cacheAcesso.get(auth); if (ate && ate > Date.now()) return true;
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  try {
    const r = await fetch(url + "/rest/v1/rpc/pode_usar_chaves_servico", { method: "POST", headers: { apikey: anon || "", Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
    if (!r.ok) return false;
    const ok = (await r.json()) === true;
    if (ok) cacheAcesso.set(auth, Date.now() + 120_000);
    return ok;
  } catch (_) { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  if (!(await podeUsar(req))) return json({ erro: "sem-acesso" }, 403);
  const key = await chave("GEMINI_API_KEY", "GEMINI_KEY");
  if (!key) return json({ erro: "sem-chave" }, 503);

  let b: any; try { b = await req.json(); } catch { return json({ erro: "json" }, 400); }
  const app = String(b.app || "solverone").slice(0, 40);
  const msgs = Array.isArray(b.mensagens) ? b.mensagens.slice(-12) : [];
  if (!msgs.length) return json({ erro: "sem-pergunta" }, 400);

  // cota (com o token da pessoa, para auth.uid() valer dentro do RPC)
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization") || "";
  const rc = await fetch(url + "/rest/v1/rpc/ia_consumir", {
    method: "POST", headers: { apikey: anon || "", Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ p_app: app, p_limite_dia: Number(Deno.env.get("IA_LIMITE_DIA") || 60), p_limite_mes: Number(Deno.env.get("IA_LIMITE_MES") || 900) }),
  });
  if (!rc.ok) return json({ erro: "cota-erro", detalhe: (await rc.text()).slice(0, 200) }, 502);
  const cota = await rc.json();
  if (!cota || !cota.ok) return json({ erro: cota?.motivo || "cota", restante_dia: cota?.restante_dia ?? 0, restante_mes: cota?.restante_mes ?? 0 }, 429);

  // modelo: o configurado, senão o "mais recente" do Gemini Flash; se o Google aposentar um nome, tenta o próximo
  const modelos = [Deno.env.get("GEMINI_MODELO") || "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
  const corpo: any = {
    contents: msgs.map((m: any) => ({ role: m.papel === "ia" ? "model" : "user", parts: [{ text: String(m.texto || "").slice(0, 12000) }] })),
    generationConfig: { maxOutputTokens: Math.min(Number(b.limite) || 900, 4000) },
  };
  if (b.sistema) corpo.system_instruction = { parts: [{ text: String(b.sistema).slice(0, 12000) }] };
  if (b.web) corpo.tools = [{ google_search: {} }];

  let r: Response | null = null;
  for (const modelo of modelos) {
    r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(corpo),
    });
    if (r.status !== 404) break;
  }
  if (!r || !r.ok) return json({ erro: "ia-" + (r ? r.status : 0), detalhe: r ? (await r.text()).slice(0, 300) : null }, 502);
  const j = await r.json();
  const c = j.candidates?.[0];
  const texto = ((c?.content?.parts) || []).map((p: any) => p.text || "").join("").trim();
  const fontes = (c?.groundingMetadata?.groundingChunks || []).map((g: any) => g.web?.uri).filter(Boolean).slice(0, 5);
  return json({ texto, fontes, restante_dia: cota.restante_dia, restante_mes: cota.restante_mes });
});
