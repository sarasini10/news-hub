/**
 * NEWS INTELLIGENCE HUB - Modulo di Intelligence, Sintesi e Classificazione
 * Genera sintesi analitiche in italiano, estrae parole chiave e calcola la rilevanza
 */

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>([\S\s]*?)<\/script>/gim, '')
    .replace(/<style[^>]*>([\S\s]*?)<\/style>/gim, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Estrazione intelligente parole chiave dal testo
function extractKeywords(title, text = '', category = '') {
  const fullText = `${title} ${text}`.toLowerCase();

  // Stopwords italiane e inglesi
  const stopWords = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su',
    'per', 'tra', 'fra', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla',
    'ai', 'agli', 'alle', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'nel', 'nello', 'nella',
    'nei', 'negli', 'nelle', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'ed', 'ad', 'che',
    'non', 'si', 'ci', 'ne', 'ha', 'hanno', 'sono', 'era', 'stato', 'stata', 'dopo', 'prima',
    'mentre', 'anche', 'più', 'come', 'cosa', 'chi', 'dove', 'quando', 'perché', 'quale', 'quali',
    'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle', 'tutto', 'tutti',
    'the', 'and', 'or', 'for', 'with', 'from', 'about', 'into', 'over', 'after', 'new', 'more'
  ]);

  // Tokenizzazione
  const words = fullText
    .replace(/[^a-zàèéìòù0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w));

  const frequency = {};
  for (const w of words) {
    frequency[w] = (frequency[w] || 0) + 1;
  }

  // Ordina per frequenza
  const sorted = Object.keys(frequency).sort((a, b) => frequency[b] - frequency[a]);

  // Seleziona i primi 5-7 termini rilevanti
  return sorted.slice(0, 6);
}

// Genera una sintesi chiara ed esecutiva in lingua italiana
function generateItalianSummary(title, rawSnippet, sourceName, docType) {
  const cleanedSnippet = stripHtml(rawSnippet);

  if (!cleanedSnippet || cleanedSnippet.length < 30) {
    return `Aggiornamento informativo da ${sourceName}: "${title}". Consulta la documentazione completa e i dettagli verificati direttamente tramite il collegamento originale della fonte.`;
  }

  // Se è uno studio scientifico / accademico in inglese
  const isEnglishScientific = /abstract|study|findings|results|authors|journal|doi|methodology/i.test(cleanedSnippet);
  if (isEnglishScientific && (docType === 'Studio scientifico' || docType === 'Pubblicazione accademica')) {
    const sentences = cleanedSnippet.split(/(?<=[.?!])\s+/);
    const mainFindings = sentences.slice(0, 3).join(' ');
    return `[Studio Accademico] ${title}. Sintesi analitica: la ricerca pubblicata e indicizzata analizza l'evidenza empirica sul tema. Estratto metodologico e risultati: "${mainFindings.slice(0, 320)}...". I dati e le conclusioni integrali sono accessibili nel paper originale.`;
  }

  // Normale testo italiano: estrai le prime frasi di valore
  const sentences = cleanedSnippet
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 15 && !s.includes('cookie') && !s.includes('iscriviti'));

  if (sentences.length >= 2) {
    const summary = sentences.slice(0, 3).join(' ');
    return summary.length > 360 ? summary.slice(0, 357) + '...' : summary;
  }

  return cleanedSnippet.length > 320 ? cleanedSnippet.slice(0, 317) + '...' : cleanedSnippet;
}

// Calcola il punteggio di rilevanza (0 - 100)
function calculateRelevanceScore(title, summary, keywords, sourceName) {
  let score = 75; // Punteggio base

  const full = `${title} ${summary}`.toLowerCase();

  // Presenza di dati numerici o riferimenti analitici
  if (/\b\d+([.,]\d+)?%?\b/.test(full)) score += 5;

  // Fonte primaria autorevole
  if (/ansa|sole 24 ore|vatican|pubmed|openalex|arxiv|cnr|ministero|istat|gazzetta/i.test(sourceName)) {
    score += 10;
  }

  // Lunghezza e ricchezza del contenuto
  if (summary && summary.length > 150) score += 5;

  // Parole chiave
  if (keywords && keywords.length >= 4) score += 5;

  return Math.min(score, 98);
}

// Rileva la tipologia di documento
function detectDocumentType(title, snippet, defaultType) {
  const text = `${title} ${snippet}`.toLowerCase();

  if (/studi|ricerca|scoperta|paper|doi|abstract|trial|clinico|peer-reviewed|universit|laboratorio/i.test(text)) {
    return 'Studio scientifico';
  }
  if (/decreto|circolare|delibera|ordinanza|legge|parlamento|ministero|comune di|gazzetta ufficiale|santa sede|enciclica/i.test(text)) {
    return 'Documento istituzionale';
  }
  if (/editoriale|commento|punto di vista|analisi|opinione|il punto|il corsivo/i.test(text)) {
    return 'Opinione';
  }
  if (/approfondimento|inchiesta|reportage|dossier|focus/i.test(text)) {
    return 'Articolo';
  }
  return defaultType || 'Notizia';
}

module.exports = {
  stripHtml,
  extractKeywords,
  generateItalianSummary,
  calculateRelevanceScore,
  detectDocumentType
};
