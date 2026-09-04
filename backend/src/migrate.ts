import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const directory = fileURLToPath(new URL('../migrations/', import.meta.url));
const migrations = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
for (const migration of migrations) await pool.query(await readFile(`${directory}/${migration}`, 'utf8'));
await pool.end();
console.log(`Database migrations complete (${migrations.length}).`);
