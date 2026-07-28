import * as babelParser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as vscode from 'vscode';
import { Canonicalizer } from '../tailwind/canonicalizer';

export interface ClassEdit {
    startOffset: number;
    endOffset: number;
    newText: string;
}

export function findAndFixClasses(code: string, engine: Canonicalizer): ClassEdit[] {
    const edits: ClassEdit[] = [];

    try {
        const ast = babelParser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });

        traverse(ast, {
            // A. 处理 className="w-[64px]"
            JSXAttribute(path: NodePath<t.JSXAttribute>) {
                const node = path.node;
                if (node.name.name === 'className' || node.name.name === 'class') {
                    if (t.isStringLiteral(node.value)) {
                        const originalCode = node.value.value;
                        const fixedCode = engine.fixClassString(originalCode);
                        
                        if (originalCode !== fixedCode && node.value.start != null && node.value.end != null) {
                            edits.push({
                                startOffset: node.value.start + 1,
                                endOffset: node.value.end - 1,
                                newText: fixedCode
                            });
                        }
                    }
                }
            },

            // B. 处理 cn("w-[64px]"), clsx("...") 等函数调用
            CallExpression(path: NodePath<t.CallExpression>) {
                const node = path.node;
                if (t.isIdentifier(node.callee)) {
                    const funcName = node.callee.name;
                    if (['cn', 'clsx', 'cva', 'classNames'].includes(funcName)) {
                        
                        node.arguments.forEach((arg: t.Node) => {
                            if (t.isStringLiteral(arg)) {
                                const originalCode = arg.value;
                                const fixedCode = engine.fixClassString(originalCode);

                                if (originalCode !== fixedCode && arg.start != null && arg.end != null) {
                                    edits.push({
                                        startOffset: arg.start + 1,
                                        endOffset: arg.end - 1,
                                        newText: fixedCode
                                    });
                                }
                            }
                        });
                    }
                }
            }
        });

    } catch (e) {
        console.warn('AST Parsing failed (could be mid-typing):', e);
    }

    return edits;
}