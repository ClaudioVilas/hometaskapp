import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
const mf=new Miniflare(convertV4MiniflareOptions({port:8787,host:'127.0.0.1',modules:true,scriptPath:'dist/worker.js',compatibilityDate:'2026-09-07',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'hometask-local'},d1Persist:'.wrangler/local-preview'}));
const db=await mf.getD1Database('DB');
const columns=await db.prepare('PRAGMA table_info(users)').all();
const migrations=columns.results.some(column=>column.name==='username')?['migrations/0003_shopping.sql']:['migrations/0001_initial.sql','migrations/0002_username_password.sql','migrations/0003_shopping.sql'];
for(const file of migrations){const sql=await readFile(file,'utf8');await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));}
const taskColumns=await db.prepare('PRAGMA table_info(tasks)').all();
if(!taskColumns.results.some(column=>column.name==='category'))await db.prepare((await readFile('migrations/0004_task_category.sql','utf8')).trim()).run();
const categoryColumn=(await db.prepare('PRAGMA table_info(tasks)').all()).results.find(column=>column.name==='category');
if(categoryColumn.notnull){const sql=await readFile('migrations/0005_lily_without_category.sql','utf8');await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));}
await mkdir('.private',{recursive:true});
let pass;try{pass=(await readFile('.private/local-admin-password','utf8')).trim();}catch{pass=randomBytes(9).toString('base64url');await writeFile('.private/local-admin-password',pass,{mode:0o600});}
const salt=randomBytes(16).toString('hex'),hash=pbkdf2Sync(pass,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
await db.prepare("INSERT INTO users(id,name,role,username,password_hash,password_salt,created_at) VALUES('claudio','Claudio','admin','claudio',?,?,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt").bind(hash,salt,new Date().toISOString()).run();
await writeFile('.private/ABRIR_APP_LOCAL.html',`<!doctype html><html lang="es"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Abrir Home Task</title><h1>Home Task</h1><p>Vista local de Claudio. Usuario: <b>claudio</b> · Contraseña: <b>${pass}</b>. Solo válido en esta computadora mientras la vista está activa.</p><a href="http://127.0.0.1:8787/">Entrar a Home Task</a></html>`,{mode:0o600});
console.log('Vista local lista en http://127.0.0.1:8787. Usuario: claudio. Contraseña guardada en .private/ABRIR_APP_LOCAL.html.');
process.on('SIGINT',async()=>{await mf.dispose();process.exit(0)});
process.on('SIGTERM',async()=>{await mf.dispose();process.exit(0)});
