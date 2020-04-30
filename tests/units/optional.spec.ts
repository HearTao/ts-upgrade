import { TypeScriptVersion, upgrade } from '../../src';
import { prettierEqTo } from '../utils';

describe('optional chains upgrade', () => {
    const version = TypeScriptVersion.v3_7;

    it('should work with chains', () => {
        const code = `a && a.b && a.b.c`;
        const after = `a?.b?.c`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with chains (middle)', () => {
        const code = `a && a.b.c && a.b.c.d`;
        const after = `a?.b.c?.d`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with chains (prefix)', () => {
        const code = `a && a.b && a.b.c.d.e.f`;
        const after = `a?.b?.c.d.e.f`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with chains (prefix)', () => {
        const code = `a.b.c && a.b.c.d && a.b.c.d.e.f`;
        const after = `a.b.c?.d?.e.f`;
        prettierEqTo(upgrade(code, version), after);
    })

    it('should work with a part with chains', () => {
        const code = `a.b.c && a.b.c.d && a.b.c.d.e.f.g.h`;
        const after = `a.b.c?.d?.e.f.g.h`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with property access chains, element access chains and call chains', () => {
        const code = `a && a.b && a.b["c"] && a.b["c"]() && a.b["c"]().d`;
        const after = `a?.b?.["c"]?.()?.d`;
        prettierEqTo(upgrade(code, version), after);
    });

    it('should work with recursion', () => {
        const code = `a(foo && foo.bar) && a(foo && foo.bar).b && a(foo && foo.bar).b.c`;
        const after = `a(foo?.bar)?.b?.c`;
        prettierEqTo(upgrade(code, version), after);
    });
});
