// SolverONE — proxy de IA: a chave fica aqui, a pessoa não cria chave nenhuma.
// POST /functions/v1/ia  { provedor, modelo, sistema, mensagens:[{papel:'pessoa'|'ia', texto}], app, limite, web }
// Responde { texto }. Segredo: GEMINI_KEY (Google AI Studio). Cota por pessoa: RPC ia_consumir (tabela ia_uso).
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  const key = Deno.env.get("GEMINI_KEY");
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

  const modelo = Deno.env.get("GEMINI_MODELO") || "gemini-2.0-flash";
  const corpo: any = {
    contents: msgs.map((m: any) => ({ role: m.papel === "ia" ? "model" : "user", parts: [{ text: String(m.texto || "").slice(0, 12000) }] })),
    generationConfig: { maxOutputTokens: Math.min(Number(b.limite) || 900, 4000) },
  };
  if (b.sistema) corpo.system_instruction = { parts: [{ text: String(b.sistema).slice(0, 12000) }] };
  if (b.web) corpo.tools = [{ google_search: {} }];

  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent?key=" + encodeURIComponent(key), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  });
  if (!r.ok) return json({ erro: "ia-" + r.status, detalhe: (await r.text()).slice(0, 300) }, 502);
  const j = await r.json();
  const c = j.candidates?.[0];
  const texto = ((c?.content?.parts) || []).map((p: any) => p.text || "").join("").trim();
  const fontes = (c?.groundingMetadata?.groundingChunks || []).map((g: any) => g.web?.uri).filter(Boolean).slice(0, 5);
  return json({ texto, fontes, restante_dia: cota.restante_dia, restante_mes: cota.restante_mes });
});
