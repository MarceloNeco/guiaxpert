# GuiaXpert — arquitetura

Leia antes de mexer. Serve para qualquer pessoa ou IA que for alterar este repositório.

## O que é

Guia de viagem e de cidade para famílias: perfil de quem viaja, várias viagens, várias opções de roteiro por
viagem, favoritos, lista de lugares, mapa, previsão do tempo e reservas guardadas com segurança. Funciona sem
internet depois da primeira abertura. É um app da plataforma **SolverONE**, controlado pelo **RootifyONE**.

HTML, CSS e JavaScript puros. Sem framework, sem passo de build. Abra e edite.

- Endereço: `solverone.com.br/guiaxpert/` (repositório `guiaxpert`, GitHub Pages)
- Conta e acesso: Supabase `solverone-app` (a mesma conta de todos os apps)
- Gaveta de dados no navegador: `guiaxpert` (IndexedDB `guiaxpert`, `localStorage` com prefixo `dgo:guiaxpert:`)

## Arquivos

| Arquivo | O que faz | Mexer? |
|---|---|---|
| `index.html` | casca: cabeçalho (☰ marca · PT/EN 🔍 ⚙ 🏠 👤), gaveta, `<main>`, barra de baixo e a ORDEM dos scripts | pouco |
| `styles.css` | aparência: linguagem das placas de estrada (marrom = passeio, verde = ação e contagem, amarelo = agora/ama), fonte Overpass em `vendor/fontes/`, cores em variáveis (claro/escuro) | sim |
| `config.js` | URL e chave **pública** do Supabase, modo de acesso, endereço dos pacotes | só valores |
| `js/textos.js` | todo texto da tela em PT e EN | a cada texto novo |
| `js/banco.js` | `Banco`: lojas no IndexedDB no **formato das futuras tabelas** + fila para a nuvem | com cuidado |
| `js/biometria.js` | `Bio`: digital ou rosto deste aparelho (WebAuthn + PRF). Uma leitura gera duas chaves: `sessao` (tranca a sessão ao sair, para voltar sem senha) e `cofre` (abre as reservas). Sem PRF, não liga | **não**, sem revisão |
| `js/cofre.js` | `Cofre`: PIN (PBKDF2 600 mil) + código de recuperação embrulham a chave AES-GCM que embaralha reservas e comida/alergias | **não**, sem revisão |
| `js/pacotes.js` | `Pacotes`: lê o pacote de cidade (central → local → cópia no aparelho) | pouco |
| `js/geo.js` | `Geo`: GPS (só com toque), distância, links de rota (Google Maps, Waze) | pouco |
| `js/clima.js` | `Clima`: Open-Meteo, guarda 1 h, avisos práticos | pouco |
| `js/gostos.js` | `Gostos`: catálogo de 249 gostos em 15 temas (PT/EN), ciclo curte → ama → evita, soma do grupo, "combina" com lugares e resumo para a IA | ao acrescentar gosto |
| `js/descobrir.js` | `Descobrir`: OpenStreetMap (Overpass) e roteiro pela IA da pessoa (`DGO.ia`) | sim |
| `js/contexto.js` | `Contexto`: VIAGEM ou EXPLORAR (meta `contexto`); automático = entra na viagem em curso | pouco |
| `js/offline.js` | `Offline`: arquivo de mapa por cidade (.pmtiles) baixado inteiro e guardado no Cache Storage; fundo vetorial; 'Guardar para usar sem internet' | com cuidado |
| `js/mapa.js` | `Mapa.tela`: mapa + busca + filtros + painel (lista/cartão); pontos do dia numerados e com linha; cores por situação | sim |
| `js/explorar.js` | `Explorar`: cidade por GPS ou busca, descobrir (OSM), salvar, pôr numa viagem, planejar hoje aqui | sim |
| `js/importar.js` | `Importar`: e-mail de reserva → candidatos (regras no aparelho; IA opcional com aviso); `doEndereco` lê o que chegou por Compartilhar | sim |
| `js/nuvem.js` | `Nuvem`: sincroniza pessoas, viagens, roteiros, favoritos e lugares com `guiaxpert_dados` (baixa o que mudou, sobe a fila; vence o mais novo). Nunca sobe reservas nem `restricoes` | com cuidado |
| `js/conta.js` | `Conta`: login REST, sessão comum `solverone.sessao.v1`, `acesso_app`, códigos de degustação | com cuidado |
| `js/app.js` | telas, navegação (`Nav`) e wizard "Nova viagem" | sim |
| `mapas/indice.json`, `mapas/<id>.pmtiles` | mapas de fundo por cidade (gerados com `pmtiles extract` do build Protomaps; bbox e zoom no índice) | ao publicar cidade |
| `pacotes/indice.json`, `pacotes/<id>.json` | pacotes de cidade (formato em `docs/FORMATO-PACOTE.md`) | ao publicar cidade |
| `vendor/leaflet/` | biblioteca do mapa (hospedada, sem CDN) | não |
| `diretrizes.js` | módulo comum SolverONE (igual em todos os apps) | **não** — troque pela versão nova |
| `diretrizes-config.js` | ajustes do módulo para o GuiaXpert | pouco |
| `sw.js`, `manifest.json`, `icone-*.png` | instalar e abrir sem internet | só subir a `VERSAO` do `sw.js` a cada release |
| `versoes.json` | o que cada versão trouxe | a cada versão |
| `supabase/*.sql` | SQL para rodar **uma vez** (data no nome) | só acrescentar arquivo novo |
| `teste/sql-grants.js` | verificador: todo CREATE no SQL tem GRANT (`node teste/sql-grants.js supabase`) | não (vem do rootify-one) |

## Regras que não se quebram

1. **Nenhum segredo no código.** Só URL e publishable key do Supabase (públicas). Chave de IA é da pessoa e fica no cofre do módulo.
2. **Quem libera é o banco.** O app só pergunta `acesso_app('guiaxpert')`. Esconder tela no JavaScript não protege nada.
3. **Texto da pessoa nunca vai por `innerHTML`.** Use `h()` (vira `textContent`). `svg` em `h()` só com ícone fixo do código.
4. **Dado sensível só embaralhado:** reservas e comida/alergias/dieta (saúde e religião, LGPD art. 11) passam pelo `Cofre`.
5. **Nome de pessoa nunca vai para a IA** (LGPD art. 14 para crianças): `Descobrir.resumoGrupo` manda só faixa, idade e cuidados.
6. **Módulos de tela** (mapa, explorar) só falam com `app.js` por `window.GX` (ajudantes publicados no fim do app.js).
7. **Histórico do navegador só pelo `Nav`** (o Voltar do celular navega dentro do app; camada = gaveta, busca, janela).
7. **Todo texto nasce em PT e EN** em `js/textos.js`.
8. **Formato das lojas = formato das tabelas.** Campo novo entra nos dois (ver "Nuvem").
9. **Localização só com toque**, aproximada no aparelho, nunca para a nuvem.

## Como as peças conversam

```
abrir → Conta.lerVolta (#access_token só se este aparelho pediu)
      → Conta.acesso()  ── não liberado → tela Entrar (login / código de degustação)
                        └─ liberado → Banco (viagem atual) → Pacotes.carregar → telas
roteiro: viagem.opcao_ativa → loja roteiros (várias opções; pacote | manual | ia)
         editar opção do pacote = cria cópia "minha versão" (o pacote nunca muda)
dia da viagem → dia do modelo: 1º = chegada, último = volta, meio = repete os do meio
```

## Família: membros e convites

- `guiaxpert_membros (viagem_id, user_id, papel edita|ve, dono)` e `guiaxpert_convites` (só o hash do token).
  `guiaxpert_dados` tem `viagem_id` e chave `(loja, id)`: um roteiro é UMA linha, editada por quem tem papel.
- RLS: dono vê tudo o seu; membro vê viagens/roteiros/lugares/favoritos da viagem (e as pessoas que ela inclui, via
  `guiaxpert_pessoa_compartilhada`, security definer para não haver recursão); `edita` muda roteiros/lugares/favoritos;
  reservas e cofre nunca. Funções: `guiaxpert_criar_convite`, `aceitar_convite`, `listar_membros`, `mudar_membro`, `sair_viagem`.
- App: link `#convite=TOKEN` fica guardado até a pessoa entrar; `estado.papel` vem de `Nuvem.papel()` (evento `gx:papeis`);
  `podeEditar()` esconde os botões de edição para quem só vê (o banco recusa de qualquer jeito).

## Cofre em mais de um celular

- A chave de dados nasce no aparelho. Sobem para a conta: as reservas (cifradas) e o embrulho da chave pelo
  **código de recuperação** (loja `cofre`, id `recuperacao`, 100 bits). O embrulho pelo PIN e o da digital NÃO sobem.
- Celular novo: `caixaTrazerCofre` → QR do celular antigo (`Cofre.exportarChave` → `GXK1:<base64>`, lido por câmera
  ou colado) ou código de recuperação (`Cofre.importarPorCodigo`); em ambos, PIN próprio do aparelho.

## Entrar e digital/rosto

- Primeiro login: senha, Google ou código de 6 números por e-mail (`Conta.enviarCodigo` / `confirmarCodigo`, só conta existente).
- Depois, convite único para ligar digital/rosto (`oferecerBio`). A passkey é só deste aparelho (rp = domínio do site);
  o segredo PRF nunca sai do celular.
- "Sair (volto com digital)": a sessão é embaralhada com a chave `sessao` e guardada em `guiaxpert.volta`; o servidor NÃO
  encerra. Ao voltar, a digital desembaralha e o app renova o token no servidor (se a sessão morreu, pede e-mail).
- "Sair e desligar digital": encerra no servidor e apaga `guiaxpert.volta` e o embrulho do cofre.
- Login por passkey no servidor (qualquer aparelho, sem 1º login) existe no Supabase como experimental e está desligado
  (Authentication → Passkeys). Não usado.

## Perfil fixo e perfil da viagem

- `pessoa.grupo`: `familia` (vem marcada em toda viagem nova), `convidado` (fica guardado) ou `viagem` (só de uma viagem;
  apagada junto com a última viagem em que estava).
- `viagem.ajustes[pessoaId]`: só as DIFERENÇAS para aquela viagem (`mobilidade`, `calor`, `frio`, `soneca`, `gostos`;
  em `gostos`, 0 = "não nesta viagem"). `perfilNaViagem(p, v)` junta perfil fixo + ajustes; `pessoasDaViagem()` já
  devolve juntado e é o que lugares, IA e clima usam. Comida/alergias não têm ajuste (ficam só no cofre do perfil fixo).

## Nuvem (ligada na 0.5.0)

Tabela única `guiaxpert_dados` (`supabase/2026-10-30-nuvem-guiaxpert.sql`): `user_id`, `loja`, `id`, `dados` jsonb,
`atualizado_em` (aparelho), `recebido_em` (servidor). RLS: cada um só o seu; GRANT só para `authenticated`.
Sincronia: baixa por `recebido_em`, sobe a fila; vence o `atualizado_em` mais novo, registro a registro.
Reservas e `restricoes` NÃO sobem (a chave do cofre é do aparelho; mandar o PIN embrulhado permitiria força bruta).
Aparelho usado por outra conta não mistura (`meta nuvem-dono`).

## Acesso e RootifyONE

- SQL: `supabase/2026-10-30-acesso-por-app-e-codigos.sql` (genérico: serve para qualquer app).
- Liberado = plano ativo em `assinaturas` (lista de liberados e pré-liberação por e-mail que o RootifyONE já usa)
  **ou** código de degustação válido em `acessos_app`.
- Códigos: `admin_criar_codigo('guiaxpert', dias, valido_ate, usos_max, nota)` devolve o texto UMA vez; o banco
  guarda só o SHA-256. Listar e desativar: `admin_listar_codigos`, `admin_desativar_codigo`. Tudo vai para `acesso_log`.
- Sem internet: vale a última conferência por `DIAS_SEM_INTERNET` dias (config), nunca depois da validade.
- Catálogo: `solverone-dados/apps.json` e `servicos/guiaxpert.json`.
