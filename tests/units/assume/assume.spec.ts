import { TypeScriptVersion, assumeVersion } from '../../../src'

describe("assume code version", () => {
    it('should work', () => {
        const code = `a?.b?.["c"]?.()?.d ?? 1`
        expect(assumeVersion(code)).toBe(TypeScriptVersion.v3_7);
    })
})