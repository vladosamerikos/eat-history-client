const splitList = (value: string | undefined, fallback: string[]): string[] =>
  value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;

export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'FoodCommit',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/v1',
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL ?? '',
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '',
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE ?? 'en',
  supportedLocales: splitList(import.meta.env.VITE_SUPPORTED_LOCALES, ['es', 'en', 'uk']),
} as const;
