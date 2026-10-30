/* =====================================================================
   gostos.js — o que cada pessoa curte numa viagem (gosto, não restrição)
   Restrição (comida, saúde, mobilidade) mora no perfil e no cofre.
   Aqui ficam preferências: "curte", "ama" ou "prefere evitar".

   Formato: temas → grupinhos de coisas parecidas → item "id|PT|EN".
   O grupinho é o que deixa a tela fluida: quem marca "Cachoeiras" vê
   logo "Piscinas naturais" e "Rios" sem procurar.
   `CATEGORIA` liga alguns gostos às categorias dos pacotes de cidade,
   para a lista de lugares mostrar o que combina com o grupo.

   Guardado em pessoa.gostos = { id: 1 (curte) | 2 (ama) | -1 (evita) }.
   Fica só no aparelho; para a IA vai sem nome de ninguém.
   ===================================================================== */
(function () {
  'use strict';

  var TEMAS = [
    { id: 'jeito', icone: '🧭', pt: 'Jeito de passear', en: 'How you explore', grupos: [
      ['tour-grupo|Tour guiado em grupo|Group guided tour', 'guia-particular|Guia particular|Private guide', 'free-walking|Free walking tour|Free walking tour', 'audioguia|Audioguia no celular|Audio guide app', 'excursao-dia|Excursão de um dia|Day trip', 'hop-on|Ônibus turístico (sobe e desce)|Hop-on hop-off bus'],
      ['por-conta|Por conta própria|On our own', 'explorar-pe|Explorar a pé, sem rumo|Wandering on foot', 'mochilao|Mochilão|Backpacking', 'dia-livre|Dia livre, sem plano|Free day, no plan', 'como-local|Viver como um local|Live like a local'],
      ['tudo-planejado|Tudo planejado|Everything planned', 'poucas-coisas|Poucas coisas por dia|A few things a day', 'madrugar|Acordar cedo e aproveitar|Early start', 'comecar-tarde|Começar o dia mais tarde|Late start'],
      ['dirigir|Dirigir e parar onde quiser|Road trip stops', 'trem|Passeio de trem|Train ride', 'barco|Passeio de barco|Boat trip', 'bike-cidade|Pedalar pela cidade|City cycling', 'transporte-publico|Andar de transporte público|Public transport'],
      ['escondidos|Lugares pouco conhecidos|Hidden gems', 'classicos|Os clássicos do destino|The must-sees', 'sem-multidao|Lugares sem multidão|Away from crowds', 'vistas|Lugares com vista|Places with a view']
    ] },
    { id: 'natureza', icone: '🌿', pt: 'Natureza', en: 'Nature', grupos: [
      ['trilhas-leves|Trilhas leves|Easy trails', 'trilhas-dificeis|Trilhas puxadas|Hard trails', 'mirantes|Mirantes|Lookouts', 'nascer-sol|Nascer do sol|Sunrise', 'por-do-sol|Pôr do sol|Sunset'],
      ['cachoeiras|Cachoeiras|Waterfalls', 'piscinas-naturais|Piscinas naturais|Natural pools', 'rios|Rios|Rivers', 'lagos|Lagos|Lakes', 'praias|Praias|Beaches', 'cavernas|Cavernas e grutas|Caves'],
      ['parques-nacionais|Parques nacionais|National parks', 'florestas|Florestas|Forests', 'jardins|Jardins e parques|Gardens and parks', 'flores|Campos de flores|Flower fields', 'canions|Cânions|Canyons'],
      ['aves|Observar aves|Birdwatching', 'animais|Ver animais soltos|Wildlife', 'mergulho-snorkel|Snorkel|Snorkelling', 'estrelas|Céu estrelado|Stargazing'],
      ['montanhas|Montanhas|Mountains', 'neve|Neve|Snow', 'frio|Clima de frio e neblina|Cold and misty weather', 'campos|Campos e serra|Highlands']
    ] },
    { id: 'aventura', icone: '🧗', pt: 'Aventura', en: 'Adventure', grupos: [
      ['tirolesa|Tirolesa|Zip line', 'arvorismo|Arvorismo|Treetop course', 'rapel|Rapel|Abseiling', 'escalada|Escalada|Climbing', 'via-ferrata|Via ferrata|Via ferrata'],
      ['rafting|Rafting|Rafting', 'canoagem|Canoagem e caiaque|Canoe and kayak', 'stand-up|Stand-up paddle|Stand-up paddle', 'surf|Surfe|Surfing', 'mergulho|Mergulho com cilindro|Scuba diving'],
      ['balao|Voo de balão|Hot-air balloon', 'parapente|Parapente|Paragliding', 'paraquedas|Salto de paraquedas|Skydiving', 'helicoptero|Voo de helicóptero|Helicopter ride'],
      ['quadriciclo|Quadriciclo|Quad bike', 'off-road|Passeio 4x4|4x4 tour', 'cavalgada|Cavalgada|Horse riding', 'mountain-bike|Mountain bike|Mountain biking'],
      ['bungee|Bungee jump|Bungee jumping', 'canyoning|Cachoeirismo|Canyoning', 'esqui|Esqui e snowboard|Skiing and snowboarding', 'radical|Quanto mais radical, melhor|The more extreme the better']
    ] },
    { id: 'cultura', icone: '🏛️', pt: 'Cultura e história', en: 'Culture and history', grupos: [
      ['museus-arte|Museus de arte|Art museums', 'museus-historia|Museus de história|History museums', 'museus-ciencia|Museus de ciência|Science museums', 'museus-interativos|Museus interativos|Interactive museums', 'galerias|Galerias|Galleries'],
      ['centro-historico|Centros históricos|Old towns', 'arquitetura|Arquitetura|Architecture', 'igrejas|Igrejas e catedrais|Churches and cathedrals', 'castelos|Castelos e palácios|Castles and palaces', 'ruinas|Ruínas e sítios arqueológicos|Ruins and archaeology'],
      ['teatro|Teatro|Theatre', 'musicais|Musicais|Musicals', 'concertos|Concertos|Concerts', 'ballet-opera|Ópera e balé|Opera and ballet', 'cinema|Cinema|Cinema'],
      ['imigracao|Cultura dos imigrantes|Immigrant heritage', 'tradicoes|Tradições locais|Local traditions', 'artesanato|Ver artesãos trabalhando|Artisans at work', 'oficinas|Oficinas e aulas|Workshops and classes'],
      ['arte-rua|Arte de rua e grafite|Street art', 'livrarias|Livrarias|Bookshops', 'design|Design e moda|Design and fashion', 'historia-guiada|Contar a história do lugar|Stories of the place']
    ] },
    { id: 'comer', icone: '🍽️', pt: 'Comer', en: 'Food', grupos: [
      ['fondue|Fondue|Fondue', 'cafe-colonial|Café colonial|Colonial tea', 'massas|Massas|Pasta', 'pizza|Pizza|Pizza', 'churrasco|Churrasco|Barbecue', 'frutos-mar|Frutos do mar|Seafood'],
      ['comida-tipica|Comida típica da região|Regional food', 'comida-caseira|Comida caseira|Home cooking', 'galeto|Galeto e polenta|Galeto and polenta', 'rodizio|Rodízio|All-you-can-eat'],
      ['alta-gastronomia|Alta gastronomia|Fine dining', 'chef|Restaurante de chef|Chef’s restaurant', 'menu-degustacao|Menu degustação|Tasting menu', 'vista-restaurante|Restaurante com vista|Restaurant with a view'],
      ['comida-rua|Comida de rua|Street food', 'mercados|Mercados públicos|Food markets', 'feiras|Feiras de produtor|Farmers’ markets', 'food-truck|Food trucks|Food trucks', 'padarias|Padarias|Bakeries'],
      ['saudavel|Comida leve e saudável|Light and healthy', 'japonesa|Japonesa|Japanese', 'italiana|Italiana|Italian', 'arabe|Árabe|Middle Eastern', 'mexicana|Mexicana|Mexican'],
      ['aula-culinaria|Aula de culinária|Cooking class', 'tour-gastronomico|Tour gastronômico|Food tour', 'brunch|Brunch|Brunch', 'cafe-manha|Café da manhã caprichado|Big breakfast']
    ] },
    { id: 'doces', icone: '🍫', pt: 'Doces e cafés', en: 'Sweets and coffee', grupos: [
      ['chocolate|Chocolate|Chocolate', 'fabrica-chocolate|Fábrica de chocolate|Chocolate factory', 'chocolate-quente|Chocolate quente|Hot chocolate'],
      ['confeitaria|Confeitarias|Patisseries', 'sorvete|Sorvete|Ice cream', 'doces-tipicos|Doces típicos|Local sweets', 'strudel|Strudel e tortas|Strudel and pies'],
      ['cafes-especiais|Cafés especiais|Specialty coffee', 'cafeterias|Cafeterias charmosas|Cosy cafés', 'cha|Casa de chá|Tea room']
    ] },
    { id: 'bebidas', icone: '🍷', pt: 'Bebidas', en: 'Drinks', grupos: [
      ['vinho|Vinho|Wine', 'vinicolas|Visitar vinícolas|Winery visits', 'espumante|Espumante|Sparkling wine', 'degustacao|Degustação guiada|Guided tasting'],
      ['cerveja-artesanal|Cerveja artesanal|Craft beer', 'cervejarias|Visitar cervejarias|Brewery visits', 'chope|Chope gelado|Draught beer'],
      ['cachaca|Cachaça e alambiques|Cachaça distilleries', 'drinks|Drinks e coquetéis|Cocktails', 'bar-vista|Bar com vista|Bar with a view'],
      ['suco-natural|Sucos e bebidas sem álcool|Juices and soft drinks', 'cafe-fazenda|Fazenda de café|Coffee farm']
    ] },
    { id: 'criancas', icone: '🧸', pt: 'Com crianças', en: 'With kids', grupos: [
      ['parque-diversao|Parques de diversão|Amusement parks', 'parque-aquatico|Parques aquáticos|Water parks', 'parque-tematico|Parques temáticos|Theme parks', 'parquinho|Parquinhos|Playgrounds'],
      ['zoologico|Zoológicos|Zoos', 'aquario|Aquários|Aquariums', 'fazendinha|Fazendinha com animais|Petting farm', 'borboletario|Borboletário|Butterfly house'],
      ['museu-criancas|Museus para crianças|Children’s museums', 'teatro-infantil|Teatro infantil|Kids’ theatre', 'oficina-criancas|Oficinas para crianças|Kids’ workshops', 'magica|Mágica e circo|Magic and circus'],
      ['papai-noel|Papai Noel e Natal|Santa and Christmas', 'personagens|Personagens|Characters', 'trenzinho|Trenzinho e carrossel|Little train and carousel', 'mini-golfe|Minigolfe|Mini golf'],
      ['espaco-kids|Restaurante com espaço kids|Restaurant with kids’ area', 'perto-hotel|Passeios perto do hotel|Close to the hotel', 'pausa-soneca|Pausa para a soneca|Nap break']
    ] },
    { id: 'compras', icone: '🛍️', pt: 'Compras', en: 'Shopping', grupos: [
      ['outlets|Outlets|Outlets', 'shoppings|Shoppings|Malls', 'lojas-rua|Lojas de rua|High street', 'grifes|Lojas de grife|Designer shops'],
      ['artesanato-compras|Artesanato local|Local crafts', 'antiguidades|Antiquários|Antiques', 'brechos|Brechós|Thrift shops', 'feira-artesanato|Feira de artesanato|Craft fair'],
      ['malhas|Malhas e tricô|Knitwear', 'couro|Couro|Leather goods', 'produtos-coloniais|Queijos e produtos coloniais|Cheese and farm products', 'lembrancinhas|Lembrancinhas|Souvenirs']
    ] },
    { id: 'bem-estar', icone: '🧖', pt: 'Descanso e bem-estar', en: 'Rest and wellness', grupos: [
      ['spa|Spa|Spa', 'massagem|Massagem|Massage', 'termas|Águas termais|Hot springs', 'ofuro|Ofurô|Hot tub'],
      ['yoga|Ioga|Yoga', 'meditacao|Meditação|Meditation', 'retiro|Retiro|Retreat'],
      ['curtir-hotel|Curtir o hotel|Enjoy the hotel', 'piscina|Piscina|Swimming pool', 'lareira|Lareira e cobertor|Fireplace and blankets', 'sem-pressa|Dia sem pressa|Slow day']
    ] },
    { id: 'noite', icone: '🌙', pt: 'À noite', en: 'At night', grupos: [
      ['musica-vivo|Música ao vivo|Live music', 'jazz|Jazz e blues|Jazz and blues', 'samba|Samba e pagode|Samba', 'sertanejo|Sertanejo|Sertanejo', 'rock|Rock|Rock'],
      ['bares|Bares|Bars', 'pubs|Pubs|Pubs', 'baladas|Baladas|Nightclubs', 'cassino|Cassino|Casino'],
      ['jantar-romantico|Jantar romântico|Romantic dinner', 'rooftop|Terraço com vista|Rooftop', 'passeio-noturno|Passeio noturno|Night walk', 'luzes-natal|Luzes de Natal|Christmas lights'],
      ['shows|Shows|Shows', 'stand-up-comedia|Comédia stand-up|Stand-up comedy', 'dormir-cedo|Dormir cedo|Early nights']
    ] },
    { id: 'esportes', icone: '👟', pt: 'Esportes', en: 'Sports', grupos: [
      ['futebol|Jogo de futebol|Football match', 'estadios|Visitar estádios|Stadium tours', 'basquete|Jogo de basquete|Basketball game', 'f1|Automobilismo|Motor racing'],
      ['corrida|Correr pela cidade|Running', 'academia|Academia|Gym', 'golfe|Golfe|Golf', 'tenis|Tênis e padel|Tennis and padel'],
      ['pesca|Pesca|Fishing', 'vela|Vela|Sailing', 'natacao|Natação|Swimming', 'patinacao|Patinação no gelo|Ice skating'],
      ['ciclismo|Ciclismo de estrada|Road cycling', 'trail|Corrida de trilha|Trail running', 'prova|Correr uma prova na viagem|Race abroad']
    ] },
    { id: 'fotos', icone: '📸', pt: 'Fotos', en: 'Photos', grupos: [
      ['fotos-paisagem|Paisagens|Landscapes', 'fotos-familia|Fotos da família|Family photos', 'instagramaveis|Lugares fotogênicos|Photogenic spots', 'ensaio|Ensaio com fotógrafo|Photo shoot'],
      ['fotos-arquitetura|Arquitetura|Architecture', 'fotos-comida|Comida|Food', 'drone|Drone|Drone', 'hora-dourada|Hora dourada|Golden hour']
    ] },
    { id: 'eventos', icone: '🎪', pt: 'Eventos e festas', en: 'Events and festivals', grupos: [
      ['natal-luz|Eventos de Natal|Christmas events', 'desfiles|Desfiles|Parades', 'shows-natal|Espetáculos de Natal|Christmas shows', 'reveillon|Réveillon|New Year’s Eve'],
      ['festival-musica|Festivais de música|Music festivals', 'festival-gastronomia|Festivais gastronômicos|Food festivals', 'festival-cinema|Festivais de cinema|Film festivals', 'oktoberfest|Oktoberfest e festas alemãs|Oktoberfest'],
      ['carnaval|Carnaval|Carnival', 'festa-junina|Festa junina|June festival', 'pascoa|Páscoa|Easter', 'feiras-exposicoes|Feiras e exposições|Fairs and expos']
    ] },
    { id: 'hospedagem', icone: '🏡', pt: 'Onde ficar', en: 'Where to stay', grupos: [
      ['hotel-boutique|Hotel-butique|Boutique hotel', 'resort|Resort|Resort', 'all-inclusive|Tudo incluído|All-inclusive', 'hotel-historico|Hotel histórico|Historic hotel'],
      ['pousada|Pousada|Inn', 'chale|Chalé|Chalet', 'hotel-fazenda|Hotel-fazenda|Farm stay', 'glamping|Glamping|Glamping', 'camping|Camping|Camping'],
      ['casa-alugada|Casa ou apartamento alugado|Rented home', 'hostel|Hostel|Hostel', 'centro|Ficar no centro|Stay central', 'afastado|Ficar afastado e sossegado|Stay out of town']
    ] }
  ];

  /* gosto → categoria do pacote ("categoria" ou "categoria:subcategoria") */
  var CATEGORIA = {
    'fondue': 'comer:fondue', 'cafe-colonial': 'comer:cafe-colonial', 'massas': 'comer:pizza-massas', 'pizza': 'comer:pizza-massas',
    'galeto': 'comer:pizza-massas', 'comida-tipica': 'comer:restaurante', 'comida-caseira': 'comer:restaurante', 'churrasco': 'comer:restaurante',
    'alta-gastronomia': 'comer:restaurante', 'chef': 'comer:restaurante',
    'chocolate': 'doces', 'fabrica-chocolate': 'doces', 'chocolate-quente': 'doces', 'confeitaria': 'doces', 'strudel': 'doces', 'doces-tipicos': 'doces',
    'cerveja-artesanal': 'bebidas', 'cervejarias': 'bebidas', 'chope': 'bebidas', 'vinho': 'bebidas', 'vinicolas': 'bebidas', 'espumante': 'bebidas',
    'mirantes': 'atracao', 'cachoeiras': 'atracao', 'parque-tematico': 'atracao', 'museus-interativos': 'atracao', 'papai-noel': 'atracao',
    'natal-luz': 'atracao', 'luzes-natal': 'atracao', 'classicos': 'atracao', 'jardins': 'atracao:gratis', 'passeio-noturno': 'atracao:gratis'
  };

  var ITENS = {}, ORDEM = [];
  TEMAS.forEach(function (t) {
    t.grupos = t.grupos.map(function (g, gi) {
      return g.map(function (s) {
        var p = s.split('|'), it = { id: p[0], pt: p[1], en: p[2], tema: t.id, grupo: gi };
        ITENS[it.id] = it; ORDEM.push(it.id);
        return it;
      });
    });
  });

  var Gostos = {
    temas: TEMAS,
    item: function (id) { return ITENS[id] || null; },
    total: function () { return ORDEM.length; },
    nome: function (id, lg) { var it = ITENS[id]; return it ? (it[lg] || it.pt) : id; },

    /* toque: nada → curte → ama → evita → nada */
    proximo: function (v) { return !v ? 1 : v === 1 ? 2 : v === 2 ? -1 : 0; },

    /* itens do mesmo grupinho ainda sem resposta (as sugestões que aparecem) */
    parecidos: function (id, gostos) {
      var it = ITENS[id]; if (!it) return [];
      var t = TEMAS.filter(function (x) { return x.id === it.tema; })[0];
      return t.grupos[it.grupo].filter(function (o) { return o.id !== id && !(gostos && gostos[o.id]); });
    },

    buscar: function (texto, lg) {
      var q = sem(texto);
      if (!q) return [];
      return ORDEM.map(function (id) { return ITENS[id]; }).filter(function (it) {
        return sem(it.pt).indexOf(q) > -1 || sem(it.en).indexOf(q) > -1 || sem(lg === 'en' ? temaDe(it).en : temaDe(it).pt).indexOf(q) > -1;
      });
    },

    /* soma do grupo: { id: pontos } (ama 2, curte 1, evita -2 por pessoa) */
    doGrupo: function (pessoas) {
      var s = {};
      (pessoas || []).forEach(function (p) {
        Object.keys(p.gostos || {}).forEach(function (id) {
          var v = p.gostos[id]; s[id] = (s[id] || 0) + (v === 2 ? 2 : v === 1 ? 1 : v === -1 ? -2 : 0);
        });
      });
      return s;
    },

    /* quanto um lugar do pacote combina com o grupo (0 = neutro) */
    combina: function (lugar, soma) {
      var pts = 0;
      Object.keys(soma || {}).forEach(function (id) {
        var c = CATEGORIA[id]; if (!c) return;
        var p = c.split(':');
        if (p[0] !== lugar.categoria) return;
        if (p[1] && p[1] !== lugar.subcategoria && !(p[1] === 'gratis' && lugar.gratis)) return;
        pts += soma[id];
      });
      return pts;
    },

    /* texto para a IA: só gostos, sem nome de ninguém */
    resumo: function (pessoas) {
      var s = Gostos.doGrupo(pessoas), ids = Object.keys(s);
      var ama = ids.filter(function (id) { return s[id] >= 2; }).map(function (id) { return Gostos.nome(id, 'pt'); });
      var curte = ids.filter(function (id) { return s[id] === 1; }).map(function (id) { return Gostos.nome(id, 'pt'); });
      var evita = ids.filter(function (id) { return s[id] < 0; }).map(function (id) { return Gostos.nome(id, 'pt'); });
      return [ama.length ? 'O grupo ama: ' + ama.join(', ') + '.' : '', curte.length ? 'Curte: ' + curte.join(', ') + '.' : '',
              evita.length ? 'Prefere evitar: ' + evita.join(', ') + '.' : ''].filter(Boolean).join(' ');
    }
  };

  function temaDe(it) { return TEMAS.filter(function (t) { return t.id === it.tema; })[0]; }
  function sem(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }

  window.Gostos = Gostos;
})();
