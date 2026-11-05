// Secrets provisioned independently for the production Worker. Never expose in /api/state.
interface Env {
 GMAIL_CLIENT_ID?:string;
 GMAIL_CLIENT_SECRET?:string;
 GMAIL_REFRESH_TOKEN?:string;
}
