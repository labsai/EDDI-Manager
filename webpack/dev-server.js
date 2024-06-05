const path = require('path');

module.exports = {
  static: {
    directory: path.join(process.cwd(), 'dist')
  },
  port: process.env.PORT,
  hot: true,
  historyApiFallback: true,
};
