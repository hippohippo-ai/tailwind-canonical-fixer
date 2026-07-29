import * as vscode from 'vscode';
import { Canonicalizer } from '../tailwind/canonicalizer';
import { findAndFixClasses, getDiagnosticsMappings } from '../editor/documentWalker';

export async function fixCurrentFile(
    document: vscode.TextDocument, 
    engine: Canonicalizer,
    isFormatOnSave: boolean = false
): Promise<vscode.TextEdit[]> {
    const validLanguages = ['typescriptreact', 'javascriptreact', 'vue', 'html', 'svelte', 'astro'];
    if (!validLanguages.includes(document.languageId)) {
        return [];
    }

    const text = document.getText();
    const extraMap = getDiagnosticsMappings(document.uri);
    const edits = findAndFixClasses(text, engine, extraMap);

    if (edits.length === 0) {
        return [];
    }

    const vscodeEdits = edits.map(edit => {
        const startPos = document.positionAt(edit.startOffset);
        const endPos = document.positionAt(edit.endOffset);
        const range = new vscode.Range(startPos, endPos);
        return vscode.TextEdit.replace(range, edit.newText);
    });

    if (isFormatOnSave) {
        return vscodeEdits;
    } else {
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, vscodeEdits);
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (applied) {
            const saved = await document.save();
            if (saved) {
                vscode.window.showInformationMessage(`✓ ${edits.length} classes canonicalized.`);
            } else {
                vscode.window.showWarningMessage('编辑已应用,但保存失败,请手动 Ctrl+S 保存。');
            }
        } else {
            vscode.window.showWarningMessage('应用编辑失败,文档可能已被其他操作修改。');
        }
        return [];
    }
}