import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Connect Firebase",
  description: "Step-by-step setup for the Workit Firebase project.",
};

const steps: { title: string; body: React.ReactNode }[] = [
  {
    title: "Create the Firebase project",
    body: (
      <>
        Go to{" "}
        <A href="https://console.firebase.google.com/">
          console.firebase.google.com
        </A>{" "}
        and click <b>Add project</b>. Name it <Code>workit</Code> (or whatever
        you prefer). You can disable Google Analytics if you want a faster
        setup.
      </>
    ),
  },
  {
    title: "Add a Web app",
    body: (
      <>
        On the project home page, click the <b>{`</>`}</b> (Web) icon. Give it
        a nickname like <Code>workit-web</Code>. <b>Skip</b> Firebase Hosting
        setup for now — we&apos;ll add that later. Firebase will show you a{" "}
        <Code>firebaseConfig</Code> object — keep that tab open.
      </>
    ),
  },
  {
    title: "Enable Email/Password sign-in",
    body: (
      <>
        In the Firebase console sidebar: <b>Build → Authentication → Get started</b>.
        Pick <b>Email/Password</b> under Sign-in method and toggle it on.
        Don&apos;t enable Email link sign-in for now.
      </>
    ),
  },
  {
    title: "Create Firestore",
    body: (
      <>
        Sidebar: <b>Build → Firestore Database → Create database</b>. Start in
        <b> production mode</b>. Choose region <Code>africa-south1</Code>{" "}
        (Johannesburg) so data is close to our users.
      </>
    ),
  },
  {
    title: "Create Storage",
    body: (
      <>
        Sidebar: <b>Build → Storage → Get started</b>. Production mode, same
        region as Firestore. This is where worker ID photos, selfie videos,
        and job photos will live.
      </>
    ),
  },
  {
    title: "Paste config into .env.local",
    body: (
      <>
        In the project folder, copy <Code>.env.local.example</Code> to{" "}
        <Code>.env.local</Code> and paste the values from your{" "}
        <Code>firebaseConfig</Code>. The variable names already line up.
        Restart <Code>npm run dev</Code> after saving.
      </>
    ),
  },
  {
    title: "Deploy Firestore rules",
    body: (
      <>
        The file <Code>firestore.rules</Code> in the project root locks
        Firestore down so users only read/write their own profile and admins
        can review submissions. Install the Firebase CLI{" "}
        (<Code>npm i -g firebase-tools</Code>), run{" "}
        <Code>firebase login</Code>, then{" "}
        <Code>firebase deploy --only firestore:rules</Code>. Repeat any time
        rules change.
      </>
    ),
  },
  {
    title: "Make yourself an admin",
    body: (
      <>
        Sign up via <Code>/signup</Code> as an employer. Then in the Firebase
        console open <b>Firestore → users → {`{your-uid}`}</b> and change the{" "}
        <Code>role</Code> field to <Code>admin</Code>. (Custom claims are
        coming in Phase 3 — for now Firestore role is the source of truth.)
      </>
    ),
  },
];

export default function SetupPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-3xl">
          <Badge tone="ink">Setup</Badge>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
            Connect Firebase to Workit.
          </h1>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            One-time setup. Takes about 10 minutes. After this, signup,
            sign-in, and saving user profiles will all work.
          </p>

          <ol className="mt-10 space-y-6">
            {steps.map((s, i) => (
              <li
                key={i}
                className="rounded-xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
              >
                <div className="flex items-start gap-4">
                  <span className="font-display text-3xl text-[var(--color-ochre-500)] leading-none mt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-xl">{s.title}</h3>
                    <p className="mt-2 text-[var(--color-ink-soft)] leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 rounded-xl p-6 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-sm text-[var(--color-ink-soft)]">
            <p className="font-medium text-[var(--color-ink)] mb-1">
              Need help?
            </p>
            <p>
              Stuck on any step? Email{" "}
              <A href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</A>{" "}
              with a screenshot.
            </p>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline-offset-2 underline"
    >
      {children}
    </a>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[var(--color-cream-2)] border border-[var(--color-line)] font-mono text-[0.9em] text-[var(--color-ink)]">
      {children}
    </code>
  );
}
