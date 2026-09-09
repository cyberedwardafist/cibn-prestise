// db/pool.js — Koneksi PostgreSQL + shim gaya better-sqlite3.
//
// KENAPA ADA SHIM?
// Kode lama (server.js versi SQLite) ditulis dengan gaya better-sqlite3:
//     db.prepare('SELECT * FROM users WHERE kode=?').get(kode)
//     db.prepare('SELECT * FROM users WHERE role=?').all(role)
//     db.prepare('UPDATE users SET nama=? WHERE kode=?').run(nama, kode)
//
// better-sqlite3 itu SYNCHRONOUS. Driver PostgreSQL (`pg`) itu ASYNCHRONOUS
// (semua query harus di-`await`). Supaya migrasi ke PostgreSQL tidak perlu
// menulis ulang seluruh query dari nol, shim di bawah ini meniru API yang
// SAMA PERSIS (`.prepare(sql).get(...)/.all(...)/.run(...)`), hanya saja
// setiap method sekarang mengembalikan Promise dan WAJIB dipanggil dengan
// `await`. Placeholder `?` (gaya SQLite) otomatis dikonversi ke `$1,$2,...`
// (gaya PostgreSQL) di dalam prepare().
//
// Selain itu disediakan helper `transaction(fn)` sebagai pengganti
// `db.transaction(fn)()` versi better-sqlite3 — memakai satu koneksi client
// yang sama untuk BEGIN/COMMIT/ROLLBACK supaya benar-benar atomik.

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('[FATAL] Environment variable DATABASE_URL belum di-set.');
    console.error('        Contoh: postgres://user:password@localhost:5432/cibn_prestise');
    console.error('        Salin .env.example menjadi .env lalu sesuaikan nilainya.');
    process.exit(1);
}

// SSL: kebanyakan provider managed Postgres (Railway, Render, Supabase, Neon, RDS, dll)
// mewajibkan SSL. Aktifkan lewat env PGSSL=true (default: mengikuti NODE_ENV production).
const useSSL = process.env.PGSSL
    ? process.env.PGSSL === 'true'
    : process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.PG_POOL_MAX || '10', 10),
});

pool.on('error', (err) => {
    // Error pada koneksi idle di pool (bukan error query per-request) — jangan sampai crash server.
    console.error('[PG POOL ERROR]', err.message);
});

// Konversi placeholder `?` (gaya SQLite/better-sqlite3) -> `$1,$2,...` (gaya PostgreSQL).
// Catatan: proyek ini tidak memakai literal tanda tanya di dalam string SQL manapun,
// jadi replace sederhana ini aman dipakai untuk seluruh query yang ada.
function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

// `executor` adalah pool (untuk query biasa / auto-commit) atau client (untuk transaksi).
function makeDb(executor) {
    return {
        prepare(sql) {
            const converted = convertPlaceholders(sql);
            return {
                // .get(...params) → satu baris pertama atau undefined (setara .get() better-sqlite3)
                async get(...params) {
                    const res = await executor.query(converted, params);
                    return res.rows[0];
                },
                // .all(...params) → array seluruh baris (setara .all())
                async all(...params) {
                    const res = await executor.query(converted, params);
                    return res.rows;
                },
                // .run(...params) → { changes, rows } — `changes` setara `info.changes` better-sqlite3
                async run(...params) {
                    const res = await executor.query(converted, params);
                    return { changes: res.rowCount, rows: res.rows };
                },
            };
        },
        // exec() untuk statement DDL/multi-statement tanpa parameter (dipakai saat init schema)
        async exec(sql) {
            await executor.query(sql);
        },
    };
}

const db = makeDb(pool);

// Pengganti db.transaction(fn)() milik better-sqlite3.
// Pemakaian:
//   await transaction(async (tdb) => {
//       await tdb.prepare('INSERT INTO ...').run(...);
//       await tdb.prepare('UPDATE ...').run(...);
//   });
// Semua query di dalam callback WAJIB memakai `tdb` (bukan `db` global) supaya
// berjalan di koneksi/transaksi yang sama dan benar-benar atomik (all-or-nothing).
async function transaction(fn) {
    const client = await pool.connect();
    const tdb = makeDb(client);
    try {
        await client.query('BEGIN');
        const result = await fn(tdb);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw e;
    } finally {
        client.release();
    }
}

module.exports = { pool, db, transaction };
