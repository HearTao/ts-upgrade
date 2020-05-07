const childProcess = require('child_process');
const fs = require('fs');

const commit = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .slice(0, 8);
const package = JSON.parse(fs.readFileSync('./package.json').toString());

const now = new Date();
const dateTime = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
package.version = `${package.version}-${dateTime}-${commit}`;

fs.writeFileSync('./package.json', JSON.stringify(package, undefined, 2));
