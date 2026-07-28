import * as vscode from 'vscode';
import { Canonicalizer } from '../tailwind/canonicalizer';
import { findAndFixClasses } from '../editor/documentWalker';

export async function fixWorkspace(engine: Canonicalizer) {
    // 1. 定义匹配与忽略规则 (排除 node_modules, dist, .next 等)
    const includePattern = '**/*.{tsx,jsx,ts,js,vue,html,astro,svelte}';
    const excludePattern = '{**/node_modules/**,**/.next/**,**/dist/**,**/build/**,**/.git/**}';

    // 2. 搜索工作区中所有匹配的文件
    const files = await vscode.workspace.findFiles(includePattern, excludePattern);

    if (files.length === 0) {
        vscode.window.showInformationMessage('No matching files found in workspace.');
        return;
    }

    let totalFilesUpdated = 0;
    let totalClassesFixed = 0;
    const workspaceEdit = new vscode.WorkspaceEdit();

    // 3. 弹窗显示进度条进行批量修复
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Tailwind: Fixing Workspace Classes...",
        cancellable: true
    }, async (progress, token) => {
        const increment = 100 / files.length;

        for (const file of files) {
            if (token.isCancellationRequested) break;

            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                const edits = findAndFixClasses(text, engine);

                if (edits.length > 0) {
                    totalFilesUpdated++;
                    totalClassesFixed += edits.length;

                    // 收集所有修改
                    edits.forEach(edit => {
                        const startPos = document.positionAt(edit.startOffset);
                        const endPos = document.positionAt(edit.endOffset);
                        const range = new vscode.Range(startPos, endPos);
                        workspaceEdit.replace(file, range, edit.newText);
                    });
                }
            } catch (err) {
                console.error(`Failed to process file ${file.fsPath}:`, err);
            }

            progress.report({ increment, message: `${file.fsPath.split('/').pop()}` });
        }

        // 4. 批量一次性应用所有文件的修改
        if (totalClassesFixed > 0) {
            await vscode.workspace.applyEdit(workspaceEdit);
            vscode.window.showInformationMessage(`✓ Fixed ${totalClassesFixed} classes across ${totalFilesUpdated} files!`);
        } else {
            vscode.window.showInformationMessage('✓ All Tailwind classes in workspace are already canonical!');
        }
    });
}