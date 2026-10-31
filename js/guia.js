/* =====================================================================
   guia.js — o que a chave de IA da pessoa faz no GuiaXpert

   1) Montar opção de roteiro       → Descobrir.roteiroIA (descobrir.js)
   2) Replanejar hoje               → Guia.replanejar: clima + roteiro do dia + gostos
   3) Perguntar ao guia             → Guia.perguntar: conversa presa aos lugares do pacote
   4) Ler e-mail de reserva         → Importar.porIA (importar.js)

   Regras que não mudam: NOMES NUNCA VÃO (só faixa, idade e cuidados); a
   chave fica no cofre comum SolverONE (DGO.ia); tudo que a IA sugere vem
   marcado para conferir. Respostas presas ao pacote: a IA só cita lugares
   da lista, pelo nome exato, para o app virar link no mapa.
   ===================================================================== */
(function () {
  'use strict';

  function pronta() { return !!(window.DGO && DGO.ia && DGO.ia.provedoresProntos && DGO.ia.provedoresProntos().length); }
  function listaLugares(lugares) {
    return (lugares || []).filter(function (l) { return l.categoria !== 'logistica'; }).slice(0, 120).map(function (l) {
      return [l.nome, l.categoria + (l.subcategoria ? '/' + l.subcategoria : ''), l.horario ? 'horário: ' + l.horario : '', l.preco ? 'preço: ' + l.preco : '',
        l.criancas ? 'crianças: ' + l.criancas : '', l.gratis ? 'grátis' : ''].filter(Boolean).join(' | ');
    }).join('\n');
  }
  function textoDia(dia) {
    return (dia && dia.itens || []).map(function (it) { return (it.hora || '--:--') + ' ' + it.titulo + (it.nota ? ' (' + it.nota + ')' : '') + (it.estado === 'confirmado' ? ' [confirmado]' : ''); }).join('\n') || '(dia vazio)';
  }
  function textoClima(c) {
    if (!c) return 'sem previsão';
    return c.min + '°C a ' + c.max + '°C, chance de chuva ' + (c.chuva != null ? c.chuva + '%' : '?') + (c.vento ? ', vento ' + c.vento + ' km/h' : '');
  }
  function json(txt) {
    var i = txt.indexOf('{'), f = txt.lastIndexOf('}');
    if (i < 0 || f < i) throw new Error('ia-formato');
    return JSON.parse(txt.slice(i, f + 1));
  }

  /* ---- "Pedir ao guia para procurar": a IA da pessoa, com busca na web quando o provedor tem ----
     Devolve [{ nome, endereco, cidade, telefone, site, fonte }] (até 3). Nunca vai nome de ninguém. */
  function perguntaLugar(texto, ctx) {
    return 'Procure na internet o lugar "' + texto + '" perto de ' + (ctx.cidade || 'onde a pessoa está') + (ctx.pais ? ', ' + ctx.pais : '') + '.\n' +
      'Pode ser bar, restaurante, pousada, igreja, atração ou loja. Devolva até 3 opções que existam de verdade, com endereço completo.\n' +
      'Responda SÓ com JSON: {"lugares":[{"nome":"…","endereco":"rua, número, bairro","cidade":"…","telefone":"… ou null","site":"… ou null","fonte":"URL de onde tirou ou null"}]}\n' +
      'Se não achar nada confiável, responda {"lugares":[]}. Nunca invente.';
  }
  function extrairLugares(txt) {
    var j; try { j = json(txt); } catch (e) { return []; }
    return (j && Array.isArray(j.lugares) ? j.lugares : []).filter(function (l) { return l && l.nome; }).slice(0, 3).map(function (l) {
      return { nome: String(l.nome).slice(0, 100), endereco: l.endereco ? String(l.endereco).slice(0, 160) : null, cidade: l.cidade ? String(l.cidade).slice(0, 60) : null,
        telefone: l.telefone ? String(l.telefone).slice(0, 30) : null, site: l.site ? String(l.site).slice(0, 200) : null, fonte: l.fonte ? String(l.fonte).slice(0, 300) : null };
    });
  }
  function lerJson(r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.error && (j.error.message || j.error.type)) || ('http-' + r.status)); return j; }); }
  /* chamadas com busca na web, por provedor (o módulo comum não tem ferramentas) */
  var COM_WEB = {
    gemini: function (chave, modelo, pergunta, sistema) {
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo || 'gemini-2.0-flash') + ':generateContent?key=' + encodeURIComponent(chave), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: pergunta }] }], tools: [{ google_search: {} }] })
      }).then(lerJson).then(function (j) {
        var c = j.candidates && j.candidates[0];
        return ((c && c.content && c.content.parts) || []).map(function (p) { return p.text || ''; }).join('');
      });
    },
    anthropic: function (chave, modelo, pergunta, sistema, ctx) {
      var loc = { type: 'approximate', country: ctx.paisCodigo || 'BR' }; if (ctx.cidade) loc.city = ctx.cidade;
      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: modelo || 'claude-3-5-haiku-20241022', max_tokens: 1200, system: sistema, messages: [{ role: 'user', content: pergunta }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: loc }] })
      }).then(lerJson).then(function (j) { return (j.content || []).filter(function (x) { return x.type === 'text'; }).map(function (x) { return x.text; }).join(''); });
    },
    openai: function (chave, modelo, pergunta, sistema) {
      return fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + chave },
        body: JSON.stringify({ model: modelo || 'gpt-4o-mini', instructions: sistema, input: pergunta, tools: [{ type: 'web_search' }] })
      }).then(lerJson).then(function (j) {
        if (j.output_text) return j.output_text;
        var t = []; (j.output || []).forEach(function (o) { (o.content || []).forEach(function (c) { if (c.text) t.push(c.text); }); }); return t.join('');
      });
    },
    groq: function (chave, modelo, pergunta, sistema) {
      return fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + chave },
        body: JSON.stringify({ model: 'groq/compound-mini', messages: [{ role: 'system', content: sistema }, { role: 'user', content: pergunta }] })
      }).then(lerJson).then(function (j) { return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; });
    },
    openrouter: function (chave, modelo, pergunta, sistema) {
      var m = modelo || 'openrouter/free'; if (m.indexOf(':online') < 0) m += ':online';
      return fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + chave, 'HTTP-Referer': location.origin, 'X-Title': 'GuiaXpert' },
        body: JSON.stringify({ model: m, messages: [{ role: 'system', content: sistema }, { role: 'user', content: pergunta }] })
      }).then(lerJson).then(function (j) { return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; });
    }
  };

  var Guia = {
    pronta: pronta,

    /* procura um lugar na internet com a IA da pessoa. ctx: { cidade, pais, paisCodigo, idioma }
       resolve { lugares: [...], comWeb: true|false } */
    procurarLugar: function (texto, ctx) {
      if (!pronta()) return Promise.reject(new Error('sem-ia'));
      if (!navigator.onLine) return Promise.reject(new Error('sem-internet'));
      ctx = ctx || {};
      var sistema = 'Você ajuda uma família a achar um lugar de viagem. Use a busca na web. Responda só JSON.';
      var pergunta = perguntaLugar(texto, ctx);
      var prov = DGO.ia.provedorPara('texto'), chave = DGO.ia.chavePara('texto'), modelo = DGO.ia.modelo(prov);
      if (COM_WEB[prov] && chave) {
        return COM_WEB[prov](chave, modelo, pergunta, sistema, ctx).then(function (txt) { return { lugares: extrairLugares(txt), comWeb: true }; })
          .catch(function () { return DGO.ia.perguntar(pergunta, { contexto: sistema, limite: 1200 }).then(function (txt) { return { lugares: extrairLugares(txt), comWeb: false }; }); });
      }
      return DGO.ia.perguntar(pergunta, { contexto: sistema, limite: 1200 }).then(function (txt) { return { lugares: extrairLugares(txt), comWeb: false }; });
    },

    /* ctx: { viagem, pessoas, pacote, lugares, dia (do roteiro), data, clima, idioma } */
    replanejar: function (ctx) {
      if (!pronta()) return Promise.reject(new Error('sem-ia'));
      var en = ctx.idioma === 'en';
      var pergunta = 'Replaneje o dia ' + ctx.data + ' desta viagem em ' + (ctx.pacote ? ctx.pacote.nome.pt : ctx.viagem.destinoTexto) + '.\n' +
        'Previsão: ' + textoClima(ctx.clima) + '.\n' + Descobrir.resumoGrupo(ctx.viagem, ctx.pessoas) + '\n' +
        'Plano atual do dia:\n' + textoDia(ctx.dia) + '\n' +
        'Itens [confirmado] e horários de voo, carro, check-in e check-out NÃO mudam. Troque só o que o tempo ou o cansaço do grupo pedem; ' +
        'com chuva, prefira lugares cobertos; com criança pequena ou idoso, inclua descanso.\n' +
        'Use só estes lugares (nome exato | tipo | detalhes):\n' + listaLugares(ctx.lugares) + '\n' +
        'Responda SÓ com JSON: {"motivo":"uma frase explicando o que mudou e por quê","itens":[{"hora":"HH:MM","titulo":"…","nota":"…","lugar":"nome exato da lista ou null","mudou":true|false}]}. ' +
        'Frases curtas em ' + (en ? 'inglês' : 'português do Brasil') + '.';
      return DGO.ia.perguntar(pergunta, { contexto: 'Você é um guia de viagem cuidadoso com famílias. Nunca invente lugar, preço ou horário.', limite: 3000 }).then(function (txt) {
        var j = json(txt);
        if (!j || !Array.isArray(j.itens)) throw new Error('ia-formato');
        var porNome = {}; (ctx.lugares || []).forEach(function (l) { porNome[String(l.nome).toLowerCase()] = l.id; });
        return { motivo: String(j.motivo || ''), itens: j.itens.filter(function (it) { return it && it.titulo; }).map(function (it) {
          return { hora: String(it.hora || '').slice(0, 5), titulo: String(it.titulo).slice(0, 100), nota: String(it.nota || '').slice(0, 200),
            lugarId: it.lugar ? (porNome[String(it.lugar).toLowerCase()] || null) : null, mudou: !!it.mudou };
        }) };
      });
    },

    /* conversa presa à viagem; historico = [{papel:'pessoa'|'ia', texto}] */
    perguntar: function (ctx, texto, historico) {
      if (!pronta()) return Promise.reject(new Error('sem-ia'));
      var en = ctx.idioma === 'en';
      var contexto = 'Você é o guia local de uma família em ' + (ctx.pacote ? ctx.pacote.nome.pt : ctx.viagem.destinoTexto) + ' (viagem de ' + ctx.viagem.inicio + ' a ' + ctx.viagem.fim + ').\n' +
        Descobrir.resumoGrupo(ctx.viagem, ctx.pessoas) + '\n' +
        'Plano de hoje (' + ctx.data + '):\n' + textoDia(ctx.dia) + '\nPrevisão de hoje: ' + textoClima(ctx.clima) + '.\n' +
        'Lugares que você conhece (nome exato | tipo | detalhes):\n' + listaLugares(ctx.lugares) + '\n' +
        'Regras: responda curto (até 6 frases), em ' + (en ? 'inglês' : 'português do Brasil') + '. Cite lugares SEMPRE pelo nome exato da lista. ' +
        'Não invente preço, horário nem endereço: se não souber, diga que é bom confirmar. Se a pergunta não for sobre a viagem, responda em uma frase e volte ao assunto.';
      var msgs = (historico || []).slice(-8).concat([{ papel: 'pessoa', texto: texto }]);
      return DGO.ia.perguntar(texto, { contexto: contexto, historico: msgs, limite: 900 }).then(function (r) { return String(r || '').trim(); });
    }
  };

  window.Guia = Guia;
})();
