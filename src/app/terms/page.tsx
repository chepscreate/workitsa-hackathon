import LegalPage from "@/components/LegalPage";

export const metadata = {
  alternates: { canonical: "/terms/" },
  title: "Terms of Use",
  description: "Workit terms of use.",
};

export default function TermsPage() {
  return (
    <LegalPage badge="Legal" title="Terms of Use" updated="May 2026">
      {/* TODO: Lawyer review pending before public launch — send these Terms
          to a South African attorney for review, particularly:
            - §3.1 / §3.2 (independent contractor classification + 5-factor test)
            - §6 (worker tax obligations + SARS / UIF / COIDA references)
            - §11 (limitation of liability under the Consumer Protection Act)
            - §13 (indemnification — enforceability + scope)
          The plain-language drafting below is a starting point. Have it
          reviewed before serious launch volume so any defect doesn't compound
          across thousands of users. */}
      <div className="rounded-xl p-4 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm not-prose">
        <p className="font-medium text-[var(--color-ink)]">Plain-language draft.</p>
        <p className="text-[var(--color-ink-soft)] mt-1">
          These Terms are written in plain English so users can actually read
          them. They are pending review by a South African attorney before
          serious launch volume. They are not a substitute for legal advice.
        </p>
      </div>
      <p>
        Welcome to Workit. These terms govern how you use our marketplace. Plain
        English wherever possible — read them once, sign up with confidence.
      </p>

      <h2>1. Who runs Workit</h2>
      <p>
        Workit is operated by <b>Furthersky Solutions</b>, founded by Tshepo M.
        Questions: <a href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</a>.
      </p>

      <h2>2. Who can use Workit</h2>
      <ul>
        <li>You must be 18 years of age or older.</li>
        <li>You must provide a real name, a real email, and (for workers) a valid SA ID.</li>
        <li>You must not impersonate anyone or create fake accounts.</li>
      </ul>

      <h2>3. What Workit is — and is not</h2>
      <p>
        Workit is a marketplace that connects people who need work done
        (&quot;employers&quot;) with people willing to do work
        (&quot;workers&quot;). <b>Workit is not the employer of any worker on
        the platform.</b> Workit does not guarantee any specific job, payment,
        or outcome.
      </p>

      <h3>3.1 Worker = independent contractor</h3>
      <p>
        Every worker on Workit acts as an <b>independent contractor</b> in
        relation to the employer who hires them on any given job. There is no
        employment relationship between Workit and the worker, and no
        employment relationship between the employer and the worker beyond the
        scope of that single job, unless the parties agree to one in writing
        outside Workit. Specifically:
      </p>
      <ul>
        <li>
          The worker decides whether to accept, decline or counter-offer any
          job. Workit does not assign jobs to workers.
        </li>
        <li>
          The worker controls when, how and with what skill the work is
          performed, subject only to the description of the job they
          accepted.
        </li>
        <li>
          The worker is not entitled to leave, retirement contributions,
          medical aid, severance, notice periods, or any other benefit of
          employment under the Basic Conditions of Employment Act or the
          Labour Relations Act, from either Workit or the employer.
        </li>
        <li>
          The worker may work for, and accept jobs from, any number of
          employers including direct competitors. Workit does not require
          exclusivity.
        </li>
        <li>
          The worker is responsible for their own tools, transport, and
          supplies unless the job description says otherwise.
        </li>
      </ul>

      <h3>3.2 No employment</h3>
      <p>
        Neither party may claim that the relationship created via Workit is
        one of employer / employee, master / servant, principal / agent,
        franchisor / franchisee, partnership, or joint venture. The intention
        of all parties using Workit is solely to enter into a series of
        discrete, independent service contracts on a job-by-job basis.
      </p>

      <h3>3.3 Domestic worker exception</h3>
      <p>
        If you (as an employer) hire a worker on a recurring basis (for
        example, the same person every week to clean your house), the
        relationship between you and that worker may, depending on the
        circumstances, constitute employment under South African law,
        regardless of what these Terms say. In that case the employer is
        responsible for registering the worker with UIF, complying with the
        Basic Conditions of Employment Act, and meeting other employer
        obligations. Workit cannot police this and is not party to that
        ongoing relationship — it sits between you and the worker.
      </p>

      <h2>4. Your account</h2>
      <ul>
        <li>You are responsible for keeping your password secure.</li>
        <li>You are responsible for everything done from your account.</li>
        <li>New accounts are reviewed and approved by a real person at Workit before they can post jobs or send offers.</li>
        <li>We may suspend or terminate accounts that violate these terms, behave unsafely, or harm other users.</li>
      </ul>

      <h2>5. Posting jobs (employers)</h2>
      <ul>
        <li>Be honest about the work, location, and price.</li>
        <li>Pay the agreed price on completion. Cash is the current default.</li>
        <li>You are responsible for the safety of any worker you bring onto your property.</li>
        <li>You may not post jobs that are illegal, unsafe, sexual, exploitative, or harmful.</li>
      </ul>

      <h2>6. Accepting work (workers)</h2>
      <ul>
        <li>Only accept jobs you can actually do, at the agreed price.</li>
        <li>Arrive on time. If you can&apos;t make it, message the employer immediately.</li>
        <li>Bring required tools unless agreed otherwise.</li>
      </ul>

      <h3>6.1 Your tax obligations</h3>
      <p>
        You earn money from Workit jobs as an independent contractor, not as
        an employee. <b>You are personally responsible</b> for:
      </p>
      <ul>
        <li>
          Declaring all earnings to the South African Revenue Service (SARS)
          on your annual tax return. Workit does not deduct PAYE.
        </li>
        <li>
          Registering as a provisional taxpayer with SARS if your earnings
          from Workit (or from any source outside formal employment) exceed
          the threshold set by SARS in any tax year.
        </li>
        <li>
          Registering for VAT if your total taxable supplies in any 12-month
          period exceed R1 million.
        </li>
        <li>
          Keeping your own records of jobs done, dates, and payments
          received. Workit&apos;s in-app history is a convenience, not an
          official tax record.
        </li>
      </ul>
      <p>
        If you are unsure about your tax position you should speak to a
        registered tax practitioner. Workit cannot advise you on tax.
      </p>

      <h3>6.2 No UIF, COIDA, or workplace cover</h3>
      <p>
        Because you are an independent contractor and not an employee:
      </p>
      <ul>
        <li>
          You are not registered with the Unemployment Insurance Fund (UIF)
          through Workit. UIF claims are not available against Workit if
          your earnings stop.
        </li>
        <li>
          You are not covered by the Compensation for Occupational Injuries
          and Diseases Act (COIDA) for injuries sustained on a Workit job.
          You should consider personal accident insurance. The employer who
          hired you may have public liability cover that responds to an
          injury on their premises, but this is between you and them.
        </li>
        <li>
          You are not entitled to sick leave, family responsibility leave,
          annual leave, or notice pay from Workit or any employer who hires
          you for a single job.
        </li>
      </ul>

      <h2>7. Ratings and reviews</h2>
      <p>
        Both sides rate every completed job. Reviews must be honest and based
        on first-hand experience. Fake, retaliatory or off-topic reviews may be
        removed.
      </p>

      <h2>8. Fees</h2>
      <p>
        During the launch period Workit is free for both employers and workers.
        Once we introduce a platform fee, we&apos;ll notify all users at least
        30 days in advance.
      </p>

      <h2>9. Safety and disputes</h2>
      <ul>
        <li>Every active job has an in-app SAPS emergency button.</li>
        <li>Either party can raise a dispute. The job freezes; Workit reviews and decides.</li>
        <li>For genuine emergencies always call SAPS 10111 first, then report in-app.</li>
      </ul>

      <h2>10. Content you upload</h2>
      <p>
        You keep ownership of photos, videos and text you upload. You grant
        Workit a non-exclusive licence to display them on the platform for the
        purpose of running the marketplace.
      </p>

      <h2>11. Liability</h2>
      <p>
        Workit is provided &quot;as is.&quot; To the maximum extent permitted
        by South African law, Workit and Furthersky Solutions are not liable
        for damages arising from your use of the platform, including
        interactions with other users. This does not limit any rights you have
        under the Consumer Protection Act.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify Workit and Furthersky Solutions against any
        claim, loss, damage, fine, or legal cost brought by a third party
        (including another user, an employee or family member of another user,
        SARS, or any regulator) that arises from:
      </p>
      <ul>
        <li>
          Your breach of these Terms, the{" "}
          <a href="/acceptable-use">Acceptable Use Policy</a>, or any law.
        </li>
        <li>
          The work you did or failed to do on a job, including damage to
          property, injury to people, or unpaid tax.
        </li>
        <li>
          Anything you posted, uploaded, said in chat, or otherwise shared on
          the platform.
        </li>
        <li>
          Misrepresentation of your identity, qualifications, verification
          documents, or background.
        </li>
      </ul>
      <p>
        This means if Workit is sued because of something you did, you cover
        the costs. This clause survives the termination of your account.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Material changes will be
        announced in-app. Continued use after a change means you accept the new
        terms.
      </p>

      <h2>14. Governing law</h2>
      <p>
        These terms are governed by the laws of the Republic of South Africa.
        Disputes are subject to the jurisdiction of South African courts.
      </p>
    </LegalPage>
  );
}
