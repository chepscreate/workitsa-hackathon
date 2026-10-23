/**
 * Workit — market-research survey generator (Google Apps Script)
 * ----------------------------------------------------------------
 * Builds a complete Google Form with answer-based branching so each person
 * only sees the questions that apply to them (worker / employer / business).
 *
 * HOW TO USE (about 2 minutes, all in YOUR Google account):
 *   1. Go to  https://script.google.com  and sign in.
 *   2. Click  New project.
 *   3. Delete the sample code, paste THIS whole file in, and Save.
 *   4. Click  Run  (the ▶ button) and choose  createWorkitSurvey.
 *   5. The first run asks you to authorise the script — that's Google asking
 *      YOU for permission to let YOUR script create a form in YOUR Drive.
 *      Allow it.
 *   6. When it finishes, open  View ▸ Logs  (or  Execution log). It prints
 *      two links:
 *        • Edit link   — open the form to tweak wording, colours, add a logo.
 *        • Share link  — the public link to send to people / put behind a QR.
 *
 * Re-running creates a fresh, separate form each time.
 */
function createWorkitSurvey() {
  var form = FormApp.create('Workit — Tell us what you need');

  form.setDescription(
    "Workit is a new South African app for everyday jobs — gardening, cleaning, " +
    "trades, deliveries, errands and more. Post a job or find work near you, with " +
    "verified workers and fair prices.\n\n" +
    "We're launching in Gauteng and want to build it around what YOU need. This takes " +
    "about 3 minutes. You can stay anonymous — sharing contact details at the end is " +
    "optional.\n\n" +
    "By submitting, you agree Workit may use your answers to improve the service (POPIA)."
  );
  form.setProgressBar(true);
  form.setCollectEmail(false);            // anonymous; contact is opt-in at the end
  form.setShowLinkToRespondAgain(false);

  // Shared list of job categories (used in three questions).
  var CATEGORIES = [
    'Gardening', 'Cleaning (home/office)', 'Plumbing', 'Electrical', 'Painting',
    'Tiling / building', 'Car wash / valet', 'Deliveries / bakkie hire',
    'Moving / heavy lifting', 'Errands / queue-standing / shopping', 'Hair / beauty',
    'Tutoring / lessons', 'Childminding / au pair', 'Cooking / catering', 'Security',
    'General labour / piece jobs',
  ];

  // ============================ PAGE 1 — About you ============================
  form.addSectionHeaderItem()
    .setTitle('About you')
    .setHelpText('A little background so we can group the answers. About 3 minutes total.');

  form.addListItem()
    .setTitle('Which province are you in?')
    .setChoiceValues([
      'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State',
      'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Outside South Africa',
    ])
    .setRequired(true);

  form.addTextItem()
    .setTitle('Which town or suburb? (e.g. Soweto, Sandton, Tembisa)')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('Age group')
    .setChoiceValues(['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('Which languages do you prefer to use on your phone?')
    .setHelpText('Pick any that apply — this tells us which languages to add first.')
    .setChoiceValues([
      'English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana',
      'Sepedi', 'Xitsonga', 'Tshivenda', 'siSwati', 'isiNdebele',
    ])
    .showOtherOption(true)
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('What kind of phone do you mostly use?')
    .setChoiceValues(['Android smartphone', 'iPhone', 'Basic / feature phone (no apps)'])
    .showOtherOption(true)
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('How is your mobile data usually?')
    .setChoiceValues([
      'I have plenty of data', 'I watch my data carefully',
      'I mostly use free WiFi', 'Data is a real problem for me',
    ])
    .setRequired(false);

  // Role question — routes to the right branch. Its choices are wired at the end,
  // once the branch pages exist.
  var roleQ = form.addMultipleChoiceItem()
    .setTitle('Which best describes you?')
    .setHelpText('This decides which questions we ask next.')
    .setRequired(true);

  // ============================ BRANCH A — Workers ============================
  var workerPage = form.addPageBreakItem()
    .setTitle('Finding work')
    .setHelpText('You said you’re looking for work or gigs.');

  form.addCheckboxItem()
    .setTitle('What kind of work can you do? (pick all that apply)')
    .setChoiceValues(CATEGORIES)
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How much work are you looking for?')
    .setChoiceValues([
      'Full-time income', 'Regular part-time work',
      'Now and then / extra cash', 'Emergency — I need money soon',
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('How do you find work right now?')
    .setChoiceValues([
      'Word of mouth / referrals', 'Standing at the corner / side of the road',
      'Facebook groups', 'WhatsApp groups', 'Agencies', 'Gumtree / other sites',
      'I struggle to find work',
    ])
    .showOtherOption(true)
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('What makes finding work hardest for you?')
    .setChoiceValues([
      'Not enough jobs', 'Transport / jobs too far',
      'Customers don’t trust me / no proof of skill', 'Not being paid after the work',
      'Too much competition', 'I don’t know where to look',
    ])
    .showOtherOption(true)
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('Workit asks workers to verify with their SA ID and a selfie so customers trust them. Would you do this?')
    .setChoiceValues(['Yes, no problem', 'Maybe, depends', 'No, I’d rather not'])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('How would you prefer to be paid?')
    .setChoiceValues(['Cash', 'EFT / bank transfer', 'Either is fine'])
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('What would make you trust and use an app like Workit to find work?')
    .setRequired(false);

  // ===================== BRANCH B — Employers / households ====================
  var employerPage = form.addPageBreakItem()
    .setTitle('Hiring someone')
    .setHelpText('You said you need to hire someone for a job.');

  form.addCheckboxItem()
    .setTitle('What jobs do you need done? (pick all that apply)')
    .setChoiceValues(CATEGORIES)
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How often do you hire someone for odd jobs?')
    .setChoiceValues([
      'Every week', 'A few times a month', 'A few times a year',
      'Rarely — only when something breaks',
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('How do you find workers now?')
    .setChoiceValues([
      'Word of mouth / neighbours', 'Someone who comes to the gate', 'Agencies',
      'Facebook / Gumtree', 'WhatsApp groups', 'I struggle to find someone reliable',
    ])
    .showOtherOption(true)
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('What worries you most about hiring a stranger?')
    .setChoiceValues([
      'Safety / letting someone into my home', 'Theft', 'Poor quality work',
      'They don’t show up', 'Overcharging', 'Just finding someone at all',
    ])
    .showOtherOption(true)
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('Roughly what would you pay for a half-day of general work (about 4 hours)?')
    .setChoiceValues(['Under R150', 'R150–R250', 'R250–R400', 'R400–R600', 'More than R600', 'Not sure'])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('Would an ID-verified worker make you more likely to hire?')
    .setChoiceValues(['Yes, much more likely', 'A little', 'No difference'])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('How would you prefer to pay?')
    .setChoiceValues(['Cash', 'EFT / bank transfer', 'Either is fine'])
    .setRequired(false);

  // ========================= BRANCH C — Businesses ===========================
  var businessPage = form.addPageBreakItem()
    .setTitle('Hiring for your business')
    .setHelpText('You said you run a business that hires workers.');

  form.addTextItem()
    .setTitle('What does your business do?')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('How many workers do you hire in a typical month?')
    .setChoiceValues(['1–2', '3–5', '6–10', 'More than 10', 'It varies a lot'])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('What’s hardest about hiring casual or temporary workers?')
    .setChoiceValues([
      'Finding reliable people', 'Verifying who they are', 'No-shows',
      'Quality / skill', 'Admin / paperwork', 'Managing payments',
    ])
    .showOtherOption(true)
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('Which of these would you pay for?')
    .setHelpText('We’re exploring optional paid features. Everything is free during launch.')
    .setChoiceValues([
      'Featured / boosted job listings', 'A verified business profile / badge',
      'Access to verified workers', 'Bulk / repeat hiring tools', 'None of these',
    ])
    .showOtherOption(true)
    .setRequired(false);

  // ========================= COMMON — About Workit ===========================
  var conceptPage = form.addPageBreakItem()
    .setTitle('About Workit')
    .setHelpText('A few last questions for everyone.');

  form.addScaleItem()
    .setTitle('How likely would you be to use Workit?')
    .setBounds(1, 5)
    .setLabels('Very unlikely', 'Very likely')
    .setRequired(true);

  form.addGridItem()
    .setTitle('How important are these to you?')
    .setRows([
      'Workers verified with ID', 'Live tracking of the worker on the way',
      'Emergency / panic button', 'Star ratings & reviews', 'Fair-price guidance',
    ])
    .setColumns(['Not important', 'Nice to have', 'Very important']);

  form.addParagraphTextItem()
    .setTitle('What is the ONE thing that would make you use Workit — or stop you?')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('How did you hear about Workit?')
    .setChoiceValues([
      'Friend / family', 'Facebook', 'WhatsApp', 'Instagram / TikTok',
      'Saw it online', 'Community / church / stokvel',
    ])
    .showOtherOption(true)
    .setRequired(false);

  // ======================= COMMON — Stay in the loop =========================
  var contactPage = form.addPageBreakItem()
    .setTitle('Stay in the loop (optional)')
    .setHelpText('Only if you want to — you can submit without filling this in.');

  form.addMultipleChoiceItem()
    .setTitle('Want early access and a heads-up when Workit launches near you?')
    .setChoiceValues(['Yes, keep me posted', 'No thanks'])
    .setRequired(false);

  form.addTextItem()
    .setTitle('WhatsApp number or email (optional)')
    .setHelpText('We’ll only use this to tell you about Workit. We never share it. (POPIA)')
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('Consent')
    .setChoiceValues(['I agree Workit may contact me about the launch and updates'])
    .setRequired(false);

  // ===================== Wire up the answer-based branching ===================
  // Each role sends the person to their section; everyone else's sections are
  // skipped. After their branch, they jump straight to "About Workit".
  roleQ.setChoices([
    roleQ.createChoice('I’m looking for work or gigs', workerPage),
    roleQ.createChoice('I need to hire someone for a job (home / personal)', employerPage),
    roleQ.createChoice('I run a business that hires workers', businessPage),
    roleQ.createChoice('Just curious / something else', conceptPage),
  ]);
  workerPage.setGoToPage(conceptPage);
  employerPage.setGoToPage(conceptPage);
  businessPage.setGoToPage(conceptPage);
  // conceptPage flows naturally into contactPage, which ends with Submit.

  Logger.log('✅ Form created.');
  Logger.log('Edit  : ' + form.getEditUrl());
  Logger.log('Share : ' + form.getPublishedUrl());
}
