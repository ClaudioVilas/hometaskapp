# Home Task App

## IMPORTANTE: continuidad de conversación

Esto es la continuación de una conversación larga previa que tuvimos en ChatGPT web. A partir de ahora, todo el trabajo pasa a este proyecto en Work. No empieces desde cero. Usa este archivo como referencia base.

## Objetivo

Crear una web app/PWA simple para administrar tareas del hogar, pensada principalmente para celulares.

Primer hito: un MVP mínimo funcional de punta a punta que valide producto y flujo de trabajo (pedido en lenguaje natural, desarrollo, despliegue, uso).

## Roles

- **Administrador (inicialmente Claudio):** crea, edita, elimina tareas, cambia vencimientos y recurrencias, consulta historial y estadísticas.
- **Usuario hogar:** ve y marca tareas hechas. Al completar, registrar usuario, fecha y hora.

## Datos de tarea

- Título.
- Descripción.
- Fecha de creación.
- Fecha límite.
- Prioridad.
- Responsable.
- Estado pendiente/completada.
- Fecha y hora de finalización.
- Recurrencia.

Los días restantes o atraso se calculan dinámicamente.

## Recurrencia

Al completar una tarea recurrente, guardar registro y crear automáticamente la siguiente instancia. No sobreescribir.

## Notificaciones

Contemplar avisos por vencer, vence hoy y vencidas.

## IA y voz

En el roadmap, crear y consultar tareas por lenguaje natural, pedir vía Siri/Atajos en una etapa posterior.

## Tecnología inicial sugerida

- Frontend React más TypeScript como PWA mobile first.
- Hosting/backend Cloudflare, base D1 SQLite.
- Preparar integración futura con API de OpenAI mediante function calling.

## Flujo de trabajo

Claudio describe cambios en lenguaje natural dentro de este proyecto. La IA prepara el código y, con repositorio y despliegue conectados, se encarga del push y deploy. Claudio no toca CI/CD ni infraestructura.

Este archivo manda sobre el alcance inicial y el modo de trabajo. Luego lo versionamos en GitHub.
