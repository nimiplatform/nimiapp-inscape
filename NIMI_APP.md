# Inscape User Guide

Inscape is a private, local-first personality exploration and daily reflection space for adults (18+). Drawing on Jungian cognitive functions (Ni, Ne, Si, Se, Ti, Te, Fi, Fe), it helps you examine feelings, navigate choices, and understand adult relationships without locking you into a rigid four-letter label.

---

## Core Experience & Getting Started

### 1. Adult Attestation & Optional Starting Type
- On first launch, confirm that you are at least 18 years old and understand that Inscape is a personal reflection space rather than a psychological diagnostic tool.
- Choosing an initial 16-type code is optional—you can leave it unset and begin directly from everyday moments.

### 2. Start with a Real Moment (Today)
- In **Today**, check in with your current inner weather, draw a curiosity card, or jot down a real moment, mixed feeling, or lingering question.
- Save any entry as a plain private note, or choose **Let's look together** (**Behind the feeling**) to invite your local AI model to offer alternative cognitive-function readings.

### 3. Eight-Voice Inner Roundtable
- When facing a tough decision or inner tug-of-war, open **Inner roundtable**.
- Listen to all eight cognitive-function perspectives (`Ni`, `Ne`, `Si`, `Se`, `Ti`, `Te`, `Fi`, `Fe`) weigh in on the same situation with distinct observations and questions.
- Walk away with one tiny, concrete experiment you can try in daily life and mark it as tried afterward.

### 4. Resonance Feedback & User-Controlled Inner Map (About Me)
- Mark any AI reading as **This feels like me** or **Not quite me** (and toggle or withdraw your feedback anytime).
- **You control your map**: everyday feedback never rewrites your cognitive profile automatically. Your map updates only when you explicitly request a calibration, preview the bounded adjustment, and confirm it.
- Each note contributes at most one accepted calibration, and any accepted adjustment can be withdrawn at any time.

### 5. Adult Relationships & Communication Drafts (Between Us)
- Record personal observations and shared moments from adult-to-adult relationships (every added person requires an 18+ confirmation).
- Compare tentative cognitive-function lenses to unpack misunderstandings, or open **Finding the words** to rewrite a tense draft into three clearer, non-confrontational options you can copy and adapt.

---

## Local AI & Connection Requirements

- **Strictly Local Text Model**: Inscape runs AI reflections only through a **local text model** configured on your primary PC's Nimi Runtime (`text.generate`). It never falls back to or forwards your notes to cloud routes.
- **Desktop & Hosted Web**:
  - **Desktop**: Launch Inscape from Nimi Home. Your session follows Nimi Home's signed-in account.
  - **Hosted Web**: Open [Inscape on Nimi](https://nimi.ai/apps/inscape) or [inscape.nimi.xyz](https://inscape.nimi.xyz/), sign in with your Nimi account, confirm the source once in Nimi Home on your primary PC, and keep your primary PC's Nimi Home and Runtime online.
- **Offline Safety**: If your local model is unconfigured, offline, or busy, your notes still save safely; configure a local text model in **Settings & local data** (or Nimi Home) and retry when ready.

---

## Privacy, Data Storage & Controls

- **Where Your Data Lives**:
  - **Desktop & Hosted Web**: Adult attestation, field notes, relationships, AI readings, and your cognitive map are stored in your primary PC Runtime's private app storage (`nimi-mediated-default`), isolated by your Nimi account and app registration, and never uploaded to publisher or third-party cloud servers. You can clear the entire space at any time inside **Settings & local data**.
  - **Desktop Managed Container Preferences**: Non-sensitive interface preferences stored in the desktop managed container's browser technical profile (such as language selection) may remain on disk after uninstalling the app.
  - **Pre-0.1.9 Local SQLite Notice**: Earlier native pre-release builds stored data in a standalone SQLite database (`~/Library/Application Support/nimi.inscape/` or `%APPDATA%/nimi.inscape/`); version `0.1.9` switches Desktop to Nimi-mediated private app storage without automatic SQLite import.
- **Full Edit & Delete Control**: Notes and shared moments can be edited or permanently deleted one by one. Editing or deleting a note automatically removes readings based on the old text and withdraws any accepted profile calibration from that note.
- **Age-Context Review & Safeguards**: If text mentions an age that may refer to a minor, Inscape pauses only the related AI request so you can confirm whether it is a memory, quote, hypothetical, or current age. Confirmed under-18 records are quarantined out of all analysis and may be permanently deleted.

---

## Limitations & Help

- Inscape is exclusively for adults (18+) and offers structured perspectives for reflection—not clinical psychological assessment, medical diagnosis, or therapy.
- **Communication Rewrite** declines contexts involving money, employment or authority, sexual consent, or decision pressure/ultimatums. Refusals stay in local history so you can revise your wording or delete the record.
- Source code and issue support: [GitHub Repository](https://github.com/nimiplatform/nimiapp-inscape) · [Report an Issue](https://github.com/nimiplatform/nimiapp-inscape/issues)
