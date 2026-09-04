/**
 * Team actions -- barrel. Split across five files (each carries its own
 * 'use server' except team-shared.ts; this file only re-exports, so it
 * doesn't need one):
 *   - team-shared.ts: isAccountManager
 *   - team-data.ts: types + the main team-page fetch
 *   - team-invite.ts: listOrgMembers, invite, permissions/goal/visibility
 *   - team-remove.ts: remove member, cancel/fan-out invitation
 *   - team-accept.ts: accept invitation (existing/new user), invite info
 */

export * from './team-data'
export * from './team-invite'
export * from './team-remove'
export * from './team-accept'
