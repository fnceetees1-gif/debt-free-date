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

import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

export const PRIVACY_POLICY_URL = 'https://fnceetees1-gif.github.io/debt-free-date/privacy';
export const SUPPORT_URL = 'https://fnceetees1-gif.github.io/debt-free-date/support';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

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
      enableBarCollapsing: true,
    });
  } catch (err) {
    console.warn('[links] in-app browser failed, falling back:', err);
    Linking.openURL(url).catch((e) => console.warn('[links] could not open', url, e));
  }
}
