import {
    createPrinter,
    createSourceFile,
    EmitHint,
    ScriptTarget,
    transform,
    createProgram,
    getDefaultCompilerOptions
} from 'typescript';
import { transformer } from './transformer';
import { TypeScriptVersion } from './types';
import createVHost from 'ts-ez-host';

export function upgrade(code: string, target: TypeScriptVersion) {
    const filename = 'dummy.ts';
    const options = getDefaultCompilerOptions();
    const host = createVHost();

    host.writeFile(filename, code, false);

    const program = createProgram([filename], options, host);
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filename)!;

    const result = transform(
        [sourceFile],
        [transformer(sourceFile, checker, target)],
        options
    );

    const printer = createPrinter();
    const afterConvert = result.transformed[0];
    if (!afterConvert) {
        return 'empty node';
    }
    return printer.printNode(EmitHint.Unspecified, afterConvert, sourceFile);
}
