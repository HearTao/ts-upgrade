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
import { transformer } from './transformer';
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

    const program = createProgram([filename], options, host);
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filename)!;

    const formatCodeSettings = getDefaultFormatCodeSettings();
    const formatContext = formatting.getFormatContext(formatCodeSettings);

    let result: TransformationResult<Node> | undefined;
    let needAnotherPass = false;
    const changes = textChanges.ChangeTracker.with(
        {
            formatContext,
            host: vlsHost,
            preferences: {}
        },
        (changeTracker) => {
            const proxyChangeTracker = new ProxyChangesTracker(changeTracker);
            result = transform(
                [sourceFile],
                [transformer(sourceFile, checker, proxyChangeTracker, target)],
                options
            );
            needAnotherPass = proxyChangeTracker.needAnotherPass();
        }
    );

    let text = sourceFile.getText();
    changes.forEach((change) => {
        text = textChanges.applyChanges(text, change.textChanges);
    });

    const printer = createPrinter();
    const afterConvert = result!.transformed[0];
    if (!afterConvert) {
        return 'empty node';
    }
    return printer.printNode(EmitHint.Unspecified, afterConvert, sourceFile);
}
