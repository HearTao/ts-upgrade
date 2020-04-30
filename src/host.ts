import { VHost } from 'ts-ez-host';
import {
    CompilerOptions,
    getDefaultCompilerOptions,
    IScriptSnapshot
} from 'typescript';

export class VLSHost extends VHost {
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
