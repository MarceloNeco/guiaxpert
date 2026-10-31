// GuiaXpert — busca de lugares comerciais (Foursquare Places) com a chave guardada no servidor.
// O app chama GET /functions/v1/lugares?q=legitimo%20bar&lat=-23.6&lng=-46.63&lang=pt
// A chave fica no segredo FOURSQUARE_KEY (Supabase → Edge Functions → Secrets). Sem chave: 503 { erro: 'sem-chave' }.
// Só quem está logado chama (verify_jwt). Devolve lugares no formato do app (sem dado pessoal).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// categorias do Foursquare → categorias do guia
function categoria(cats: Array<{ id?: string; fsq_category_id?: string; name?: string }>): [string, string | null] {
  const nomes = cats.map((c) => String(c.name || "").toLowerCase()).join(" | ");
  if (/ice cream|gelato|sorvete/.test(nomes)) return ["doces", "sorvete"];
  if (/chocolate|dessert|bakery|pastry|candy|doce|confeitaria/.test(nomes)) return ["doces", "chocolate"];
  if (/bar|pub|brewery|beer|wine|chop|cerveja|nightlife|lounge/.test(nomes)) return ["bebidas", "bar"];
  if (/caf[eé]|coffee/.test(nomes)) return ["comer", "cafe"];
  if (/restaurant|food|pizza|burger|steak|sushi|diner|bistro|churrasc|lanche|padaria/.test(nomes)) return ["comer", "restaurante"];
  if (/museum|gallery/.test(nomes)) return ["atracao", "museu"];
  if (/scenic|lookout|viewpoint|mirante/.test(nomes)) return ["atracao", "mirante"];
  if (/park|zoo|garden|theme|amusement|playground|aquarium/.test(nomes)) return ["atracao", "parque"];
  if (/parking|gas station|fuel|pharmacy|hospital|supermarket|grocery|bank|atm/.test(nomes)) return ["logistica", null];
  if (/hotel|lodging|hostel|pousada|inn/.test(nomes)) return ["logistica", "hospedagem"];
  return ["atracao", null];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const key = Deno.env.get("FOURSQUARE_KEY");
  if (!key) return json({ erro: "sem-chave" }, 503);

  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const lang = u.searchParams.get("lang") === "en" ? "en" : "pt";
  if (q.length < 2) return json({ lugares: [] });

  const temCentro = Number.isFinite(lat) && Number.isFinite(lng);
  const legado = key.startsWith("fsq3");
  // só campos "Pro" (os "Premium": hours, rating, price, photos são cobrados à parte e sem faixa grátis)
  const campos = "fsq_id,fsq_place_id,name,latitude,longitude,geocodes,categories,location,tel,website";
  const api = legado
    ? `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(q)}&limit=10&fields=${campos}${temCentro ? `&ll=${lat},${lng}&radius=50000` : ""}`
    : `https://places-api.foursquare.com/places/search?query=${encodeURIComponent(q)}&limit=10&fields=${campos}${temCentro ? `&ll=${lat},${lng}&radius=50000` : ""}`;
  const headers: Record<string, string> = legado
    ? { Authorization: key, "Accept-Language": lang === "en" ? "en" : "pt-BR" }
    : { Authorization: `Bearer ${key}`, "X-Places-Api-Version": "2025-06-17", "Accept-Language": lang === "en" ? "en" : "pt-BR" };

  const r = await fetch(api, { headers });
  if (!r.ok) return json({ erro: "fsq-" + r.status, detalhe: (await r.text()).slice(0, 300) }, 502);
  const j = await r.json();
  const lista = (j.results || []).map((x: any) => {
    const id = x.fsq_place_id || x.fsq_id;
    const la = x.latitude ?? x.geocodes?.main?.latitude, lo = x.longitude ?? x.geocodes?.main?.longitude;
    if (!id || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
    const [cat, sub] = categoria(x.categories || []);
    const loc = x.location || {};
    const endereco = loc.formatted_address || [loc.address, loc.locality, loc.region].filter(Boolean).join(", ") || null;
    return {
      id: "fsq-" + id, nome: x.name, categoria: cat, subcategoria: sub || (x.categories?.[0]?.short_name || x.categories?.[0]?.name || null),
      descricao: x.categories?.map((c: any) => c.short_name || c.name).filter(Boolean).slice(0, 3).join(", ") || null,
      endereco, site: x.website || null, telefone: x.tel || null, horario: null,
      reserva: null, preco: null, criancas: null,
      confianca: "foursquare", gratis: false, lat: +Number(la).toFixed(5), lng: +Number(lo).toFixed(5), fonte: "Foursquare",
    };
  }).filter(Boolean);
  return json({ lugares: lista });
});
