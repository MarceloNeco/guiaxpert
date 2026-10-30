/* =====================================================================
   config.js — endereços que o GuiaXpert usa
   Os valores do Supabase são PÚBLICOS de propósito (URL e publishable key):
   quem protege os dados é o banco (RLS e funções que conferem o login).
   NUNCA coloque aqui a Secret key, a chave "service role" ou senha de banco.
   ===================================================================== */
window.GUIAXPERT_CONFIG = {
  SUPABASE_URL: 'https://qvdvkqydhnadhewcidia.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_oRJmeUwlBbOP_HoOXf0xLw_4O8v43EA',

  /* 'obrigatorio' = só entra quem foi liberado (lista do RootifyONE ou código de degustação).
     'aberto' = qualquer pessoa usa (só para testar no computador antes de rodar o SQL). */
  ACESSO: 'obrigatorio',

  /* dias que o app continua abrindo sem internet depois da última conferência do acesso */
  DIAS_SEM_INTERNET: 7,

  /* pacotes de cidade: primeiro o central (publicado pelo RootifyONE), depois a cópia local */
  PACOTES_CENTRAL: '/solverone-dados/conteudo/guiaxpert/pacotes/',
  PACOTES_LOCAL: 'pacotes/',

  /* mapas de fundo para usar sem internet (recortes do OpenStreetMap por cidade): central, depois a cópia local */
  MAPAS_CENTRAL: '/solverone-dados/conteudo/guiaxpert/mapas/',
  MAPAS_LOCAL: 'mapas/'
};
