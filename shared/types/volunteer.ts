/**
 * Volunteer session shape — deliberately NOT RBAC-shaped (no permissions[],
 * no roleName). Volunteers are a separate principal from staff `User`s and
 * are never checked against PermissionsGuard/hasPermission.
 */
export interface VolunteerSessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string | null;
}
