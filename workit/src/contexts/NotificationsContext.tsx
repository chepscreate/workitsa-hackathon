"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ToastStack, type ToastItem } from "@/components/Toast";
import {
  subscribeMyAssignedJobs,
  subscribeMyJobs,
  subscribeOpenJobs,
} from "@/lib/jobs";
import {
  matchesSavedSearch,
  subscribeSavedSearches,
} from "@/lib/savedSearches";
import { isEmployerSide, type SavedSearch } from "@/lib/types";
import { registerPushTokenIfGranted } from "@/lib/messaging";
import { useAuth } from "./AuthContext";
import type { Job } from "@/lib/types";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export type NotificationEvent =
  | "newOffer"
  | "workerStarted"
  | "jobDone"
  | "offerAccepted"
  | "jobConfirmed"
  | "newMatchingJob";

export type NotificationPrefs = Record<NotificationEvent, boolean>;

const DEFAULT_PREFS: NotificationPrefs = {
  newOffer: true,
  workerStarted: true,
  jobDone: true,
  offerAccepted: true,
  jobConfirmed: true,
  newMatchingJob: true,
};

type NotificationsState = {
  permission: PermissionState;
  enabled: boolean;
  request: () => Promise<void>;
  toggle: () => void;
  prefs: NotificationPrefs;
  setPref: (event: NotificationEvent, on: boolean) => void;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

const STORAGE_KEY = "workit_notifications_enabled_v1";
const PREFS_KEY = "workit_notification_prefs_v1";

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [permission, setPermission] = useState<PermissionState>("default");
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prevJobsRef = useRef<Map<string, Job> | null>(null);

  // Init permission + saved preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission as PermissionState);
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setEnabled(saved !== "false");
    const savedPrefs = window.localStorage.getItem(PREFS_KEY);
    if (savedPrefs) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(savedPrefs) });
      } catch {
        /* ignore corrupt prefs */
      }
    }
  }, []);

  // Keep this device's FCM push token registered + fresh for every signed-in
  // user who has already allowed notifications. Server push (offers, SOS alerts,
  // broadcasts) targets stored tokens; tokens rotate and were previously only
  // written when someone manually tapped "Enable push", so granted users drifted
  // to zero live devices. This never prompts — it no-ops unless permission is
  // already 'granted'.
  useEffect(() => {
    if (!user) return;
    void registerPushTokenIfGranted();
  }, [user]);

  const setPref = useCallback(
    (event: NotificationEvent, on: boolean) => {
      setPrefs((p) => {
        const next = { ...p, [event]: on };
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  const request = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
    if (result === "granted") {
      setEnabled(true);
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      const next = !e;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      }
      return next;
    });
  }, []);

  const pushToast = useCallback((t: Omit<ToastItem, "id" | "createdAt">) => {
    setToasts((prev) => [
      ...prev,
      { ...t, id: `${Date.now()}-${Math.random()}`, createdAt: Date.now() },
    ]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, body: string, href?: string) => {
      pushToast({ title, body, href });
      if (
        enabled
        && typeof Notification !== "undefined"
        && Notification.permission === "granted"
        && document.visibilityState !== "visible"
      ) {
        try {
          const n = new Notification(`Workit · ${title}`, { body, tag: title + body });
          if (href) {
            n.onclick = () => {
              window.focus();
              window.location.href = href;
            };
          }
        } catch {
          /* ignore */
        }
      }
    },
    [enabled, pushToast],
  );

  // Watch employer's jobs for new offers + status changes from worker side
  useEffect(() => {
    if (!user || !profile) {
      prevJobsRef.current = null;
      return;
    }
    const isEmployer = isEmployerSide(profile.role);
    const isWorker = profile.role === "worker";
    const unsubs: Array<() => void> = [];

    const handleJobs = (jobs: Job[], side: "employer" | "worker") => {
      const prev = prevJobsRef.current;
      const next = new Map<string, Job>();
      for (const j of jobs) next.set(j.id, j);

      if (prev) {
        for (const j of jobs) {
          const before = prev.get(j.id);
          if (!before) continue; // brand-new job in own list (we created it)

          if (side === "employer") {
            if ((j.offerCount ?? 0) > (before.offerCount ?? 0) && prefs.newOffer) {
              notify(
                "New offer on your job",
                `${j.title} — someone responded.`,
                `/jobs?id=${j.id}`,
              );
            }
            if (before.status === "assigned" && j.status === "in_progress" && prefs.workerStarted) {
              notify(
                "Worker has started",
                `${j.assignedWorkerName ?? "Worker"} is on the way / starting now.`,
                `/jobs?id=${j.id}`,
              );
            }
            if (before.status === "in_progress" && j.status === "completed" && prefs.jobDone) {
              notify(
                "Job marked done",
                `${j.assignedWorkerName ?? "Worker"} finished — confirm to unlock rating.`,
                `/jobs?id=${j.id}`,
              );
            }
          } else {
            if (before.status === "completed" && j.status === "confirmed" && prefs.jobConfirmed) {
              notify(
                "Job confirmed — leave a rating",
                `${j.title}`,
                `/jobs?id=${j.id}`,
              );
            }
          }
        }
        // Net-new assignments (worker side) — "offer accepted"
        if (side === "worker" && prefs.offerAccepted) {
          for (const j of jobs) {
            if (!prev.has(j.id)) {
              notify(
                "Your offer was accepted",
                `${j.title} · R ${j.agreedPrice ?? "—"}`,
                `/jobs?id=${j.id}`,
              );
            }
          }
        }
      }
      prevJobsRef.current = next;
    };

    // Saved-search watcher: notify approved workers when a new open job in
    // one of their selected categories is posted. We watch BOTH (a) the
    // worker's category preferences and (b) any explicit saved searches they
    // set up on /find-work — applying the saved search's filters (keyword,
    // radius) before firing.
    if (isWorker && profile.accountStatus === "approved") {
      const seen = new Set<string>();
      const home =
        typeof profile.homeLat === "number" && typeof profile.homeLng === "number"
          ? { lat: profile.homeLat, lng: profile.homeLng }
          : null;
      // Mutable cache of the worker's saved searches.
      let savedSearches: SavedSearch[] = [];

      // Subscribe to category preferences (legacy) for backward compatibility.
      (profile.categories ?? []).forEach((cat) => {
        const unsub = subscribeOpenJobs(cat as never, (jobs) => {
          if (seen.size === 0) {
            jobs.forEach((j) => seen.add(j.id));
            return;
          }
          for (const j of jobs) {
            if (seen.has(j.id)) continue;
            seen.add(j.id);
            if (prefs.newMatchingJob) {
              notify(
                "New job near you",
                `${j.title} · R ${j.suggestedPrice} · ${j.suburb}`,
                `/jobs?id=${j.id}`,
              );
            }
          }
        });
        unsubs.push(unsub);
      });

      // Live saved-searches list.
      unsubs.push(
        subscribeSavedSearches(user.uid, (list) => {
          savedSearches = list;
        }),
      );

      // Watch all open jobs once, and per new job check each saved search
      // and any direct invites for this worker.
      const allSeen = new Set<string>();
      unsubs.push(
        subscribeOpenJobs(undefined, (jobs) => {
          if (allSeen.size === 0) {
            jobs.forEach((j) => allSeen.add(j.id));
            return;
          }
          for (const j of jobs) {
            if (allSeen.has(j.id)) continue;
            allSeen.add(j.id);
            if (!prefs.newMatchingJob) continue;

            // Direct invite takes priority — louder toast.
            if (j.invitedWorkerIds?.includes(user.uid)) {
              notify(
                `${j.employerName} invited you to a job`,
                `${j.title} · R ${j.suggestedPrice} · ${j.suburb}`,
                `/jobs?id=${j.id}`,
              );
              continue;
            }

            const matching = savedSearches.find((s) => matchesSavedSearch(s, j, home));
            if (matching) {
              const label = matching.name
                ? `match for "${matching.name}"`
                : "match for a saved search";
              notify(
                `New ${label}`,
                `${j.title} · R ${j.suggestedPrice} · ${j.suburb}`,
                `/jobs?id=${j.id}`,
              );
            }
          }
        }),
      );
    }

    if (isEmployer) {
      unsubs.push(subscribeMyJobs(user.uid, (jobs) => handleJobs(jobs, "employer")));
    }
    if (isWorker) {
      unsubs.push(
        subscribeMyAssignedJobs(user.uid, (jobs) => handleJobs(jobs, "worker")),
      );
    }
    return () => {
      unsubs.forEach((u) => u());
      prevJobsRef.current = null;
    };
  }, [user, profile, notify, prefs]);

  const value = useMemo<NotificationsState>(
    () => ({ permission, enabled, request, toggle, prefs, setPref }),
    [permission, enabled, request, toggle, prefs, setPref],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <ToastStack items={toasts} onDismiss={dismiss} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
