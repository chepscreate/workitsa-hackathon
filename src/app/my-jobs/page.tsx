"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import AccountGate from "@/components/AccountGate";
import JobTabs from "@/components/JobTabs";
import { JobCardSkeletonGrid } from "@/components/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { getJob, subscribeMyAssignedJobs, subscribeMyJobs } from "@/lib/jobs";
import { subscribeSavedJobIds } from "@/lib/saved";
import { isEmployerSide, type Job } from "@/lib/types";

export default function MyJobsPage() {
  return (
    <AccountGate>
      <MyJobsInner />
    </AccountGate>
  );
}

function MyJobsInner() {
  const { profile } = useAuth();
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [assigned, setAssigned] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const employerSide = isEmployerSide(profile?.role);
  const isWorker = profile?.role === "worker";

  // Postings (employer-side) or assigned work (worker).
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const unsubs: Array<() => void> = [];
    if (employerSide) {
      unsubs.push(
        subscribeMyJobs(profile.uid, (list) => {
          setMyJobs(list);
          setLoading(false);
        }),
      );
    }
    if (isWorker) {
      unsubs.push(
        subscribeMyAssignedJobs(profile.uid, (list) => {
          setAssigned(list);
          setLoading(false);
        }),
      );
    }
    if (unsubs.length === 0) setLoading(false);
    return () => unsubs.forEach((u) => u());
  }, [profile, employerSide, isWorker]);

  // Saved jobs (workers) — subscribe to IDs, then fetch each job doc.
  useEffect(() => {
    if (!profile || profile.role !== "worker") return;
    const unsub = subscribeSavedJobIds(profile.uid, async (ids) => {
      const fetched = await Promise.all(
        Array.from(ids).map((id) => getJob(id).catch(() => null)),
      );
      setSavedJobs(fetched.filter((j): j is Job => !!j));
    });
    return () => unsub();
  }, [profile]);

  // Employer buckets
  const open = myJobs.filter((j) => j.status === "open");
  const active = myJobs.filter((j) =>
    ["assigned", "in_progress", "completed", "disputed"].includes(j.status),
  );
  const done = myJobs.filter((j) => j.status === "confirmed");
  const cancelled = myJobs.filter((j) => j.status === "cancelled");
  // Worker buckets
  const wActive = assigned.filter((j) =>
    ["assigned", "in_progress", "completed"].includes(j.status),
  );
  const wDone = assigned.filter((j) => j.status === "confirmed");

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-12 max-w-4xl">
          <div className="flex items-end justify-between gap-3 mb-6 flex-wrap" data-reveal>
            <div className="min-w-0">
              <Badge tone={isWorker ? "sage" : "ochre"}>
                {isWorker ? "Your work" : "Your postings"}
              </Badge>
              <h1 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
                {isWorker ? "Jobs you're working" : "Jobs you've posted"}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                {isWorker
                  ? "Everything you've accepted, finished, or saved — in one place."
                  : "Everything you've posted, in progress, and completed — in one place."}
              </p>
            </div>
            {employerSide ? (
              <Button href="/post-a-job" variant="primary" size="sm">+ Post a job</Button>
            ) : (
              <Button href="/find-work" variant="primary" size="sm">Browse open jobs</Button>
            )}
          </div>

          {loading ? (
            <JobCardSkeletonGrid count={3} />
          ) : employerSide ? (
            <JobTabs
              tabs={[
                {
                  id: "current",
                  label: "Current",
                  jobs: [...open, ...active],
                  empty: "Nothing in progress yet",
                  emptyKind: "no-jobs",
                  emptyAction: (
                    <Button href="/post-a-job" variant="primary" size="md">+ Post a job</Button>
                  ),
                },
                {
                  id: "completed",
                  label: "Completed",
                  jobs: done,
                  empty: "No completed jobs yet",
                  emptyKind: "approved",
                },
                { id: "cancelled", label: "Cancelled", jobs: cancelled, empty: "" },
              ]}
            />
          ) : (
            <JobTabs
              tabs={[
                {
                  id: "current",
                  label: "Current",
                  jobs: wActive,
                  empty: "No work on right now",
                  emptyKind: "no-jobs",
                  emptyAction: (
                    <Button href="/find-work" variant="primary" size="md">Browse open jobs</Button>
                  ),
                },
                {
                  id: "completed",
                  label: "Completed",
                  jobs: wDone,
                  empty: "Your finished jobs land here",
                  emptyKind: "approved",
                },
                {
                  id: "saved",
                  label: "Saved",
                  jobs: savedJobs,
                  empty: "Nothing saved yet",
                  emptyKind: "no-saved",
                  emptyAction: (
                    <Button href="/find-work" variant="outline" size="md">Browse jobs</Button>
                  ),
                },
              ]}
            />
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
