import { SecureStorageError, ErrorCode, Accessible } from '../src/index';
import { SecureStorageMigrator } from '../src/migration';

// Mock React Native
jest.mock('react-native', () => ({
  NativeModules: {
    SecureStorageModule: {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
      getAllKeys: jest.fn(),
    },
  },
  Platform: { OS: 'ios' },
}));

jest.mock('react', () => ({
  useState: jest.fn((init) => [typeof init === 'function' ? init() : init, jest.fn()]),
  useCallback: jest.fn((fn) => fn),
}));

describe('SecureStorageError', () => {
  it('creates error with code', () => {
    const error = new SecureStorageError('test', ErrorCode.BIOMETRIC_FAILED);
    expect(error.message).toBe('test');
    expect(error.code).toBe('BIOMETRIC_FAILED');
    expect(error.name).toBe('SecureStorageError');
  });
});

describe('Accessible constants', () => {
  it('has expected accessibility levels', () => {
    expect(Accessible.WHEN_UNLOCKED).toBe('WHEN_UNLOCKED');
    expect(Accessible.AFTER_FIRST_UNLOCK).toBe('AFTER_FIRST_UNLOCK');
    expect(Accessible.WHEN_PASSCODE_SET).toBe('WHEN_PASSCODE_SET');
  });
});

describe('SecureStorage', () => {
  const { NativeModules } = require('react-native');
  const { SecureStorage } = require('../src/index');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets and gets a value', async () => {
    NativeModules.SecureStorageModule.setItem.mockResolvedValue(undefined);
    NativeModules.SecureStorageModule.getItem.mockResolvedValue('secret');

    const storage = new SecureStorage({ service: 'test' });
    await storage.set('key', 'secret');
    const value = await storage.get('key');

    expect(value).toBe('secret');
  });

  it('throws on empty key', async () => {
    const storage = new SecureStorage();
    await expect(storage.set('', 'value')).rejects.toThrow('Storage key cannot be empty');
  });

  it('returns null for missing key', async () => {
    NativeModules.SecureStorageModule.getItem.mockRejectedValue(
      new Error('keychain error: item not found')
    );

    const storage = new SecureStorage();
    const value = await storage.get('missing');
    expect(value).toBeNull();
  });

  it('stores and retrieves objects', async () => {
    const obj = { name: 'test', count: 42 };
    NativeModules.SecureStorageModule.setItem.mockResolvedValue(undefined);
    NativeModules.SecureStorageModule.getItem.mockResolvedValue(JSON.stringify(obj));

    const storage = new SecureStorage();
    await storage.setObject('data', obj);
    const result = await storage.getObject('data');

    expect(result).toEqual(obj);
  });

  it('has() returns true when key exists', async () => {
    NativeModules.SecureStorageModule.getItem.mockResolvedValue('exists');

    const storage = new SecureStorage();
    const exists = await storage.has('key');
    expect(exists).toBe(true);
  });

  it('maps biometric cancel error correctly', async () => {
    NativeModules.SecureStorageModule.getItem.mockRejectedValue(
      new Error('biometric cancel by user')
    );

    const storage = new SecureStorage();
    await expect(storage.get('key')).rejects.toMatchObject({
      code: 'BIOMETRIC_CANCELLED',
    });
  });
});

describe('SecureStorageMigrator', () => {
  const { NativeModules } = require('react-native');
  const { SecureStorage } = require('../src/index');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs pending migrations', async () => {
    const store: Record<string, string> = {};
    NativeModules.SecureStorageModule.setItem.mockImplementation(
      async (key: string, value: string) => { store[key] = value; }
    );
    NativeModules.SecureStorageModule.getItem.mockImplementation(
      async (key: string) => store[key] ?? (() => { throw new Error('keychain error'); })()
    );

    const storage = new SecureStorage();
    const migrationFn = jest.fn();

    const migrator = new SecureStorageMigrator(storage, [
      { version: 1, up: migrationFn, description: 'Initial schema' },
    ]);

    const result = await migrator.migrate();

    expect(result.from).toBe(0);
    expect(result.to).toBe(1);
    expect(result.applied).toBe(1);
    expect(migrationFn).toHaveBeenCalled();
  });

  it('skips already-applied migrations', async () => {
    const store: Record<string, string> = { '__secure_storage_schema_version__': '2' };
    NativeModules.SecureStorageModule.getItem.mockImplementation(
      async (key: string) => store[key] ?? null
    );

    const storage = new SecureStorage();
    const migrator = new SecureStorageMigrator(storage, [
      { version: 1, up: jest.fn(), description: 'v1' },
      { version: 2, up: jest.fn(), description: 'v2' },
    ]);

    const result = await migrator.migrate();
    expect(result.applied).toBe(0);
  });
});
