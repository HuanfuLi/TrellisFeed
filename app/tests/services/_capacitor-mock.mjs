/**
 * Mock @capacitor/core for Node.js test environment.
 */

export const Capacitor = {
  isNativePlatform: () => false,
};

export const CapacitorHttp = {
  post: async () => ({ status: 200, data: {} }),
};
