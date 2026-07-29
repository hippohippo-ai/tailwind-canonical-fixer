import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Tailwind CSS å†…ç½®/é€šç”¨è§„èŒƒç±»æ˜ å°„è¡¨
const STATIC_CANONICAL_MAP: Record<string, string> = {
    'break-words': 'wrap-break-word',
    'overflow-ellipsis': 'text-ellipsis',
    'overflow-clip': 'text-clip',
    'flex-grow': 'grow',
    'flex-shrink': 'shrink',
    'flex-grow-0': 'grow-0',
    'flex-shrink-0': 'shrink-0',
    'decoration-slice': 'box-decoration-slice',
    'decoration-clone': 'box-decoration-clone',
};

// Tailwind å®˜æ–¹é»˜è®¤æ ‡å‡†é˜¶æ¢¯ï¼ˆç™½åå•ï¼šè¿™äº›æ ‡å‡†ç±»åä¸åº”è¯¥è¢«è‡ªåŠ¨æ›¿æ¢ä¸ºé¡¹ç›®è‡ªå®šä¹‰è¯­ä¹‰åï¼‰
const DEFAULT_TAILWIND_SCALES: Record<string, Set<string>> = {
    z: new Set(['0', '10', '20', '30', '40', '50', 'auto']),
    opacity: new Set(['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100']),
    order: new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'first', 'last', 'none']),
};

export class Canonicalizer {
    private semanticScaleMap: Record<string, Record<string, string>> = {};

    public async init() {
        await this.loadConfigFromWorkspace();
    }

    private async loadConfigFromWorkspace(): Promise<void> {
        const configFiles = await vscode.workspace.findFiles(
            'tailwind.config.{js,ts,mjs,cjs}',
            '**/node_modules/**'
        );
        for (const uri of configFiles) {
            try {
                const content = fs.readFileSync(uri.fsPath, 'utf-8');
                const maps = this.parseConfigMaps(content);
                this.mergeMaps(maps);
                if (Object.keys(maps).length > 0) {
                    console.log(`Loaded semantic mappings from ${path.basename(uri.fsPath)}`);
                }
            } catch (e) {
                console.error(`Failed to parse ${uri.fsPath}:`, e);
            }
        }

        const cssFiles = await vscode.workspace.findFiles(
            '**/*.css',
            '{**/node_modules/**,**/dist/**,**/build/**,**/.next/**}'
        );
        for (const uri of cssFiles) {
            try {
                const content = fs.readFileSync(uri.fsPath, 'utf-8');
                if (!content.includes('@theme')) continue;
                const maps = this.parseCssThemeMaps(content);
                this.mergeMaps(maps);
                if (Object.keys(maps).length > 0) {
                    console.log(`Loaded @theme mappings from ${path.basename(uri.fsPath)}`);
                }
            } catch (e) {
                console.error(`Failed to parse ${uri.fsPath}:`, e);
            }
        }
    }

    private parseConfigMaps(content: string): Record<string, Record<string, string>> {
        const stripped = content
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
        const result: Record<string, Record<string, string>> = {};
        const candidates: Record<string, string> = {
            zIndex: 'z',
            opacity: 'opacity',
            order: 'order',
        };

        for (const [prop, prefix] of Object.entries(candidates)) {
            const body = this.extractObjectBody(stripped, prop);
            if (!body) continue;
            const pairs = this.parseKeyValuePairs(body);
            if (Object.keys(pairs).length > 0) {
                result[prefix] = pairs;
            }
        }
        return result;
    }

    private mergeMaps(maps: Record<string, Record<string, string>>) {
        for (const [key, map] of Object.entries(maps)) {
            this.semanticScaleMap[key] = { ...this.semanticScaleMap[key], ...map };
        }
    }

    private parseCssThemeMaps(content: string): Record<string, Record<string, string>> {
        const themeBody = this.extractBraceBody(content, /@theme(?:\s+[\w-]+)?\s*\{/);
        if (!themeBody) return {};
        const result: Record<string, Record<string, string>> = {};
        const categories: Record<string, string> = {
            'z-index': 'z',
            'opacity': 'opacity',
            'order': 'order',
        };

        for (const [cssPrefix, classPrefix] of Object.entries(categories)) {
            const re = new RegExp(`--${cssPrefix}-([\\w-]+)\\s*:\\s*([^;]+);`, 'g');
            let m: RegExpExecArray | null;
            const map: Record<string, string> = {};
            while ((m = re.exec(themeBody)) !== null) {
                map[m[2].trim()] = m[1];
            }
            if (Object.keys(map).length > 0) result[classPrefix] = map;
        }
        return result;
    }

    private extractObjectBody(text: string, key: string): string | null {
        const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*\\{`);
        return this.extractBraceBody(text, regex);
    }

    private extractBraceBody(text: string, startRegex: RegExp): string | null {
        const match = startRegex.exec(text);
        if (!match) return null;
        const start = match.index + match[0].length - 1;
        let depth = 0, inStr = false, quote = '';
        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (inStr) {
                if (ch === quote && text[i - 1] !== '\\') inStr = false;
            } else if (ch === '"' || ch === "'" || ch === '`') {
                inStr = true; quote = ch;
            } else if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) return text.substring(start + 1, i);
            }
        }
        return null;
    }

    private parseKeyValuePairs(body: string): Record<string, string> {
        const map: Record<string, string> = {};
        const pairRe = /['"]?([\w-]+)['"]?\s*:\s*(['"]?)([\w.-]+)\2\s*,?/g;
        let m: RegExpExecArray | null;
        while ((m = pairRe.exec(body)) !== null) {
            map[m[3]] = m[1];
        }
        return map;
    }

    public fixClassString(rawString: string, extraMap?: Record<string, string>): string {
        if (!rawString || rawString.trim() === '') return rawString;
        const parts = rawString.split(/(\s+)/);
        const fixedParts = parts.map(part => {
            if (part.trim() === '') return part;
            return this.canonicalizeSingleClass(part, extraMap);
        });
        return fixedParts.join('');
    }

    private canonicalizeSingleClass(cls: string, extraMap?: Record<string, string>): string {
        let isImportant = false;
        let workCls = cls;
        if (workCls.startsWith('!')) {
            isImportant = true;
            workCls = workCls.slice(1);
        }

        const variantParts = workCls.split(':');
        let utility = variantParts.pop() || '';
        const variants = variantParts;

        if (utility.startsWith('!')) {
            isImportant = true;
            utility = utility.slice(1);
        }

        utility = this.canonicalizeUtility(utility, extraMap);

        let result = variants.length > 0 ? `${variants.join(':')}:${utility}` : utility;
        if (isImportant && !result.endsWith('!')) {
            result += '!';
        }
        return result;
    }

    private canonicalizeUtility(utility: string, extraMap?: Record<string, string>): string {
        // 1. ä¼˜å…ˆé‡‡ç”¨é’ˆå¯¹æ€§ Diagnostic ä¼ å…¥çš„ç²¾å‡†æ˜ å°„ (ä¾‹å¦‚ z-9999 -> z-dialog)
        if (extraMap && extraMap[utility]) {
            return extraMap[utility];
        }

        // 2. æŸ¥å†…ç½®é™æ€è§„èŒƒè¡¨ (ä¾‹å¦‚ break-words -> wrap-break-word)
        if (STATIC_CANONICAL_MAP[utility]) {
            return STATIC_CANONICAL_MAP[utility];
        }

        let result = utility;
        const scaleMatch = result.match(/^(z|opacity|order|flex-grow|flex-shrink|grow|shrink)-\[(\d+(\.\d+)?)%?\]$/);
        if (scaleMatch) {
            result = `${scaleMatch[1]}-${scaleMatch[2]}`;
        } else {
            const negRotateMatch = result.match(/^(rotate|skew-x|skew-y)-\[-(\d+(\.\d+)?)deg\]$/);
            if (negRotateMatch) {
                return `-${negRotateMatch[1]}-${negRotateMatch[2]}`;
            }
            const posRotateMatch = result.match(/^(rotate|skew-x|skew-y)-\[(\d+(\.\d+)?)deg\]$/);
            if (posRotateMatch) {
                return `${posRotateMatch[1]}-${posRotateMatch[2]}`;
            }
            const pxMatch = result.match(/^(-)?(w|h|min-w|max-w|min-h|max-h|top|bottom|left|right|p|pt|pb|pl|pr|px|py|m|mt|mb|ml|mr|mx|my|gap|space-x|space-y|inset|inset-x|inset-y|translate-x|translate-y|rounded)-\[(\d+(\.\d+)?)px\]$/);
            if (pxMatch) {
                const isNegative = pxMatch[1] || '';
                const prefix = pxMatch[2];
                const pxVal = parseFloat(pxMatch[3]);
                const scaleVal = Number((pxVal / 4).toFixed(4));
                return `${isNegative}${prefix}-${scaleVal}`;
            }
            const colorMatch = result.match(/^(text|bg|border|ring|outline)-\[([a-zA-Z]+)\]$/);
            if (colorMatch) {
                return `${colorMatch[1]}-${colorMatch[2]}`;
            }
        }

        const namedScaleMatch = result.match(/^(z|opacity|order)-(\d+(\.\d+)?)$/);
        if (namedScaleMatch) {
            const [, prefix, value] = namedScaleMatch;
            if (DEFAULT_TAILWIND_SCALES[prefix]?.has(value)) {
                return result;
            }
            const semanticName = this.semanticScaleMap[prefix]?.[value];
            if (semanticName) {
                return `${prefix}-${semanticName}`;
            }
        }

        return result;
    }
}
