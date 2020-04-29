import {
    createPrinter,
    createSourceFile,
    EmitHint,
    ScriptTarget,
    transform,
    formatting,
    createProgram,
    getDefaultCompilerOptions,
    textChanges,
    getDefaultFormatCodeSettings,
    UserPreferences,
    CompilerOptions,
    IScriptSnapshot,
    TransformationResult,
    Node
} from 'typescript';
import { visit } from './visitor';
import { TypeScriptVersion } from './types';
import createVHost, { VHost } from 'ts-ez-host';
import { ProxyChangesTracker } from './changes';

class VLSHost extends VHost {
    getCompilationSettings(): CompilerOptions {
        return getDefaultCompilerOptions();
    }
    getScriptFileNames(): string[] {
        return [];
    }
    getScriptVersion(): string {
        return 'v3.8.3';
    }
    getScriptSnapshot(): IScriptSnapshot | undefined {
        return undefined;
    }
    writeFile(filename: string, content: string) {
        return super.writeFile(filename, content, false);
    }
}

export function upgrade(code: string, target: TypeScriptVersion) {
    const filename = 'dummy.ts';
    const options = getDefaultCompilerOptions();
    const host = createVHost();
    const vlsHost = new VLSHost();

    host.writeFile(filename, code, false);

    const formatCodeSettings = getDefaultFormatCodeSettings();
    const formatContext = formatting.getFormatContext(formatCodeSettings);

    let text = '';
    let lastText = '';
    let needAnotherPass = true;
    let i = 0;
    while (needAnotherPass) {
        const program = createProgram([filename], options, host);
        const checker = program.getTypeChecker();

        const sourceFile = program.getSourceFile(filename)!;
        if (sourceFile.getText() === lastText) {
            throw new Error('???');
        }
        lastText = text = sourceFile.getText();
        const changes = textChanges.ChangeTracker.with(
            {
                formatContext,
                host: vlsHost,
                preferences: {}
            },
            (changeTracker) => {
                const proxyChangeTracker = new ProxyChangesTracker(
                    changeTracker
                );
                visit(sourceFile, checker, proxyChangeTracker, target);
                needAnotherPass = proxyChangeTracker.needAnotherPass();
            }
        );

        changes.forEach((change) => {
            text = textChanges.applyChanges(text, change.textChanges);
        });
        host.writeFile(filename, text, false);

        console.log('pass', i++);
    }

    return text;
}
