const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    calculator: './src/main.ts',
    statistics: './src/statistics.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    charset: true
  },
  module: {
    rules: [
      { 
        test: /\.tsx?$/, 
        use: 'ts-loader',
        exclude: /node_modules/
      },
      { 
        test: /\.html$/, 
        use: 'html-loader' 
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
        "knockout-amd-helpers": path.join( __dirname, "js/knockout-amd-helpers.min.js" ),
        "knockout": path.join( __dirname, "js/knockout-min.js" ),
    }
  },
  devServer: {
    static: {
      directory: __dirname,
      watch: {
        ignored: ['**/node_modules/**', '**/test-results/**', '**/dist/**']
      },
      staticOptions: {
        ignore: ['**/test-results/**']
      }
    },
    compress: true,
    port: 8080,
    open: false,
    hot: false,
    client: {
      overlay: false, // Disable error overlay so it doesn't interfere with tests
    },
    devMiddleware: {
      writeToDisk: true,
    },
  },
  optimization: {
	  minimize: true
  },
  watchOptions: {
    ignored: ['**/node_modules/**', '**/test-results/**']
  }
};