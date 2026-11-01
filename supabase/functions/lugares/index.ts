// GuiaXpert — busca de lugares comerciais (Foursquare Places) com a chave guardada no servidor.
// O app chama GET /functions/v1/lugares?q=legitimo%20bar&lat=-23.6&lng=-46.63&lang=pt
// Fontes: FOURSQUARE_KEY (API do Foursquare, só campos Pro) ou a base aberta FSQ OS Places carregada em lugares_abertos;
// TRIPADVISOR_KEY (Content API) soma resultados em qualquer caso. As chaves vêm do cofre cifrado (cadastradas pelo app)
// ou, se não houver, dos Secrets com o mesmo nome. ?teste=tripadvisor|foursquare responde se a chave foi aceita.
// FONTE_LUGARES=api|aberta escolhe; sem a variável: API se houver chave, senão base aberta. Sem nenhuma: 503 { erro: 'sem-chave' }.
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

// Base aberta no próprio Postgres (tabela lugares_abertos, FSQ OS Places). Usada quando FONTE_LUGARES=aberta,
// ou automaticamente quando não há FOURSQUARE_KEY. Vazia → devolve [].
async function daBaseAberta(req: Request, q: string, lat: number, lng: number, temCentro: boolean) {
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const r = await fetch(url + "/rest/v1/rpc/buscar_lugares_abertos", {
    method: "POST",
    headers: { apikey: anon, Authorization: req.headers.get("Authorization") || "", "Content-Type": "application/json" },
    body: JSON.stringify({ p_q: q, p_lat: temCentro ? lat : null, p_lng: temCentro ? lng : null, p_raio_m: 50000, p_limite: 10 }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return (rows || []).map((x: any) => ({
    id: x.id, nome: x.nome, categoria: x.categoria, subcategoria: x.subcategoria || null, descricao: x.descricao || null,
    endereco: x.endereco || null, site: x.site || null, telefone: x.telefone || null, horario: null,
    reserva: null, preco: null, criancas: null, confianca: "foursquare", gratis: false, lat: x.lat, lng: x.lng, fonte: "Foursquare",
  }));
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
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const lang = u.searchParams.get("lang") === "en" ? "en" : "pt";
  if (q.length < 2) return json({ lugares: [] });
  const temCentro = Number.isFinite(lat) && Number.isFinite(lng);

  const key = await chave("FOURSQUARE_KEY");
  const taKey = await chave("TRIPADVISOR_KEY");
  // botão "Testar" da tela de chaves: responde se a fonte aceitou a chave, sem misturar com o resto
  const teste = u.searchParams.get("teste");
  if (teste === "tripadvisor") {
    if (!taKey) return json({ ok: false, motivo: "sem-chave" });
    const t = await taBuscar(taKey, q, "pt", false);
    if (t.status === 401 || t.status === 403) return json({ ok: false, status: t.status, detalhe: t.detalhe });
    return json({ ok: t.status === 200, status: t.status, resultados: t.lista.length, api: t.api, detalhe: t.status === 200 ? null : t.detalhe });
  }
  if (teste === "foursquare") {
    if (!key) return json({ ok: false, motivo: "sem-chave" });
    const r = await fetch("https://places-api.foursquare.com/places/search?query=" + encodeURIComponent(q) + "&limit=3", { headers: { Authorization: "Bearer " + key, "X-Places-Api-Version": "2025-06-17" } });
    const corpo = await r.text();
    let n = 0; try { n = (JSON.parse(corpo).results || []).length; } catch (_) { /* resposta sem JSON */ }
    return json({ ok: r.ok, status: r.status, resultados: n, detalhe: r.ok ? null : corpo.slice(0, 200) });
  }
  const fonte = Deno.env.get("FONTE_LUGARES") || (key ? "api" : "aberta");
  // TripAdvisor em paralelo com o que vier abaixo (só ID pode ser guardado; o app mostra ao vivo e guarda o que a pessoa confirma)
  const ta = taKey ? doTripAdvisor(taKey, q, lat, lng, temCentro, lang).catch(() => []) : Promise.resolve([]);
  if (fonte === "aberta") {
    const lista = await daBaseAberta(req, q, lat, lng, temCentro);
    if (lista) return json({ lugares: juntar(lista, await ta), fonte: "aberta" });
    if (!key) { const t = await ta; return t.length ? json({ lugares: t, fonte: "tripadvisor" }) : json({ erro: "sem-chave" }, 503); }
  }
  if (!key) { const t = await ta; return t.length ? json({ lugares: t, fonte: "tripadvisor" }) : json({ erro: "sem-chave" }, 503); }

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
  return json({ lugares: juntar(lista, await ta), fonte: "api" });
});

// Tripadvisor: Terra API (terra.tripadvisor.com, chave no cabeçalho X-API-Key). A busca comum só devolve os lugares
// liberados para a chave (allowlist); se vier vazia, usa a busca no catálogo inteiro, que traz nome, endereço,
// coordenada e nota. Chave antiga (Content API, api.content.tripadvisor.com) continua funcionando como reserva.
// Custo (plano Discover): cada lugar devolvido é cobrado (1.000 grátis uma vez por conta, depois ~US$ 0,015 cada),
// por isso cada busca pede no máximo 5.
function taNome(loc: any, lang: string): string {
  const ns = loc.names || [];
  const doIdioma = ns.find((n: any) => String(n.language || "").startsWith(lang));
  return (doIdioma || ns.find((n: any) => n.primary) || ns[0] || {}).value || loc.name || "";
}
function taLugar(loc: any, lang: string) {
  const a = (loc.addresses || [])[0] || {};
  const cats = loc.categories || [];
  const topo = String(cats[0]?.top_level_category || "");
  const nomeCat = cats.map((c: any) => String(c.display_name || "")).join(" ").toLowerCase();
  let categoria = "atracao", sub: string | null = null;
  if (topo === "Eat & Drink") { if (/bar|pub|brew|cervej|chop|wine|vinho|night/.test(nomeCat)) { categoria = "bebidas"; sub = "bar"; } else if (/dessert|ice cream|sorvet|bakery|doce|chocolate|confeit/.test(nomeCat)) { categoria = "doces"; } else { categoria = "comer"; sub = "restaurante"; } }
  else if (topo === "Accommodation") { categoria = "logistica"; sub = "hospedagem"; }
  const la = Number(loc.coordinates?.latitude), lo = Number(loc.coordinates?.longitude);
  return {
    id: "ta-" + loc.id, nome: taNome(loc, lang), categoria, subcategoria: sub,
    descricao: cats.map((c: any) => c.display_name).filter(Boolean).slice(0, 2).join(", ") || null,
    endereco: a.formatted || [a.street_address, a.city, a.state].filter(Boolean).join(", ") || null,
    site: null, telefone: null, horario: null, reserva: null, preco: null, criancas: null,
    nota: typeof loc.traveler_ratings?.overall?.rating === "number" ? Math.round(loc.traveler_ratings.overall.rating * 10) / 10 : null,
    confianca: "tripadvisor", gratis: false,
    lat: Number.isFinite(la) ? +la.toFixed(5) : null, lng: Number.isFinite(lo) ? +lo.toFixed(5) : null,
    fonte: "Tripadvisor", tripadvisor_id: String(loc.id),
  };
}
async function taBuscar(key: string, q: string, lang: string, comCatalogo = true): Promise<{ status: number; lista: any[]; api: string; detalhe: string | null }> {
  const loc = lang === "en" ? "&locale=en-US" : "&locale=pt-BR&locale=en-US";
  const cab = { "X-API-Key": key, accept: "application/json" };
  const r = await fetch("https://terra.tripadvisor.com/api/locations/search?version=1&size=5&query=" + encodeURIComponent(q) + loc, { headers: cab });
  if (r.ok) {
    const j = await r.json();
    let lista = (j.data || []).map((d: any) => taLugar(d.location || d, lang)).filter((x: any) => x.nome);
    if (!lista.length && comCatalogo) {
      const c = await fetch("https://terra.tripadvisor.com/api/catalog/locations/search?version=1&size=5&query=" + encodeURIComponent(q) + loc, { headers: cab });
      if (c.ok) { const jc = await c.json(); lista = (jc.data || []).map((d: any) => taLugar(d.location || d, lang)).filter((x: any) => x.nome); }
    }
    return { status: 200, lista, api: "terra", detalhe: null };
  }
  if (r.status !== 401 && r.status !== 403 && r.status !== 404) return { status: r.status, lista: [], api: "terra", detalhe: (await r.text()).slice(0, 200) };
  // reserva: chave da Content API antiga
  const u = "https://api.content.tripadvisor.com/api/v1/location/search?key=" + encodeURIComponent(key) + "&searchQuery=" + encodeURIComponent(q) + "&language=" + (lang === "en" ? "en" : "pt");
  const v = await fetch(u, { headers: { accept: "application/json" } });
  if (!v.ok) return { status: v.status, lista: [], api: "content", detalhe: (await v.text()).slice(0, 200) };
  const jv = await v.json();
  const lista = (jv.data || []).slice(0, 8).map((x: any) => {
    const a = x.address_obj || {}; const cat = x.category?.name || "";
    return { id: "ta-" + x.location_id, nome: x.name, categoria: cat === "restaurant" ? "comer" : cat === "hotel" ? "logistica" : "atracao",
      subcategoria: cat === "restaurant" ? "restaurante" : cat === "hotel" ? "hospedagem" : null, descricao: null,
      endereco: a.address_string || [a.street1, a.city, a.state].filter(Boolean).join(", ") || null, site: null, telefone: null, horario: null,
      reserva: null, preco: null, criancas: null, confianca: "tripadvisor", gratis: false, lat: null, lng: null, fonte: "Tripadvisor", tripadvisor_id: String(x.location_id) };
  }).filter((x: any) => x.nome);
  return { status: 200, lista, api: "content", detalhe: null };
}
async function doTripAdvisor(key: string, q: string, lat: number, lng: number, temCentro: boolean, lang: string) {
  const t = await taBuscar(key, q, lang);
  let lista = t.lista;
  if (temCentro) {
    const d = (x: any) => x.lat == null ? 1e9 : Math.pow((x.lng - lng) * Math.cos(lat * Math.PI / 180), 2) + Math.pow(x.lat - lat, 2);
    const perto = lista.filter((x: any) => d(x) < 1.8 * 1.8);   // ~200 km
    lista = (perto.length ? perto : lista).sort((a: any, b: any) => d(a) - d(b));
  }
  return lista.slice(0, 6);
}
// junta listas sem repetir nome igual
function juntar(a: any[], b: any[]) {
  const vistos = new Set(a.map((x) => String(x.nome).toLowerCase()));
  return a.concat(b.filter((x) => !vistos.has(String(x.nome).toLowerCase())));
}
