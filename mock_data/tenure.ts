/**
 * Six-month tenure milestones.
 *
 * The schedule is *derived* from the hire date and never stored, so it cannot
 * drift out of step with it: milestone 1 falls six months after the hire date,
 * milestone 2 a year after, and so on for as long as the employment runs. Only
 * the payment is a record.
 *
 * This module deliberately imports nothing. The seed and the serialisers both
 * need the maths, and `serializers -> db -> seed` is already a chain — putting
 * it here keeps the seed from having to import back into that chain.
 */

/** Months between one milestone and the next. */
export const MILESTONE_MONTHS = 6

/**
 * `iso` shifted by `months`, clamped to the end of the landing month.
 *
 * Someone hired on 31 August reaches their milestone on 28 February, not on
 * 3 March — a naive day-of-month copy would roll over and quietly move the
 * anniversary forward every leap year.
 */
export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number]
  const target = month - 1 + months
  const landingYear = year + Math.floor(target / 12)
  const landingMonth = ((target % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(landingYear, landingMonth + 1, 0)).getUTCDate()
  const landingDay = Math.min(day, lastDay)
  return [
    String(landingYear).padStart(4, "0"),
    String(landingMonth + 1).padStart(2, "0"),
    String(landingDay).padStart(2, "0"),
  ].join("-")
}

/** The date milestone `n` falls due. `n = 1` is the first six months. */
export function milestoneDate(hireDate: string, n: number): string {
  return addMonths(hireDate, n * MILESTONE_MONTHS)
}

/** How many milestones have fallen due on or before `on`. */
export function milestonesReached(hireDate: string, on: string): number {
  if (!hireDate || hireDate > on) return 0
  let reached = 0
  // Bounded by construction: each step adds six months, so it terminates well
  // before any plausible tenure.
  while (milestoneDate(hireDate, reached + 1) <= on) reached += 1
  return reached
}

/** Whole months of service, for the "1 y 3 m" reading on screen. */
export function monthsOfService(hireDate: string, on: string): number {
  if (!hireDate || hireDate > on) return 0
  let months = 0
  while (addMonths(hireDate, months + 1) <= on) months += 1
  return months
}
