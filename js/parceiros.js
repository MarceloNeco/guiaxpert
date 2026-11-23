/* =====================================================================
   parceiros.js — GuiaXpert · hub de parceiros, camada 1 (dono, 23/Nov/2026)
   "Não é concorrer com Decolar, Booking, TripAdvisor: é ser um hub." Aqui só montamos LINKS com a busca já
   preenchida (destino, datas, pessoas) nos sites consolidados. Sem chave, sem custo, nada pessoal sai do app
   (só o que vai no próprio link: cidade, datas e quantas pessoas). Camadas 2–4 (afiliado, API, volta da compra):
   docs/ROADMAP.md, planilha #50, com regra zero por parceiro.
   Global: window.Parceiros
   ===================================================================== */
(function () {
  'use strict';
  var e = encodeURIComponent;
  /* código IATA de CIDADE (vale para todos os aeroportos dela) das cidades de onde se sai */
  var IATA_CIDADE = { sp: 'SAO', rio: 'RIO', bh: 'BHZ', bsb: 'BSB', poa: 'POA', cwb: 'CWB', fln: 'FLN', cps: 'VCP', ssa: 'SSA', rec: 'REC', 'for': 'FOR',
    gyn: 'GYN', cgr: 'CGR', cgb: 'CGB', vix: 'VIX', nat: 'NAT', bel: 'BEL', mao: 'MAO' };

  /* c = { destino:'Maceió', uf:'AL', iataDestino:'MCZ', origem:{id,nome}, inicio:'2027-02-06', fim:'2027-02-10', adultos:2, idades:[9], lat, lng }
     → [{ id:'voo', itens:[{ nome, url }] }, ...] */
  function links(c) {
    var dest = c.destino + (c.uf ? ', ' + c.uf : ''), ad = Math.max(1, c.adultos || 2), idades = c.idades || [], cr = idades.length;
    var ida = c.inicio || '', volta = c.fim || '', orig = c.origem && c.origem.nome, iataO = c.origem && IATA_CIDADE[c.origem.id];
    var g = [];
    /* VOO */
    var voo = [];
    if (orig) voo.push({ nome: 'Google Voos', url: 'https://www.google.com/travel/flights?q=' + e('voos de ' + orig + ' para ' + (c.iataDestino || c.destino) + (ida ? ' em ' + ida : '') + (volta ? ' volta ' + volta : '')) });
    else voo.push({ nome: 'Google Voos', url: 'https://www.google.com/travel/flights?q=' + e('voos para ' + (c.iataDestino || c.destino) + (ida ? ' em ' + ida : '')) });
    if (iataO && c.iataDestino && ida && volta) voo.push({ nome: 'Decolar', url: 'https://www.decolar.com/shop/flights/results/roundtrip/' + iataO + '/' + c.iataDestino + '/' + ida + '/' + volta + '/' + ad + '/' + idades.filter(function (x) { return x >= 2; }).length + '/' + idades.filter(function (x) { return x < 2; }).length });
    else voo.push({ nome: 'Decolar', url: 'https://www.decolar.com/passagens-aereas/' });
    g.push({ id: 'voo', itens: voo });
    /* HOSPEDAGEM */
    var bk = 'https://www.booking.com/searchresults.pt-br.html?ss=' + e(dest) + (ida ? '&checkin=' + ida : '') + (volta ? '&checkout=' + volta : '') + '&group_adults=' + ad + '&group_children=' + cr + '&no_rooms=1' +
      idades.map(function (x) { return '&age=' + Math.min(17, Math.max(0, x)); }).join('');
    var ab = 'https://www.airbnb.com.br/s/' + e(dest.replace(/,\s*/g, '--').replace(/\s+/g, '-')) + '/homes?' + (ida ? 'checkin=' + ida + '&' : '') + (volta ? 'checkout=' + volta + '&' : '') + 'adults=' + ad + (cr ? '&children=' + cr : '');
    g.push({ id: 'hotel', itens: [{ nome: 'Booking', url: bk }, { nome: 'Airbnb', url: ab }, { nome: 'Decolar', url: 'https://www.decolar.com/hoteis/' }] });
    /* PASSEIOS */
    g.push({ id: 'passeios', itens: [
      { nome: 'GetYourGuide', url: 'https://www.getyourguide.com.br/s/?q=' + e(c.destino) + (ida ? '&date_from=' + ida : '') + (volta ? '&date_to=' + volta : '') },
      { nome: 'Viator', url: 'https://www.viator.com/pt-BR/searchResults/all?text=' + e(c.destino) },
      { nome: 'Tripadvisor', url: 'https://www.tripadvisor.com.br/Search?q=' + e(dest) }] });
    /* COMO CHEGAR (ônibus, carro, traslado) */
    var chegar = [];
    if (orig) chegar.push({ nome: 'Rome2Rio', url: 'https://www.rome2rio.com/pt/map/' + e(orig.replace(/\s+/g, '-')) + '/' + e(c.destino.replace(/\s+/g, '-')) });
    if (orig || c.lat != null) chegar.push({ nome: 'Google Maps', url: 'https://www.google.com/maps/dir/?api=1' + (orig ? '&origin=' + e(orig) : '') + '&destination=' + (c.lat != null ? c.lat + ',' + c.lng : e(dest)) + '&travelmode=driving' });
    chegar.push({ nome: 'ClickBus', url: 'https://www.clickbus.com.br/' });
    g.push({ id: 'chegar', itens: chegar });
    return g;
  }
  window.Parceiros = { links: links, IATA_CIDADE: IATA_CIDADE };
})();
