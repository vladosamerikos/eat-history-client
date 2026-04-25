import { api } from '@/lib/api';

export interface PublicKeyResponse {
  publicKey: string | null;
  enabled: boolean;
}

export async function getPushPublicKey(): Promise<PublicKeyResponse> {
  return api('/push/public-key', { method: 'GET', auth: false });
}

export async function subscribePush(sub: PushSubscriptionJSON): Promise<{ ok: true }> {
  return api('/push/subscribe', {
    method: 'POST',
    json: { endpoint: sub.endpoint, keys: sub.keys },
  });
}

export async function unsubscribePush(endpoint: string): Promise<{ ok: true }> {
  return api('/push/subscribe', { method: 'DELETE', json: { endpoint } });
}

export async function sendTestPush(): Promise<{ sent: number; failed: number }> {
  return api('/push/test', { method: 'POST' });
}

/** Convierte la public key VAPID (base64url) a Uint8Array. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) out[i] = rawData.charCodeAt(i);
  return out;
}

export async function ensurePushSubscription(publicKey: string): Promise<PushSubscriptionJSON> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('unsupported');
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
  }
  return sub.toJSON();
}

export async function disablePushSubscription(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
