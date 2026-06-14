// index.js - Módulo de Conexión Gerrit (Radio Maestro - ESM)
import https from 'https';
import fs from 'fs';

// Configuración sobre Código: Parámetros del endpoint
const CONFIG = {
  gerritHost: 'android-review.googlesource.com',
  path: '/changes/?q=status:open&n=5',
  stateFile: './state.json'
};

/**
 * Filtra y sanea la respuesta mística de Gerrit (Elimina el prefijo anti-XSS)
 */
function sanitizeGerritResponse(rawData) {
  const antiXSSPrefix = ")]}'\n";

  if (rawData.startsWith(antiXSSPrefix)) {
    return JSON.parse(rawData.substring(antiXSSPrefix.length));
  }

  return JSON.parse(rawData);
}

/**
 * Reporta el pulso y la salud del módulo al sistema central
 */
function reportTelemetry(status, message) {
  const state = {
    timestamp: new Date().toISOString(),
    radio: "skills-copilot-codespaces",
    status: status,
    log: message
  };
  fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
}

/**
 * Ejecuta la consulta al endpoint de Gerrit
 */
function fetchGerritPulse() {
  const options = {
    hostname: CONFIG.gerritHost,
    path: CONFIG.path,
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  };

  console.log(`[Ra Pulse] Conectando con las puertas de ${CONFIG.gerritHost}...`);

  const req = https.get(options, (res) => {
    let rawData = '';

    res.on('data', (chunk) => { rawData += chunk; });

    res.on('end', () => {
      try {
        if (res.statusCode !== 200) {
          throw new Error(`Error HTTP: Código de estado ${res.statusCode}`);
        }

        const cleanData = sanitizeGerritResponse(rawData);

        console.log(`\n[Maat] Datos sanitizados con éxito. Cambios detectados: ${cleanData.length}`);
        cleanData.forEach(cambio => {
          console.log(` - [${cambio._number}] ${cambio.subject} (Por: ${cambio.owner ? cambio.owner.name : 'Desconocido'})`);
        });

        reportTelemetry('stable', 'Conexión exitosa y datos sanitizados de Gerrit.');
      } catch (error) {
        console.error('[Apofis] Error al procesar los datos:', error.message);
        reportTelemetry('duat_error', `Error de parseo: ${error.message}`);
      }
    });
  });

  req.on('error', (error) => {
    console.error('[Apofis] Amenaza en la red:', error.message);
    reportTelemetry('duat_error', `Error de red: ${error.message}`);
  });

  req.end();
}

// Iniciar el latido del script
fetchGerritPulse();
