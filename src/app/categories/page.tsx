import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/types";

export const metadata = {
  alternates: { canonical: "/categories/" },
  title: "Browse categories — Workit",
  description:
    "Every kind of job Workit covers, from gardening and plumbing to tutoring and event work. Tap a category to jump into the worker feed.",
};

const HINTS: Record<string, string> = {
  "home-garden":
    "The everyday stuff that keeps a home livable — lawns, cleaning, pool care, pest control.",
  trades:
    "Skilled work you'd normally call out a contractor for — plumbing, sparkies, painters, tilers.",
  "moving-errands":
    "Hands and wheels — bakkie hires, moving help, deliveries, queue-standing at Home Affairs.",
  personal:
    "The small jobs that free up your weekend — car wash, ironing, pet walking, errands.",
  "beauty-wellness":
    "Mobile beauty pros who come to you — hair, nails, makeup, barber, massage.",
  "events-catering":
    "Staff for the day — bartenders, servers, chefs, photographers, DJs, cleanup crews.",
  "driving-delivery":
    "Drivers and couriers with their own vehicle — airport runs, food drops, removals.",
  "tutoring-education":
    "School subject tutors, music and swimming teachers, matric exam prep.",
  care:
    "Trusted people to look after the people who matter — babysitters, nannies, elderly care.",
  "construction-labour":
    "On-site labour — general hands, bricklayers, plasterers, demolition, scaffolders.",
  "tech-digital":
    "Help with the digital side — phone repair, wifi setup, social media, websites, admin.",
};

export default function CategoriesPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14">
          <PageHero
            eyebrow="Categories"
            eyebrowTone="ochre"
            title="Every kind of job Workit covers."
            intro="We've grouped the most common South African gig and odd-job categories below. Tap any heading to jump into the worker feed filtered to that category, or scan the tags underneath to see the specific kinds of work each one includes."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-2" data-reveal-group>
            {CATEGORIES.map((cat) => {
              const subs = SUBCATEGORIES[cat.id] ?? [];
              return (
                <section
                  key={cat.id}
                  className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h2 className="font-display text-2xl text-[var(--color-ink)]">
                      {cat.label}
                    </h2>
                    <Link
                      href={`/find-work?category=${cat.id}`}
                      className="text-xs font-medium text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] whitespace-nowrap"
                    >
                      Browse open jobs →
                    </Link>
                  </div>
                  {HINTS[cat.id] && (
                    <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                      {HINTS[cat.id]}
                    </p>
                  )}
                  {subs.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {subs.map((s) => (
                        <span
                          key={s.id}
                          className="px-3 py-1 rounded-pill text-xs bg-[var(--color-cream-2)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                        >
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="mt-14 rounded-2xl p-7 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)]">
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              Don&apos;t see your category?
            </h2>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              Workit is built for honest work of any kind. If your skill or job
              type isn&apos;t listed, pick the closest category and describe it
              in the title — the description is what workers read first. We add
              new categories regularly based on what gets posted.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/post-a-job"
                className="px-5 py-2.5 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:opacity-90"
              >
                Post a job
              </Link>
              <Link
                href="/find-work"
                className="px-5 py-2.5 rounded-pill border border-[var(--color-ink)]/20 text-[var(--color-ink)] text-sm font-medium hover:bg-white/40"
              >
                Browse open jobs
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
