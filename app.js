/**
 * NEWS INTELLIGENCE HUB - Controller Principale Dashboard e Interfaccia
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  currentView: 'dashboard',
  isUpdating: false,

  init() {
    this.setupTheme();
    this.setupNavigation();
    this.setupGlobalSearch();
    this.setupUpdateEngine();
    this.setupServiceWorker();
    this.loadDashboardData();
  },

  // Gestione Tema Chiaro / Scuro
  setupTheme() {
    const savedTheme = localStorage.getItem('newshub_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButton(savedTheme);

    const themeToggleBtn = document.getElementById('btn-toggle-theme');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('newshub_theme', next);
        this.updateThemeButton(next);
      });
    }
  },

  updateThemeButton(theme) {
    const iconSpan = document.getElementById('theme-icon');
    if (iconSpan) {
      iconSpan.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  },

  // Navigazione tra le viste
  setupNavigation() {
    const navButtons = document.querySelectorAll('[data-view-target]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = btn.getAttribute('data-view-target');
        const categoryFilter = btn.getAttribute('data-category');
        this.switchView(targetView, { category: categoryFilter });
      });
    });

    const brand = document.querySelector('.brand-section');
    if (brand) {
      brand.addEventListener('click', () => {
        this.switchView('dashboard');
      });
    }
  },

  switchView(viewName, params = {}) {
    this.currentView = viewName;

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active-view');
    });

    const targetSec = document.getElementById('view-' + viewName);
    if (targetSec) {
      targetSec.classList.add('active-view');
    }

    document.querySelectorAll('[data-view-target]').forEach(btn => {
      if (btn.getAttribute('data-view-target') === viewName) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    if (viewName === 'dashboard') {
      this.loadDashboardData();
    } else if (viewName === 'archive') {
      window.ArchiveView && window.ArchiveView.activate(params.category);
    } else if (viewName === 'search') {
      window.SearchView && window.SearchView.activate(params.query, params.category);
    } else if (viewName === 'settings') {
      window.SettingsView && window.SettingsView.activate(params.category);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = input.value.trim();
        if (query) {
          this.switchView('search', { query });
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  },

  setupUpdateEngine() {
    const refreshAllBtn = document.getElementById('btn-refresh-all');
    if (refreshAllBtn) {
      refreshAllBtn.addEventListener('click', () => {
        this.triggerUpdate(null);
      });
    }

    API.initProgressStream(
      (data) => {
        this.showProgressBar(true);
        this.updateProgressUI(data);
      },
      (data) => {
        this.showProgressBar(true);
        this.updateProgressComplete(data);
        setTimeout(() => {
          this.showProgressBar(false);
          this.loadDashboardData();
        }, 3000);
      },
      (data) => {
        this.updateProgressError(data);
      }
    );
  },

  async triggerUpdate(categoryId = null) {
    if (this.isUpdating) return;
    this.isUpdating = true;

    const refreshBtn = document.getElementById('btn-refresh-all');
    if (refreshBtn) refreshBtn.classList.add('loading');

    this.showProgressBar(true);
    const detailEl = document.getElementById('progress-detail-text');
    if (detailEl) {
      detailEl.innerHTML = '<span>Inizializzazione scansione ' + (categoryId ? 'della categoria ' + categoryId : 'completa di tutte le 8 categorie') + '...</span>';
    }

    try {
      await API.triggerUpdate(categoryId);
    } catch (err) {
      alert('Errore avvio aggiornamento: ' + err.message);
      this.isUpdating = false;
      if (refreshBtn) refreshBtn.classList.remove('loading');
      this.showProgressBar(false);
    }
  },

  showProgressBar(show) {
    const bar = document.getElementById('progress-live-bar');
    if (bar) {
      if (show) {
        bar.classList.add('active');
      } else {
        bar.classList.remove('active');
        this.isUpdating = false;
        const refreshBtn = document.getElementById('btn-refresh-all');
        if (refreshBtn) refreshBtn.classList.remove('loading');
      }
    }
  },

  updateProgressUI(data) {
    const percent = data.total_steps ? Math.round((data.current_step / data.total_steps) * 100) : 0;
    const fillEl = document.getElementById('progress-fill');
    if (fillEl) fillEl.style.width = percent + '%';

    const titleEl = document.getElementById('progress-status-title');
    if (titleEl) titleEl.textContent = 'Scansione in corso (' + percent + '%)...';

    const catEl = document.getElementById('progress-stat-cat');
    if (catEl) catEl.textContent = (data.current_category || '').toUpperCase();

    const srcEl = document.getElementById('progress-stat-src');
    if (srcEl) srcEl.textContent = data.current_source || '';

    const foundEl = document.getElementById('progress-stat-found');
    if (foundEl) foundEl.textContent = data.total_found || 0;

    const addedEl = document.getElementById('progress-stat-added');
    if (addedEl) addedEl.textContent = data.total_added || 0;

    const detailEl = document.getElementById('progress-detail-text');
    if (detailEl) {
      detailEl.innerHTML = '<span>Analisi fonte: <strong>' + (data.current_source || '') + '</strong></span><span>Avanzamento: ' + (data.current_step || 1) + ' di ' + (data.total_steps || 1) + '</span>';
    }
  },

  updateProgressComplete(data) {
    const fillEl = document.getElementById('progress-fill');
    if (fillEl) fillEl.style.width = '100%';

    const titleEl = document.getElementById('progress-status-title');
    if (titleEl) titleEl.textContent = 'Aggiornamento completato con successo!';

    const detailEl = document.getElementById('progress-detail-text');
    if (detailEl) {
      detailEl.innerHTML = '<span>Processate ' + (data.total_sources || 0) + ' fonti attive. Acquisiti <strong>' + (data.total_added || 0) + '</strong> nuovi articoli certificati.</span>';
    }
  },

  updateProgressError(data) {
    const titleEl = document.getElementById('progress-status-title');
    if (titleEl) {
      titleEl.textContent = 'Avviso aggiornamento: ' + (data.error || 'Errore riscontrato');
    }
  },

  async loadDashboardData() {
    try {
      const res = await API.getDashboard();
      if (!res.success) throw new Error(res.error);

      const totalArticlesEl = document.getElementById('kpi-total-articles');
      if (totalArticlesEl) totalArticlesEl.textContent = res.total_articles.toLocaleString('it-IT');

      const unreadEl = document.getElementById('kpi-unread-articles');
      if (unreadEl) unreadEl.textContent = res.unread_articles.toLocaleString('it-IT');

      const sourcesEl = document.getElementById('kpi-active-sources');
      if (sourcesEl) sourcesEl.textContent = res.active_sources.toLocaleString('it-IT');

      const lastUpdateEl = document.getElementById('kpi-last-update');
      if (lastUpdateEl) {
        if (res.last_update && res.last_update.finished_at) {
          const d = new Date(res.last_update.finished_at);
          lastUpdateEl.textContent = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } else {
          lastUpdateEl.textContent = 'In attesa';
        }
      }

      this.renderCategoriesGrid(res.categories);
    } catch (err) {
      console.error('Errore caricamento dati dashboard:', err);
    }
  },

  renderCategoriesGrid(categories) {
    const container = document.getElementById('categories-grid');
    if (!container) return;

    container.innerHTML = '';

    categories.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-container';
      card.style.borderTop = '4px solid ' + (cat.color || '#2563eb');

      let lastDateText = 'Nessun articolo';
      if (cat.last_article_date) {
        const d = new Date(cat.last_article_date);
        lastDateText = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      }

      let recentNewsHtml = '';
      if (cat.recent_articles && cat.recent_articles.length > 0) {
        recentNewsHtml = cat.recent_articles.map(art => {
          const docBadgeClass = this.getDocTypeBadgeClass(art.document_type);
          const artDate = new Date(art.published_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
          const title = this.escapeHtml(art.title || '');
          const summary = this.escapeHtml(art.summary || art.subtitle || '');
          const sourceName = this.escapeHtml(art.source_name || '');
          const docType = art.document_type || 'Notizia';
          const relevance = art.relevance_score || 85;
          const url = art.url || '#';

          return '<div class="news-card-mini" data-article-id="' + art.id + '">' +
            '<div class="news-card-meta-line">' +
            '<span class="doc-type-badge ' + docBadgeClass + '">' + docType + '</span>' +
            '<span class="relevance-pill">⚡ ' + relevance + '%</span>' +
            '</div>' +
            '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="news-card-title">' + title + '</a>' +
            '<p class="news-card-summary" onclick="this.classList.toggle(\'expanded\')" title="Tocca o passa sopra con il mouse per leggere la sintesi completa">' + summary + '</p>' +
            '<div class="news-card-footer">' +
            '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="news-source-link"><span>🌐</span> ' + sourceName + '</a>' +
            '<span>📅 ' + artDate + '</span>' +
            '</div>' +
            '</div>';
        }).join('');
      } else {
        recentNewsHtml = '<div style="text-align:center;padding:32px 16px;color:var(--text-dim);font-size:0.88rem;">' +
          '<p>Nessun articolo archiviato in questa categoria.</p>' +
          '<button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="App.triggerUpdate(\'' + cat.id + '\')">🔄 Avvia prima ricerca</button>' +
          '</div>';
      }

      const unreadBadge = cat.unread_articles > 0
        ? '<span class="badge-unread">+' + cat.unread_articles + '</span>'
        : '';

      const catId = cat.id;
      const catName = cat.name;
      const catColor = cat.color || '#2563eb';

      let html = '<div class="category-top-bar">';
      html += '<div class="category-title-wrap">';
      html += '<div class="category-icon-badge" style="background:' + catColor + '22;color:' + catColor + ';">' + this.getCategoryIcon(catId) + '</div>';
      html += '<div><h3 class="category-title-text">' + catName + '</h3>';
      html += '<div style="font-size:0.72rem;color:var(--text-dim);">Aggiornato: ' + lastDateText + '</div></div>';
      html += '</div>';
      html += '<div class="category-meta-chips">' + unreadBadge;
      html += '<span class="badge-total">' + cat.total_articles + ' archiviati</span>';
      html += '<button class="cat-top-add-btn" onclick="App.openQuickAddSource(\'' + catId + '\',\'' + catName.replace(/'/g, '') + '\')">➕ Fonte</button>';
      html += '</div></div>';
      html += '<div class="category-body">' + recentNewsHtml + '</div>';
      html += '<div class="category-actions-bar">';
      html += '<button class="cat-btn-action cat-btn-add-source" onclick="App.openQuickAddSource(\'' + catId + '\',\'' + catName.replace(/'/g, '') + '\')">➕ Aggiungi Fonte</button>';
      html += '<button class="cat-btn-action" onclick="App.triggerUpdate(\'' + catId + '\')">🔄 Aggiorna</button>';
      html += '<button class="cat-btn-action" onclick="App.switchView(\'archive\',{category:\'' + catId + '\'})">📁 Archivio</button>';
      html += '<button class="cat-btn-action" onclick="App.switchView(\'settings\',{category:\'' + catId + '\'})">⚙️ Fonti (' + cat.active_sources + ')</button>';
      html += '</div>';

      card.innerHTML = html;
      container.appendChild(card);
    });
  },

  getCategoryIcon(catId) {
    const icons = {
      politica: '🏛️', sport: '🏅', religione: '✝️',
      ricerca: '🔬', economia: '📈', medicina: '🩺',
      interazioni: '🧠', romagna: '📍'
    };
    return icons[catId] || '📰';
  },

  getDocTypeBadgeClass(docType) {
    if (!docType) return 'doc-type-notizia';
    const lower = docType.toLowerCase();
    if (lower.includes('studio') || lower.includes('accademica')) return 'doc-type-studio';
    if (lower.includes('istituzionale') || lower.includes('ecclesiale')) return 'doc-type-istituzionale';
    if (lower.includes('articolo')) return 'doc-type-articolo';
    if (lower.includes('opinione') || lower.includes('commento')) return 'doc-type-opinione';
    return 'doc-type-notizia';
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // ---- MODALE AGGIUNTA RAPIDA FONTE ----
  openQuickAddSource(catId, catName) {
    const modal = document.getElementById('modal-quick-add-source');
    const idInput = document.getElementById('quick-add-cat-id');
    const nameEl = document.getElementById('quick-add-cat-name');
    const urlInput = document.getElementById('quick-add-url');
    const nameInput = document.getElementById('quick-add-name');
    const keywordsInput = document.getElementById('quick-add-keywords');
    const probeBox = document.getElementById('quick-add-probe-box');

    if (idInput) idInput.value = catId;
    if (nameEl) nameEl.textContent = (catName || catId).toUpperCase();
    if (urlInput) urlInput.value = '';
    if (nameInput) nameInput.value = '';
    if (keywordsInput) keywordsInput.value = '';
    if (probeBox) {
      probeBox.style.display = 'none';
      probeBox.innerHTML = '';
      probeBox.className = 'probe-status-box';
    }

    this._lastQuickProbe = null;

    if (modal) modal.classList.add('open');
    if (urlInput) setTimeout(() => urlInput.focus(), 150);
  },

  closeQuickAddSource() {
    const modal = document.getElementById('modal-quick-add-source');
    if (modal) modal.classList.remove('open');
  },

  async probeQuickAddUrl() {
    const urlInput = document.getElementById('quick-add-url');
    const nameInput = document.getElementById('quick-add-name');
    const probeBox = document.getElementById('quick-add-probe-box');
    const btnProbe = document.getElementById('btn-quick-probe');

    const rawUrl = urlInput ? urlInput.value.trim() : '';
    if (!rawUrl) {
      alert('Inserisci prima un indirizzo web da verificare');
      if (urlInput) urlInput.focus();
      return;
    }

    if (probeBox) {
      probeBox.style.display = 'block';
      probeBox.className = 'probe-status-box';
      probeBox.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><div class="progress-spinner"></div><span>Connessione e analisi in corso...</span></div>';
    }
    if (btnProbe) btnProbe.disabled = true;

    try {
      const res = await API.probeSourceUrl(rawUrl);
      if (btnProbe) btnProbe.disabled = false;

      if (!res.success || !res.reachable) {
        probeBox.className = 'probe-status-box error';
        probeBox.innerHTML = '<strong>❌ Fonte non raggiungibile:</strong> ' + (res.error || 'Verifica l\'indirizzo.');
        return;
      }

      this._lastQuickProbe = res;

      if (nameInput && !nameInput.value.trim() && res.suggested_name) {
        nameInput.value = res.suggested_name;
      }

      probeBox.className = 'probe-status-box success';
      probeBox.innerHTML = '<strong>✅ Link Valido!</strong><div style="font-size:0.8rem;margin-top:4px;">Tipo: <strong>' +
        (res.recognized_type || 'web').toUpperCase() + '</strong> • Elementi: <strong>' +
        (res.sample_items_count || 0) + '</strong></div>';
    } catch (err) {
      if (btnProbe) btnProbe.disabled = false;
      if (probeBox) {
        probeBox.className = 'probe-status-box error';
        probeBox.innerHTML = '<strong>❌ Errore:</strong> ' + err.message;
      }
    }
  },

  async saveQuickAddSource() {
    const catId = document.getElementById('quick-add-cat-id') ? document.getElementById('quick-add-cat-id').value : '';
    const urlInput = document.getElementById('quick-add-url');
    const nameInput = document.getElementById('quick-add-name');
    const docSelect = document.getElementById('quick-add-doctype');
    const keywordsInput = document.getElementById('quick-add-keywords');
    const btnSave = document.getElementById('btn-save-quick-source');

    const url = urlInput ? urlInput.value.trim() : '';
    let name = nameInput ? nameInput.value.trim() : '';

    if (!url) {
      alert('Inserisci l\'indirizzo della fonte');
      if (urlInput) urlInput.focus();
      return;
    }

    if (!name) {
      try {
        name = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '');
      } catch {
        name = 'Fonte ' + catId;
      }
    }

    let type = 'rss';
    let effectiveUrl = url;

    if (this._lastQuickProbe && this._lastQuickProbe.reachable) {
      type = this._lastQuickProbe.recognized_type || 'rss';
      if (this._lastQuickProbe.effective_url) effectiveUrl = this._lastQuickProbe.effective_url;
    } else {
      if (url.includes('openalex.org')) type = 'openalex';
      else if (url.includes('pubmed') || url.includes('ncbi.nlm.nih.gov')) type = 'pubmed';
    }

    const docType = docSelect ? docSelect.value : 'Notizia';
    const keywords = keywordsInput && keywordsInput.value.trim()
      ? keywordsInput.value.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Salvataggio...'; }

    try {
      const res = await API.addSource({
        category_id: catId, name: name, url: effectiveUrl,
        type: type, document_type: docType,
        keywords: keywords, exclude_keywords: [], is_active: 1
      });

      if (!res.success) throw new Error(res.error);

      this.closeQuickAddSource();
      alert('Fonte "' + name + '" aggiunta con successo! Avvio scansione immediata...');
      await this.triggerUpdate(catId);
      this.loadDashboardData();
    } catch (err) {
      alert('Errore salvataggio fonte: ' + err.message);
    } finally {
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = '💾 Salva e Cerca Subito'; }
    }
  },

  openFullWizardFromQuick() {
    const catId = document.getElementById('quick-add-cat-id') ? document.getElementById('quick-add-cat-id').value : '';
    const url = document.getElementById('quick-add-url') ? document.getElementById('quick-add-url').value : '';
    const name = document.getElementById('quick-add-name') ? document.getElementById('quick-add-name').value : '';
    this.closeQuickAddSource();

    if (window.SettingsView) {
      SettingsView.openWizard(catId);
      if (url) { SettingsView.wizardData.url = url; const u = document.getElementById('wz-url'); if (u) u.value = url; }
      if (name) { SettingsView.wizardData.name = name; const n = document.getElementById('wz-name'); if (n) n.value = name; }
    }
  },

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('SW error:', err);
      });
    }
  }
};

window.App = App;
