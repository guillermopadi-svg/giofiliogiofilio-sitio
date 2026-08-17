#!/usr/bin/env bash
# Reescribe el dominio absoluto (canonical, Open Graph, schema.org, sitemap)
# Uso:  ./set-domain.sh https://mi-sitio.vercel.app
set -e
NUEVO="${1:?Uso: ./set-domain.sh https://tu-dominio.com}"
NUEVO="${NUEVO%/}"
ACTUAL=$(grep -om1 'rel="canonical" href="https\?://[^/"]*' index.html | sed 's/.*href="//')
echo "Reemplazando $ACTUAL  →  $NUEVO"
grep -rl "$ACTUAL" . --include=*.html --include=*.xml --include=*.txt \
  | xargs sed -i.bak "s|$ACTUAL|$NUEVO|g"
find . -name "*.bak" -delete
echo "Listo."
