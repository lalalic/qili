// bundle.js
const webpack = require('webpack');
const webpackConfig = require('./webpack.config.js'); // Replace with the path to your webpack.config.js

const compiler = webpack(webpackConfig);

compiler.run();
