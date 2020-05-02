import { mixinHost } from '../../src/host';
import createVHost from 'ts-ez-host';

describe('Virtual host', () => {
    it('should work with host', () => {
        const vHost = createVHost();
        const host = mixinHost(vHost);
        expect(() => {
            host.getScriptFileNames();
            host.getScriptVersion('file');
            host.getScriptSnapshot('file');
            host.getCompilationSettings();
            host.writeFile('test', 'foo');
        }).not.toThrowError();
    });
});
