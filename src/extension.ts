import * as vscode from 'vscode';
import { fixCurrentFile } from './commands/fixCurrentFile';
import { fixWorkspace } from './commands/fixWorkspace'; // 1. 导入新命令
import { Canonicalizer } from './tailwind/canonicalizer';

export const canonicalEngine = new Canonicalizer();

export async function activate(context: vscode.ExtensionContext) {
    console.log('Tailwind Canonical Fixer is now active!');

    await canonicalEngine.init();

    // 修复当前文件命令
    let disposableFixCurrentCmd = vscode.commands.registerCommand(
        'tailwindCanonicalFixer.fixCurrentFile',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                fixCurrentFile(editor.document, canonicalEngine);
            }
        }
    );

    // 2. 注册修复整个工作区命令
    let disposableFixWorkspaceCmd = vscode.commands.registerCommand(
        'tailwindCanonicalFixer.fixWorkspace',
        () => fixWorkspace(canonicalEngine)
    );

    // 格式化保存钩子
    let disposableSaveHook = vscode.workspace.onWillSaveTextDocument((e: vscode.TextDocumentWillSaveEvent) => {
        const config = vscode.workspace.getConfiguration('tailwindCanonicalFixer');
        const formatOnSave = config.get<boolean>('formatOnSave');

        if (formatOnSave) {
            const editPromise = fixCurrentFile(e.document, canonicalEngine, true);
            e.waitUntil(editPromise);
        }
    });

    context.subscriptions.push(disposableFixCurrentCmd, disposableFixWorkspaceCmd, disposableSaveHook);
}

export function deactivate() {}