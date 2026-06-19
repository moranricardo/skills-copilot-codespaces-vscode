#!/usr/bin/env bash

# Intervalo en segundos (5 minutos = 300 segundos)
INTERVAL=300

echo "🚀 Lanzando Demonio [Ra Pulse] en segundo plano..."
echo "📊 Monitoreando ecosistemas cada $INTERVAL segundos."
echo "📝 Los registros de salida se guardarán en: ./pulse.log"

while true; do
  # Ejecuta el auditor y redirige marcas de tiempo al log
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Executing cron pulse..." >> ./pulse.log
  node index.js >> ./pulse.log 2>&1
  
  # Espera antes del siguiente ciclo
  sleep $INTERVAL
done
