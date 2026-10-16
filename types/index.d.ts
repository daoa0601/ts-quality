export interface RepositoryOptions {
  readonly cwd?: string;
}

export interface InstallHooksResult {
  readonly hooksDirectory: string;
  readonly root: string;
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

export declare function scanSecrets(options?: SecretScanOptions): SecretScanResult;
