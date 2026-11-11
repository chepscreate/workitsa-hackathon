import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
  type DocumentData,
  type Query,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { UserProfile } from "./types";

export type AdminCounts = {
  usersTotal: number;
  pendingApprovals: number;
  verification: number;
};

/**
 * Server-side aggregate counts for the admin sidebar badges.
 *
 * Previously the admin downloaded the ENTIRE users collection on the client
 * just to compute these badge numbers (and silently showed 0 on any tab where
 * the full list hadn't been loaded). Firestore count() aggregation returns the
 * numbers without reading the documents — billed at ~1 read per 1000 matched
 * docs — so this scales as the user base grows.
 *
 * Each count is independent + fault-tolerant: if a composite index is still
 * building, that one count falls back to 0 instead of breaking the whole panel.
 */
async function countOf(q: Query<DocumentData>): Promise<number> {
  try {
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function fetchAdminCounts(): Promise<AdminCounts> {
  const db = getDb();
  const users = collection(db, "users");

  const [usersTotal, pendingApprovals, submitted, resubmitted] = await Promise.all([
    countOf(query(users)),
    countOf(query(users, where("accountStatus", "==", "pending"))),
    // New worker submissions awaiting first review.
    countOf(
      query(
        users,
        where("role", "==", "worker"),
        where("verificationStatus", "==", "none"),
        where("verification.submittedAt", ">", 0),
      ),
    ),
    // Re-submissions can't be a single predicate (it compares submittedAt vs
    // reviewedAt), but the set of workers who've EVER resubmitted is small, so
    // we read just those and finish the comparison on the client.
    (async () => {
      try {
        const snap = await getDocs(
          query(users, where("role", "==", "worker"), where("verification.resubmittedAt", ">", 0)),
        );
        return snap.docs.reduce((n, d) => {
          const v = (d.data() as UserProfile).verification;
          const rev = v?.reviewedAt ?? 0;
          const resub = v?.resubmittedAt ?? 0;
          return n + (resub > rev ? 1 : 0);
        }, 0);
      } catch {
        return 0;
      }
    })(),
  ]);

  return {
    usersTotal,
    pendingApprovals,
    verification: submitted + resubmitted,
  };
}
