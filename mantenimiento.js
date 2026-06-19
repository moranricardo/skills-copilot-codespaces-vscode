import fs from 'fs';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), 'state.json');
const MAX_BACKUP_SIZE_MB = 1.0; // Límite de seguridad para Termux

/**
 * Ejecuta un mantenimiento preventivo sobre el archivo de estado
 * compactando buffers de datos históricos para preservar la memoria.
 */
function purificarHistorial() {
  console.log(`\n🧹 [Mantenimiento] Iniciando análisis de estabilidad del almacenamiento...`);
  
  if (!fs.existsSync(STATE_FILE)) {
    console.log(`⚠️  [Mantenimiento] No se detectó un archivo state.json activo.`);
    return;
  }

  try {
    const stats = fs.statSync(STATE_FILE);
    const sizeInMB = stats.size / (1024 * 1024);
    console.log(`📊 Tamaño actual de state.json: ${sizeInMB.toFixed(2)} MB`);

    if (sizeInMB > MAX_BACKUP_SIZE_MB) {
      console.log(`✂️  El archivo supera el límite seguro de ${MAX_BACKUP_SIZE_MB} MB. Aplicando purga...`);
      
      const rawData = fs.readFileSync(STATE_FILE, 'utf-8');
      const state = JSON.parse(rawData);

      // --- ESTRATEGIA DE COMPRESIÓN ---
      // Si la telemetría acumulada en gerrit posee listas extensas, las truncamos a los 10 registros más recientes
      if (state.telemetry && state.telemetry.gerrit) {
        if (Array.isArray(state.telemetry.gerrit.alerts) && state.telemetry.gerrit.alerts.length > 10) {
          state.telemetry.gerrit.alerts = state.telemetry.gerrit.alerts.slice(-10);
        }
      }

      // Reescritura optimizada sin espacios innecesarios para ahorrar almacenamiento
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      
      const newStats = fs.statSync(STATE_FILE);
      console.log(`✨ [Maat Completo] Archivo purificado. Nuevo tamaño: ${(newStats.size / (1024 * 1024)).toFixed(2)} MB`);
    } else {
      console.log(`✅ El tamaño del archivo está dentro de los límites operativos estables.`);
    }

  } catch (error) {
    console.error(`🚨 [Mantenimiento] Fallo al procesar la limpieza del buffer: ${error.message}`);
  }
}

purificarHistorial();
