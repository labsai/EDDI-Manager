const path = require('path');

module.exports = {
  alias: {
    'images': 'public/images',
  },
  modules: [
    'node_modules',
    path.resolve(process.cwd(), 'src'),
  ],
  extensions: [
    '.ts',
    '.tsx',
    '.js',
    '.json',
    '.scss'
  ],
};
