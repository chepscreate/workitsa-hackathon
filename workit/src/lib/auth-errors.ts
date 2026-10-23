/**
 * Turn raw Firebase Auth errors into plain-language messages a normal person
 * can act on. Firebase throws things like "Firebase: Error
 * (auth/invalid-credential)." which means nothing to a user.
 */

export function friendlyAuthError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const raw = err instanceof Error ? err.message : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
      return "Wrong email or password. Check both and try again.";
    case "auth/user-not-found":
      return "No Workit account uses that email. Sign up first, or try a different email.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support if you think that's a mistake.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, then try again — or reset your password.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    case "auth/email-already-in-use":
      return "An account already exists with that email. Try signing in instead.";
    case "auth/weak-password":
      return "That password is too weak — use at least 8 characters.";
    case "auth/operation-not-allowed":
      return "Email sign-in isn't enabled for this project. Ask the admin to turn it on.";
    case "auth/requires-recent-login":
      return "For security, please sign in again before making this change.";
    default:
      // Strip the noisy "Firebase: Error (auth/…)." wrapper if present.
      if (raw.startsWith("Firebase:")) {
        return "Something went wrong signing in. Please try again.";
      }
      return raw || "Something went wrong. Please try again.";
  }
}
