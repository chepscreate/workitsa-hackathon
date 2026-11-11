"use client";

import { useEffect, useRef, useState } from "react";
import { sendMessage, subscribeMessages } from "@/lib/jobs";
import { uploadFile } from "@/lib/storage";
import type { ChatMessage, UserProfile } from "@/lib/types";
import Avatar from "./Avatar";
import ReportButton from "./ReportButton";

const QUICK_REPLIES = [
  "I'm on my way",
  "Running 10 min late",
  "I'm here",
  "All done — please come check",
  "Thanks!",
  "Can you share more details?",
];

export default function JobMessages({
  jobId,
  me,
  otherName,
}: {
  jobId: string;
  me: UserProfile;
  otherName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeMessages(jobId, setMessages);
    return () => unsub();
  }, [jobId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await sendMessage({ jobId, sender: me, text });
      setText("");
    } finally {
      setSending(false);
    }
  };

  const onPickImage = () => fileRef.current?.click();

  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { promise } = uploadFile("job", jobId, file);
      const url = await promise;
      // Send an image message (with any text the user already typed as caption).
      await sendMessage({ jobId, sender: me, text, imageURL: url });
      setText("");
    } catch {
      /* swallow — upload errors are rare; the user can retry */
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl">Messages</h2>
          <span className="text-xs text-[var(--color-ink-muted)]">with {otherName}</span>
        </div>
        <ReportButton
          targetType="message"
          targetId={jobId}
          targetParentId={jobId}
          label="Report this conversation"
          size="xs"
        />
      </div>
      <div
        ref={scrollRef}
        className="px-4 py-4 max-h-[400px] overflow-y-auto space-y-3 bg-[var(--color-cream-2)]/40"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)] text-center py-8">
            No messages yet — tap a quick reply below to break the ice.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === me.uid;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
              >
                {!mine && (
                  <Avatar name={m.senderName} photoURL={m.senderPhotoURL} size="xs" />
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    mine
                      ? "bg-[var(--color-ochre-500)] text-[var(--color-cream)] rounded-br-sm"
                      : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink)] rounded-bl-sm"
                  }`}
                >
                  {m.imageURL && (
                    <a href={m.imageURL} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageURL}
                        alt="Shared in chat"
                        loading="lazy"
                        className="rounded-lg max-h-56 w-auto mb-1.5 border border-black/10"
                      />
                    </a>
                  )}
                  {m.text && (
                    <p className="text-sm whitespace-pre-wrap break-words leading-snug">
                      {m.text}
                    </p>
                  )}
                  <p
                    className={`mt-1 text-[10px] ${
                      mine
                        ? "text-[var(--color-cream)]/70"
                        : "text-[var(--color-ink-muted)]"
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {mine && <Avatar name={me.displayName} photoURL={me.photoURL} size="xs" />}
              </div>
            );
          })
        )}
      </div>
      {/* Quick reply chips — context-appropriate canned messages */}
      <div className="px-3 pt-2 border-t border-[var(--color-line)] flex flex-wrap gap-1.5 bg-[var(--color-cream-2)]/40">
        {QUICK_REPLIES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setText(r)}
            className="text-xs px-3 py-1.5 rounded-pill bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:border-[var(--color-ochre-300)] transition-colors"
          >
            {r}
          </button>
        ))}
      </div>
      <form onSubmit={onSend} className="p-3 border-t border-[var(--color-line)] flex gap-2 items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onImageChosen}
        />
        <button
          type="button"
          onClick={onPickImage}
          disabled={uploading}
          aria-label="Attach a photo"
          title="Attach a photo"
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:border-[var(--color-ochre-300)] disabled:opacity-40"
        >
          {uploading ? (
            <span className="w-4 h-4 rounded-full border-2 border-[var(--color-ochre-500)] border-t-transparent animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={uploading ? "Uploading photo…" : "Type a message…"}
          className="flex-1 px-4 py-2.5 rounded-pill bg-[var(--color-cream-2)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none text-sm"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-5 py-2.5 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
