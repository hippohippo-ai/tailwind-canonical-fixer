import * as vscode from 'vscode';
import { Canonicalizer } from '../tailwind/canonicalizer';
import { findAndFixClasses, getDiagnosticsMappings } from '../editor/documentWalker';

export async function fixWorkspace(engine: Canonicalizer) {
    const includePattern = '**/*.{tsx,jsx,ts,js,vue,html,astro,svelte}';
    const excludePattern = '{**/node_modules/**,**/.next/**,**/dist/**,**/build/**,**/.git/**}';

    const files = await vscode.workspace.findFiles(includePattern, excludePattern);
    if (files.length === 0) {
        vscode.window.showInformationMessage('No matching files found in workspace.');
        return;
    }

    let totalFilesUpdated = 0;
    let totalClassesFixed = 0;
    const workspaceEdit = new vscode.WorkspaceEdit();
    const modifiedFiles = new Set<string>();

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
                const extraMap = getDiagnosticsMappings(file);
                const edits = findAndFixClasses(text, engine, extraMap);

                if (edits.length > 0) {
                    totalFilesUpdated++;
                    totalClassesFixed += edits.length;
                    modifiedFiles.add(file.fsPath);
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

        if (totalClassesFixed > 0) {
            const applied = await vscode.workspace.applyEdit(workspaceEdit);
            if (applied) {
                const failedSaves: string[] = [];
                for (const fsPath of modifiedFiles) {
                    try {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fsPath));
                        const saved = await doc.save();
                        if (!saved) {
                            failedSaves.push(fsPath);
                        }
                    } catch (err) {
                        console.error(`Failed to save ${fsPath}:`, err);
                        failedSaves.push(fsPath);
                    }
                }
                if (failedSaves.length === 0) {
                    vscode.window.showInformationMessage(`✓ Fixed ${totalClassesFixed} classes across ${totalFilesUpdated} files!`);
                } else {
                    vscode.window.showWarningMessage(
                        `Fixed ${totalClassesFixed} classes, but ${failedSaves.length} file(s) failed to save: ${failedSaves.map(f => f.split(/[/\\]/).pop()).join(', ')}`
                    );
                }
            } else {
                vscode.window.showWarningMessage('应用编辑失败,部分文件可能已被其他操作修改。');
            }
        } else {
            vscode.window.showInformationMessage('✓ All Tailwind classes in workspace are already canonical!');
        }
    });
}