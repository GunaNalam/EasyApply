# EasyApply

A Chrome extension (Manifest V3) that fills job applications from your profile and the answers you have saved. It never clicks Submit: you review every answer and submit yourself.

## Install and build

Requires Node 18 or newer.

```bash
npm install
npm run build      # typecheck, then build everything into dist/
npm test           # unit tests (vitest + jsdom)
```

`npm run dev` rebuilds the side panel on change. The content script and service worker are only rebuilt by `npm run build`.

## Load it in Chrome

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick the `dist/` folder.
3. Pin EasyApply from the puzzle-piece menu. Clicking its icon opens the side panel.

After every `npm run build`, press the reload icon on the EasyApply card in `chrome://extensions`, then reload the page you are testing.

## Use it

1. **Profile tab**: check the details (prefilled from the resume), upload your resume PDF, and press Save.
2. Open an application form. On pages that look like job applications a **⚡ EasyApply: Autofill** button appears at the bottom right. You can also press **Alt+Shift+F**, or use **Autofill this page** in the side panel.
3. Every question gets a badge:
   - **P**: from your profile
   - **CV**: resume uploaded
   - **R**: default rule (for example "worked here before?" is No unless the company is in your past companies)
   - **M**: an answer you saved earlier
   - **?**: needs you
   - an amber ring means low confidence, so check it
4. Fill the red **?** questions yourself. Press **+** next to a question, or **Save all answers**, so EasyApply remembers them for next time. `{company}` in a saved answer is replaced with the hiring company's name.
5. Review everything, then click the site's own Submit button. The application is logged in the **Applied** tab, or press **Mark applied**.

Fields that already have a value are never overwritten. Consent and terms checkboxes are never ticked.

**Backup tab**: export or import your profile, answers, resume and applications as JSON.

## Try it on the sample form

`test-pages/sample-form.html` is a local copy of a Greenhouse-style application. It has text fields, a resume upload, worked-here-before, relatives and sponsorship questions, custom questions, and an EEO section. Two ways to open it:

- Run `npm run test-page` and open <http://localhost:5174/sample-form.html>.
- Or open the file directly. First turn on **Allow access to file URLs** on the extension's Details page in `chrome://extensions`.

Expected result: the profile fields, resume, worked-before (No), relatives (No), sponsorship (No), work authorisation (Yes) and the EEO dropdowns (decline) are filled. "Why Acme Robotics?", the project question and the consent checkbox are marked **?**. Submitting the sample form sends nothing.

## Layout

| Path | What it does |
| --- | --- |
| `src/shared/` | Types, text matching, profile and label mapping, default rules, the brain (which value each field gets), storage |
| `src/content/` | Field scanning, React-safe filling, company detection, on-page badges and review panel |
| `src/background/` | Opens the side panel and handles the keyboard shortcut |
| `src/sidepanel/` | React UI: Fill, Profile, Answers, Applied, Backup |
| `tests/` | Unit tests, plus an end-to-end test over the sample form |

How the brain picks a value: resume upload, then profile field, then a strong saved-answer match (≥ 0.8), then the default rules, then a weaker saved match (≥ 0.6). Anything left is marked "needs you".
