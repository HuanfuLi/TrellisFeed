/**
 * Module resolution hooks: redirect @capacitor/core to a mock.
 */

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@capacitor/core') {
    return {
      shortCircuit: true,
      url: new URL('./_capacitor-mock.mjs', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
