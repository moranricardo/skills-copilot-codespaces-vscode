const https = require('https');
const fs = require('fs');

const config = {
    host: 'review.lineageos.org',
    user: process.env.GERRIT_USER,
    password: process.env.GERRIT_PASS,
    path: '/changes/?q=status:open OR status:merged'
};

function executeMaintenance() {
    const auth = Buffer.from(`${config.user}:${config.password}`).toString('base64');
    
    // Usamos encodeURI para evitar el error de caracteres no escapados
    const options = {
        hostname: config.host,
        path: encodeURI(config.path),
        method: 'GET',
        headers: { 
            'Authorization': `Basic ${auth}`, 
            'Accept': 'application/json' 
        }
    };

    https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            const cleanData = data.replace(/^\)\]\}'\n/, '');
            try {
                const changes = JSON.parse(cleanData);
                const nuevoConteo = changes.length;
                let conteoPrevio = 0;
                
                if (fs.existsSync('ultimo_conteo.txt')) {
                    conteoPrevio = parseInt(fs.readFileSync('ultimo_conteo.txt', 'utf8'));
                }

                if (nuevoConteo !== conteoPrevio) {
                    fs.writeFileSync('log_mantenimiento.json', JSON.stringify(changes, null, 2));
                    fs.writeFileSync('ultimo_conteo.txt', nuevoConteo.toString());
                    console.log(`🔄 Cambio detectado: ${conteoPrevio} -> ${nuevoConteo}.`);
                } else {
                    console.log(`✅ Sin cambios nuevos.`);
                }
            } catch (e) { console.error("❌ Error al procesar:", e.message); }
        });
    }).on('error', (err) => console.error("❌ Red:", err.message));
}

executeMaintenance();
