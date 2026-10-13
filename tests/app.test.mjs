import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {build} from 'esbuild';
await build({entryPoints:['src/domain.ts'],bundle:true,format:'esm',outfile:'dist/domain.mjs'});
const {nextDate,daysLeft,today}=await import('../dist/domain.mjs');
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{modules:true,scriptPath:'dist/worker.js',compatibilityDate:'2026-09-07',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']}]}));
let db,cookie,memberCookie;
const origin='https://home.test';
const request=(path,method='GET',data,session=cookie)=>mf.dispatchFetch(origin+path,{method,headers:{Origin:origin,...(session?{Cookie:session}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
const draft={title:'Regar plantas',description:'Balcón',due_date:'2026-01-31',priority:'alta',assignee_id:'member',recurrence:'monthly'};
const derive=(pass,salt)=>pbkdf2Sync(pass,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
before(async()=>{db=await mf.getD1Database('DB');for(const file of ['migrations/0001_initial.sql','migrations/0002_username_password.sql','migrations/0003_shopping.sql']){const sql=await readFile(file,'utf8');await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));}for(const [id,role,pass] of [['admin','admin','adminpass1'],['member','member','memberpass1']]){const salt=randomBytes(16).toString('hex'),hashed=derive(pass,salt);await db.prepare('INSERT INTO users(id,name,role,username,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,id,role,id,hashed,salt,new Date().toISOString()).run();const r=await request('/api/login','POST',{username:id,password:pass},'');assert.equal(r.status,200);const c=r.headers.get('set-cookie').split(';')[0];if(role==='admin')cookie=c;else memberCookie=c;}});
after(()=>mf.dispose());
test('monthly recurrence clamps leap years and year boundaries',()=>{assert.equal(nextDate('2026-01-31','monthly'),'2026-02-28');assert.equal(nextDate('2028-01-31','monthly'),'2028-02-29');assert.equal(nextDate('2026-12-31','daily'),'2027-01-01');assert.equal(nextDate('2026-12-28','weekly'),'2027-01-04');assert.equal(daysLeft('2026-09-06','2026-09-07'),-1);});
test('anonymous cannot read tasks',async()=>assert.equal((await request('/api/state','GET',undefined,'')).status,401));
test('wrong username or password is rejected',async()=>{assert.equal((await request('/api/login','POST',{username:'admin',password:'wrongpassword'},'')).status,401);assert.equal((await request('/api/login','POST',{username:'nadie',password:'whatever1'},'')).status,401);});
test('member cannot administer tasks or members',async()=>{assert.equal((await request('/api/tasks','POST',draft,memberCookie)).status,403);assert.equal((await request('/api/members','POST',{name:'Intruso',username:'intruso',password:'intrusopass'},memberCookie)).status,403);});
test('invalid dates rejected',async()=>assert.equal((await request('/api/tasks','POST',{...draft,due_date:'2026-02-31'})).status,400));
test('cross-origin write rejected',async()=>{const r=await mf.dispatchFetch(origin+'/api/tasks',{method:'POST',headers:{Origin:'https://other.test',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(draft)});assert.equal(r.status,403);});
test('CRUD, concurrent completion and history preserve exactly one next instance',async()=>{assert.equal((await request('/api/tasks','POST',draft)).status,201);let state=await(await request('/api/state')).json();const task=state.tasks[0];assert.equal((await request('/api/tasks/'+task.id,'PUT',{...draft,title:'Regar todas las plantas'})).status,200);const results=await Promise.all([request('/api/tasks/'+task.id+'/complete','POST',{},memberCookie),request('/api/tasks/'+task.id+'/complete','POST',{},memberCookie)]);assert(results.every(r=>r.status===200));state=await(await request('/api/state')).json();assert.equal(state.tasks.length,2);const done=state.tasks.find(t=>t.id===task.id),next=state.tasks.find(t=>t.previous_id===task.id);assert.equal(done.status,'completed');assert.equal(done.completed_by,'member');assert(done.completed_at);assert.equal(next.due_date,'2026-02-28');assert.equal(next.title,'Regar todas las plantas');assert.equal((await request('/api/tasks/'+task.id,'PUT',draft)).status,409);const m=await(await request('/api/state','GET',undefined,memberCookie)).json();assert(m.tasks.every(t=>t.status==='pending'));assert.equal((await request('/api/tasks/'+next.id,'DELETE')).status,200);state=await(await request('/api/state')).json();assert.equal(state.tasks.length,1);assert.equal(state.tasks[0].id,task.id);});
test('member creation with username/password, admin reset, revoke and no self lockout',async()=>{const res=await request('/api/members','POST',{name:'Ana',username:'ana',password:'anapass123'});assert.equal(res.status,201);const login=await request('/api/login','POST',{username:'ana',password:'anapass123'},'');assert.equal(login.status,200);const anaCookie=login.headers.get('set-cookie').split(';')[0];const state=await(await request('/api/state')).json();const ana=state.users.find(u=>u.name==='Ana');assert.equal((await request('/api/members/'+ana.id+'/reset-password','POST',{password:'anapass456'})).status,200);assert.equal((await request('/api/state','GET',undefined,anaCookie)).status,401);assert.equal((await request('/api/login','POST',{username:'ana',password:'anapass123'},'')).status,401);assert.equal((await request('/api/login','POST',{username:'ana',password:'anapass456'},'')).status,200);assert.equal((await request('/api/members/'+ana.id+'/revoke','POST',{})).status,200);assert.equal((await request('/api/login','POST',{username:'ana',password:'anapass456'},'')).status,401);assert.equal((await request('/api/members/admin/revoke','POST',{})).status,400);});
test('a user can change their own password and it revokes other sessions only',async()=>{assert.equal((await request('/api/account/password','PUT',{current_password:'wrongpass',new_password:'memberpass2'},memberCookie)).status,401);assert.equal((await request('/api/account/password','PUT',{current_password:'memberpass1',new_password:'memberpass2'},memberCookie)).status,200);assert.equal((await request('/api/state','GET',undefined,memberCookie)).status,200);assert.equal((await request('/api/login','POST',{username:'member',password:'memberpass2'},'')).status,200);});
test('a quick task with only title and assignee defaults due date, priority and recurrence',async()=>{const res=await request('/api/tasks','POST',{title:'Sacar la basura',assignee_id:'member'});assert.equal(res.status,201);const state=await(await request('/api/state')).json();const t=state.tasks.find(x=>x.title==='Sacar la basura');assert.equal(t.due_date,today());assert.equal(t.priority,'media');assert.equal(t.recurrence,'none');assert.equal(t.assignee_id,'member');assert.equal((await request('/api/tasks/'+t.id,'DELETE')).status,200);});
test('a personal automation token authenticates via Authorization header for Shortcuts/Siri',async()=>{const created=await request('/api/account/token','POST',{});assert.equal(created.status,201);const {token:autoToken}=await created.json();const bearer=(path,method='GET')=>mf.dispatchFetch(origin+path,{method,headers:{Authorization:'Bearer '+autoToken,...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{})},body:method!=='GET'?JSON.stringify(draft):undefined});assert.equal((await bearer('/api/state')).status,200);assert.equal((await bearer('/api/tasks','POST')).status,201);assert.equal((await mf.dispatchFetch(origin+'/api/state')).status,401);});
test('public shell and PWA are available without data',async()=>{for(const path of ['/','/app.js','/app.css','/manifest.webmanifest','/sw.js'])assert.equal((await request(path,'GET',undefined,'')).status,200);const page=await request('/');assert(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));});
test('members share shopping items, photos and idempotent purchased state',async()=>{
 const photo='data:image/jpeg;base64,/9j/2Q==';
 const created=await request('/api/shopping','POST',{name:' Leche ',quantity:'2 litros',comment:'Descremada',photo},memberCookie);assert.equal(created.status,201);const {id}=await created.json();
 let state=await(await request('/api/state')).json();let item=state.shopping.find(i=>i.id===id);assert.equal(item.name,'Leche');assert.equal(item.quantity,'2 litros');assert.equal(item.comment,'Descremada');assert.equal(item.created_by,'member');assert.equal(item.has_photo,1);assert.equal(item.status,'pending');assert(!('photo' in item));
 assert.equal((await request('/api/shopping/'+id+'/photo','GET',undefined,'')).status,401);
 const image=await request('/api/shopping/'+id+'/photo','GET',undefined,memberCookie);assert.equal(image.headers.get('content-type'),'image/jpeg');assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'),'/9j/2Q==');
 const results=await Promise.all([request('/api/shopping/'+id,'PUT',{status:'purchased'},memberCookie),request('/api/shopping/'+id,'PUT',{status:'purchased'},memberCookie)]);assert(results.every(r=>r.status===200));
 state=await(await request('/api/state','GET',undefined,memberCookie)).json();item=state.shopping.find(i=>i.id===id);assert.equal(item.status,'purchased');assert.equal(item.purchased_by,'member');assert(item.purchased_at);
 await request('/api/shopping/'+id,'PUT',{status:'purchased'});assert.equal((await(await request('/api/state')).json()).shopping.find(i=>i.id===id).purchased_by,'member');
 assert.equal((await request('/api/shopping/'+id,'PUT',{status:'pending'},memberCookie)).status,200);item=(await(await request('/api/state')).json()).shopping.find(i=>i.id===id);assert.equal(item.status,'pending');assert.equal(item.purchased_at,null);assert.equal(item.purchased_by,null);
 assert.equal((await request('/api/shopping','POST',{name:'Pan'},memberCookie)).status,201);
});
test('shopping validates fields, payload limits, session and origin',async()=>{
 for(const data of [{},{name:' '},{name:'x'.repeat(121)},{name:'Pan',quantity:2},{name:'Pan',photo:'data:image/svg+xml;base64,PHN2Zz4='},{name:'Pan',photo:'data:image/jpeg;base64,YWJj'}])assert.equal((await request('/api/shopping','POST',data,memberCookie)).status,400);
 assert.equal((await request('/api/shopping','POST',{name:'Pan'},'')).status,401);
 assert.equal((await request('/api/shopping/missing','PUT',{status:'purchased'},memberCookie)).status,404);
 assert.equal((await request('/api/shopping/missing','PUT',{status:'bad'},memberCookie)).status,400);
 assert.equal((await request('/api/shopping','POST',{name:'Pan',photo:'x'.repeat(420001)},memberCookie)).status,413);
 const response=await mf.dispatchFetch(origin+'/api/shopping',{method:'POST',headers:{Origin:'https://other.test',Cookie:memberCookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Pan'})});assert.equal(response.status,403);
});
test('task privacy applies to member reads, history, direct IDs and bearer sessions',async()=>{
 const salt=randomBytes(16).toString('hex');
 await db.prepare('INSERT INTO users(id,name,role,username,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?,?)').bind('other-member','Otro miembro','member','other-member',derive('otherpass1',salt),salt,new Date().toISOString()).run();
 const login=await request('/api/login','POST',{username:'other-member',password:'otherpass1'},'');const otherCookie=login.headers.get('set-cookie').split(';')[0];
 const create=async(title,assignee_id)=>{assert.equal((await request('/api/tasks','POST',{...draft,title,assignee_id})).status,201);return (await(await request('/api/state')).json()).tasks.find(t=>t.title===title);};
 const privateTask=await create('Privada administrador','admin'),own=await create('Propia miembro','member'),other=await create('Propia otro miembro','other-member'),shared=await create('Compartida sin asignar',null);
 for(const session of [memberCookie,otherCookie]){
  const state=await(await request('/api/state','GET',undefined,session)).json();const expected=session===memberCookie?'member':'other-member';assert(state.tasks.every(t=>t.status==='pending'&&(t.assignee_id===expected||t.assignee_id===null)));assert(!JSON.stringify(state.tasks).includes(privateTask.title));
  assert.equal((await request('/api/tasks/'+privateTask.id+'/complete','POST',{},session)).status,404);
  assert.equal((await request('/api/tasks/'+privateTask.id,'PUT',{...draft,assignee_id:expected},session)).status,403);
  assert.equal((await request('/api/tasks/'+privateTask.id,'DELETE',undefined,session)).status,403);
 }
 assert.equal((await request('/api/tasks/'+other.id+'/complete','POST',{},memberCookie)).status,404);
 assert.equal((await request('/api/tasks/'+own.id+'/complete','POST',{},otherCookie)).status,404);
 const {token}=await(await request('/api/account/token','POST',{},memberCookie)).json();const bearer=async(path,method='GET')=>mf.dispatchFetch(origin+path,{method,headers:{Authorization:'Bearer '+token,Origin:origin}});
 assert((await(await bearer('/api/state')).json()).tasks.every(t=>t.assignee_id==='member'||t.assignee_id===null));
 assert.equal((await bearer('/api/tasks/'+privateTask.id+'/complete','POST')).status,404);
 // Changing ownership invalidates the old member's previously visible ID immediately.
 assert.equal((await request('/api/tasks/'+own.id,'PUT',{...draft,title:own.title,assignee_id:'admin'})).status,200);
 assert.equal((await request('/api/tasks/'+own.id+'/complete','POST',{},memberCookie)).status,404);
 assert.equal((await request('/api/tasks/'+own.id+'/complete','POST',{})).status,200);
 assert.equal((await request('/api/tasks/'+own.id+'/complete','POST',{},memberCookie)).status,404);
 assert.equal((await request('/api/tasks/'+privateTask.id+'/complete','POST',{})).status,200);
 assert.equal((await request('/api/tasks/'+privateTask.id+'/complete','POST',{},memberCookie)).status,404);
 assert.equal((await request('/api/tasks/'+shared.id+'/complete','POST',{},memberCookie)).status,200);
 // Admin retains edit, complete and delete capabilities for other members.
 assert.equal((await request('/api/tasks/'+other.id,'PUT',{...draft,title:other.title,assignee_id:'other-member'})).status,200);
 assert.equal((await request('/api/tasks/'+other.id+'/complete','POST',{})).status,200);
 const state=await(await request('/api/state')).json();assert(state.tasks.some(t=>t.id===privateTask.id&&t.status==='completed'));
 const next=state.tasks.find(t=>t.previous_id===privateTask.id);assert.equal(next.assignee_id,'admin');
 const memberState=await(await request('/api/state','GET',undefined,memberCookie)).json();assert(memberState.tasks.every(t=>t.status==='pending'&&(t.assignee_id==='member'||t.assignee_id===null)));assert(!memberState.tasks.some(t=>t.id===next.id));
 const nextOther=state.tasks.find(t=>t.previous_id===other.id);assert.equal((await request('/api/tasks/'+nextOther.id,'DELETE')).status,200);
 const privateRow=await db.prepare('SELECT completed_by FROM tasks WHERE id=?').bind(privateTask.id).first();assert.equal(privateRow.completed_by,'admin');
});
test('reassignment between read and completion cannot bypass member permissions',async()=>{
 const id=randomBytes(16).toString('hex');await db.prepare('INSERT INTO tasks(id,title,created_at,due_date,priority,assignee_id,recurrence) VALUES(?,?,?,?,?,?,?)').bind(id,'Reasignada durante completado',new Date().toISOString(),'2026-10-13','media','member','daily').run();
 const {default:worker}=await import('../dist/worker.js');let reassigned=false;
 const guardedDB={prepare(sql){const statement=db.prepare(sql);if(sql.startsWith('SELECT * FROM tasks WHERE id='))return {bind(...values){const bound=statement.bind(...values);return {async first(){const task=await bound.first();await db.prepare('UPDATE tasks SET assignee_id=? WHERE id=?').bind('admin',id).run();reassigned=true;return task;}};}};return statement;},batch:statements=>db.batch(statements)};
 const response=await worker.fetch(new Request(origin+'/api/tasks/'+id+'/complete',{method:'POST',headers:{Origin:origin,Cookie:memberCookie}}),{DB:guardedDB});assert(reassigned);assert.equal(response.status,409);
 const task=await db.prepare('SELECT status,assignee_id,completed_by FROM tasks WHERE id=?').bind(id).first();assert.equal(task.status,'pending');assert.equal(task.assignee_id,'admin');assert.equal(task.completed_by,null);assert.equal(await db.prepare('SELECT id FROM tasks WHERE previous_id=?').bind(id).first(),null);
});
