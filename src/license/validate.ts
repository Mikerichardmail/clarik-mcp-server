// ─── License Validation ───
// Validates license keys against Gumroad API.
// NEVER stores {valid: true} — always stores the full signed response + SHA-256 hash.
// Cache valid for 24 hours. Falls back to grace period on failure.

import { LicenseCache, LicenseStatus, LicenseTier } from '../types.js';
import {
  getLicensePath,
  readJson,
  writeJsonAtomic,
  sha256,
} from '../storage.js';
import { checkGracePeriod, updateGraceExpiry } from './grace.js';

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
const GUMROAD_PRODUCT_ID = process.env.CLARIK_GUMROAD_PRODUCT_ID || 'ClaricRPCFramework';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_CACHE: LicenseCache = {
  signedResponse: '',
  responseHash: '',
  validUntil: '',
  offlineGraceExpiry: '',
};

/** Parse the Gumroad response to determine tier */
function parseTier(rawResponse: string): LicenseTier {
  try {
    const data = JSON.parse(rawResponse);
    const variant = (data?.purchase?.variants ?? '').toLowerCase();
    if (variant.includes('team')) return 'team';
    if (variant.includes('pro') || data?.success === true) return 'pro';
    return 'free';
  } catch {
    return 'free';
  }
}

/** Check if the cached license is still valid (within 24h window) */
function isCacheValid(cache: LicenseCache): boolean {
  if (!cache.signedResponse || !cache.validUntil) return false;

  // Verify hash integrity
  const expectedHash = sha256(cache.signedResponse);
  if (expectedHash !== cache.responseHash) {
    console.error('[clarik] License cache hash mismatch — cache tampered');
    return false;
  }

  const now = new Date();
  const validUntil = new Date(cache.validUntil);
  return now < validUntil;
}

/**
 * Validate a license key against Gumroad API.
 * Stores the full signed response + SHA-256 hash. NEVER stores {valid: true}.
 */
export async function validateLicense(key: string): Promise<LicenseStatus> {
  try {
    // Attempt online validation
    const response = await fetch(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: GUMROAD_PRODUCT_ID,
        license_key: key,
        increment_uses_count: 'false',
      }),
    });

    const rawResponse = await response.text();
    const data = JSON.parse(rawResponse);

    if (data.success) {
      const tier = parseTier(rawResponse);
      const now = new Date();
      const validUntil = new Date(now.getTime() + CACHE_DURATION_MS);
      const graceExpiry = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days

      // Store full signed response + hash — NEVER store {valid: true}
      const cache: LicenseCache = {
        signedResponse: rawResponse,
        responseHash: sha256(rawResponse),
        validUntil: validUntil.toISOString(),
        offlineGraceExpiry: graceExpiry.toISOString(),
      };

      await writeJsonAtomic(getLicensePath(), cache);
      await updateGraceExpiry();

      return {
        tier,
        isValid: true,
        isOffline: false,
        graceDaysRemaining: 5,
        expiresAt: validUntil.toISOString(),
      };
    }

    // Invalid key
    return {
      tier: 'free',
      isValid: false,
      isOffline: false,
      graceDaysRemaining: 0,
    };
  } catch (error) {
    // Network error — check grace period
    console.error('[clarik] License validation failed, checking grace period:', error);
    return handleOfflineValidation();
  }
}

/**
 * Get current license status from cache.
 * Returns free tier if no license key is found.
 */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  try {
    const cache = await readJson<LicenseCache>(getLicensePath(), DEFAULT_CACHE);

    // No cached license — free tier
    if (!cache.signedResponse) {
      return {
        tier: 'free',
        isValid: true,
        isOffline: false,
        graceDaysRemaining: 0,
      };
    }

    // Cache is still valid
    if (isCacheValid(cache)) {
      const tier = parseTier(cache.signedResponse);
      return {
        tier,
        isValid: true,
        isOffline: false,
        graceDaysRemaining: 5,
        expiresAt: cache.validUntil,
      };
    }

    // Cache expired — check grace period
    return handleOfflineValidation();
  } catch (error) {
    console.error('[clarik] Error reading license status:', error);
    return {
      tier: 'free',
      isValid: true,
      isOffline: false,
      graceDaysRemaining: 0,
    };
  }
}

/** Handle offline/expired cache by falling back to grace period */
async function handleOfflineValidation(): Promise<LicenseStatus> {
  try {
    const grace = await checkGracePeriod();

    if (grace.isInGrace) {
      const cache = await readJson<LicenseCache>(getLicensePath(), DEFAULT_CACHE);
      const tier = cache.signedResponse ? parseTier(cache.signedResponse) : 'free';

      return {
        tier,
        isValid: true,
        isOffline: true,
        graceDaysRemaining: grace.daysRemaining,
      };
    }

    // Grace period expired
    return {
      tier: 'free',
      isValid: false,
      isOffline: true,
      graceDaysRemaining: 0,
    };
  } catch {
    return {
      tier: 'free',
      isValid: false,
      isOffline: true,
      graceDaysRemaining: 0,
    };
  }
}
