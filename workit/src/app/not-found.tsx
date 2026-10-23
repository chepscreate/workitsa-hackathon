import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-24 max-w-xl text-center">
          <Badge tone="ochre">404</Badge>
          <h1 className="mt-5 font-display text-5xl sm:text-6xl tracking-tight">
            Hayikhona — this page isn&apos;t here.
          </h1>
          <p className="mt-4 text-[var(--color-ink-soft)]">
            The link might be old, mistyped, or the job may have closed. Try
            one of these instead:
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button href="/" variant="primary" size="lg">
              Workit home
            </Button>
            <Button href="/find-work" variant="outline" size="lg">
              Browse open jobs
            </Button>
          </div>
          <p className="mt-10 text-xs text-[var(--color-ink-muted)]">
            Stuck?{" "}
            <Link href="/help" className="underline">
              Get help
            </Link>{" "}
            or email{" "}
            <a href="mailto:tshepowayne@workitsa.co.za" className="underline">
              tshepowayne@workitsa.co.za
            </a>
            .
          </p>
        </Container>
      </main>
      <Footer />
    </>
  );
}
