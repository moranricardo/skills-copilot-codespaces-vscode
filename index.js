// index.js - Módulo de Conexión Gerrit (Telemetría Refinada - ESM)
import https from 'https';
import fs from 'fs';

// Configuración sobre Código: Parámetros del ecosistema
const CONFIG = {
  gerritHost: 'android-review.googlesource.com',
  // Consultamos los últimos cambios con detalle de etiquetas para ver aprobaciones
  endpoint: '/changes/?q=status:open&n=5&o=LABELS',
  stateFile: './state.json'
};

/**
 * Sanea el prefijo místico anti-XSS de Gerrit y parsea el JSON de forma segura
 */
function sanitizeGerritResponse(rawData) {
  const antiXSSPrefix = ")]}'\n";
  if (rawData.startsWith(antiXSSPrefix)) {
    return JSON.parse(rawData.substring(antiXSSPrefix.length));
  }
  return JSON.parse(rawData);
}

/**
 * Lee la memoria histórica guardada en el archivo de estado central
 */
function readCurrentState() {
  try {
    if (fs.existsSync(CONFIG.stateFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf8'));
    }
  } catch (error) {
    console.error('[Apofis] Error leyendo el estado actual:', error.message);
  }
  return { last_pulse: new Date().toISOString(), alerts: [], tracked_changes: {} };
}

/**
 * Ejecuta la auditoría del pulso y refina la telemetría ante pérdidas de Code-Review +2
 */
function auditPulseAndRefineTelemetry() {
  const options = {
    hostname: CONFIG.gerritHost,
    path: CONFIG.endpoint,
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  };

  console.log(`[Ra Pulse] Conectando con las puertas de ${CONFIG.gerritHost} para auditoría...`);

  const req = https.get(options, (res) => {
    let rawData = '';

    res.on('data', (chunk) => { rawData += chunk; });

    res.on('end', () => {
      try {
        if (res.statusCode !== 200) {
          throw new Error(`Error HTTP: Código de estado ${res.statusCode}`);
        }

        const cambios = sanitizeGerritResponse(rawData);
        const state = readCurrentState();
        
        // Asegurar que las llaves esenciales existan en el estado
        if (!state.alerts) state.alerts = [];
        if (!state.tracked_changes) state.tracked_changes = {};

        console.log(`\n[Maat] Evaluando e hilando telemetría para ${cambios.length} cambios abiertos:`);

        cambios.forEach(cambio => {
          const changeId = cambio.change_id;
          const codeReview = cambio.labels && cambio.labels['Code-Review'];
          
          // Comprobar si el parche tiene actualmente la aprobación definitiva (+2)
          const tieneAprobacionActual = !!(codeReview && codeReview.approved);

          // Buscar el registro histórico en nuestro state.json previo
          const historialPrevio = state.tracked_changes[changeId];

          // 🚨 DETECTOR DE ALERTAS: Si antes tenía +2 y ahora ya no lo tiene
          if (historialPrevio && historialPrevio.had_plus_two && !tieneAprobacionActual) {
            console.warn(`\n🚨 ALERTANOMALÍA: El cambio [${cambio._number}] perdió su Code-Review +2`);
            
            state.alerts.push({
              timestamp: new Date().toISOString(),
              change_id: changeId,
              number: cambio._number,
              subject: cambio.subject,
              type: "LOSS_OF_CODE_REVIEW_PLUS_TWO",
              message: "Se ha revocado la aprobación crítica en el servidor de Gerrit."
            });
          }

          // Actualizar el mapa de seguimiento con el estado actual
          state.tracked_changes[changeId] = {
            number: cambio._number,
            subject: cambio.subject,
            had_plus_two: tieneAprobacionActual,
            updated_at: cambio.updated
          };
        });

        // Guardar el pulso sincronizado
        state.last_pulse = new Date().toISOString();
        fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
        
        console.log(`\n✨ Telemetría refinada guardada con éxito en ${CONFIG.stateFile}`);

      } catch (error) {
        console.error('[Apofis] Error al procesar los datos analíticos:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('[Apofis] Error de comunicación en la red:', error.message);
  });

  req.end();
}

// Iniciar el análisis de telemetría avanzada
auditPulseAndRefineTelemetry();
