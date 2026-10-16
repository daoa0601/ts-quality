import prettierConfig from "@agentic-orch/ts-quality/prettier";
import {
  DEFAULT_MAX_SECRET_SCAN_BYTES,
  installHooks,
  scanSecrets,
} from "@agentic-orch/ts-quality";

const scan = scanSecrets({ cwd: ".", maxFileBytes: DEFAULT_MAX_SECRET_SCAN_BYTES });
const hooks = installHooks({ cwd: "." });

scan.findings satisfies string[];
hooks.hooksDirectory satisfies string;
prettierConfig.printWidth satisfies 100;
