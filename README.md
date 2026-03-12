# React Native Secure Storage

![React Native](https://img.shields.io/badge/React_Native-0.72-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

Encrypted secure storage for React Native using iOS Keychain and Android Keystore. Store sensitive data like tokens, credentials, and API keys safely.

## Features

- **iOS Keychain** - Secure Enclave integration
- **Android Keystore** - Hardware-backed encryption
- **Biometric Protection** - Require Face ID/fingerprint
- **Access Control** - Configure when data is accessible
- **Encryption** - AES-256 encryption
- **TypeScript** - Full type safety

## Installation

```bash
npm install @marwantech/react-native-secure-storage
```

### iOS Setup
```bash
cd ios && pod install
```

### Android Setup
No additional setup required. Uses AndroidX Security library.

## Quick Start

```typescript
import { SecureStorage } from '@marwantech/react-native-secure-storage';

const storage = new SecureStorage();

// Store sensitive data
await storage.set('auth_token', 'eyJhbGciOiJIUzI1NiIs...');

// Retrieve data
const token = await storage.get('auth_token');

// Delete data
await storage.delete('auth_token');
```

## API Reference

### Basic Operations

```typescript
const storage = new SecureStorage({
  service: 'com.myapp',    // iOS: Keychain service name
  accessible: 'AFTER_FIRST_UNLOCK', // When data is accessible
});

// Set value
await storage.set('key', 'value');

// Get value
const value = await storage.get('key'); // string | null

// Check if key exists
const exists = await storage.has('key'); // boolean

// Delete key
await storage.delete('key');

// Get all keys
const keys = await storage.getAllKeys(); // string[]

// Clear all data
await storage.clear();
```

### Store Objects

```typescript
// Store JSON objects
await storage.setObject('user', {
  id: '123',
  email: 'user@example.com',
  token: 'secret-token',
});

// Retrieve objects
const user = await storage.getObject<User>('user');
```

### Biometric Protection

```typescript
const storage = new SecureStorage({
  requireBiometric: true,
  biometricPrompt: 'Authenticate to access credentials',
});

// This will trigger Face ID/Touch ID
const token = await storage.get('auth_token');
```

## Access Control

Control when stored data is accessible:

```typescript
import { Accessible } from '@marwantech/react-native-secure-storage';

const storage = new SecureStorage({
  accessible: Accessible.WHEN_UNLOCKED,
});
```

### Accessibility Options

| Option | iOS | Android | Description |
|--------|-----|---------|-------------|
| `WHEN_UNLOCKED` | ✅ | ✅ | Only when device unlocked |
| `AFTER_FIRST_UNLOCK` | ✅ | ✅ | After first unlock until restart |
| `ALWAYS` | ✅ | ✅ | Always accessible |
| `WHEN_PASSCODE_SET` | ✅ | ❌ | Only if passcode is set |
| `WHEN_UNLOCKED_THIS_DEVICE` | ✅ | ✅ | When unlocked, not backed up |

## Per-Item Configuration

```typescript
// Default storage
const storage = new SecureStorage();

// Set with specific accessibility
await storage.set('refresh_token', token, {
  accessible: Accessible.WHEN_UNLOCKED_THIS_DEVICE,
  requireBiometric: true,
});

// Different config for different items
await storage.set('api_key', key, {
  accessible: Accessible.AFTER_FIRST_UNLOCK,
});
```

## React Hook

```typescript
import { useSecureStorage } from '@marwantech/react-native-secure-storage';

function ProfileScreen() {
  const { get, set, remove, isLoading } = useSecureStorage();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    const savedToken = await get('auth_token');
    setToken(savedToken);
  };

  const logout = async () => {
    await remove('auth_token');
    setToken(null);
  };

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      <Text>Logged in: {token ? 'Yes' : 'No'}</Text>
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

## Migration from AsyncStorage

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureStorage } from '@marwantech/react-native-secure-storage';

const secureStorage = new SecureStorage();

async function migrateSecrets() {
  const keysToMigrate = ['auth_token', 'refresh_token', 'api_key'];

  for (const key of keysToMigrate) {
    const value = await AsyncStorage.getItem(key);
    if (value) {
      await secureStorage.set(key, value);
      await AsyncStorage.removeItem(key); // Remove from insecure storage
    }
  }
}
```

## Error Handling

```typescript
import { SecureStorageError, ErrorCode } from '@marwantech/react-native-secure-storage';

try {
  const value = await storage.get('key');
} catch (error) {
  if (error instanceof SecureStorageError) {
    switch (error.code) {
      case ErrorCode.BIOMETRIC_FAILED:
        console.log('Biometric authentication failed');
        break;
      case ErrorCode.BIOMETRIC_CANCELLED:
        console.log('User cancelled biometric');
        break;
      case ErrorCode.NOT_AVAILABLE:
        console.log('Secure storage not available');
        break;
      case ErrorCode.KEYCHAIN_ERROR:
        console.log('Keychain/Keystore error');
        break;
    }
  }
}
```

## Security Best Practices

1. **Use appropriate accessibility** - Don't use `ALWAYS` for sensitive data
2. **Enable biometric** - For high-security items like tokens
3. **Clear on logout** - Always clear sensitive data on logout
4. **Don't store unnecessarily** - Only store what you need
5. **Migrate from AsyncStorage** - Move secrets to secure storage

## Platform Notes

### iOS
- Uses Keychain Services
- Data can sync via iCloud Keychain (disable with `THIS_DEVICE` options)
- Secure Enclave used when available

### Android
- Uses Android Keystore
- Hardware-backed on supported devices
- EncryptedSharedPreferences for storage

## License

MIT
