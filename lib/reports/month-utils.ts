export function shiftMonthString(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  if (!year || !monthNumber) return month

  const shifted = new Date(year, monthNumber - 1 + delta, 1)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`
}
