// Separate instrumentation-only entries. Never compiled into production assets.
const path = require('path');
const webpack = require('webpack');
module.exports = {
    mode: 'production',
    target: 'web',
    devtool: false,
    entry: {
        'qa-video-engine':path.resolve(__dirname,'real_stremio_backend_qa.js'),
        'qa-subtitles':path.resolve(__dirname,'subtitle_runtime_qa.js'),
    },
    output: {
        path: path.resolve(__dirname,'../app/src/debug/assets/web'),
        filename:'[name].js',
        clean:false,
    },
    resolve: {extensions:['.js','.json']},
    module: {rules:[{test:/\.wasm$/,type:'asset/resource',
        generator:{filename:'qa-[name][ext]'}}]},
    plugins:[new webpack.ProvidePlugin({Buffer:['buffer','Buffer']})],
    performance:{hints:false},
};
