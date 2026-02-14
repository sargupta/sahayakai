import { Pool } from 'pg';
import 'server-only';

let pool: Pool | null = null;

async function getSecret(secretName: string): Promise<string> {
    // Re-use logic or import from firebase-admin if exported
    // For now, simple env fallback or local dev setup
    return process.env[secretName] || '';
}

export async function getSqlPool() {
    if (pool) return pool;

    const connectionString = process.env.DATABASE_URL || await getSecret('DATABASE_URL');

    if (!connectionString && process.env.NODE_ENV === 'production') {
        throw new Error("DATABASE_URL not found for Cloud SQL connection.");
    }

    pool = new Pool({
        connectionString,
        // Cloud SQL Auth Proxy usually handles the encryption, but SSL might be needed for direct connection
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    return pool;
}

export async function query<T = any>(text: string, params?: any[]) {
    const p = await getSqlPool();
    const start = Date.now();
    const res = await p.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text, duration, rows: res.rowCount });
    }

    return res;
}
