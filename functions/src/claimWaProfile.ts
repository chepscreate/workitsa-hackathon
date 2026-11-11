/**
 * claimWhatsAppProfile — lets a WhatsApp-onboarded worker claim their
 * profile via a magic link. Takes the one-time token stored during
 * onboarding, verifies it, and returns a Firebase custom auth token
 * so the client can sign in as that wa_ user and complete verification.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export const claimWhatsAppProfile = onCall(
  { timeoutSeconds: 30 },
  async (req) => {
    const token = typeof req.data?.token === "string" ? req.data.token.trim() : "";
    if (!token || token.length < 16) {
      throw new HttpsError("invalid-argument", "Missing or invalid token.");
    }

    const db = getFirestore();
    const snap = await db
      .collection("users")
      .where("verifyToken", "==", token)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new HttpsError("not-found", "Link expired or already used.");
    }

    const userDoc = snap.docs[0];
    const uid = userDoc.id;
    const data = userDoc.data();

    // Token expires after 7 days.
    const tokenAge = Date.now() - (data.verifyTokenAt ?? 0);
    if (tokenAge > 7 * 24 * 60 * 60 * 1000) {
      throw new HttpsError("deadline-exceeded", "Link expired. Text HI to WorkitSA on WhatsApp to get a new one.");
    }

    // Ensure the Firebase Auth user exists (wa_ users don't have one yet).
    const auth = getAuth();
    try {
      await auth.getUser(uid);
    } catch {
      await auth.createUser({
        uid,
        displayName: data.displayName ?? "Worker",
      });
    }

    // Mint a custom auth token.
    const customToken = await auth.createCustomToken(uid);

    // Clear the verify token so it can't be reused.
    await userDoc.ref.update({ verifyToken: null, verifyTokenAt: null });

    return { customToken, uid };
  },
);
