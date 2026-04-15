/** No-op stub for settings.service.ts */
export const settingsService = {
  getSettings() {
    return { preferences: { onboardingCompleted: true } };
  },
};
