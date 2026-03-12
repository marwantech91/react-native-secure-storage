import { NativeModules, Platform } from 'react-native';
import { useState, useCallback } from 'react';

const { SecureStorageModule } = NativeModules;

export const Accessible = {
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  ALWAYS: 'ALWAYS',
  WHEN_PASSCODE_SET: 'WHEN_PASSCODE_SET',
  WHEN_UNLOCKED_THIS_DEVICE: 'WHEN_UNLOCKED_THIS_DEVICE',
  AFTER_FIRST_UNLOCK_THIS_DEVICE: 'AFTER_FIRST_UNLOCK_THIS_DEVICE',
} as const;

export type AccessibleType = typeof Accessible[keyof typeof Accessible];

export const ErrorCode = {
  BIOMETRIC_FAILED: 'BIOMETRIC_FAILED',
  BIOMETRIC_CANCELLED: 'BIOMETRIC_CANCELLED',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  KEYCHAIN_ERROR: 'KEYCHAIN_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export class SecureStorageError extends Error {
  code: ErrorCodeType;

  constructor(message: string, code: ErrorCodeType) {
    super(message);
    this.name = 'SecureStorageError';
    this.code = code;
  }
}

interface SecureStorageOptions {
  service?: string;
  accessible?: AccessibleType;
  requireBiometric?: boolean;
  biometricPrompt?: string;
}

interface SetOptions {
  accessible?: AccessibleType;
  requireBiometric?: boolean;
}

export class SecureStorage {
  private service: string;
  private defaultAccessible: AccessibleType;
  private requireBiometric: boolean;
  private biometricPrompt: string;

  constructor(options: SecureStorageOptions = {}) {
    this.service = options.service || 'com.app.secure';
    this.defaultAccessible = options.accessible || Accessible.AFTER_FIRST_UNLOCK;
    this.requireBiometric = options.requireBiometric || false;
    this.biometricPrompt = options.biometricPrompt || 'Authenticate to access secure data';
  }

  async set(key: string, value: string, options?: SetOptions): Promise<void> {
    const config = {
      service: this.service,
      accessible: options?.accessible || this.defaultAccessible,
      requireBiometric: options?.requireBiometric ?? this.requireBiometric,
    };

    try {
      await SecureStorageModule.setItem(key, value, config);
    } catch (error) {
      throw this.mapError(error as Error);
    }
  }

  async get(key: string): Promise<string | null> {
    const config = {
      service: this.service,
      biometricPrompt: this.biometricPrompt,
    };

    try {
      const value = await SecureStorageModule.getItem(key, config);
      return value;
    } catch (error) {
      const mapped = this.mapError(error as Error);
      if (mapped.code === ErrorCode.KEYCHAIN_ERROR) {
        // Key doesn't exist
        return null;
      }
      throw mapped;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await SecureStorageModule.removeItem(key, { service: this.service });
    } catch (error) {
      throw this.mapError(error as Error);
    }
  }

  async setObject<T extends Record<string, unknown>>(key: string, value: T, options?: SetOptions): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.set(key, serialized, options);
  }

  async getObject<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (value === null) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const keys = await SecureStorageModule.getAllKeys({ service: this.service });
      return keys || [];
    } catch (error) {
      throw this.mapError(error as Error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      await Promise.all(keys.map(key => this.delete(key)));
    } catch (error) {
      throw this.mapError(error as Error);
    }
  }

  private mapError(error: Error): SecureStorageError {
    const message = error.message.toLowerCase();

    if (message.includes('biometric') && message.includes('cancel')) {
      return new SecureStorageError('Biometric authentication cancelled', ErrorCode.BIOMETRIC_CANCELLED);
    }
    if (message.includes('biometric') || message.includes('authentication')) {
      return new SecureStorageError('Biometric authentication failed', ErrorCode.BIOMETRIC_FAILED);
    }
    if (message.includes('not available') || message.includes('unavailable')) {
      return new SecureStorageError('Secure storage not available', ErrorCode.NOT_AVAILABLE);
    }
    if (message.includes('keychain') || message.includes('keystore')) {
      return new SecureStorageError('Keychain/Keystore error', ErrorCode.KEYCHAIN_ERROR);
    }
    if (message.includes('encrypt') || message.includes('decrypt')) {
      return new SecureStorageError('Encryption error', ErrorCode.ENCRYPTION_ERROR);
    }

    return new SecureStorageError(error.message, ErrorCode.UNKNOWN);
  }
}

// React Hook
interface UseSecureStorageResult {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: SetOptions) => Promise<void>;
  remove: (key: string) => Promise<void>;
  getObject: <T>(key: string) => Promise<T | null>;
  setObject: <T extends Record<string, unknown>>(key: string, value: T, options?: SetOptions) => Promise<void>;
  clear: () => Promise<void>;
  isLoading: boolean;
  error: SecureStorageError | null;
}

export function useSecureStorage(options?: SecureStorageOptions): UseSecureStorageResult {
  const [storage] = useState(() => new SecureStorage(options));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SecureStorageError | null>(null);

  const wrapAsync = useCallback(<T>(fn: () => Promise<T>) => {
    return async (): Promise<T> => {
      setIsLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        const err = e instanceof SecureStorageError ? e : new SecureStorageError((e as Error).message, ErrorCode.UNKNOWN);
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    };
  }, []);

  const get = useCallback(async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await storage.get(key);
    } catch (e) {
      const err = e instanceof SecureStorageError ? e : new SecureStorageError((e as Error).message, ErrorCode.UNKNOWN);
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  const set = useCallback(async (key: string, value: string, opts?: SetOptions) => {
    setIsLoading(true);
    setError(null);
    try {
      await storage.set(key, value, opts);
    } catch (e) {
      const err = e instanceof SecureStorageError ? e : new SecureStorageError((e as Error).message, ErrorCode.UNKNOWN);
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  const remove = useCallback(async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await storage.delete(key);
    } catch (e) {
      const err = e instanceof SecureStorageError ? e : new SecureStorageError((e as Error).message, ErrorCode.UNKNOWN);
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  const getObject = useCallback(async <T>(key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await storage.getObject<T>(key);
    } catch (e) {
      const err = e instanceof SecureStorageError ? e : new SecureStorageError((e as Error).message, ErrorCode.UNKNOWN);
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  const setObject = useCallback(async <T extends Record<string, unknown>>(key: string, value: T, opts?: SetOptions) => {
    setIsLoading(true);
    setError(null);
    try {
      await storage.setObject(key, value, opts);
    } catch (e) {
      const err = e instanceof SecureStorageError ? e : new SecureStorageError((e as Error).message, ErrorCode.UNKNOWN);
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  const clear = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await storage.clear();
    } catch (e) {
      const err = e instanceof SecureStorageError ? e : new SecureStorageError((e as Error).message, ErrorCode.UNKNOWN);
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  return {
    get,
    set,
    remove,
    getObject,
    setObject,
    clear,
    isLoading,
    error,
  };
}

export default SecureStorage;
