import { Capacitor } from '@capacitor/core';
import { SafeArea, SystemBarsStyle } from '@capacitor-community/safe-area';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
  type ApplicationVolumeOptions,
} from '@capacitor-community/admob';

const env = import.meta.env as Record<string, string | undefined>;
export const APP_ID = env.VITE_APP_ID ?? 'com.f7developer.backpackforge';
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;
export const REMOVE_ADS_PRODUCT = env.VITE_IAP_REMOVE_ADS_PRODUCT ?? 'remove_ads';

const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED = 'ca-app-pub-3940256099942544/5224354917';

const adIds = {
  banner: env.VITE_ADMOB_BANNER_ID ?? TEST_BANNER,
  interstitial: env.VITE_ADMOB_INTERSTITIAL_ID ?? TEST_INTERSTITIAL,
  rewarded: env.VITE_ADMOB_REWARDED_ID ?? TEST_REWARDED,
};

export const isNativePlatform = Capacitor.isNativePlatform();
export const usingTestAds = !env.VITE_ADMOB_APP_ID || env.VITE_ADMOB_APP_ID === TEST_APP_ID;
export const isIapConfigured = Boolean(REMOVE_ADS_PRODUCT);

let adsInitialized = false;
let bannerVisible = false;
let interstitialReady = false;
let interstitialAdId = '';
let rewardedReady = false;
let rewardedAdId = '';
let lastInterstitialAt = -Infinity;
let billingReady = false;
let safeBottomInset = 0;

function measureSafeBottomInset(): number {
  try {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom, 0px);pointer-events:none;visibility:hidden;';
    document.body.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    safeBottomInset = Math.max(0, Math.ceil(height));
  } catch {
    safeBottomInset = 0;
  }
  return safeBottomInset;
}

async function requestConsent(): Promise<boolean> {
  let info = await AdMob.requestConsentInfo();
  if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
    info = await AdMob.showConsentForm();
  }
  return info.canRequestAds;
}

async function initializeSdk(): Promise<void> {
  if (adsInitialized) return;
  await AdMob.initialize({
    initializeForTesting: usingTestAds,
    testingDevices: (env.VITE_ADMOB_TEST_DEVICES ?? '').split(',').map((id) => id.trim()).filter(Boolean),
    tagForUnderAgeOfConsent: true,
    maxAdContentRating: MaxAdContentRating.General,
  });
  adsInitialized = true;
}

async function preloadInterstitial(): Promise<void> {
  if (!adsInitialized || interstitialReady) return;
  try {
    const result = await AdMob.prepareInterstitial({ adId: adIds.interstitial });
    interstitialAdId = result.adUnitId;
    interstitialReady = true;
  } catch {
    interstitialReady = false;
  }
}

async function preloadRewarded(): Promise<void> {
  if (!adsInitialized || rewardedReady) return;
  try {
    const result = await AdMob.prepareRewardVideoAd({ adId: adIds.rewarded });
    rewardedAdId = result.adUnitId;
    rewardedReady = true;
  } catch {
    rewardedReady = false;
  }
}

export async function initializeNative(removeAds: boolean): Promise<void> {
  if (!isNativePlatform) return;
  try {
    await SafeArea.setSystemBarsStyle({ style: SystemBarsStyle.Dark });
    measureSafeBottomInset();
  } catch {
    // SafeArea plugin is optional in web previews.
  }
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#F4E8CF' });
  } catch {
    // The web preview and non-Android native hosts do not expose status-bar styling.
  }
  try {
    if (!(await requestConsent())) return;
    await initializeSdk();
    if (!removeAds) await showBannerAd();
    await Promise.all([preloadInterstitial(), preloadRewarded()]);
  } catch {
    adsInitialized = false;
  }
}

export async function showBannerAd(): Promise<void> {
  if (!isNativePlatform || bannerVisible || !adsInitialized) return;
  try {
    await AdMob.showBanner({
      adId: adIds.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: safeBottomInset,
    });
    bannerVisible = true;
    window.dispatchEvent(new CustomEvent('backpack-forge:ad-space', { detail: true }));
  } catch {
    bannerVisible = false;
  }
}

export async function hideBannerAd(): Promise<void> {
  if (!isNativePlatform || !bannerVisible) return;
  try {
    await AdMob.hideBanner();
  } finally {
    bannerVisible = false;
    window.dispatchEvent(new CustomEvent('backpack-forge:ad-space', { detail: false }));
  }
}

export async function updateAdMute(muted: boolean, volume: number): Promise<void> {
  if (!isNativePlatform || !adsInitialized) return;
  try {
    await AdMob.setApplicationMuted({ muted });
    const rounded = Math.round(Math.max(0, Math.min(1, volume)) * 10) / 10;
    await AdMob.setApplicationVolume({ volume: rounded as ApplicationVolumeOptions['volume'] });
  } catch {
    // Ad SDK audio settings are optional on older native bridges.
  }
}

export async function showInterstitialAtBreak(): Promise<boolean> {
  if (!isNativePlatform || !adsInitialized || !interstitialReady) return false;
  const now = Date.now();
  if (now - lastInterstitialAt < 90_000) return false;
  try {
    await AdMob.showInterstitial({ adId: interstitialAdId });
    lastInterstitialAt = now;
    interstitialReady = false;
    void preloadInterstitial();
    return true;
  } catch {
    interstitialReady = false;
    void preloadInterstitial();
    return false;
  }
}

export async function showRewardedAd(): Promise<boolean> {
  if (!isNativePlatform) return import.meta.env.DEV;
  if (!adsInitialized) return false;
  try {
    if (!rewardedReady) {
      const result = await AdMob.prepareRewardVideoAd({ adId: adIds.rewarded });
      rewardedAdId = result.adUnitId;
      rewardedReady = true;
    }
    const reward = await AdMob.showRewardVideoAd({ adId: rewardedAdId });
    rewardedReady = false;
    void preloadRewarded();
    return Boolean(reward.type);
  } catch {
    rewardedReady = false;
    void preloadRewarded();
    return false;
  }
}

async function setupBilling(onPurchased: () => void): Promise<void> {
  if (billingReady) return;
  const { store, ProductType, Platform } = await import('capacitor-plugin-cdv-purchase');
  store.register({
    id: REMOVE_ADS_PRODUCT,
    type: ProductType.NON_CONSUMABLE,
    platform: Platform.GOOGLE_PLAY,
  });
  store.when().approved((transaction) => {
    if (!transaction.products.some((product) => product.id === REMOVE_ADS_PRODUCT)) return;
    onPurchased();
    void transaction.finish();
  });
  const errors = await store.initialize([Platform.GOOGLE_PLAY]);
  if (errors.length) throw new Error(errors[0].message);
  billingReady = true;
}

export async function initializeBilling(onPurchased: () => void): Promise<boolean> {
  if (!isNativePlatform || !isIapConfigured) return false;
  try {
    await setupBilling(onPurchased);
    return true;
  } catch {
    return false;
  }
}

export async function purchaseRemoveAds(onPurchased: () => void): Promise<'started' | 'unavailable' | 'failed'> {
  if (!isNativePlatform) return 'unavailable';
  try {
    await setupBilling(onPurchased);
    const { store, Platform } = await import('capacitor-plugin-cdv-purchase');
    const offer = store.get(REMOVE_ADS_PRODUCT, Platform.GOOGLE_PLAY)?.getOffer();
    if (!offer) return 'unavailable';
    const error = await store.order(offer);
    return error ? 'failed' : 'started';
  } catch {
    return 'failed';
  }
}

export async function restoreRemoveAds(onRestored: (owned: boolean) => void): Promise<boolean> {
  if (!isNativePlatform || !isIapConfigured) return false;
  try {
    await setupBilling(() => onRestored(true));
    const { store } = await import('capacitor-plugin-cdv-purchase');
    await store.restorePurchases();
    onRestored(store.owned(REMOVE_ADS_PRODUCT));
    return true;
  } catch {
    return false;
  }
}

export async function shareGame(): Promise<boolean> {
  const text = 'Backpack Forge: Idle Merge RPG — build your knight, forge powerful gear, and clear the valley.';
  try {
    if (isNativePlatform) {
      await Share.share({ title: 'Backpack Forge', text, url: PLAY_URL });
    } else if (navigator.share) {
      await navigator.share({ title: 'Backpack Forge', text, url: PLAY_URL });
    } else {
      await navigator.clipboard.writeText(`${text} ${PLAY_URL}`);
    }
    return true;
  } catch (error) {
    return !(error instanceof DOMException && error.name === 'AbortError');
  }
}

export function rateGame(): void {
  if (isNativePlatform) {
    window.location.href = `market://details?id=${APP_ID}`;
  } else {
    window.open(PLAY_URL, '_blank', 'noopener,noreferrer');
  }
}

export async function showPrivacyOptions(): Promise<void> {
  if (!isNativePlatform || !adsInitialized) return;
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch {
    // No privacy form is required for users outside configured consent geographies.
  }
}
