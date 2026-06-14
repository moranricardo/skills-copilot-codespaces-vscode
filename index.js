const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    gerritUrl: 'https://android-review.googlesource.com/changes/?q=status:open+project:platform/frameworks/base&n=5',
    stateFile: path.join(__dirname, 'state.json')
};

function parseGerritResponse(rawData) {
    const ANTI_XSS_PREFIX = ")]}'\n";
    if (rawData.startsWith(ANTI_XSS_PREFIX)) {
        return JSON.parse(rawData.substring(ANTI_XSS_PREFIX.length));
    }
    throw new Error("Amenaza de formato: Falta el prefijo de seguridad anti-XSS de Gerrit.");
}

function updateSystemPulse(updates) {
    try {
        let state = {};
        if (fs.existsSync(CONFIG.stateFile)) {
            state = JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf8'));
        }
        
        const updatedState = {
            ...state,
            ...updates,
            last_pulsecheck: new Date().toISOString()
        };
        
        fs.writeFileSync(CONFIG.stateFile, JSON.stringify(updatedState, null, 2));
    } catch (error) {
        console.error(`🚨 No se pudo escribir la telemetría: ${error.message}`);
    }
}

function checkGerritPulse() {
    console.log("🌌 [Ra Pulse Maestro]: Escaneando el inframundo de Gerrit...");

    https.get(CONFIG.gerritUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Ra-Master-Orchestrator' }
    }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
                
                const changes = parseGerritResponse(rawData);
                console.log(`✨ [Maat]: Conexión exitosa. ${changes.length} parches analizados.`);

                if (changes.length > 0) {
                    const mostRecentChange = changes[0];
                    
                    updateSystemPulse({
                        status: "STABLE",
                        gerrit: {
                            last_seen_change_id: mostRecentChange.change_id,
                            pending_reviews: changes.length
                        },
                        radios: {
                            "didactic-octo-chrome": {
                                "last_sync": new Date().toISOString(),
                                "status": "ACTIVE"
                            }
                        }
                    });
                    
                    console.log(`📡 Último Cambio ID Detectado: ${mostRecentChange.change_id}`);
                    console.log(`📝 Asunto: ${mostRecentChange.subject}`);
                }
            } catch (e) {
                console.error(`🚨 Fallo en el análisis: ${e.message}`);
                updateSystemPulse({ status: "DEGRADED" });
            }
        });
    }).on('error', (e) => {
        console.error(`🚨 Error de comunicación: ${e.message}`);
        updateSystemPulse({ status: "UNREACHABLE" });
    });
}

checkGerritPulse();
