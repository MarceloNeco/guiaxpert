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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const key = Deno.env.get("GOOGLE_PLACES_KEY");
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
