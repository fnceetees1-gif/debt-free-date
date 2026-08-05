// src/links.ts
//
// App Store Connect requires a reachable Privacy Policy URL and a Support URL,
// and any app with an IAP must link Terms of Use from the purchase screen.
// Apple loads these during review, so they must be live HTTPS pages — but no
// domain purchase is needed. GitHub Pages works: publish the `docs/` folder and
// the URLs become https://<user>.github.io/<repo>/privacy etc.
//
// TERMS_URL points at Apple's Standard EULA, which applies automatically unless
// you supply your own. Linking it satisfies the requirement with nothing to
// write or host. Only replace it if you have a custom EULA.

export const PRIVACY_POLICY_URL = 'https://fnceetees1-gif.github.io/debt-free-date/privacy';
export const SUPPORT_URL = 'https://fnceetees1-gif.github.io/debt-free-date/support';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
