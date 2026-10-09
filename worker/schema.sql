CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, subscription TEXT NOT NULL,
  lineas TEXT NOT NULL, recordatorio TEXT, actualizado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deliveries (
  subscription_id TEXT NOT NULL, event_id TEXT NOT NULL, estado INTEGER NOT NULL DEFAULT 0,
  creado INTEGER NOT NULL, PRIMARY KEY(subscription_id,event_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, categoria TEXT NOT NULL, texto TEXT NOT NULL, creado INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_created ON reports(creado);
CREATE INDEX IF NOT EXISTS deliveries_created ON deliveries(creado);
