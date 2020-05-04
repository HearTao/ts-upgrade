const path = require('path');
const merge = require('webpack-merge');

const umdConfig = {
    mode: 'production',
    target: 'node',
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        library: 'tsUpgrade',
        libraryTarget: 'umd'
    },
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                resolve: {
                    extensions: ['.ts', '.tsx', '.js']
                }
            }
        ]
    },
    externals: {
        typescript: 'ts'
    }
};

const webConfig = merge(umdConfig, {
    target: 'web',
    output: {
        filename: 'index.web.js'
    }
});

const standaloneConfig = merge(umdConfig, {
    target: 'web',
    output: {
        filename: 'index.standalone.js'
    }
});

module.exports = [umdConfig, webConfig, standaloneConfig];
