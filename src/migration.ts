import { SecureStorage, SecureStorageError, ErrorCode } from './index';

export interface MigrationStep {
  version: number;
  up: (storage: SecureStorage) => Promise<void>;
  description: string;
}

const VERSION_KEY = '__secure_storage_schema_version__';

export class SecureStorageMigrator {
  private storage: SecureStorage;
  private migrations: MigrationStep[];

  constructor(storage: SecureStorage, migrations: MigrationStep[]) {
    this.storage = storage;
    this.migrations = [...migrations].sort((a, b) => a.version - b.version);
  }

  async getCurrentVersion(): Promise<number> {
    const version = await this.storage.get(VERSION_KEY);
    return version ? parseInt(version, 10) : 0;
  }

  async migrate(): Promise<{ from: number; to: number; applied: number }> {
    const currentVersion = await this.getCurrentVersion();
    const pendingMigrations = this.migrations.filter(
      (m) => m.version > currentVersion
    );

    if (pendingMigrations.length === 0) {
      return { from: currentVersion, to: currentVersion, applied: 0 };
    }

    let appliedCount = 0;
    for (const migration of pendingMigrations) {
      await migration.up(this.storage);
      await this.storage.set(VERSION_KEY, String(migration.version));
      appliedCount++;
    }

    const targetVersion = pendingMigrations[pendingMigrations.length - 1].version;
    return { from: currentVersion, to: targetVersion, applied: appliedCount };
  }

  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = this.migrations.length > 0
      ? this.migrations[this.migrations.length - 1].version
      : 0;
    return currentVersion < latestVersion;
  }
}

export function createMigrator(
  storage: SecureStorage,
  migrations: MigrationStep[]
): SecureStorageMigrator {
  return new SecureStorageMigrator(storage, migrations);
}
