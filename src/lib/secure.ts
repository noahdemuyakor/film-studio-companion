"use client";
/**
 * API keys are encrypted with AES-GCM before they are stored. The device key is a
 * non-extractable CryptoKey kept in IndexedDB, so the stored ciphertext is useless
 * if copied out of localStorage on its own.
 */
const DB = "fsc-keys";
const STORE = "k";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deviceKey(): Promise<CryptoKey> {
  const db = await openDb();
  const existing: CryptoKey | undefined = await new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get("device");
    r.onsuccess = () => resolve(r.result as CryptoKey | undefined);
    r.onerror = () => resolve(undefined);
  });
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(key, "device");
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  return key;
}

function b64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function unb64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await deviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(enc?: string): Promise<string> {
  if (!enc) return "";
  try {
    const [, iv, ct] = enc.split(".");
    const key = await deviceKey();
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return "";
  }
}

export function maskSecret(enc?: string) {
  return enc ? "•••••••• (encrypted on this device)" : "Not set";
}
