import LegalPage from "@/components/LegalPage";
import WhatsAppSupport from "@/components/WhatsAppSupport";

export const metadata = {
  alternates: { canonical: "/help/" },
  title: "Help & support",
  description: "Get help using Workit.",
};

export default function HelpPage() {
  return (
    <LegalPage badge="Help" title="Need a hand?" updated="May 2026">
      <p>
        Workit is small enough that you reach a real person. The quickest way
        to get help is WhatsApp or email — we read everything personally during
        launch.
      </p>

      {/* not-prose: keep the pill button from inheriting the article link styles */}
      <div className="not-prose my-6">
        <WhatsAppSupport />
      </div>

      <h2>Reach us</h2>
      <ul>
        <li>
          <b>WhatsApp:</b> tap the green button above — we&apos;ll reply as soon
          as we can, and you&apos;ll get an instant confirmation that your
          message came through.
        </li>
        <li>
          <b>Email:</b>{" "}
          <a href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</a>{" "}
          — usually replied to within 24 hours.
        </li>
        <li>
          <b>Emergency on a job:</b> tap the red <b>SOS</b> button in the app.
          It dials SAPS 10111 and logs the alert for our team.
        </li>
      </ul>

      <h2>Common questions</h2>

      <h3>How long does account approval take?</h3>
      <p>
        Usually 1–2 working days during launch. We review every account by hand
        — that&apos;s the whole point of the trust layer. Make sure you&apos;ve
        completed your profile and (workers) submitted your verification docs.
      </p>

      <h3>I uploaded my ID but my status still says &quot;none.&quot;</h3>
      <p>
        Refresh the page once. If it still shows as not started, email us with
        your account email and we&apos;ll look at the queue manually.
      </p>

      <h3>I forgot my password.</h3>
      <p>
        Use the &quot;Forgot password?&quot; link on the sign-in page. You&apos;ll
        get a reset email within a minute. Check spam.
      </p>

      <h3>The worker / employer didn&apos;t show up.</h3>
      <p>
        On the job page, tap <b>&quot;Report a problem&quot;</b> and pick the
        <i> No-show</i> reason. The job freezes and a Workit admin reviews
        within 24 hours.
      </p>

      <h3>How does pricing work?</h3>
      <p>
        The employer suggests a price when posting. Workers can accept the
        price or send a counter-offer. Once both agree and the job is done,
        cash is paid in person. Workit is free to use during launch.
      </p>

      <h3>Is Workit available outside Gauteng?</h3>
      <p>
        Not yet. We&apos;re proving the model in Gauteng first, then opening
        province by province. Sign up anyway — we&apos;ll let you know when
        Workit opens in your area.
      </p>

      <h3>Can I delete my account?</h3>
      <p>
        Yes. Email us from the address on your account asking for deletion.
        We&apos;ll confirm and remove your profile and verification documents
        within 30 days, in line with our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Found a bug?</h2>
      <p>
        Email us with the page, what you were doing, and (if possible) a
        screenshot. Bug reports help everyone — thank you in advance.
      </p>
    </LegalPage>
  );
}
