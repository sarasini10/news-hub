/**
 * NEWS INTELLIGENCE HUB - Fonti Iniziali Certificate per le 8 Categorie
 */

const { getDb } = require('./db');

const SEED_SOURCES = [
  // --- 1. POLITICA ---
  {
    category_id: 'politica',
    name: 'ANSA - Politica e Istituzioni',
    url: 'https://www.ansa.it/sito/notizie/politica/politica_rss.xml',
    type: 'rss',
    document_type: 'Notizia',
    keywords: ['governo', 'parlamento', 'politica', 'legge', 'ministri', 'camera', 'senato', 'partiti', 'istituzioni']
  },
  {
    category_id: 'politica',
    name: 'Il Sole 24 Ore - Politica e Riforme',
    url: 'https://www.ilsole24ore.com/rss/italia--politica.xml',
    type: 'rss',
    document_type: 'Articolo',
    keywords: ['riforme', 'istituzioni', 'politica estera', 'geopolitica', 'unione europea', 'decreti']
  },
  {
    category_id: 'politica',
    name: 'Google News - Politica Italiana ed Europea',
    url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Notizia',
    keywords: ['governo', 'geopolitica', 'europa', 'relazioni internazionali', 'politica interna']
  },

  // --- 2. SPORT ---
  {
    category_id: 'sport',
    name: 'La Gazzetta dello Sport - Tutte le Notizie',
    url: 'https://www.gazzetta.it/rss/home.xml',
    type: 'rss',
    document_type: 'Notizia',
    keywords: ['calcio', 'ciclismo', 'atletica', 'olimpiadi', 'risultati', 'competizioni', 'sport']
  },
  {
    category_id: 'sport',
    name: 'CONI - Notizie Istituzionali e Discipline Olimpiche',
    url: 'https://www.coni.it/it/news.feed?type=rss',
    type: 'rss',
    document_type: 'Documento istituzionale',
    keywords: ['olimpiadi', 'preparazione olimpica', 'fisiologia dello sport', 'atletica', 'ciclismo', 'federazioni']
  },
  {
    category_id: 'sport',
    name: 'Google News - Fisiologia e Scienza dello Sport',
    url: 'https://news.google.com/rss/search?q=preparazione+atletica+nutrizione+sportiva+ciclismo&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Studio scientifico',
    keywords: ['nutrizione sportiva', 'fisiologia', 'allenamento', 'prestazione', 'recupero muscolare']
  },

  // --- 3. RELIGIONE CATTOLICA ---
  {
    category_id: 'religione',
    name: 'Vatican News Italiano - Papa e Santa Sede',
    url: 'https://www.vaticannews.va/it.rss.xml',
    type: 'rss',
    document_type: 'Documento ecclesiale',
    keywords: ['papa', 'vaticano', 'magistero', 'udienza', 'enciclica', 'santa sede', 'chiesa']
  },
  {
    category_id: 'religione',
    name: 'Agenzia SIR - Servizio Informazione Religiosa',
    url: 'https://www.agensir.it/feed/',
    type: 'rss',
    document_type: 'Notizia',
    keywords: ['chiesa italiana', 'diocesi', 'dottrina sociale', 'vescovi', 'pastorale', 'azione cattolica']
  },
  {
    category_id: 'religione',
    name: 'Avvenire - Chiesa e Mondo Cattolico',
    url: 'https://news.google.com/rss/search?q=site:avvenire.it+chiesa&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Articolo',
    keywords: ['chiesa', 'fede', 'teologia', 'vangelo', 'dottrina sociale', 'sacra scrittura']
  },

  // --- 4. RICERCA SCIENTIFICA ---
  {
    category_id: 'ricerca',
    name: 'OpenAlex - Studi e Pubblicazioni Accademiche',
    url: 'https://api.openalex.org/works?search=artificial+intelligence+OR+neuroscience&per-page=15&sort=publication_date:desc',
    type: 'openalex',
    document_type: 'Pubblicazione accademica',
    keywords: ['intelligenza artificiale', 'neuroscienze', 'fisica quantistica', 'machine learning', 'scoperte']
  },
  {
    category_id: 'ricerca',
    name: 'arXiv - Ricerca Intelligenza Artificiale e Fisica',
    url: 'https://export.arxiv.org/rss/cs.AI',
    type: 'rss',
    document_type: 'Studio scientifico',
    keywords: ['artificial intelligence', 'machine learning', 'neural networks', 'deep learning', 'paper']
  },
  {
    category_id: 'ricerca',
    name: 'Le Scienze - Edizione Italiana Scientific American',
    url: 'https://news.google.com/rss/search?q=site:lescienze.it&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Articolo',
    keywords: ['scoperte', 'spazio', 'biologia', 'fisica', 'tecnologia', 'laboratorio', 'università']
  },
  {
    category_id: 'ricerca',
    name: 'CNR - Consiglio Nazionale delle Ricerche',
    url: 'https://news.google.com/rss/search?q=site:cnr.it&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Documento istituzionale',
    keywords: ['ricerca universitaria', 'brevetti', 'tecnologia', 'scienza italiana', 'progetti ue']
  },

  // --- 5. ECONOMIA ---
  {
    category_id: 'economia',
    name: 'Il Sole 24 Ore - Economia e Mercati',
    url: 'https://www.ilsole24ore.com/rss/economia.xml',
    type: 'rss',
    document_type: 'Articolo',
    keywords: ['finanza', 'mercati', 'imprese', 'lavoro', 'pil', 'inflazione', 'tassi', 'industria']
  },
  {
    category_id: 'economia',
    name: 'Milano Finanza - Borsa e Mercati',
    url: 'https://news.google.com/rss/search?q=site:milanofinanza.it&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Notizia',
    keywords: ['borsa', 'azioni', 'obbligazioni', 'bce', 'banche', 'investimenti', 'infrastrutture']
  },
  {
    category_id: 'economia',
    name: 'Google News - Economia, Imprese e Lavoro',
    url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Notizia',
    keywords: ['economia', 'manifattura', 'export', 'innovazione industriale', 'occupazione']
  },

  // --- 6. MEDICINA E SALUTE ---
  {
    category_id: 'medicina',
    name: 'PubMed / NCBI - Studi Clinici e Ricerca Medica',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=(oncology+OR+cardiology+OR+longevity)+AND+humans&retmode=json&sort=pub_date&retmax=15',
    type: 'pubmed',
    document_type: 'Studio scientifico',
    keywords: ['oncologia', 'cardiologia', 'terapie avanzate', 'longevità', 'sperimentazione clinica', 'prevenzione']
  },
  {
    category_id: 'medicina',
    name: 'Ministero della Salute - Notizie e Circolari',
    url: 'https://news.google.com/rss/search?q=site:salute.gov.it&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Documento istituzionale',
    keywords: ['prevenzione', 'sanità pubblica', 'salute', 'vaccini', 'linee guida', 'ospedali']
  },
  {
    category_id: 'medicina',
    name: 'Fondazione Umberto Veronesi - Ricerca e Prevenzione',
    url: 'https://news.google.com/rss/search?q=site:fondazioneveronesi.it&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Articolo',
    keywords: ['oncologia', 'terapie', 'alimentazione', 'stili di vita', 'ricerca biomedica', 'studi clinici']
  },

  // --- 7. INTERAZIONI UMANE E CRESCITA PERSONALE ---
  {
    category_id: 'interazioni',
    name: 'State of Mind - Giornale di Scienze Psicologiche',
    url: 'https://www.stateofmind.it/feed/',
    type: 'rss',
    document_type: 'Studio scientifico',
    keywords: ['psicologia', 'neuroscienze cognitive', 'comportamento', 'relazioni', 'intelligenza emotiva', 'mente']
  },
  {
    category_id: 'interazioni',
    name: 'Psicologia e Neuroscienze Cognitive',
    url: 'https://news.google.com/rss/search?q=psicologia+cognitiva+comunicazione+linguaggio&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Articolo',
    keywords: ['comunicazione', 'persuasione', 'linguaggio non verbale', 'leadership', 'relazioni umane']
  },
  {
    category_id: 'interazioni',
    name: 'Google News - Leadership, Negoziazione e Soft Skills',
    url: 'https://news.google.com/rss/search?q=leadership+comunicazione+efficace+intelligenza+emotiva+negoziazione&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Analisi ed opinione',
    keywords: ['leadership', 'gestione conflitti', 'public speaking', 'motivazione', 'negoziazione', 'soft skills']
  },

  // --- 8. NEWS TERRITORIO ROMAGNA ---
  {
    category_id: 'romagna',
    name: 'ForlìToday - Cronaca, Politica ed Economia Forlì',
    url: 'https://www.forlitoday.it/rss',
    type: 'rss',
    document_type: 'Notizia',
    keywords: ['forlì', 'forlivese', 'comune di forlì', 'provincia forlì-cesena', 'romagna', 'cronaca', 'infrastrutture']
  },
  {
    category_id: 'romagna',
    name: 'CesenaToday - Notizie Cesena e Comprensorio',
    url: 'https://www.cesenatoday.it/rss',
    type: 'rss',
    document_type: 'Notizia',
    keywords: ['cesena', 'cesenate', 'comune di cesena', 'vallata del savio', 'romagna', 'eventi', 'università']
  },
  {
    category_id: 'romagna',
    name: 'Corriere Romagna - Notizie e Territorio',
    url: 'https://news.google.com/rss/search?q=site:corriereromagna.it&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Notizia',
    keywords: ['romagna', 'faenza', 'forlì', 'cesena', 'ravenna', 'politica locale', 'sanità romagna', 'ausl']
  },
  {
    category_id: 'romagna',
    name: 'Google News - Romagna, Forlì, Cesena e Faenza',
    url: 'https://news.google.com/rss/search?q=(Forlì+OR+Cesena+OR+Faenza+OR+Romagna)+when:7d&hl=it&gl=IT&ceid=IT:it',
    type: 'google_news',
    document_type: 'Notizia',
    keywords: ['forlì', 'cesena', 'faenza', 'campus universitario', 'aeroporto forlì', 'imprese romagna']
  }
];

function seedDefaultSources() {
  const database = getDb();
  const countRow = database.prepare('SELECT COUNT(*) as count FROM sources').get();

  if (countRow.count === 0) {
    const insertStmt = database.prepare(`
      INSERT INTO sources (
        category_id, name, url, type, document_type,
        keywords, exclude_keywords, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const src of SEED_SOURCES) {
      insertStmt.run(
        src.category_id,
        src.name,
        src.url,
        src.type,
        src.document_type,
        JSON.stringify(src.keywords || []),
        JSON.stringify([]),
        1,
        new Date().toISOString()
      );
    }
  }
}

module.exports = {
  SEED_SOURCES,
  seedDefaultSources
};
