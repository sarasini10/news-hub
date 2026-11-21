/**
 * NEWS INTELLIGENCE HUB - Modulo Impostazioni, Gestione Fonti e Wizard a 7 Passaggi
 */

const SettingsView = {
  currentCategory: 'politica',
  wizardData: {
    step: 1,
    category_id: 'politica',
    name: '',
    url: '',
    type: 'rss',
    document_type: 'Notizia',
    keywords: [],
    exclude_keywords: [],
    probeResult: null
  },

  activate(categoryId = 'politica') {
    this.currentCategory = categoryId || 'politica';
    this.setupSubTabs();
    this.setupCategoryPills();
    this.loadCategorySources();
    this.loadSchedulerSettings();
    this.loadBackupsList();
    this.loadLogs();
  },

  setupSubTabs() {
    const tabs = document.querySelectorAll('.settings-subtab-btn');
    tabs.forEach(btn => {
      btn.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        document.querySelectorAll('.settings-tab-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById(target);
        if (panel) panel.style.display = 'block';
      };
    });
  },

  setupCategoryPills() {
    const container = document.getElementById('settings-category-chips');
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
        this.loadCategorySources();
      };
    });
  },

  async loadCategorySources() {
    const container = document.getElementById('sources-list-container');
    const titleEl = document.getElementById('settings-cat-title');
    if (!container) return;

    if (titleEl) {
      titleEl.textContent = `Fonti Configurate per: ${this.currentCategory.toUpperCase()}`;
    }

    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">Caricamento fonti...</div>';

    try {
      const res = await API.getSources(this.currentCategory);
      if (!res.success) throw new Error(res.error);

      if (res.sources.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 30px; color: var(--text-dim);">
            <p>Nessuna fonte attiva per questa categoria.</p>
            <button class="btn btn-primary" style="margin-top: 12px;" onclick="SettingsView.openWizard('${this.currentCategory}')">
              ➕ Avvia Procedura Guidata Nuova Fonte
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="sources-table-container">
          <table class="sources-table">
            <thead>
              <tr>
                <th>Stato</th>
                <th>Nome Fonte</th>
                <th>Tipologia</th>
                <th>Formato</th>
                <th>Parole Chiave Monitorate</th>
                <th>Ultimo Controllo</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              ${res.sources.map(src => {
                const keywords = JSON.parse(src.keywords || '[]');
                const statusClass = src.last_status === 'ok' ? 'source-status-ok' : (src.last_status === 'errore' ? 'source-status-error' : 'source-status-pending');
                const statusText = src.last_status === 'ok' ? 'Funzionante' : (src.last_status === 'errore' ? 'Errore' : 'In attesa');
                const lastCheckText = src.last_checked_at ? new Date(src.last_checked_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'Mai';

                return `
                  <tr>
                    <td>
                      <label class="toggle-switch">
                        <input type="checkbox" ${src.is_active ? 'checked' : ''} onchange="SettingsView.toggleSourceActive(${src.id}, this.checked)">
                        <span class="toggle-slider"></span>
                      </label>
                    </td>
                    <td>
                      <strong>${App.escapeHtml(src.name)}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-dim); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${App.escapeHtml(src.url)}
                      </div>
                    </td>
                    <td>
                      <span class="doc-type-badge ${App.getDocTypeBadgeClass(src.document_type)}">${src.document_type}</span>
                    </td>
                    <td>
                      <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">${src.type}</span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px; flex-wrap: wrap; max-width: 200px;">
                        ${keywords.slice(0, 3).map(k => `<span class="keyword-pill">${App.escapeHtml(k)}</span>`).join('')}
                        ${keywords.length > 3 ? `<span style="font-size: 0.7rem; color: var(--text-dim);">+${keywords.length - 3}</span>` : ''}
                      </div>
                    </td>
                    <td>
                      <span class="source-status-badge ${statusClass}">● ${statusText}</span>
                      <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 3px;">${lastCheckText}</div>
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-icon-only" title="Elimina fonte" onclick="SettingsView.deleteSource(${src.id})">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color: #ef4444; padding: 20px;">Errore: ${err.message}</div>`;
    }
  },

  async toggleSourceActive(id, isActive) {
    try {
      const res = await API.getSources();
      const current = res.sources.find(s => s.id === id);
      if (current) {
        current.is_active = isActive;
        await API.updateSource(id, current);
      }
    } catch (err) {
      alert(`Errore aggiornamento fonte: ${err.message}`);
    }
  },

  async deleteSource(id) {
    if (!confirm('Confermi l\'eliminazione definitiva di questa fonte di intelligence?')) return;
    try {
      await API.deleteSource(id);
      this.loadCategorySources();
    } catch (err) {
      alert(`Errore: ${err.message}`);
    }
  },

  // --- PROCEDURA GUIDATA (WIZARD A 7 PASSAGGI) ---
  openWizard(categoryId = null) {
    this.wizardData = {
      step: 1,
      category_id: categoryId || this.currentCategory,
      name: '',
      url: '',
      type: 'rss',
      document_type: 'Notizia',
      keywords: [],
      exclude_keywords: [],
      probeResult: null
    };

    const modal = document.getElementById('modal-wizard-source');
    if (modal) modal.classList.add('open');

    this.renderWizardStep();
  },

  closeWizard() {
    const modal = document.getElementById('modal-wizard-source');
    if (modal) modal.classList.remove('open');
  },

  renderWizardStep() {
    // Aggiorna tracker grafico dei 7 passaggi
    for (let i = 1; i <= 7; i++) {
      const node = document.getElementById(`step-node-${i}`);
      const content = document.getElementById(`wizard-step-${i}`);
      if (node) {
        node.classList.remove('active', 'completed');
        if (i === this.wizardData.step) node.classList.add('active');
        if (i < this.wizardData.step) node.classList.add('completed');
      }
      if (content) {
        content.classList.toggle('active-step', i === this.wizardData.step);
      }
    }

    // Inizializza campi per lo step corrente
    if (this.wizardData.step === 1) {
      const select = document.getElementById('wz-category');
      if (select) select.value = this.wizardData.category_id;
    } else if (this.wizardData.step === 2) {
      const nameInput = document.getElementById('wz-name');
      const urlInput = document.getElementById('wz-url');
      if (nameInput) nameInput.value = this.wizardData.name;
      if (urlInput) urlInput.value = this.wizardData.url;
    } else if (this.wizardData.step === 4) {
      const typeSelect = document.getElementById('wz-type');
      const docSelect = document.getElementById('wz-doctype');
      if (typeSelect) typeSelect.value = this.wizardData.type;
      if (docSelect) docSelect.value = this.wizardData.document_type;
    }

    // Controlli bottoni wizard
    const btnPrev = document.getElementById('wz-btn-prev');
    const btnNext = document.getElementById('wz-btn-next');
    if (btnPrev) btnPrev.style.display = this.wizardData.step === 1 ? 'none' : 'inline-flex';
    if (btnNext) {
      btnNext.textContent = this.wizardData.step === 7 ? '💾 Salva Fonte Definitivamente' : 'Avanti ➔';
    }
  },

  async nextWizardStep() {
    // Validazione e logica specifica per step
    if (this.wizardData.step === 1) {
      const select = document.getElementById('wz-category');
      this.wizardData.category_id = select ? select.value : 'politica';
      this.wizardData.step = 2;
      this.renderWizardStep();
    } else if (this.wizardData.step === 2) {
      const nameInput = document.getElementById('wz-name');
      const urlInput = document.getElementById('wz-url');
      const name = nameInput ? nameInput.value.trim() : '';
      const url = urlInput ? urlInput.value.trim() : '';

      if (!name || !url) {
        alert('Inserisci sia il nome della fonte che l\'URL completo');
        return;
      }
      this.wizardData.name = name;
      this.wizardData.url = url;

      // Passa allo step 3 ed esegui la verifica
      this.wizardData.step = 3;
      this.renderWizardStep();
      this.executeProbeStep3();
    } else if (this.wizardData.step === 3) {
      // Step 3 completato, passa allo step 4
      this.wizardData.step = 4;
      this.renderWizardStep();
    } else if (this.wizardData.step === 4) {
      const typeSelect = document.getElementById('wz-type');
      const docSelect = document.getElementById('wz-doctype');
      if (typeSelect) this.wizardData.type = typeSelect.value;
      if (docSelect) this.wizardData.document_type = docSelect.value;
      this.wizardData.step = 5;
      this.renderWizardStep();
    } else if (this.wizardData.step === 5) {
      const kwInput = document.getElementById('wz-keywords');
      const exInput = document.getElementById('wz-exclude');
      if (kwInput) {
        this.wizardData.keywords = kwInput.value.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (exInput) {
        this.wizardData.exclude_keywords = exInput.value.split(',').map(s => s.trim()).filter(Boolean);
      }
      this.wizardData.step = 6;
      this.renderWizardStep();
      this.executePreviewStep6();
    } else if (this.wizardData.step === 6) {
      this.wizardData.step = 7;
      this.renderWizardStep();
      this.renderSummaryStep7();
    } else if (this.wizardData.step === 7) {
      // Salvataggio definitivo
      await this.saveWizardSource();
    }
  },

  prevWizardStep() {
    if (this.wizardData.step > 1) {
      this.wizardData.step--;
      this.renderWizardStep();
    }
  },

  // Step 3: Verifica Raggiungibilità
  async executeProbeStep3() {
    const box = document.getElementById('wz-probe-box');
    if (!box) return;

    box.className = 'probe-status-box';
    box.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><div class="progress-spinner"></div><span>Connessione alla fonte e verifica disponibilità in corso...</span></div>';

    try {
      const res = await API.probeSourceUrl(this.wizardData.url);
      if (!res.success || !res.reachable) {
        box.className = 'probe-status-box error';
        box.innerHTML = `
          <strong>❌ Fonte Non Raggiungibile o Errore Rete</strong>
          <p style="font-size:0.82rem; margin-top:4px;">Dettaglio: ${res.error || 'Il server della fonte non ha risposto entro il tempo limite.'}</p>
        `;
        return;
      }

      this.wizardData.probeResult = res;
      this.wizardData.type = res.recognized_type || 'rss';

      box.className = 'probe-status-box success';
      box.innerHTML = `
        <strong>✅ Fonte Raggiungibile con Successo</strong>
        <p style="font-size:0.82rem; margin-top:4px;">
          Codice HTTP: <strong>${res.status_code}</strong> • Tipologia riconosciuta: <strong>${res.recognized_type.toUpperCase()}</strong> • Contenuti rilevati: <strong>${res.sample_items_count} elementi</strong>
        </p>
      `;
    } catch (err) {
      box.className = 'probe-status-box error';
      box.innerHTML = `<strong>❌ Errore durante la verifica:</strong> ${err.message}`;
    }
  },

  // Step 6: Test della ricerca (Anteprima articoli)
  executePreviewStep6() {
    const previewContainer = document.getElementById('wz-preview-container');
    if (!previewContainer) return;

    const samples = (this.wizardData.probeResult && this.wizardData.probeResult.sample_items) || [];

    if (samples.length === 0) {
      previewContainer.innerHTML = `
        <div style="padding: 16px; background: var(--bg-surface); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted);">
          Nessuna anteprima immediata disponibile per questo protocollo (${this.wizardData.type}). Durante la normale scansione il motore raccoglierà e classificherà i contenuti in modo autonomo.
        </div>
      `;
      return;
    }

    previewContainer.innerHTML = samples.map((item, idx) => `
      <div style="padding: 12px; background: var(--bg-surface); border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 8px;">
        <div style="font-size: 0.75rem; color: #10b981; font-weight: 700;">Articolo di test #${idx + 1}</div>
        <div style="font-weight: 700; font-size: 0.92rem; margin: 4px 0;">${App.escapeHtml(item.title)}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${App.escapeHtml(item.description ? item.description.slice(0, 160) : '')}...</div>
      </div>
    `).join('');
  },

  // Step 7: Riepilogo finale
  renderSummaryStep7() {
    const summaryBox = document.getElementById('wz-summary-box');
    if (!summaryBox) return;

    summaryBox.innerHTML = `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; font-size: 0.88rem; line-height: 1.6;">
        <div><strong>Categoria:</strong> ${this.wizardData.category_id.toUpperCase()}</div>
        <div><strong>Nome Fonte:</strong> ${App.escapeHtml(this.wizardData.name)}</div>
        <div><strong>URL:</strong> <a href="${this.wizardData.url}" target="_blank" style="color:#38bdf8;">${App.escapeHtml(this.wizardData.url)}</a></div>
        <div><strong>Tipologia Documento:</strong> ${this.wizardData.document_type}</div>
        <div><strong>Protocollo:</strong> ${this.wizardData.type.toUpperCase()}</div>
        <div><strong>Parole Chiave:</strong> ${this.wizardData.keywords.join(', ') || 'Nessuna specifica'}</div>
        <div><strong>Parole Escluse:</strong> ${this.wizardData.exclude_keywords.join(', ') || 'Nessuna'}</div>
      </div>
    `;
  },

  async saveWizardSource() {
    try {
      await API.addSource({
        category_id: this.wizardData.category_id,
        name: this.wizardData.name,
        url: this.wizardData.url,
        type: this.wizardData.type,
        document_type: this.wizardData.document_type,
        keywords: this.wizardData.keywords,
        exclude_keywords: this.wizardData.exclude_keywords,
        is_active: 1
      });

      alert('Fonte aggiunta con successo e pronta per le scansioni di intelligence!');
      this.closeWizard();
      this.currentCategory = this.wizardData.category_id;
      this.setupCategoryPills();
      this.loadCategorySources();
    } catch (err) {
      alert(`Errore durante il salvataggio: ${err.message}`);
    }
  },

  // --- SCHEDULER & IMPOSTAZIONI ---
  async loadSchedulerSettings() {
    try {
      const res = await API.getSettings();
      if (!res.success) throw new Error(res.error);

      const cfg = res.settings.scheduler_config || {};
      const timeInput = document.getElementById('scheduler-time');
      const enabledCheck = document.getElementById('scheduler-enabled');

      if (timeInput) timeInput.value = cfg.time || '06:00';
      if (enabledCheck) enabledCheck.checked = !!cfg.enabled;
    } catch (err) {
      console.error('Errore caricamento scheduler:', err);
    }
  },

  async saveSchedulerSettings() {
    const timeInput = document.getElementById('scheduler-time');
    const enabledCheck = document.getElementById('scheduler-enabled');

    try {
      await API.saveSettings({
        scheduler_time: timeInput ? timeInput.value : '06:00',
        scheduler_enabled: enabledCheck ? enabledCheck.checked : true
      });
      alert('Configurazione scheduler automatico aggiornata con successo!');
    } catch (err) {
      alert(`Errore: ${err.message}`);
    }
  },

  // --- BACKUP & RIPRISTINO ---
  async loadBackupsList() {
    const listEl = document.getElementById('backups-list');
    if (!listEl) return;

    try {
      const res = await API.getBackups();
      if (!res.success) throw new Error(res.error);

      if (res.backups.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-dim); font-size: 0.82rem;">Nessun backup presente. Crea il tuo primo backup con il pulsante sopra.</p>';
        return;
      }

      listEl.innerHTML = res.backups.map(b => {
        const d = new Date(b.created_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const sizeKb = Math.round(b.size_bytes / 1024);

        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px;">
            <div>
              <strong>${App.escapeHtml(b.filename)}</strong>
              <div style="font-size:0.75rem; color:var(--text-dim);">${d} • Dimensione: ${sizeKb} KB</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="SettingsView.restoreBackup('${b.filename}')">
              ♻️ Ripristina
            </button>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Errore caricamento backup:', err);
    }
  },

  async createBackup() {
    try {
      const res = await API.createBackup();
      if (!res.success) throw new Error(res.error);
      alert(`Backup creato con successo: ${res.backup.filename} (${res.backup.articles_count} articoli archiviati)`);
      this.loadBackupsList();
    } catch (err) {
      alert(`Errore creazione backup: ${err.message}`);
    }
  },

  async restoreBackup(filename) {
    if (!confirm(`Sei sicuro di voler ripristinare il database dal backup "${filename}"? I dati attuali verranno sostituiti.`)) return;

    try {
      const res = await API.restoreBackup(filename);
      if (!res.success) throw new Error(res.error);
      alert(`Ripristino completato con successo! Articoli ripristinati: ${res.articles_restored}`);
      App.loadDashboardData();
    } catch (err) {
      alert(`Errore durante il ripristino: ${err.message}`);
    }
  },

  // --- STORICO LOG ---
  async loadLogs() {
    const logContainer = document.getElementById('logs-history-container');
    if (!logContainer) return;

    try {
      const res = await API.getLogs(15);
      if (!res.success) throw new Error(res.error);

      if (res.logs.length === 0) {
        logContainer.innerHTML = '<p style="color: var(--text-dim); font-size:0.82rem;">Nessuna esecuzione registrata finora.</p>';
        return;
      }

      logContainer.innerHTML = res.logs.map(l => {
        const start = new Date(l.started_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        const triggerLabel = l.trigger_type === 'scheduled' ? '⏰ Programmato (06:00)' : (l.trigger_type === 'manual_single' ? `🔄 Singola (${l.category_id})` : '🌐 Manuale Globale');

        return `
          <div style="padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px; font-size:0.82rem;">
            <div style="display:flex; justify-content:space-between;">
              <strong>${triggerLabel}</strong>
              <span style="color:var(--text-dim);">${start}</span>
            </div>
            <div style="color:var(--text-muted); margin-top:4px;">
              Fonti consultate: <strong>${l.sources_queried}</strong> • Risultati trovati: <strong>${l.results_found}</strong> • Nuovi articoli acquisiti: <strong>${l.articles_added}</strong>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Errore caricamento logs:', err);
    }
  }
};

window.SettingsView = SettingsView;
