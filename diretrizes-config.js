/* =====================================================================
   diretrizes-config.js — GuiaXpert
   O único arquivo do módulo comum que muda de app para app.

   Neste app:
   - O LOGIN é a conta SolverONE (Supabase), feito em js/conta.js. O login
     do módulo fica desligado, senão apareceriam duas telas de entrar.
   - As telas do app já são bilíngues (js/textos.js): o tradutor do módulo
     não mexe nelas (ignorar '#app').
   - Anúncios desligados na v0.1 (decisão pendente do dono: o público é premium).
   - O cofre de chaves de IA do módulo (DGO.ia) é o mesmo de todos os apps:
     o GuiaXpert usa para "Montar com a minha IA".
   ===================================================================== */
DGO.iniciar({
  app: 'guiaxpert',                       /* gaveta de dados: nunca mude */
  nome: { pt: 'GuiaXpert', en: 'GuiaXpert' },
  versaoApp: '0.1.0',
  cor: '#1e5b48',
  corFundoBarra: '#16222b',
  idiomaPadrao: 'pt',
  idiomaCompartilhado: true,
  seletorIdiomaVisivel: false,   /* o app tem o próprio PT|EN (cabeçalho no computador, ☰ no celular) */

  anuncios: { ativo: false, arquivo: '', popup: { ativo: false } },
  login: { ativo: false, permitirVisitante: false, permitirPagante: false, permitirAnunciante: false, biometria: false },
  niveis: { ativo: false, arquivo: '' },
  ocr: { ativo: false },

  ia: {
    ativo: true,
    botaoNaFaixa: false,
    provedorPadrao: 'gemini',
    contexto: {
      pt: 'Você ajuda quem usa o GuiaXpert, um guia de viagem para famílias. Responda curto, em português simples. Nunca invente endereço, preço ou horário. Nunca peça senha, chave ou dado pessoal.',
      en: 'You help people using GuiaXpert, a family travel guide. Answer briefly in plain English. Never make up addresses, prices or hours. Never ask for passwords, keys or personal data.'
    }
  },

  rede: { pesado: 'wifi', ia: 'sempre' },

  notificacoes: {
    ativo: true,
    tipos: [
      { id: 'roteiro', nome: { pt: 'Próximo item do roteiro', en: 'Next itinerary item' },
        descricao: { pt: 'Aviso antes de cada passeio do dia.', en: 'Alert before each outing of the day.' }, padrao: false },
      { id: 'clima', nome: { pt: 'Chuva, frio ou calor', en: 'Rain, cold or heat' },
        descricao: { pt: 'Aviso prático na véspera.', en: 'Practical alert the day before.' }, padrao: true }
    ]
  },

  ignorar: ['#app'],
  pwa: { ativo: true, manifesto: 'manifest.json', serviceWorker: 'sw.js' }
});
