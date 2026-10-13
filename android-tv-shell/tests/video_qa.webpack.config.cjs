// Test-only webpack entry. Production Stremio Web configuration stays unchanged.
const path=require('path');
const webpack=require('webpack');
module.exports={
  mode:'production',
  target:'web',
  devtool:false,
  entry:path.resolve(__dirname,'real_stremio_backend_qa.js'),
  output:{path:path.resolve(__dirname,'../app/src/debug/assets/web'),
          filename:'qa-video-engine.js',clean:false},
  resolve:{extensions:['.js','.json']},
  module:{rules:[{test:/\.wasm$/,type:'asset/resource',
                  generator:{filename:'qa-[name][ext]'}}]},
  plugins:[new webpack.ProvidePlugin({Buffer:['buffer','Buffer']})],
  performance:{hints:false},
};
