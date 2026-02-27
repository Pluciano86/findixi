import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const inMemoryStorage = new Map<string, string>();

function isWeb(): boolean {
  return Platform.OS === 'web';
}

function getWebStorage(): Storage | null {
  if (!isWeb()) return null;
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
}

async function secureSetItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureGetItem(key: string): Promise<string | null> {
  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue !== null) return secureValue;
  } catch {
    // ignore and fallback
  }
  return AsyncStorage.getItem(key);
}

async function secureRemoveItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore and fallback
  }
  await AsyncStorage.removeItem(key);
}

export const authStorage: AsyncKeyValueStorage = {
  async getItem(key) {
    const webStorage = getWebStorage();
    if (webStorage) return webStorage.getItem(key);
    if (!isWeb()) return secureGetItem(key);
    return inMemoryStorage.get(key) ?? null;
  },
  async setItem(key, value) {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.setItem(key, value);
      return;
    }
    if (!isWeb()) {
      await secureSetItem(key, value);
      return;
    }
    inMemoryStorage.set(key, value);
  },
  async removeItem(key) {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.removeItem(key);
      return;
    }
    if (!isWeb()) {
      await secureRemoveItem(key);
      return;
    }
    inMemoryStorage.delete(key);
  },
};

export const FAVORITES_KEY = 'findixi.mobile-public.favorites';

export async function getJsonStorageValue<T>(key: string, fallback: T): Promise<T> {
  const raw = await authStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJsonStorageValue<T>(key: string, value: T): Promise<void> {
  await authStorage.setItem(key, JSON.stringify(value));
}
