import * as babelParser from '@babel/parser';
import traverseImport, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Canonicalizer } from '../tailwind/canonicalizer';

const traverse = typeof traverseImport === 'function' ? traverseImport : (traverseImport as any).default;

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

        const processString = (
            rawText: string, 
            start: number | null | undefined, 
            end: number | null | undefined, 
            isQuoted: boolean = true
        ) => {
            if (start == null || end == null) return;
            const fixedText = engine.fixClassString(rawText);
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
            const rawText = elem.value.raw;
            const fixedText = engine.fixClassString(rawText);
            if (rawText !== fixedText) {
                edits.push({
                    startOffset: elem.start,
                    endOffset: elem.end,
                    newText: fixedText
                });
            }
        };

        // 核心：对目标节点内部的所有字符串、模板字符串进行“无死角深度递归”
        const deepStringVisitor = {
            StringLiteral(innerPath: NodePath<t.StringLiteral>) {
                processString(innerPath.node.value, innerPath.node.start, innerPath.node.end, true);
            },
            TemplateElement(innerPath: NodePath<t.TemplateElement>) {
                processTemplateElement(innerPath.node);
            }
        };

        traverse(ast, {
            // 1. 深度遍历 JSX 属性 className / class（自动穿透三元运算符 ? :、逻辑与 &&、数组、嵌套对象等）
            JSXAttribute(path: NodePath<t.JSXAttribute>) {
                const name = path.node.name.name;
                if (name === 'className' || name === 'class') {
                    path.traverse(deepStringVisitor);
                }
            },

            // 2. 深度遍历类名辅助函数 cn, clsx, cva, tv, twMerge, classNames 等
            CallExpression(path: NodePath<t.CallExpression>) {
                if (t.isIdentifier(path.node.callee)) {
                    const funcName = path.node.callee.name;
                    if (['cn', 'clsx', 'cva', 'classNames', 'twMerge', 'tv'].includes(funcName)) {
                        path.traverse(deepStringVisitor);
                    }
                }
            }
        });

    } catch (e) {
        console.warn('AST Parsing failed:', e);
    }

    return edits;
}