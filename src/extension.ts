import * as vscode from 'vscode';
import { fixCurrentFile } from './commands/fixCurrentFile';
import { Canonicalizer } from './tailwind/canonicalizer';

export const canonicalEngine = new Canonicalizer();

export async function activate(context: vscode.ExtensionContext) {
    console.log('Tailwind Canonical Fixer is now active!');

    await canonicalEngine.init();

    let disposableFixCmd = vscode.commands.registerCommand(
        'tailwindCanonicalFixer.fixCurrentFile',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                fixCurrentFile(editor.document, canonicalEngine);
            }
        }
    );

    // 显式声明 `e` 的类型为 vscode.TextDocumentWillSaveEvent
    let disposableSaveHook = vscode.workspace.onWillSaveTextDocument((e: vscode.TextDocumentWillSaveEvent) => {
        const config = vscode.workspace.getConfiguration('tailwindCanonicalFixer');
        const formatOnSave = config.get<boolean>('formatOnSave');

        if (formatOnSave) {
            const editPromise = fixCurrentFile(e.document, canonicalEngine, true);
            e.waitUntil(editPromise);
        }
    });

    context.subscriptions.push(disposableFixCmd, disposableSaveHook);
}

export function deactivate() {}