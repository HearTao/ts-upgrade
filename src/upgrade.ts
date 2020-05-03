import { resolve } from 'path';
import createVHost from 'ts-ez-host';
import {
    CompilerHost,
    CompilerOptions,
    createCompilerHost,
    createProgram,
    findConfigFile,
    formatting,
    getDefaultCompilerOptions,
    getDefaultFormatCodeSettings,
    LanguageServiceHost,
    parseJsonSourceFileConfigFileContent,
    Program,
    readJsonConfigFile,
    textChanges,
    formatDiagnosticsWithColorAndContext
} from 'typescript';
import { ProxyChangesTracker } from './changes';
import { mixinHost, ParseConfigHostImpl } from './host';
import { TypeScriptVersion } from './types';
import { assertDef } from './utils';
import { visit } from './visitor';

function upgradeWorker(
    target: TypeScriptVersion,
    host: LanguageServiceHost,
    createProgramCallback: (oldProgram?: Program) => Program
) {
    const formatCodeSettings = getDefaultFormatCodeSettings();
    const formatContext = formatting.getFormatContext(formatCodeSettings);

    let lastProgram: Program | undefined = undefined;
    let needAnotherPass = true;
    while (needAnotherPass) {
        needAnotherPass = false;
        const program = (lastProgram = createProgramCallback(lastProgram));
        const checker = program.getTypeChecker();

        program.getSourceFiles().forEach((sourceFile) => {
            let text = sourceFile.getText();
            const changes = textChanges.ChangeTracker.with(
                {
                    formatContext,
                    host,
                    preferences: {}
                },
                (changeTracker) => {
                    const proxyChangeTracker = new ProxyChangesTracker(
                        changeTracker
                    );
                    visit(sourceFile, checker, proxyChangeTracker, target);
                    needAnotherPass =
                        needAnotherPass || proxyChangeTracker.needAnotherPass();
                }
            );

            changes.forEach((change) => {
                text = textChanges.applyChanges(text, change.textChanges);
            });

            host.writeFile!(sourceFile.path, text);
        });
    }
}

export function upgradeFromProject(
    projectPath: string,
    target: TypeScriptVersion,
    createHighLevelUpgradeHost?: (options: CompilerOptions) => CompilerHost
) {
    const defaultOptions = getDefaultCompilerOptions();
    const createCompilerHostImpl =
        createHighLevelUpgradeHost ??
        /* istanbul ignore next */ createCompilerHost;
    const upgradeHost = createCompilerHostImpl(defaultOptions);

    const filename = assertDef(
        findConfigFile(projectPath, (file) => upgradeHost.fileExists(file))
    );
    const config = readJsonConfigFile(filename, (file) =>
        upgradeHost.readFile(file)
    );

    const configParseHost = new ParseConfigHostImpl(
        upgradeHost ||
            /* istanbul ignore next */ createCompilerHost(defaultOptions)
    );
    const configParsedResult = parseJsonSourceFileConfigFileContent(
        config,
        configParseHost,
        projectPath
    );
    if (configParsedResult.errors.length > 0) {
        throw new Error(formatDiagnosticsWithColorAndContext(configParsedResult.errors, {
            getCurrentDirectory: upgradeHost.getCurrentDirectory,
            getNewLine: upgradeHost.getNewLine,
            getCanonicalFileName: name => name
        }));
    }
    const host = createCompilerHostImpl(configParsedResult.options);
    const lsHost = mixinHost(host);
    upgradeWorker(target, lsHost, (oldProgram) => {
        return createProgram(
            configParsedResult.fileNames,
            configParsedResult.options,
            host,
            oldProgram
        );
    });
}

export function upgradeFromFile(
    filename: string,
    target: TypeScriptVersion,
    createHighLevelUpgradeHost?: (options: CompilerOptions) => CompilerHost
) {
    const defaultOptions = getDefaultCompilerOptions();
    const createCompilerHostImpl =
        createHighLevelUpgradeHost ??
        /* istanbul ignore next */ createCompilerHost;
    const upgradeHost = createCompilerHostImpl(defaultOptions);
    return upgradeFromCode(assertDef(upgradeHost.readFile(filename)), target);
}

export function upgradeFromCode(code: string, target: TypeScriptVersion) {
    const filename = 'dummy.ts';
    const options = getDefaultCompilerOptions();
    const vhost = createVHost();
    const vlsHost = mixinHost(vhost);

    vlsHost.writeFile(filename, code);

    upgradeWorker(target, vlsHost, (oldProgram) =>
        createProgram([filename], options, vlsHost, oldProgram)
    );

    const filePath = resolve(vlsHost.getCurrentDirectory(), filename);
    return vlsHost.readFile(filePath)!;
}

export function upgrade(code: string, target: TypeScriptVersion) {
    return upgradeFromCode(code, target);
}
