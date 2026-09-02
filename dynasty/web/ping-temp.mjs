import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  await c.connect();
  const r = await c.query("select current_database() as db, count(*)::int as tabelle from information_schema.tables where table_schema='public'");
  console.log("raggiungibile:", JSON.stringify(r.rows[0]));
  await c.end();
} catch (e) { console.log("ERRORE:", String(e.message).split("\n")[0]); process.exit(1); }
