import type { Messages } from "../locales";

// Afrikaans. Reviewed for natural phrasing; safe to refine with a native
// speaker over time — any missing key falls back to English automatically.
const af: Messages = {
  "nav.findWork": "Kry werk",
  "nav.postJob": "Plaas 'n werk",
  "nav.workers": "Werkers",
  "nav.businesses": "Besighede",
  "nav.howItWorks": "Hoe dit werk",
  "nav.safety": "Veiligheid",
  "nav.faq": "Vrae",
  "nav.more": "Meer",
  "nav.account": "Rekening",
  "nav.myJobs": "My werke",

  "auth.signIn": "Meld aan",
  "auth.getStarted": "Begin nou",
  "auth.signOut": "Meld af",
  "auth.account": "Rekening",

  "hero.titleA": "Werk moet gedoen word.",
  "hero.titleB": "Iemand naby",
  "hero.titleC": "is gereed om dit te doen.",
  "hero.subtitle":
    "Workit is 'n Suid-Afrikaanse mark vir alledaagse werk. Tuinwerk, skoonmaak, ambagte, aflewerings — plaas wat jy nodig het, stel 'n billike prys, en word gekoppel aan geverifieerde werkers in jou area.",
  "hero.ctaPost": "Plaas 'n werk →",
  "hero.ctaWork": "Ek wil werk",
  "hero.trustFree": "Gratis tydens bekendstelling",
  "hero.trustVerified": "Geverifieerde werkers",
  "hero.trustCash": "Kontant of EFT met voltooiing",

  "footer.tagline":
    "Workit is 'n Suid-Afrikaanse werksmark. Ons verbind mense wat 'n werk gedoen wil hê met bekwame, geverifieerde werkers in hul area — beginnende in Gauteng.",
  "footer.useWorkit": "Gebruik Workit",
  "footer.trustSafety": "Vertroue en veiligheid",
  "footer.browseWorkers": "Blaai deur werkers",
  "footer.browseCategories": "Blaai deur kategorieë",
  "footer.verification": "Verifikasieproses",
  "footer.safetyGuide": "Veiligheidsgids",
  "footer.acceptableUse": "Aanvaarbare gebruik",
  "footer.terms": "Bepalings",
  "footer.privacy": "Privaatheid",
  "footer.launching": "Begin in Gauteng — binnekort in jou provinsie.",
  "footer.support": "Gesels met ondersteuning op WhatsApp",

  "common.language": "Taal",
  "common.loading": "Laai tans…",

  "home.badge.launching": "Bekendstelling in Gauteng",

  "home.how.badge": "Hoe dit werk",
  "home.how.title": "Drie stappe. Geen gedoente.",
  "home.how.subtitle": "Gebou om op enige foon te werk — selfs op 'n klein datatoelae.",
  "home.step1.title": "Plaas wat gedoen moet word",
  "home.step1.body":
    "Beskryf die werk, deel foto's, stel 'n billike prys voor. Neem minder as 'n minuut.",
  "home.step2.title": "Werkers reageer",
  "home.step2.body":
    "Geverifieerde werkers naby aanvaar jou prys of stuur 'n teenaanbod. Jy kies.",
  "home.step3.title": "Werk word gedoen",
  "home.step3.body":
    "Regstreekse opsporing. Foto's met voltooiing. Betaal kontant, en gradeer mekaar.",

  "home.cat.badge": "Kategorieë",
  "home.cat.title": "As dit eerlike werk is, dek ons dit.",
  "home.cat.seeAll": "Sien alle kategorieë",
  "home.cat.liveAtLaunch": "Beskikbaar met bekendstelling",
  "home.cat.home.title": "Huis & tuin",
  "home.cat.home.examples": "Tuinwerk, skoonmaak, swembadversorging, plaagbeheer",
  "home.cat.trades.title": "Geskoolde ambagte",
  "home.cat.trades.examples": "Loodgieterswerk, elektries, verf, teëlwerk, skrynwerk",
  "home.cat.moving.title": "Verhuising & takies",
  "home.cat.moving.examples": "Bakkiehuur, aflewerings, toustaan, kruidenierware",
  "home.cat.personal.title": "Persoonlike dienste",
  "home.cat.personal.examples": "Karwas, hare, bystudie, kinderoppas",

  "home.safety.badge": "Vertroue & veiligheid",
  "home.safety.title": "Ons laat vreemdelinge in ons huise toe. Veiligheid is nie opsioneel nie.",
  "home.safety.body":
    "Elke Workit-werker word deur 'n regte persoon nagegaan voordat hulle werk kan aanvaar — deur my persoonlik met bekendstelling, deur 'n keuringspan soos ons groei.",
  "home.safety.id.title": "ID + gesig geverifieer",
  "home.safety.id.body":
    "Elke werker dien hul SA ID in, en baie voeg 'n kort selfie-video by. 'n Regte mens hersien elkeen.",
  "home.safety.address.title": "Bewys van adres & vaardigheid",
  "home.safety.address.body":
    "Werkers bewys waar hulle woon en wys kwalifikasies of vorige werk voordat hulle werk neem.",
  "home.safety.background.title": "Agtergrond-geverifieerde kenteken",
  "home.safety.background.body":
    "Werkers kan 'n goue kenteken verdien deur 'n polisieklaring in te dien — filter daarvoor wanneer dit saak maak.",
  "home.safety.tracking.title": "Regstreekse werkopsporing",
  "home.safety.tracking.body":
    "Deel 'n regstreekse skakel met 'n familielid wanneer 'n werker op pad na jou huis is.",
  "home.safety.sos.title": "Noodknoppie",
  "home.safety.sos.body":
    "Een tik bel SAPD 10111 van binne die app tydens enige aktiewe werk.",
  "home.safety.ratings.title": "Tweerigting-graderings",
  "home.safety.ratings.body":
    "Albei kante beoordeel elke werk. Slegte akteurs hou nie lank op die platform nie.",

  "home.workers.badge": "Vir werkers",
  "home.workers.title": "Het jy 'n vaardigheid? Begin hierdie week verdien.",
  "home.workers.body":
    "Of jy nou gras sny, krane regmaak, mure verf of takies doen — Workit stel jou bekend aan mense in jou area wat jou hulp nodig het. Geen tussengangerfooie tydens bekendstelling nie. Kontant in die hand.",
  "home.workers.cta": "Registreer as 'n werker",
  "home.workers.docs": "Watter dokumente het ek nodig?",

  "stories.badge": "Werklike stories",
  "stories.title": "Mense kry reeds werk gedoen.",
  "stories.subtitle":
    "Vroeë gebruikers uit ons Gauteng-loodsprojek. Name met hul toestemming gewys.",
  "stories.rolePosted": "Het 'n werk geplaas",
  "stories.roleWorker": "Werker",
  "stories.q1.quote":
    "Sondagaand geplaas, teen Maandagoggend drie aanbiedinge gehad. Het die een met die goue kenteken gekies — teen Woensdag klaar, billike prys.",
  "stories.q1.job": "Spaarkamer geverf",
  "stories.q2.quote":
    "Ek is al 9 jaar 'n loodgieter, maar het gesukkel om bestendige werk te kry. Nou hou my Workit-foon nooit op nie. Betaling is kontant, geen nonsens.",
  "stories.q2.job": "12 werke dié maand",
  "stories.q3.quote":
    "Regstreekse opsporing het my gemaklik gemaak om 'n vreemdeling in my erf toe te laat terwyl ek by die werk was. Fotobewys toe hy klaar was. Hom weekliks bespreek.",
  "stories.q3.job": "Weeklikse tuindiens",
  "stories.disclaimer":
    "* Saamgestelde stories uit ons Gauteng-loodsgroep. Werklike name sal hierdie vervang soos die platform openbaar oopmaak.",

  "faq.badge": "Vrae",
  "faq.title": "Dinge wat mense vra.",
  "faq.contactPre": "Kry jy nie waarna jy soek nie? ",
  "faq.contactLink": "Stuur my direk 'n e-pos",
  "faq.contactPost": " — ek lees tans elke boodskap persoonlik.",
  "faq.q1.q": "Is Workit gratis?",
  "faq.q1.a":
    "Ja — tydens ons Gauteng-bekendstelling is dit 100% gratis om 'n werk te plaas en werk te aanvaar. Geen kommissie, geen intekening. Ons sal later 'n klein platformfooi instel, en jy sal lank vooruit weet.",
  "faq.q2.q": "Hoe werk betalings?",
  "faq.q2.a":
    "Vir eers is alle betalings kontant tussen jou en die werker. Ons hou dit eenvoudig sodat jy in beheer bly. Betaling in die app en trustrekening is op ons padkaart sodra die mark volwasse word.",
  "faq.q3.q": "Hoe weet ek die werker is veilig?",
  "faq.q3.a":
    "Elke werker het hul SA ID, bewys van adres en bewys van vaardigheid ingedien — plus 'n opsionele selfie-/lewendigheidsvideo — alles deur 'n regte persoon (tans ek) nagegaan voordat hulle werk kan neem. Werkers kan ook 'n Agtergrond-geverifieerde goue kenteken verdien deur 'n polisieklaring op te laai.",
  "faq.q4.q": "Wat as iets verkeerd loop met 'n werk?",
  "faq.q4.a":
    "Elke aktiewe werk het 'n een-tik SAPD-noodknoppie, fotobewys met voltooiing, en 'n tweerigting-graderingstelsel. Dispute word deur ons span nagegaan, en slegte akteurs word vinnig verwyder.",
  "faq.q5.q": "Ek het nie data nie / ek het 'n klein foon. Sal dit steeds werk?",
  "faq.q5.a":
    "Ja. Workit is mobiel-eerste gebou en is lig op data. 'n WhatsApp-koppelvlak en 'n inheemse Android-app is op pad vir gebruikers met selfs minder data.",
  "faq.q6.q": "Is julle beskikbaar buite Gauteng?",
  "faq.q6.a":
    "Nog nie — ons wil een provinsie reg kry voordat ons uitbrei. Registreer in elk geval en ons sal jou laat weet sodra ons in jou area oopmaak.",
  "faq.q7.q": "Hoe kan ek 'n Workit-werker word?",
  "faq.q7.a":
    'Tik "Ek wil werk" hierbo. Jy skep \'n profiel, laai jou ID, bewys van adres en óf \'n sertifikaat óf foto\'s van vorige werk op (\'n kort selfie-video is opsioneel). Goedkeuring neem gewoonlik 1–2 dae tydens bekendstelling.',

  "postJob.shell.back": "Terug na paneelbord",
  "postJob.shell.titlePost": "Plaas 'n werk.",
  "postJob.shell.titleRebook": "Bespreek werk weer.",
  "postJob.shell.intro":
    "Beskryf wat gedoen moet word. Werkers naby sal jou plasing binne minute sien en aanbiedinge begin stuur.",
  "postJob.shell.livePreview": "Regstreekse voorskou",
  "postJob.shell.previewNote":
    "Dit is wat werkers in hul stroom sal sien. Hulle tik om die volle werk te bekyk.",
  "postJob.invite.badge": "Nooi 'n werker",
  "postJob.invite.cancel": "Kanselleer uitnodiging",
  "postJob.templates.title": "Jou sjablone",
  "postJob.intro.default":
    "Wees spesifiek. Werkers naby sal dit sien en met hul prys reageer.",
  "postJob.intro.rebook":
    "Ons het die brief van laas vooraf ingevul — verander enigiets wat anders is. Die werk word openbaar geplaas sodat ander werkers ook kan aanbied, maar boodskap hulle direk om hulle eerste kans te gee.",
  "postJob.notice.label": "Let op:",
  "postJob.notice.body":
    " werk wat dwelms, wapens, gesteelde goedere, seksuele dienste, geldmuil-werk of betaal-om-aansoek-te-doen-skemas behels, word verwyder en die rekening verban. Sien die ",
  "postJob.notice.link": "Aanvaarbare Gebruiksbeleid",
  "postJob.notice.after": " vir die volledige lys.",
  "postJob.field.title": "Werktitel",
  "postJob.field.titlePlaceholder": "bv. Sny gras en snoei heinings",
  "postJob.field.category": "Kategorie",
  "postJob.field.subcategory": "Spesifieke tipe (opsioneel)",
  "postJob.field.subcategoryAny": "— Enige —",
  "postJob.field.description": "Beskryf die werk",
  "postJob.field.descriptionPlaceholder":
    "Benaderde grootte van die tuin / aantal kamers / wanneer jy dit gedoen wil hê…",
  "postJob.details.legend": "Werkbesonderhede (alles opsioneel)",
  "postJob.details.tools": "Gereedskap / toerusting",
  "postJob.details.experience": "Ondervinding nodig",
  "postJob.details.transport": "Vervoer ingesluit",
  "postJob.details.transportHint": "Ek sal vervoer na die werk betaal / reël",
  "postJob.details.training": "Opleiding verskaf",
  "postJob.details.trainingHint": "Nuwelinge welkom — ek sal hulle wys wat om te doen",
  "postJob.details.duration": "Beraamde duur (opsioneel)",
  "postJob.details.hours": "Ure",
  "postJob.details.days": "Dae",
  "postJob.details.dueBy": "Klaar teen (opsioneel)",
  "postJob.details.clearDeadline": "Maak sperdatum skoon",
  "postJob.details.payment": "Betaalmetode",
  "postJob.details.preferredWorker": "Voorkeurwerker (opsioneel)",
  "postJob.details.anyGender": "Enige geslag",
  "postJob.details.minAge": "Min. ouderdom",
  "postJob.details.maxAge": "Maks. ouderdom",
  "postJob.field.price": "Voorgestelde prys (R)",
  "postJob.field.pricePlaceholder": "bv. 350",
  "postJob.field.workers": "Hoeveel werkers het jy nodig?",
  "postJob.field.suburb": "Voorstad",
  "postJob.field.suburbPlaceholder": "bv. Linden",
  "postJob.field.city": "Stad",
  "postJob.field.cityPlaceholder": "bv. Johannesburg",
  "postJob.field.province": "Provinsie",
  "postJob.field.provinceOther": "Ander provinsies — binnekort",
  "postJob.location.label": "Speld werkligging (aanbeveel)",
  "postJob.location.hint":
    "Werkers sien werk naaste aan hulle eerste. Tik om jou huidige GPS te deel, of slaan oor as jy eerder net die voorstad wil gebruik.",
  "postJob.photos.label": "Foto's (opsioneel)",
  "postJob.photos.add": "Voeg 'n foto by",
  "postJob.photos.hint": "Wys die tuin, kamer of item. Voeg soveel by as wat jy wil.",
  "postJob.urgent.label": "Merk hierdie werk as dringend",
  "postJob.urgent.hint":
    "Sweef na die bokant van die werkerstroom met 'n baksteen-kenteken. Gebruik spaarsaam sodat dit betekenisvol bly.",
  "postJob.action.saveTemplate": "Stoor as sjabloon",
  "postJob.action.post": "Plaas werk",
  "postJob.action.posting": "Plaas tans…",
  "postJob.error.priceInvalid": "Voorgestelde prys moet 'n getal groter as 0 wees.",
  "postJob.error.couldNotPost": "Kon nie werk plaas nie.",

  "postJob.priceHint.crew":
    "Per werker — jy betaal elkeen hul ooreengekome prys (voorgestelde totaal ≈ R {total}).",
  "postJob.priceHint.single": "Werkers kan dit aanvaar of 'n teenaanbod stuur.",

  "postJob.workersHint.crew":
    "Spanwerk — die plasing bly oop totdat {count} werkers aanvaar is. Elkeen word teen hul eie ooreengekome prys gehuur.",
  "postJob.workersHint.single":
    "Los as 1 vir 'n gewone enkelwerker-werk. Gaan hoër vir trekspanne, gebeurtenispersoneel, toustaanspanne, ens.",

  "postJob.durationHint.day":
    "Ongeveer hoe lank behoort dit te neem? Help werkers om hul dag te beplan.",
  "postJob.durationHint.week":
    "Ongeveer hoe lank behoort dit te neem? Help werkers om hul week te beplan.",

  "postJob.dueHint.deadline": "Werkers sal dit as 'n vaste sperdatum sien.",
  "postJob.dueHint.defaultTime": "Tyd is by verstek einde van die dag (23:59).",
  "postJob.dueHint.none":
    "Los leeg as daar geen vaste sperdatum is nie. Verskil van 'hoe lank dit neem' hierbo — dít is 'wanneer dit klaar moet wees'.",

  "postJob.guide.lowPre":
    "Dis onder die gewone {low}+ vir {cat}-werk. Baie plaas rondom ",
  "postJob.guide.lowPost": " — lae aanbiedinge neem soms langer om gevul te word.",
  "postJob.guide.high": "Vrygewig vir {cat}-werk — verwag vinnige aanbiedinge.",
  "postJob.guide.fair": "Reg in die tipiese reeks vir {cat}-werk — mooi geprys.",
  "postJob.guide.range": "Die meeste {cat}-werke betaal rondom {low}–{high}.",
  "postJob.guide.use": "Gebruik {typical}",

  "postJob.prefNote.pre": "Dit is 'n ",
  "postJob.prefNote.bold": "voorkeur",
  "postJob.prefNote.post":
    " wat aan werkers gewys word — nie 'n harde filter nie. Enigeen kan steeds aanbied, en jy kies wie om te aanvaar. Hou dit relevant tot die werk (bv. swaar optel, persoonlike sorg).",

  "postJob.tpl.saveTitle": "Stoor as sjabloon?",
  "postJob.tpl.saveBody":
    "Ons stoor die titel, kategorie, beskrywing, prys en ligging sodat jy volgende keer met een tik kan herplaas.",
  "postJob.tpl.saveConfirm": "Stoor sjabloon",
  "postJob.tpl.deleteTitle": 'Vee sjabloon "{name}" uit?',
  "postJob.tpl.deleteConfirm": "Vee uit",

  "category.home-garden": "Huis & tuin",
  "category.trades": "Geskoolde ambagte",
  "category.moving-errands": "Verhuising & takies",
  "category.personal": "Persoonlike dienste",
  "category.beauty-wellness": "Skoonheid & welstand",
  "category.events-catering": "Geleenthede & spyseniering",
  "category.driving-delivery": "Bestuur & aflewering",
  "category.tutoring-education": "Bystudie & onderrig",
  "category.care": "Kindersorg & bejaardesorg",
  "category.construction-labour": "Konstruksie & arbeid",
  "category.tech-digital": "Tegnologie & digitaal",

  "findWork.badge": "Vind werk",
  "findWork.title": "Werk oop naby jou.",
  "findWork.intro": "Kyk wat werkgewers plaas. Aanvaar die prys of stuur jou eie.",
  "findWork.filter.all": "Alles",
  "findWork.filter.distance": "Afstand",
  "findWork.filter.sort": "Sorteer",
  "findWork.filtersBtn": "Filters",
  "findWork.radius.any": "Enige afstand",
  "findWork.search.placeholder": "Soek met 'n sleutelwoord — bv. grasperk, lekkende kraan, verf…",
  "findWork.sort.best": "Beste vir jou",
  "findWork.sort.nearest": "Naaste",
  "findWork.sort.newest": "Nuutste",
  "findWork.sort.highest": "Hoogste prys",
  "findWork.sort.lowest": "Laagste prys",
  "findWork.homeNudge.before": "Wil jy werk hê gesorteer volgens hoe naby dit is? ",
  "findWork.homeNudge.link": "Speld jou tuisligging vas",
  "findWork.homeNudge.after": " op jou profiel.",
  "findWork.saved.title": "Gestoorde soektogte",
  "findWork.saved.save": "+ Stoor huidige soektog",
  "findWork.saved.saving": "Stoor…",
  "findWork.saved.saveTitle":
    "Stoor die huidige filters sodat jy in kennis gestel word wanneer passende werk geplaas word",
  "findWork.saved.emptyPre": "Stel filters op en tik dan ",
  "findWork.saved.emptyBold": "Stoor huidige soektog",
  "findWork.saved.emptyPost": " — jy kry 'n kennisgewing elke keer as 'n werk pas.",
  "findWork.saved.allCategories": "Alle kategorieë",
  "findWork.saved.applyTitle": "Pas hierdie soektog toe",
  "findWork.saved.delete": "Vee gestoorde soektog uit",
  "findWork.results.one": "{count} werk oop",
  "findWork.results.many": "{count} werke oop",
  "findWork.results.inCategory": "in {category}",
  "findWork.results.within": "binne {radius} km van jou tuisbasis",
  "findWork.view.list": "Lys",
  "findWork.view.map": "Kaart",
  "findWork.map.nonePinnedPre":
    "Nie een van hierdie werke het nog 'n vasgespelde ligging nie, so daar is niks om te karteer nie. Skakel oor na ",
  "findWork.map.nonePinnedLink": "Lysaansig",
  "findWork.map.hiddenOne":
    "{count} werk sonder 'n vasgespelde ligging word nie op die kaart gewys nie — skakel oor na Lys om dit te sien.",
  "findWork.map.hiddenMany":
    "{count} werke sonder 'n vasgespelde ligging word nie op die kaart gewys nie — skakel oor na Lys om hulle te sien.",
  "findWork.empty.noResults.title": "Geen werk pas by jou filters nie",
  "findWork.empty.noResults.body":
    "Probeer 'n wyer radius of 'n ander kategorie. Die regte werk is dalk net een filter weg.",
  "findWork.empty.early.title": "Jy is vroeg — nog geen oop werk naby nie",
  "findWork.empty.early.body":
    "Workit begin nou eers in jou area. Jy hoef nie aan te hou kyk nie — ons laat weet jou die oomblik wat 'n werk naby jou land. Maak jouself intussen gereed om gekies te word:",
  "findWork.empty.early.ctaAlerts": "Skakel kennisgewings aan & wees beskikbaar",
  "findWork.empty.early.ctaVerify": "Word geverifieer →",
  "findWork.empty.early.ctaProfile": "Poets jou profiel op",
  "findWork.empty.early.ctaInvite": "Nooi mense na Workit",

  // How it works page — AF draft, needs native review
  "hiw.hero.title": "Van plasing tot betaling — die hele vloei.",
  "hiw.hero.intro":
    "Workit verbind mense wat iets gedoen wil hê met werkers wat dit kan doen, in hul area. Geen middelman-fooie tydens die bekendstelling nie. Kontant of EFT met voltooiing, vooraf ooreengekom. Hier is presies hoe dit vir albei kante werk.",
  "hiw.emp.h2": "As jy 'n werk gedoen wil hê",
  "hiw.emp.sub": "Vyf stappe. Omtrent twee minute om te plaas.",
  "hiw.emp.s1.t": "Registreer as 'n werkgewer",
  "hiw.emp.s1.b": "Naam, e-pos, foon, wagwoord. Geen intekening, geen lysfooi nie.",
  "hiw.emp.s2.t": "Plaas die werk",
  "hiw.emp.s2.b":
    "Titel, kategorie, wat gedoen moet word, 'n voorgestelde prys, en jou voorstad. Opsioneel maar nuttig: speld die presiese ligging vas sodat werkers sien hoe naby dit is, voeg 'n foto by, merk dit dringend, en vul gereedskap / ervaring / duur in. Kies kontant of EFT met voltooiing as jou betaalmetode.",
  "hiw.emp.s3.t": "Kies 'n werker uit die aanbiedinge",
  "hiw.emp.s3.b":
    "Werkers naby aanvaar óf jou voorgestelde prys óf stuur 'n teenaanbod met 'n kort boodskap. Tik op enige naam om hul gradering, aantal voltooide werke, reputasie-kentekens, en of hulle Geverifieer is, te sien. Aanvaar die een wat jy vertrou — die ander aanbiedinge word beleefd van die hand gewys.",
  "hiw.emp.s4.t": "Bly in kontak terwyl die werk loop",
  "hiw.emp.s4.b":
    "Die werkblad word 'n klein werkruimte — in-app klets, die werker se lewendige ligging (as hulle dit deel), en 'n rooi Noodknoppie wat SAPD 10111 skakel. Die werker merk die werk as klaar en laai voltooiingsfoto's op.",
  "hiw.emp.s5.t": "Bevestig + betaal + gradeer",
  "hiw.emp.s5.b":
    "Sodra jy tevrede is met die werk, tik Bevestig voltooiing en betaal die ooreengekome prys (kontant of EFT). Julle albei los dan 'n 1–5 ster-gradering en 'n opsionele nota. Tevrede met hulle? Jy kan dieselfde werker volgende keer met een tik weer bespreek.",
  "hiw.emp.cta": "Plaas 'n werk",
  "hiw.wk.h2": "As jy hier is om te verdien",
  "hiw.wk.sub":
    "Werkers deurloop een ekstra stap — verifikasie — omdat werkgewers jou naby hul huis, familie, of besigheid laat kom.",
  "hiw.wk.s1.t": "Registreer as 'n werker",
  "hiw.wk.s1.b": "Dieselfde vorm, kies net die Werker-rol.",
  "hiw.wk.s2.t": "Word geverifieer",
  "hiw.wk.s2.b":
    "Laai jou SA ID, bewys van adres, 'n vaardigheidsopsomming, en die kategorieë waarin jy kan werk op ('n kort selfie-video is opsioneel en versnel goedkeuring). 'n Regte persoon hersien dit (gewoonlik binne 24–48 uur) en ken jou die groen Geverifieer-kenteken toe. Jy kan steeds aanbiedinge stuur terwyl dit hangende is — maar die meeste werkgewers verkies Geverifieerde werkers.",
  "hiw.wk.s2.link": "Meer oor die proses →",
  "hiw.wk.s3.t": "Blaai deur die werkervoer",
  "hiw.wk.s3.b":
    "Jy sal alle oop werke sien, gesorteer volgens hoe naby hulle aan jou vasgespelde tuisbasis is. Filter volgens kategorie, afstand, of sorteer volgens nuutste / hoogste prys.",
  "hiw.wk.s3.link": "Maak Vind werk oop →",
  "hiw.wk.s4.t": "Stuur 'n aanbod",
  "hiw.wk.s4.b":
    "Aanvaar óf die werkgewer se voorgestelde prys met een tik, óf stuur 'n teenaanbod met 'n kort boodskap. Wees eerlik oor vervoer en tydsberekening — dit maak aanvaarding baie meer waarskynlik.",
  "hiw.wk.s5.t": "Doen die werk + word betaal",
  "hiw.wk.s5.b":
    "Sodra die werkgewer aanvaar, word die werk aan jou toegewys. Op die dag, tik Ek is oppad, deel jou lewendige ligging, en neem 'n voor / na-foto. Merk die werk as klaar wanneer jy klaar is — die werkgewer bevestig, betaal die ooreengekome prys (kontant of EFT), en julle gradeer mekaar.",
  "hiw.wk.cta": "Registreer as 'n werker",
  "hiw.know.h2": "'n Paar dinge werd om te weet",
  "hiw.know.pricing.t": "Pryse + fooie",
  "hiw.know.pricing.b":
    "Tydens die bekendstelling hef Workit geen kommissie en geen lysfooie nie. Die prys wat op die werk ooreengekom word, is presies wat die werkgewer die werker betaal. Ons sal deursigtig wees as dit ooit verander.",
  "hiw.know.payment.t": "Betaling",
  "hiw.know.payment.b":
    "Betaling word direk tussen werkgewer en werker met voltooiing hanteer — óf kontant óf EFT, gekies wanneer die werk geplaas word. Betaal nooit vooraf nie. Aanvaar nooit betaling vir werk wat jy nie gedoen het nie.",
  "hiw.know.trust.t": "Vertroue + veiligheid",
  "hiw.know.trust.b":
    "Werker-verifikasie, graderings aan albei kante, in-app boodskappe, lewendige ligging, 'n nood-SAPD-knoppie, fotobewys, en 'n dispuutstelsel wat deur 'n regte admin hersien word.",
  "hiw.know.trust.link": "Lees die veiligheidsgids →",
  "hiw.know.disputes.t": "Dispute",
  "hiw.know.disputes.b":
    "As iets verkeerd loop — nie-opdaag, skade, betaling geweier, werk nie gedoen nie — kan enige kant 'n dispuut op die werkblad opper. Die werk word onderbreek, en ons admin-span hersien die boodskappe, foto's, en graderings.",
  "hiw.know.where.t": "Waar ons werk",
  "hiw.know.where.b":
    "Workit word in Gauteng bekendgestel. Ander provinsies kom binnekort — registreer enige plek, jy sal 'n e-pos kry wanneer ons naby jou oopmaak.",
  "hiw.know.cats.t": "Kategorieë",
  "hiw.know.cats.b":
    "Van tuinmaak en loodgietery tot onderrig en geleentheidswerk — meer as 'n dosyn kategorieë van eerlike werk.",
  "hiw.know.cats.link": "Sien die volledige lys →",
  "hiw.faq.h2": "Algemene vrae",
  "hiw.faq.q1": "Is Workit gratis om te gebruik?",
  "hiw.faq.a1":
    "Ja — tydens die bekendstelling gebruik beide werkgewers en werkers Workit gratis. Ons neem nie 'n sny van die ooreengekome prys nie.",
  "hiw.faq.q2": "Kan ek werke plaas of neem sonder om geverifieer te wees?",
  "hiw.faq.a2":
    "Werkgewers kan dadelik plaas. Werkers kan blaai en aanbiedinge stuur sonder om geverifieer te wees, maar die meeste werkgewers sal verkies om Geverifieerde werkers te huur — veral vir werke binne hul huis. Verifikasie neem gewoonlik 24–48 uur.",
  "hiw.faq.q3": "Wat gebeur as 'n werker nie opdaag nie?",
  "hiw.faq.a3":
    "Gebruik eers die in-app klets om te vra wat aangaan. As hulle nie opdaag nie, opper 'n dispuut vanaf die werkblad — ons admin-span hersien en help om dit op te los, en dit beïnvloed die werker se gradering voortaan.",
  "hiw.faq.q4": "Wat gebeur as 'n werkgewer weier om te betaal?",
  "hiw.faq.a4":
    "Dieselfde proses van die werker se kant af — opper 'n dispuut op die werkblad. Fotobewys van voltooide werk en die in-app kletsgeskiedenis is wat ons gebruik om dit op te los.",
  "hiw.faq.q5": "Kan ek my rekening uitvee?",
  "hiw.faq.a5":
    "Ja. Maak jou profiel oop, rol af na Jou dataregte, en tik Versoek rekeninguitvee. Ons verwerk versoeke binne 7 dae onder POPIA.",
  "hiw.faq.q6": "Wat van die res van Suid-Afrika?",
  "hiw.faq.a6":
    "Ons stel in Gauteng bekend sodat ons seker kan maak die ervaring is wonderlik voor ons uitbrei. Ander provinsies sal volg — registreer waar jy ook al is en jy sal die eerste wees om te weet.",
  "hiw.cta.h2": "Gereed om te begin?",
  "hiw.cta.post": "Plaas 'n werk",
  "hiw.cta.worker": "Registreer as 'n werker",

  // Auth — AF draft, needs native review
  "auth.or": "of",
  "auth.and": "en",
  "auth.privacyShort": "Privaatheid",
  "auth.tabPhone": "Foon",
  "auth.tabPhoneSms": "Foon (SMS)",
  "auth.tabEmail": "E-pos",
  "auth.google.default": "Gaan voort met Google",
  "auth.google.opening": "Open Google…",
  "auth.google.error": "Kon nie met Google aanmeld nie. Probeer asseblief weer.",
  "auth.role.needWork.title": "Ek het werk wat gedoen moet word",
  "auth.role.needWork.sub": "Huur geverifieerde werkers",
  "auth.role.doWork.title": "Ek wil werk",
  "auth.role.doWork.sub": "Vind werke naby my",
  "auth.biz.question": "Huur jy as 'n besigheid?",
  "auth.biz.no": "Nee, net ek",
  "auth.biz.yes": "Ja, ons is 'n besigheid",
  "auth.biz.note":
    "Besighede kry 'n openbare profielblad wat werkers kan deurblaai, plus die opsie van 'n CIPC-geverifieerde kenteken later.",
  "auth.field.fullName": "Volle naam",
  "auth.field.fullNamePh": "bv. Tshepo Mokoena",
  "auth.field.email": "E-posadres",
  "auth.field.emailPh": "jy@voorbeeld.com",
  "auth.field.emailHintSignup": "Ons stuur jou rekeningbesluit en werkopdaterings hierheen.",
  "auth.field.dob": "Geboortedatum",
  "auth.field.dobHint": "Jy moet 18 of ouer wees om Workit te gebruik.",
  "auth.field.mobile": "Selfoonnommer",
  "auth.field.mobilePh": "082 123 4567",
  "auth.field.mobileHint":
    "Slegs Suid-Afrikaanse selfoon (06x, 07x, 08x). Ons sal jou 'n 6-syfer-kode stuur.",
  "auth.field.password": "Wagwoord",
  "auth.consent.pre": "Ek stem in tot die",
  "auth.consent.terms": "Bepalings",
  "auth.consent.aup": "Aanvaarbare Gebruiksbeleid",
  "auth.consent.privacy": "Privaatheidsbeleid",
  "auth.phone.sendCode": "Stuur my 'n kode",
  "auth.phone.sending": "Stuur kode…",
  "auth.phone.smsRates": "Standaard SMS-tariewe kan op jou netwerk geld.",
  "auth.phone.codeSentPre": "Ons het 'n 6-syfer-kode gestuur na",
  "auth.phone.codeSentPost": ". Tik dit hieronder in. Kodes verval na 'n paar minute.",
  "auth.phone.codeLabel": "Verifikasiekode",
  "auth.phone.codePh": "123456",
  "auth.phone.verify": "Verifieer kode",
  "auth.phone.verifying": "Verifieer…",
  "auth.phone.wrongNumber": "Verkeerde nommer / stuur weer",
  "auth.phone.notArrive": "Nie opgedaag nie?",
  "auth.err.invalidPhone": "Voer 'n geldige SA selfoonnommer in (bv. 082 123 4567).",
  "auth.err.fullName": "Voer asseblief jou volle naam in.",
  "auth.err.email": "Voer asseblief 'n geldige e-posadres in.",
  "auth.err.under18": "Jy moet 18 of ouer wees om Workit te gebruik.",
  "auth.err.terms": "Aanvaar asseblief die Bepalings en Privaatheidsbeleid.",
  "auth.err.sendFail": "Kon nie kode stuur nie.",
  "auth.err.recaptcha": "reCAPTCHA het gefaal. Herlaai die bladsy en probeer weer.",
  "auth.err.tooMany": "Te veel pogings. Wag 'n paar minute en probeer weer.",
  "auth.err.notEnabled":
    "Foon-aanmelding is nie in hierdie projek geaktiveer nie. Vra Tshepo om dit in Firebase te aktiveer.",
  "auth.err.enterCode": "Voer die 6-syfer-kode in wat ons gestuur het.",
  "auth.err.verifyFail": "Kon nie kode verifieer nie.",
  "auth.err.codeMismatch": "Daardie kode stem nie ooreen nie. Kyk na die SMS en probeer weer.",
  "auth.err.codeExpired": "Kode het verval. Tik 'Stuur weer' vir 'n nuwe een.",
  "auth.err.passwordLen": "Wagwoord moet ten minste 8 karakters wees.",
  "auth.err.createFail": "Kon nie rekening skep nie.",
  // Sign-in page
  "signin.welcomePre": "Welkom terug by",
  "signin.lead":
    "Ons gebruik jou foonnommer — dieselfde een wat werkers en werkgewers sien. Eenmalige kode, geen wagwoord.",
  "signin.b1.t": "Geen wagwoord om te vergeet nie",
  "signin.b1.b": "Eenmalige kode per SMS — veilig, eenvoudig, werk op enige foon.",
  "signin.b2.t": "Lig op data",
  "signin.b2.b": "Gebou vir knap databegrotings. Jy bly 30 dae aangemeld.",
  "signin.b3.t": "Mense eerste",
  "signin.b3.b": "Jou nommer word net gedeel met werkers wat jy aanvaar, nooit met die publiek nie.",
  "signin.formTitle": "Meld aan of skep rekening",
  "signin.formSub": "Dieselfde vorm vir nuwe en terugkerende gebruikers.",
  "signin.forgot": "Wagwoord vergeet?",
  "signin.signingIn": "Meld aan…",
  "signin.noAccount": "Nog geen rekening nie?",
  "signin.createOne": "Skep een",
  "signin.byContinuingPre": "Deur voort te gaan, stem jy in tot ons",
  // Sign-up page
  "signup.badge": "Skep rekening",
  "signup.welcome": "Welkom by Workit.",
  "signup.intent": "Is jy hier om werk gedoen te kry, of om te werk?",
  "signup.googleLabel": "Registreer met Google",
  "signup.phoneLabel": "Foonnommer",
  "signup.phonePh": "+27 ...",
  "signup.phoneHint":
    "Werke word per foon/WhatsApp gereël. Jy sal hierdie nommer met 'n eenmalige SMS-kode op jou rekeningblad bevestig.",
  "signup.referralLabel": "Verwysingskode (opsioneel)",
  "signup.referralPh": "bv. 7K3X9P",
  "signup.referralHint": "As 'n vriend jou genooi het, plak hul kode hier.",
  "signup.passwordPh": "Ten minste 8 karakters",
  "signup.submitWorker": "Registreer as 'n werker",
  "signup.submitBusiness": "Skep besigheidsrekening",
  "signup.submitEmployer": "Registreer om werke te plaas",
  "signup.creating": "Skep rekening…",
  "signup.already": "Het jy reeds 'n rekening?",
  "signup.workerNotice.title": "Na registrasie moet jy verifieer",
  "signup.workerNotice.body":
    "SA ID, bewys van adres, en óf 'n kwalifikasie óf foto's van vorige werk ('n kort selfie-video is opsioneel maar versnel goedkeuring). Ons mik om binne 1–2 dae tydens die bekendstelling te hersien.",
  "signup.loading": "Laai…",

  // Verification page — AF draft, needs native review
  "ver.welcome.title": "Een laaste stap — stel jou rekening op",
  "ver.welcome.body":
    "Voeg jou besonderhede en dokumente hieronder by en dien in — dis al. 'n Regte persoon hersien elke werker om werkgewers veilig te hou, gewoonlik binne 1–2 dae. Totdat jy indien, bly jou rekening hangende.",
  "ver.hero.eyebrow": "Werker-verifikasie",
  "ver.hero.titleWelcome": "Voltooi die opstel van jou rekening.",
  "ver.hero.title": "Kom ons kry jou geverifieer.",
  "ver.hero.intro":
    "Een vorm — jou besonderhede, vaardighede en dokumente. Ons hersien elke werker met die hand om werkgewers veilig te hou.",
  "ver.changes.title": "Een vinnige regstelling nodig voor ons jou kan goedkeur",
  "ver.changes.body":
    "Stel dit hieronder reg en druk Dien in — jy gaan reguit terug in die hersieningstou.",
  "ver.status.current": "Huidige status:",
  "ver.status.note": "Nota van hersiening:",
  "ver.done.worker": "Ingedien. Tshepo sal hersien en jou status binnekort opdateer.",
  "ver.id.number": "SA ID-nommer",
  "ver.id.numberPh": "13 syfers",
  "ver.id.invalidShort": "Dit lyk nie soos 'n geldige SA ID nie.",
  "ver.id.dobMismatchWorker":
    "Hierdie ID se geboortedatum stem nie ooreen met die een op jou rekening nie. Kyk dubbel of jy dit reg getik het.",
  "ver.id.dobMismatchEmp":
    "Hierdie ID se geboortedatum stem nie ooreen met jou rekening nie. Kyk dit dubbel na.",
  "ver.id.valid": "Geldige SA ID-nommer",
  "ver.id.born": "gebore",
  "ver.f.idPhoto": "Foto van jou SA ID",
  "ver.f.idPhotoReplace": "Vervang ID-foto",
  "ver.f.idPhotoUpload": "Laai ID-foto op",
  "ver.f.idPhotoHint":
    "Duidelike foto van albei kante van jou ID, of 'n PDF-kopie. Net jy en ons hersieningspan kan dit sien.",
  "ver.f.idPhotoHintEmp":
    "Duidelike foto van albei kante, of 'n PDF. Net jy en ons hersieningspan kan dit sien.",
  "ver.f.selfie":
    "Kort selfie-video (opsioneel, maar versnel goedkeuring — dit bewys die ID is joune)",
  "ver.f.selfieEmp": "Kort selfie-video (opsioneel — versnel goedkeuring)",
  "ver.f.selfieReplace": "Vervang selfie-video",
  "ver.f.selfieUpload": "Laai selfie-video op",
  "ver.f.selfieHint":
    "5-sekonde-video van jou gesig, tot 50 MB. Jy MOET sê: \"Hi, ek is [jou volle naam], sluit by Workit aan.\" Video's wat dit nie sê nie word verwerp.",
  "ver.f.selfieHintEmp":
    "5-sekonde-video van jou gesig, tot 50 MB. Jy MOET sê: \"Hi, ek is [jou volle naam], sluit by Workit aan.\"",
  "ver.f.address": "Adres",
  "ver.f.addressPh": "Straat, voorstad, stad",
  "ver.f.locLabel": "Speld jou tuisbasis vas (sodat werke naby jou eerste wys)",
  "ver.f.locHint":
    "Een tik — gebruik jou foon of skootrekenaar se GPS. Opsioneel, maar werke naby sal hoër vir jou rangeer. Jy kan later op jou profiel herspeld.",
  "ver.f.addrProof": "Bewys van adres",
  "ver.f.addrProofReplace": "Vervang bewys",
  "ver.f.addrProofUpload": "Laai bewys van adres op",
  "ver.f.addrProofHint": "Munisipale rekening, huurkontrak, of beëdigde verklaring — onder 3 maande oud.",
  "ver.f.skills": "Vaardighede + ervaring",
  "ver.f.skillsPh": "Wat kan jy doen? Jare se ervaring? Enige sertifikate?",
  "ver.f.pastWork": "Foto's van vorige werk (opsioneel, maar bou vertroue)",
  "ver.f.uploaded": "Opgelaai ✓",
  "ver.f.addPhoto": "Voeg 'n foto by",
  "ver.f.addPhotoHint": "Voeg soveel by as wat jy wil, een op 'n slag.",
  "ver.f.policeTitle": "Polisieklaring (opsioneel — ontsluit die Goud-kenteken)",
  "ver.f.policeBody1":
    "Laai 'n SAPD polisieklaring-sertifikaat op (onder 6 maande oud) en 'n admin sal jou die groen",
  "ver.f.policeBadge": "Agtergrond geverifieer",
  "ver.f.policeBody2":
    "Goud-kenteken na hersiening toeken. Werkgewers kan vir Goud-werkers filter — dis die topveiligheidsvlak op Workit. Slaan dit oor as jy nog nie een het nie; jy kan dit later byvoeg.",
  "ver.f.policeReplace": "Vervang polisieklaring",
  "ver.f.policeUpload": "Laai polisieklaring op",
  "ver.f.policeHint": "JPG, PNG, of PDF. Net jy en ons hersieningspan kan dit sien.",
  "ver.f.catsTitle": "Kategorieë en vaardighede waarin jy kan werk",
  "ver.f.catsHint":
    "Kies ten minste een kategorie en een spesifieke vaardigheid — dis hoe werkgewers wat die gids deursoek jou vind.",
  "ver.f.consentPre":
    "Ek stem in dat Workit (Furthersky Solutions) my SA ID-nommer, ID-foto, selfie-video en bewys van adres insamel en verwerk om my identiteit te verifieer, soos beskryf in die",
  "ver.f.consentPost":
    ". Ek verstaan hierdie dokumente word net deur Workit se hersieningspan gesien, en ek kan hul uitvee enige tyd versoek.",
  "ver.f.consentEmpPre":
    "Ek stem in dat Workit (Furthersky Solutions) my SA ID-nommer, ID-foto en selfie-video insamel en verwerk om my identiteit te verifieer, soos beskryf in die",
  "ver.f.consentEmpPost":
    ". Hierdie word net deur Workit se hersieningspan gesien, en ek kan hul uitvee enige tyd versoek.",
  "ver.f.saving": "Stoor…",
  "ver.f.submitContinue": "Dien in & gaan voort",
  "ver.f.submitReview": "Dien in vir hersiening",
  "ver.f.truth":
    "Deur in te dien bevestig jy alles hierbo is waar. Lieg kry jou permanent verban.",
  "ver.err.consent": "Merk asseblief die toestemmingsblokkie sodat ons jou ID en selfie kan verwerk.",
  "ver.err.idInvalid": "Daardie SA ID-nommer lyk nie geldig nie — kyk dit asseblief na.",
  "ver.err.under18": "Hierdie ID-nommer behoort aan iemand onder 18. Workit is net vir volwassenes (18+).",
  "ver.err.idPhoto": "Laai asseblief 'n duidelike foto van jou SA ID op — dit is verpligtend.",
  "ver.err.address": "Vul asseblief jou adres in — dit is verpligtend.",
  "ver.err.addrProof":
    "Laai asseblief bewys van adres op (munisipale rekening, huurkontrak, of beëdigde verklaring) — dit is verpligtend.",
  "ver.err.skills": "Beskryf asseblief jou vaardighede en ervaring — dit is verpligtend.",
  "ver.err.couldNotSubmit": "Kon nie indien nie.",
  "ver.emp.hero.eyebrow": "Werkgewer-verifikasie",
  "ver.emp.hero.title": "Verifieer jou identiteit.",
  "ver.emp.hero.intro":
    "Elke werker op Workit is ID-geverifieer — en dit werk altwee kante toe. Werkers kom in jou huis of besigheid in, so hulle verdien om te weet wie hulle aanstel. Jou ID ontsluit jou rekening en verdien die ✓ ID-geverifieer-kenteken wat werkers sien voordat hulle aanvaar; 'n kort selfie-video versnel goedkeuring.",
  "ver.emp.done": "Ingedien. Ons sal hersien en jou status binnekort opdateer.",
  "ver.ov.hero.eyebrow": "Vertroue & veiligheid",
  "ver.ov.hero.title": "Hoe werker-verifikasie werk.",
  "ver.ov.hero.intro":
    "Elke werker op Workit word deur 'n regte persoon hersien — nie 'n skrip nie — voordat hulle vir werke kan aansoek doen. Hierdie bladsy verduidelik wat ons nagaan, waarom, en hoe lank dit neem.",
  "ver.ov.ask.h": "Wat ons werkers vra",
  "ver.ov.ask.li1": "SA ID-nommer — 13 syfers, vergelyk met die foto hieronder.",
  "ver.ov.ask.li2": "Foto van hul SA ID — albei kante, of 'n PDF-kopie.",
  "ver.ov.ask.li3":
    "Kort selfie-video — ongeveer 5 sekondes, wat hul naam sê en dat hulle by Workit aansluit. Dit keer dat enigiemand met iemand anders se ID registreer.",
  "ver.ov.ask.li4":
    "Adres + bewys van adres — munisipale rekening, huurkontrak, of beëdigde verklaring, onder 3 maande oud.",
  "ver.ov.ask.li5": "Vaardigheidsopsomming — wat hulle kan doen, jare se ervaring, enige sertifikate.",
  "ver.ov.ask.li6": "Foto's van vorige werk — opsioneel, maar bou vinnig vertroue.",
  "ver.ov.ask.li7": "Werkkategorieë — vir watter soort werke hulle wil aansoek doen.",
  "ver.ov.proc.h": "Ons hersieningsproses",
  "ver.ov.proc.li1": "Die werker dien alle dokumente in die app in.",
  "ver.ov.proc.li2":
    "'n Menslike hersiener (op die oomblik is dit Tshepo) vergelyk die ID met die selfie-video, bevestig die adresbewys, en lees die vaardigheidsopsomming.",
  "ver.ov.proc.li3":
    "As iets nie klop nie, los ons 'n nota op die werker se profiel wat hulle vra om dit reg te stel.",
  "ver.ov.proc.li4":
    "Sodra goedgekeur, kry die werker 'n groen Geverifieer-kenteken wat oral wys — op hul aanbiedinge, op hul profiel, op die klets.",
  "ver.ov.proc.note":
    "Die meeste werkers word binne 24–48 uur op weeksdae hersien. Indienings oor naweke kan tot Maandag neem.",
  "ver.ov.why.h": "Waarom dit saak maak",
  "ver.ov.why.body":
    "Verifikasie hou werkgewers veiliger wanneer hulle iemand in hul huis toelaat, en gee eerlike werkers 'n manier om uit te staan. Werkers kan steeds aanbiedinge plaas sonder die kenteken terwyl hul hersiening hangende is, maar die meeste werkgewers verkies om Geverifieerde werkers aan te stel — veral vir werke wat kinders, troeteldiere, of beduidende kontant behels.",
  "ver.ov.docs.h": "Wat ons met jou dokumente doen",
  "ver.ov.docs.pre":
    "Verifikasie-dokumente word privaat gestoor en is net sigbaar vir jou en Workit se admin-hersieningspan. Ander gebruikers — werkgewers of ander werkers — sien nooit jou ID-nommer, ID-foto, selfie-video, of bewys van adres nie. Sien ons",
  "ver.ov.docs.post": "vir die volledige uiteensetting.",
  "ver.ov.ready.h": "Gereed om geverifieer te word?",
  "ver.ov.ready.body":
    "Jy sal 'n SA ID, 'n foon met 'n kamera, en ongeveer 5 minute nodig hê. Jy kan altyd later terugkom om klaar te maak.",
  "ver.ov.ready.gotoProfile": "Gaan na jou profiel",
  "ver.ov.ready.already": "Het jy reeds 'n rekening?",

  // Safety guide page — AF draft, needs native review
  "safety.badge": "Veiligheid",
  "safety.title": "Veiligheidsgids",
  "safety.intro":
    "Workit is gebou rondom werklike, persoonlike werk — die meeste werke gebeur by iemand se huis, besigheid, of erf. Ons het gereedskap in die app gesit om albei kante veiliger te hou, maar gesonde verstand bly jou beste vriend. Lees dit voor jou eerste werk.",
  "safety.tools.h2": "Die veiligheidsgereedskap ingebou in Workit",
  "safety.t1.h3": "1. Werker-verifikasie",
  "safety.t1.p":
    "Elke werker word deur 'n regte persoon in ons span hersien voor goedkeuring. Ons versamel hul SA ID-nommer, 'n foto van hul ID, bewys van adres, 'n vaardigheidsopsomming, en die kategorieë waarin hulle kan werk — baie voeg ook 'n kort selfie-video by vir ekstra identiteitsekerheid. Werkers met die groen Geverifieer-kenteken het hierdie kontrole geslaag.",
  "safety.t1.emp":
    "Werkgewers: verkies Geverifieerde werkers vir werke binne jou huis, of vir enigiets wat kontant, sleutels, of kinders behels.",
  "safety.t1.link": "Lees meer oor die verifikasieproses →",
  "safety.t2.h3": "2. Graderings en reputasie",
  "safety.t2.p":
    "Na elke bevestigde werk los albei kante 'n 1–5 ster-gradering met 'n opsionele nota. Werkers verdien ook reputasie-kentekens (Geverifieer, 5-ster-reekse, voltooide-werk-mylpale). Voor jy 'n aanbod aanvaar of vir 'n werk aansoek doen, tik die ander persoon se naam om hul geskiedenis te lees.",
  "safety.t3.h3": "3. In-app boodskappe",
  "safety.t3.p":
    "Sodra 'n werk toegewys is, gebruik die in-app klets om besonderhede te bevestig, hekkodes te deel, oor tydsberekening ooreen te kom, en vrae te vra. Dit hou 'n rekord op die werk — nuttig as daar ooit 'n dispuut is. Vermy om die gesprek na WhatsApp te skuif voordat julle ontmoet het.",
  "safety.t4.h3": "4. Lewendige ligging-deling (slegs werkers, opt-in)",
  "safety.t4.p":
    "Op die dag van die werk kan die toegewysde werker hul lewendige GPS met die werkgewer deel sodat die werkgewer weet wanneer hulle sal aankom. Werkers kan enige tyd ophou deel — deling stop outomaties wanneer die werk as klaar gemerk word.",
  "safety.t5.h3": "5. Noodknoppie — skakel SAPD 10111",
  "safety.t5.p":
    "Terwyl 'n werk aktief is, sien beide die werkgewer en die werker 'n rooi Noodknoppie op die werkblad. Een tik (met 'n bevestigingsprompt sodat jy dit nie per ongeluk druk nie) en jou foon skakel die Suid-Afrikaanse Polisiediens se noodlyn op 10111. Ons teken ook die sneller aan by die werk sodat ons 'n rekord het as dit ooit nodig is.",
  "safety.t6.h3": "6. Dispuutstelsel",
  "safety.t6.p":
    "As iets verkeerd loop nadat 'n werker toegewys is — nie-opdaag, skade, betaling geweier, werk nie gedoen nie — kan enige kant 'n dispuut op die werkblad opper. Die werk word onderbreek, albei kante sien 'n banier, en ons admin-span tree in om boodskappe, foto's, en graderings te hersien om 'n uitkoms te help bereik.",
  "safety.t7.h3": "7. Fotobewys",
  "safety.t7.p":
    "Werkgewers kan foto's aanheg wanneer hulle 'n werk plaas (wat gedoen moet word). Werkers kan voor/na-foto's oplaai wanneer hulle die werk as klaar merk. Foto's beskerm almal — hulle maak graderings eerlik en dispute korter.",
  "safety.emp.h2": "Vir werkgewers — voor, tydens, en na",
  "safety.emp.before.h3": "Voor jy 'n aanbod aanvaar",
  "safety.emp.before.li1":
    "Tik die werker se naam en lees hul graderings, resensies, en aantal voltooide werke. Nuwe werkers kan wonderlik wees, maar balanseer die risiko met die grootte van die werk.",
  "safety.emp.before.li2":
    "Soek die Geverifieer-kenteken as die werk jou huis, jou gesin, of beduidende kontant behels.",
  "safety.emp.before.li3":
    "Gebruik die in-app boodskap om die prys, die datum, en die adres te bevestig voor jy aanvaar. Kry die besonderhede op skrif.",
  "safety.emp.day.h3": "Op die dag",
  "safety.emp.day.li1":
    "Moenie vooraf betaal nie. Workit-werke is kontant of EFT met voltooiing — ooreengekom toe jy die werk geplaas het. Enigiemand wat 'n deposito vra voor hulle begin is 'n rooi vlag.",
  "safety.emp.day.li2":
    "Hê iemand by die huis saam met jou as jy kan. As jy alleen woon, laat 'n vriend weet wie kom en wanneer.",
  "safety.emp.day.li3": "Hou waardevolle items, kontant, en ID-dokumente uit sig.",
  "safety.emp.day.li4":
    "Gebruik die lewendige ligging-aansig sodat jy weet wanneer die werker naby is. Gebruik die Noodknoppie as enigiets verkeerd voel.",
  "safety.emp.after.h3": "Na die werk",
  "safety.emp.after.li1":
    "Tik net Bevestig voltooiing sodra die werk tot jou tevredenheid gedoen is. Bevestiging ontsluit die graderingstap.",
  "safety.emp.after.li2":
    "Los 'n eerlike gradering — gawe werkers verdien krediet, en ander werkgewers steun op jou terugvoer.",
  "safety.emp.after.li3":
    "As iets verkeerd geloop het, opper 'n dispuut vanaf die werkblad voor jy bevestig.",
  "safety.wk.h2": "Vir werkers — voor, tydens, en na",
  "safety.wk.before.h3": "Voor jy 'n aanbod stuur",
  "safety.wk.before.li1":
    "Lees die volle werkbeskrywing. Kyk na die voorstad, die voorgestelde prys, die gereedskap/ervaring-vereistes, en die ooreengekome betaalmetode (kontant of EFT met voltooiing).",
  "safety.wk.before.li2":
    "Tik die werkgewer se naam en kyk na hul geskiedenis — hoeveel werke hulle geplaas het, hoe hulle vorige werkers gegradeer het, en of hulle dispute gehad het.",
  "safety.wk.before.li3":
    "Stuur net 'n aanbod teen 'n prys waarvoor jy werklik bereid is om die werk te doen — insluitend vervoer.",
  "safety.wk.day.h3": "Op die dag",
  "safety.wk.day.li1":
    "Vertel 'n familielid of vriend waarheen jy gaan, die werkgewer se naam, en ongeveer wanneer jy terug sal wees.",
  "safety.wk.day.li2":
    "Skakel lewendige ligging-deling aan vanaf die werkblad — dit laat die werkgewer jou aankoms volg, en skep 'n rekord van waar jy was.",
  "safety.wk.day.li3":
    "Neem 'n voor-foto wanneer jy aankom en 'n na-foto wanneer jy klaar is. Heg albei aan via die foto-oplaaier. Dit beskerm jou as die werkgewer bevraagteken of die werk gedoen is.",
  "safety.wk.day.li4":
    "As jy aankom en die situasie onveilig voel (iemand anders as die werkgewer is daar, die werk verskil van wat beskryf is, jy word gevra om iets onwettig te doen) — gaan weg. Opper 'n dispuut vanaf die werkblad. Gebruik die Noodknoppie as jy in onmiddellike gevaar is.",
  "safety.wk.after.h3": "Na die werk",
  "safety.wk.after.li1":
    "Merk die werk as klaar in die app sodra die werk voltooi is. Die werkgewer bevestig, en julle gradeer mekaar.",
  "safety.wk.after.li2":
    "As die werkgewer weier om te betaal of nie wil bevestig nie, opper 'n dispuut. Moenie weggaan met 'n betaling verskuldig nie — teken dit eers aan.",
  "safety.rf.h2": "Rooi vlae — vir almal",
  "safety.rf.li1":
    "Enigiemand wat jou vra om buite die app te betaal of betaal te word voordat julle ontmoet het en die werk klaar is.",
  "safety.rf.li2": "Druk om die verifikasie, die dispuutstelsel, of die graderingstap oor te slaan.",
  "safety.rf.li3":
    "Versoeke vir ID-kopieë, bankbesonderhede, of jou wagwoord oor klets gestuur (ons vra nooit hiervoor nie — bankinligting bly tussen jou en die persoon wat betaal, net nadat die werk gedoen is).",
  "safety.rf.li4": "Adresse wat nie bestaan nie of op die laaste oomblik verander.",
  "safety.rf.li5":
    "Kontant-hantering-werke waarvoor jy nie aangemeld het nie (geld vir 'n vreemdeling invorder, koeverte aflewer).",
  "safety.em.h2": "Noodnommers in Suid-Afrika",
  "safety.em.saps": "SAPD (Polisie):",
  "safety.em.sapsNote": "· ook ingebou in die Noodknoppie op elke aktiewe werkblad.",
  "safety.em.ambulance": "Ambulans / brand:",
  "safety.em.national": "Nasionale nood (vanaf 'n selfoon):",
  "safety.em.gbv": "GBV-bevelsentrum:",
  "safety.report.h2": "Rapportering en admin",
  "safety.report.pre":
    "As iets gebeur wat die dispuutstelsel nie kan hanteer nie — teistering, diefstal, dreigemente, bedrog — stuur ons direk 'n e-pos by",
  "safety.report.post":
    "met die werk-ID en soveel besonderhede as wat jy kan. Ons hersien elke verslag met die hand. Ernstige oortredings sal van Workit verban word en, waar toepaslik, by SAPD aangemeld word.",
  "safety.closing":
    "Bly veilig daar buite. Workit werk net wanneer die gemeenskap mekaar vertrou — elke eerlike gradering, fotobewys, en dispuutverslag wat jy indien maak die volgende persoon se werk 'n bietjie veiliger.",

  // WhatsApp-werkwaarskuwings
  "waalerts.title": "WhatsApp-werkwaarskuwings",
  "waalerts.onDesc":
    "Aan — ons WhatsApp jou wanneer 'n passende werk geplaas word. Antwoord 1 om aan te bied, of stuur JOBS enige tyd om oop werk naby te sien.",
  "waalerts.offDesc":
    "Kry werkwaarskuwings op WhatsApp — min data, geen app nodig nie. Antwoord 1 om dadelik 'n aanbod te stuur.",
  "waalerts.numberLabel": "WhatsApp-nommer",
  "waalerts.numberHint": "SA-nommer, bv. 067 748 2643. Ons stuur net werkwaarskuwings — nooit jou ID of iemand se adres nie.",
  "waalerts.consent":
    "Ek stem in om werkwaarskuwings op WhatsApp te ontvang. Ek kan enige tyd STOP antwoord.",
  "waalerts.titleEmployer": "Huur op WhatsApp",
  "waalerts.onDescEmployer":
    "Aan — ons stuur jou 'n WhatsApp wanneer 'n werker 'n aanbod maak. Antwoord OFFERS om te sien, dan ACCEPT of DECLINE hier.",
  "waalerts.offDescEmployer":
    "Kry aanbodwaarskuwings op WhatsApp en huur sonder om die app oop te maak — sien aanbiedinge en kies die regte werker met een antwoord.",
  "waalerts.consentEmployer":
    "Ek stem in om aanbodwaarskuwings op WhatsApp te ontvang. Ek kan enige tyd STOP antwoord.",
  "waalerts.turnOn": "Skakel aan",
  "waalerts.turnOff": "Skakel af",
  "waalerts.saving": "Stoor tans…",
  "waalerts.on": "Aan",
  "waalerts.invalidNumber": "Voer 'n geldige Suid-Afrikaanse selfoonnommer in.",
};

export default af;
