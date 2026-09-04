/**
 * WhatsApp actions -- barrel. Split across six files (each carries its own
 * 'use server'; this file only re-exports, so it doesn't need one):
 *   - whatsapp-connection.ts: connection lifecycle (create/find conversation,
 *     disconnect, embedded-signup OAuth, connection test)
 *   - whatsapp-messaging.ts: send text/media, mark as read
 *   - whatsapp-simulation.ts: mock-mode simulator + conversation context
 *   - whatsapp-ai-reply.ts: AI-suggested reply, handoff, lead creation
 *   - whatsapp-schedule.ts: scheduled message send/list/cancel
 *   - whatsapp-flags.ts: archive/mute/pin/favorite/pause + unread/clear/
 *     delete/block
 */

export * from './whatsapp-connection'
export * from './whatsapp-messaging'
export * from './whatsapp-simulation'
export * from './whatsapp-ai-reply'
export * from './whatsapp-schedule'
export * from './whatsapp-flags'
