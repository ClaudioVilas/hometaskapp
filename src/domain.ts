export type User = {id:string;name:string;role:'admin'|'member';active:number};
export type Task = {id:string;title:string;description:string;created_at:string;due_date:string;priority:'alta'|'media'|'baja';assignee_id:string|null;status:'pending'|'completed';completed_at:string|null;completed_by:string|null;recurrence:'none'|'daily'|'weekly'|'monthly';previous_id:string|null};
export const repeats = {none:'No se repite',daily:'Cada día',weekly:'Cada semana',monthly:'Cada mes'};
export function today() {return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function daysLeft(due:string,base=today()) {return Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(base+'T12:00:00Z'))/86400000);}
export function nextDate(due:string,repeat:string) {const d=new Date(due+'T12:00:00Z'); if(repeat==='monthly'){const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}else d.setUTCDate(d.getUTCDate()+(repeat==='weekly'?7:1));return d.toISOString().slice(0,10);}
