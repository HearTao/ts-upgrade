import {
    CompilerOptions,
    getDefaultCompilerOptions,
    IScriptSnapshot,
    CompilerHost,
    LanguageServiceHost,
    versionMajorMinor,
    ParseConfigHost
} from 'typescript';

type MixinHost = LanguageServiceHost & CompilerHost;

class MixinHostImpl {
    getCompilationSettings(): CompilerOptions {
        return getDefaultCompilerOptions();
    }
    getScriptFileNames(): string[] {
        return [];
    }
    getScriptVersion(): string {
        return versionMajorMinor;
    }
    getScriptSnapshot(): IScriptSnapshot | undefined {
        return undefined;
    }
}

export function mixinHost(host: CompilerHost): MixinHost {
    const mixinHost = host as MixinHost;
    const proxy = new MixinHostImpl();

    mixinHost.getCompilationSettings =
        mixinHost.getCompilationSettings || proxy.getCompilationSettings;
    mixinHost.getScriptFileNames =
        mixinHost.getScriptFileNames || proxy.getScriptFileNames;
    mixinHost.getScriptVersion =
        mixinHost.getScriptVersion || proxy.getScriptVersion;
    mixinHost.getScriptSnapshot =
        mixinHost.getScriptSnapshot || proxy.getScriptSnapshot;
    return mixinHost;
}

export class ParseConfigHostImpl implements ParseConfigHost {
    useCaseSensitiveFileNames: boolean;

    constructor(private compilerHost: CompilerHost) {
        this.useCaseSensitiveFileNames = compilerHost.useCaseSensitiveFileNames();
    }

    readDirectory(
        rootDir: string,
        extensions: readonly string[],
        excludes: readonly string[] | undefined,
        includes: readonly string[],
        depth?: number
    ): readonly string[] {
        return (
            this.compilerHost.readDirectory?.(
                rootDir,
                extensions,
                excludes,
                includes,
                depth
               
            ) ||  /* istanbul ignore next */ []
        );
    }

    /* istanbul ignore next */
    fileExists(path: string): boolean {
        return this.compilerHost.fileExists(path);
    }

    /* istanbul ignore next */
    readFile(path: string): string | undefined {
        return this.compilerHost.readFile(path);
    }
}
