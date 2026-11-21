/**
 * NEWS INTELLIGENCE HUB - Client API & Server-Sent Events (SSE)
 */

const API = {
  // Richieste HTTP generiche
  async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {})
        }
      });

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch {}
        throw new Error(errorData.error || `Errore HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`[API] Errore su ${endpoint}:`, err);
      throw err;
    }
  },

  // Dashboard
  getDashboard() {
    return this.request('/api/dashboard');
  },

  // Aggiornamento (Tutte o Singola)
  triggerUpdate(categoryId = null) {
    return this.request('/api/update', {
      method: 'POST',
      body: JSON.stringify({ category_id: categoryId })
    });
  },

  // Cronologia Archivio (Anno -> Mese -> Giorno)
  getArchiveChronology(categoryId = null) {
    const q = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : '';
    return this.request(`/api/archive/chronology${q}`);
  },

  // Ricerca Articoli con Filtri
  searchArticles(params = {}) {
    const queryParts = [];
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        if (val === false) continue;
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
    }
    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return this.request(`/api/articles${qs}`);
  },

  // Patch Articolo (Lettura, Preferito)
  updateArticle(id, data) {
    return this.request(`/api/articles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  // Elimina Articolo
  deleteArticle(id) {
    return this.request(`/api/articles/${id}`, {
      method: 'DELETE'
    });
  },

  // Fonti
  getSources(categoryId = null) {
    const q = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : '';
    return this.request(`/api/sources${q}`);
  },

  addSource(sourceData) {
    return this.request('/api/sources', {
      method: 'POST',
      body: JSON.stringify(sourceData)
    });
  },

  updateSource(id, sourceData) {
    return this.request(`/api/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sourceData)
    });
  },

  deleteSource(id) {
    return this.request(`/api/sources/${id}`, {
      method: 'DELETE'
    });
  },

  probeSourceUrl(url) {
    return this.request('/api/sources/probe', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  },

  // Impostazioni
  getSettings() {
    return this.request('/api/settings');
  },

  saveSettings(settings) {
    return this.request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  // Backup & Restore
  getBackups() {
    return this.request('/api/backups');
  },

  createBackup() {
    return this.request('/api/backups', {
      method: 'POST'
    });
  },

  restoreBackup(filename) {
    return this.request('/api/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ filename })
    });
  },

  // Storico Log
  getLogs(limit = 20) {
    return this.request(`/api/logs?limit=${limit}`);
  },

  // Inizializza ascolto Server-Sent Events per la barra di progresso live
  initProgressStream(onProgress, onComplete, onError) {
    if (!window.EventSource) {
      console.warn('EventSource non supportato dal browser');
      return null;
    }

    const eventSource = new EventSource('/api/update/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'working' || data.current_step) {
          if (onProgress) onProgress(data);
        } else if (data.status === 'completed') {
          if (onComplete) onComplete(data);
        } else if (data.status === 'failed') {
          if (onError) onError(data);
        }
      } catch (err) {
        console.error('Errore parsing evento SSE:', err);
      }
    };

    eventSource.onerror = (err) => {
      // EventSource tenta la riconnessione automatica nativa
    };

    return eventSource;
  }
};

window.API = API;
