import { VLSHost } from '../../src/host';

describe('Virtual host', () => {
    it('should work with host', () => {
        const host = new VLSHost();
        expect(() => {
            host.getScriptFileNames();
            host.getScriptVersion();
            host.getScriptSnapshot();
            host.getCompilationSettings();
            host.writeFile('test', 'foo');
        }).not.toThrowError();
    });
});
