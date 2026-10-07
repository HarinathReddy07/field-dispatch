import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';
import { ApiClient, type TokenStore, type Tokens } from './client';

const KEY = 'dispatch.session.v1';

/** Tokens are kept ONLY in the platform keystore (Keychain / Android Keystore), never in AsyncStorage or app state. */
export const secureTokenStore: TokenStore = {
  async get(): Promise<Tokens | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  async set(tokens: Tokens | null): Promise<void> {
    if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(KEY);
  },
};

export const uuid = (): string => Crypto.randomUUID();

let onExpired: () => void = () => undefined;
export const setOnSessionExpired = (fn: () => void): void => {
  onExpired = fn;
};

export const api = new ApiClient({
  baseUrl: API_URL,
  store: secureTokenStore,
  uuid,
  onSessionExpired: () => onExpired(),
});
