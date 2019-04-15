// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const request = require('request');
const fs = require('fs');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
const workspace = vscode.workspace;
const window = vscode.window;
const Range = vscode.Range;
const Position = vscode.Position;

const decorationType = window.createTextEditorDecorationType({after: {margin: '0 0 0 1rem'}});
const transferred = ['(', ')', '{', '}', '[', ']', '$', '^', '|', '.', '"', "'"];
let languageInfo = {}, decorationsDebounce, originDecorations = {}, decorations = {}, regexpList = [];

function activate() {
	// 得到用户配置项
	const config = vscode.workspace.getConfiguration('geekLanguage');
	const { languageJSON, languageUrl, regexp = '$L(${language}),t(${language})' } = config;

	if (!languageJSON && !languageUrl) {
		// 没有任何可用的国际化文件
		return false;
	}

	// 输出正则
	regexpList = regexp.split(',').map((text) => {
		const [textStart, textEnd] = text.split('${language}');
		return [...textStart].map((t) => {
			return transferred.includes(t) ? `\\${t}` : t;
		}).join('') +
		`['"]([^'"]+)['"]` +
		[...textEnd].map((t) => {
			return transferred.includes(t) ? `\\${t}` : t;
		}).join('');
	});

	// 加载本地语言包
	if (languageJSON) {
		// 异步读取
		fs.readFile(languageJSON, function (err, data) {
			if (err) {
				vscode.window.showInformationMessage('加载本地语言包失败!');
				return false;
			}
			Object.assign(languageInfo, JSON.parse(data.toString()));

			// 加载语言包成果后自动进行转换
			didChangeTextDocument()
			setTimeout(() => didChangeTextDocument(), 1000);
		});
	}

	// 加载线上语言包
	if (languageUrl) {
		request.get(config.languageUrl, function (err, res, body) {
			if (err) {
				vscode.window.showInformationMessage('请求远程语言包失败!');
				return false;
			}
			
			Object.assign(languageInfo, JSON.parse(body).data);

			// 加载语言包成果后自动进行转换
			didChangeTextDocument()
			setTimeout(() => didChangeTextDocument(), 1000);
		});
	}
	
	workspace.onDidChangeTextDocument(didChangeTextDocument);
	window.onDidChangeActiveTextEditor(didChangeTextDocument);
}

// 用户输入文本
function didChangeTextDocument() {
	const text = window.activeTextEditor.document.getText();
	const fileName = window.activeTextEditor.document.fileName;
	const lineText = text.split('\n');

	// fileName
	decorations[fileName] = {};

	lineText.forEach((text, index) => {
		lineTextCheck(text, index + 1, fileName);
	});
	// 渲染到vscode
	refreshDecorations(fileName);
}

// 行处理
function lineTextCheck(text, line, fileName) {
	for (let index = regexpList.length - 1; index >= 0; index --) {
		const regexp = regexpList[index];
		const checkRegexp = new RegExp(regexp, 'g');
		if (new RegExp(regexp).test(text)) {
			let lineMatchTextInfo = checkRegexp.exec(text);
			do {
				const lineMatchText = lineMatchTextInfo[0];
				const lineMatchTextCN = parseCN(lineMatchText, regexp);
				if (lineMatchTextCN) {
					const lineMatchIndex = lineMatchTextInfo.index + lineMatchText.length;
					decorate(lineMatchTextCN, { fileName, line, lineMatchIndex });
				}
				lineMatchTextInfo = checkRegexp.exec(text);
			} while (lineMatchTextInfo);
			return true;
		}
	}
}

// 翻译
function parseCN(lineMatchText, regexpText) {
	const textInfo = new RegExp(regexpText).exec(lineMatchText);
	if (textInfo) {
		const text = textInfo[1];
		return languageInfo[text];
	}
}

// 添加到任务队列
function decorate(text, packageInfo, color = '#67C23A') {
	const {fileName, line} = packageInfo;
	decorations[fileName] || (decorations[fileName] = {});
	decorations[fileName][line] || (decorations[fileName][line] = []);

  decorations[fileName][line].push({
    renderOptions: {after: {contentText: text, color}},
    range: new Range(new Position(line - 1, packageInfo.lineMatchIndex), new Position(line - 1, packageInfo.lineMatchIndex))
	});
}

// 渲染
function refreshDecorations(fileName, delay = 10) {
	const fileDecorations = decorations[fileName]; // 本次修改数据
	const fileOriginDecorations = originDecorations[fileName]; // 上次修改数据

	if (fileOriginDecorations) {
		Object.keys(fileDecorations).forEach((line) => {
			const fileDecorationList = fileDecorations[line];
			fileOriginDecorations[line] = fileDecorationList;
		});

		// 处理删除line的清空
		Object.keys(fileOriginDecorations).forEach((line) => {
			if (!fileDecorations[line]) {
				fileOriginDecorations[line] = [{
					renderOptions: {after: {contentText: ''}},
					range: new Range(new Position(Number(line) - 1, 1000), new Position(Number(line) - 1, 1000))
				}];
			}
		});
		
	} else {
		originDecorations[fileName] = fileDecorations;
	}

	if (decorationsDebounce) {
		clearTimeout(decorationsDebounce);
		decorationsDebounce = null;
	}
	decorationsDebounce = setTimeout(() =>
		getEditors(fileName).forEach(editor => {
			// 渲染
			const decorationList = [];
			
			Object.keys(fileOriginDecorations).forEach(line => {
				decorationList.push(...fileOriginDecorations[line]);
			});
			// 渲染到vscode
			editor.setDecorations(decorationType, decorationList);
			originDecorations[fileName] = fileDecorations;
		}), delay);
}

// 获取打开的文档
function getEditors(fileName) {
  return window.visibleTextEditors.filter(editor => editor.document.fileName === fileName);
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
