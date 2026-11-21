/**
 * NEWS INTELLIGENCE HUB - Database Manager (SQLite nativo Node.js)
 * Archiviazione persistente indipendente dal browser con backup e recupero
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'news_intelligence.db');

// Assicura l'esistenza delle cartelle
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
  }
  return db;
}

function initDatabase() {
  const database = getDb();

  // Tabella Categorie
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      order_index INTEGER DEFAULT 0
    );
  `);

  // Tabella Fonti
  database.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'rss',
      document_type TEXT NOT NULL DEFAULT 'Notizia',
      keywords TEXT DEFAULT '[]',
      exclude_keywords TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      last_checked_at TEXT,
      last_status TEXT DEFAULT 'mai_eseguita',
      last_error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);

  // Tabella Articoli Archiviati
  database.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL,
      source_id INTEGER,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      summary TEXT NOT NULL,
      author TEXT,
      url TEXT UNIQUE NOT NULL,
      image_url TEXT,
      published_at TEXT NOT NULL,
      ingested_at TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      keywords TEXT DEFAULT '[]',
      relevance_score INTEGER DEFAULT 80,
      is_read INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);

  // Indici per velocizzare ricerche cronologiche e per categoria
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(year, month, day);
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_doctype ON articles(document_type);
  `);

  // Tabella Log di Aggiornamento
  database.exec(`
    CREATE TABLE IF NOT EXISTS update_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      trigger_type TEXT NOT NULL,
      category_id TEXT,
      sources_queried INTEGER DEFAULT 0,
      results_found INTEGER DEFAULT 0,
      articles_added INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress',
      log_details TEXT DEFAULT '[]',
      error_message TEXT
    );
  `);

  // Tabella Impostazioni
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Inserimento categorie predefinite se vuote
  const countRow = database.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (countRow.count === 0) {
    const insertCat = database.prepare(`
      INSERT INTO categories (id, name, description, icon, color, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const defaultCategories = [
      {
        id: 'politica',
        name: 'POLITICA',
        description: 'Politica italiana, europea, internazionale, governi, istituzioni, geopolitica e riforme.',
        icon: 'landmark',
        color: '#2563eb',
        order: 1
      },
      {
        id: 'sport',
        name: 'SPORT',
        description: 'Ciclismo, atletica, calcio, sport olimpici, fisiologia, preparazione atletica e nutrizione.',
        icon: 'medal',
        color: '#ea580c',
        order: 2
      },
      {
        id: 'religione',
        name: 'RELIGIONE CATTOLICA',
        description: 'Papa e Vaticano, Chiesa italiana, diocesi, teologia, magistero e dottrina sociale.',
        icon: 'cross',
        color: '#ca8a04',
        order: 3
      },
      {
        id: 'ricerca',
        name: 'RICERCA SCIENTIFICA',
        description: 'Nuove scoperte, intelligenza artificiale, neuroscienze, fisica, università e pubblicazioni.',
        icon: 'atom',
        color: '#06b6d4',
        order: 4
      },
      {
        id: 'economia',
        name: 'ECONOMIA',
        description: 'Economia italiana ed estera, mercati, finanza, imprese, lavoro, infrastrutture e industria.',
        icon: 'trending-up',
        color: '#16a34a',
        order: 5
      },
      {
        id: 'medicina',
        name: 'MEDICINA E SALUTE',
        description: 'Ricerca medica, oncologia, cardiologia, nuove terapie, longevità, prevenzione e studi clinici.',
        icon: 'heart-pulse',
        color: '#e11d48',
        order: 6
      },
      {
        id: 'interazioni',
        name: 'INTERAZIONI UMANE E CRESCITA PERSONALE',
        description: 'Psicologia, neuroscienze cognitive, comunicazione, leadership, negoziazione ed empatia.',
        icon: 'brain',
        color: '#8b5cf6',
        order: 7
      },
      {
        id: 'romagna',
        name: 'NEWS TERRITORIO ROMAGNA',
        description: 'Forlì, Cesena, Faenza, Provincia Forlì-Cesena e Romagna: cronaca, economia, cultura e università.',
        icon: 'map-pin',
        color: '#059669',
        order: 8
      }
    ];

    for (const cat of defaultCategories) {
      insertCat.run(cat.id, cat.name, cat.description, cat.icon, cat.color, cat.order);
    }
  }

  // Impostazioni di default se non presenti
  const defaultSettings = [
    { key: 'scheduler_time', value: JSON.stringify('06:00') },
    { key: 'scheduler_enabled', value: JSON.stringify(true) },
    { key: 'scheduler_timezone', value: JSON.stringify('Europe/Rome') },
    { key: 'scheduler_frequency', value: JSON.stringify('daily') },
    { key: 'theme_mode', value: JSON.stringify('dark') },
    { key: 'primary_color', value: JSON.stringify('#2563eb') },
    { key: 'max_articles_per_source', value: JSON.stringify(15) },
    { key: 'summarizer_mode', value: JSON.stringify('smart_italian') },
    { key: 'auto_backup', value: JSON.stringify(true) }
  ];

  const getSettingStmt = database.prepare('SELECT key FROM settings WHERE key = ?');
  const setSettingStmt = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  for (const s of defaultSettings) {
    if (!getSettingStmt.get(s.key)) {
      setSettingStmt.run(s.key, s.value);
    }
  }
}

// Helper per eseguire query
function queryAll(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

function queryGet(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

function runExec(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

// Statistiche generali dashboard
function getDashboardStats() {
  const database = getDb();
  const categories = database.prepare('SELECT * FROM categories ORDER BY order_index ASC').all();

  const totalArticlesRow = database.prepare('SELECT COUNT(*) as total FROM articles').get();
  const unreadArticlesRow = database.prepare('SELECT COUNT(*) as unread FROM articles WHERE is_read = 0').get();
  const totalSourcesRow = database.prepare('SELECT COUNT(*) as total FROM sources WHERE is_active = 1').get();
  const lastUpdateRow = database.prepare('SELECT * FROM update_logs ORDER BY id DESC LIMIT 1').get();

  const categoriesWithStats = categories.map(cat => {
    const totalCount = database.prepare('SELECT COUNT(*) as count FROM articles WHERE category_id = ?').get(cat.id).count;
    const unreadCount = database.prepare('SELECT COUNT(*) as count FROM articles WHERE category_id = ? AND is_read = 0').get(cat.id).count;
    const sourcesCount = database.prepare('SELECT COUNT(*) as count FROM sources WHERE category_id = ? AND is_active = 1').get(cat.id).count;
    const lastArticle = database.prepare('SELECT published_at FROM articles WHERE category_id = ? ORDER BY published_at DESC LIMIT 1').get(cat.id);
    const recentArticles = database.prepare(`
      SELECT id, title, subtitle, summary, source_name, author, url, image_url, published_at, document_type, relevance_score, is_read, is_favorite
      FROM articles
      WHERE category_id = ?
      ORDER BY published_at DESC
      LIMIT 4
    `).all(cat.id);

    return {
      ...cat,
      total_articles: totalCount,
      unread_articles: unreadCount,
      active_sources: sourcesCount,
      last_article_date: lastArticle ? lastArticle.published_at : null,
      recent_articles: recentArticles
    };
  });

  return {
    total_articles: totalArticlesRow.total,
    unread_articles: unreadArticlesRow.unread,
    active_sources: totalSourcesRow.total,
    last_update: lastUpdateRow || null,
    categories: categoriesWithStats
  };
}

// Salva o aggiorna un articolo evitando duplicati
function saveArticle(articleData) {
  const database = getDb();

  // Verifica duplicato per URL
  const existing = database.prepare('SELECT id FROM articles WHERE url = ?').get(articleData.url);
  if (existing) {
    return { added: false, id: existing.id, reason: 'url_duplicato' };
  }

  // Verifica duplicato titolo identico negli ultimi 7 giorni
  const duplicateTitle = database.prepare(`
    SELECT id FROM articles
    WHERE category_id = ? AND title = ?
  `).get(articleData.category_id, articleData.title);

  if (duplicateTitle) {
    return { added: false, id: duplicateTitle.id, reason: 'titolo_duplicato' };
  }

  const pubDate = new Date(articleData.published_at || Date.now());
  const year = pubDate.getFullYear();
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();

  const stmt = database.prepare(`
    INSERT INTO articles (
      category_id, source_id, source_name, title, subtitle, summary,
      author, url, image_url, published_at, ingested_at,
      year, month, day, document_type, keywords, relevance_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    articleData.category_id,
    articleData.source_id || null,
    articleData.source_name || 'Fonte Web',
    articleData.title,
    articleData.subtitle || '',
    articleData.summary || '',
    articleData.author || '',
    articleData.url,
    articleData.image_url || '',
    articleData.published_at || new Date().toISOString(),
    new Date().toISOString(),
    year,
    month,
    day,
    articleData.document_type || 'Notizia',
    JSON.stringify(articleData.keywords || []),
    articleData.relevance_score || 85
  );

  return { added: true, id: info.lastInsertRowid };
}

// Ricerca archivio per Anno / Mese / Giorno
function getArchiveChronology(categoryId) {
  const database = getDb();

  let sql = `
    SELECT year, month, day, COUNT(*) as count
    FROM articles
  `;
  const params = [];

  if (categoryId && categoryId !== 'tutte') {
    sql += ' WHERE category_id = ?';
    params.push(categoryId);
  }

  sql += ' GROUP BY year, month, day ORDER BY year DESC, month DESC, day DESC';

  const rows = database.prepare(sql).all(...params);

  // Organizza la struttura gerarchica
  const hierarchy = {};

  const mesiNomi = [
    '', 'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO',
    'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'
  ];

  for (const row of rows) {
    const { year, month, day, count } = row;
    if (!hierarchy[year]) {
      hierarchy[year] = { year, total: 0, months: {} };
    }
    hierarchy[year].total += count;

    if (!hierarchy[year].months[month]) {
      hierarchy[year].months[month] = {
        month,
        month_name: mesiNomi[month] || `Mese ${month}`,
        total: 0,
        days: []
      };
    }
    hierarchy[year].months[month].total += count;
    hierarchy[year].months[month].days.push({
      day,
      date_str: `${String(day).padStart(2, '0')} ${mesiNomi[month]}`,
      count
    });
  }

  return hierarchy;
}

// Ricerca articoli con filtri completi e ricerca semantica intelligente
function searchArticles(options = {}) {
  const database = getDb();
  const {
    query,
    categoryId,
    category_id,
    year,
    month,
    day,
    documentType,
    document_type,
    source,
    fromDate,
    toDate,
    favoritesOnly,
    unreadOnly,
    sortBy = 'published_desc',
    limit = 50,
    offset = 0
  } = options;

  let sql = 'SELECT * FROM articles WHERE 1=1';
  const params = [];

  // Ricerca testuale intelligente multi-parola o frase esatta
  if (query && query.trim()) {
    const rawQuery = query.trim();
    if (rawQuery.startsWith('"') && rawQuery.endsWith('"') && rawQuery.length > 2) {
      // Frase esatta tra virgolette
      const exactPhrase = `%${rawQuery.slice(1, -1)}%`;
      sql += ` AND (
        title LIKE ? OR
        subtitle LIKE ? OR
        summary LIKE ? OR
        author LIKE ? OR
        keywords LIKE ? OR
        source_name LIKE ? OR
        category_id LIKE ?
      )`;
      params.push(exactPhrase, exactPhrase, exactPhrase, exactPhrase, exactPhrase, exactPhrase, exactPhrase);
    } else {
      // Tokenizzazione parole chiave
      let tokens = rawQuery.split(/\s+/).filter(t => t.length > 0);
      const stopWords = new Set(['e', 'ed', 'o', 'od', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra']);
      if (tokens.length > 1) {
        const filtered = tokens.filter(t => !stopWords.has(t.toLowerCase()));
        if (filtered.length > 0) tokens = filtered;
      }

      for (const token of tokens) {
        const cleanToken = `%${token}%`;
        sql += ` AND (
          title LIKE ? OR
          subtitle LIKE ? OR
          summary LIKE ? OR
          author LIKE ? OR
          keywords LIKE ? OR
          source_name LIKE ? OR
          category_id LIKE ?
        )`;
        params.push(cleanToken, cleanToken, cleanToken, cleanToken, cleanToken, cleanToken, cleanToken);
      }
    }
  }

  // Filtro Categoria (case-insensitive)
  const effectiveCat = categoryId || category_id;
  if (effectiveCat && effectiveCat !== 'tutte' && effectiveCat !== 'all') {
    sql += ' AND LOWER(category_id) = LOWER(?)';
    params.push(effectiveCat);
  }

  // Filtro Cronologico (Anno, Mese, Giorno)
  if (year) {
    sql += ' AND year = ?';
    params.push(parseInt(year, 10));
  }

  if (month) {
    sql += ' AND month = ?';
    params.push(parseInt(month, 10));
  }

  if (day) {
    sql += ' AND day = ?';
    params.push(parseInt(day, 10));
  }

  // Filtro Tipologia Documento (case-insensitive)
  const effectiveDoc = documentType || document_type;
  if (effectiveDoc && effectiveDoc !== 'tutti' && effectiveDoc !== 'all') {
    sql += ' AND LOWER(document_type) = LOWER(?)';
    params.push(effectiveDoc);
  }

  // Filtro Fonte
  if (source && source.trim()) {
    sql += ' AND source_name LIKE ?';
    params.push(`%${source.trim()}%`);
  }

  // Filtro Range Temporale
  if (fromDate) {
    sql += ' AND published_at >= ?';
    params.push(fromDate);
  }

  if (toDate) {
    sql += ' AND published_at <= ?';
    params.push(toDate);
  }

  // Booleani - Valutazione sicura (evita bug 'false' come stringa truthy)
  if (favoritesOnly === true || favoritesOnly === 'true' || favoritesOnly === '1' || favoritesOnly === 1) {
    sql += ' AND is_favorite = 1';
  }

  if (unreadOnly === true || unreadOnly === 'true' || unreadOnly === '1' || unreadOnly === 1) {
    sql += ' AND is_read = 0';
  }

  // Ordinamento
  if (sortBy === 'published_desc') {
    sql += ' ORDER BY published_at DESC';
  } else if (sortBy === 'published_asc') {
    sql += ' ORDER BY published_at ASC';
  } else if (sortBy === 'relevance_desc') {
    sql += ' ORDER BY relevance_score DESC, published_at DESC';
  } else {
    sql += ' ORDER BY published_at DESC';
  }

  // Conteggio totale
  const countSql = sql.replace('SELECT * FROM articles', 'SELECT COUNT(*) as total FROM articles');
  const totalRow = database.prepare(countSql).get(...params);

  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const items = database.prepare(sql).all(...params);

  return {
    total: totalRow ? totalRow.total : 0,
    items,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10)
  };
}

// Backup completo del database
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup_news_intelligence_${timestamp}.json`;
  const backupPath = path.join(BACKUPS_DIR, backupFileName);

  const database = getDb();
  const categories = database.prepare('SELECT * FROM categories').all();
  const sources = database.prepare('SELECT * FROM sources').all();
  const articles = database.prepare('SELECT * FROM articles').all();
  const settings = database.prepare('SELECT * FROM settings').all();

  const dump = {
    exported_at: new Date().toISOString(),
    version: '1.0.0',
    categories,
    sources,
    articles,
    settings
  };

  fs.writeFileSync(backupPath, JSON.stringify(dump, null, 2), 'utf-8');

  return {
    filename: backupFileName,
    path: backupPath,
    articles_count: articles.length,
    sources_count: sources.length,
    created_at: dump.exported_at
  };
}

// Elenco dei backup disponibili
function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  const files = fs.readdirSync(BACKUPS_DIR);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUPS_DIR, f));
      return {
        filename: f,
        size_bytes: stats.size,
        created_at: stats.birthtime.toISOString()
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Ripristino dati da backup JSON
function restoreBackup(backupFileName) {
  const backupPath = path.join(BACKUPS_DIR, backupFileName);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`File di backup non trovato: ${backupFileName}`);
  }

  const content = fs.readFileSync(backupPath, 'utf-8');
  const data = JSON.parse(content);
  const database = getDb();

  // Ripristino in transazione
  database.exec('BEGIN TRANSACTION');
  try {
    if (Array.isArray(data.sources)) {
      database.exec('DELETE FROM sources');
      const insertSource = database.prepare(`
        INSERT INTO sources (id, category_id, name, url, type, document_type, keywords, exclude_keywords, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.sources) {
        insertSource.run(
          s.id, s.category_id, s.name, s.url, s.type || 'rss',
          s.document_type || 'Notizia', s.keywords || '[]',
          s.exclude_keywords || '[]', s.is_active !== undefined ? s.is_active : 1,
          s.created_at || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(data.articles)) {
      database.exec('DELETE FROM articles');
      const insertArticle = database.prepare(`
        INSERT INTO articles (
          id, category_id, source_id, source_name, title, subtitle, summary,
          author, url, image_url, published_at, ingested_at,
          year, month, day, document_type, keywords, relevance_score, is_read, is_favorite
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of data.articles) {
        insertArticle.run(
          a.id, a.category_id, a.source_id, a.source_name, a.title,
          a.subtitle || '', a.summary, a.author || '', a.url,
          a.image_url || '', a.published_at, a.ingested_at || new Date().toISOString(),
          a.year, a.month, a.day, a.document_type || 'Notizia',
          a.keywords || '[]', a.relevance_score || 80,
          a.is_read || 0, a.is_favorite || 0
        );
      }
    }

    database.exec('COMMIT');
    return { success: true, articles_restored: data.articles?.length || 0 };
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  getDb,
  initDatabase,
  queryAll,
  queryGet,
  runExec,
  getDashboardStats,
  saveArticle,
  getArchiveChronology,
  searchArticles,
  createBackup,
  listBackups,
  restoreBackup,
  BACKUPS_DIR,
  DB_PATH
};
