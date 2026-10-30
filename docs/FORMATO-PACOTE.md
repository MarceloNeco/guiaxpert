# Formato do pacote de cidade (formato 1)

Um pacote é um arquivo `pacotes/<id>.json` (e, quando o RootifyONE publicar, `solverone-dados/conteudo/guiaxpert/pacotes/<id>.json`).
O índice `pacotes/indice.json` lista os pacotes disponíveis. **Pacote é público: nunca põe dado pessoal** (nome,
código de reserva, telefone de pessoa).

```json
{
  "formato": 1,
  "id": "gramado",                       // a-z, 0-9 e hífen; é o nome do arquivo
  "nome": { "pt": "Gramado e Canela", "en": "Gramado and Canela" },
  "uf": "RS", "pais": "BR",
  "centro": { "lat": -29.3789, "lng": -50.8744 },   // previsão do tempo e busca OSM
  "atualizadoEm": "2026-10-30",
  "fonte": "como a pesquisa foi feita",
  "aviso": { "pt": "…", "en": "…" },
  "eventos": [ { "id": "natal-luz", "nome": "Natal Luz", "inicio": "2026-10-22", "fim": "2027-01-17" } ],
  "lugares": [ {
    "id": "mini-mundo", "nome": "Mini Mundo",
    "categoria": "comer | atracao | bebidas | doces | logistica",
    "subcategoria": "fondue | pizza-massas | cafe-colonial | restaurante | gratis | cerveja | chocolate | … | null",
    "descricao": "…", "endereco": "…", "site": "https://…", "telefone": "…",
    "horario": "…", "reserva": "…", "preco": "… (com a data da fonte)", "criancas": "…",
    "confianca": "oficial | guia | baixa", "gratis": false,
    "lat": -29.38, "lng": -50.87, "geoFonte": "endereco | nome"
  } ],
  "roteiros": [ {
    "id": "natal-luz-classico", "nome": "Natal Luz clássico",
    "dias": [ { "ordem": 1, "titulo": "Chegada",
      "itens": [ { "hora": "10:00", "titulo": "Mini Mundo", "nota": "…", "tipo": "gratis | ingresso | null", "lugarId": "mini-mundo" } ] } ]
  } ]
}
```

Regras:
- O 1º dia do roteiro é sempre a chegada e o último a volta; os dias do meio se repetem quando a viagem é mais longa.
- `confianca: "baixa"` mostra "Confirme antes de ir". Preço sempre com a data da fonte.
- Coordenadas: preferir o endereço (Nominatim, no máximo 1 pedido por segundo); citar "© OpenStreetMap contributors".
- Para gerar um pacote novo, rode uma pesquisa como a de Gramado (relatório em `docs/pesquisa/`) e converta.
