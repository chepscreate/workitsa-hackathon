import LegalPage from "@/components/LegalPage";

export const metadata = {
  alternates: { canonical: "/privacy/" },
  title: "Privacy Policy",
  description: "How Workit handles your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage badge="Privacy" title="Privacy Policy" updated="May 2026">
      <p>
        Plain-language summary of what we collect, why we collect it, and what
        we do with it. We follow the Protection of Personal Information Act
        (POPIA).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Account details:</b> name, email address, phone number, date of
          birth, password (hashed by Firebase, we never see it).
        </li>
        <li>
          <b>Profile content:</b> profile photo, bio, suburb, home location pin
          (when you choose to share it), preferred work categories.
        </li>
        <li>
          <b>Worker verification:</b> SA ID number, ID photo, short selfie video,
          proof of address, skills summary, past-work photos. Only reviewable by
          Workit&apos;s admin team.
        </li>
        <li>
          <b>Job activity:</b> jobs you post, offers you send/receive, messages
          you exchange, ratings, disputes.
        </li>
        <li>
          <b>Live location (workers only, opt-in):</b> while a job is active you
          may share your GPS with the employer. You can stop at any time.
        </li>
        <li>
          <b>Technical:</b> device type, browser, IP address, basic analytics on
          which pages you visit.
        </li>
      </ul>

      <h2>Why we collect it</h2>
      <ul>
        <li><b>To run the marketplace:</b> match employers to nearby workers, show ratings, route notifications.</li>
        <li><b>To keep the platform safe:</b> verify identity, review disputes, prevent fraud.</li>
        <li><b>To improve the product:</b> understand what works and what doesn&apos;t.</li>
        <li><b>To contact you:</b> service messages, security alerts, the occasional product update.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li><b>Your public profile:</b> display name, photo, suburb, average rating, reputation badges — visible to other Workit users.</li>
        <li><b>Your verification documents (ID, selfie, address proof):</b> only you and Workit admins. Never shown to other users.</li>
        <li><b>Your messages on a job:</b> only you and the other party. Admins may read them if a dispute is raised.</li>
        <li><b>Your live location:</b> only the assigned employer, only while you&apos;re actively sharing.</li>
      </ul>

      <h2>Where your data lives</h2>
      <p>
        Workit uses Google Firebase. Your data is stored in the
        <b> africa-south1</b> region (Johannesburg) where possible. Some
        infrastructure (authentication, payments) may pass through Google&apos;s
        global servers under their security agreements with EU and US data
        protection regimes.
      </p>

      <h2>How long we keep your data</h2>
      <ul>
        <li>Account profile: until you delete your account.</li>
        <li>Verification documents: kept for the lifetime of the account, then deleted within 30 days of account deletion.</li>
        <li>Job and message history: kept for 5 years to support dispute resolution and legal record-keeping.</li>
        <li>Anonymous analytics: kept indefinitely.</li>
      </ul>

      <h2>Your rights (POPIA section 23–25)</h2>
      <ul>
        <li>Ask what data we hold about you.</li>
        <li>Correct anything that&apos;s wrong.</li>
        <li>Delete your account and personal information.</li>
        <li>Object to processing or withdraw consent.</li>
        <li>Lodge a complaint with the Information Regulator if you&apos;re unhappy with how we handle your data.</li>
      </ul>
      <p>
        For any of the above, email{" "}
        <a href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</a>.
        We&apos;ll respond within 7 working days.
      </p>

      <h2>Cookies and similar tech</h2>
      <p>
        We use a small number of strictly-necessary cookies for sign-in. With
        your consent (the cookie banner), we also use Google Analytics for
        Firebase to collect anonymous usage statistics — which screens are
        used and where people get stuck — so we can improve the app. If you
        decline, analytics stays off. We do not use third-party advertising
        cookies. Browser notifications and location services only run when you
        explicitly opt in.
      </p>

      <h2>Children</h2>
      <p>
        Workit is for adults (18+). We do not knowingly collect data from
        children. If you believe a child has signed up, please email us.
      </p>

      <h2>Changes</h2>
      <p>
        If we materially change how we handle your data, we&apos;ll notify you
        in-app at least 14 days before the change takes effect.
      </p>

      <h2>Information Officer</h2>
      <p>
        Tshepo M (Furthersky Solutions),{" "}
        <a href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</a>.
      </p>
    </LegalPage>
  );
}
