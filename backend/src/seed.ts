import { hash } from '@node-rs/argon2';
import { pool } from './db.js';

const names = ['Canoga Park','Panorama City','Downtown L.A.','Huntington Park','Lynwood','East Los Angeles','Santa Ana','Fontana','Van Nuys','Bellflower'];
const slugs = ['canoga-park','panorama-city','downtown-la','huntington-park','lynwood','east-los-angeles','santa-ana','fontana','van-nuys','bellflower'];
for (let i=0;i<names.length;i++) await pool.query('INSERT INTO restaurants(slug,name) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name',[slugs[i],names[i]]);
const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;
const name = process.env.SUPER_ADMIN_NAME || 'Olivier';
if (!email || !password) throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required for the initial seed.');
const exists = await pool.query('SELECT 1 FROM users WHERE email=$1',[email]);
if (!exists.rowCount) await pool.query("INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,'super_admin')",[email,name,await hash(password)]);
await pool.end();
console.log('Demo reference data seeded. Super admin exists.');
