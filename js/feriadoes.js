/* =====================================================================
   feriadoes.js — GuiaXpert · Assistente de feriadões (dono, 22/Nov/2026; backlog #49)
   Sem IA: (1) feriadões do ano calculados aqui (nacionais + Páscoa), (2) destinos de uma
   lista curada, (3) clima médio do mês pelo Open-Meteo (dados abertos, sem chave; escolha
   do dono em 23/Nov/2026), (4) nota por perfil, distância e clima.
   Global: window.Feriadoes
   ===================================================================== */
(function () {
  'use strict';

  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dia(a, m, d) { return new Date(a, m - 1, d, 12); }
  function soma(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  /* Páscoa (algoritmo de Meeus/Jones/Butcher) */
  function pascoa(a) {
    var b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    var i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4, m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    var mes = Math.floor((i + m - 7 * n + 114) / 31), di = ((i + m - 7 * n + 114) % 31) + 1;
    return dia(a, mes, di);
  }
  /* feriados nacionais (Lei 662/1949, 6.802/1980, 14.759/2023) + Carnaval, Sexta Santa e Corpus Christi (datas móveis) */
  function feriados(a) {
    var p = pascoa(a);
    return [
      { id: 'anonovo', d: dia(a, 1, 1), pt: 'Ano-Novo', en: "New Year's Day" },
      { id: 'carnaval', d: soma(p, -47), pt: 'Carnaval', en: 'Carnival' },
      { id: 'sexta', d: soma(p, -2), pt: 'Sexta-feira Santa', en: 'Good Friday' },
      { id: 'tiradentes', d: dia(a, 4, 21), pt: 'Tiradentes', en: 'Tiradentes Day' },
      { id: 'trabalho', d: dia(a, 5, 1), pt: 'Dia do Trabalho', en: 'Labor Day' },
      { id: 'corpus', d: soma(p, 60), pt: 'Corpus Christi', en: 'Corpus Christi' },
      { id: 'independencia', d: dia(a, 9, 7), pt: 'Independência', en: 'Independence Day' },
      { id: 'aparecida', d: dia(a, 10, 12), pt: 'Nossa Senhora Aparecida', en: 'Our Lady of Aparecida' },
      { id: 'finados', d: dia(a, 11, 2), pt: 'Finados', en: "All Souls' Day" },
      { id: 'republica', d: dia(a, 11, 15), pt: 'Proclamação da República', en: 'Republic Day' },
      { id: 'consciencia', d: dia(a, 11, 20), pt: 'Consciência Negra', en: 'Black Awareness Day' },
      { id: 'natal', d: dia(a, 12, 25), pt: 'Natal', en: 'Christmas' }
    ];
  }
  /* feriadão = feriado + fim de semana; ponte = dia útil que precisa de folga para emendar.
     op (opcional) = calendário de quem viaja: nacionais + estaduais + municipais + os seus. Feriadões que se encostam viram um só. */
  function feriadoes(a, op) {
    var todos = feriados(a).map(function (f) { f.nivel = 'nacional'; return f; });
    locais(op).filter(function (x) { return x.ligado; }).forEach(function (x) {
      var p = x.mmdd.split('-'); todos.push({ id: x.id, d: dia(a, +p[0], +p[1]), pt: x.pt, en: x.en, nivel: x.nivel });
    });
    var folga = {};   /* dias que já são feriado (para não contar ponte em cima de outro feriado) */
    todos.forEach(function (f) { folga[iso(f.d)] = 1; });
    var lista = [];
    todos.forEach(function (f) {
      var dw = f.d.getDay(), ini = null, fim = null, pontes = 0;
      if (f.id === 'carnaval') { ini = soma(f.d, -3); fim = soma(f.d, 1); }          /* sábado a quarta de Cinzas */
      else if (dw === 5) { ini = f.d; fim = soma(f.d, 2); }                           /* sexta: sex–dom */
      else if (dw === 1) { ini = soma(f.d, -2); fim = f.d; }                          /* segunda: sáb–seg */
      else if (dw === 2) { ini = soma(f.d, -3); fim = f.d; pontes = folga[iso(soma(f.d, -1))] ? 0 : 1; }   /* terça: ponte na segunda */
      else if (dw === 4) { ini = f.d; fim = soma(f.d, 3); pontes = folga[iso(soma(f.d, 1))] ? 0 : 1; }     /* quinta: ponte na sexta */
      else if (dw === 3) { ini = f.d; fim = soma(f.d, 4); pontes = (folga[iso(soma(f.d, 1))] ? 0 : 1) + (folga[iso(soma(f.d, 2))] ? 0 : 1); }
      if (!ini) return;
      lista.push({ id: f.id + '-' + a, feriado: f.id, pt: f.pt, en: f.en, nivel: f.nivel, niveis: [f.nivel], data: iso(f.d), ini: ini, fimD: fim, pontes: pontes, carnaval: f.id === 'carnaval' });
    });
    lista.sort(function (x, y) { return x.ini - y.ini; });
    /* junta os que se encostam (ex.: quinta 9/jul em SP + fim de semana com outro feriado) */
    var junto = [];
    lista.forEach(function (x) {
      var u = junto[junto.length - 1];
      if (u && x.ini <= soma(u.fimD, 1)) {
        if (x.fimD > u.fimD) u.fimD = x.fimD;
        u.pt += ' + ' + x.pt; u.en += ' + ' + x.en; u.pontes = Math.max(u.pontes, x.pontes); u.niveis.push(x.nivel); u.carnaval = u.carnaval || x.carnaval;
      } else junto.push(x);
    });
    return junto.map(function (x) {
      return { id: x.id, feriado: x.feriado, pt: x.pt, en: x.en, nivel: x.niveis.indexOf('nacional') > -1 ? 'nacional' : x.niveis[0], data: x.data,
        inicio: iso(x.ini), fim: iso(x.fimD), dias: Math.round((x.fimD - x.ini) / 86400000) + 1, pontes: x.pontes, carnaval: x.carnaval };
    });
  }

  /* ---- destinos (lista curada; coordenadas do centro; tags: praia, serra, frio, natureza, cidade, historia, parques, termas, vinho)
     infantil: 0 nada especial · 1 bom · 2 feito para crianças · ai: tem resorts all inclusive · iata: aeroporto mais usado ---- */
  var DESTINOS = [
    { id: 'gramado', nome: 'Gramado e Canela', uf: 'RS', lat: -29.379, lng: -50.874, tags: ['serra', 'frio', 'natureza'], infantil: 2, ai: false, iata: 'POA', pacote: 'gramado', pt: 'Serra gaúcha, chocolate, parques e clima europeu.', en: 'Highland towns, chocolate, parks and cool weather.' },
    { id: 'bonito', nome: 'Bonito', uf: 'MS', lat: -21.127, lng: -56.482, tags: ['natureza'], infantil: 2, ai: false, iata: 'BYO', pacote: 'bonito', pt: 'Rios de água cristalina, flutuação e grutas.', en: 'Crystal-clear rivers, snorkeling and caves.' },
    { id: 'bento', nome: 'Bento Gonçalves', uf: 'RS', lat: -29.171, lng: -51.519, tags: ['serra', 'frio', 'vinho'], infantil: 0, ai: false, iata: 'POA', pt: 'Vale dos Vinhedos, vinícolas e Maria Fumaça.', en: 'Wine valley, wineries and steam train.' },
    { id: 'camposjordao', nome: 'Campos do Jordão', uf: 'SP', lat: -22.739, lng: -45.591, tags: ['serra', 'frio'], infantil: 1, ai: false, iata: 'GRU', pt: 'Montanha, fondue e passeios no frio.', en: 'Mountain town, fondue and cool weather.' },
    { id: 'monteverde', nome: 'Monte Verde', uf: 'MG', lat: -22.862, lng: -46.039, tags: ['serra', 'frio', 'natureza'], infantil: 1, ai: false, iata: 'GRU', pt: 'Vila na Mantiqueira, trilhas e chalés.', en: 'Mountain village, trails and chalets.' },
    { id: 'petropolis', nome: 'Petrópolis', uf: 'RJ', lat: -22.505, lng: -43.178, tags: ['serra', 'historia', 'cidade'], infantil: 1, ai: false, iata: 'GIG', pt: 'Cidade imperial na serra fluminense.', en: 'Imperial city in the Rio highlands.' },
    { id: 'ouropreto', nome: 'Ouro Preto', uf: 'MG', lat: -20.386, lng: -43.503, tags: ['historia', 'serra'], infantil: 0, ai: false, iata: 'CNF', pt: 'Barroco mineiro, igrejas e ladeiras.', en: 'Baroque churches and colonial streets.' },
    { id: 'tiradentes', nome: 'Tiradentes', uf: 'MG', lat: -21.110, lng: -44.178, tags: ['historia', 'vinho'], infantil: 0, ai: false, iata: 'CNF', pt: 'Cidade colonial e boa comida mineira.', en: 'Colonial town and great local food.' },
    { id: 'paraty', nome: 'Paraty', uf: 'RJ', lat: -23.218, lng: -44.713, tags: ['praia', 'historia', 'natureza'], infantil: 1, ai: false, iata: 'GIG', pt: 'Centro histórico, ilhas e passeio de escuna.', en: 'Historic center, islands and boat trips.' },
    { id: 'ubatuba', nome: 'Ubatuba', uf: 'SP', lat: -23.433, lng: -45.083, tags: ['praia', 'natureza'], infantil: 1, ai: false, iata: 'GRU', pt: 'Dezenas de praias e Mata Atlântica.', en: 'Dozens of beaches and rainforest.' },
    { id: 'ilhabela', nome: 'Ilhabela', uf: 'SP', lat: -23.778, lng: -45.358, tags: ['praia', 'natureza'], infantil: 1, ai: false, iata: 'GRU', pt: 'Ilha com praias, cachoeiras e trilhas.', en: 'Island with beaches, waterfalls and trails.' },
    { id: 'rio', nome: 'Rio de Janeiro', uf: 'RJ', lat: -22.906, lng: -43.173, tags: ['praia', 'cidade', 'historia'], infantil: 1, ai: false, iata: 'SDU', pt: 'Praias, Cristo, Pão de Açúcar.', en: 'Beaches, Christ the Redeemer, Sugarloaf.' },
    { id: 'buzios', nome: 'Búzios', uf: 'RJ', lat: -22.747, lng: -41.882, tags: ['praia'], infantil: 1, ai: false, iata: 'GIG', pt: 'Praias calmas e Rua das Pedras.', en: 'Calm beaches and lively center.' },
    { id: 'arraialcabo', nome: 'Arraial do Cabo', uf: 'RJ', lat: -22.966, lng: -42.027, tags: ['praia', 'natureza'], infantil: 1, ai: false, iata: 'GIG', pt: 'Água azul-turquesa e passeio de barco.', en: 'Turquoise water and boat tours.' },
    { id: 'floripa', nome: 'Florianópolis', uf: 'SC', lat: -27.595, lng: -48.548, tags: ['praia', 'cidade', 'natureza'], infantil: 1, ai: false, iata: 'FLN', pt: 'Ilha com 40 praias e lagoa.', en: 'Island with 40 beaches and a lagoon.' },
    { id: 'camboriu', nome: 'Balneário Camboriú e Penha', uf: 'SC', lat: -26.991, lng: -48.635, tags: ['praia', 'cidade', 'parques'], infantil: 2, ai: false, iata: 'NVT', pt: 'Praia urbana e o Beto Carrero World.', en: 'City beach and Beto Carrero World park.' },
    { id: 'foz', nome: 'Foz do Iguaçu', uf: 'PR', lat: -25.516, lng: -54.585, tags: ['natureza', 'parques'], infantil: 2, ai: false, iata: 'IGU', pt: 'Cataratas, Itaipu e Parque das Aves.', en: 'Iguazu Falls, Itaipu and bird park.' },
    { id: 'curitiba', nome: 'Curitiba', uf: 'PR', lat: -25.429, lng: -49.271, tags: ['cidade', 'frio'], infantil: 1, ai: false, iata: 'CWB', pt: 'Parques, Jardim Botânico e trem da serra.', en: 'Parks, botanical garden and scenic train.' },
    { id: 'saopaulo', nome: 'São Paulo', uf: 'SP', lat: -23.550, lng: -46.633, tags: ['cidade'], infantil: 1, ai: false, iata: 'CGH', pt: 'Museus, shows e restaurantes.', en: 'Museums, shows and restaurants.' },
    { id: 'olimpia', nome: 'Olímpia', uf: 'SP', lat: -20.737, lng: -48.915, tags: ['parques', 'termas'], infantil: 2, ai: true, iata: 'SJP', pt: 'Parques aquáticos de águas quentes.', en: 'Warm-water water parks.' },
    { id: 'caldasnovas', nome: 'Caldas Novas', uf: 'GO', lat: -17.744, lng: -48.625, tags: ['termas', 'parques'], infantil: 2, ai: true, iata: 'CLV', pt: 'Águas termais e parques aquáticos.', en: 'Hot springs and water parks.' },
    { id: 'brotas', nome: 'Brotas', uf: 'SP', lat: -22.284, lng: -48.127, tags: ['natureza'], infantil: 1, ai: false, iata: 'VCP', pt: 'Rafting, cachoeiras e aventura.', en: 'Rafting, waterfalls and adventure.' },
    { id: 'chapadaveadeiros', nome: 'Chapada dos Veadeiros', uf: 'GO', lat: -14.133, lng: -47.511, tags: ['natureza'], infantil: 0, ai: false, iata: 'BSB', pt: 'Cerrado, cânions e cachoeiras.', en: 'Savanna, canyons and waterfalls.' },
    { id: 'pantanal', nome: 'Pantanal (Poconé)', uf: 'MT', lat: -16.256, lng: -56.623, tags: ['natureza'], infantil: 1, ai: false, iata: 'CGB', pt: 'Bichos à solta: onça, jacaré e aves.', en: 'Wildlife: jaguars, caimans and birds.' },
    { id: 'portogalinhas', nome: 'Porto de Galinhas', uf: 'PE', lat: -8.506, lng: -35.004, tags: ['praia'], infantil: 2, ai: true, iata: 'REC', pt: 'Piscinas naturais e resorts.', en: 'Natural pools and resorts.' },
    { id: 'noronha', nome: 'Fernando de Noronha', uf: 'PE', lat: -3.854, lng: -32.424, tags: ['praia', 'natureza'], infantil: 0, ai: false, iata: 'FEN', pt: 'Mar mais bonito do Brasil; caro e com taxa.', en: 'Brazil’s finest sea; pricey, with a fee.' },
    { id: 'maceio', nome: 'Maceió', uf: 'AL', lat: -9.665, lng: -35.735, tags: ['praia', 'cidade'], infantil: 2, ai: true, iata: 'MCZ', pt: 'Mar verde e piscinas naturais.', en: 'Green sea and natural pools.' },
    { id: 'maragogi', nome: 'Maragogi', uf: 'AL', lat: -9.012, lng: -35.222, tags: ['praia'], infantil: 2, ai: true, iata: 'MCZ', pt: 'Galés, piscinas naturais e resorts.', en: 'Coral pools and resorts.' },
    { id: 'praiaforte', nome: 'Praia do Forte e Sauípe', uf: 'BA', lat: -12.579, lng: -38.002, tags: ['praia'], infantil: 2, ai: true, iata: 'SSA', pt: 'Resorts all inclusive e Projeto Tamar.', en: 'All-inclusive resorts and sea turtles.' },
    { id: 'salvador', nome: 'Salvador', uf: 'BA', lat: -12.977, lng: -38.501, tags: ['praia', 'cidade', 'historia'], infantil: 1, ai: false, iata: 'SSA', pt: 'Pelourinho, praias e comida baiana.', en: 'Historic center, beaches and Bahian food.' },
    { id: 'portoseguro', nome: "Porto Seguro e Arraial d'Ajuda", uf: 'BA', lat: -16.449, lng: -39.065, tags: ['praia', 'historia', 'parques'], infantil: 2, ai: true, iata: 'BPS', pt: 'Praias, axé e parque aquático.', en: 'Beaches, music and water park.' },
    { id: 'comandatuba', nome: 'Ilha de Comandatuba', uf: 'BA', lat: -15.372, lng: -38.991, tags: ['praia'], infantil: 2, ai: true, iata: 'IOS', pt: 'Ilha de resort com tudo incluído.', en: 'Island resort, all inclusive.' },
    { id: 'chapadadiamantina', nome: 'Chapada Diamantina', uf: 'BA', lat: -12.563, lng: -41.389, tags: ['natureza'], infantil: 0, ai: false, iata: 'SSA', pt: 'Cachoeiras, grutas e trilhas.', en: 'Waterfalls, caves and trails.' },
    { id: 'natal', nome: 'Natal', uf: 'RN', lat: -5.795, lng: -35.209, tags: ['praia', 'cidade'], infantil: 2, ai: true, iata: 'NAT', pt: 'Dunas de buggy e praias.', en: 'Dune buggy rides and beaches.' },
    { id: 'fortaleza', nome: 'Fortaleza', uf: 'CE', lat: -3.732, lng: -38.527, tags: ['praia', 'cidade', 'parques'], infantil: 2, ai: true, iata: 'FOR', pt: 'Beach Park, praias e feirinha.', en: 'Beach Park, beaches and craft fair.' },
    { id: 'jeri', nome: 'Jericoacoara', uf: 'CE', lat: -2.796, lng: -40.513, tags: ['praia', 'natureza'], infantil: 1, ai: false, iata: 'JJD', pt: 'Vila de areia, lagoas e pôr do sol.', en: 'Sandy village, lagoons and sunsets.' },
    { id: 'lencois', nome: 'Lençóis Maranhenses', uf: 'MA', lat: -2.757, lng: -42.826, tags: ['natureza'], infantil: 1, ai: false, iata: 'SLZ', pt: 'Dunas com lagoas (melhor de maio a set).', en: 'Dunes with lagoons (best May–Sep).' }
  ];
  /* de onde sai (capitais e cidades grandes) */
  var ORIGENS = [
    ['sp', 'São Paulo', -23.550, -46.633, 'SP'], ['rio', 'Rio de Janeiro', -22.906, -43.173, 'RJ'], ['bh', 'Belo Horizonte', -19.917, -43.934, 'MG'], ['bsb', 'Brasília', -15.794, -47.882, 'DF'],
    ['poa', 'Porto Alegre', -30.035, -51.218, 'RS'], ['cwb', 'Curitiba', -25.429, -49.271, 'PR'], ['fln', 'Florianópolis', -27.595, -48.548, 'SC'], ['cps', 'Campinas', -22.906, -47.061, 'SP'],
    ['ssa', 'Salvador', -12.977, -38.501, 'BA'], ['rec', 'Recife', -8.054, -34.881, 'PE'], ['for', 'Fortaleza', -3.732, -38.527, 'CE'], ['gyn', 'Goiânia', -16.686, -49.264, 'GO'],
    ['cgr', 'Campo Grande', -20.469, -54.620, 'MS'], ['cgb', 'Cuiabá', -15.601, -56.097, 'MT'], ['vix', 'Vitória', -20.315, -40.312, 'ES'], ['nat', 'Natal', -5.795, -35.209, 'RN'],
    ['bel', 'Belém', -1.456, -48.490, 'PA'], ['mao', 'Manaus', -3.119, -60.022, 'AM']
  ];
  /* FERIADOS DO LUGAR ONDE A PESSOA MORA (dono, 23/Nov/2026: "vale o calendário de onde a gente mora, onde trabalha e folga").
     Tabela própria (não há base aberta confiável de feriados municipais): estaduais por UF e municipais das cidades da lista.
     Só o que é feriado por lei; a pessoa confere, desliga ou acrescenta em "Meus feriados". */
  var ESTADUAIS = {
    SP: [['07-09', 'Revolução Constitucionalista', 'Constitutionalist Revolution']],
    RJ: [['04-23', 'São Jorge', 'Saint George']],
    RS: [['09-20', 'Revolução Farroupilha', 'Ragamuffin Revolution']],
    PR: [['12-19', 'Emancipação do Paraná', 'Paraná Emancipation']],
    BA: [['07-02', 'Independência da Bahia', 'Bahia Independence']],
    PE: [['03-06', 'Revolução Pernambucana', 'Pernambuco Revolution']],
    CE: [['03-19', 'São José', 'Saint Joseph'], ['03-25', 'Data Magna do Ceará', 'Ceará Day']],
    DF: [['11-30', 'Dia do Evangélico', 'Evangelical Day']],
    AM: [['09-05', 'Elevação do Amazonas', 'Amazonas Day']],
    PA: [['08-15', 'Adesão do Pará', 'Pará Day']],
    MS: [['10-11', 'Criação do Estado', 'State Day']],
    RN: [['10-03', 'Mártires de Cunhaú e Uruaçu', 'Cunhaú and Uruaçu Martyrs']]
  };
  var MUNICIPAIS = {
    sp: [['01-25', 'Aniversário de São Paulo', 'São Paulo Anniversary']],
    rio: [['01-20', 'São Sebastião', 'Saint Sebastian']],
    bh: [['08-15', 'Assunção de Nossa Senhora', 'Assumption'], ['12-08', 'Imaculada Conceição', 'Immaculate Conception']],
    poa: [['02-02', 'Nossa Senhora dos Navegantes', 'Our Lady of Navigators']],
    cwb: [['09-08', 'Nossa Senhora da Luz', 'Our Lady of Light']],
    fln: [['03-23', 'Aniversário de Florianópolis', 'Florianópolis Anniversary']],
    cps: [['12-08', 'Nossa Senhora da Conceição', 'Immaculate Conception']],
    ssa: [['06-24', 'São João', 'Saint John'], ['12-08', 'Nossa Senhora da Conceição da Praia', 'Immaculate Conception']],
    rec: [['06-24', 'São João', 'Saint John'], ['07-16', 'Nossa Senhora do Carmo', 'Our Lady of Mount Carmel'], ['12-08', 'Nossa Senhora da Conceição', 'Immaculate Conception']],
    for: [['08-15', 'Nossa Senhora da Assunção', 'Assumption']],
    gyn: [['10-24', 'Aniversário de Goiânia', 'Goiânia Anniversary']],
    cgr: [['08-26', 'Aniversário de Campo Grande', 'Campo Grande Anniversary']],
    cgb: [['04-08', 'Aniversário de Cuiabá', 'Cuiabá Anniversary']],
    vix: [['09-08', 'Aniversário de Vitória', 'Vitória Anniversary']],
    nat: [['01-06', 'Santos Reis', 'Epiphany'], ['11-21', 'Nossa Senhora da Apresentação', 'Our Lady of Presentation']],
    bel: [['01-12', 'Aniversário de Belém', 'Belém Anniversary']],
    mao: [['10-24', 'Aniversário de Manaus', 'Manaus Anniversary'], ['12-08', 'Imaculada Conceição', 'Immaculate Conception']]
  };
  /* feriados locais da pessoa: { cidade:'sp', uf:'SP', extras:[{id,mmdd,pt}], desligados:[id] } → [{id, mmdd, pt, en, nivel}] */
  function locais(op) {
    op = op || {}; var off = op.desligados || [], l = [];
    (ESTADUAIS[op.uf] || []).forEach(function (x) { l.push({ id: 'uf-' + op.uf + '-' + x[0], mmdd: x[0], pt: x[1], en: x[2], nivel: 'estadual' }); });
    (MUNICIPAIS[op.cidade] || []).forEach(function (x) { l.push({ id: 'cid-' + op.cidade + '-' + x[0], mmdd: x[0], pt: x[1], en: x[2], nivel: 'municipal' }); });
    (op.extras || []).forEach(function (x) { l.push({ id: x.id, mmdd: x.mmdd, pt: x.pt, en: x.pt, nivel: 'seu' }); });
    return l.map(function (x) { x.ligado = off.indexOf(x.id) < 0; return x; });
  }

  function km(a, b) {
    var R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* ---- clima médio do mês (Open-Meteo, histórico dos últimos 3 anos; todos os destinos numa consulta por ano) ---- */
  function clima(mes, aoBanco) {
    var chave = 'fd-clima5-' + mes;
    return (aoBanco ? aoBanco.meta(chave, null) : Promise.resolve(null)).then(function (g) {
      if (g && Date.now() - g.em < 90 * 86400000) return g.dados;
      if (!navigator.onLine) return g ? g.dados : null;
      var hoje = new Date(), anos = [hoje.getFullYear() - 1, hoje.getFullYear() - 2, hoje.getFullYear() - 3];
      var lat = DESTINOS.map(function (d) { return d.lat; }).join(','), lng = DESTINOS.map(function (d) { return d.lng; }).join(',');
      var mm = ('0' + mes).slice(-2);
      return Promise.all(anos.map(function (a) {
        var ult = new Date(a, mes, 0).getDate();
        var url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + lat + '&longitude=' + lng + '&start_date=' + a + '-' + mm + '-01&end_date=' + a + '-' + mm + '-' + ult +
          '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FSao_Paulo';
        return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      })).then(function (rs) {
        var dados = {};
        DESTINOS.forEach(function (d, k) {
          var mx = [], mn = [], chuva = 0, n = 0;
          rs.forEach(function (r) {
            var x = r && (Array.isArray(r) ? r[k] : k === 0 ? r : null); if (!x || !x.daily) return;
            x.daily.temperature_2m_max.forEach(function (v, i) {
              if (v == null) return; mx.push(v); mn.push(x.daily.temperature_2m_min[i]); n++;
              if ((x.daily.precipitation_sum[i] || 0) >= 5) chuva++;   /* 5 mm: chuva que atrapalha (garoa de 1 mm dava 75% dos dias em Porto de Galinhas) */
            });
          });
          if (!n) return;
          var med = function (l) { return l.reduce(function (s, v) { return s + v; }, 0) / l.length; };
          dados[d.id] = { max: Math.round(med(mx)), min: Math.round(med(mn)), chuva: Math.round(chuva / n * 100) };
        });
        if (!Object.keys(dados).length) return g ? g.dados : null;
        if (aoBanco) aoBanco.definirMeta(chave, { em: Date.now(), dados: dados });
        return dados;
      });
    });
  }

  /* ---- nota de cada destino para o pedido: perfil + crianças + all inclusive + transporte/distância + clima ----
     p = { gostos:[tags], criancas:bool, ai:bool, transporte:'aviao'|'carro', origem:{lat,lng}, dias, climas } */
  function sugerir(p) {
    var maxCarro = p.dias <= 3 ? 450 : p.dias <= 4 ? 650 : 900;
    return DESTINOS.map(function (d) {
      var nota = 0, porque = [], dist = p.origem ? km(p.origem, d) : null, estrada = dist != null ? Math.round(dist * 1.3) : null;
      if (dist != null && dist < 40) return null;   /* é a própria cidade de onde sai */
      var bate = (p.gostos || []).filter(function (g) { return d.tags.indexOf(g) > -1; });
      if ((p.gostos || []).length && !bate.length) return null;
      nota += bate.length * 3; bate.forEach(function (g) { porque.push(g); });
      if (p.ai) { if (!d.ai) return null; nota += 3; porque.push('ai'); }
      if (p.criancas) { nota += d.infantil * 1.5; if (d.infantil === 2) porque.push('criancas'); }
      if (p.transporte === 'carro') {
        if (estrada == null || estrada > maxCarro) return null;
        nota += 2 - estrada / 300;
      } else if (dist != null) {
        if (dist < 300) nota -= 1;                       /* perto demais para ir de avião */
        if (p.dias <= 3 && dist > 1800) nota -= 2;       /* longe demais para 3 dias */
      }
      var c = p.climas && p.climas[d.id];
      if (c) {
        if (bate.indexOf('praia') > -1) { if (c.max >= 27) nota += 2; else if (c.max < 24) nota -= 2; }
        if (bate.indexOf('frio') > -1) { if (c.min <= 12) nota += 2; else if (c.min >= 17) nota -= 1; }
        if (c.chuva >= 40) nota -= 1.5; else if (c.chuva <= 15) nota += 0.5;
      }
      if (d.id === 'lencois' && p.mes && (p.mes < 5 || p.mes > 9)) nota -= 2;   /* lagoas secas fora da época */
      return { d: d, nota: nota, porque: porque, km: dist != null ? Math.round(dist) : null, estrada: estrada, horas: estrada != null ? Math.max(1, Math.round(estrada / 75)) : null, clima: c || null };
    }).filter(Boolean).sort(function (a, b) { return b.nota - a.nota; });
  }

  window.Feriadoes = { feriadoes: feriadoes, feriados: feriados, locais: locais, ESTADUAIS: ESTADUAIS, MUNICIPAIS: MUNICIPAIS, pascoa: pascoa, DESTINOS: DESTINOS, ORIGENS: ORIGENS, clima: clima, sugerir: sugerir, km: km, iso: iso };
})();
