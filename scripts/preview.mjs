import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
const mf=new Miniflare(convertV4MiniflareOptions({port:8787,host:'127.0.0.1',modules:true,scriptPath:'dist/worker.js',compatibilityDate:'2026-09-07',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'hometask-local'},d1Persist:'.wrangler/local-preview'}));
const db=await mf.getD1Database('DB');
const sql=await readFile('migrations/0001_initial.sql','utf8');
await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
await mkdir('.private',{recursive:true});
let key;try{key=(await readFile('.private/local-admin-key','utf8')).trim();}catch{key=randomBytes(32).toString('hex');await writeFile('.private/local-admin-key',key,{mode:0o600});}
await db.prepare("INSERT OR IGNORE INTO users(id,name,role,token_hash,created_at) VALUES('claudio','Claudio','admin',?,?)").bind(createHash('sha256').update(key).digest('hex'),new Date().toISOString()).run();
await writeFile('.private/ABRIR_APP_LOCAL.html',`<!doctype html><html lang="es"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Abrir Home Task</title><h1>Home Task</h1><p>Vista local de Claudio. Este enlace es privado y solo funciona en esta computadora mientras la vista está activa.</p><a href="http://127.0.0.1:8787/#access=${key}">Entrar a Home Task</a></html>`,{mode:0o600});
console.log('Vista local lista en http://127.0.0.1:8787. Acceso privado guardado en .private/ABRIR_APP_LOCAL.html.');
process.on('SIGINT',async()=>{await mf.dispose();process.exit(0)});
process.on('SIGTERM',async()=>{await mf.dispose();process.exit(0)});
