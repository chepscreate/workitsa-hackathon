import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata = {
  alternates: { canonical: "/acceptable-use/" },
  title: "Acceptable use policy — Workit",
  description:
    "What you can and cannot post on Workit. Plain-language list with examples — what gets you banned and why.",
};

export default function AcceptableUsePage() {
  return (
    <LegalPage badge="Acceptable use" title="Acceptable use policy" updated="May 2026">
      <p>
        Workit is built on trust. The rules below exist to keep both sides safe
        and the platform usable. Break them and your account is suspended or
        banned, no warning — depending on what you did, we may also report you
        to the South African Police Service.
      </p>

      <p>
        This page is plain language. The full legal version is in our{" "}
        <Link href="/terms">Terms</Link>.
      </p>

      <h2>Posting jobs — what&apos;s not allowed</h2>
      <ul>
        <li>
          <b>Drugs.</b> Anything involving the sale, delivery, or collection of
          drugs — including dagga (cannabis), mandrax, nyaope, tik, ecstasy,
          cocaine, heroin, or unprescribed prescription medication.
        </li>
        <li>
          <b>Weapons.</b> Selling, transporting, or modifying firearms, knives
          for use as weapons, ammunition, or explosives.
        </li>
        <li>
          <b>Stolen goods.</b> Moving, storing, fencing, or "no questions asked"
          jobs involving items you don&apos;t own. If it sounds dodgy, it is.
        </li>
        <li>
          <b>Sexual services.</b> Escorting, sex work, "companionship" arrangements
          with sexual intent, or massage with sexual content. Legitimate therapeutic
          massage requires uploading your therapist registration.
        </li>
        <li>
          <b>Counterfeit documents.</b> Fake IDs, fraudulent CVs, forged
          certificates, false references.
        </li>
        <li>
          <b>Debt collection by threat.</b> Hiring someone to threaten, intimidate,
          or harm anyone. Legitimate legal debt collection is fine.
        </li>
        <li>
          <b>Money mule work.</b> "Receive and forward" cash, package, or
          cryptocurrency arrangements. This is fraud and you will be reported.
        </li>
        <li>
          <b>Pay-to-apply schemes.</b> Asking workers to pay a fee, "buy
          supplies", or share banking details to "qualify" for a job. Workit
          jobs are free to apply for. Always.
        </li>
        <li>
          <b>Pyramid schemes / MLM recruiting.</b> "Sign up 5 more people and
          earn passive income" is not a job.
        </li>
      </ul>

      <h2>Worker profiles — what&apos;s not allowed</h2>
      <ul>
        <li>
          Listing services you can&apos;t legally provide (medical, legal, or
          professional services without registration).
        </li>
        <li>
          Faking your verification — using someone else&apos;s ID, lying about
          qualifications, or staging selfie videos.
        </li>
        <li>
          Soliciting sexual services or work from employers.
        </li>
        <li>
          Asking employers to contact you outside Workit before the job is
          agreed (so you can avoid ratings + the dispute system).
        </li>
      </ul>

      <h2>Photos + videos</h2>
      <ul>
        <li>
          No sexual, violent, or graphic content of any kind.
        </li>
        <li>
          No photos of children, identifying information of others, or stolen
          property.
        </li>
        <li>
          Showcase photos must be your own work. Stock images / lifted Instagram
          posts get your profile suspended.
        </li>
      </ul>

      <h2>Messages</h2>
      <ul>
        <li>
          No threats, harassment, racism, slurs, or hate speech against anyone.
        </li>
        <li>
          No asking for banking details, passwords, or OTPs. Workit will never
          do this and neither should anyone you meet through the app.
        </li>
        <li>
          No solicitation for sexual content or relationships from someone who
          hired you or you hired.
        </li>
      </ul>

      <h2>Zero-tolerance — immediate ban and SAPS report</h2>
      <p>
        These are non-negotiable. We don&apos;t warn, we don&apos;t debate, we
        report:
      </p>
      <ul>
        <li>
          Any sexual content involving a child, or any attempt to make contact
          with a child for sexual purposes (CSAM / grooming).
        </li>
        <li>Threats of violence against an identifiable person.</li>
        <li>Human trafficking, forced labour, or domestic-worker abuse.</li>
        <li>Posting another person&apos;s ID, banking details, or address
          without consent.</li>
      </ul>

      <h2>How we enforce this</h2>
      <ul>
        <li>
          Photos uploaded to Workit are automatically scanned for adult, violent,
          or graphic content. Flagged content is removed and your account is
          reviewed.
        </li>
        <li>
          Job titles, descriptions, and profile text are scanned for the
          categories above. High-confidence matches block the post; medium
          matches send it to admin review before it goes live.
        </li>
        <li>
          Every job, profile, and message has a <b>Report</b> button. We review
          reports between 06:00 and 22:00 SAST. Serious reports we escalate
          immediately.
        </li>
        <li>
          Brand-new accounts have their first job and first offer reviewed by a
          human before going live. After 1–2 successful jobs the review goes away.
        </li>
        <li>
          Banning is logged in the admin audit log; everything is retained for
          7 years per POPIA in case of investigation.
        </li>
      </ul>

      <h2>If you see something — report it</h2>
      <p>
        Tap the <b>Report</b> button on the job, profile, or message. Give us a
        reason and any detail. Reporters stay anonymous to the reported party.
      </p>
      <p>
        For anything that involves immediate danger, call <b>SAPS 10111</b>{" "}
        first — the in-app Emergency button on every active job does this in
        one tap. Then email us at{" "}
        <a href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</a> with
        the job ID.
      </p>

      <h2>Appeals</h2>
      <p>
        If you think we got it wrong, email{" "}
        <a href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</a> with
        your UID and a clear explanation. We re-review within 7 working days.
        Zero-tolerance bans are not appealable.
      </p>

      <p>
        This policy may evolve as we learn what bad actors try. We&apos;ll post
        material changes here and on the home page when they happen.
      </p>
    </LegalPage>
  );
}
