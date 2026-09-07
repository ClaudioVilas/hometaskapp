# Home Task App

MVP para un hogar, con React + TypeScript, Cloudflare Worker y D1 SQLite. El alcance base está en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Incluido

- Crear, editar y eliminar tareas pendientes; asignar responsable, prioridad y vencimiento.
- Completar tareas con identidad de quien las hizo y fecha/hora.
- Recurrencias diarias, semanales y mensuales: conserva cada instancia y genera la siguiente en una transacción, protegida contra doble completado.
- Avisos dentro de la app: vence hoy, atrasadas y próximos tres días.
- Historial y estadísticas del administrador.
- Miembros con usuario y contraseña propios, revocables. El administrador crea el acceso inicial y puede restablecer la contraseña o desactivarlo.
- PWA con manifiesto y aviso sin conexión. Los cambios requieren conexión; no hay sincronización offline.

## Decisiones del MVP

Un único hogar, con Claudio como administrador. El ingreso es con usuario y contraseña (no con enlaces de acceso): la contraseña se guarda como PBKDF2-HMAC-SHA256 (100.000 iteraciones) con salt aleatorio por usuario, nunca en texto plano. Un login válido cambia la contraseña por una cookie de sesión HttpOnly, Secure y SameSite=Strict con 30 días de vigencia. Cualquier persona puede cambiar su propia contraseña (revoca las demás sesiones de ese usuario, no la actual); el administrador puede restablecer la contraseña de un miembro o desactivar su acceso. Las contraseñas son credenciales personales: no deben publicarse ni guardarse en Git. Todavía no hay recuperación por email ni administración de múltiples hogares.

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

## Publicación

El código está preparado para Cloudflare Workers y D1. El frontend se empaqueta junto al Worker para un único despliegue sin dependencias externas en el navegador; las peticiones de archivos pasan por el Worker.

La app ya está publicada (`hometaskapp-db` creada, ambas migraciones aplicadas, Worker desplegado con el binding `DB` y workers.dev activo) y el acceso de Claudio ya es usuario/contraseña: **https://hometaskapp.claudiogvilas.workers.dev**

Cada push a `main` despliega solo (`.github/workflows/deploy.yml`): corre `npm run verify` y, si pasa, `wrangler deploy`. Necesita los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` configurados en GitHub (Settings → Secrets and variables → Actions del repo). No hay secretos ni contraseñas en este repositorio público.
