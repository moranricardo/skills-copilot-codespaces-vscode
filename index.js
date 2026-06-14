// index.js - Módulo de Conexión Gerrit (Radio Auditor - ESM)
import https from 'https';
import fs from 'fs';

// Configuración sobre Código: Parámetros del ecosistema
const CONFIG = {
  gerritHost: 'android-review.googlesource.com',
  // Endpoint modificado: Ahora pedimos detalles de las etiquetas (LABELS) para revisar los votos
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
 * Registra la telemetría del estado en el archivo centralizado de salud
 */
function reportTelemetry(status, message, details = {}) {
  const state = {
    timestamp: new Date().toISOString(),
    radio: "skills-copilot-codespaces",
    status: status,
    log: message,
    ...details
  };
  fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
}

/**
 * Ejecuta la auditoría sobre las revisiones abiertas de Gerrit
 */
function auditGerritPulse() {
  const options = {
    hostname: CONFIG.gerritHost,
    path: CONFIG.endpoint,
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  };

  console.log(`[Ra Pulse] Iniciando escaneo auditor en: ${CONFIG.gerritHost}...`);

  const req = https.get(options, (res) => {
    let rawData = '';

    res.on('data', (chunk) => { rawData += chunk; });

    res.on('end', () => {
      try {
        if (res.statusCode !== 200) {
          throw new Error(`Error HTTP: Código de estado ${res.statusCode}`);
        }

        const cambios = sanitizeGerritResponse(rawData);
        console.log(`\n[Maat] Datos extraídos con éxito. Evaluando ${cambios.length} cambios abiertos:\n`);

        let parchesAprobados = 0;

        cambios.forEach(cambio => {
          // Extraemos el estado de la etiqueta 'Code-Review'
          const codeReview = cambio.labels && cambio.labels['Code-Review'];
          
          // Verificamos si tiene la bendición definitiva (voto aprobado '+2')
          const tieneAprobacionPlus2 = codeReview && codeReview.approved ? "✓ Code-Review +2 (APROBADO)" : "✗ Pendiente de Revisión";

          if (codeReview && codeReview.approved) parchesAprobados++;

          console.log(` 📦 Cambio: [${cambio._number}]`);
          console.log(`    Subject:  ${cambio.subject}`);
          console.log(`    ID Único: ${cambio.change_id}`);
          console.log(`    Estado:   ${tieneAprobacionPlus2}`);
          console.log(`    Por:      ${cambio.owner ? cambio.owner.name : 'Desconocido'}\n--------------------------------------`);
        });

        reportTelemetry('stable', 'Auditoría completada exitosamente.', { 
          cambiosAnalizados: cambios.length,
          aprobadosPlus2: parchesAprobados
        });

      } catch (error) {
        console.error('[Apofis] Error al procesar los datos de auditoría:', error.message);
        reportTelemetry('duat_error', `Error de parseo en auditoría: ${error.message}`);
      }
    });
  });

  req.on('error', (error) => {
    console.error('[Apofis] Amenaza en la red:', error.message);
    reportTelemetry('duat_error', `Error de red en auditoría: ${error.message}`);
  });

  req.end();
}

// Iniciar el ciclo del auditor
auditGerritPulse();
