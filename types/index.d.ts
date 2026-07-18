export interface RepositoryOptions {
  readonly cwd?: string;
}

export interface InstallHooksResult {
  readonly hooksDirectory: string;
  readonly root: string;
}

export interface PackManifestEntry {
  readonly path?: unknown;
  readonly [key: string]: unknown;
}

export interface PackManifest {
  readonly files: readonly PackManifestEntry[];
  readonly [key: string]: unknown;
}

export interface PackInspectionResult {
  readonly failures: string[];
  readonly files: Set<string>;
}

export interface SecretScanOptions extends RepositoryOptions {
  readonly maxFileBytes?: number;
}

export interface SecretScanResult {
  readonly filesInspected: number;
  readonly findings: string[];
  readonly root: string;
}

export declare const DEFAULT_MAX_SECRET_SCAN_BYTES: number;

export declare function installHooks(options?: RepositoryOptions): InstallHooksResult;

export declare function checkPack(options?: RepositoryOptions): PackInspectionResult;

export declare function inspectPackManifest(
  packageJson: Record<string, unknown>,
  manifest: PackManifest,
): PackInspectionResult;

export declare function parsePackManifest(stdout: string): PackManifest;

export declare function scanSecrets(options?: SecretScanOptions): SecretScanResult;
