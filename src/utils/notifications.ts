/**
 * TechAI - Notification Utilities
 * Auto-dismissing notification helpers
 */

import * as vscode from 'vscode';

/**
 * Shows an information message that auto-dismisses after a configurable timeout.
 * Uses a progress notification that completes after the timeout period.
 * 
 * @param message The message to display
 * @param forceTimeout Optional override for the timeout (in seconds). If not provided, uses settings.
 */
export async function showTimedInfoMessage(message: string, forceTimeout?: number): Promise<void> {
    const config = vscode.workspace.getConfiguration('techai');
    const timeoutSeconds = forceTimeout ?? config.get<number>('notificationTimeout', 3);

    // If timeout is 0 or negative, use standard persistent notification
    if (timeoutSeconds <= 0) {
        vscode.window.showInformationMessage(message);
        return;
    }

    // Use withProgress for timed notification
    // The notification auto-dismisses when the progress completes
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: message,
            cancellable: false
        },
        async (progress) => {
            // Update progress in small increments for smooth visual
            const steps = 20;
            const stepTime = (timeoutSeconds * 1000) / steps;

            for (let i = 0; i < steps; i++) {
                await new Promise(resolve => setTimeout(resolve, stepTime));
                progress.report({ increment: 100 / steps });
            }
        }
    );
}

/**
 * Shows a success notification with a checkmark prefix that auto-dismisses.
 * 
 * @param message The success message to display
 * @param forceTimeout Optional override for the timeout (in seconds)
 */
export async function showTimedSuccessMessage(message: string, forceTimeout?: number): Promise<void> {
    await showTimedInfoMessage(`✓ ${message}`, forceTimeout);
}

/**
 * Shows a warning message. Warnings are always persistent (require user dismissal).
 * This is a pass-through to VS Code's standard warning message.
 * 
 * @param message The warning message to display
 * @param items Optional action buttons
 */
export function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, ...items);
}

/**
 * Shows an error message. Errors are always persistent (require user dismissal).
 * This is a pass-through to VS Code's standard error message.
 * 
 * @param message The error message to display
 * @param items Optional action buttons
 */
export function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showErrorMessage(message, ...items);
}
