import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Emoji, arrows, dingbats and shapes: interface icons come from <Icon>, never from text.
const GLYPH = "/[\\u2190-\\u2BFF\\u{1F000}-\\u{1FAFF}\\uFE0F\\u00D7]/u";
const glyphMessage =
  "Use <Icon> from @/components/ui/Icon instead of an emoji or text glyph. Marker emoji belong in marker code.";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.{ts,tsx}"],
    // Marker emoji are organizer content and stay in these modules.
    ignores: [
      "src/components/map/types.ts",
      "src/components/map/poi-badge.ts",
      "src/components/map/PoiMarkers.tsx",
      "src/lib/mcp/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `JSXText[value=${GLYPH}]`, message: glyphMessage },
        { selector: `Literal[value=${GLYPH}]`, message: glyphMessage },
        { selector: `TemplateElement[value.raw=${GLYPH}]`, message: glyphMessage },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Serwist build artifacts
      "public/sw.js",
      "public/swe-worker*.js",
    ],
  },
];

export default eslintConfig;
