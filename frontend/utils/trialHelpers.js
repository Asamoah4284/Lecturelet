/**
 * Trial Helper Functions
 * Utility functions for checking trial status and access
 */

/**
 * Check if trial is currently active
 * @param {string|Date} trialEndDate - Trial end date
 * @returns {boolean} True if trial is active
 */
export const isTrialActive = (trialEndDate) => {
  if (!trialEndDate) return false;
  const endDate = new Date(trialEndDate);
  const now = new Date();
  return now < endDate;
};

/**
 * Get number of days remaining in trial
 * @param {string|Date} trialEndDate - Trial end date
 * @returns {number|null} Days remaining or null if no trial
 */
export const getDaysRemaining = (trialEndDate) => {
  if (!trialEndDate) return null;
  const endDate = new Date(trialEndDate);
  const now = new Date();
  if (now >= endDate) return 0;
  const diffTime = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return daysRemaining;
};

/**
 * Check if user has active access (payment OR active trial)
 * @param {boolean} paymentStatus - User's payment status
 * @param {string|Date} trialEndDate - Trial end date
 * @returns {boolean} True if user has active access
 */
export const hasActiveAccess = (paymentStatus, trialEndDate) => {
  if (paymentStatus) return true;
  return isTrialActive(trialEndDate);
};

/**
 * Get trial status information
 * @param {object} userData - User data object
 * @returns {object} Trial status information
 */
export const getTrialStatus = (userData) => {
  if (!userData) {
    return {
      isActive: false,
      daysRemaining: null,
      hasAccess: false,
      isExpired: false,
    };
  }

  const trialActive = isTrialActive(userData.trial_end_date);
  const daysRemaining = getDaysRemaining(userData.trial_end_date);
  const hasAccess = hasActiveAccess(userData.payment_status, userData.trial_end_date);
  const isExpired = userData.trial_end_date && !trialActive && !userData.payment_status;

  return {
    isActive: trialActive,
    daysRemaining,
    hasAccess,
    isExpired,
    trialStartDate: userData.trial_start_date,
    trialEndDate: userData.trial_end_date,
  };
};



