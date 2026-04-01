/** Home dashboard path for role-specific landing pages. */
export function dashboardHomeForRole(role: string | undefined): string {
  if (role === "DOSIFICADOR") return "/dashboard/dosificador"
  if (role === "OPERADOR") return "/dashboard/operator"
  return "/dashboard"
}
