"use client";

import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { useTranslation } from "@/contexts/LocaleContext";

/**
 * Safety guide body. Client component so every string flows through
 * useTranslation(); the server page.tsx keeps the SEO metadata and renders this.
 * Long-form prose is translated per block; the specific emergency numbers and
 * key links are preserved as real <a>/<Link> elements.
 */
export default function SafetyContent() {
  const { t } = useTranslation();
  return (
    <LegalPage badge={t("safety.badge")} title={t("safety.title")} updated="May 2026">
      <p>{t("safety.intro")}</p>

      <h2>{t("safety.tools.h2")}</h2>

      <h3>{t("safety.t1.h3")}</h3>
      <p>{t("safety.t1.p")}</p>
      <p>{t("safety.t1.emp")}</p>
      <p>
        <Link href="/verification">{t("safety.t1.link")}</Link>
      </p>

      <h3>{t("safety.t2.h3")}</h3>
      <p>{t("safety.t2.p")}</p>

      <h3>{t("safety.t3.h3")}</h3>
      <p>{t("safety.t3.p")}</p>

      <h3>{t("safety.t4.h3")}</h3>
      <p>{t("safety.t4.p")}</p>

      <h3>{t("safety.t5.h3")}</h3>
      <p>{t("safety.t5.p")}</p>

      <h3>{t("safety.t6.h3")}</h3>
      <p>{t("safety.t6.p")}</p>

      <h3>{t("safety.t7.h3")}</h3>
      <p>{t("safety.t7.p")}</p>

      <h2>{t("safety.emp.h2")}</h2>

      <h3>{t("safety.emp.before.h3")}</h3>
      <ul>
        <li>{t("safety.emp.before.li1")}</li>
        <li>{t("safety.emp.before.li2")}</li>
        <li>{t("safety.emp.before.li3")}</li>
      </ul>

      <h3>{t("safety.emp.day.h3")}</h3>
      <ul>
        <li>{t("safety.emp.day.li1")}</li>
        <li>{t("safety.emp.day.li2")}</li>
        <li>{t("safety.emp.day.li3")}</li>
        <li>{t("safety.emp.day.li4")}</li>
      </ul>

      <h3>{t("safety.emp.after.h3")}</h3>
      <ul>
        <li>{t("safety.emp.after.li1")}</li>
        <li>{t("safety.emp.after.li2")}</li>
        <li>{t("safety.emp.after.li3")}</li>
      </ul>

      <h2>{t("safety.wk.h2")}</h2>

      <h3>{t("safety.wk.before.h3")}</h3>
      <ul>
        <li>{t("safety.wk.before.li1")}</li>
        <li>{t("safety.wk.before.li2")}</li>
        <li>{t("safety.wk.before.li3")}</li>
      </ul>

      <h3>{t("safety.wk.day.h3")}</h3>
      <ul>
        <li>{t("safety.wk.day.li1")}</li>
        <li>{t("safety.wk.day.li2")}</li>
        <li>{t("safety.wk.day.li3")}</li>
        <li>{t("safety.wk.day.li4")}</li>
      </ul>

      <h3>{t("safety.wk.after.h3")}</h3>
      <ul>
        <li>{t("safety.wk.after.li1")}</li>
        <li>{t("safety.wk.after.li2")}</li>
      </ul>

      <h2>{t("safety.rf.h2")}</h2>
      <ul>
        <li>{t("safety.rf.li1")}</li>
        <li>{t("safety.rf.li2")}</li>
        <li>{t("safety.rf.li3")}</li>
        <li>{t("safety.rf.li4")}</li>
        <li>{t("safety.rf.li5")}</li>
      </ul>

      <h2>{t("safety.em.h2")}</h2>
      <ul>
        <li>
          <b>{t("safety.em.saps")}</b> <a href="tel:10111">10111</a> {t("safety.em.sapsNote")}
        </li>
        <li>
          <b>{t("safety.em.ambulance")}</b> <a href="tel:10177">10177</a>
        </li>
        <li>
          <b>{t("safety.em.national")}</b> <a href="tel:112">112</a>
        </li>
        <li>
          <b>{t("safety.em.gbv")}</b> <a href="tel:0800428428">0800 428 428</a>
        </li>
      </ul>

      <h2>{t("safety.report.h2")}</h2>
      <p>
        {t("safety.report.pre")}{" "}
        <a href="mailto:tshepowayne@workitsa.co.za">tshepowayne@workitsa.co.za</a>{" "}
        {t("safety.report.post")}
      </p>

      <p>{t("safety.closing")}</p>
    </LegalPage>
  );
}
