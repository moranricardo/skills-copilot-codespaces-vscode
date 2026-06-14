// index.js - Módulo de Auditoría curly-enigma (ESM)
import https from 'https';
import fs from 'fs';

const CONFIG = {
  githubApiHost: 'api.github.com',
  repoPath: '/repos/moranricardo/curly-enigma',
  userAgent: 'Ra-Pulse-Auditor-Termux',
  stateFile: './state.json',
  // Extrae de forma segura el token guardado en el Paso 2
  token: process.env.GITHUB_TOKEN
};

function fetchGitHubData(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.githubApiHost,
      path: `${CONFIG.repoPath}${endpoint}`,
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    // Si encontramos el token, firmamos la petición para abrir las puertas del repo privado
    if (CONFIG.token) {
      options.headers['Authorization'] = `token ${CONFIG.token}`;
    }

    https.get(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 401 || res.statusCode === 403) {
            throw new Error(`Acceso denegado (HTTP ${res.statusCode}). Verifica que estés logueado en 'gh auth login'.`);
          }
          if (res.statusCode !== 200) {
            throw new Error(`Error HTTP: Código ${res.statusCode}`);
          }
          resolve(JSON.parse(rawData));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (err) => reject(err));
  });
}

function saveAuditTelemetry(summary) {
  const state = {
    last_pulse: new Date().toISOString(),
    radio: "curly-enigma-auditor",
    status: summary.hasAnomalies ? "attention_required" : "stable",
    telemetry: summary
  };
  fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
  console.log(`\n✨ Telemetría guardada con éxito en ${CONFIG.stateFile}`);
}

async function auditRepository() {
  console.log(`🌌 [Ra Pulse] Conectando con las puertas de curly-enigma...`);
  
  const summary = {
    pullRequestsAnalizados: 0,
    issuesAnalizadas: 0,
    hasAnomalies: false,
    alerts: []
  };

  try {
    console.log("🔍 Escaneando solicitudes de cambios abiertas (Pull Requests)...");
    const pulls = await fetchGitHubData('/pulls?state=open');
    summary.pullRequestsAnalizados = pulls.length;
    
    pulls.forEach(pr => {
      console.log(` 📦 PR [\#${pr.number}]: ${pr.title}`);
      if (pr.title.includes('Bump')) {
        summary.alerts.push({
          type: "DEPENDENCY_BUMP_DETECTED",
          message: `El PR #${pr.number} (actions/checkout) requiere verificación de compatibilidad.`
        });
        summary.hasAnomalies = true;
      }
    });

    console.log("\n🔍 Escaneando propuestas abiertas (Issues)...");
    const issues = await fetchGitHubData('/issues?state=open');
    const cleanIssues = issues.filter(issue => !issue.pull_request);
    summary.issuesAnalizadas = cleanIssues.length;

    cleanIssues.forEach(issue => {
      console.log(` 🗂️ Issue [\#${issue.number}]: ${issue.title}`);
      if (issue.title.includes('mobile-es-419')) {
        summary.alerts.push({
          type: "CRITICAL_REFACTOR_PENDING",
          message: `La propuesta #${issue.number} ("mobile-es-419") está pendiente de auditoría estructural.`
        });
        summary.hasAnomalies = true;
      }
    });

    saveAuditTelemetry(summary);

  } catch (error) {
    console.error('\n🚨 [Apofis] Falla en la lectura del repositorio:', error.message);
  }
}

auditRepository();
