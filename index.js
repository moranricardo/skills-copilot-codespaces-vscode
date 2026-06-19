import https from 'https';
import fs from 'fs';

const CONFIG = {
  githubApiHost: 'api.github.com',
  repoPath: '/repos/moranricardo/skills-copilot-codespaces-vscode',
  userAgent: 'Ra-Pulse-Auditor-Termux',
  stateFile: './state.json',
  token: process.env.GITHUB_TOKEN,
  
  // Ecosistema Gerrit Avanzado
  gerritHost: 'android-review.googlesource.com',
  // Solicitamos CURRENT_REVISION y CURRENT_FILES para poder auditar el contenido interno del parche
  gerritEndpoint: '/changes/?q=status:open+project:platform/frameworks/base&n=10&o=CURRENT_REVISION&o=CURRENT_FILES'
};

function parseGerritResponse(rawData) {
  const XSS_PREFIX = ")]}'\n";
  if (rawData.startsWith(XSS_PREFIX)) {
    return JSON.parse(rawData.slice(XSS_PREFIX.length));
  }
  return JSON.parse(rawData);
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP Error: ${res.statusCode}`));
          return;
        }
        resolve(rawData);
      });
    }).on('error', (err) => reject(err));
  });
}

async function runUnifiedAudit() {
  console.log(`🌌 [Ra Pulse] Iniciando ciclo unificado de auditoría avanzada...`);

  const summary = {
    github: { pullRequests: 0, issues: 0, alerts: [] },
    gerrit: { cambiosAbiertos: 0, alerts: [] },
    hasAnomalies: false
  };

  // --- EJE 1: API GITHUB ---
  try {
    console.log("🔍 Escaneando GitHub (skills-copilot-codespaces-vscode)...");
    const ghOptions = {
      hostname: CONFIG.githubApiHost,
      path: `${CONFIG.repoPath}/issues?state=open`,
      headers: { 'User-Agent': CONFIG.userAgent, 'Accept': 'application/vnd.github.v3+json' }
    };
    if (CONFIG.token) ghOptions.headers['Authorization'] = `token ${CONFIG.token}`;

    const rawGh = await makeRequest(ghOptions);
    const ghData = JSON.parse(rawGh);

    ghData.forEach(item => {
      if (item.pull_request) {
        summary.github.pullRequests++;
        if (item.title.toLowerCase().includes('bump')) {
          summary.github.alerts.push(`PR #${item.number}: Alerta de dependencias.`);
          summary.hasAnomalies = true;
        }
      } else {
        summary.github.issues++;
        if (item.title.toLowerCase().includes('mobile-es-419')) {
          summary.github.alerts.push(`Issue #${item.number}: Refactorización pendiente.`);
          summary.hasAnomalies = true;
        }
      }
    });
  } catch (error) {
    console.error('🚨 [Apofis] Error en eje GitHub:', error.message);
  }

  // --- EJE 2: API GERRIT (Auditoría de Anomalías Reales) ---
  try {
    console.log("🔍 Escaneando Gerrit (Android Platform) en busca de anomalías...");
    const gerritOptions = {
      hostname: CONFIG.gerritHost,
      path: CONFIG.gerritEndpoint,
      headers: { 'User-Agent': CONFIG.userAgent, 'Accept': 'application/json' }
    };

    const rawGerrit = await makeRequest(gerritOptions);
    const changes = parseGerritResponse(rawGerrit);
    summary.gerrit.cambiosAbiertos = changes.length;

    changes.forEach(change => {
      const subject = change.subject ? change.subject.toLowerCase() : '';
      const branch = change.branch || '';
      
      // 1. Anomalía por palabras clave críticas de seguridad
      const palabrasCriticas = ['cve-', 'bypass', 'exploit', 'vulnerability', 'security fix'];
      palabrasCriticas.forEach(keyword => {
        if (subject.includes(keyword)) {
          summary.gerrit.alerts.push(`Cambio #${change._number} (${change.owner.name}): Parche crítico de seguridad detectado ("${change.subject}").`);
          summary.hasAnomalies = true;
        }
      });

      // 2. Anomalía por alteración de archivos ultra-sensibles del Framework de Android
      if (change.revisions && change.current_revision) {
        const currentRev = change.revisions[change.current_revision];
        if (currentRev && currentRev.files) {
          const filesChanged = Object.keys(currentRev.files);
          
          filesChanged.forEach(file => {
            if (file.includes('services/core/java/com/android/server/pm/') || file.includes('AndroidManifest.xml')) {
              summary.gerrit.alerts.push(`Cambio #${change._number}: Modificación sospechosa en el PackageManager o Manifiesto del Sistema (${file}).`);
              summary.hasAnomalies = true;
            }
            if (file.includes('sepolicy') || file.endsWith('.te')) {
              summary.gerrit.alerts.push(`Cambio #${change._number}: El parche altera políticas de SEAndroid/SELinux (${file}). Requiere revisión estricta.`);
              summary.hasAnomalies = true;
            }
          });
        }
      }

      // 3. Anomalía por Target Inusual (Ramas congeladas o legacy)
      if (branch.startsWith('android10-') || branch.startsWith('android11-')) {
        summary.gerrit.alerts.push(`Cambio #${change._number}: Intento de backport push en rama legacy obsoleta (${branch}).`);
        summary.hasAnomalies = true;
      }
    });

    console.log(` ✨ Parches de Gerrit mapeados con éxito en ${CONFIG.gerritHost}`);
  } catch (error) {
    console.error('🚨 [Apofis] Error en eje Gerrit:', error.message);
  }

  // --- PERSISTENCIA CENTRAL ---
  const state = {
    last_pulse: new Date().toISOString(),
    radio: "unified-ecosystem-auditor",
    status: summary.hasAnomalies ? "attention_required" : "stable",
    telemetry: summary
  };

  fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
  console.log(`\n✨ Telemetría balanceada guardada con éxito en ${CONFIG.stateFile}`);
}

runUnifiedAudit();
