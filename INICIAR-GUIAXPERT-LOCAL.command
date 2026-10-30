#!/bin/sh
# GuiaXpert - liga o servidor local e abre o app em http://localhost:5500 (Mac/Linux)
cd "$(dirname "$0")"
( sleep 4; open http://localhost:5500 2>/dev/null || xdg-open http://localhost:5500 ) &
npx serve . -l tcp://127.0.0.1:5500
