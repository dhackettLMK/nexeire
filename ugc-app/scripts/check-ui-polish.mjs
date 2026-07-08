import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["src/app", "src/components"];
const ignoredDirs = new Set([".next", "node_modules"]);
const extensions = new Set([".css", ".ts", ".tsx"]);

const lineChecks = [
  {
    label: "Use scoped transition properties instead of transition-all.",
    pattern: /\btransition-all\b/,
  },
  {
    label: "Use scoped transition properties instead of transition: all.",
    pattern: /transition\s*:\s*all\b/,
  },
  {
    label: "Do not use will-change: all.",
    pattern: /will-change\s*:\s*all\b/,
  },
  {
    label: "Use dynamic viewport height classes such as min-h-dvh.",
    pattern: /\bmin-h-screen\b/,
  },
  {
    label: "Use dynamic viewport height classes instead of h-screen.",
    pattern: /\bh-screen\b/,
  },
];

const failures = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirs.has(entry)) {
      continue;
    }

    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    if (stats.isFile() && extensions.has(path.extname(entry))) {
      checkFile(absolutePath);
    }
  }
}

function report(filePath, lineNumber, message, line) {
  failures.push({
    location: `${path.relative(root, filePath)}:${lineNumber}`,
    message,
    line: line.trim(),
  });
}

function checkFile(filePath) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  let insideFontDisplayBlock = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (line.includes("ui-polish-ignore")) {
      return;
    }

    for (const check of lineChecks) {
      if (check.pattern.test(line)) {
        report(filePath, lineNumber, check.label, line);
      }
    }

    if (line.includes(".font-display")) {
      insideFontDisplayBlock = true;
    }

    if (insideFontDisplayBlock && /letter-spacing\s*:\s*-/.test(line)) {
      report(
        filePath,
        lineNumber,
        "Keep .font-display letter spacing at 0 or a non-negative value.",
        line,
      );
    }

    if (insideFontDisplayBlock && line.includes("}")) {
      insideFontDisplayBlock = false;
    }
  });
}

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (failures.length > 0) {
  console.error("UI polish guardrail failed:\n");

  for (const failure of failures) {
    console.error(`${failure.location} - ${failure.message}`);
    console.error(`  ${failure.line}`);
  }

  process.exit(1);
}

console.log("UI polish guardrail passed.");
