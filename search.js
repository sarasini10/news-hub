/**
 * NEWS INTELLIGENCE HUB - Modulo Ricerca Trasversale Intelligente
 * Interroga simultaneamente tutte le 8 categorie e l'intero archivio storico
 */

const SearchView = {
  currentFilters: {
    query: '',
    categoryId: 'tutte',
    documentType: 'tutti',
    fromDate: '',
    toDate: '',
    sortBy: 'relevance_desc',
    limit: 60
  },

  listenersAttached: false,
  debounceTimer: null,

  activate(initialQuery = '', categoryId = 'tutte') {
    const input = document.getElementById('search-view-input');
    const catSelect = document.getElementById('filter-search-category');

    if (initialQuery !== undefined && initialQuery !== null && initialQuery !== '') {
      this.currentFilters.query = initialQuery;
      if (input) input.value = initialQuery;
    } else if (input && input.value.trim()) {
      this.currentFilters.query = input.value.trim();
    }

    if (categoryId && categoryId !== 'tutte') {
      this.currentFilters.categoryId = categoryId;
      if (catSelect) catSelect.value = categoryId;
    }

    this.setupListeners();
    this.executeSearch();
  },

  setupListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    const input = document.getElementById('search-view-input');
    const btnSearch = document.getElementById('btn-exec-search');
    const catSelect = document.getElementById('filter-search-category');
    const docSelect = document.getElementById('filter-search-doctype');
    const sortSelect = document.getElementById('filter-search-sort');
    const btnReset = document.getElementById('btn-reset-search-filters');
    const timeQuick = document.querySelectorAll('.quick-date-btn');

    // Ricerca mentre si digita con debounce di 350ms
    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.executeSearch();
        }, 350);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this.debounceTimer);
          this.executeSearch();
        }
      });
    }

    // Pulsante Cerca
    if (btnSearch) {
      btnSearch.addEventListener('click', () => {
        clearTimeout(this.debounceTimer);
        this.executeSearch();
      });
    }

    // Cambio Categoria
    if (catSelect) {
      catSelect.addEventListener('change', () => {
        this.executeSearch();
      });
    }

    // Cambio Tipologia Documento
    if (docSelect) {
      docSelect.addEventListener('change', () => {
        this.executeSearch();
      });
    }

    // Cambio Ordinamento
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.executeSearch();
      });
    }

    // Filtri temporali rapidi (Tutto, 24h, 7gg, 30gg)
    timeQuick.forEach(btn => {
      btn.addEventListener('click', () => {
        timeQuick.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const days = parseInt(btn.getAttribute('data-days') || '0', 10);

        if (days > 0) {
          const d = new Date();
          d.setDate(d.getDate() - days);
          this.currentFilters.fromDate = d.toISOString();
        } else {
          this.currentFilters.fromDate = '';
        }
        this.executeSearch();
      });
    });

    // Pulsante Azzera Filtri
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.resetFilters();
      });
    }
  },

  resetFilters() {
    const input = document.getElementById('search-view-input');
    const catSelect = document.getElementById('filter-search-category');
    const docSelect = document.getElementById('filter-search-doctype');
    const sortSelect = document.getElementById('filter-search-sort');
    const timeQuick = document.querySelectorAll('.quick-date-btn');

    if (input) input.value = '';
    if (catSelect) catSelect.value = 'tutte';
    if (docSelect) docSelect.value = 'tutti';
    if (sortSelect) sortSelect.value = 'relevance_desc';

    timeQuick.forEach((b, i) => {
      if (i === 0) b.classList.add('active');
      else b.classList.remove('active');
    });

    this.currentFilters = {
      query: '',
      categoryId: 'tutte',
      documentType: 'tutti',
      fromDate: '',
      toDate: '',
      sortBy: 'relevance_desc',
      limit: 60
    };

    this.executeSearch();
  },

  setFilterCategory(catId) {
    const catSelect = document.getElementById('filter-search-category');
    if (catSelect) catSelect.value = catId;
    this.executeSearch();
  },

  searchKeyword(keyword) {
    const input = document.getElementById('search-view-input');
    if (input) input.value = keyword;
    const catSelect = document.getElementById('filter-search-category');
    if (catSelect) catSelect.value = 'tutte';
    this.executeSearch();
  },

  async executeSearch() {
    const resultsContainer = document.getElementById('search-results-list');
    const statsBadge = document.getElementById('search-stats-badge');
    const input = document.getElementById('search-view-input');
    const catSelect = document.getElementById('filter-search-category');
    const docSelect = document.getElementById('filter-search-doctype');
    const sortSelect = document.getElementById('filter-search-sort');

    if (!resultsContainer) return;

    // Sincronizza sempre dai controlli DOM reali
    const query = input ? input.value.trim() : '';
    const categoryId = catSelect ? catSelect.value : 'tutte';
    const documentType = docSelect ? docSelect.value : 'tutti';
    const sortBy = sortSelect ? sortSelect.value : 'relevance_desc';

    this.currentFilters.query = query;
    this.currentFilters.categoryId = categoryId;
    this.currentFilters.documentType = documentType;
    this.currentFilters.sortBy = sortBy;

    resultsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-dim);"><div class="progress-spinner" style="margin: 0 auto 12px;"></div>Interrogazione archivio storico globale in corso...</div>';

    const startTime = performance.now();

    try {
      const res = await API.searchArticles(this.currentFilters);
      if (!res.success) throw new Error(res.error || 'Errore durante la ricerca');

      const elapsed = Math.round(performance.now() - startTime);

      if (statsBadge) {
        statsBadge.textContent = `${res.total} risultati trovati in ${elapsed} ms`;
      }

      if (!res.items || res.items.length === 0) {
        let suggestionHtml = '';
        if (categoryId !== 'tutte') {
          suggestionHtml = `
            <div style="margin-top: 14px;">
              <button class="btn btn-secondary btn-sm" onclick="SearchView.setFilterCategory('tutte')">
                🔍 Cerca "${App.escapeHtml(query || 'tutto')}" in TUTTE le Categorie
              </button>
            </div>
          `;
        }

        resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: var(--text-dim);">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
            <p style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);">Nessun articolo trovato</p>
            <p style="font-size: 0.88rem; margin-top: 6px; max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.6;">
              ${query ? `Nessun risultato per: <strong>"${App.escapeHtml(query)}"</strong>.` : 'Nessun risultato per i filtri selezionati.'}
            </p>
            ${suggestionHtml}
            <div style="margin-top: 16px;">
              <button class="btn btn-secondary btn-sm" onclick="SearchView.resetFilters()">
                🔄 Azzera tutti i filtri
              </button>
            </div>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = res.items.map(art => {
        const docBadgeClass = App.getDocTypeBadgeClass(art.document_type);
        const pubDate = new Date(art.published_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: 'short', year: 'numeric'
        });

        let keywords = [];
        try {
          keywords = typeof art.keywords === 'string' ? JSON.parse(art.keywords || '[]') : (art.keywords || []);
        } catch {
          keywords = [];
        }

        // Evidenziazione termini cercati
        const highlightedTitle = this.highlightTerms(App.escapeHtml(art.title || ''), query);
        const highlightedSummary = this.highlightTerms(App.escapeHtml(art.summary || art.subtitle || 'Nessuna sintesi disponibile.'), query);

        return `
          <div class="article-row-card" data-id="${art.id}">
            <div class="article-header-row">
              <div class="article-tags-wrap">
                <span class="article-cat-tag" style="cursor: pointer;" onclick="SearchView.setFilterCategory('${art.category_id}')" title="Filtra per questa categoria">${(art.category_id || '').toUpperCase()}</span>
                <span class="doc-type-badge ${docBadgeClass}">${art.document_type || 'Notizia'}</span>
                <span class="relevance-pill" title="Indice di rilevanza calcolato">⚡ ${art.relevance_score || 85}%</span>
              </div>
              <div class="article-date-tag">📅 ${pubDate}</div>
            </div>

            <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="article-title-link">
              ${highlightedTitle}
            </a>
            <button class="toggle-summary-btn summary-open" id="srch-toggle-${art.id}" onclick="SearchView.toggleSummary(${art.id})" title="Mostra/nascondi sintesi">
              <i class="ts-arrow">▲</i> Sintesi
            </button>

            <div class="article-summary-text" id="srch-summary-${art.id}">
              ${highlightedSummary}
            </div>

            ${keywords.length > 0 ? `
              <div class="article-keywords-bar">
                ${keywords.slice(0, 8).map(kw => `<span class="keyword-pill" style="cursor:pointer;" onclick="SearchView.searchKeyword('${App.escapeHtml(kw)}')" title="Cerca per questo tag">#${App.escapeHtml(kw)}</span>`).join('')}
              </div>
            ` : ''}

            <div class="article-footer-row">
              <div>
                <strong>Fonte verificata:</strong> <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="news-source-link">🌐 ${App.escapeHtml(art.source_name || '')}</a>
                ${art.author ? ` • <em>Autore: ${App.escapeHtml(art.author)}</em>` : ''}
              </div>
              <div class="article-actions-group">
                <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="btn-article-action" style="text-decoration:none;">
                  🔗 Apri Articolo Originale
                </a>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      resultsContainer.innerHTML = `<div style="color: #ef4444; padding: 20px;">Errore durante la ricerca: ${err.message}</div>`;
    }
  },

  highlightTerms(text, query) {
    if (!query || !query.trim()) return text;
    const words = query.trim().split(/\s+/).filter(w => w.length > 1);
    if (words.length === 0) return text;

    try {
      const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi');
      return text.replace(pattern, '<mark style="background: rgba(250, 204, 21, 0.35); color: inherit; padding: 0 2px; border-radius: 2px;">$1</mark>');
    } catch {
      return text;
    }
  },

  // Mostra/nascondi anteprima summary nelle card ricerca
  toggleSummary(articleId) {
    const summary = document.getElementById(`srch-summary-${articleId}`);
    const btn     = document.getElementById(`srch-toggle-${articleId}`);
    if (!summary || !btn) return;

    const isHidden = summary.classList.contains('summary-hidden');
    if (isHidden) {
      summary.classList.remove('summary-hidden');
      btn.classList.add('summary-open');
      btn.querySelector('.ts-arrow').textContent = '▲';
    } else {
      summary.classList.add('summary-hidden');
      btn.classList.remove('summary-open');
      btn.querySelector('.ts-arrow').textContent = '▼';
    }
  }
};

window.SearchView = SearchView;
