# Base aberta de lugares (FSQ OS Places) — opcional

Caminho para busca de bares, restaurantes e comércio **sem limite de cache** e sem chave de API: a base aberta
**FSQ OS Places** do Foursquare (licença Apache 2.0, ~100 milhões de lugares, atualizada todo mês).
Hoje o app usa a API do Foursquare (chave `FOURSQUARE_KEY`). Este caminho fica pronto para o dia do uso em escala.

Crédito obrigatório (já está no app): **Powered by Foursquare**.

## 1. Baixar os parquet (uma vez, ~12 GB para o mundo todo)

Escolha um:

- **Hugging Face** (precisa de conta e aceitar os termos em https://huggingface.co/datasets/foursquare/fsq-os-places):
  `pip install huggingface_hub` e
  `hf download foursquare/fsq-os-places --repo-type dataset --include "release/dt=2026-10-15/places/parquet/*" --local-dir ./fsq`
- **S3 público** (AWS CLI, sem conta): `aws s3 cp --no-sign-request --recursive s3://fsq-os-places-us-east-1/release/dt=2026-10-15/places/parquet/ ./fsq/parquet/`

Troque a data pelo lançamento mais novo (lista em `release/`).

## 2. Recortar

`pip install duckdb` e depois:

```
# Brasil inteiro, para a tabela do servidor
python3 recortar.py --de ./fsq/parquet --pais BR --csv lugares-br.csv.gz

# só uma cidade, para o pacote offline (bbox oeste,sul,leste,norte)
python3 recortar.py --de ./fsq/parquet --bbox="-51.0,-29.48,-50.72,-29.22" --json gramado.lugares.json
```

O script guarda só o que interessa ao guia (comer, bebidas, doces, atrações, logística) e descarta fechados.
Estimativa para o Brasil: 1 a 2 milhões de linhas, 150 a 300 MB na tabela com índices.

## 3. Carregar no Supabase

1. Rode `supabase/2026-10-31-lugares-abertos.sql` (já aplicado em 31/Out/2026: tabela vazia, função de busca, índices).
2. Pegue a string de conexão em Supabase → Project Settings → Database (modo *session*, porta 5432).
3. Carregue com o `psql`:
   ```
   zcat lugares-br.csv.gz | psql "postgresql://postgres.<ref>:<senha>@<host>:5432/postgres" \
     -c "\copy public.lugares_abertos (fsq_id,nome,categoria,subcategoria,rotulos,endereco,cidade,uf,pais,tel,site,lat,lng,fechado) from stdin with (format csv, header true, null '')"
   ```
   Para atualizar com um lançamento novo: `truncate public.lugares_abertos;` e carregue de novo.

## 4. Ligar

A função `lugares` (Edge Function) escolhe sozinha: com `FOURSQUARE_KEY` usa a API; sem chave usa esta base.
Para forçar: segredo `FONTE_LUGARES=aberta` (ou `api`). Nada muda no app.

Teste rápido logado: `select * from public.buscar_lugares_abertos('legitimo', -23.6, -46.63);`

## Pacote offline

O JSON gerado com `--json` tem o mesmo formato dos lugares do pacote (`docs/FORMATO-PACOTE.md`). Para entrar no
pacote de uma cidade, copie os itens de `lugares` para o pacote no RootifyONE (ou `pacotes/<id>.json`).
