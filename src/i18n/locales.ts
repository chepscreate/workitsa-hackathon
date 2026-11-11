/**
 * The 11 official South African languages, plus English as the source.
 *
 * Workit launches with English-only copy. This module is the scaffolding for
 * future translation work — strings flow through `useTranslation()` (see
 * `src/contexts/LocaleContext.tsx`) and fall back to English when a key
 * isn't translated yet.
 *
 * To add real translations: drop a `src/i18n/messages/<code>.ts` file that
 * default-exports a `Messages` dictionary, then import + register it in
 * `LocaleContext`. We deliberately don't auto-load all 11 — they'd bloat the
 * client bundle until they're actually filled in.
 */

export type LocaleCode =
  | "en" // English
  | "af" // Afrikaans
  | "zu" // isiZulu
  | "xh" // isiXhosa
  | "st" // Sesotho
  | "tn" // Setswana
  | "ss" // siSwati
  | "ve" // Tshivenda
  | "ts" // Xitsonga
  | "nr" // isiNdebele
  | "nso"; // Sepedi (Northern Sotho)

export const LOCALES: { code: LocaleCode; label: string; nativeLabel: string }[] = [
  { code: "en",  label: "English",       nativeLabel: "English" },
  { code: "af",  label: "Afrikaans",     nativeLabel: "Afrikaans" },
  { code: "zu",  label: "isiZulu",       nativeLabel: "isiZulu" },
  { code: "xh",  label: "isiXhosa",      nativeLabel: "isiXhosa" },
  { code: "st",  label: "Sesotho",       nativeLabel: "Sesotho" },
  { code: "tn",  label: "Setswana",      nativeLabel: "Setswana" },
  { code: "ss",  label: "siSwati",       nativeLabel: "siSwati" },
  { code: "ve",  label: "Tshivenda",     nativeLabel: "Tshivenḓa" },
  { code: "ts",  label: "Xitsonga",      nativeLabel: "Xitsonga" },
  { code: "nr",  label: "isiNdebele",    nativeLabel: "isiNdebele" },
  { code: "nso", label: "Sepedi",        nativeLabel: "Sepedi" },
];

export const DEFAULT_LOCALE: LocaleCode = "en";

/** Keys used in `useTranslation()`. Add new keys here as copy is wrapped. */
export type Messages = {
  // Global navigation
  "nav.findWork": string;
  "nav.postJob": string;
  "nav.workers": string;
  "nav.businesses": string;
  "nav.howItWorks": string;
  "nav.safety": string;
  "nav.faq": string;
  "nav.more": string;
  "nav.account": string;
  "nav.myJobs": string;
  // Auth / account
  "auth.signIn": string;
  "auth.getStarted": string;
  "auth.signOut": string;
  "auth.account": string;
  // Landing hero (title split into 3 so the middle phrase stays emphasised)
  "hero.titleA": string;
  "hero.titleB": string;
  "hero.titleC": string;
  "hero.subtitle": string;
  "hero.ctaPost": string;
  "hero.ctaWork": string;
  "hero.trustFree": string;
  "hero.trustVerified": string;
  "hero.trustCash": string;
  // Footer
  "footer.tagline": string;
  "footer.useWorkit": string;
  "footer.trustSafety": string;
  "footer.browseWorkers": string;
  "footer.browseCategories": string;
  "footer.verification": string;
  "footer.safetyGuide": string;
  "footer.acceptableUse": string;
  "footer.terms": string;
  "footer.privacy": string;
  "footer.launching": string;
  "footer.support": string;
  // Common
  "common.language": string;
  "common.loading": string;

  // Landing — hero badge
  "home.badge.launching": string;
  // Landing — how it works
  "home.how.badge": string;
  "home.how.title": string;
  "home.how.subtitle": string;
  "home.step1.title": string;
  "home.step1.body": string;
  "home.step2.title": string;
  "home.step2.body": string;
  "home.step3.title": string;
  "home.step3.body": string;
  // Landing — categories
  "home.cat.badge": string;
  "home.cat.title": string;
  "home.cat.seeAll": string;
  "home.cat.liveAtLaunch": string;
  "home.cat.home.title": string;
  "home.cat.home.examples": string;
  "home.cat.trades.title": string;
  "home.cat.trades.examples": string;
  "home.cat.moving.title": string;
  "home.cat.moving.examples": string;
  "home.cat.personal.title": string;
  "home.cat.personal.examples": string;
  // Landing — safety
  "home.safety.badge": string;
  "home.safety.title": string;
  "home.safety.body": string;
  "home.safety.id.title": string;
  "home.safety.id.body": string;
  "home.safety.address.title": string;
  "home.safety.address.body": string;
  "home.safety.background.title": string;
  "home.safety.background.body": string;
  "home.safety.tracking.title": string;
  "home.safety.tracking.body": string;
  "home.safety.sos.title": string;
  "home.safety.sos.body": string;
  "home.safety.ratings.title": string;
  "home.safety.ratings.body": string;
  // Landing — for workers
  "home.workers.badge": string;
  "home.workers.title": string;
  "home.workers.body": string;
  "home.workers.cta": string;
  "home.workers.docs": string;

  // Testimonials
  "stories.badge": string;
  "stories.title": string;
  "stories.subtitle": string;
  "stories.rolePosted": string;
  "stories.roleWorker": string;
  "stories.q1.quote": string;
  "stories.q1.job": string;
  "stories.q2.quote": string;
  "stories.q2.job": string;
  "stories.q3.quote": string;
  "stories.q3.job": string;
  "stories.disclaimer": string;

  // FAQ
  "faq.badge": string;
  "faq.title": string;
  "faq.contactPre": string;
  "faq.contactLink": string;
  "faq.contactPost": string;
  "faq.q1.q": string;
  "faq.q1.a": string;
  "faq.q2.q": string;
  "faq.q2.a": string;
  "faq.q3.q": string;
  "faq.q3.a": string;
  "faq.q4.q": string;
  "faq.q4.a": string;
  "faq.q5.q": string;
  "faq.q5.a": string;
  "faq.q6.q": string;
  "faq.q6.a": string;
  "faq.q7.q": string;
  "faq.q7.a": string;

  // Post a job. Dynamic hints embed live values via `t(key, { name })`
  // interpolation — see `{placeholder}` tokens in the message strings.
  "postJob.shell.back": string;
  "postJob.shell.titlePost": string;
  "postJob.shell.titleRebook": string;
  "postJob.shell.intro": string;
  "postJob.shell.livePreview": string;
  "postJob.shell.previewNote": string;
  "postJob.invite.badge": string;
  "postJob.invite.cancel": string;
  "postJob.templates.title": string;
  "postJob.intro.default": string;
  "postJob.intro.rebook": string;
  "postJob.notice.label": string;
  "postJob.notice.body": string;
  "postJob.notice.link": string;
  "postJob.notice.after": string;
  "postJob.field.title": string;
  "postJob.field.titlePlaceholder": string;
  "postJob.field.category": string;
  "postJob.field.subcategory": string;
  "postJob.field.subcategoryAny": string;
  "postJob.field.description": string;
  "postJob.field.descriptionPlaceholder": string;
  "postJob.details.legend": string;
  "postJob.details.tools": string;
  "postJob.details.experience": string;
  "postJob.details.transport": string;
  "postJob.details.transportHint": string;
  "postJob.details.training": string;
  "postJob.details.trainingHint": string;
  "postJob.details.duration": string;
  "postJob.details.hours": string;
  "postJob.details.days": string;
  "postJob.details.dueBy": string;
  "postJob.details.clearDeadline": string;
  "postJob.details.payment": string;
  "postJob.details.preferredWorker": string;
  "postJob.details.anyGender": string;
  "postJob.details.minAge": string;
  "postJob.details.maxAge": string;
  "postJob.field.price": string;
  "postJob.field.pricePlaceholder": string;
  "postJob.field.workers": string;
  "postJob.field.suburb": string;
  "postJob.field.suburbPlaceholder": string;
  "postJob.field.city": string;
  "postJob.field.cityPlaceholder": string;
  "postJob.field.province": string;
  "postJob.field.provinceOther": string;
  "postJob.location.label": string;
  "postJob.location.hint": string;
  "postJob.photos.label": string;
  "postJob.photos.add": string;
  "postJob.photos.hint": string;
  "postJob.urgent.label": string;
  "postJob.urgent.hint": string;
  "postJob.action.saveTemplate": string;
  "postJob.action.post": string;
  "postJob.action.posting": string;
  "postJob.error.priceInvalid": string;
  "postJob.error.couldNotPost": string;
  // Price field hint ({total} = suggested crew total in rand)
  "postJob.priceHint.crew": string;
  "postJob.priceHint.single": string;
  // Workers-needed hint ({count} = crew size)
  "postJob.workersHint.crew": string;
  "postJob.workersHint.single": string;
  // Estimated-duration hint (split by unit so the whole sentence reads naturally)
  "postJob.durationHint.day": string;
  "postJob.durationHint.week": string;
  // Due-by hint
  "postJob.dueHint.deadline": string;
  "postJob.dueHint.defaultTime": string;
  "postJob.dueHint.none": string;
  // Fair-price guide ({low}/{high}/{typical} = formatted rand, {cat} = category)
  // lowPre + <b>{typical}</b> + lowPost render as one sentence with a bold price.
  "postJob.guide.lowPre": string;
  "postJob.guide.lowPost": string;
  "postJob.guide.high": string;
  "postJob.guide.fair": string;
  "postJob.guide.range": string;
  "postJob.guide.use": string;
  // Preferred-worker note (pre + <b>bold</b> + post — inline emphasis)
  "postJob.prefNote.pre": string;
  "postJob.prefNote.bold": string;
  "postJob.prefNote.post": string;
  // Save / delete template confirm dialogs ({name} = template name)
  "postJob.tpl.saveTitle": string;
  "postJob.tpl.saveBody": string;
  "postJob.tpl.saveConfirm": string;
  "postJob.tpl.deleteTitle": string;
  "postJob.tpl.deleteConfirm": string;

  // Shared category names — keyed by CategoryId (see CATEGORIES in lib/types.ts).
  // Used by any surface that renders category chips/labels (find-work, workers…).
  "category.home-garden": string;
  "category.trades": string;
  "category.moving-errands": string;
  "category.personal": string;
  "category.beauty-wellness": string;
  "category.events-catering": string;
  "category.driving-delivery": string;
  "category.tutoring-education": string;
  "category.care": string;
  "category.construction-labour": string;
  "category.tech-digital": string;

  // Find-work feed (worker core surface)
  "findWork.badge": string;
  "findWork.title": string;
  "findWork.intro": string;
  "findWork.filter.all": string;
  "findWork.filter.distance": string;
  "findWork.filter.sort": string;
  "findWork.filtersBtn": string;
  "findWork.radius.any": string;
  "findWork.search.placeholder": string;
  "findWork.sort.best": string;
  "findWork.sort.nearest": string;
  "findWork.sort.newest": string;
  "findWork.sort.highest": string;
  "findWork.sort.lowest": string;
  // Home-pin nudge (pre + link + post render as one sentence)
  "findWork.homeNudge.before": string;
  "findWork.homeNudge.link": string;
  "findWork.homeNudge.after": string;
  "findWork.saved.title": string;
  "findWork.saved.save": string;
  "findWork.saved.saving": string;
  "findWork.saved.saveTitle": string;
  // Saved-searches empty hint (pre + <b>bold</b> + post)
  "findWork.saved.emptyPre": string;
  "findWork.saved.emptyBold": string;
  "findWork.saved.emptyPost": string;
  "findWork.saved.allCategories": string;
  "findWork.saved.applyTitle": string;
  "findWork.saved.delete": string;
  // Results header ({count} = number, {category} = category name, {radius} = km)
  "findWork.results.one": string;
  "findWork.results.many": string;
  "findWork.results.inCategory": string;
  "findWork.results.within": string;
  "findWork.view.list": string;
  "findWork.view.map": string;
  // Map view ({count} = number of unpinned jobs)
  "findWork.map.nonePinnedPre": string;
  "findWork.map.nonePinnedLink": string;
  "findWork.map.hiddenOne": string;
  "findWork.map.hiddenMany": string;
  // Empty states
  "findWork.empty.noResults.title": string;
  "findWork.empty.noResults.body": string;
  "findWork.empty.early.title": string;
  "findWork.empty.early.body": string;
  "findWork.empty.early.ctaAlerts": string;
  "findWork.empty.early.ctaVerify": string;
  "findWork.empty.early.ctaProfile": string;
  "findWork.empty.early.ctaInvite": string;

  // How it works page
  "hiw.hero.title": string;
  "hiw.hero.intro": string;
  "hiw.emp.h2": string;
  "hiw.emp.sub": string;
  "hiw.emp.s1.t": string;
  "hiw.emp.s1.b": string;
  "hiw.emp.s2.t": string;
  "hiw.emp.s2.b": string;
  "hiw.emp.s3.t": string;
  "hiw.emp.s3.b": string;
  "hiw.emp.s4.t": string;
  "hiw.emp.s4.b": string;
  "hiw.emp.s5.t": string;
  "hiw.emp.s5.b": string;
  "hiw.emp.cta": string;
  "hiw.wk.h2": string;
  "hiw.wk.sub": string;
  "hiw.wk.s1.t": string;
  "hiw.wk.s1.b": string;
  "hiw.wk.s2.t": string;
  "hiw.wk.s2.b": string;
  "hiw.wk.s2.link": string;
  "hiw.wk.s3.t": string;
  "hiw.wk.s3.b": string;
  "hiw.wk.s3.link": string;
  "hiw.wk.s4.t": string;
  "hiw.wk.s4.b": string;
  "hiw.wk.s5.t": string;
  "hiw.wk.s5.b": string;
  "hiw.wk.cta": string;
  "hiw.know.h2": string;
  "hiw.know.pricing.t": string;
  "hiw.know.pricing.b": string;
  "hiw.know.payment.t": string;
  "hiw.know.payment.b": string;
  "hiw.know.trust.t": string;
  "hiw.know.trust.b": string;
  "hiw.know.trust.link": string;
  "hiw.know.disputes.t": string;
  "hiw.know.disputes.b": string;
  "hiw.know.where.t": string;
  "hiw.know.where.b": string;
  "hiw.know.cats.t": string;
  "hiw.know.cats.b": string;
  "hiw.know.cats.link": string;
  "hiw.faq.h2": string;
  "hiw.faq.q1": string;
  "hiw.faq.a1": string;
  "hiw.faq.q2": string;
  "hiw.faq.a2": string;
  "hiw.faq.q3": string;
  "hiw.faq.a3": string;
  "hiw.faq.q4": string;
  "hiw.faq.a4": string;
  "hiw.faq.q5": string;
  "hiw.faq.a5": string;
  "hiw.faq.q6": string;
  "hiw.faq.a6": string;
  "hiw.cta.h2": string;
  "hiw.cta.post": string;
  "hiw.cta.worker": string;

  // Auth — shared across sign in / sign up / phone form / Google button
  "auth.or": string;
  "auth.and": string;
  "auth.privacyShort": string;
  "auth.tabPhone": string;
  "auth.tabPhoneSms": string;
  "auth.tabEmail": string;
  "auth.google.default": string;
  "auth.google.opening": string;
  "auth.google.error": string;
  "auth.role.needWork.title": string;
  "auth.role.needWork.sub": string;
  "auth.role.doWork.title": string;
  "auth.role.doWork.sub": string;
  "auth.biz.question": string;
  "auth.biz.no": string;
  "auth.biz.yes": string;
  "auth.biz.note": string;
  "auth.field.fullName": string;
  "auth.field.fullNamePh": string;
  "auth.field.email": string;
  "auth.field.emailPh": string;
  "auth.field.emailHintSignup": string;
  "auth.field.dob": string;
  "auth.field.dobHint": string;
  "auth.field.mobile": string;
  "auth.field.mobilePh": string;
  "auth.field.mobileHint": string;
  "auth.field.password": string;
  "auth.consent.pre": string;
  "auth.consent.terms": string;
  "auth.consent.aup": string;
  "auth.consent.privacy": string;
  "auth.phone.sendCode": string;
  "auth.phone.sending": string;
  "auth.phone.smsRates": string;
  "auth.phone.codeSentPre": string;
  "auth.phone.codeSentPost": string;
  "auth.phone.codeLabel": string;
  "auth.phone.codePh": string;
  "auth.phone.verify": string;
  "auth.phone.verifying": string;
  "auth.phone.wrongNumber": string;
  "auth.phone.notArrive": string;
  "auth.err.invalidPhone": string;
  "auth.err.fullName": string;
  "auth.err.email": string;
  "auth.err.under18": string;
  "auth.err.terms": string;
  "auth.err.sendFail": string;
  "auth.err.recaptcha": string;
  "auth.err.tooMany": string;
  "auth.err.notEnabled": string;
  "auth.err.enterCode": string;
  "auth.err.verifyFail": string;
  "auth.err.codeMismatch": string;
  "auth.err.codeExpired": string;
  "auth.err.passwordLen": string;
  "auth.err.createFail": string;
  // Sign-in page
  "signin.welcomePre": string;
  "signin.lead": string;
  "signin.b1.t": string;
  "signin.b1.b": string;
  "signin.b2.t": string;
  "signin.b2.b": string;
  "signin.b3.t": string;
  "signin.b3.b": string;
  "signin.formTitle": string;
  "signin.formSub": string;
  "signin.forgot": string;
  "signin.signingIn": string;
  "signin.noAccount": string;
  "signin.createOne": string;
  "signin.byContinuingPre": string;
  // Sign-up page
  "signup.badge": string;
  "signup.welcome": string;
  "signup.intent": string;
  "signup.googleLabel": string;
  "signup.phoneLabel": string;
  "signup.phonePh": string;
  "signup.phoneHint": string;
  "signup.referralLabel": string;
  "signup.referralPh": string;
  "signup.referralHint": string;
  "signup.passwordPh": string;
  "signup.submitWorker": string;
  "signup.submitBusiness": string;
  "signup.submitEmployer": string;
  "signup.creating": string;
  "signup.already": string;
  "signup.workerNotice.title": string;
  "signup.workerNotice.body": string;
  "signup.loading": string;

  // Verification page (worker + employer forms, guest overview)
  "ver.welcome.title": string;
  "ver.welcome.body": string;
  "ver.hero.eyebrow": string;
  "ver.hero.titleWelcome": string;
  "ver.hero.title": string;
  "ver.hero.intro": string;
  "ver.changes.title": string;
  "ver.changes.body": string;
  "ver.status.current": string;
  "ver.status.note": string;
  "ver.done.worker": string;
  "ver.id.number": string;
  "ver.id.numberPh": string;
  "ver.id.invalidShort": string;
  "ver.id.dobMismatchWorker": string;
  "ver.id.dobMismatchEmp": string;
  "ver.id.valid": string;
  "ver.id.born": string;
  "ver.f.idPhoto": string;
  "ver.f.idPhotoReplace": string;
  "ver.f.idPhotoUpload": string;
  "ver.f.idPhotoHint": string;
  "ver.f.idPhotoHintEmp": string;
  "ver.f.selfie": string;
  "ver.f.selfieEmp": string;
  "ver.f.selfieReplace": string;
  "ver.f.selfieUpload": string;
  "ver.f.selfieHint": string;
  "ver.f.selfieHintEmp": string;
  "ver.f.address": string;
  "ver.f.addressPh": string;
  "ver.f.locLabel": string;
  "ver.f.locHint": string;
  "ver.f.addrProof": string;
  "ver.f.addrProofReplace": string;
  "ver.f.addrProofUpload": string;
  "ver.f.addrProofHint": string;
  "ver.f.skills": string;
  "ver.f.skillsPh": string;
  "ver.f.pastWork": string;
  "ver.f.uploaded": string;
  "ver.f.addPhoto": string;
  "ver.f.addPhotoHint": string;
  "ver.f.policeTitle": string;
  "ver.f.policeBody1": string;
  "ver.f.policeBadge": string;
  "ver.f.policeBody2": string;
  "ver.f.policeReplace": string;
  "ver.f.policeUpload": string;
  "ver.f.policeHint": string;
  "ver.f.catsTitle": string;
  "ver.f.catsHint": string;
  "ver.f.consentPre": string;
  "ver.f.consentPost": string;
  "ver.f.consentEmpPre": string;
  "ver.f.consentEmpPost": string;
  "ver.f.saving": string;
  "ver.f.submitContinue": string;
  "ver.f.submitReview": string;
  "ver.f.truth": string;
  "ver.err.consent": string;
  "ver.err.idInvalid": string;
  "ver.err.under18": string;
  "ver.err.idPhoto": string;
  "ver.err.address": string;
  "ver.err.addrProof": string;
  "ver.err.skills": string;
  "ver.err.couldNotSubmit": string;
  "ver.emp.hero.eyebrow": string;
  "ver.emp.hero.title": string;
  "ver.emp.hero.intro": string;
  "ver.emp.done": string;
  "ver.ov.hero.eyebrow": string;
  "ver.ov.hero.title": string;
  "ver.ov.hero.intro": string;
  "ver.ov.ask.h": string;
  "ver.ov.ask.li1": string;
  "ver.ov.ask.li2": string;
  "ver.ov.ask.li3": string;
  "ver.ov.ask.li4": string;
  "ver.ov.ask.li5": string;
  "ver.ov.ask.li6": string;
  "ver.ov.ask.li7": string;
  "ver.ov.proc.h": string;
  "ver.ov.proc.li1": string;
  "ver.ov.proc.li2": string;
  "ver.ov.proc.li3": string;
  "ver.ov.proc.li4": string;
  "ver.ov.proc.note": string;
  "ver.ov.why.h": string;
  "ver.ov.why.body": string;
  "ver.ov.docs.h": string;
  "ver.ov.docs.pre": string;
  "ver.ov.docs.post": string;
  "ver.ov.ready.h": string;
  "ver.ov.ready.body": string;
  "ver.ov.ready.gotoProfile": string;
  "ver.ov.ready.already": string;

  // Safety guide page
  "safety.badge": string;
  "safety.title": string;
  "safety.intro": string;
  "safety.tools.h2": string;
  "safety.t1.h3": string;
  "safety.t1.p": string;
  "safety.t1.emp": string;
  "safety.t1.link": string;
  "safety.t2.h3": string;
  "safety.t2.p": string;
  "safety.t3.h3": string;
  "safety.t3.p": string;
  "safety.t4.h3": string;
  "safety.t4.p": string;
  "safety.t5.h3": string;
  "safety.t5.p": string;
  "safety.t6.h3": string;
  "safety.t6.p": string;
  "safety.t7.h3": string;
  "safety.t7.p": string;
  "safety.emp.h2": string;
  "safety.emp.before.h3": string;
  "safety.emp.before.li1": string;
  "safety.emp.before.li2": string;
  "safety.emp.before.li3": string;
  "safety.emp.day.h3": string;
  "safety.emp.day.li1": string;
  "safety.emp.day.li2": string;
  "safety.emp.day.li3": string;
  "safety.emp.day.li4": string;
  "safety.emp.after.h3": string;
  "safety.emp.after.li1": string;
  "safety.emp.after.li2": string;
  "safety.emp.after.li3": string;
  "safety.wk.h2": string;
  "safety.wk.before.h3": string;
  "safety.wk.before.li1": string;
  "safety.wk.before.li2": string;
  "safety.wk.before.li3": string;
  "safety.wk.day.h3": string;
  "safety.wk.day.li1": string;
  "safety.wk.day.li2": string;
  "safety.wk.day.li3": string;
  "safety.wk.day.li4": string;
  "safety.wk.after.h3": string;
  "safety.wk.after.li1": string;
  "safety.wk.after.li2": string;
  "safety.rf.h2": string;
  "safety.rf.li1": string;
  "safety.rf.li2": string;
  "safety.rf.li3": string;
  "safety.rf.li4": string;
  "safety.rf.li5": string;
  "safety.em.h2": string;
  "safety.em.saps": string;
  "safety.em.sapsNote": string;
  "safety.em.ambulance": string;
  "safety.em.national": string;
  "safety.em.gbv": string;
  "safety.report.h2": string;
  "safety.report.pre": string;
  "safety.report.post": string;
  "safety.closing": string;

  // WhatsApp Job Channel opt-in card (worker account)
  "waalerts.title": string;
  "waalerts.onDesc": string;
  "waalerts.offDesc": string;
  "waalerts.numberLabel": string;
  "waalerts.numberHint": string;
  "waalerts.consent": string;
  "waalerts.titleEmployer": string;
  "waalerts.onDescEmployer": string;
  "waalerts.offDescEmployer": string;
  "waalerts.consentEmployer": string;
  "waalerts.turnOn": string;
  "waalerts.turnOff": string;
  "waalerts.saving": string;
  "waalerts.on": string;
  "waalerts.invalidNumber": string;
};
