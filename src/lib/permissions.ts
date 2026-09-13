import type { Membership } from "./tenant";

export type Role = "owner" | "admin" | "atendente";

export function can(membership: Membership | null | undefined, action:
  | "view_reports" | "view_settings" | "view_team" | "view_agent"
  | "view_billing" | "manage_team" | "view_master"
): boolean {
  const r = membership?.role;
  if (!r) return false;
  switch (action) {
    case "view_reports":
    case "view_settings":
    case "view_team":
    case "view_agent":
    case "manage_team":
      return r === "owner" || r === "admin";
    case "view_billing":
      return r === "owner";
    case "view_master":
      return false; // master é gated por isSuperAdmin separadamente
  }
}

export function requireRole(membership: Membership | null | undefined, allowed: Role[]): boolean {
  return !!membership && allowed.includes(membership.role);
}
