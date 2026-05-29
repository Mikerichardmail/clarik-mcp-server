// ─── License Grace Period ───
// 5-day offline grace period from last successful validation.
// NEVER blocks work during grace period — only shows countdown warning.

import { LicenseCache } from '../types.js';
import {
  getLicensePath,
  readJson,
  writeJsonAtomic,
} from '../storage.js';

const GRACE_DAYS = 5;
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

const DEFAULT_CACHE: LicenseCache = {
  signedResponse: '',
  responseHash: '',
  validUntil: '',
  offlineGraceExpiry: '',
};

/**
 * Check if we are currently within the offline grace period.
 * Returns isInGrace and daysRemaining.
 * Show user: 'Offline mode — X days remaining'
 * NEVER block work during grace period.
 */
export async function checkGracePeriod(): Promise<{ isInGrace: boolean; daysRemaining: number }> {
  try {
    const cache = await readJson<LicenseCache>(getLicensePath(), DEFAULT_CACHE);

    if (!cache.offlineGraceExpiry) {
      return { isInGrace: false, daysRemaining: 0 };
    }

    const now = new Date();
    const expiry = new Date(cache.offlineGraceExpiry);
    const remainingMs = expiry.getTime() - now.getTime();

    if (remainingMs <= 0) {
      return { isInGrace: false, daysRemaining: 0 };
    }

    const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    return {
      isInGrace: true,
      daysRemaining,
    };
  } catch (error) {
    console.error('[clarik] Error checking grace period:', error);
    return { isInGrace: false, daysRemaining: 0 };
  }
}

/**
 * Update the grace period expiry to 5 days from now.
 * Called after each successful license validation.
 */
export async function updateGraceExpiry(): Promise<void> {
  try {
    const cache = await readJson<LicenseCache>(getLicensePath(), DEFAULT_CACHE);
    const now = new Date();
    const newExpiry = new Date(now.getTime() + GRACE_MS);

    const updated: LicenseCache = {
      ...cache,
      offlineGraceExpiry: newExpiry.toISOString(),
    };

    await writeJsonAtomic(getLicensePath(), updated);
  } catch (error) {
    console.error('[clarik] Error updating grace expiry:', error);
  }
}
