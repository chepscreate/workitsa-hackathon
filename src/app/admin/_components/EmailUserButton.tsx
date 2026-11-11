"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "@/lib/firebase";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";

/**
 * Per-user email compose for the admin review cards — chases people who
 * signed up but never submitted their verification documents. Opens with an
 * editable template; sends via the adminEmailUser callable, which delivers
 * FROM tshepowayne@workitsa.co.za (SendGrid) and audit-logs the send.
 */

const template = (firstName: string) => ({
  subject: "Your Workit account is one step away — upload your documents",
  body: `Hi ${firstName},

Thanks for joining Workit! Your account is created, but it's still waiting on your verification documents — a clear photo of your SA ID and a short selfie video.

Upload them here: https://workitsa.co.za/verification
It takes about 5 minutes, and I review every submission personally — usually the same day.

Remember: Workit is completely free. You never pay to join or apply for work.

Stuck or have a question? Just reply to this email — it comes straight to me.

Tshepo
Founder, Workit · workitsa.co.za`,
});

export default function EmailUserButton({
  uid,
  displayName,
}: {
  uid: string;
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onOpen = () => {
    const t = template(displayName?.split(" ")[0] ?? "there");
    setSubject(t.subject);
    setBody(t.body);
    setError(null);
    setOpen(true);
  };

  const onSend = async () => {
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<
        { toUid: string; subject: string; body: string },
        { ok: boolean; to: string }
      >(getFunctionsInstance(), "adminEmailUser");
      const res = await fn({ toUid: uid, subject, body });
      setSentTo(res.data.to);
      setOpen(false);
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Could not send.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <p className="text-xs text-[var(--color-sage-700)]">
        ✓ Email sent to {sentTo} (from tshepowayne@workitsa.co.za)
      </p>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={onOpen}>
        ✉ Email docs reminder
      </Button>
    );
  }

  return (
    <div className="w-full mt-2 rounded-xl border border-[var(--color-ochre-300)] bg-[var(--color-ochre-50)] p-4 space-y-3">
      <p className="text-xs text-[var(--color-ink-muted)]">
        Sends from <b className="text-[var(--color-ink)]">tshepowayne@workitsa.co.za</b> —
        replies come back to that inbox, and a copy is BCC&apos;d there too (it
        arrives in the <b className="text-[var(--color-ink)]">Inbox</b>, not Sent —
        delivery goes via SendGrid, not Outlook). Edit freely before sending.
      </p>
      <Input
        label="Subject"
        name={`email-subject-${uid}`}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
      />
      <Textarea
        label="Message"
        name={`email-body-${uid}`}
        rows={9}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={onSend} loading={busy} loadingText="Sending…">
          Send email
        </Button>
      </div>
    </div>
  );
}
