/**
 * NEWS INTELLIGENCE HUB - Scheduler Giornaliero Automatico
 * Fuso orario: Europe/Rome (Predefinito: Ore 06:00 ogni giorno)
 */

const { getDb } = require('./db');
const { runUpdate } = require('./searchEngine');

let schedulerTimer = null;
let lastExecutedDate = null;

function getSchedulerConfig() {
  const database = getDb();
  const getSetting = (key, fallback) => {
    const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value);
    } catch {
      return fallback;
    }
  };

  return {
    enabled: getSetting('scheduler_enabled', true),
    time: getSetting('scheduler_time', '06:00'),
    timezone: getSetting('scheduler_timezone', 'Europe/Rome'),
    frequency: getSetting('scheduler_frequency', 'daily')
  };
}

// Calcola data e ora correnti nel fuso Europe/Rome
function getRomeTimeParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    timeString: `${map.hour}:${map.minute}`,
    dateString: `${map.year}-${map.month}-${map.day}`
  };
}

function checkAndTrigger() {
  const config = getSchedulerConfig();
  if (!config.enabled) return;

  const current = getRomeTimeParts();

  // Verifica se l'orario corrente corrisponde a quello configurato (es. 06:00)
  if (current.timeString === config.time) {
    if (lastExecutedDate !== current.dateString) {
      lastExecutedDate = current.dateString;
      console.log(`[Scheduler] Attivazione aggiornamento automatico programmato alle ${current.timeString} (Europe/Rome)...`);

      runUpdate({ triggerType: 'scheduled' })
        .then(result => {
          console.log(`[Scheduler] Aggiornamento programmato completato con successo. Fonti: ${result.total_sources}, Nuovi articoli: ${result.total_added}`);
        })
        .catch(err => {
          console.error(`[Scheduler] Errore durante l'aggiornamento programmato:`, err);
        });
    }
  }
}

function initScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  console.log('[Scheduler] Avvio servizio di pianificazione automatica per NEWS INTELLIGENCE HUB.');
  const config = getSchedulerConfig();
  console.log(`[Scheduler] Configurazione attiva: Orario ${config.time} (${config.timezone}), Stato: ${config.enabled ? 'ABILITATO' : 'DISABILITATO'}`);

  // Controllo ogni 30 secondi
  schedulerTimer = setInterval(checkAndTrigger, 30000);
}

module.exports = {
  initScheduler,
  getSchedulerConfig,
  getRomeTimeParts
};
