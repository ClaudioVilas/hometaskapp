# Home Task App

MVP para un hogar, con React + TypeScript, Cloudflare Worker y D1 SQLite. El alcance base está en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Incluido

- Crear, editar y eliminar tareas pendientes; asignar responsable, prioridad y vencimiento. Al crear, `due_date`, `priority` y `recurrence` son opcionales (vencimiento hoy, prioridad media, sin recurrencia) para integraciones rápidas como Atajos/Siri.
- Completar tareas con identidad de quien las hizo y fecha/hora.
- Recurrencias diarias, semanales y mensuales: conserva cada instancia y genera la siguiente en una transacción, protegida contra doble completado.
- Avisos dentro de la app: vence hoy, atrasadas y próximos tres días.
- Historial y estadísticas del administrador.
- Miembros con usuario y contraseña propios, revocables. El administrador crea el acceso inicial y puede restablecer la contraseña o desactivarlo.
- Clave personal para Atajos/Siri: cada persona la genera desde "Atajos y Siri" en la app y autentica sus pedidos con `Authorization: Bearer`, sin depender de la cookie de sesión del navegador.
- PWA con manifiesto y aviso sin conexión. Los cambios requieren conexión; no hay sincronización offline.

## Privacidad de tareas

El administrador ve y administra todas las tareas, incluido el historial, y puede filtrar por responsable en Tareas, Historial y Resumen. Los miembros solo reciben las tareas pendientes asignadas a su propia identidad y las que no tienen responsable; pueden completarlas, pero no editarlas, eliminarlas ni reasignarlas. Las tareas sin asignar siguen siendo compartidas. Las tareas asignadas a otra persona quedan excluidas de la respuesta de la API, y completar por ID también verifica permisos, incluso ante una reasignación concurrente. Estas reglas se aplican igualmente a sesiones del navegador y claves de Atajos/Siri; no dependen de nombres. Compras sigue compartida. No requiere migraciones.

## Compras

Todos los miembros pueden agregar productos con nombre obligatorio, cantidad y comentario opcionales, y una foto desde cámara o galería. El checkbox pasa el producto a Comprados y permite devolverlo a Pendientes. La navegación muestra la cantidad pendiente también en celular.

La migración `0003_shopping.sql` agrega una tabla independiente en D1. Las fotos se convierten en el navegador a JPEG (hasta 1200 px y 400.000 caracteres base64); se guardan en D1 y se consultan por un endpoint autenticado, sin incluirlas en cada actualización de estado. No se admiten cambios sin conexión.

El entorno `compras` publica un Worker separado y comparte la base del hogar: se usan los usuarios habituales y los productos cargados son reales. Antes de publicar: `npm run verify`, `npx wrangler d1 execute hometaskapp-db --remote --env compras --file migrations/0003_shopping.sql`, `npx wrangler deploy --env compras`. No requiere integrar la rama a `main`. Las migraciones anteriores ya fueron aplicadas manualmente en producción: no ejecutar `migrations apply` sin reconciliar primero su registro, porque `0002` reconstruye usuarios.

## Decisiones del MVP

Un único hogar, con Claudio como administrador. El ingreso es con usuario y contraseña (no con enlaces de acceso): la contraseña se guarda como PBKDF2-HMAC-SHA256 (100.000 iteraciones) con salt aleatorio por usuario, nunca en texto plano. Un login válido cambia la contraseña por una cookie de sesión HttpOnly, Secure y SameSite=Strict con 30 días de vigencia. Cualquier persona puede cambiar su propia contraseña (revoca las demás sesiones de ese usuario, no la actual); el administrador puede restablecer la contraseña de un miembro o desactivar su acceso. Las contraseñas son credenciales personales: no deben publicarse ni guardarse en Git. Todavía no hay recuperación por email ni administración de múltiples hogares.

Los vencimientos son fechas del calendario de Buenos Aires. La recurrencia parte del vencimiento anterior, incluso si está atrasado. Cada completado genera exactamente una próxima instancia. Mensual ajusta al último día disponible del mes siguiente; luego continúa desde esa fecha ajustada. El borrado de pendientes es lógico; el historial completado no se modifica desde la app.

La clave de Atajos/Siri es una sesión de 10 años que se autentica con `Authorization: Bearer` en vez de la cookie del navegador; queda revocada al cambiar la contraseña. No verifica origen (los pedidos no vienen de un navegador), así que el atajo debe enviar el header `Origin` de la app en los pedidos que no son `GET`. Los avisos push y OpenAI quedan fuera de este hito.

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

## Categorías de Claudio

El usuario autenticado `claudio` ve un selector de categorías en Tareas, Historial y Resumen, con “Todas las categorías” (vista inicial), “Tareas claudio”, “China” y “Desarrollo IT”. Se combina con responsable, búsqueda y vencimientos; los totales corresponden a la categoría seleccionada. Claudio puede elegir la categoría al crear o editar una tarea. El nombre visible no habilita esta función y los demás usuarios conservan sus vistas y permisos actuales.

La migración `0004_task_category.sql` agrega una columna con validación: las tareas existentes y las nuevas sin categoría explícita quedan en “Tareas claudio”. Las recurrencias conservan la categoría. Las integraciones que editan sin enviar categoría conservan la existente.

Antes de desplegar esta versión, aplicar únicamente `migrations/0004_task_category.sql` a la base correspondiente y luego desplegar el código. No ejecutar todas las migraciones históricas (ver advertencia de publicación de Compras). Esta rama no aplica migraciones remotas ni despliega cambios.

## Vista de prueba de categorías

URL: https://hometaskapp-preview.claudiogvilas.workers.dev

El entorno `preview` usa el Worker `hometaskapp-preview` y la base independiente `hometaskapp-preview-db`. Contiene usuarios y tareas ficticias; no comparte contraseñas, sesiones ni datos con producción.

Cada push a `fix/lily-without-category` ejecuta `.github/workflows/preview.yml`: verifica el proyecto, aplica las migraciones pendientes exclusivamente a la base de prueba y despliega con `--env preview`. Reutiliza los secrets de Cloudflare del repositorio. La actualización conserva los datos de prueba.

Para una instalación nueva, `node scripts/seed-preview.mjs` genera SQL y credenciales aleatorias en `.private/`. Aplicar ese SQL solamente a la base de prueba con el comando indicado en el script. No subir esos archivos a Git. Las credenciales iniciales de esta instalación se entregan por separado.

Producción continúa dependiendo de `main`. Antes de fusionar esta función, aplicar únicamente la migración `0004` en producción, sin repetir las migraciones históricas. La publicación en producción queda pendiente de aprobación.


## Tareas de Lili sin categoría

Las tareas cuyo responsable es el usuario `lily` se guardan sin categoría, incluidas las nuevas instancias recurrentes. El formulario muestra Categoría deshabilitada y grisada con “Sin categoría” al elegirla y vuelve a habilitarla al reasignar a otra persona. En la vista de Claudio, elegir a Lili como responsable oculta e ignora el filtro de categorías; con todos los responsables, sus tareas aparecen en Todas las categorías y no dentro de una categoría específica.

La migración `0005_lily_without_category.sql` permite categorías nulas y quita la categoría de las tareas existentes de `lily`, sin modificar responsables, historial ni recurrencias. Antes de publicar en producción, aplicar únicamente esta migración (las anteriores ya están aplicadas). La base de prueba registra sus migraciones y puede usar `migrations apply`.
