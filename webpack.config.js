var path = require("path");

var DIST_DIR = path.resolve(__dirname, "client-dist");
var SRC_DIR = path.resolve(__dirname, "client-src");

var mode   = process.env.NODE_ENV;


var config = {
    entry: SRC_DIR + "/app/index.js",
    output: {
        path: DIST_DIR + "/app",
        filename: "bundle.js",
        publicPath: "/app/"
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    { loader: 'style-loader' },
                    {
                        loader: 'css-loader',
                        options: {
                            modules: true
                        }
                    }
                ]
            },
            {
                test: /\.json$/, loader: "json-loader"
            },
            {
                test: /\.js?/,
                include: SRC_DIR,
                loader: "babel-loader",
                query: {
                    presets: ["react", "es2015", "stage-2"]
                }
            },
            {
                test: /\.scss$/, loaders: [ 'style-loader', 'css-loader', 'sass-loader' ]
            },
        ]
    },
    externals: {
        'Config': JSON.stringify(mode ? require('./s2-tl.config.json') : require('./s2-tl.config.json'))
    }
};

module.exports = config;