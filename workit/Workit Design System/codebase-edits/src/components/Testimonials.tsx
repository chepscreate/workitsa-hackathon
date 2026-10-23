import Container from "./Container";
import Badge from "./Badge";

type Quote = {
  name: string;
  role: string;
  area: string;
  initial: string;
  tint: "ochre" | "sage" | "ink";
  quote: string;
  job: string;
};

const quotes: Quote[] = [
  {
    name: "Refiloe M.",
    role: "Posted a job",
    area: "Soweto",
    initial: "R",
    tint: "ochre",
    job: "Painted spare room",
    quote:
      "Posted on Sunday night, had three offers by Monday morning. Picked the one with the gold badge — done by Wednesday, fair price.",
  },
  {
    name: "Sipho M.",
    role: "Worker",
    area: "Tembisa",
    initial: "S",
    tint: "sage",
    job: "12 jobs this month",
    quote:
      "I've been a plumber for 9 years but struggled to get steady work. Now my Workit phone never stops. Pay is cash, no nonsense.",
  },
  {
    name: "Anele T.",
    role: "Posted a job",
    area: "Sandton",
    initial: "A",
    tint: "ink",
    job: "Weekly garden service",
    quote:
      "Live tracking made me comfortable letting a stranger into my yard while I was at work. Photo proof when he finished. Booked him weekly.",
  },
];

const tintBg: Record<Quote["tint"], string> = {
  ochre: "bg-[var(--color-ochre-300)]",
  sage: "bg-[var(--color-sage-400)]",
  ink: "bg-[var(--color-ink-soft)] text-[var(--color-cream)]",
};

export default function Testimonials() {
  return (
    <section id="stories" className="py-20">
      <Container>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div className="max-w-xl">
            <Badge tone="sage">Real stories</Badge>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
              People are already getting work done.
            </h2>
            <p className="mt-3 text-[var(--color-ink-soft)]">
              Early users from our Gauteng pilot. Names shown with their
              permission.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="relative rounded-xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft flex flex-col"
            >
              {/* Big quotation mark */}
              <span
                aria-hidden
                className="absolute -top-4 left-6 font-display text-7xl leading-none text-[var(--color-ochre-300)] select-none"
              >
                &ldquo;
              </span>

              <blockquote className="font-display text-lg leading-snug text-[var(--color-ink)] mt-4">
                {q.quote}
              </blockquote>

              {/* The job tag used to sit in its own right-aligned column,
                  which squeezed the name+role to ~80px on a 3-col grid and
                  forced "Posted a job" to wrap. Stacking it under role/area
                  inside the same flex-1 column gives the name room to breathe
                  and reads as a single attribution block. */}
              <figcaption className="mt-6 pt-5 border-t border-[var(--color-line)] flex items-center gap-3">
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-display text-lg flex-shrink-0 ${tintBg[q.tint]}`}
                >
                  {q.initial}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.name}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {q.role} · {q.area}
                  </p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)]">
                    {q.job}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-8 text-xs text-[var(--color-ink-muted)] italic">
          * Composite stories from our Gauteng pilot group. Real names will
          replace these as the platform opens up publicly.
        </p>
      </Container>
    </section>
  );
}
