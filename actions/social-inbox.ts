/**
 * Instagram manual inbox -- barrel. Split across three files (each carries
 * its own 'use server'; this file only re-exports, so it doesn't need one):
 *   - social-inbox-send.ts: types, access guard, messaging-window rules,
 *     sending (text/image/audio), media upload
 *   - social-inbox-state.ts: conversation/message listing, read/unread,
 *     automation pause, conversation flags (archive/mute/pin/favorite/block)
 *   - social-inbox-lead.ts: lead detail panel context, create-lead-from-
 *     conversation
 */

export * from './social-inbox-send'
export * from './social-inbox-state'
export * from './social-inbox-lead'
