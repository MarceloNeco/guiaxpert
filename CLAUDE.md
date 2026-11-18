# GuiaXpert — regras para todas as conversas

## Aviso do dono (13/Nov/2026) — Definition of done em 12 pontos
A Definition of done da plataforma SolverONE passa a ter 12 pontos: manual e orientações, AssistONE, Novidades da versão, termos, comunicações e e-mails, RootifyONE, ArchONE, EaglePlanONE (roadmap), retrocompatibilidade, segurança e LGPD, qualidade verificável e registro. Vai nascer uma teia de integrações entre os apps, o RootifyONE, o ArchONE e o EaglePlanONE (eventos e comandos com aprovação). A conversa de diretrizes da SolverONE está desenhando; quando a diretriz nova sair, siga-a.

- **Aplicabilidade:** cada ponto vale quando se aplica ao estágio atual do app. Não criar login, não migrar banco e não criar integração por causa deste aviso. O que não se aplica hoje: dizer "não aplicável hoje" e o motivo em uma linha. Quando o app ganhar login, banco ou integração nova, já nasce cumprindo os pontos que passaram a valer.
- **Até a diretriz nova:**
  1. este aviso fica registrado aqui;
  2. em cada entrega, dizer no resumo o que o RootifyONE, o ArchONE ou o EaglePlanONE precisariam saber (integração nova ou removida, recurso novo, item do roadmap concluído);
  3. nada de integração nova sem a regra zero.

## Regras permanentes do app
- **Idioma** (diretriz geral do dono, 14/Nov/2026): textos para o usuário em PT (Brasil), EN (EUA) e ES (Espanha), tradução
  humanizada; um seletor só em todo lugar, bandeira em SVG + sigla (PT · EN · ES), componente do módulo comum, nunca emoji nem botão
  próprio; cópia mestra das bandeiras em `bandeiras/` do RootifyONE (flag-icons, MIT), copiada inteira e posta no `sw.js`; ES só quando
  o app inteiro estiver traduzido (até lá, PT e EN). Detalhe: diretriz geral do `rootify-one`, seção "Idioma e datas". Nada
  implementado aqui ainda: entra na ordem combinada com o dono (regra zero).
- Toda solução funciona sem IA (regras, dados abertos, links oficiais); IA é só opcional.
- Nunca publicar dado pessoal (CPF, códigos de reserva, PINs) em repositório ou pacote público. No código só a chave publicável do Supabase.
- Chaves de serviço só no Supabase Vault (tela Configurações → Chaves do serviço); nunca no chat, no código ou no Drive.
- Outras famílias não gastam as chaves do dono; nomes de pessoas nunca vão para a IA; ACESSO 'obrigatorio'.
- Não abrir PR; publicar em main (e no branch de trabalho). Versão em js/app.js (VERSAO_APP), sw.js (VERSAO), versoes.json (copiado para solverone-dados/versoes/guiaxpert.json).
- **Novidades (versoes.json) curtas, sem explicar:** cada item é uma frase de 3 a 8 palavras dizendo só se é novo, melhoria ou correção e onde. Ex.: "Melhorias no ditado por voz.", "Correção na voz do computador.", "Novo: guia pronto de Bonito." Sem causa, sem detalhe técnico, sem nome de serviço, sem parênteses; 1 a 3 itens por versão (pedido do dono em 13/Nov/2026, igual ao Radar Judicial).
- Pendências e testes: docs/ROADMAP.md e a planilha "0-SolverONE DIRETRIZES E BACKLOG" (aba GuiaXpert).
