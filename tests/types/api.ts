import prettierConfig from "@agentic-orch/ts-quality/prettier";
import {
  DEFAULT_MAX_SECRET_SCAN_BYTES,
  checkPack,
  installHooks,
  parsePackManifest,
  scanSecrets,
} from "@agentic-orch/ts-quality";

const scan = scanSecrets({ cwd: ".", maxFileBytes: DEFAULT_MAX_SECRET_SCAN_BYTES });
const pack = checkPack({ cwd: "." });
const hooks = installHooks({ cwd: "." });
const manifest = parsePackManifest('{"files":[]}');

scan.findings satisfies string[];
pack.files satisfies Set<string>;
hooks.hooksDirectory satisfies string;
manifest.files satisfies readonly { readonly path?: unknown }[];
prettierConfig.printWidth satisfies 100;
