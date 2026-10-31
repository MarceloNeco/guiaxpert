#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recorta a base aberta FSQ OS Places (Foursquare, licença Apache 2.0) para o GuiaXpert.

Gera dois produtos a partir dos arquivos parquet do lançamento:
  1. CSV (gzip) para carregar na tabela `lugares_abertos` do Supabase (busca no servidor);
  2. opcionalmente um JSON de lugares para entrar no pacote offline de uma cidade (bbox).

Fontes dos parquet (escolha uma):
  --de pasta/      arquivos já baixados (recomendado: baixe uma vez, recorte quantas vezes quiser)
  --de hf          Hugging Face (dataset foursquare/fsq-os-places; exige aceitar os termos e um token: HF_TOKEN=hf_...)
  --de s3          bucket público s3://fsq-os-places-us-east-1 (AWS CLI: aws s3 cp --no-sign-request ...)

Exemplos:
  python3 recortar.py --de ./parquet --pais BR --csv lugares-br.csv.gz
  python3 recortar.py --de ./parquet --bbox -51.0,-29.48,-50.72,-29.22 --json gramado.lugares.json
  HF_TOKEN=hf_xxx python3 recortar.py --de hf --lancamento 2026-10-15 --pais BR --csv lugares-br.csv.gz

Colunas usadas do FSQ OS Places: fsq_place_id, name, latitude, longitude, address, locality, region, postcode,
country, tel, website, fsq_category_labels, date_closed. Nada de dado pessoal: é base de estabelecimentos.
Crédito obrigatório no app: "Powered by Foursquare".
"""
import argparse, csv, gzip, json, os, sys

CATEGORIAS = [  # (regex sobre os rótulos em inglês do Foursquare, categoria do guia, subcategoria)
    (r"Ice Cream|Gelato|Frozen Yogurt", "doces", "sorvete"),
    (r"Chocolat|Dessert|Bakery|Pastry|Candy|Cupcake|Donut|Creperie", "doces", "chocolate"),
    (r"\bBar\b|Pub\b|Brewery|Beer|Wine|Nightlife|Lounge|Night Club|Cocktail", "bebidas", "bar"),
    (r"Caf[eé]|Coffee|Tea Room", "comer", "cafe"),
    (r"Restaurant|Pizzeria|Burger|Steakhouse|Sushi|Diner|Bistro|Food Truck|Snack|Sandwich|Taco|BBQ|Churrasc", "comer", "restaurante"),
    (r"Museum|Art Gallery|History|Exhibit", "atracao", "museu"),
    (r"Scenic Lookout|Viewpoint|Mountain|Waterfall|Lake|Beach|Trail", "atracao", "mirante"),
    (r"\bPark\b|Zoo|Garden|Theme Park|Amusement|Playground|Aquarium|Water Park", "atracao", "parque"),
    (r"Theater|Cinema|Movie|Concert|Stadium|Arena|Event Space|Church|Cathedral|Monument|Landmark|Historic|Plaza|Winery|Vineyard|Tour", "atracao", None),
    (r"Parking|Gas Station|Fuel|Pharmacy|Drugstore|Hospital|Emergency|Clinic|Supermarket|Grocery|Bank|ATM|Bus Station|Airport|Train Station|Car Rental|Tourist Information", "logistica", None),
    (r"Hotel|Lodging|Hostel|Resort|Bed and Breakfast|Inn\b|Vacation Rental", "logistica", "hospedagem"),
]
import re
CATEGORIAS = [(re.compile(p, re.I), c, s) for p, c, s in CATEGORIAS]

def categoria(rotulos):
    texto = " | ".join(rotulos or [])
    for rx, c, s in CATEGORIAS:
        if rx.search(texto):
            return c, s
    return None, None   # fora do guia (escritório, loja de pneu…): não entra


def fontes(args):
    if args.de in ("hf", "s3"):
        padrao = "release/dt=%s/places/parquet/*.parquet" % args.lancamento
        if args.de == "hf":
            return "hf://datasets/foursquare/fsq-os-places/" + padrao
        return "s3://fsq-os-places-us-east-1/" + padrao
    pasta = args.de.rstrip("/")
    if not os.path.isdir(pasta):
        sys.exit("pasta não encontrada: " + pasta)
    return pasta + "/*.parquet"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--de", required=True, help="pasta com .parquet, ou 'hf', ou 's3'")
    ap.add_argument("--lancamento", default="2026-10-15", help="data do lançamento (dt=AAAA-MM-DD) para hf/s3")
    ap.add_argument("--pais", help="código(s) de país, ex.: BR ou BR,AR,UY")
    ap.add_argument("--bbox", help="oeste,sul,leste,norte em graus, ex.: -51.0,-29.48,-50.72,-29.22")
    ap.add_argument("--csv", help="saída CSV gzip para a tabela lugares_abertos")
    ap.add_argument("--json", help="saída JSON de lugares para pacote offline (use com --bbox)")
    ap.add_argument("--incluir-fechados", action="store_true", help="mantém lugares com date_closed")
    args = ap.parse_args()
    if not (args.pais or args.bbox):
        sys.exit("informe --pais e/ou --bbox")
    if not (args.csv or args.json):
        sys.exit("informe --csv e/ou --json")

    import duckdb
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    if args.de == "hf":
        tok = os.environ.get("HF_TOKEN")
        if not tok:
            sys.exit("defina HF_TOKEN (aceite os termos em huggingface.co/datasets/foursquare/fsq-os-places)")
        con.execute("CREATE SECRET hf (TYPE HUGGINGFACE, TOKEN '%s');" % tok.replace("'", ""))
    if args.de == "s3":
        con.execute("SET s3_region='us-east-1'; CREATE SECRET s3 (TYPE S3, PROVIDER config);")

    cond = []
    if args.pais:
        cond.append("country IN (%s)" % ",".join("'%s'" % p.strip().upper() for p in args.pais.split(",")))
    if args.bbox:
        o, s, l, n = [float(x) for x in args.bbox.split(",")]
        cond.append("longitude BETWEEN %f AND %f AND latitude BETWEEN %f AND %f" % (o, l, s, n))
    if not args.incluir_fechados:
        cond.append("date_closed IS NULL")
    cond.append("name IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL")

    sql = """
      SELECT fsq_place_id, name, latitude, longitude, address, locality, region, postcode, country, tel, website,
             fsq_category_labels, date_closed
      FROM read_parquet('%s') WHERE %s
    """ % (fontes(args), " AND ".join(cond))
    print("lendo…", file=sys.stderr)
    cur = con.execute(sql)

    n_lidos = n_guia = 0
    saida_csv = saida_json = None
    if args.csv:
        saida_csv = gzip.open(args.csv, "wt", encoding="utf-8", newline="")
        w = csv.writer(saida_csv)
        w.writerow(["fsq_id", "nome", "categoria", "subcategoria", "rotulos", "endereco", "cidade", "uf", "pais", "tel", "site", "lat", "lng", "fechado"])
    lista_json = []
    while True:
        lote = cur.fetchmany(5000)
        if not lote:
            break
        for (fid, nome, lat, lng, end, cid, uf, cep, pais, tel, site, rot, fechado) in lote:
            n_lidos += 1
            rot = list(rot or [])
            cat, sub = categoria(rot)
            if not cat:
                continue
            n_guia += 1
            endereco = ", ".join([x for x in [end, cid, uf] if x])
            if saida_csv:
                w.writerow([fid, nome, cat, sub or "", "{" + ",".join('"%s"' % r.replace('"', '') for r in rot) + "}", endereco, cid or "", uf or "", pais or "",
                            tel or "", site or "", round(float(lat), 5), round(float(lng), 5), fechado or ""])
            if args.json:
                lista_json.append({"id": "fsq-" + fid, "nome": nome, "categoria": cat, "subcategoria": sub,
                                   "descricao": ", ".join(r.split(" > ")[-1] for r in rot[:2]) or None,
                                   "endereco": endereco or None, "site": site or None, "telefone": tel or None, "horario": None,
                                   "reserva": None, "preco": None, "criancas": None, "confianca": "foursquare", "gratis": False,
                                   "lat": round(float(lat), 5), "lng": round(float(lng), 5), "fonte": "Foursquare"})
    if saida_csv:
        saida_csv.close()
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump({"formato": 1, "fonte": "FSQ OS Places %s (Apache 2.0) · Powered by Foursquare" % args.lancamento, "lugares": lista_json}, f, ensure_ascii=False)
    print("lidos: %d · no guia: %d" % (n_lidos, n_guia), file=sys.stderr)


if __name__ == "__main__":
    main()
