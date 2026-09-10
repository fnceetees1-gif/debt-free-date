// src/links.ts
//
// App Store Connect requires a reachable Privacy Policy URL and a Support URL,
// and any app with an IAP must link Terms of Use from the purchase screen.
// Apple loads these during review, so they must be live HTTPS pages.
//
// TERMS_URL used to point at Apple's Standard EULA, which applies by default
// when a developer supplies no terms of their own. That was fine while this was
// an iOS-only app. Once it shipped on Play it meant an Android user tapping
// "Terms of Use" was shown Apple's licence agreement — which does not govern a
// Google Play purchase, and reads as sloppy to anyone who actually taps it.
//
// It now points at our own page. Apple's required minimum terms live in a
// section of that page, so the App Store requirement is still met, and there is
// a matching section for Google Play.
//
// These were on GitHub Pages (`fnceetees1-gif.github.io/debt-free-date/...`,
// served from this repo's `docs/`) until September 2026. They now point at
// onyxoneapps.com, which is Onyx One LLC's own domain and already serves the
// store listings' privacy and support URLs — one set of legal pages covering
// both apps instead of a per-repo copy.
//
// The `docs/` folder is deliberately still published and MUST redirect rather
// than 404: every copy of 1.0.2 and earlier already installed has the old URLs
// compiled in, and those builds will keep requesting them forever. A user on an
// old version tapping "Privacy" must not get a dead page.

import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

export const PRIVACY_POLICY_URL = 'https://onyxoneapps.com/privacy.html';
export const SUPPORT_URL = 'https://onyxoneapps.com/support.html';
export const TERMS_URL = 'https://onyxoneapps.com/terms.html';

/**
 * Opens a link in an in-app browser rather than handing it to the system one.
 *
 * `Linking.openURL` launches Chrome or Safari as a separate app: you leave Debt
 * Free Date entirely, and getting back means the app switcher or the back
 * button. For three legal links in a settings list that is a heavy exit, and on
 * the paywall it is worse — reading the terms should not close the purchase.
 *
 * `openBrowserAsync` presents Chrome Custom Tabs on Android and
 * SFSafariViewController on iOS: the page appears over the app with its own
 * Done control, and dismissing it puts you back exactly where you were.
 *
 * Falls back to the system browser if the in-app one can't open, because a link
 * that opens awkwardly still beats a link that does nothing — and App Review
 * loads these pages.
 */
export async function openLink(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      // Match the app's chrome so the sheet doesn't arrive as a white slab.
      toolbarColor: '#1B1F3B',
      controlsColor: '#7CE0A0',
      // The toolbar holds the ONLY way back to the app. Bar collapsing hides it
      // as soon as you scroll — and these are long legal pages, so scrolling is
      // the first thing anyone does. That left no visible way out. Never
      // collapse a bar that carries the exit.
      enableBarCollapsing: false,
      showTitle: true,
      // iOS: an explicit "Close" rather than the default "Done", which reads as
      // completing something on a page you were only reading.
      dismissButtonStyle: 'close',
    });
  } catch (err) {
    console.warn('[links] in-app browser failed, falling back:', err);
    Linking.openURL(url).catch((e) => console.warn('[links] could not open', url, e));
  }
}
