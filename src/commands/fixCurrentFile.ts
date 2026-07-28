import * as vscode from 'vscode';
import { Canonicalizer } from '../tailwind/canonicalizer';
import { findAndFixClasses } from '../editor/documentWalker';

export async function fixCurrentFile(
    document: vscode.TextDocument, 
    engine: Canonicalizer,
    isFormatOnSave: boolean = false
): Promise<vscode.TextEdit[]> {
    
    // 只处理支持的文件类型 (根据你的设计文档 Section 8)
    const validLanguages = ['typescriptreact', 'javascriptreact', 'vue', 'html', 'svelte', 'astro'];
    if (!validLanguages.includes(document.languageId)) {
        return [];
    }

    const text = document.getText();
    
    // 1. 获取所有需要修改的地方
    const edits = findAndFixClasses(text, engine);

    if (edits.length === 0) {
        return [];
    }

    // 2. 将我们的 Offset 转换为 VS Code 的 TextEdit 对象
    const vscodeEdits = edits.map(edit => {
        const startPos = document.positionAt(edit.startOffset);
        const endPos = document.positionAt(edit.endOffset);
        const range = new vscode.Range(startPos, endPos);
        return vscode.TextEdit.replace(range, edit.newText);
    });

    // 3. 应用修改
    if (isFormatOnSave) {
        // 如果是保存时触发，只需返回 edits，VS Code 会接管应用流程并保证线程安全
        return vscodeEdits;
    } else {
        // 如果是手动触发，我们需要主动生成 WorkspaceEdit 并 Apply
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, vscodeEdits);
        
        await vscode.workspace.applyEdit(workspaceEdit);
        vscode.window.showInformationMessage(`✓ ${edits.length} classes canonicalized.`);
        return [];
    }
}