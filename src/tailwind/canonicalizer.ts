import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

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
        if (configFiles.length === 0) return;

        for (const uri of configFiles) {
            try {
                const content = fs.readFileSync(uri.fsPath, 'utf-8');
                const maps = this.parseConfigMaps(content);
                if (Object.keys(maps).length > 0) {
                    for (const [key, map] of Object.entries(maps)) {
                        this.semanticScaleMap[key] = {
                            ...this.semanticScaleMap[key],
                            ...map,
                        };
                    }
                    console.log(`Loaded semantic mappings from ${path.basename(uri.fsPath)}`);
                    return;
                }
            } catch (e) {
                console.error(`Failed to parse ${uri.fsPath}:`, e);
            }
        }
    }

    private parseConfigMaps(content: string): Record<string, Record<string, string>> {
        const stripped = content
            .replace(/\/\/.*$/gm, '')          // 去掉行注释
            .replace(/\/\*[\s\S]*?\*\//g, ''); // 去掉块注释(之前这里被截断了)

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

    private extractObjectBody(text: string, key: string): string | null {
        const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*\\{`);
        const match = regex.exec(text);
        if (!match) return null;

        const start = match.index + match[0].length - 1;
        let depth = 0;
        let inStr = false;
        let quote = '';

        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (inStr) {
                if (ch === quote && text[i - 1] !== '\\') inStr = false;
            } else if (ch === '"' || ch === "'" || ch === '`') {
                inStr = true;
                quote = ch;
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

    public fixClassString(rawString: string): string {
        if (!rawString || rawString.trim() === '') return rawString;
        const parts = rawString.split(/(\s+)/);
        const fixedParts = parts.map(part => {
            if (part.trim() === '') return part;
            return this.canonicalizeSingleClass(part);
        });
        return fixedParts.join('');
    }

    private canonicalizeSingleClass(cls: string): string {
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
        utility = this.canonicalizeUtility(utility);
        let result = variants.length > 0 ? `${variants.join(':')}:${utility}` : utility;
        if (isImportant && !result.endsWith('!')) {
            result += '!';
        }
        return result;
    }

    private canonicalizeUtility(utility: string): string {
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

        // 无论 utility 原本就是裸数字,还是刚从 [9999] 这类任意值转换出来的裸数字,
        // 都统一走一遍语义映射,这样 z-[9999] 和 z-9999 都能归到 z-dialog
        const namedScaleMatch = result.match(/^(z|opacity|order)-(\d+(\.\d+)?)$/);
        if (namedScaleMatch) {
            const [, prefix, value] = namedScaleMatch;
            const semanticName = this.semanticScaleMap[prefix]?.[value];
            if (semanticName) {
                return `${prefix}-${semanticName}`;
            }
        }
        return result;
    }
}