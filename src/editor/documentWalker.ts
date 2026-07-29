import * as babelParser from '@babel/parser';
import traverseImport, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as vscode from 'vscode';
import { Canonicalizer } from '../tailwind/canonicalizer';

const traverse = typeof traverseImport === 'function' ? traverseImport : (traverseImport as any).default;

export interface ClassEdit {
    startOffset: number;
    endOffset: number;
    newText: string;
}

/**
 * 从 VSCode Diagnostics 中抓取 Tailwind IntelliSense 插件抛出的 suggestCanonicalClasses 替换映射
 */
export function getDiagnosticsMappings(uri: vscode.Uri): Record<string, string> {
    const map: Record<string, string> = {};
    const diagnostics = vscode.languages.getDiagnostics(uri);
    for (const diag of diagnostics) {
        if (diag.code === 'suggestCanonicalClasses' || diag.source === 'tailwindcss') {
            const match = diag.message.match(/The class [`"']([^`"']+)[`"'] can be written as [`"']([^`"']+)[`"']/);
            if (match) {
                map[match[1]] = match[2];
            }
        }
    }
    return map;
}

export function findAndFixClasses(
    code: string, 
    engine: Canonicalizer, 
    extraMap?: Record<string, string>
): ClassEdit[] {
    const edits: ClassEdit[] = [];
    const seenOffsets = new Set<number>();

    try {
        const ast = babelParser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });

        const processString = (
            rawText: string, 
            start: number | null | undefined, 
            end: number | null | undefined, 
            isQuoted: boolean = true
        ) => {
            if (start == null || end == null) return;
            if (seenOffsets.has(start)) return;
            seenOffsets.add(start);

            const fixedText = engine.fixClassString(rawText, extraMap);
            if (rawText !== fixedText) {
                edits.push({
                    startOffset: isQuoted ? start + 1 : start,
                    endOffset: isQuoted ? end - 1 : end,
                    newText: fixedText
                });
            }
        };

        const processTemplateElement = (elem: t.TemplateElement) => {
            if (elem.start == null || elem.end == null) return;
            if (seenOffsets.has(elem.start)) return;
            seenOffsets.add(elem.start);

            const rawText = elem.value.raw;
            const fixedText = engine.fixClassString(rawText, extraMap);
            if (rawText !== fixedText) {
                edits.push({
                    startOffset: elem.start,
                    endOffset: elem.end,
                    newText: fixedText
                });
            }
        };

        const deepStringVisitor = {
            StringLiteral(innerPath: NodePath<t.StringLiteral>) {
                processString(innerPath.node.value, innerPath.node.start, innerPath.node.end, true);
            },
            TemplateElement(innerPath: NodePath<t.TemplateElement>) {
                processTemplateElement(innerPath.node);
            }
        };

        traverse(ast, {
            JSXAttribute(path: NodePath<t.JSXAttribute>) {
                const name = (path.node.name as t.JSXIdentifier).name;
                if (name === 'className' || name === 'class') {
                    path.traverse(deepStringVisitor);
                    path.skip();
                }
            },
            CallExpression(path: NodePath<t.CallExpression>) {
                if (t.isIdentifier(path.node.callee)) {
                    const funcName = path.node.callee.name;
                    if (['cn', 'clsx', 'cva', 'classNames', 'twMerge', 'tv'].includes(funcName)) {
                        path.traverse(deepStringVisitor);
                        path.skip();
                    }
                }
            }
        });
    } catch (e) {
        console.warn('AST Parsing failed:', e);
    }
    return edits;
}