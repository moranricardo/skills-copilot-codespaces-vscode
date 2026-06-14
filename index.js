// index.js - El Latido Base: Extractor y Saneador de Gerrit API (ESM Nativo)
import https from 'https';
import fs from 'fs';

// Configuración sobre Código: Parámetros del ecosistema
const CONFIG = {
  gerritUrl: 'https://android-review.googlesource.com',
  endpoint: '/changes/?q=status:open&n=5',
  stateFile: './state.json'
};

/**
 * Registra la telemetría del estado en el archivo centralizado de salud
 */
function reportarPulso(modulo, estado, detalles = {}) {
  let gemaEstado = {};
  try {
    if (fs.existsSync(CONFIG.stateFile)) {
      gemaEstado = JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf8'));
    }
  } catch (e) {
    // Si el archivo está corrupto o no existe, renace vacío
  }

  gemaEstado[modulo] = {
    timestamp: new Date().toISOString(),
    estado: estado,
    ...detalles
  };

  fs.writeFileSync(CONFIG.stateFile, JSON.stringify(gemaEstado, null, 2));
}

/**
 * Sanea el prefijo mágico anti-XSS de Gerrit y parsea el JSON de forma segura
 */
function sanearRespuestaGerrit(textoBruto) {
  const prefijoAntiXSS = ")]}'\n";
  
  if (textoBruto.startsWith(prefijoAntiXSS)) {
    return JSON.parse(textoBruto.slice(prefijoAntiXSS.length));
  }
  
  return JSON.parse(textoBruto);
}

/**
 * Ejecuta la consulta al endpoint de Gerrit
 */
function consultarCambiosAbiertos() {
  const urlCompleta = `${CONFIG.gerritUrl}${CONFIG.endpoint}`;
  
  console.log(`[Ra Pulse] Iniciando consulta a la barca de Gerrit: ${urlCompleta}`);

  https.get(urlCompleta, {
    headers: { 'Accept': 'application/json' }
  }, (res) => {
    let cuerpo = '';

    res.on('data', (chunk) => { cuerpo += chunk; });

    res.on('end', () => {
      try {
        if (res.statusCode !== 200) {
          throw new Error(`Error en el Inframundo HTTP: Código de estado ${res.statusCode}`);
        }

        const cambios = sanearRespuestaGerrit(cuerpo);
        
        console.log(`\n[Maat Alineado] Se han extraído exitosamente ${cambios.length} cambios abiertos:`);
        cambios.forEach(cambio => {
          console.log(` - [${cambio._number}] ${cambio.subject} (Por: ${cambio.owner ? cambio.owner.name : 'Desconocido'})`);
        });

        reportarPulso('ExtractorGerrit', 'ESTABLE', { cambiosDetectados: cambios.length });

      } catch (error) {
        console.error(`[Apofis Detectado] Error procesando los datos: ${error.message}`);
        reportarPulso('ExtractorGerrit', 'ERROR', { mensaje: error.message });
      }
    });

  }).on('error', (error) => {
    console.error(`[Fallo de Red] La conexión no pudo cruzar el Duat: ${error.message}`);
    reportarPulso('ExtractorGerrit', 'CAÍDO', { mensaje: error.message });
  });
}

// Ejecución del flujo base
consultarCambiosAbiertos();
