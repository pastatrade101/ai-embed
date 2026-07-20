// Public surface of the WhatsApp module. Import from here, not the internals.
//   import * as whatsapp from '$lib/server/whatsapp/index.js';
export { whatsappConfig, isConfigured, defaultCredentials, credentialsFor, metaAppConfig, embeddedSignupReady, DEFAULT_API_VERSION } from './config.js';
export { sendText, sendTemplate, sendImage, sendDocument, sendPdf, sendInteractiveButtons, sendList, markRead } from './messages.js';
export { verifyChallenge, verifySignature, parseWebhook, dispatchWebhookEvents, on } from './webhook.js';
export { resolveCredentials, resolveTenantByPhoneNumberId } from './credentials.js';
export { WhatsAppApiError } from './client.js';
export { log } from './logger.js';
export * as templates from './templates.js';
