// src/purchases.ts
// RevenueCat wrapper. Everything StoreKit-related goes through here so the
// screens never touch the SDK directly.
//
// The native module only exists in a custom dev client or a real build — in
// Expo Go it is absent. Rather than crashing, we degrade to a clearly-marked
// simulator that ONLY works in development builds. It can never grant entitlement
// in a release binary; see `simulationAllowed` below.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

/** Must match the entitlement identifier configured in the RevenueCat dashboard. */
export const ENTITLEMENT_ID = 'pro';

/** Must match the product identifier in App Store Connect and RevenueCat. */
export const PRO_PRODUCT_ID = 'pro_unlock';

/** Thrown-free result type so screens can render a message without try/catch. */
export type PurchaseResult =
  | { status: 'purchased' }
  | { status: 'cancelled' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

function apiKey(): string | null {
  const key = Platform.OS === 'ios' ? extra.revenueCatApiKeyIos : extra.revenueCatApiKeyAndroid;
  if (!key || key.startsWith('REPLACE_WITH')) return null;
  return key;
}

/**
 * True when the RevenueCat native module is actually linked. False in Expo Go,
 * where `Purchases.configure` would throw on the missing native module.
 */
function nativeModuleAvailable(): boolean {
  // Expo Go reports 'expo'; a dev client or store build reports 'standalone'/undefined.
  return Constants.appOwnership !== 'expo';
}

/**
 * Purchase simulation is a development affordance only. `__DEV__` is false in
 * any release build, so a shipped binary can never take this path.
 */
const simulationAllowed = __DEV__ && !nativeModuleAvailable();

let configured = false;

export async function initPurchases(): Promise<void> {
  if (configured || !nativeModuleAvailable()) return;
  const key = apiKey();
  if (!key) {
    console.warn(
      '[purchases] No RevenueCat API key in app.json → extra. Purchases are disabled.'
    );
    return;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: key });
  configured = true;
}

function hasEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

/** Asks RevenueCat whether this user owns Pro. Never throws. */
export async function refreshProStatus(): Promise<boolean | null> {
  if (!configured) return null;
  try {
    return hasEntitlement(await Purchases.getCustomerInfo());
  } catch (err) {
    console.warn('[purchases] getCustomerInfo failed:', err);
    return null;
  }
}

/**
 * The Pro package from the current offering.
 *
 * Matches on product identifier rather than taking `availablePackages[0]`.
 * A dashboard offering can contain leftover sample packages, or get reordered
 * by someone editing it later — and position-based lookup would then silently
 * sell the wrong product. Falling back to the first package keeps a
 * single-package offering working even if the product ID is ever renamed.
 */
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const match = packages.find((p) => p.product.identifier === PRO_PRODUCT_ID);
    if (!match && packages.length > 1) {
      console.warn(
        `[purchases] No package for "${PRO_PRODUCT_ID}" in the current offering; ` +
          `falling back to "${packages[0]?.product.identifier}". Check the RevenueCat offering.`
      );
    }
    return match ?? packages[0] ?? null;
  } catch (err) {
    console.warn('[purchases] getOfferings failed:', err);
    return null;
  }
}

/** Localized price string for the button, or null to fall back to a default. */
export async function getProPriceString(): Promise<string | null> {
  const pkg = await getProPackage();
  return pkg?.product.priceString ?? null;
}

export async function purchasePro(): Promise<PurchaseResult> {
  if (simulationAllowed) {
    return { status: 'purchased' };
  }
  if (!configured) {
    return {
      status: 'unavailable',
      message:
        'In-app purchases need a development or production build. They cannot run in Expo Go.',
    };
  }

  const pkg = await getProPackage();
  if (!pkg) {
    return {
      status: 'unavailable',
      message: 'No products available. Check the RevenueCat offering and App Store Connect setup.',
    };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasEntitlement(customerInfo)
      ? { status: 'purchased' }
      : { status: 'error', message: 'Purchase completed but the entitlement was not granted.' };
  } catch (err) {
    // RevenueCat sets userCancelled on the error object for a normal user abort.
    if (err && typeof err === 'object' && (err as { userCancelled?: boolean }).userCancelled) {
      return { status: 'cancelled' };
    }
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return { status: 'error', message };
  }
}

export async function restorePro(): Promise<PurchaseResult> {
  if (simulationAllowed) {
    return { status: 'purchased' };
  }
  if (!configured) {
    return {
      status: 'unavailable',
      message:
        'Restoring purchases needs a development or production build. It cannot run in Expo Go.',
    };
  }

  try {
    const info = await Purchases.restorePurchases();
    return hasEntitlement(info)
      ? { status: 'purchased' }
      : { status: 'error', message: 'No previous purchase was found for this Apple ID.' };
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return { status: 'error', message };
  }
}
