# Auditoria Tecnica Profunda - WhatsApp + Gemini

Fecha: 2026-03-10

## Alcance de auditoria

- Revisión completa de arquitectura del servicio de webhook.
- Revisión de seguridad (secretos, autenticidad de eventos, exposición de datos, abuso).
- Revisión de robustez operacional (timeouts, reintentos, idempotencia, manejo de errores).
- Revisión de pruebas y mantenibilidad.
- Revisión de integración con proveedor de IA (Gemini API).

## Resumen ejecutivo

Estado actual tras hardening: **apto para pruebas serias** y preproducción controlada.

Principales riesgos residuales:

1. Uso de token temporal de WhatsApp (caduca y no es apto para producción).
2. Claves expuestas en texto plano durante la conversación (requiere rotación).
3. Sin cola asíncrona para absorber picos de webhooks (escala limitada).
4. Sin estrategia de reintento/backoff para fallos transitorios de proveedor.

## Hallazgos priorizados

### [P0] Exposición de secretos en texto plano

- Impacto: alto. Riesgo de uso no autorizado de APIs.
- Evidencia: token temporal de Meta y API key de Gemini compartidos en claro.
- Mitigación inmediata:
  1. Revocar/rotar token de WhatsApp.
  2. Regenerar API key de Gemini.
  3. Sustituir secretos en `.env` y reiniciar servicio.

### [P1] Validación de firma Meta no forzada en modo prueba

- Impacto: alto en entornos públicos.
- Estado: implementada validación `X-Hub-Signature-256`, pero configurable.
- Riesgo residual: si `ALLOW_UNSIGNED_WEBHOOK=true`, cualquier origen podría enviar eventos falsos.
- Mitigación recomendada:
  1. Configurar `META_APP_SECRET`.
  2. Establecer `ALLOW_UNSIGNED_WEBHOOK=false` en producción.

### [P1] Dependencia de token temporal WhatsApp

- Impacto: alto de continuidad operativa.
- Riesgo: caída de servicio por expiración (~24h).
- Mitigación:
  1. Token permanente mediante System User.
  2. Procedimiento de rotación y alarmado.

### [P2] Falta de reintentos y control de tasa saliente

- Impacto: medio-alto bajo carga o intermitencias de red.
- Estado: hay timeout, pero no retry/backoff.
- Mitigación:
  1. Reintentos exponenciales con jitter para 5xx/429.
  2. Rate limiter por destinatario y por minuto.

### [P2] Sin persistencia/cola para procesamiento desacoplado

- Impacto: medio (picos de carga y resiliencia limitada).
- Mitigación:
  1. Queue (Redis, SQS, Pub/Sub).
  2. ACK temprano a Meta + workers asíncronos.

### [P3] Observabilidad limitada

- Impacto: medio-bajo en diagnóstico.
- Estado: logging estructurado básico.
- Mitigación:
  1. Correlation ID por mensaje.
  2. Métricas (latencia, errores por proveedor, duplicados).
  3. Alertas en SLO de disponibilidad y error rate.

## Mejoras implementadas en esta iteración

1. Refactor modular (`app`, `security`, `dedupe`, `gemini`, `whatsapp`).
2. Verificación de firma Meta (`META_APP_SECRET`).
3. Deduplicación por `message.id` con TTL configurable.
4. Timeouts explícitos para llamadas a WhatsApp y Gemini.
5. Normalización/validación de número destino.
6. Integración Gemini por comando `/gemini`.
7. Respuesta segura ante errores para evitar loops de reintento de webhook.
8. Tests unitarios de firma, dedupe y parseo de webhook.

## Matriz de riesgo residual

- Seguridad de credenciales: **Alto** hasta rotación.
- Integridad de origen webhook: **Medio** (baja a Bajo con firma obligatoria).
- Disponibilidad bajo carga: **Medio**.
- Correctitud funcional: **Bajo-Medio** tras pruebas unitarias.

## Roadmap recomendado (por fases)

### Fase 1 (hoy)

1. Rotar secretos.
2. Configurar `META_APP_SECRET`.
3. Forzar `ALLOW_UNSIGNED_WEBHOOK=false`.
4. Probar `npm test`, `npm run send:hello-world`, `npm run smoke:gemini`.

### Fase 2 (1-3 dias)

1. Añadir retry/backoff y rate limiting.
2. Añadir persistencia de eventos y auditoría de respuestas.
3. Integrar observabilidad (logs estructurados + métricas + alertas).

### Fase 3 (1-2 semanas)

1. Cola asíncrona para picos.
2. Políticas de seguridad (WAF/IP allowlist, secret manager).
3. Test E2E con sandbox/staging y pruebas de carga.

## Criterios de salida para producción

- Secretos rotados y gestionados por secret manager.
- Webhook con firma obligatoria y TLS extremo a extremo.
- Token permanente activo y plan de rotación.
- Pruebas E2E y carga superadas.
- Alertas y dashboard operativos.

## Evidencias de verificacion ejecutadas

1. `npm test` -> 7/7 pruebas superadas.
2. `npm run smoke:gemini -- "Prueba corta de conectividad"` -> conectividad confirmada y respuesta correcta.
3. `npm run send:hello-world -- 15551680968` -> fallo `401 OAuthException code 190 malformed access token`.
4. `npm audit --audit-level=high` -> 0 vulnerabilidades.
5. Arranque servidor local -> `WhatsApp webhook server listening on http://localhost:3000`.

## Conclusiones operativas inmediatas

- La integración Gemini está funcional con el modelo configurado.
- El bloqueo principal para WhatsApp no es de código, es de credencial (token temporal inválido/malformado).
- El proyecto está listo para seguir pruebas en cuanto se regenere token temporal o se configure token permanente de system user.
