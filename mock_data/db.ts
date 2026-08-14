/**
 * The in-memory database.
 *
 * It lives for as long as the tab does. A page reload re-seeds it, so anything
 * created through the UI is gone after F5 — that is the trade for having no
 * persistence at all, and it makes every reload a clean slate.
 */

import type { AuditEventRow, MockDb } from "./rows"
import { seed } from "./seed"

export const db: MockDb = seed()

/** Throw away every change and start from the sample data again. */
export function resetDb(): void {
  Object.assign(db, seed())
}

let counter = 0

/** Ids are readable on purpose: `emp-15` in the console beats a UUID. */
export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-new-${counter}`
}

export function findById<T extends { id: string }>(
  rows: T[],
  id: string | null | undefined,
): T | null {
  if (!id) return null
  return rows.find((row) => row.id === id) ?? null
}

export function removeById<T extends { id: string }>(rows: T[], id: string): void {
  const index = rows.findIndex((row) => row.id === id)
  if (index !== -1) rows.splice(index, 1)
}

/**
 * The open assignment for an employment — the one with no end date. There is at
 * most one; the assignment endpoint closes the previous one before opening a
 * new one.
 */
export function openAssignmentFor(employmentId: string) {
  return (
    db.assignments.find(
      (row) => row.employment === employmentId && row.effective_to === null,
    ) ?? null
  )
}

/** The open assignment holding a position, if anyone holds it. */
export function openAssignmentOn(positionId: string) {
  return (
    db.assignments.find(
      (row) => row.position === positionId && row.effective_to === null,
    ) ?? null
  )
}

/** Append to the audit log, newest first. Called by every write. */
export function recordEvent(
  actorEmail: string | null,
  action: string,
  subjectType: string,
  subjectId: string | null,
): void {
  const event: AuditEventRow = {
    id: nextId("ev"),
    actor_email: actorEmail,
    action,
    subject_type: subjectType,
    subject_id: subjectId,
    occurred_at: new Date().toISOString(),
    ip: "127.0.0.1",
  }
  db.auditEvents.unshift(event)
}
