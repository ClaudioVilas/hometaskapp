self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<html lang="es"><meta name="viewport" content="width=device-width"><title>Home Task</title><body><h1>Sin conexión</h1><p>Necesitás conexión para consultar y guardar las tareas del hogar.</p><a href="/">Volver a intentar</a></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}})));});
