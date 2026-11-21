/**
 * NEWS INTELLIGENCE HUB - Modulo Archivio Cronologico
 * Gestione archivio indipendente per categoria: Anno -> Mese -> Giorno
 */

const ArchiveView = {
  currentCategory: 'tutte',
  selectedYear: null,
  selectedMonth: null,
  selectedDay: null,
  searchQuery: '',

  activate(categoryId = 'tutte') {
    this.currentCategory = categoryId || 'tutte';
    this.setupCategoryPills();
    this.setupExportButtons();
    this.setupInternalSearch();
    this.loadChronologyAndArticles();
  },

  setupCategoryPills() {
    const container = document.getElementById('archive-category-chips');
    if (!container) return;

    const chips = container.querySelectorAll('.cat-chip');
    chips.forEach(chip => {
      const cat = chip.getAttribute('data-cat');
      if (cat === this.currentCategory) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }

      chip.onclick = () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentCategory = cat;
        this.selectedYear = null;
        this.selectedMonth = null;
        this.selectedDay = null;
        this.loadChronologyAndArticles();
      };
    });
  },

  setupExportButtons() {
    const btnJson = document.getElementById('btn-export-json');
    if (btnJson) {
      btnJson.onclick = () => {
        window.open(`/api/export?category_id=${encodeURIComponent(this.currentCategory)}&format=json`, '_blank');
      };
    }

    const btnCsv = document.getElementById('btn-export-csv');
    if (btnCsv) {
      btnCsv.onclick = () => {
        window.open(`/api/export?category_id=${encodeURIComponent(this.currentCategory)}&format=csv`, '_blank');
      };
    }
  },

  setupInternalSearch() {
    const input = document.getElementById('archive-internal-search');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.loadArticlesList();
      }, 350);
    });
  },

  async loadChronologyAndArticles() {
    try {
      const res = await API.getArchiveChronology(this.currentCategory);
      if (!res.success) throw new Error(res.error);

      this.renderTreeSidebar(res.chronology);
      this.loadArticlesList();
    } catch (err) {
      console.error('Errore caricamento cronologia archivio:', err);
    }
  },

  renderTreeSidebar(chronology) {
    const container = document.getElementById('archive-tree-container');
    if (!container) return;

    container.innerHTML = '';

    const years = Object.keys(chronology).sort((a, b) => b - a);

    if (years.length === 0) {
      container.innerHTML = '<p style="color: var(--text-dim); font-size: 0.82rem; padding: 10px;">Nessun archivio temporale presente.</p>';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'archive-tree-list';

    years.forEach(year => {
      const yData = chronology[year];
      const liYear = document.createElement('li');
      liYear.className = 'tree-year-item';

      const yearHeader = document.createElement('div');
      yearHeader.className = 'tree-year-header';
      yearHeader.innerHTML = `
        <span>📁 ${year}</span>
        <span class="tree-badge-count">${yData.total}</span>
      `;

      const ulMonths = document.createElement('ul');
      ulMonths.className = 'tree-months-list';

      const months = Object.keys(yData.months).sort((a, b) => b - a);

      months.forEach(month => {
        const mData = yData.months[month];
        const liMonth = document.createElement('li');
        liMonth.className = 'tree-month-item';

        const monthHeader = document.createElement('div');
        monthHeader.className = 'tree-month-header';
        if (this.selectedYear == year && this.selectedMonth == month) {
          monthHeader.classList.add('selected');
        }
        monthHeader.innerHTML = `
          <span>📅 ${mData.month_name}</span>
          <span class="tree-badge-count">${mData.total}</span>
        `;

        monthHeader.onclick = (e) => {
          e.stopPropagation();
          this.selectedYear = year;
          this.selectedMonth = month;
          this.selectedDay = null;
          this.updateTreeSelection();
          this.loadArticlesList();
        };

        const ulDays = document.createElement('ul');
        ulDays.className = 'tree-days-list';

        mData.days.forEach(d => {
          const liDay = document.createElement('li');
          liDay.className = 'tree-day-item';
          if (this.selectedYear == year && this.selectedMonth == month && this.selectedDay == d.day) {
            liDay.classList.add('selected');
          }
          liDay.innerHTML = `
            <span>📄 ${d.date_str}</span>
            <span class="tree-badge-count">${d.count}</span>
          `;

          liDay.onclick = (e) => {
            e.stopPropagation();
            this.selectedYear = year;
            this.selectedMonth = month;
            this.selectedDay = d.day;
            this.updateTreeSelection();
            this.loadArticlesList();
          };

          ulDays.appendChild(liDay);
        });

        liMonth.appendChild(monthHeader);
        liMonth.appendChild(ulDays);
        ulMonths.appendChild(liMonth);
      });

      yearHeader.onclick = () => {
        this.selectedYear = year;
        this.selectedMonth = null;
        this.selectedDay = null;
        this.updateTreeSelection();
        this.loadArticlesList();
      };

      liYear.appendChild(yearHeader);
      liYear.appendChild(ulMonths);
      ul.appendChild(liYear);
    });

    container.appendChild(ul);
  },

  updateTreeSelection() {
    document.querySelectorAll('.tree-month-header').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.tree-day-item').forEach(el => el.classList.remove('selected'));
  },

  async loadArticlesList() {
    const listContainer = document.getElementById('archive-articles-list');
    const headerTitle = document.getElementById('archive-current-filter-title');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-dim);">Caricamento articoli archiviati...</div>';

    // Genera titolo del filtro corrente
    let filterDescription = `Categoria: ${this.currentCategory.toUpperCase()}`;
    if (this.selectedYear) filterDescription += ` • Anno ${this.selectedYear}`;
    if (this.selectedMonth) filterDescription += ` • Mese ${this.selectedMonth}`;
    if (this.selectedDay) filterDescription += ` • Giorno ${this.selectedDay}`;
    if (this.searchQuery) filterDescription += ` • Ricerca: "${this.searchQuery}"`;

    if (headerTitle) headerTitle.textContent = filterDescription;

    try {
      const res = await API.searchArticles({
        categoryId: this.currentCategory,
        year: this.selectedYear,
        month: this.selectedMonth,
        day: this.selectedDay,
        query: this.searchQuery,
        limit: 100
      });

      if (!res.success) throw new Error(res.error);

      if (res.items.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: var(--text-dim);">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">📁</div>
            <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-main);">Nessun contenuto trovato per i filtri selezionati</p>
            <p style="font-size: 0.85rem; margin-top: 6px;">Prova a selezionare un'altra data o categoria oppure avvia un aggiornamento.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = res.items.map(art => {
        const pubDate = new Date(art.published_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const docBadgeClass = App.getDocTypeBadgeClass(art.document_type);
        let keywords = [];
        try {
          keywords = typeof art.keywords === 'string' ? JSON.parse(art.keywords || '[]') : (art.keywords || []);
        } catch {
          keywords = [];
        }

        return `
          <div class="article-row-card" data-id="${art.id}">
            <div class="article-header-row">
              <div class="article-tags-wrap">
                <span class="article-cat-tag">${art.category_id}</span>
                <span class="doc-type-badge ${docBadgeClass}">${art.document_type}</span>
                <span class="relevance-pill">⚡ ${art.relevance_score}%</span>
              </div>
              <div class="article-date-tag">📅 Acquisito: ${pubDate}</div>
            </div>

            <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="article-title-link">
              ${App.escapeHtml(art.title)}
            </a>
            <button class="toggle-summary-btn summary-open" id="arch-toggle-${art.id}" onclick="ArchiveView.toggleSummary(${art.id})" title="Mostra/nascondi sintesi">
              <i class="ts-arrow">▲</i> Sintesi
            </button>

            <div class="article-summary-text" id="arch-summary-${art.id}">
              ${App.escapeHtml(art.summary)}
            </div>

            ${keywords.length > 0 ? `
              <div class="article-keywords-bar">
                ${keywords.map(kw => `<span class="keyword-pill">#${App.escapeHtml(kw)}</span>`).join('')}
              </div>
            ` : ''}

            <div class="article-footer-row">
              <div>
                <strong>Fonte:</strong> <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="news-source-link">🔗 ${App.escapeHtml(art.source_name)}</a>
                ${art.author ? ` • <em>Autore: ${App.escapeHtml(art.author)}</em>` : ''}
              </div>
              <div class="article-actions-group">
                <button class="btn-article-action" onclick="ArchiveView.toggleFavorite(${art.id}, ${art.is_favorite ? 0 : 1})">
                  ${art.is_favorite ? '⭐ Preferito' : '☆ Salva'}
                </button>
                <button class="btn-article-action" onclick="ArchiveView.deleteArticle(${art.id})">
                  🗑️ Rimuovi
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      listContainer.innerHTML = `<div style="color: #ef4444; padding: 20px;">Errore: ${err.message}</div>`;
    }
  },

  async toggleFavorite(id, status) {
    try {
      await API.updateArticle(id, { is_favorite: status });
      this.loadArticlesList();
    } catch (err) {
      alert(`Errore: ${err.message}`);
    }
  },

  // Mostra/nascondi anteprima summary nelle card archivio
  toggleSummary(articleId) {
    const summary = document.getElementById(`arch-summary-${articleId}`);
    const btn     = document.getElementById(`arch-toggle-${articleId}`);
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
  },

  async deleteArticle(id) {
    if (!confirm('Sei sicuro di voler rimuovere questo articolo dall\'archivio?')) return;
    try {
      await API.deleteArticle(id);
      this.loadChronologyAndArticles();
    } catch (err) {
      alert(`Errore: ${err.message}`);
    }
  }
};

window.ArchiveView = ArchiveView;
