const mailbox='claudiogvilas@gmail.com';
const zone='America/Argentina/Buenos_Aires';
function base64(value:string){return btoa(Array.from(new TextEncoder().encode(value),byte=>String.fromCharCode(byte)).join(''));}
const appUrl='https://hometaskapp.claudiogvilas.workers.dev';
function base64url(value:string){return base64(value).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
// Sender and recipient are fixed to Claudio's own mailbox; nothing user-supplied reaches the headers except the encoded subject.
function compose(subject:string,text:string,id:string){return base64url([`From: HomeTask <${mailbox}>`,`To: ${mailbox}`,`Subject: =?UTF-8?B?${base64(subject)}?=`,`Message-ID: <${id}@hometaskapp.claudiogvilas.workers.dev>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',base64(text)].join('\r\n'));}
async function authorize(env:Env,send:typeof fetch){
 if(!env.GMAIL_CLIENT_ID||!env.GMAIL_CLIENT_SECRET||!env.GMAIL_REFRESH_TOKEN)throw new Error('Gmail reminder credentials are not configured');
 const auth=await send('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
 if(!auth.ok)throw new Error(`Gmail authorization failed (${auth.status})`);
 const credentials=await auth.json() as {access_token?:string};
 if(!credentials.access_token)throw new Error('Gmail authorization returned no access token');
 return credentials.access_token;
}
// Manual, Claudio-only check of the OAuth setup. Not tied to any task, so it never affects delivery records.
export async function sendTestReminder(env:Env,send:typeof fetch=fetch){
 const accessToken=await authorize(env,send);
 const response=await send('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({raw:compose('HomeTask: email de prueba','Este es un email de prueba de los recordatorios de HomeTask. Si lo recibiste, la configuración de Gmail funciona.\n\nLos avisos reales se envían a las 07:00 (Argentina) del día de vencimiento.\n',`test.${crypto.randomUUID()}`)}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Gmail send failed (${response.status})`);
}

// Gmail has no idempotency key: claim once before dispatch, and never automatically
// retry an ambiguous send. A durable claim also survives overlapping cron executions.
export async function sendReminders(env:Env,scheduledTime:number,send:typeof fetch=fetch){
 const date=new Date(scheduledTime);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const part=(name:string)=>parts.find(p=>p.type===name)!.value;
 if(part('hour')!=='07')return;
 const due=`${part('year')}-${part('month')}-${part('day')}`;
 const candidates=await env.DB.prepare("SELECT id FROM tasks WHERE due_date=? AND email_reminder=1 AND status='pending' AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM task_email_deliveries d WHERE d.task_id=tasks.id AND d.due_date=tasks.due_date)").bind(due).all<{id:string}>();
 if(!candidates.results.length)return;
 const accessToken=await authorize(env,send);
 let failures=0;
 for(const candidate of candidates.results){
  // Read current title and eligibility atomically with the claim, so edits, completion
  // and deletion before this statement cancel or reschedule the reminder.
  const task=await env.DB.prepare("INSERT OR IGNORE INTO task_email_deliveries(task_id,due_date,attempted_at,status) SELECT id,due_date,?,'sending' FROM tasks WHERE id=? AND due_date=? AND email_reminder=1 AND status='pending' AND deleted_at IS NULL RETURNING task_id").bind(new Date().toISOString(),candidate.id,due).first<{task_id:string}>();
  if(!task)continue;
  const current=await env.DB.prepare("SELECT title FROM tasks WHERE id=? AND due_date=? AND email_reminder=1 AND status='pending' AND deleted_at IS NULL").bind(candidate.id,due).first<{title:string}>();
  if(!current)continue;
  const message=compose('HomeTask: vence hoy — '+current.title,`La tarea «${current.title}» vence hoy (${due}) y sigue pendiente.\n\nAbrir HomeTask: ${appUrl}\n`,`${candidate.id}.${due}`);
  try{
   const response=await send('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({raw:message}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Object.assign(new Error('Gmail send failed'),{httpStatus:response.status});
   await env.DB.prepare("UPDATE task_email_deliveries SET status='sent' WHERE task_id=? AND due_date=?").bind(candidate.id,due).run();
  }catch(e){
   failures++;
   await env.DB.prepare("UPDATE task_email_deliveries SET status='failed' WHERE task_id=? AND due_date=?").bind(candidate.id,due).run();
   console.error(JSON.stringify({event:'email_reminder_failed',task_id:candidate.id,due_date:due,http_status:(e as {httpStatus?:number}).httpStatus??null,message:(e as Error).message}));
  }
 }
 if(failures)throw new Error(`${failures} Gmail reminders failed; inspect delivery records before any manual retry`);
}
