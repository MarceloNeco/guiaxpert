// GuiaXpert — estado do voo (dono, 22/Nov/2026): três serviços, um cobrindo o outro.
// GET /functions/v1/voo-status?voo=G31287&data=2026-11-22   → { status, partida, chegada, fonte }
// GET /functions/v1/voo-status?teste=airlabs                → { ok } (tela Chaves do serviço)
// Ordem: AirLabs → AviationStack → AeroDataBox. Sem chave, erro, cota esgotada ou sem dado para a data → o próximo.
// Chaves no Vault (AIRLABS_KEY, AVIATIONSTACK_KEY, AERODATABOX_KEY), lidas só aqui; o celular nunca vê.
// Memória curta em guiaxpert_voo_cache (mesmo voo para a família = uma consulta). Nada de nome de pessoa sai daqui.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_SB = Deno.env.get("SUPABASE_URL")!, SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";

const cacheChaves = new Map<string, { v: string; ate: number }>();
async function chave(nome: string): Promise<string> {
  const c = cacheChaves.get(nome); if (c && c.ate > Date.now()) return c.v;
  let v = "";
  try {
    const r = await fetch(URL_SB + "/rest/v1/rpc/chave_servico", { method: "POST", headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json" }, body: JSON.stringify({ p_nome: nome }) });
    if (r.ok) { const j = await r.json(); if (typeof j === "string") v = j; }
  } catch (_) { /* sem chave */ }
  if (!v) v = Deno.env.get(nome) || "";
  cacheChaves.set(nome, { v, ate: Date.now() + (v ? 60_000 : 15_000) });
  return v;
}
// Voo é informação pública (dono, 22/Nov/2026): qualquer pessoa LOGADA no app pode consultar (não precisa ser da equipe).
// A cota grátis fica protegida pela memória curta e por um limite de consultas novas por pessoa por dia.
const LIMITE_DIA = 40;
const cacheUser = new Map<string, { id: string; ate: number }>();
async function quem(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || ""; if (!auth.startsWith("Bearer ")) return null;
  const c = cacheUser.get(auth); if (c && c.ate > Date.now()) return c.id;
  try {
    const r = await fetch(URL_SB + "/auth/v1/user", { headers: { apikey: ANON, Authorization: auth } });
    if (!r.ok) return null; const u = await r.json(); if (!u || !u.id) return null;
    cacheUser.set(auth, { id: u.id, ate: Date.now() + 300_000 }); return u.id;
  } catch (_) { return null; }
}
async function dentroDoLimite(uid: string): Promise<boolean> {
  try {
    const r = await fetch(URL_SB + "/rest/v1/rpc/guiaxpert_voo_contar", { method: "POST", headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json" }, body: JSON.stringify({ p_user: uid, p_limite: LIMITE_DIA }) });
    return !r.ok || (await r.json()) !== false;
  } catch (_) { return true; }
}
async function comPrazo(u: string, op: RequestInit = {}, ms = 9000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(u, { ...op, signal: ctl.signal }); } finally { clearTimeout(t); }
}

type Mov = { prevista?: string | null; estimada?: string | null; real?: string | null; atraso?: number | null; portao?: string | null; terminal?: string | null; aeroporto?: string | null };
type Estado = { status: string; partida: Mov; chegada: Mov; fonte: string };
// "2026-11-22 20:15", "2026-11-22T20:15:00+00:00", "2026-11-22 20:15-03:00" → "2026-11-22T20:15" (hora do aeroporto)
const hl = (s: unknown) => { const m = /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(s || "")); return m ? m[1] + "T" + m[2] : null; };
const min = (a: string | null, b: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : null);

// ---- 1. AirLabs: /flight devolve o voo mais próximo (sem data) → só vale se o dia bate ----
async function airlabs(voo: string, data: string): Promise<Estado | null> {
  const k = await chave("AIRLABS_KEY"); if (!k) return null;
  const r = await comPrazo("https://airlabs.co/api/v9/flight?flight_iata=" + encodeURIComponent(voo) + "&api_key=" + encodeURIComponent(k));
  const j = await r.json().catch(() => null); if (!r.ok || !j || j.error) throw new Error("airlabs:" + (j?.error?.code || r.status));
  const f = j.response; if (!f || !String(f.dep_time || "").startsWith(data)) return null;   // chave boa, mas sem esse voo nesse dia
  const st = String(f.status || "").toLowerCase();
  return { fonte: "AirLabs", status: st === "en-route" || st === "active" ? "voando" : st === "landed" ? "pousou" : st === "cancelled" ? "cancelado" : "programado",
    partida: { aeroporto: f.dep_iata, prevista: hl(f.dep_time), estimada: hl(f.dep_estimated), real: hl(f.dep_actual), atraso: f.dep_delayed ?? null, portao: f.dep_gate ?? null, terminal: f.dep_terminal ?? null },
    chegada: { aeroporto: f.arr_iata, prevista: hl(f.arr_time), estimada: hl(f.arr_estimated), real: hl(f.arr_actual), atraso: f.arr_delayed ?? null, portao: f.arr_gate ?? null, terminal: f.arr_terminal ?? null } };
}
// ---- 2. AviationStack: /flights?flight_iata= (voos de hoje/recentes no plano grátis) ----
async function aviationstack(voo: string, data: string): Promise<Estado | null> {
  const k = await chave("AVIATIONSTACK_KEY"); if (!k) return null;
  const r = await comPrazo("https://api.aviationstack.com/v1/flights?access_key=" + encodeURIComponent(k) + "&flight_iata=" + encodeURIComponent(voo));
  const j = await r.json().catch(() => null); if (!r.ok || !j || j.error) throw new Error("aviationstack:" + (j?.error?.code || r.status));
  const lista: any[] = j.data || j.results || []; const f = lista.find((x) => x.flight_date === data) || lista.find((x) => String(x?.departure?.scheduled || "").startsWith(data));
  if (!f) return null;
  const st = String(f.flight_status || "").toLowerCase(), d = f.departure || {}, a = f.arrival || {};
  return { fonte: "aviationstack", status: st === "active" ? "voando" : st === "landed" ? "pousou" : st === "cancelled" ? "cancelado" : st === "diverted" ? "desviado" : "programado",
    partida: { aeroporto: d.iata, prevista: hl(d.scheduled), estimada: hl(d.estimated), real: hl(d.actual), atraso: d.delay ?? null, portao: d.gate ?? null, terminal: d.terminal ?? null },
    chegada: { aeroporto: a.iata, prevista: hl(a.scheduled), estimada: hl(a.estimated), real: hl(a.actual), atraso: a.delay ?? null, portao: a.gate ?? null, terminal: a.terminal ?? null } };
}
// ---- 3. AeroDataBox (RapidAPI): /flights/number/{voo}/{data}; atraso = previsto revisado − programado ----
async function aerodatabox(voo: string, data: string): Promise<Estado | null> {
  const k = await chave("AERODATABOX_KEY"); if (!k) return null;
  const r = await comPrazo("https://aerodatabox.p.rapidapi.com/flights/number/" + encodeURIComponent(voo) + "/" + data + "?withAircraftImage=false&withLocation=false",
    { headers: { "X-RapidAPI-Key": k, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" } });
  if (r.status === 204 || r.status === 404) return null;   // chave boa, voo não encontrado
  const j = await r.json().catch(() => null); if (!r.ok || !j) throw new Error("aerodatabox:" + r.status);
  const f = (Array.isArray(j) ? j : [j])[0]; if (!f) return null;
  const st = String(f.status || ""), d = f.departure || {}, a = f.arrival || {};
  const t = (m: any, campo: string) => { const x = m[campo]; return hl(x && typeof x === "object" ? x.local : x || m[campo + "Local"]); };
  const tu = (m: any, campo: string) => { const x = m[campo]; return x && typeof x === "object" ? x.utc : null; };
  const atrasoD = min(tu(d, "scheduledTime"), tu(d, "revisedTime")), atrasoA = min(tu(a, "scheduledTime"), tu(a, "revisedTime"));
  const status = /EnRoute|Departed|Approaching/.test(st) ? "voando" : /Arrived/.test(st) ? "pousou" : /Canceled/.test(st) ? "cancelado" : /Diverted/.test(st) ? "desviado" : /Boarding|GateClosed/.test(st) ? "embarque" : "programado";
  return { fonte: "AeroDataBox", status,
    partida: { aeroporto: d.airport?.iata, prevista: t(d, "scheduledTime"), estimada: t(d, "revisedTime") || t(d, "predictedTime"), real: /Departed|EnRoute|Approaching|Arrived/.test(st) ? t(d, "revisedTime") : null, atraso: atrasoD, portao: d.gate ?? null, terminal: d.terminal ?? null },
    chegada: { aeroporto: a.airport?.iata, prevista: t(a, "scheduledTime"), estimada: t(a, "revisedTime") || t(a, "predictedTime"), real: /Arrived/.test(st) ? t(a, "revisedTime") : null, atraso: atrasoA, portao: a.gate ?? null, terminal: a.terminal ?? null } };
}
const SERVICOS: Record<string, (v: string, d: string) => Promise<Estado | null>> = { airlabs, aviationstack, aerodatabox };

async function cacheLer(k: string) {
  const r = await fetch(URL_SB + "/rest/v1/guiaxpert_voo_cache?chave=eq." + encodeURIComponent(k) + "&select=dados,em", { headers: { apikey: SRV, Authorization: "Bearer " + SRV } });
  const j = r.ok ? await r.json() : []; return j[0] || null;
}
async function cacheGravar(k: string, dados: Estado) {
  await fetch(URL_SB + "/rest/v1/guiaxpert_voo_cache", { method: "POST", headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ chave: k, dados, fonte: dados.fonte, em: new Date().toISOString() }) }).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const uid = await quem(req);
  if (!uid) return json({ erro: "sem-acesso" }, 403);
  const u = new URL(req.url);
  const teste = u.searchParams.get("teste");
  if (teste) {   // a tela de chaves pergunta: o serviço aceitou a chave?
    const nome = teste === "airlabs" ? "AIRLABS_KEY" : teste === "aviationstack" ? "AVIATIONSTACK_KEY" : teste === "aerodatabox" ? "AERODATABOX_KEY" : "";
    if (!nome || !SERVICOS[teste]) return json({ ok: false, erro: "servico" }, 400);
    if (!(await chave(nome))) return json({ ok: false, erro: "sem-chave" });
    try { await SERVICOS[teste]("G31287", new Date().toISOString().slice(0, 10)); return json({ ok: true }); }
    catch (e) { return json({ ok: false, erro: "recusou", detalhe: String(e).slice(0, 200) }); }
  }
  const voo = (u.searchParams.get("voo") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const data = (u.searchParams.get("data") || "").slice(0, 10);
  if (!/^[A-Z0-9]{2}\d{1,4}$/.test(voo) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return json({ erro: "parametros" }, 400);
  const k = voo + "|" + data;
  // memória: 5 min perto do voo, 30 min longe
  const c = await cacheLer(k).catch(() => null);
  if (c) {
    const idade = Date.now() - Date.parse(c.em), saida = Date.parse((c.dados?.partida?.estimada || c.dados?.partida?.prevista || data + "T12:00") + ":00-03:00");
    const perto = Math.abs(saida - Date.now()) < 6 * 3600_000;
    if (idade < (perto ? 5 : 30) * 60_000) return json({ ...c.dados, cache: true });
  }
  // nenhuma chave cadastrada ainda: avisa (o app mostra o aviso só para o dono)
  if (!(await Promise.all(["AIRLABS_KEY", "AVIATIONSTACK_KEY", "AERODATABOX_KEY"].map(chave))).some(Boolean)) return json({ erro: "sem-chave" }, 503);
  if (!(await dentroDoLimite(uid))) return c ? json({ ...c.dados, cache: true, velho: true }) : json({ erro: "limite" }, 429);
  const falhas: string[] = [];
  for (const nome of ["airlabs", "aviationstack", "aerodatabox"]) {
    try {
      const r = await SERVICOS[nome](voo, data);
      if (r && r.status) { await cacheGravar(k, r); return json(r); }
      falhas.push(nome + ":sem-dado");
    } catch (e) { falhas.push(String(e).slice(0, 80)); }
  }
  if (c) return json({ ...c.dados, cache: true, velho: true });
  return json({ erro: "sem-dado", falhas }, 404);
});
