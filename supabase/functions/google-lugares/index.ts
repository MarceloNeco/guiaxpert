// GuiaXpert — "Procurar no Google": Places Autocomplete (New) com a chave guardada no servidor.
// GET /functions/v1/google-lugares?q=boteco%20do%20ze&lat=-29.37&lng=-50.87&lang=pt
// Segredo: GOOGLE_PLACES_KEY (Google Cloud → APIs → Places API (New) → chave restrita a esta API).
// Devolve só o que o app mostra AO VIVO numa lista, com o logo do Google: nome, endereço e placeId.
// O app não guarda nome nem endereço do Google; guarda só o placeId (permitido) e o que a pessoa confirma.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  if (!(await podeUsar(req))) return json({ erro: "sem-acesso" }, 403);
  const key = await chave("GOOGLE_PLACES_KEY");
  if (!key) return json({ erro: "sem-chave" }, 503);

  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 100);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const lang = u.searchParams.get("lang") === "en" ? "en" : "pt-BR";
  if (q.length < 2) return json({ sugestoes: [] });

  const corpo: Record<string, unknown> = { input: q, languageCode: lang };
  if (Number.isFinite(lat) && Number.isFinite(lng)) corpo.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };

  const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) return json({ erro: "google-" + r.status, detalhe: (await r.text()).slice(0, 300) }, 502);
  const j = await r.json();
  const sugestoes = (j.suggestions || []).map((s: any) => {
    const p = s.placePrediction; if (!p) return null;
    const f = p.structuredFormat || {};
    return { id: p.placeId, nome: f.mainText?.text || p.text?.text || "", endereco: f.secondaryText?.text || "" };
  }).filter((x: any) => x && x.id && x.nome).slice(0, 6);
  return json({ sugestoes });
});
