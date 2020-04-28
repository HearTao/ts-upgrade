import {
    createPrinter,
    createSourceFile,
    EmitHint,
    ScriptTarget,
    transform
} from 'typescript';
import { transformer } from './transformer';
import { TypeScriptVersion } from './types';

export function upgrade(code: string, target: TypeScriptVersion) {
    const sourceFile = createSourceFile('', code, ScriptTarget.Latest);

    const result = transform([sourceFile], [transformer(sourceFile, target)]);

    const printer = createPrinter();
    const afterConvert = result.transformed[0];
    if (!afterConvert) {
        return 'empty node';
    }
    return printer.printNode(EmitHint.Unspecified, afterConvert, sourceFile);
}
