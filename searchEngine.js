/**
 * NEWS INTELLIGENCE HUB - Motore di Ricerca, Raccolta e Intelligence Web
 * Supporta RSS/Atom, Google News, OpenAlex, PubMed e Web Scraping controllato
 */

const { saveArticle, getDb } = require('./db');
const {
  stripHtml,
  extractKeywords,
  generateItalianSummary,
  calculateRelevanceScore,
  detectDocumentType
} = require('./summarizer');

// Parser nativo per RSS 2.0, RSS 1.0 e Atom senza dipendenze pesanti
function parseRssOrAtom(xmlText) {
  const items = [];

  // Individua i blocchi item (RSS) o entry (Atom)
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) ||
                      xmlText.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const block of itemMatches) {
    // Titolo
    const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    let title = titleMatch ? stripHtml(titleMatch[1]) : '';
    if (!title) continue;

    // Link
    let link = '';
    const linkHrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (linkHrefMatch) {
      link = linkHrefMatch[1];
    } else {
      const linkTagMatch = block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      if (linkTagMatch) {
        link = stripHtml(linkTagMatch[1]);
      }
    }
    if (!link) continue;

    // Descrizione / Contenuto
    const descMatch = block.match(/<(?:description|summary|content(?::encoded)?)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content(?::encoded)?)>/i);
    const description = descMatch ? stripHtml(descMatch[1]) : '';

    // Autore
    const authorMatch = block.match(/<(?:author|dc:creator)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:author|dc:creator)>/i);
    const author = authorMatch ? stripHtml(authorMatch[1]) : '';

    // Data di pubblicazione
    const dateMatch = block.match(/<(?:pubDate|published|updated|dc:date)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated|dc:date)>/i);
    let pubDate = new Date();
    if (dateMatch) {
      const parsed = new Date(stripHtml(dateMatch[1]));
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed;
      }
    }

    // Immagine eventuale (enclosure o media:content o img tag)
    let imageUrl = '';
    const imgEnclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i) ||
                         block.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
                         block.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgEnclosure) {
      imageUrl = imgEnclosure[1];
    }

    items.push({
      title,
      link,
      description,
      author,
      published_at: pubDate.toISOString(),
      image_url: imageUrl
    });
  }

  return items;
}

// Fetch con timeout e header User-Agent realistici
async function safeFetch(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (NewsIntelligenceHub/1.0; mailto:info@newshub.it)',
        'Accept': 'application/rss+xml, application/xml, application/json, text/xml, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        ...(options.headers || {})
      }
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Raccolta da OpenAlex (Pubblicazioni scientifiche internazionali)
async function fetchOpenAlex(source) {
  try {
    const res = await safeFetch(source.url);
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
    const data = await res.json();
    const results = data.results || [];

    return results.map(item => {
      // Ricostruzione abstract se presente
      let abstract = '';
      if (item.abstract_inverted_index) {
        const wordsByIndex = [];
        for (const [word, positions] of Object.entries(item.abstract_inverted_index)) {
          for (const pos of positions) {
            wordsByIndex[pos] = word;
          }
        }
        abstract = wordsByIndex.filter(Boolean).join(' ');
      }

      const authorName = item.authorships && item.authorships.length > 0 && item.authorships[0].author
        ? item.authorships[0].author.display_name
        : 'Team di Ricerca';

      const landingUrl = (item.primary_location && item.primary_location.landing_page_url) ||
                         item.doi ||
                         item.id;

      return {
        title: item.title || 'Studio scientifico senza titolo',
        link: landingUrl,
        description: abstract || (item.concepts ? `Argomenti di ricerca: ${item.concepts.map(c => c.display_name).slice(0, 5).join(', ')}` : ''),
        author: authorName,
        published_at: item.publication_date ? new Date(item.publication_date).toISOString() : new Date().toISOString(),
        image_url: ''
      };
    });
  } catch (err) {
    console.error(`Errore OpenAlex per ${source.name}:`, err.message);
    return [];
  }
}

// Raccolta da PubMed (Studi clinici e medicina)
async function fetchPubMed(source) {
  try {
    const searchRes = await safeFetch(source.url);
    if (!searchRes.ok) throw new Error(`PubMed Search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    const idList = searchData.esearchresult?.idlist || [];

    if (idList.length === 0) return [];

    // Recupero dettagli esummary
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.slice(0, 10).join(',')}&retmode=json`;
    const sumRes = await safeFetch(summaryUrl);
    if (!sumRes.ok) throw new Error(`PubMed Summary HTTP ${sumRes.status}`);
    const sumData = await sumRes.json();
    const resultObj = sumData.result || {};

    const items = [];
    for (const uid of idList.slice(0, 10)) {
      const doc = resultObj[uid];
      if (!doc) continue;

      const title = doc.title ? stripHtml(doc.title) : 'Studio clinico PubMed';
      const link = `https://pubmed.ncbi.nlm.nih.gov/${uid}/`;
      const authors = Array.isArray(doc.authors) ? doc.authors.map(a => a.name).join(', ') : 'Ricercatori Clinici';
      const sourceJournal = doc.source || 'PubMed';
      const pubDateStr = doc.pubdate || doc.sortpubdate || new Date().toISOString();

      items.push({
        title,
        link,
        description: `Pubblicazione indicizzata in ${sourceJournal}. Identificativo PubMed PMID: ${uid}. Dati clinici e revisione scientifica disponibile.`,
        author: authors.slice(0, 100),
        published_at: new Date(pubDateStr).toISOString(),
        image_url: ''
      });
    }

    return items;
  } catch (err) {
    console.error(`Errore PubMed per ${source.name}:`, err.message);
    return [];
  }
}

// Elabora una singola fonte e archivia i nuovi contenuti
async function processSource(source, progressCallback) {
  const database = getDb();
  let rawItems = [];
  let errorMsg = null;

  try {
    if (source.type === 'openalex') {
      rawItems = await fetchOpenAlex(source);
    } else if (source.type === 'pubmed') {
      rawItems = await fetchPubMed(source);
    } else {
      // RSS, Atom, Google News RSS
      const res = await safeFetch(source.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const xml = await res.text();
      rawItems = parseRssOrAtom(xml);
    }
  } catch (err) {
    errorMsg = err.message;
    console.error(`[SearchEngine] Errore elaborazione fonte "${source.name}":`, err.message);
  }

  // Aggiorna stato fonte
  const updateSourceStmt = database.prepare(`
    UPDATE sources
    SET last_checked_at = ?, last_status = ?, last_error = ?
    WHERE id = ?
  `);
  updateSourceStmt.run(
    new Date().toISOString(),
    errorMsg ? 'errore' : 'ok',
    errorMsg || null,
    source.id
  );

  let newArticlesCount = 0;
  const configuredKeywords = JSON.parse(source.keywords || '[]');
  const configuredExclude = JSON.parse(source.exclude_keywords || '[]');

  for (const raw of rawItems) {
    // Filtro esclusione parole chiave
    const textLower = `${raw.title} ${raw.description}`.toLowerCase();
    const hasExcluded = configuredExclude.some(kw => textLower.includes(kw.toLowerCase()));
    if (hasExcluded) continue;

    // Rileva tipologia documento
    const docType = detectDocumentType(raw.title, raw.description, source.document_type);

    // Genera sintesi in italiano
    const summary = generateItalianSummary(raw.title, raw.description, source.name, docType);

    // Estrai parole chiave
    const keywords = Array.from(new Set([
      ...configuredKeywords,
      ...extractKeywords(raw.title, raw.description, source.category_id)
    ])).slice(0, 8);

    // Calcola punteggio di rilevanza
    const relevanceScore = calculateRelevanceScore(raw.title, summary, keywords, source.name);

    // Salva nel database (con deduplicazione automatica)
    const saveResult = saveArticle({
      category_id: source.category_id,
      source_id: source.id,
      source_name: source.name,
      title: raw.title,
      subtitle: raw.description ? raw.description.slice(0, 180) : '',
      summary,
      author: raw.author || source.name,
      url: raw.link,
      image_url: raw.image_url,
      published_at: raw.published_at,
      document_type: docType,
      keywords,
      relevance_score: relevanceScore
    });

    if (saveResult.added) {
      newArticlesCount++;
    }
  }

  if (progressCallback) {
    progressCallback({
      source_id: source.id,
      source_name: source.name,
      category_id: source.category_id,
      items_found: rawItems.length,
      articles_added: newArticlesCount,
      error: errorMsg
    });
  }

  return {
    source_id: source.id,
    source_name: source.name,
    items_found: rawItems.length,
    articles_added: newArticlesCount,
    error: errorMsg
  };
}

// Esegue l'aggiornamento (manuale o schedulato) su tutte o una singola categoria
async function runUpdate({ categoryId = null, triggerType = 'manual_all', progressCallback = null } = {}) {
  const database = getDb();

  // Inserisci log iniziale
  const startLogStmt = database.prepare(`
    INSERT INTO update_logs (
      started_at, trigger_type, category_id, sources_queried,
      results_found, articles_added, status, log_details
    ) VALUES (?, ?, ?, 0, 0, 0, 'in_progress', '[]')
  `);
  const logInfo = startLogStmt.run(new Date().toISOString(), triggerType, categoryId);
  const logId = logInfo.lastInsertRowid;

  let sourcesSql = 'SELECT * FROM sources WHERE is_active = 1';
  const sourcesParams = [];
  if (categoryId && categoryId !== 'tutte') {
    sourcesSql += ' AND category_id = ?';
    sourcesParams.push(categoryId);
  }

  const sources = database.prepare(sourcesSql).all(...sourcesParams);

  let totalFound = 0;
  let totalAdded = 0;
  const stepLogs = [];

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];

    if (progressCallback) {
      progressCallback({
        status: 'working',
        current_step: i + 1,
        total_steps: sources.length,
        current_category: src.category_id,
        current_source: src.name,
        total_found: totalFound,
        total_added: totalAdded
      });
    }

    const res = await processSource(src, progressCallback);
    totalFound += res.items_found;
    totalAdded += res.articles_added;
    stepLogs.push(res);
  }

  // Completa il log
  const finishLogStmt = database.prepare(`
    UPDATE update_logs
    SET finished_at = ?, sources_queried = ?, results_found = ?,
        articles_added = ?, status = 'completed', log_details = ?
    WHERE id = ?
  `);
  finishLogStmt.run(
    new Date().toISOString(),
    sources.length,
    totalFound,
    totalAdded,
    JSON.stringify(stepLogs),
    logId
  );

  if (progressCallback) {
    progressCallback({
      status: 'completed',
      log_id: logId,
      total_sources: sources.length,
      total_found: totalFound,
      total_added: totalAdded,
      step_logs: stepLogs
    });
  }

  return {
    log_id: logId,
    total_sources: sources.length,
    total_found: totalFound,
    total_added: totalAdded,
    step_logs: stepLogs
  };
}

// Procedura guidata & aggiunta rapida: Test raggiungibilità e riconoscimento tipologia URL
async function probeSourceUrl(inputUrl) {
  try {
    let targetUrl = inputUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const res = await safeFetch(targetUrl, {}, 8000);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    let recognizedType = 'web';
    let effectiveUrl = targetUrl;
    let sampleItems = [];

    // Estrai il nome suggerito dal dominio o dal tag <title>
    let suggestedName = '';
    const titleTagMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch) {
      suggestedName = stripHtml(titleTagMatch[1]).split(/[-|–•]/)[0].trim();
    }
    if (!suggestedName) {
      try {
        const u = new URL(targetUrl);
        suggestedName = u.hostname.replace('www.', '');
      } catch {
        suggestedName = 'Nuova Fonte';
      }
    }

    if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom') || text.includes('<rss') || text.includes('<feed')) {
      recognizedType = 'rss';
      sampleItems = parseRssOrAtom(text).slice(0, 3);
    } else if (contentType.includes('json') && (targetUrl.includes('openalex.org') || text.includes('results'))) {
      recognizedType = 'openalex';
    } else if (targetUrl.includes('ncbi.nlm.nih.gov') || targetUrl.includes('pubmed')) {
      recognizedType = 'pubmed';
    } else {
      // È una pagina HTML: cerca se c'è un tag <link rel="alternate" type="application/rss+xml">
      const rssLinkMatch = text.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i) ||
                           text.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["']/i);
      
      if (rssLinkMatch) {
        let discoveredRss = rssLinkMatch[1];
        if (discoveredRss.startsWith('/')) {
          const u = new URL(targetUrl);
          discoveredRss = `${u.origin}${discoveredRss}`;
        }
        try {
          const rssRes = await safeFetch(discoveredRss, {}, 6000);
          if (rssRes.ok) {
            const rssText = await rssRes.text();
            effectiveUrl = discoveredRss;
            recognizedType = 'rss';
            sampleItems = parseRssOrAtom(rssText).slice(0, 3);
          }
        } catch {}
      }

      // Se non ha trovato un feed RSS diretto, abilita il connettore intelligente Google News site query
      if (recognizedType === 'web' || sampleItems.length === 0) {
        try {
          const host = new URL(targetUrl).hostname.replace('www.', '');
          const gnewsUrl = `https://news.google.com/rss/search?q=site:${host}&hl=it&gl=IT&ceid=IT:it`;
          const gRes = await safeFetch(gnewsUrl, {}, 6000);
          if (gRes.ok) {
            const gText = await gRes.text();
            const gItems = parseRssOrAtom(gText);
            if (gItems.length > 0) {
              effectiveUrl = gnewsUrl;
              recognizedType = 'google_news';
              sampleItems = gItems.slice(0, 3);
            }
          }
        } catch {}
      }
    }

    return {
      reachable: true,
      status_code: res.status,
      content_type: contentType,
      recognized_type: recognizedType,
      effective_url: effectiveUrl,
      suggested_name: suggestedName,
      sample_items_count: sampleItems.length,
      sample_items: sampleItems
    };
  } catch (err) {
    return {
      reachable: false,
      error: err.message
    };
  }
}

module.exports = {
  parseRssOrAtom,
  processSource,
  runUpdate,
  probeSourceUrl
};
