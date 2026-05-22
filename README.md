# WhatsApp Work API + Gemini (Audit Hardened)

Proyecto para integrar WhatsApp Cloud API y respuestas con Gemini, con hardening de seguridad y pruebas automatizadas.

## Que se hizo

- Webhook WhatsApp con verificacion (`GET /webhook`) y recepcion (`POST /webhook`).
- Verificacion opcional de firma Meta `X-Hub-Signature-256`.
- Deteccion de mensajes duplicados para evitar respuestas repetidas.
- Integracion Gemini por comando `/gemini ...`.
- Scripts de prueba para mensaje texto, plantilla `hello_world` y smoke test Gemini.
- Suite de tests unitarios (`node --test`).

## Estructura

- `src/server.js`: arranque HTTP.
- `src/app.js`: rutas y flujo webhook.
- `src/whatsapp.js`: cliente WhatsApp Cloud API.
- `src/gemini.js`: cliente Gemini API.
- `src/security.js`: verificacion de firma Meta.
- `src/dedupe.js`: deduplicacion por `message.id`.
- `tests/*.test.js`: pruebas unitarias.
- `AUDITORIA_TECNICA_PROFUNDA.md`: informe completo de auditoria.

## Configuracion

```bash
cd 01_PROYECTOS/whatsapp-work-api
cp .env.example .env
npm install
```

Rellena `.env`:

- `WHATSAPP_ACCESS_TOKEN`: token de Meta.
- `WHATSAPP_PHONE_NUMBER_ID`: desde WhatsApp > API Setup.
- `WHATSAPP_BUSINESS_ACCOUNT_ID`: desde WhatsApp > API Setup.
- `WHATSAPP_VERIFY_TOKEN`: token de verificacion de webhook.
- `GEMINI_API_KEY`: clave API de Gemini.

## Ejecutar

```bash
npm run dev
```

## Probar envio WhatsApp

```bash
npm run send:test -- 34600111222 "Hola desde API"
npm run send:hello-world -- 34600111222
```

## Probar Gemini

```bash
npm run smoke:gemini -- "Dame una respuesta breve para atencion al cliente"
```

## Comando por WhatsApp

Cuando el webhook reciba un mensaje con este formato:

```text
/gemini Tu pregunta aqui
```

el servidor consulta Gemini y responde por WhatsApp.

## Tests

```bash
npm test
```

## Seguridad recomendada para produccion

- Generar token permanente de Meta (system user), no usar token temporal.
- Configurar `META_APP_SECRET` y poner `ALLOW_UNSIGNED_WEBHOOK=false`.
- Rotar claves si se han compartido en texto plano.
- Mantener `.env` fuera de Git (ya ignorado).

## Auditoria automatica

```bash
npm run audit:full
```

Genera un reporte en `reports/audit-latest.json` con:

- estado de seguridad de webhook,
- checks internos de logica,
- validacion real de token WhatsApp,
- validacion real de Gemini,
- lista de acciones manuales estrictamente necesarias.

## CIERRE MIGRACION CLOUD

- Fecha: 2026-04-08
- Estado: preparado para retomar desde nuevo sistema


<!-- MIGRACION_CLOUD_START -->
## ESTADO MIGRACION CLOUD
- Revisado: 2026-04-08
- Repo listo para continuar en otro sistema.
- Estado Git al cerrar: sincronizado en GitHub.
<!-- MIGRACION_CLOUD_END -->

## CIERRE CLOUD 2026-04-08
- Estado: sincronizado para migracion a nuevo PC/sistema.
- Preparado para retomar desde GitHub.
- Ultima revision: 2026-04-08 15:40:50 +02:00
