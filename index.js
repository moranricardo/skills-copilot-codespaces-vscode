import https from 'https';
import fs from 'fs/promises';

// 1. Cargar el contrato de configuración que creaste con éxito
let config;
try {
    const configFile = await fs.readFile('./config.json', 'utf8');
    config = JSON.parse(configFile);
} catch (error) {
    console.error('❌ No se pudo leer config.json:', error.message);
    process.exit(1);
}

// 2. Mapeo del Pulso (Telemetría asíncrona)
async function updatePulse(status, message, extra = {}) {
    const pulse = {
        module: "gerrit_fetcher",
        timestamp: new Date().toISOString(),
        status: status,
        message: message,
        ...extra
    };
    await fs.writeFile(config.pulseOutputFile, JSON.stringify(pulse, null, 2));
    console.log(`[Ra Pulse] -> ${status}: ${message}`);
}

// 3. Purificación anti-XSS de Gerrit
function sanitizeResponse(rawData) {
    const magicPrefix = ")]}'\n";
    if (rawData.startsWith(magicPrefix)) {
        return rawData.slice(magicPrefix.length);
    }
    return rawData;
}

// 4. Invocación al Inframundo de Gerrit
function runPulse() {
    const targetUrl = `${config.gerritUrl}/changes/?q=${config.query}`;
    console.log(`🌅 Iniciando ciclo. Conectando a: ${config.gerritUrl}`);

    https.get(targetUrl, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', async () => {
            try {
                const cleanData = sanitizeResponse(rawData.trim());
                const changes = JSON.parse(cleanData);
                
                await updatePulse('STABLE', 'Datos devueltos y purificados con éxito.', {
                    cambiosDetectados: changes.length,
                    ultimoCambioSubject: changes[0] ? changes[0].subject : 'Ninguno'
                });
            } catch (e) {
                await updatePulse('DUAT_ERROR', `Fallo de parseo: ${e.message}`);
            }
        });
    }).on('error', async (err) => {
        await updatePulse('DUAT_ERROR', `Error de comunicación: ${err.message}`);
    });
}

runPulse();
