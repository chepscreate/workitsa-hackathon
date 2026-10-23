import Header from "./Header";
import Footer from "./Footer";
import Container from "./Container";
import PageHero from "./PageHero";

/**
 * Shared layout for plain-language legal / info pages.
 * Children are normal HTML / Markdown-shaped React content.
 */
export default function LegalPage({
  badge,
  title,
  updated,
  children,
}: {
  badge: string;
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-3xl">
          <PageHero
            eyebrow={badge}
            eyebrowTone="ink"
            title={title}
            meta={updated ? `Last updated · ${updated}` : undefined}
          />
          <article className="mt-8 prose prose-stone max-w-none text-[var(--color-ink-soft)] leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-[var(--color-ink)] [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-lg [&_h3]:text-[var(--color-ink)] [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:ml-6 [&_li]:mt-1 [&_a]:text-[var(--color-ochre-600)] [&_a]:underline">
            {children}
          </article>
        </Container>
      </main>
      <Footer />
    </>
  );
}
