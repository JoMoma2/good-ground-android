# Connect feedback to your inbox

The app contains an in-app composer and direct Formspree submission flow. **The public form endpoint is now configured in both apps.** No Good Ground server, SMTP password or private API key is required. Formspree account settings and actual inbox delivery still need verification.

## Current connection

Both active sources and the 1.6.0 installers contain the public form ID **`moeeevrq`**, posting to **`https://formspree.io/f/moeeevrq`**. Submit is enabled. This is a public routing ID, not a private credential. No live test submission or inbox verification has been performed by development.

Before using the form with users:

1. In your existing Formspree account, confirm the destination email is verified and email notifications are enabled for this form.
2. Leave **Restrict to Domain** unset: the iPhone bundle uses a local file origin, while Android uses `appassets.androidplatform.net`. This is an installed app, not a website with a common referrer.
3. Keep basic spam filtering enabled. Disable the form's interactive reCAPTCHA requirement: this integration submits JSON without loading third-party challenge scripts. Required CAPTCHA produces an error and retains the draft. The `_gotcha` honeypot, length limits, one in-flight request and successful-send cooldown provide basic friction; monitor spam and quota in the dashboard.
4. Install the new 1.6.0 build over the same app/container, open More → Feedback, and submit a short test message. Verify the submission in both the Formspree dashboard and your inbox/spam folder. Include a reply address to check Reply-To. Repeat on both platforms, then check offline behavior.

## Changing the endpoint later

In both active sources, change `<meta name="good-ground-feedback-form" content="moeeevrq">` in `app/web/index.html`, then rebuild. Use only the public form ID, never account API keys or SMTP passwords. Clearing the ID disables submission while retaining compose/copy. Existing installed apps keep their bundled endpoint until updated.

As checked on 2026-10-25, Formspree's free plan offers **50 submissions per month**, AJAX submissions, basic spam filtering and a 30-day dashboard archive. Check current limits before relying on it for a larger audience. The owner created this form; no account or payment changes were made by development.

## What is sent

Only the typed message, optional reply email, a fixed “Good Ground feedback” subject and the empty spam trap. Formspree receives normal connection metadata, including the sender's IP address. No dog name, profile, notes, progress, journal, device identifier, backup or automatic diagnostic bundle is attached. The UI explains this and requires a consent checkbox. The optional email is for a reply, not the destination inbox; the destination lives in your Formspree dashboard.

Drafts live in page memory, survive in-app navigation while the page remains alive, and are never included in training saves/backups. They are lost on process restart/reload. Only a validated successful JSON acknowledgement clears a draft. A timeout or lost connection can leave delivery uncertain; the app does not retry automatically or claim an email reached the inbox. Network requests have a 15-second timeout, omit credentials/referrers, and reject redirects. Rate limit, quota, invalid response, configuration and CAPTCHA errors preserve the draft. Copy feedback offers a manual fallback.

## Networking

All training remains offline. The CSP permits connections only to `https://formspree.io/f/`; scripts and other runtime resources remain bundled. Android now has INTERNET permission and permits only HTTPS POST/OPTIONS requests to the public Formspree form path in its resource interceptor. Other remote resources remain blocked; user-tapped reference/privacy websites open externally. The iPhone native executable is unchanged; WKWebView uses the narrow bundled CSP. End-to-end delivery and installed iPhone networking still require the owner’s account settings and an actual device test.

## Provider decision

Formspree fits this small app because its public form endpoint sends submissions to a verified inbox without server credentials in the app. EmailJS adds a mail-service connection and public template/service configuration; Web3Forms is another hosted-form option; a mailto link hands the draft to another app and cannot confirm submission. Formspree is the implemented provider. An endpoint from a different service cannot simply be substituted: its payload, acknowledgement and networking policy would need adapting.

Official references:

- [Plans and limits](https://formspree.io/plans)
- [AJAX submissions](https://help.formspree.io/articles/building-your-form/submit-forms-with-javascript-ajax/)
- [Honeypot filtering](https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering/)
- [Domain restrictions](https://help.formspree.io/articles/form-and-project-settings/restrict-to-domain)
