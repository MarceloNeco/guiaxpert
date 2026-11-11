// GuiaXpert — conta pelo convite: a pessoa abre o link, digita o código de 6 números e cria a senha.
// A conta nasce confirmada (sem e-mail de confirmação), só para o e-mail que quem convidou indicou.
// POST /functions/v1/convite-conta { token, codigo, senha }
//   → { ok: true, email }            conta criada: o app entra com e-mail + senha e aceita o convite
//   → { existe: true, email }        já há conta com esse e-mail: entrar com a senha ou com o Google
//   → { erro: 'codigo'|'travado'|'convite'|'senha' }
// O código é conferido no banco (guiaxpert_conferir_codigo); 5 erros travam o convite. Nada de senha é guardado aqui.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "", srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !srv) return json({ erro: "servidor" }, 500);
  let b: { token?: string; codigo?: string; senha?: string } = {};
  try { b = await req.json(); } catch (_) { return json({ erro: "pedido" }, 400); }
  const token = String(b.token || ""), codigo = String(b.codigo || ""), senha = String(b.senha || "");
  if (!/^[a-z0-9]{16,40}$/.test(token)) return json({ erro: "convite" }, 400);
  if (senha.length < 8 || senha.length > 72) return json({ erro: "senha" }, 400);
  const cab = { apikey: srv, Authorization: "Bearer " + srv, "Content-Type": "application/json" };

  const r = await fetch(url + "/rest/v1/rpc/guiaxpert_conferir_codigo", { method: "POST", headers: cab, body: JSON.stringify({ p_token: token, p_codigo: codigo }) });
  if (!r.ok) { console.log("convite-conta: conferir falhou", r.status); return json({ erro: "servidor" }, 502); }
  const linhas = await r.json(), x = Array.isArray(linhas) ? linhas[0] : linhas;
  if (!x || !x.ok) return json({ erro: (x && x.motivo) || "convite" }, 400);
  const email = String(x.email);

  const c = await fetch(url + "/auth/v1/admin/users", { method: "POST", headers: cab,
    body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { origem: "convite-guiaxpert" } }) });
  if (c.ok) return json({ ok: true, email });
  const t = await c.text();
  if (c.status === 422 || /already|registered|exists/i.test(t)) return json({ existe: true, email });
  console.log("convite-conta: criar conta falhou", c.status, t.slice(0, 200));
  return json({ erro: "servidor" }, 502);
});
