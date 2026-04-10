/**
 * Tracks storage paths under bucket `profiles` that returned no signed URL (e.g. object deleted).
 * Prevents repeated createSignedUrl calls for the same stale path in one browser session.
 */
const missingPaths = new Set<string>()

export function isProfileAvatarPathKnownMissing(path: string): boolean {
  return missingPaths.has(path)
}

export function markProfileAvatarPathMissing(path: string): void {
  missingPaths.add(path)
}

/** Call after a successful upload replaces a path so a retried sign can proceed if the object exists. */
export function clearProfileAvatarPathMissing(path: string): void {
  missingPaths.delete(path)
}
