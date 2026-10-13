// Test-only entry for the exact pinned Stremio Video engine, without
// changing the production Enhanced Web bundle or actual Android activity.
const path = require('path');
const webpack = require('webpack');
module.exports = {
    mode: 'production',
    target: 'web',
    devtool: false,
    entry: path.resolve(__dirname, 'measured_stremio_night_audio_qa.js'),
    output: {
        path: path.resolve(__dirname, '../app/src/debug/assets/web'),
        filename: 'qa-video-engine-measured.js',
        clean: false
    },
    resolve: { extensions: ['.js', '.json'] },
    module: {
        rules: [{ test: /\.wasm$/, type: 'asset/resource',
            generator: { filename: 'qa-measured-[name][ext]' } }]
    },
    plugins: [new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })],
    performance: { hints: false }
};
