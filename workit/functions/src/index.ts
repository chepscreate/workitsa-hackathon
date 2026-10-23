/**
 * Workit Cloud Functions entry point.
 *
 * We export the trigger functions individually so Firebase can deploy /
 * version each one independently. Group them by concern:
 *
 *   email.ts       - SendGrid notification emails (offers, accepts, etc.)
 *   ratings.ts     - Server-side rating aggregation (replaces client-side)
 *   moderation.ts  - Vision API image moderation (deletes unsafe uploads)
 *   verification.ts - Auto-promote worker verification status on first submit
 */
// MUST be first: sets the global region (africa-south1) before any function
// in the imported modules below is defined. See globalConfig.ts.
import "./globalConfig";
import { initializeApp } from "firebase-admin/app";
import { RUNTIME_MARKER } from "./runtimeMarker";

initializeApp();

// Reference the marker so tree-shaking can't drop the import — that's what
// guarantees the bundle hash changes when we bump it.
void RUNTIME_MARKER;

export {
  onOfferCreatedSendEmail,
  onOfferAcceptedSendEmail,
  onJobConfirmedSendEmail,
} from "./email";

export { submitRating, onJobConfirmedCountWork } from "./ratings";

export { confirmPayment } from "./payments";

export { generateWorkRecord } from "./workRecord";

export { getJobStartPin, verifyJobStartPin } from "./startPin";

export { onUploadedImageModerate } from "./moderation";

export { onUserVerificationSubmitted } from "./verification";

export { onVerificationDecision } from "./verificationAlerts";

export { onUserCreatedNotifyFounder } from "./signupAlerts";

export {
  onVerificationFraudSignals,
  onUserBanRegistry,
  onVerificationFileDuplicate,
} from "./fraudSignals";

export { setAdminRole } from "./adminRoles";

export { adminEmailUser, sendWelcomeEmail } from "./adminEmail";

export { onVerificationSubmittedAlert } from "./submissionAlerts";

export {
  onJobCreatedTextScreen,
  onUserProfileTextScreen,
} from "./textScreen";

export { onJobCreatedRateAndFirstPost } from "./rateLimit";

export { onReportCreated } from "./reportsHandler";

export {
  onOfferCreatedPush,
  onOfferAcceptedPush,
  onJobConfirmedPush,
} from "./pushNotifications";

export { onJobVisibleAlertWorkers } from "./jobAlerts";

export {
  onUserCreatedStats,
  onUserDeletedStats,
  onJobWrittenStats,
} from "./stats";

export { replyToSupport, resolveSupportThread } from "./support";

export { scheduledRetentionCleanup } from "./retention";

export { scheduledRecurringJobs } from "./recurring";

export { scheduledDeletionRequestCheck } from "./deletionAlerts";

export { sendBroadcast } from "./broadcast";

export { scheduledFirestoreBackup } from "./backups";

export { requestPasswordReset, requestEmailVerification } from "./authEmails";

export { jarvisChat, jarvisConfirmAction } from "./jarvis";

export { jarvisMorningDigest, jarvisDigestNow } from "./jarvisDigest";

export { onJobDisputedAlert, onJobEmergencyAlert } from "./jarvisAlerts";

export { jarvisWhatsApp } from "./jarvisWhatsApp";

export {
  onJobVisibleWhatsAppAlert,
  onJobConfirmedWhatsAppRecord,
  onOfferResolvedWhatsApp,
} from "./whatsappJobChannel";

export { onBusinessLeadCreated } from "./businessLeads";

export { eraseUserData } from "./erasure";

export { getVerificationPayload } from "./docUrls";

export { migrateVerificationToPrivate } from "./migratePrivate";

export { backfillEmployerHires } from "./backfillHires";

export {
  scheduledMarketingOutreach,
  scheduledMarketingOutreachAfternoon,
  marketingOptOut,
} from "./marketingOutreach";

export { marketingStatus, marketingRunNow } from "./marketingAdmin";

export { scheduledFacebookPost, scheduledFacebookPostMorning } from "./facebookPoster";
