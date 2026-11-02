// Generates private SQL and credentials for the isolated preview only.
// Apply with: wrangler d1 execute hometaskapp-preview-db --remote --env preview --file .private/preview-seed.sql
import {mkdir,writeFile,access} from 'node:fs/promises';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
await mkdir('.private',{recursive:true});
try {await access('.private/preview-access.json');throw new Error('Preview credentials already exist; refusing to replace them.');} catch(e) {if(e.code!=='ENOENT')throw e;}
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const now=new Date().toISOString();
const due=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const accounts=['claudio','lily'].map(username=>({username,password:randomBytes(18).toString('base64url')}));
const statements=accounts.map(({username,password})=>{
 const salt=randomBytes(16).toString('hex'),hash=pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
 return `INSERT INTO users(id,name,role,username,password_hash,password_salt,created_at) VALUES(${[username,username==='claudio'?'Claudio':'Lili',username==='claudio'?'admin':'member',username,hash,salt,now].map(quote).join(',')});`;
});
for(const [category,title] of [['claudio','Organizar tareas de la semana'],['china','Revisar pedido de China'],['it','Revisar desarrollo de HomeTask']])statements.push(`INSERT INTO tasks(id,title,description,created_at,due_date,priority,assignee_id,recurrence,category) VALUES(${[randomBytes(16).toString('hex'),title,'Ejemplo de prueba: podés editarlo o completarlo.',now,due,'media','claudio','weekly',category].map(quote).join(',')});`);
statements.push(`INSERT INTO tasks(id,title,created_at,due_date,priority,assignee_id) VALUES(${[randomBytes(16).toString('hex'),'Tarea de Lili',now,due,'baja','lily'].map(quote).join(',')});`);
await writeFile('.private/preview-seed.sql',statements.join('\n'),{mode:0o600});
await writeFile('.private/preview-access.json',JSON.stringify({url:'https://hometaskapp-preview.claudiogvilas.workers.dev',accounts},null,2),{mode:0o600});
console.log('Private preview seed and access files generated in .private/.');
