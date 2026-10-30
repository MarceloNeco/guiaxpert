/* =====================================================================
   VERIFICADOR DE PERMISSÕES DOS SCRIPTS SQL  —  teste/sql-grants.js  (1.0.1, 23/Out/2026)
   ---------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE
   Desde 30/Out/2026 o Supabase não dá mais acesso automático pela Data API a objeto NOVO do schema public
   (tabela, view, função, sequência). Script que cria objeto sem GRANT passa a quebrar o app com
   "42501 permission denied". Regra da diretriz ("Permissões explícitas no Supabase"): todo CREATE em public
   traz, no MESMO arquivo, o GRANT para o mesmo objeto. Este verificador confere isso antes do PR.

   O QUE CONFERE (em cada .sql das pastas passadas)
   - CREATE TABLE / VIEW / MATERIALIZED VIEW  → precisa de GRANT ... ON [TABLE] <nome> (ou ON ALL TABLES IN SCHEMA public)
   - CREATE FUNCTION / PROCEDURE             → precisa de GRANT EXECUTE ON FUNCTION|PROCEDURE|ROUTINE <nome>
                                               (ou ON ALL FUNCTIONS|PROCEDURES|ROUTINES IN SCHEMA public)
   - CREATE SEQUENCE e coluna serial          → precisa de GRANT ... ON SEQUENCE <nome> (ou ON ALL SEQUENCES ...)
     (coluna IDENTITY não precisa: o Postgres não confere permissão na sequência interna dela)
   Só o schema public conta (nome sem schema = public). temp/pg_temp, auth, storage etc. ficam de fora.
   Texto dentro de comentário, de '...' e do corpo $$ ... $$ das funções é ignorado.
   Avisos (não reprovam): tabela sem "enable row level security" e função sem "revoke execute ... from public".

   EXCEÇÕES: teste/sql-grants-legado.json lista os scripts aplicados ANTES de 30/Out/2026 (e os testes locais
   que nunca rodam no Supabase), cada um com o motivo. Arquivo fora da lista tem de passar. A lista não aceita
   entrada nova com data de 30/Out/2026 em diante: script novo nasce com GRANT.

   USO (na pasta raiz do repositório):
       node teste/sql-grants.js <pasta ou arquivo .sql> [mais pastas...]
       node teste/sql-grants.js --legado outro.json <pastas...>
   Saída 0 = tudo certo; 1 = algum script reprovado (a lista diz o que falta). Antes de conferir, roda o
   autoteste embutido (exemplos certos e errados), para o próprio verificador nunca aprovar por engano.

   1.0.1 (23/Out/2026, chat Arquitetura): o autoteste "nome entre aspas" usa public."Tab" — "Public" (maiúsculo, entre
   aspas) é OUTRO schema, e o caso antigo passava pelo motivo errado (ficava fora de public). Novo caso: "Public"."Tab"
   não conta como public.

   ARQUIVO MASTER: mora no rootify-one e vai IGUAL para os outros repositórios (solverone-app, omnilife-one,
   contador-de-historias…). Só a lista de exceção é de cada repositório. Node puro, sem dependências.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const VERSAO = '1.0.1';
const CORTE = '2026-10-30';            /* a partir desta data o Supabase não concede mais nada sozinho */
const RAIZ = path.join(__dirname, '..');

/* ---------- 1. limpar: tira comentários, textos '...' e corpos $tag$...$tag$ (o CREATE de dentro de uma função não conta) ---------- */
function limpar(sql) {
  let s = '', i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i], d = sql[i + 1];
    if (c === '-' && d === '-') { while (i < n && sql[i] !== '\n') i++; s += ' '; continue; }
    if (c === '/' && d === '*') {               /* o Postgres aceita comentário dentro de comentário */
      let nivel = 0;
      do {
        if (sql[i] === '/' && sql[i + 1] === '*') { nivel++; i += 2; }
        else if (sql[i] === '*' && sql[i + 1] === '/') { nivel--; i += 2; }
        else i++;
      } while (i < n && nivel > 0);
      s += ' '; continue;
    }
    if (c === "'") {
      const comBarra = /[eE]$/.test(s) && !/[\w$]$/.test(s.slice(0, -1));   /* E'...' aceita \' */
      i++;
      while (i < n) {
        if (comBarra && sql[i] === '\\') { i += 2; continue; }
        if (sql[i] === "'") { if (sql[i + 1] === "'") { i += 2; continue; } i++; break; }
        i++;
      }
      s += "''"; continue;
    }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64));
      if (m && !/[\w$]$/.test(s)) {
        const fim = sql.indexOf(m[0], i + m[0].length);
        i = fim === -1 ? n : fim + m[0].length;
        s += ' $corpo$ '; continue;
      }
    }
    s += c; i++;
  }
  return s;
}

/* ---------- 2. nomes ---------- */
/* "Public"."Tabela" → public.tabela; nome sem schema = public. Devolve { schema, nome } */
function nomeDe(bruto) {
  const partes = [];
  const re = /"((?:[^"]|"")*)"|([^."\s]+)/g;
  let m;
  while ((m = re.exec(String(bruto).trim()))) partes.push(m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2].toLowerCase());
  if (!partes.length) return null;
  return partes.length === 1 ? { schema: 'public', nome: partes[0] } : { schema: partes[partes.length - 2], nome: partes[partes.length - 1] };
}
/* divide por vírgula fora de parênteses: "f(a, b), g()" → ["f(a, b)", "g()"] */
function dividir(lista) {
  const r = []; let nivel = 0, atual = '';
  for (const c of lista) {
    if (c === '(') nivel++;
    if (c === ')') nivel--;
    if (c === ',' && nivel === 0) { r.push(atual); atual = ''; continue; }
    atual += c;
  }
  if (atual.trim()) r.push(atual);
  return r.map(x => x.trim()).filter(Boolean);
}

/* ---------- 3. analisar um arquivo ---------- */
const NOME = '(?:"(?:[^"]|"")*"|[\\w$]+)(?:\\s*\\.\\s*(?:"(?:[^"]|"")*"|[\\w$]+))?';
const RE_CREATE = new RegExp('^create\\s+(?:or\\s+replace\\s+)?(temp\\s+|temporary\\s+|unlogged\\s+)?(materialized\\s+view|table|view|function|procedure|sequence)\\s+(?:if\\s+not\\s+exists\\s+)?(' + NOME + ')', 'i');
const TIPO = { table: 'tabela', view: 'tabela', 'materialized view': 'tabela', function: 'funcao', procedure: 'funcao', sequence: 'sequencia' };

function analisar(sql) {
  const limpo = limpar(sql);
  const objetos = [], grants = [], revokesPublic = [], rls = new Set(), todos = { tabela: false, funcao: false, sequencia: false };
  const chave = (tipo, o) => tipo + ':' + o.schema + '.' + o.nome;
  for (const bruto of limpo.split(';')) {
    const st = bruto.replace(/\s+/g, ' ').trim();
    if (!st) continue;
    let m = RE_CREATE.exec(st);
    if (m) {
      const temp = m[1] && /^temp/i.test(m[1]);
      const tipoSql = m[2].toLowerCase().replace(/\s+/g, ' ');
      const o = nomeDe(m[3]);
      if (temp || !o || o.schema !== 'public') continue;
      const tipo = TIPO[tipoSql];
      objetos.push({ tipo, tipoSql, schema: o.schema, nome: o.nome, chave: chave(tipo, o) });
      if (tipoSql === 'table') {
        /* coluna serial cria sequência <tabela>_<coluna>_seq, que precisa de USAGE para inserir */
        const reSerial = /(?:\(|,)\s*("(?:[^"]|"")*"|[\w$]+)\s+(?:small|big)?serial\b/gi;
        let s;
        while ((s = reSerial.exec(st))) {
          const col = nomeDe(s[1]).nome;
          const seq = { schema: 'public', nome: o.nome + '_' + col + '_seq' };
          objetos.push({ tipo: 'sequencia', tipoSql: 'serial de ' + o.nome, schema: 'public', nome: seq.nome, chave: chave('sequencia', seq) });
        }
      }
      continue;
    }
    m = /^alter table (?:if exists )?(?:only )?(\S+) enable row level security/i.exec(st);
    if (m) { const o = nomeDe(m[1]); if (o) rls.add(o.schema + '.' + o.nome); continue; }
    m = /^(grant|revoke)\s+(?:grant option for\s+)?(.+?)\s+on\s+(.+?)\s+(to|from)\s+(.+)$/i.exec(st);
    if (!m) continue;
    const ehGrant = m[1].toLowerCase() === 'grant';
    const alvo = m[3].trim();
    const papeis = m[5].toLowerCase().split(',').map(x => x.replace(/\b(with grant option|granted by .*|cascade|restrict)\b/g, '').trim()).filter(Boolean);
    let a = /^all\s+(tables|sequences|functions|procedures|routines)\s+in\s+schema\s+(.+)$/i.exec(alvo);
    if (a) {
      const esquemas = a[2].split(',').map(x => nomeDe(x).nome);
      if (ehGrant && esquemas.indexOf('public') !== -1) todos[{ tables: 'tabela', sequences: 'sequencia' }[a[1].toLowerCase()] || 'funcao'] = true;
      continue;
    }
    a = /^(table|sequence|function|procedure|routine|schema|database|type|domain|language|foreign\s+\w+|large\s+object|tablespace)?\s*(.+)$/i.exec(alvo);
    const kw = (a[1] || 'table').toLowerCase();
    if (!/^(table|sequence|function|procedure|routine)$/.test(kw)) continue;
    const tipo = kw === 'table' ? 'tabela' : kw === 'sequence' ? 'sequencia' : 'funcao';
    for (const item of dividir(a[2])) {
      const o = nomeDe(item.split('(')[0]);
      if (!o) continue;
      if (ehGrant) {
        grants.push({ chave: chave(tipo, o), papeis });
        if (tipo === 'tabela') grants.push({ chave: chave('sequencia', o), papeis });   /* GRANT ... ON seq (sem a palavra SEQUENCE) também vale */
      } else if (tipo === 'funcao' && papeis.indexOf('public') !== -1) revokesPublic.push(chave(tipo, o));
    }
  }
  const faltam = [], avisos = [];
  const visto = new Set();
  for (const o of objetos) {
    if (visto.has(o.chave + o.tipoSql)) continue;
    visto.add(o.chave + o.tipoSql);
    const temGrant = todos[o.tipo] || grants.some(g => g.chave === o.chave);
    if (!temGrant) faltam.push(o);
    if (o.tipoSql === 'table' && !rls.has(o.schema + '.' + o.nome)) avisos.push('tabela ' + o.nome + ' sem "enable row level security" neste arquivo');
    if (o.tipo === 'funcao' && revokesPublic.indexOf(o.chave) === -1) avisos.push('função ' + o.nome + ' sem "revoke execute ... from public" neste arquivo');
  }
  return { objetos, faltam, avisos: Array.from(new Set(avisos)) };
}

/* ---------- 4. autoteste: exemplos certos e errados (o verificador nunca aprova por engano) ---------- */
function autoteste() {
  const casos = [
    ['tabela sem grant reprova', 'create table public.a (id uuid);', 1],
    ['tabela com grant passa', 'create table if not exists a (id uuid);\ngrant select on public.a to anon;', 0],
    ['grant em lista com várias tabelas', 'create table a (x int); create table b (x int); grant select, insert on table a, public.b to authenticated;', 0],
    ['grant de outra tabela não vale', 'create table a (x int); grant select on b to anon;', 1],
    ['função sem grant reprova', 'create or replace function public.f(p uuid) returns int language sql as $$ select 1 $$;', 1],
    ['função com revoke + grant passa', 'create function f(p uuid, q text) returns int language sql as $$ select 1 $$;\nrevoke execute on function public.f(uuid, text) from public;\ngrant execute on function public.f(uuid, text) to authenticated;', 0],
    ['create dentro do corpo $$ não conta', 'create function g() returns void language plpgsql as $f$ begin create table x (i int); end $f$; grant execute on function g() to service_role;', 0],
    ['create em comentário não conta', '-- create table zz (i int);\n/* create function y() */ select 1;', 0],
    ['create em texto não conta', "select 'create table q (i int);';", 0],
    ['schema auth e temp ficam de fora', 'create table auth.users (id uuid); create temp table t (i int); create function pg_temp.ok() returns void language sql as $$ $$;', 0],
    ['serial pede grant na sequência', 'create table c (id bigserial primary key); grant all on c to service_role;', 1],
    ['serial com grant na sequência passa', 'create table c (id serial primary key); grant all on c to service_role; grant usage, select on sequence c_id_seq to service_role;', 0],
    ['identity não pede grant na sequência', 'create table d (id bigint generated always as identity primary key); grant select on d to anon;', 0],
    ['create sequence sem grant reprova', 'create sequence s1;', 1],
    ['grant on all tables in schema public cobre', 'create table e (i int); grant select on all tables in schema public to service_role;', 0],
    ['view sem grant reprova', 'create or replace view v as select 1;', 1],
    ['nome entre aspas', 'create table public."Tab" (i int); grant select on public."Tab" to anon;', 0],
    ['nome entre aspas sem grant reprova', 'create table public."Tab" (i int); grant select on public.tab to anon;', 1],
    ['"Public" entre aspas é outro schema', 'create table "Public"."Tab" (i int);', 0],
    ['revoke sozinho não basta', 'create function h() returns int language sql as $$ select 1 $$; revoke execute on function h() from public;', 1]
  ];
  const erros = [];
  casos.forEach(([nome, sql, esperado]) => { const r = analisar(sql); if (r.faltam.length !== esperado) erros.push(nome + ' (faltam ' + r.faltam.length + ', esperado ' + esperado + ')'); });
  const r = analisar('create table t1 (i int); grant select on t1 to anon; create function f1() returns int language sql as $$ select 1 $$; grant execute on function f1() to anon;');
  if (!r.avisos.some(a => /t1 sem "enable row level security"/.test(a)) || !r.avisos.some(a => /f1 sem "revoke execute/.test(a))) erros.push('avisos de RLS e de revoke from public');
  return { total: casos.length + 1, erros };
}

/* ---------- 5. rodar ---------- */
function listarSql(alvo) {
  const p = path.resolve(RAIZ, alvo);
  if (!fs.existsSync(p)) return [];
  if (fs.statSync(p).isFile()) return /\.sql$/i.test(p) ? [p] : [];
  return fs.readdirSync(p).sort().map(f => path.join(p, f)).filter(f => fs.statSync(f).isFile() && /\.sql$/i.test(f));
}
function relativo(p) { return path.relative(RAIZ, p).split(path.sep).join('/'); }

function principal(args) {
  let legadoArq = path.join(__dirname, 'sql-grants-legado.json');
  const pastas = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--legado') { legadoArq = path.resolve(RAIZ, args[++i] || ''); continue; }
    pastas.push(args[i]);
  }
  const at = autoteste();
  if (at.erros.length) { console.log('FALHOU o autoteste do verificador ' + VERSAO + ':\n - ' + at.erros.join('\n - ')); return 1; }
  console.log('  ✓ autoteste do verificador ' + VERSAO + ': ' + at.total + ' exemplos certos e errados');
  if (!pastas.length) { console.log('Diga as pastas: node teste/sql-grants.js <pasta> [mais pastas]'); return 1; }

  const falhas = [];
  let legado = { arquivos: [] };
  if (fs.existsSync(legadoArq)) {
    try { legado = JSON.parse(fs.readFileSync(legadoArq, 'utf8')); }
    catch (e) { console.log('FALHOU: ' + relativo(legadoArq) + ' não é um JSON válido (' + e.message + ')'); return 1; }
  }
  const excecao = new Map();
  (legado.arquivos || []).forEach(x => {
    if (!x || !x.arquivo || !x.motivo) { falhas.push('lista de exceção: toda entrada precisa de "arquivo" e "motivo"'); return; }
    if (!x.data || !/^\d{4}-\d{2}-\d{2}$/.test(x.data)) { falhas.push('lista de exceção: ' + x.arquivo + ' sem "data" (aaaa-mm-dd)'); return; }
    if (x.data >= CORTE) { falhas.push('lista de exceção: ' + x.arquivo + ' tem data ' + x.data + ' — script de 30/Out/2026 em diante não entra na lista, nasce com GRANT'); return; }
    excecao.set(x.arquivo, x);
  });

  const arquivos = [];
  pastas.forEach(p => { const l = listarSql(p); if (!l.length) console.log('  · ' + p + ': nenhum .sql'); l.forEach(f => arquivos.push(f)); });
  let ok = 0, legados = 0;
  for (const f of arquivos) {
    const rel = relativo(f);
    const r = analisar(fs.readFileSync(f, 'utf8'));
    const ex = excecao.get(rel);
    if (ex) {
      legados++;
      console.log('  ↷ ' + rel + ' — exceção (' + ex.data + '): ' + ex.motivo + (r.faltam.length ? ' · ' + r.faltam.length + ' objeto(s) sem GRANT no arquivo' : ''));
      continue;
    }
    if (r.faltam.length) {
      falhas.push(rel + ': ' + r.faltam.length + ' objeto(s) sem GRANT no mesmo arquivo — ' + r.faltam.map(o => o.tipoSql + ' ' + o.nome).join(', '));
      continue;
    }
    ok++;
    console.log('  ✓ ' + rel + ': ' + r.objetos.length + ' objeto(s) em public, todos com GRANT');
    r.avisos.forEach(a => console.log('      aviso: ' + a));
  }
  excecao.forEach((x, arq) => { if (!arquivos.some(f => relativo(f) === arq)) console.log('  aviso: a lista de exceção cita ' + arq + ', que não está nas pastas conferidas'); });
  if (falhas.length) { console.log('\nFALHOU:\n - ' + falhas.join('\n - ') + '\n\nComo resolver: ponha, no mesmo arquivo e logo abaixo de cada CREATE, o GRANT por papel (ver a diretriz "Permissões explícitas no Supabase").'); return 1; }
  console.log('OK: ' + ok + ' script(s) com GRANT explícito' + (legados ? ', ' + legados + ' na lista de exceção' : '') + '.');
  return 0;
}

if (require.main === module) process.exit(principal(process.argv.slice(2)));
module.exports = { VERSAO, limpar, analisar, autoteste };
