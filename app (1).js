/**
 * NEWS INTELLIGENCE HUB - Server Principale (Node.js REST API + Static Server)
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');

const {
  initDatabase,
  getDb,
  getDashboardStats,
  getArchiveChronology,
  searchArticles,
  createBackup,
  listBackups,
  restoreBackup
} = require('./db');

const { seedDefaultSources } = require('./seedSources');
const { runUpdate, probeSourceUrl } = require('./searchEngine');
const { initScheduler, getSchedulerConfig } = require('./scheduler');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Client Server-Sent Events per progresso aggiornamento in tempo reale
const sseClients = new Set();

function broadcastProgress(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

// Inizializza Database, Fonti e Scheduler
initDatabase();
seedDefaultSources();
initScheduler();

// Helper lettura body JSON
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload troppo grande'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Router HTTP
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Risposta JSON helper
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  // --- API ENDPOINTS ---

  // 1. Dashboard Stats
  if (pathname === '/api/dashboard' && method === 'GET') {
    try {
      const stats = getDashboardStats();
      return sendJson(200, { success: true, ...stats });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 2. Stream Aggiornamento Live (Server-Sent Events)
  if (pathname === '/api/update/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('retry: 3000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 3. Avvio Aggiornamento (Tutte o Singola Categoria)
  if (pathname === '/api/update' && method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const categoryId = body.category_id || null;
      const triggerType = categoryId ? 'manual_single' : 'manual_all';

      // Esegui aggiornamento in background con broadcast progresso
      runUpdate({
        categoryId,
        triggerType,
        progressCallback: (progress) => broadcastProgress(progress)
      }).catch(err => {
        console.error('Errore durante runUpdate:', err);
        broadcastProgress({ status: 'failed', error: err.message });
      });

      return sendJson(202, {
        success: true,
        message: 'Aggiornamento avviato con successo. Segui il progresso in tempo reale.',
        category_id: categoryId
      });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 4. Cronologia Archivio (Anno -> Mese -> Giorno)
  if (pathname === '/api/archive/chronology' && method === 'GET') {
    try {
      const categoryId = parsedUrl.query.category_id || null;
      const chronology = getArchiveChronology(categoryId);
      return sendJson(200, { success: true, chronology });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 5. Ricerca Articoli (Full-text & Filtri trasversali)
  if (pathname === '/api/articles' && method === 'GET') {
    try {
      const results = searchArticles(parsedUrl.query);
      return sendJson(200, { success: true, ...results });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 6. Singolo Articolo (Toggle Lettura / Preferito / Elimina)
  if (pathname.startsWith('/api/articles/') && method === 'PATCH') {
    try {
      const id = parseInt(pathname.split('/')[3], 10);
      const body = await parseRequestBody(req);
      const database = getDb();

      if (body.is_read !== undefined) {
        database.prepare('UPDATE articles SET is_read = ? WHERE id = ?').run(body.is_read ? 1 : 0, id);
      }
      if (body.is_favorite !== undefined) {
        database.prepare('UPDATE articles SET is_favorite = ? WHERE id = ?').run(body.is_favorite ? 1 : 0, id);
      }

      const updated = database.prepare('SELECT * FROM articles WHERE id = ?').get(id);
      return sendJson(200, { success: true, article: updated });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  if (pathname.startsWith('/api/articles/') && method === 'DELETE') {
    try {
      const id = parseInt(pathname.split('/')[3], 10);
      getDb().prepare('DELETE FROM articles WHERE id = ?').run(id);
      return sendJson(200, { success: true, message: 'Articolo rimosso con successo' });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 7. Gestione Fonti (List, Add, Update, Delete)
  if (pathname === '/api/sources' && method === 'GET') {
    try {
      const categoryId = parsedUrl.query.category_id;
      let sql = 'SELECT * FROM sources';
      const params = [];
      if (categoryId && categoryId !== 'tutte') {
        sql += ' WHERE category_id = ?';
        params.push(categoryId);
      }
      sql += ' ORDER BY id DESC';
      const sources = getDb().prepare(sql).all(...params);
      return sendJson(200, { success: true, sources });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/sources' && method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      if (!body.category_id || !body.name || !body.url) {
        return sendJson(400, { success: false, error: 'Categoria, nome e URL sono obbligatori' });
      }

      const stmt = getDb().prepare(`
        INSERT INTO sources (
          category_id, name, url, type, document_type,
          keywords, exclude_keywords, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        body.category_id,
        body.name,
        body.url,
        body.type || 'rss',
        body.document_type || 'Notizia',
        JSON.stringify(body.keywords || []),
        JSON.stringify(body.exclude_keywords || []),
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
        new Date().toISOString()
      );

      const created = getDb().prepare('SELECT * FROM sources WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(201, { success: true, source: created });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  if (pathname.startsWith('/api/sources/') && method === 'PUT') {
    try {
      const id = parseInt(pathname.split('/')[3], 10);
      const body = await parseRequestBody(req);

      const stmt = getDb().prepare(`
        UPDATE sources
        SET name = ?, url = ?, type = ?, document_type = ?,
            keywords = ?, exclude_keywords = ?, is_active = ?
        WHERE id = ?
      `);

      stmt.run(
        body.name,
        body.url,
        body.type || 'rss',
        body.document_type || 'Notizia',
        JSON.stringify(body.keywords || []),
        JSON.stringify(body.exclude_keywords || []),
        body.is_active ? 1 : 0,
        id
      );

      const updated = getDb().prepare('SELECT * FROM sources WHERE id = ?').get(id);
      return sendJson(200, { success: true, source: updated });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  if (pathname.startsWith('/api/sources/') && method === 'DELETE') {
    try {
      const id = parseInt(pathname.split('/')[3], 10);
      getDb().prepare('DELETE FROM sources WHERE id = ?').run(id);
      return sendJson(200, { success: true, message: 'Fonte eliminata con successo' });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 8. Wizard Step 3: Test Raggiungibilità URL
  if (pathname === '/api/sources/probe' && method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      if (!body.url) {
        return sendJson(400, { success: false, error: 'URL non specificato' });
      }
      const probeResult = await probeSourceUrl(body.url);
      return sendJson(200, { success: true, ...probeResult });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 9. Impostazioni & Scheduler
  if (pathname === '/api/settings' && method === 'GET') {
    try {
      const rows = getDb().prepare('SELECT * FROM settings').all();
      const settingsObj = {};
      for (const r of rows) {
        try {
          settingsObj[r.key] = JSON.parse(r.value);
        } catch {
          settingsObj[r.key] = r.value;
        }
      }
      settingsObj.scheduler_config = getSchedulerConfig();
      return sendJson(200, { success: true, settings: settingsObj });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/settings' && method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const database = getDb();
      const upsertStmt = database.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      for (const [key, val] of Object.entries(body)) {
        upsertStmt.run(key, JSON.stringify(val));
      }

      return sendJson(200, { success: true, message: 'Impostazioni aggiornate con successo' });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 10. Backup & Restore
  if (pathname === '/api/backups' && method === 'GET') {
    try {
      const backups = listBackups();
      return sendJson(200, { success: true, backups });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/backups' && method === 'POST') {
    try {
      const backupInfo = createBackup();
      return sendJson(201, { success: true, backup: backupInfo });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/backups/restore' && method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      if (!body.filename) {
        return sendJson(400, { success: false, error: 'Nome del file di backup non specificato' });
      }
      const restoreResult = restoreBackup(body.filename);
      return sendJson(200, { success: true, ...restoreResult });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 11. Storico Log Aggiornamenti
  if (pathname === '/api/logs' && method === 'GET') {
    try {
      const limit = parseInt(parsedUrl.query.limit || '20', 10);
      const logs = getDb().prepare('SELECT * FROM update_logs ORDER BY id DESC LIMIT ?').all(limit);
      return sendJson(200, { success: true, logs });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 12. Esportazione Dati (JSON o CSV)
  if (pathname === '/api/export' && method === 'GET') {
    try {
      const categoryId = parsedUrl.query.category_id;
      const format = parsedUrl.query.format || 'json';

      let sql = 'SELECT * FROM articles';
      const params = [];
      if (categoryId && categoryId !== 'tutte') {
        sql += ' WHERE category_id = ?';
        params.push(categoryId);
      }
      sql += ' ORDER BY published_at DESC';
      const articles = getDb().prepare(sql).all(...params);

      if (format === 'csv') {
        let csv = 'ID,Categoria,Fonte,Titolo,Data Pubblicazione,Tipologia,URL,Sintesi\n';
        for (const a of articles) {
          const cleanTitle = `"${(a.title || '').replace(/"/g, '""')}"`;
          const cleanSummary = `"${(a.summary || '').replace(/"/g, '""')}"`;
          csv += `${a.id},${a.category_id},"${a.source_name}",${cleanTitle},${a.published_at},${a.document_type},"${a.url}",${cleanSummary}\n`;
        }
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="archivio_news_${categoryId || 'tutte'}_${Date.now()}.csv"`
        });
        return res.end(csv);
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="archivio_news_${categoryId || 'tutte'}_${Date.now()}.json"`
      });
      return res.end(JSON.stringify(articles, null, 2));
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  // Sicurezza traversal check
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Accesso negato');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback SPA su index.html se non è una chiamata API
      if (!pathname.startsWith('/api/')) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Endpoint non trovato' }));
      }
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` NEWS INTELLIGENCE HUB - Piattaforma Attiva`);
  console.log(` Server locale in ascolto su: http://localhost:${PORT}`);
  console.log(` Lingua: 100% Italiano`);
  console.log(` Database: SQLite persistente (${path.join(__dirname, '..', 'data', 'news_intelligence.db')})`);
  console.log(`=======================================================`);
});
