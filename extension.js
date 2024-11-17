//@ts-check

var vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context 
 */
async function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('bloch-open', () => {
        const panel = vscode.window.createWebviewPanel('bloch', 'bloch', 
            vscode.ViewColumn.One, 
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)]
            }
        );
        const webviewScript = vscode.Uri.joinPath(context.extensionUri, "view.js");
        const katexCss = vscode.Uri.joinPath(context.extensionUri, "view.css");
        const extScript = panel.webview.asWebviewUri(webviewScript);
        const extCss = panel.webview.asWebviewUri(katexCss);
        panel.webview.html = getHtml(extScript, extCss);
    }));
}

/** @param {vscode.Uri} source */
/** @param {vscode.Uri} katexCss */
function getHtml(source, katexCss) {
    return `<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="${katexCss}">
  </head>
  <body><script src="${source}"></script></body>
</html>    
`;
}

module.exports = {
    activate
}
