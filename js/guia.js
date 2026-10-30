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

  var Guia = {
    pronta: pronta,

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
