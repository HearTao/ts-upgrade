import {
    TypeScriptVersion,
    FeatureRules,
    Options,
    FeatureAction
} from './types';
import { numericalEnumValues } from './utils';

export const featureVersionMap: Map<
    TypeScriptVersion,
    FeatureRules[]
> = new Map([
    [TypeScriptVersion.v3_8, [FeatureRules.ExportAsNamespace]],
    [
        TypeScriptVersion.v3_7,
        [FeatureRules.OptionalChains, FeatureRules.NullishCoalesce]
    ],
    [TypeScriptVersion.v3_4, [FeatureRules.ConstAssertion]]
]);

export function typeScriptVersionToFeatures(
    version: TypeScriptVersion,
    options: Options
): Set<FeatureRules> {
    const versions = numericalEnumValues(
        TypeScriptVersion
    ) as TypeScriptVersion[];

    const result = new Set<FeatureRules>();
    versions
        .filter(v => v <= version)
        .forEach(v => {
            featureVersionMap.get(v)?.forEach(rule => {
                addFeatureIfEnabled(result, rule, options);
            });
        });
    return result;
}

function addFeatureIfEnabled(
    set: Set<FeatureRules>,
    rule: FeatureRules,
    options: Options
) {
    if (options.rules?.[rule] === FeatureAction.Disabled) {
        return;
    }
    set.add(rule);
}
