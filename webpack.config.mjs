import  outputPkg from './webpack/output.js';
const { output } = outputPkg;
import modulePkg from './webpack/module.js';
const { module } = modulePkg;
import pluginsPkg from './webpack/plugins.js';
const { getPlugins } = pluginsPkg;
import resolvePkg from './webpack/resolve.js';
const { resolve } = resolvePkg;
import devServerPkg from './webpack/dev-server.js';
const { devServer } = devServerPkg;
import * as path from 'path';

const config = {
  context: path.join(process.cwd(), 'src'),
  devtool: 'source-map',
  entry: {
    app: 'scripts/index.tsx',
    vendor: ['babel-polyfill', 'react', 'react-dom'],
  },
  target: 'web',
  output,
  module,
  plugins: getPlugins(),
  resolve,
  devServer,
};

export { config as default };
