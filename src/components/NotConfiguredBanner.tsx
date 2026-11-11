import Link from "next/link";

export default function NotConfiguredBanner() {
  return (
    <div className="rounded-lg border border-[var(--color-ochre-300)] bg-[var(--color-ochre-50)] p-4 text-sm text-[var(--color-ink-soft)]">
      <p className="font-medium text-[var(--color-ink)] mb-1">
        Firebase isn&apos;t connected yet.
      </p>
      <p>
        To enable signup and sign-in, create a Firebase project and add its
        config to <code className="font-mono">.env.local</code>. See{" "}
        <Link
          href="/setup"
          className="underline decoration-[var(--color-ochre-500)] underline-offset-2 hover:text-[var(--color-ink)]"
        >
          /setup
        </Link>{" "}
        for step-by-step instructions.
      </p>
    </div>
  );
}
