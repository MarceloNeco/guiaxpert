# GuiaXpert — roadmap

Os quatro jeitos de montar o guia, combinados com o dono em 30/Out/2026:

| Jeito | Como | Situação |
|---|---|---|
| 1. Pacote pronto | SolverONE monta a cidade; RootifyONE publica; família baixa e usa offline | ✅ 0.1.0 (Gramado e Canela) |
| 2. Busca aberta, sem IA | OpenStreetMap (Overpass) perto do destino | ✅ 0.1.0 · Wikivoyage: v0.2 · blogs: só com servidor |
| 3. Com a IA da pessoa | chave no cofre comum (`DGO.ia`), roteiro sob medida | ✅ 0.1.0 (gera opção nova; conferir) |
| 4. Agente de IA | replaneja o dia se chover, responde sobre a viagem, lê e-mail de reserva | ✅ 1.0.0 (com a chave da pessoa) · avisos de lotação/push: exigem servidor |

## Feito até a 1.0.0 (31/Out/2026)

Explorar vs. Viagem, mapa com lista e pontos do dia, mapa offline (PMTiles) de Gramado, reservas na conta (cifradas) com
QR/código para outro celular, e-mail → reserva, família (membros, convites, cartão para quem fica em casa), IA (tela, replanejar, guia).

## Próximos

0. **Lugares comerciais sem limite de cache**: hoje a função `lugares` usa o Foursquare Places API (chave no servidor,
   500 chamadas/mês grátis, termos do pago-por-uso proíbem guardar os dados). Para uso em escala: (a) contrato Enterprise
   com o Foursquare, ou (b) subir a base aberta **FSQ OS Places** (Apache 2.0, 100 M lugares, pode copiar e guardar)
   no Postgres do Supabase com PostGIS + pg_trgm, recortada por país, e entregar também nos pacotes offline. Preferir (b).
   **Pronto e opcional (31/Out/2026):** tabela `lugares_abertos` + `buscar_lugares_abertos` (vazios), script
   `ferramentas/fsq-os-places/recortar.py` e a função `lugares` já escolhe a base aberta quando não há chave. Falta só
   baixar os parquet e carregar (ver `ferramentas/fsq-os-places/README.md`).
1. **Mapa offline para cidades sem pacote**: Edge Function que recorta o PMTiles sob demanda (`pmtiles extract`). Hoje só cidades com pacote.
2. **Tela de códigos no RootifyONE** (criar, listar com uso, desativar) usando `admin_criar_codigo`,
   `admin_listar_codigos`, `admin_desativar_codigo`.
3. **Push** (próximo item, clima da véspera, 'a família mudou o roteiro'): exige Edge Function + VAPID.
4. **Encaminhar e-mail**: virou o item E1 (roteiro@solverone.com.br), prioridade crítica.
5. **Localização da família ao vivo** (só no app nativo).
7. Barra de baixo configurável (favoritos, diretriz) e AssistONE com ajuda por tela.
8. Mais pacotes (Bonito, Foz, Serra Gaúcha vinícolas…), cada um com data de verificação.

## Entrevista com o dono — 03/Nov/2026 (fonte desta lista)

Contexto: Gramado e Canela, 18–22/Nov/2026 (quarta a domingo), com a esposa, a sogra e as filhas de 4 e 7 anos.
O app é para **montar** o roteiro (pesquisar, sugerir, decidir), não só para cadastrar.

**Diretrizes que saíram da entrevista**
- **Independência da IA:** a automação principal funciona por regras (datas, códigos, empresas conhecidas, lugar no mapa
  aberto). A IA é reforço para o caso difícil, nunca a base. Se ficar cara ou sair do ar, o app continua funcionando.
- **Toda informação detectada passa pela conferência da pessoa** ("Detectei isto: confere?"), com ou sem IA.
- Visual do wizard e das escolhas: cartões grandes, arredondados, movimento suave, pensado para o celular.

**Antes da viagem (aprovado, nesta ordem)**

| # | Item | Prioridade |
|---|---|---|
| E1 | **roteiro@solverone.com.br** (amostras reais descritas em `docs/AMOSTRAS-ENTRADA-EMAIL.md`): encaminhar e-mail de reserva, ingresso ou ideia. ImprovMX (alias) → Resend Inbound (`@entrada.solverone.com.br`) → Edge Function lê texto e anexo (PDF, print, QR) por regras; IA só se o texto for solto. Aparece "📥 Chegou" no app para conferir. Reserva → compromisso fixo; ideia → quadro de ideias. Para qual viagem: 1) data dentro da viagem, 2) lugar perto do destino, 3) se der mais de uma ou nenhuma, cartão "Para qual viagem?" (uma, várias, guardar para depois). E-mail apagado depois de lido. | **Crítica** |
| E2 | ✅ 1.5.14 (parte 1) **Compromissos fixos 🔒**: reserva com dia e hora aparece travada no dia certo do roteiro; o resto do dia é montado em volta. Cada reserva diz **quem ela cobre** (ex.: sogra com voo e hotel próprios). | Crítica |
| E3 | **Documentos da viagem** (o que hoje vai para o WhatsApp da família): fotos, prints, PDFs de ingresso, cartão de embarque e QR, por dia e por pessoa, protegidos, vistos pelos participantes; QR em tela cheia com brilho no máximo. | Alta |
| E4 | **Tela "Hoje" clara**: abre sozinha na viagem em andamento (sem depender do seletor lá em cima); próxima atividade, endereço, número do ingresso, onde almoçar perto, como ir (carro, transporte, a pé) e se é perto do hotel. | Alta |
| E5 | **Busca de lugar confiável**: o nome procurado sempre aparece, mesmo longe da viagem (feito 1.5.12: "Legítimo"). | Alta |
| E6 | **Botão "Imprevisto"** (correção de rota): passar o perdido para outro dia, achar algo parecido perto, puxar trecho de um roteiro alternativo. | Alta |
| E7 | **Aviso de chuva com antecedência** (véspera ou dois dias antes), chegando sozinho. | Alta |
| E8 | **"Desconectar o celular perdido"** de outro aparelho; acesso de qualquer aparelho com a conta (já existe), trava com digital (já existe). | Alta |

**Depois da viagem**

| # | Item |
|---|---|
| E9 | **Wizard de nova viagem**: quando (início e fim), quem vai, para onde (chegada e partida). Com isso as buscas já ficam limitadas. A IA é uma das ferramentas do wizard; modo manual sempre disponível. |
| E10 | **Roteiros alternativos guardados** (não apagados, em cinza), comparação de horários e preços, **escolha em grupo** (cada um marca a preferida). |
| E11 | **Banco de desejos** ("salvos do Instagram" com busca): guarda o lugar em si (nome, cidade, site, preço, foto); filtros por tipo (hotel, fazenda, praia, montanha, gastronomia), nacional/internacional, bate-volta de São Paulo, preço e quem combina; ao criar viagem, "você tem 3 desejos perto daqui"; roteiro@ também alimenta. |
| E12 | **Papéis por viagem**: dono (tudo, chaves, convites), editor (só aquela viagem), só leitura (sogra, pais, contato de segurança), **cópia do roteiro** para quem vai fazer a mesma viagem (sem reservas). |
| E13 | **Contatos de emergência** no wizard; **🆘 Preciso de ajuda** manda a localização; opcional "Estou bem?" (sem sinal do app por X horas → aviso). Canais grátis: e-mail (Resend) e Telegram; WhatsApp e SMS depois. |
| E14 | **Assistente "Estender a viagem"**: lista o que muda (voos, hotéis, carro, de cada reserva separada), com link, telefone e texto pronto. Não compete com companhias aéreas. |
| E16 | **✦ IA também responde sobre o próprio app** ("onde fica a opção X?", "para que serve Y?"): base de ajuda do app (telas, botões, passos) consultada por palavra-chave e entregue à IA junto da pergunta (RAG leve, sem banco de vetores); sem internet, mostra o trecho da ajuda direto. Pedido do dono em 03/Nov/2026, para depois da viagem. |
| E15 | Seletor de roteiro no topo: trocar só quando a pessoa quiser; o padrão é a próxima viagem. |

**Pedidos do dono em 11/Nov/2026 (próximas versões)** — sempre com **independência da IA**: tudo funciona por regras e
dados abertos; a IA, quando houver, só refina (ex.: escrever a lista com outras palavras), nunca é a base.

| # | Item | Como, sem depender de IA |
|---|---|---|
| E17 | **Arrumação das malas pela previsão**: lista por pessoa (idade), dias, lugar e clima previsto; marcável e compartilhada com a família. | Tabela de regras: dias × faixa de temperatura (Open-Meteo, já usado) × chuva × tipo de lugar (serra, praia, cidade) × atividades do roteiro (parque → tênis; Natal Luz à noite → casaco). Recalcula quando a previsão muda e avisa o que mudou. |
| E18 | **Lembretes e alertas no calendário** (convite por e-mail para Google, Outlook, iPhone) e **aviso quando a previsão muda**. | Gera `.ics` de cada compromisso e manda como convite pelo Resend; quando a chuva prevista cruza um limite num dia com atividade ao ar livre, manda atualização do evento + aviso (push ou e-mail). Liga com E7. |
| E19 | **Roteiros de datas passadas saem da lista** e vão para um **Arquivo**. | Viagem com fim antes de hoje sai do seletor e das listas; fica em "Arquivo", consultável e reutilizável ("fazer de novo", vira modelo para E12/E9). |
| E20 | **Planejar a ida até o embarque**: traslado até o aeroporto ou rodoviária, estimativa de trânsito, Uber/táxi, metrô/ônibus quando há pouca mala, chegada com antecedência pelo tipo de voo. | Regras de antecedência (internacional 3 h, nacional 1 h 30–2 h, rodoviária 30–45 min) + tempo de rota aberto (OSRM) com margem por horário de pico; transporte público pelos horários abertos (GTFS) quando a bagagem é pouca; link pronto para Uber/99/táxi. Vira compromisso "Sair de casa às 12:40" no roteiro, com lembrete. Mesma lógica na volta. |
| E21 | ✅ 1.5.40 **Compartilhar com quem não tem o app**: **PDF** e **página HTML navegável** do roteiro. | Página estática única (abre sem internet depois de baixada) e PDF pela impressão do navegador. Padrão sem dados sensíveis (sem localizadores, PINs e QR); opção de incluir com aviso. Mandar pelo WhatsApp ou e-mail. |

| E22 | **Uma pessoa, várias formas de entrar**: juntar Google (Gmail do trabalho) e e-mail pessoal (Yahoo) na mesma conta, em "Minha conta → Ligar outra forma de entrar". | Supabase *manual identity linking* (ligar no painel do Auth); a pessoa entra com uma e confirma a outra. Sem isso (1.5.35), cada forma é uma conta, e o convite aceita qualquer uma pelo código. |
| E23 | **RootifyONE: telas de família e convites**: viagens, membros e papéis, convites (e-mail, usos, validade, tentativas), quem usa a IA da família e o consumo. | Tudo já está no Supabase (tabelas `guiaxpert_membros`, `guiaxpert_convites`, `ia_uso`; funções `ia_disponivel`, `pode_usar_chaves_servico`); falta só a tela no admin. |

| E24 | **Orçamento da viagem (low budget / low cost)**: no wizard (por regras ou com IA), escolher o tipo de viagem (econômica, equilibrada, confortável) e o **escopo do orçamento**: só passeios (passagem e carro já comprados) ou a viagem toda. Teto total e por setor: logística (voo, carro, combustível, pedágio, estacionamento, traslados), hospedagem, passeios e ingressos, restaurantes, compras/imprevistos. O roteiro respeita os limites: sugere grátis e baratos primeiro, avisa quando passa do teto, soma o já comprado (Reservas) e mostra quanto sobra por dia e por pessoa (crianças com preço próprio). | Faixas de preço de cada lugar no catálogo (R$ a R$$$$ e preço de ingresso com data de verificação), valores reais das reservas e regras de soma e corte; o que é "low cost" vem das preferências da família (ex.: aceita hostel? só almoço fora? passeios grátis?). A IA, se houver, só sugere trocas. **Pedido do dono em 11/Nov/2026; antes de fazer, entrevistar o dono.** |

**Convite pela pessoa, não pelo jeito de entrar (1.5.35):** quem já é da viagem (ou o dono) abre qualquer convite e cai
direto na viagem, sem erro, mesmo com convite usado ou vencido. Entrou com o e-mail do convite (ou convite sem e-mail):
aceita. Entrou com outro e-mail (ex.: Google do trabalho): o app pede só o código do convite. Primeira vez com o e-mail
indicado: código + senha, conta já confirmada. Quem vem por convite nunca vê o código de acesso do app.

**Regra da IA no app (feito na 1.5.34):** o botão ✦ IA só aparece quando há IA de verdade para aquela pessoa: (1) chave
própria no aparelho, ou (2) chave guardada no servidor (Vault do Supabase, nunca no app) **e** a pessoa é da família, isto é,
da equipe ou convidada para uma viagem da equipe (`ia_disponivel()`, `pode_usar_chaves_servico()`). Outras famílias não
gastam as chaves do dono. Sem IA, nada some do app: só o assistente fica escondido.

## APK Android (fora da loja) e lojas

- **APK = o mesmo site empacotado** com **TWA** (Trusted Web Activity) pelo Bubblewrap do Google. Mesmo código,
  ícone próprio, tela cheia, notificação. Passos: `npx @bubblewrap/cli init --manifest https://solverone.com.br/guiaxpert/manifest.json`
  → `build` → gera `app-release-signed.apk`. Exige publicar `/.well-known/assetlinks.json` **na raiz do domínio**
  (repositório do Portal). Depois, o mesmo pacote vai para a Play Store sem refazer.
- **iPhone:** fora da loja não existe APK; usa-se o app instalado pelo Safari (funciona offline e com notificação
  no iOS 16.4+). App Store: conta Apple (US$ 99/ano) + empacotar com Capacitor e acrescentar recursos nativos
  (a Apple recusa app que é "só um site").
- **GPS com o app fechado** (acompanhar a família) só no app nativo.

## Decisões pendentes do dono

- Anúncios no GuiaXpert (público premium): hoje desligados.
- Planos: o que o visitante, o degustação e o premium podem usar (`servicos/guiaxpert.json` está com tudo liberado e `aConfirmar`).
- Hoje o uso é pessoal. Clima: Open-Meteo com reserva automática em MET Norway e wttr.in. Se um dia vender assinatura: MET Norway como 1ª opção (permite uso comercial) ou plano comercial da Open-Meteo; tiles do OSM por provedor próprio.
- Registrar a marca GuiaXpert no INPI (classes 9, 35, 39, 41, 42) e o domínio `guiaxpert.com.br`.
