#!/bin/sh
# Проставляет версию файлов в index.html, чтобы телефоны не держали старый кэш. Запускать перед коммитом.
cd "$(dirname "$0")/.." || exit 1
v=$(date +%Y%m%d%H%M)
sed -i.bak -E "s#(css/style\.css)(\?v=[^\"]*)?#\1?v=$v#; s#(js/app\.js)(\?v=[^\"]*)?#\1?v=$v#; s#(js/characters\.js)(\?v=[^\"]*)?#\1?v=$v#; s#window\.APP_V=\"[^\"]*\"#window.APP_V=\"$v\"#" index.html && rm -f index.html.bak
echo "version $v"
