import createVHost, { VHost } from 'ts-ez-host';
import glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import {
    upgradeFromProject,
    upgradeFromCode,
    TypeScriptVersion,
    upgradeFromFile
} from '../../../src';
import { assertDef, last } from '../../../src/utils';
import { prettierEqTo } from '../../utils';

describe('Work with TypeScript Project', () => {
    const target = TypeScriptVersion.V3_8;
    const projectPath = path.resolve(__dirname, '../code/project');
    const filenames = glob.sync(`${projectPath}/**/*`, { nodir: true });
    let vhost: VHost;
    let data: Record<string, string> = {};

    beforeEach(() => {
        data = {};
        filenames.forEach(filename => {
            data[filename] = fs.readFileSync(filename).toString();
        });

        vhost = createVHost(data);
    });

    it('should work with project', () => {
        upgradeFromProject(projectPath, target, () => assertDef(vhost));

        filenames
            .filter(filename => filename.endsWith('.ts'))
            .forEach(filename => {
                prettierEqTo(
                    vhost.readFile(filename),
                    upgradeFromCode(data[filename], target)
                );
            });
    });

    it('should work with file', () => {
        const filename = last(
            filenames.filter(filename => filename.endsWith('.ts'))
        );
        const result = upgradeFromFile(filename, target, () =>
            assertDef(vhost)
        );
        prettierEqTo(result, upgradeFromCode(data[filename], target));
    });
});
