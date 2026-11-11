"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signOut as fbSignOut,
  updateProfile,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  getFirebaseAuth,
  getDb,
  getFunctionsInstance,
  firebaseConfigured,
} from "@/lib/firebase";
import { refCodeFor, type UserProfile, type UserRole } from "@/lib/types";
import type { Permission } from "@/lib/roles";
import { CONSENT_VERSION } from "@/lib/popia";
import { initSentry, setSentryUser } from "@/lib/sentry";
import { track, setUserType } from "@/lib/analytics";
import { initPerformance } from "@/lib/performance";
import { captureSignupSource, getSignupSource, clearSignupSource } from "@/lib/attribution";

/**
 * Auth emails (verification, password reset) are sent by our own Cloud Functions
 * via SendGrid — not Firebase's built-in (locked) templates. See
 * functions/src/authEmails.ts.
 */
async function callAuthEmail(
  name: "requestPasswordReset" | "requestEmailVerification",
  data?: Record<string, unknown>,
): Promise<void> {
  const fn = httpsCallable(getFunctionsInstance(), name);
  await fn(data ?? {});
}

/**
 * Load a user's own profile, merging in their private-subcollection data.
 * Sensitive fields (verification ID number + document URLs) live at
 * users/{uid}/private/profile — NOT on the world-readable users/{uid} doc — so
 * we stitch them back together for the owner here. Other people only ever see
 * the public doc.
 */
async function loadMergedProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists()) return null;
  const base = { ...(snap.data() as UserProfile), uid };
  try {
    const priv = await getDoc(doc(getDb(), "users", uid, "private", "profile"));
    if (priv.exists()) {
      const p = priv.data() as Partial<UserProfile> & {
        verification?: Record<string, unknown>;
      };
      if (p.verification) {
        base.verification = {
          ...(base.verification ?? {}),
          ...p.verification,
        } as UserProfile["verification"];
      }
      // Phase B private fields — exact home + DOB live only in the private doc.
      for (const k of ["dateOfBirth", "homeLat", "homeLng", "homeAccuracy", "homePinnedAt"] as const) {
        if (p[k] !== undefined) {
          (base as Record<string, unknown>)[k] = p[k];
        }
      }
    }
  } catch {
    /* private doc is optional — ignore */
  }
  return base;
}

/** Persist the date of birth to the private doc + only the birth year publicly. */
async function storeDobPrivately(uid: string, dateOfBirth?: string): Promise<void> {
  if (!dateOfBirth) return;
  try {
    await setDoc(
      doc(getDb(), "users", uid, "private", "profile"),
      { dateOfBirth },
      { merge: true },
    );
  } catch {
    /* non-fatal — owner-only metadata */
  }
}

type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  dateOfBirth?: string; // ISO yyyy-mm-dd, 18+ verified before call
  referralCode?: string;
};

/** Data needed to complete a phone-signup once the OTP is verified. */
export type PhoneSignUpInfo = {
  displayName: string;
  role: UserRole;
  dateOfBirth?: string;
  /** Compulsory at signup since 2026-07-10 — every account must carry BOTH
   *  contact channels. Stored on the profile doc (decision emails etc.);
   *  becomes a sign-in credential only if they later add a password. */
  email?: string;
};

/**
 * Data needed to finish a signup on /finish-signup. Google supplies name +
 * email itself; phone sign-ups don't, so `displayName` / `email` are collected
 * on the form and passed here (used only when the auth user lacks them).
 */
export type GoogleSignUpInfo = {
  role: UserRole;
  dateOfBirth: string;
  phone?: string;
  referralCode?: string;
  /** Collected on the form for providers that don't give us a name (phone). */
  displayName?: string;
  /** Collected on the form for providers that don't give us an email (phone). */
  email?: string;
};

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  /**
   * Start a phone-OTP flow. Pass an E.164 number (+27…) and a DOM container
   * ID where the invisible reCAPTCHA can mount. Returns a confirmation
   * object — pass the user-typed code to confirmPhoneCode() to complete.
   */
  /** Re-fetch the signed-in user's profile from Firestore into local state. */
  refreshProfile: () => Promise<void>;
  /** RBAC phase 2 — capability check for UI gating (cosmetic; rules +
   *  callables are the real enforcement). Tagged tokens are judged only by
   *  their perms claim; untagged legacy admins pass everything. */
  can: (p: Permission) => boolean;
  startPhoneSignIn: (e164: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  /**
   * Complete a phone-OTP flow. Pass the confirmation result + the 6-digit
   * code. If this is a brand-new user (no Firestore profile yet) and you
   * pass signUpInfo, we create the profile so they land in the welcome flow.
   */
  confirmPhoneCode: (
    confirmation: ConfirmationResult,
    code: string,
    signUpInfo?: PhoneSignUpInfo,
  ) => Promise<{ isNewUser: boolean }>;
  /** OTP-link a phone number to the current email/Google account. */
  startPhoneLink: (e164: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  /** Confirm the linking OTP; mirrors the verified number to the profile. */
  confirmPhoneLink: (
    confirmation: ConfirmationResult,
    code: string,
    e164: string,
  ) => Promise<void>;
  /**
   * Add an email + password credential to a phone-signed-up account so the
   * user can sign in with email + password from then on. Sends a verification
   * email immediately. The phone credential stays linked — they can use either.
   */
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  /**
   * Google sign-in via popup. Returns whether this is a brand-new user (no
   * Workit profile yet) — if so, the caller sends them to /finish-signup to
   * pick a role + confirm age before completeGoogleSignUp() creates the profile.
   */
  signInWithGoogle: () => Promise<{ isNewUser: boolean }>;
  /** Create the profile for a just-signed-in Google user who has none yet. */
  completeGoogleSignUp: (info: GoogleSignUpInfo) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // RBAC phase 2: the token's role claims (set by setAdminRole, land on
  // sign-in). null = no claims (regular user or untagged legacy admin).
  const [adminClaims, setAdminClaims] = useState<{
    adminRole?: string;
    perms?: Record<string, boolean>;
  } | null>(null);

  // Capture the growth-channel tag (?src=fb, …) on first touch, before the
  // person ever reaches /signup. Stored first-touch; stamped onto the profile
  // at account creation below.
  useEffect(() => { captureSignupSource(); }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }
    // Boot Sentry on first mount (no-op if DSN not configured).
    initSentry();
    initPerformance();

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setSentryUser(u?.uid ?? null);
      if (u) {
        try {
          const merged = await loadMergedProfile(u.uid);
          setProfile(merged);
          if (merged?.role) {
            setUserType(merged.role === "worker" ? "worker" : "customer");
          }
        } catch {
          setProfile(null);
        }
        try {
          const tok = await u.getIdTokenResult();
          setAdminClaims(
            tok.claims.adminRole
              ? {
                  adminRole: tok.claims.adminRole as string,
                  perms: tok.claims.perms as Record<string, boolean> | undefined,
                }
              : null,
          );
        } catch {
          setAdminClaims(null);
        }
      } else {
        setProfile(null);
        setAdminClaims(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Same hybrid semantics as the rules' can(): a tagged token is judged only
  // by its perms; an untagged legacy admin passes everything. Cosmetic layer —
  // the real gates are Firestore rules + callable checks.
  const can = (p: Permission): boolean => {
    if (adminClaims) return adminClaims.perms?.[p] === true;
    return profile?.role === "admin";
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  };

  const signUp = async ({
    email,
    password,
    displayName,
    role,
    phone,
    dateOfBirth,
    referralCode,
  }: SignUpInput) => {
    const auth = getFirebaseAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    // Fire and forget — branded verification email via our Cloud Function.
    try {
      await callAuthEmail("requestEmailVerification");
    } catch {
      /* ignore — they can resend from account page */
    }

    // Resolve referral code → referrer uid (if any). Best-effort.
    let referredBy: string | undefined;
    if (referralCode) {
      try {
        const code = referralCode.trim().toUpperCase();
        const snap = await getDocs(
          query(collection(getDb(), "users"), where("referralCode", "==", code), limit(1)),
        );
        if (!snap.empty && snap.docs[0].id !== cred.user.uid) {
          referredBy = snap.docs[0].id;
        }
      } catch {
        /* ignore — invalid code shouldn't block signup */
      }
    }

    const signupSource = getSignupSource();
    const baseProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      createdAt: Date.now(),
      // Every new account waits for admin approval before it can post / offer.
      accountStatus: "pending",
      termsAcceptedAt: Date.now(),
      termsVersion: CONSENT_VERSION,
      referralCode: refCodeFor(cred.user.uid),
      ...(signupSource ? { signupSource } : {}),
      ...(phone ? { phone } : {}),
      // Public doc gets only the birth YEAR; the full DOB goes to the private doc.
      ...(dateOfBirth ? { birthYear: new Date(dateOfBirth).getFullYear() } : {}),
      ...(referredBy ? { referredBy } : {}),
      ...(role === "worker"
        ? { verificationStatus: "none", backgroundVerified: false }
        : {}),
    };

    await setDoc(doc(getDb(), "users", cred.user.uid), {
      ...baseProfile,
      createdAtServer: serverTimestamp(),
    });
    await storeDobPrivately(cred.user.uid, dateOfBirth);
    setProfile({ ...baseProfile, ...(dateOfBirth ? { dateOfBirth } : {}) });
    track("sign_up", { method: "password", role, user_type: role === "worker" ? "worker" : "customer" });
    clearSignupSource();

    // Bump referrer's count — best effort, rule-allowed because referrer doc
    // is updated only on referralsCount (an open numeric field). If this
    // fails it doesn't matter — referral attribution is still on the new user.
    if (referredBy) {
      try {
        await updateDoc(doc(getDb(), "users", referredBy), {
          referralsCount: increment(1),
        });
      } catch {
        /* ignore */
      }
    }
  };

  const signOut = async () => {
    await fbSignOut(getFirebaseAuth());
  };

  const resetPassword = async (email: string) => {
    await callAuthEmail("requestPasswordReset", { email });
  };

  const refreshProfile = async () => {
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    try {
      const merged = await loadMergedProfile(u.uid);
      if (merged) setProfile(merged);
    } catch {
      /* ignore */
    }
  };

  const resendEmailVerification = async () => {
    const u = getFirebaseAuth().currentUser;
    if (!u) throw new Error("Not signed in.");
    await callAuthEmail("requestEmailVerification");
  };

  const linkEmailPassword = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) throw new Error("Not signed in.");
    if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    // Link the email+password credential to the existing (phone) account.
    const credential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(u, credential);
    // Mirror the email to Firestore so it shows in the profile / admin views.
    try {
      await updateDoc(doc(getDb(), "users", u.uid), { email });
      setProfile((p) => (p ? { ...p, email } : p));
    } catch {
      /* ignore — profile will catch up on next refresh */
    }
    // Send the verification email immediately so they can verify whenever.
    try {
      await callAuthEmail("requestEmailVerification");
    } catch {
      /* ignore — they can resend from the account page */
    }
  };

  // --- Google ---

  const signInWithGoogle = async (): Promise<{ isNewUser: boolean }> => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const snap = await getDoc(doc(getDb(), "users", cred.user.uid));
    return { isNewUser: !snap.exists() };
  };

  const completeGoogleSignUp = async ({
    role,
    dateOfBirth,
    phone,
    referralCode,
    displayName,
    email,
  }: GoogleSignUpInfo): Promise<void> => {
    const u = getFirebaseAuth().currentUser;
    if (!u) throw new Error("Not signed in.");
    const ref = doc(getDb(), "users", u.uid);
    // Phone sign-ups arrive with no provider name/email; Google gives both.
    const isPhone = u.providerData.some((p) => p.providerId === "phone");
    const resolvedName = (displayName?.trim() || u.displayName || "").trim();
    const resolvedEmail = (email?.trim().toLowerCase() || u.email || "").trim();

    // Never overwrite an existing profile — just adopt it.
    const existing = await getDoc(ref);
    if (existing.exists()) {
      setProfile(await loadMergedProfile(u.uid));
      return;
    }

    // Resolve referral code → referrer uid (best-effort).
    let referredBy: string | undefined;
    if (referralCode) {
      try {
        const code = referralCode.trim().toUpperCase();
        const snap = await getDocs(
          query(collection(getDb(), "users"), where("referralCode", "==", code), limit(1)),
        );
        if (!snap.empty && snap.docs[0].id !== u.uid) referredBy = snap.docs[0].id;
      } catch {
        /* ignore — invalid code shouldn't block signup */
      }
    }

    // Never create a nameless / number-named profile — that's exactly what put
    // phone numbers where names should be in the admin queue.
    if (!resolvedName) throw new Error("Please enter your full name.");

    // Keep the auth user's name in sync so it shows everywhere (chat, ratings).
    if (resolvedName !== (u.displayName ?? "")) {
      try {
        await updateProfile(u, { displayName: resolvedName });
      } catch {
        /* non-fatal — the Firestore profile is the source of truth */
      }
    }

    const signupSource = getSignupSource();
    const baseProfile: UserProfile = {
      uid: u.uid,
      email: resolvedEmail,
      displayName: resolvedName,
      role,
      createdAt: Date.now(),
      accountStatus: "pending",
      termsAcceptedAt: Date.now(),
      termsVersion: CONSENT_VERSION,
      referralCode: refCodeFor(u.uid),
      ...(signupSource ? { signupSource } : {}),
      ...(u.photoURL ? { photoURL: u.photoURL } : {}),
      ...(phone || u.phoneNumber ? { phone: phone ?? u.phoneNumber ?? undefined } : {}),
      ...(dateOfBirth ? { birthYear: new Date(dateOfBirth).getFullYear() } : {}),
      ...(referredBy ? { referredBy } : {}),
      ...(role === "worker"
        ? { verificationStatus: "none", backgroundVerified: false }
        : {}),
    };
    await setDoc(ref, { ...baseProfile, createdAtServer: serverTimestamp() });
    await storeDobPrivately(u.uid, dateOfBirth);
    setProfile({ ...baseProfile, ...(dateOfBirth ? { dateOfBirth } : {}) });
    track("sign_up", { method: isPhone ? "phone" : "google", role, user_type: role === "worker" ? "worker" : "customer" });
    clearSignupSource();

    if (referredBy) {
      try {
        await updateDoc(doc(getDb(), "users", referredBy), {
          referralsCount: increment(1),
        });
      } catch {
        /* ignore */
      }
    }
  };

  // --- Phone OTP ---

  // Shared reCAPTCHA setup for both phone sign-in and phone linking.
  const makeRecaptcha = (recaptchaContainerId: string): RecaptchaVerifier => {
    const auth = getFirebaseAuth();
    type WindowWithVerifier = Window & { _workitRecaptcha?: RecaptchaVerifier };
    const w = window as WindowWithVerifier;

    // Always nuke any prior verifier — React may have remounted the container,
    // leaving the cached verifier pointing at a detached node. That throws
    // "reCAPTCHA client element has been removed".
    if (w._workitRecaptcha) {
      try {
        w._workitRecaptcha.clear();
      } catch {
        /* ignore */
      }
      delete w._workitRecaptcha;
    }

    // Make sure the container is in the DOM before mounting reCAPTCHA.
    const container = document.getElementById(recaptchaContainerId);
    if (!container) {
      throw new Error("reCAPTCHA container not mounted. Refresh and try again.");
    }

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "invisible",
      callback: () => {
        /* solved — Firebase will continue */
      },
    });
    w._workitRecaptcha = verifier;
    return verifier;
  };

  const startPhoneSignIn = async (
    e164: string,
    recaptchaContainerId: string,
  ): Promise<ConfirmationResult> => {
    const auth = getFirebaseAuth();
    const verifier = makeRecaptcha(recaptchaContainerId);
    return signInWithPhoneNumber(auth, e164, verifier);
  };

  // Link a phone number to the CURRENT (email/Google) account — same OTP dance
  // as sign-in, but attaches the credential instead of creating a session.
  const startPhoneLink = async (
    e164: string,
    recaptchaContainerId: string,
  ): Promise<ConfirmationResult> => {
    const u = getFirebaseAuth().currentUser;
    if (!u) throw new Error("Not signed in.");
    const verifier = makeRecaptcha(recaptchaContainerId);
    return linkWithPhoneNumber(u, e164, verifier);
  };

  // Confirm the linking OTP, then mirror the now-VERIFIED number to the profile.
  const confirmPhoneLink = async (
    confirmation: ConfirmationResult,
    code: string,
    e164: string,
  ): Promise<void> => {
    await confirmation.confirm(code);
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    try {
      await updateDoc(doc(getDb(), "users", u.uid), { phone: e164, phoneVerified: true });
      setProfile((p) => (p ? { ...p, phone: e164, phoneVerified: true } : p));
    } catch {
      /* profile catches up on next refresh */
    }
  };

  const confirmPhoneCode = async (
    confirmation: ConfirmationResult,
    code: string,
    signUpInfo?: PhoneSignUpInfo,
  ): Promise<{ isNewUser: boolean }> => {
    const cred = await confirmation.confirm(code);
    const u = cred.user;

    // Does this user already have a Firestore profile?
    const ref = doc(getDb(), "users", u.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return { isNewUser: false };
    }

    // First time we've seen this phone number and no signup details were
    // captured (they came through the combined "Sign in or create account"
    // form, which doesn't ask for a name). DON'T mint a placeholder profile
    // named after their number — that's what filled the admin queue with phone
    // numbers instead of names. Leave them profile-less; the caller / AccountGate
    // routes them to /finish-signup to enter their name, email and role, which
    // creates the real profile via completeGoogleSignUp.
    if (!signUpInfo) {
      return { isNewUser: true };
    }

    await updateProfile(u, { displayName: signUpInfo.displayName });
    const signupSource = getSignupSource();
    const baseProfile: UserProfile = {
      uid: u.uid,
      email: signUpInfo.email?.trim().toLowerCase() || u.email || "",
      displayName: signUpInfo.displayName,
      role: signUpInfo.role,
      createdAt: Date.now(),
      accountStatus: "pending",
      termsAcceptedAt: Date.now(),
      termsVersion: CONSENT_VERSION,
      phone: u.phoneNumber ?? undefined,
      referralCode: refCodeFor(u.uid),
      ...(signupSource ? { signupSource } : {}),
      ...(signUpInfo.dateOfBirth
        ? { birthYear: new Date(signUpInfo.dateOfBirth).getFullYear() }
        : {}),
      ...(signUpInfo.role === "worker"
        ? { verificationStatus: "none", backgroundVerified: false }
        : {}),
    };
    await setDoc(ref, { ...baseProfile, createdAtServer: serverTimestamp() });
    await storeDobPrivately(u.uid, signUpInfo.dateOfBirth);
    setProfile({
      ...baseProfile,
      ...(signUpInfo.dateOfBirth ? { dateOfBirth: signUpInfo.dateOfBirth } : {}),
    });
    track("sign_up", { method: "phone", role: signUpInfo.role, user_type: signUpInfo.role === "worker" ? "worker" : "customer" });
    clearSignupSource();
    return { isNewUser: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        configured: firebaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendEmailVerification,
        refreshProfile,
        can,
        startPhoneSignIn,
        confirmPhoneCode,
        startPhoneLink,
        confirmPhoneLink,
        linkEmailPassword,
        signInWithGoogle,
        completeGoogleSignUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
