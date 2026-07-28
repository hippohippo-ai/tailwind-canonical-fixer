# Tailwind Canonical Fixer

Automatic fixing of Tailwind CSS v4 canonical class suggestions inside VS Code.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- ⚡ **Auto Canonicalization**: Instantly transforms arbitrary/deprecated Tailwind v4 classes into canonical classes (e.g., `top-[68px]` → `top-17`, `w-[64px]` → `w-16`).
- 💾 **Format On Save**: Automatically fixes canonical classes whenever you save your document.
- 🎯 **AST-based Precision**: Uses `@babel/parser` to safely extract and format class names inside JSX/TSX and utility functions (`cn`, `clsx`, `cva`) without breaking code syntax.
- 🚀 **Zero Rules Maintenance**: Directly relies on Tailwind v4 canonical engine logic.

## Usage

### Command Palette

1. Open a TSX, JSX, Vue, or HTML file.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
3. Run **`Tailwind: Fix Canonical Classes`**.

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
<div className="top-[68px] w-[64px] text-[red]" />

// After
<div className="top-17 w-16 text-red" />
```

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