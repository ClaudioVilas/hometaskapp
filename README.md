# Home Task App

MVP para un hogar, con React + TypeScript, Cloudflare Worker y D1 SQLite. El alcance base está en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Incluido

- Crear, editar y eliminar tareas pendientes; asignar responsable, prioridad y vencimiento.
- Completar tareas con identidad de quien las hizo y fecha/hora.
- Recurrencias diarias, semanales y mensuales: conserva cada instancia y genera la siguiente en una transacción, protegida contra doble completado.
- Avisos dentro de la app: vence hoy, atrasadas y próximos tres días.
- Historial y estadísticas del administrador.
- Miembros con enlaces personales revocables. El administrador puede crear y renovar accesos.
- PWA con manifiesto y aviso sin conexión. Los cambios requieren conexión; no hay sincronización offline.

## Decisiones del MVP

Un único hogar, con Claudio como administrador. Los enlaces de acceso tienen 256 bits aleatorios; solo sus hashes se guardan en D1. El enlace se intercambia por una cookie HttpOnly, Secure y SameSite=Strict con sesión de 30 días. El fragmento de acceso se elimina del navegador al entrar. Los enlaces son credenciales personales reutilizables hasta su revocación: no deben publicarse ni guardarse en Git. Todavía no hay recuperación por email ni administración de múltiples hogares.

Los vencimientos son fechas del calendario de Buenos Aires. La recurrencia parte del vencimiento anterior, incluso si está atrasado. Cada completado genera exactamente una próxima instancia. Mensual ajusta al último día disponible del mes siguiente; luego continúa desde esa fecha ajustada. El borrado de pendientes es lógico; el historial completado no se modifica desde la app.

Los avisos push, Siri/Atajos y OpenAI quedan fuera de este hito. La capa HTTP separa las operaciones para una futura integración de lenguaje natural con permisos equivalentes.

## Desarrollo

Requiere Node.js 22 o posterior.

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run preview
```

La vista local usa una base aislada y persistente bajo `.wrangler/`. El acceso de Claudio se genera en `.private/ABRIR_APP_LOCAL.html`. Ambas carpetas están excluidas de Git. Las pruebas usan otra base efímera y no alteran datos de la app.

## Publicación pendiente

El código está preparado para Cloudflare Workers y D1. El frontend se empaqueta junto al Worker para un único despliegue sin dependencias externas en el navegador. Esto simplifica el MVP; las peticiones de archivos pasan por el Worker.

Falta habilitar escritura en la conexión de Cloudflare y activar workers.dev. Luego la IA debe:

1. Crear `hometaskapp-db` y registrar su identificador en `wrangler.jsonc`.
2. Aplicar `migrations/0001_initial.sql` en D1.
3. Crear el acceso inicial de Claudio con un token aleatorio; guardar solo el hash en D1 y entregar el enlace de forma privada.
4. Publicar `dist/worker.js` con el binding `DB`, activar workers.dev y verificar el servicio.
5. Completar la conexión de despliegue con GitHub y dejar documentada la URL real.

No se creó ninguna base remota ni se publicó la app al momento de esta versión: Cloudflare respondió errores de autenticación a las operaciones de escritura. No hay secretos ni enlaces de acceso en este repositorio público.
