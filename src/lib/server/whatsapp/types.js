// Shared JSDoc typedefs for the WhatsApp module (this codebase is plain JS, so
// "types" are JSDoc — editors still get autocomplete + checking). No runtime code.

/**
 * @typedef {Object} WhatsAppCredentials
 * @property {string} accessToken
 * @property {string} phoneNumberId
 * @property {string} businessAccountId
 * @property {string} apiVersion
 * @property {string} graphBase
 */

/**
 * @typedef {Object} OutboundResult
 * @property {boolean} ok
 * @property {string|null} messageId
 * @property {string|null} waId
 * @property {string} to
 * @property {string} type
 * @property {object} raw
 */

/**
 * @typedef {Object} InboundMessageEvent
 * @property {'message'} kind
 * @property {string|null} phoneNumberId  the business number that received it
 * @property {string} from                the customer's wa_id (E.164 without +)
 * @property {string} messageId
 * @property {string} timestamp
 * @property {string} type                text | image | document | interactive | ...
 * @property {string|null} text
 * @property {object|null} interactive    button/list reply payload
 * @property {string|null} contactName
 * @property {object} message             the raw Meta message object
 */

/**
 * @typedef {Object} StatusEvent
 * @property {'status'} kind
 * @property {string|null} phoneNumberId
 * @property {'sent'|'delivered'|'read'|'failed'} status
 * @property {string} messageId
 * @property {string} recipient
 * @property {string} timestamp
 * @property {object|null} errors
 */

/**
 * @typedef {'whatsapp'|'email'|'sms'|'push'|'in_app'} NotificationChannel
 */

export {};
