# Tailwind Canonical Fixer

Automatic fixing of Tailwind CSS v4 canonical class suggestions inside VS Code.

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## What this is for

**This extension does not fix syntax errors or bugs in your code.** It exists to clear the "can be written as..." canonical-class warnings that the Tailwind CSS IntelliSense extension shows in the editor (e.g. `bg-gradient-to-r` can be written as `bg-linear-to-r`).

These warnings aren't errors — the old class names still work exactly as before. They're just outdated spellings that Tailwind v4 renamed. Left alone, they pile up in the Problems panel and bury real issues underneath dozens of harmless lint hints.

This extension rewrites those outdated-but-valid classes to their canonical v4 names, so the noise disappears and only genuine problems remain visible.

### What it doesn't do

- Doesn't validate that a class name is spelled correctly or exists in Tailwind
- Doesn't check JSX/HTML syntax
- Doesn't touch type errors, logic errors, or any other diagnostic category

It only rewrites classes that have a canonical replacement.

## Features

- ⚡ **Auto Canonicalization**: Instantly transforms arbitrary/deprecated Tailwind v4 classes into canonical classes (e.g., `top-[68px]` → `top-17`, `w-[64px]` → `w-16`).
- 🏷️ **Semantic Scale Resolution**: Reads named scale values (`zIndex`, `opacity`, `order`) from your `tailwind.config.js` and rewrites bare numeric classes into their semantic name — e.g. `z-9999` → `z-dialog`, `z-[9999]` → `z-dialog`.
- 📁 **Fix Workspace**: Canonicalize every matching file across the whole workspace in a single pass, not just the active editor.
- 💾 **Format On Save**: Automatically fixes canonical classes whenever you save your document.
- 🎯 **AST-based Precision**: Uses `@babel/parser` to safely extract and format class names inside JSX/TSX and utility functions (`cn`, `clsx`, `cva`) without breaking code syntax.
- 🚀 **Zero Rules Maintenance**: Directly relies on Tailwind v4 canonical engine logic, plus whatever semantic scale you've already defined in your own config.

## Usage

### Command Palette

1. Open a TSX, JSX, Vue, or HTML file.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
3. Run one of:
   - **`Tailwind: Fix Canonical Classes`** — fixes the active file only.
   - **`Tailwind: Fix Workspace`** — scans and fixes every matching file (`.tsx`, `.jsx`, `.ts`, `.js`, `.vue`, `.html`, `.astro`, `.svelte`) in the workspace.

Both commands save the affected file(s) automatically once edits are applied. If an edit can't be applied (for example, the document changed elsewhere in the meantime), a warning is shown instead of a false "success" message.

### Format On Save

Enable automatic canonicalization on save in your VS Code settings:

```json
{
  "tailwindCanonicalFixer.formatOnSave": true
}
```

## Example

```tsx
// Before
<div className="top-[68px] w-[64px] text-[red] z-[9999]" />

// After
<div className="top-17 w-16 text-red z-dialog" />
```

The last one (`z-[9999]` → `z-dialog`) assumes your `tailwind.config.js` defines a named scale value, e.g.:

```js
// tailwind.config.js
theme: {
  extend: {
    zIndex: {
      dialog: '9999',
    },
  },
},
```

Currently supported scales for semantic resolution: `zIndex`, `opacity`, `order`.

## Extension Settings

This extension contributes the following settings:

* `tailwindCanonicalFixer.formatOnSave`: Enable/disable canonical class formatting when saving files.

## Supported Libraries

- Native `className` / `class` attributes
- `cn(...)`
- `clsx(...)`
- `cva(...)`

## License

[MIT License](./LICENSE)