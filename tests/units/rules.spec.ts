import { prettierEqTo } from '../utils';
import {
    upgrade,
    TypeScriptVersion,
    FeatureRules,
    FeatureAction,
    Options
} from '../../src';

describe('Feature Rules', () => {
    const version = TypeScriptVersion.v3_8;

    it('should work with const assert', () => {
        const code = `true as true`;
        const after = `true as const`;
        const enabledOptions: Options = {
            rules: {
                [FeatureRules.ConstAssertion]: FeatureAction.Enabled
            }
        };
        const disabledOptions: Options = {
            rules: {
                [FeatureRules.ConstAssertion]: FeatureAction.Disabled
            }
        };
        prettierEqTo(upgrade(code, version), after);
        prettierEqTo(upgrade(code, version, enabledOptions), after);
        prettierEqTo(upgrade(code, version, disabledOptions), code);
    });

    it('should work with nullish', () => {
        const code = `a !== null ? a : 1`;
        const after = `a ?? 1`;
        const enabledOptions: Options = {
            rules: {
                [FeatureRules.NullishCoalesce]: FeatureAction.Enabled
            }
        };
        const disabledOptions: Options = {
            rules: {
                [FeatureRules.NullishCoalesce]: FeatureAction.Disabled
            }
        };
        prettierEqTo(upgrade(code, version), after);
        prettierEqTo(upgrade(code, version, enabledOptions), after);
        prettierEqTo(upgrade(code, version, disabledOptions), code);
    });

    it('should work with optional chains', () => {
        const code = `a && a.b && a.b.c`;
        const after = `a?.b?.c`;
        const enabledOptions: Options = {
            rules: {
                [FeatureRules.OptionalChains]: FeatureAction.Enabled
            }
        };
        const disabledOptions: Options = {
            rules: {
                [FeatureRules.OptionalChains]: FeatureAction.Disabled
            }
        };
        prettierEqTo(upgrade(code, version), after);
        prettierEqTo(upgrade(code, version, enabledOptions), after);
        prettierEqTo(upgrade(code, version, disabledOptions), code);
    });

    it('should work with export as ns', () => {
        const code = `import * as A from "./a.js";\nexport { A };`;
        const after = `export * as A from "./a.js";`;
        const enabledOptions: Options = {
            rules: {
                [FeatureRules.ExportAsNamespace]: FeatureAction.Enabled
            }
        };
        const disabledOptions: Options = {
            rules: {
                [FeatureRules.ExportAsNamespace]: FeatureAction.Disabled
            }
        };
        prettierEqTo(upgrade(code, version), after);
        prettierEqTo(upgrade(code, version, enabledOptions), after);
        prettierEqTo(upgrade(code, version, disabledOptions), code);
    });
});
