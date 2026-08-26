import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'adenine_bot.sqlite'));

// Enable WAL mode for high concurrency and crash resilience
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    log_channel_id TEXT,
    alert_role_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export const botDb = {
  getGuild: (guildId) => {
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  },
  setLogChannel: (guildId, channelId) => {
    return db.prepare(`
      INSERT INTO guild_settings (guild_id, log_channel_id) 
      VALUES (?, ?) 
      ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = excluded.log_channel_id
    `).run(guildId, channelId);
  },
  logEvent: (eventType, details) => {
    return db.prepare('INSERT INTO audit_logs (event_type, details) VALUES (?, ?)').run(eventType, details);
  }
};

export default db;
