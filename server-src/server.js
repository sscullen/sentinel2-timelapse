/**
 * Created by sc on 7/25/2017.
 */
var AWS = require('aws-sdk');

// server.js
const express        = require('express');
//const MongoClient    = require('mongodb').MongoClient;
const bodyParser     = require('body-parser');
const multer = require('multer')
const app            = express();
const axios = require('axios');

let path = require('path')

var mode   = process.env.NODE_ENV;


var s3 = new AWS.S3();


const querystring = require('querystring')

var RateLimit = require('express-rate-limit')

const port = 8000;

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

app.set('view engine', 'ejs')


var apiLimiter = new RateLimit({
    windowMs: 15*60*1000, // 15 minutes
    max: 5,
    delayMs: 0 // disabled
});

app.use("/public", express.static(path.join(__dirname + '/public')));


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use('/listobjects', apiLimiter);


app.listen(port, () => {
    console.log('Express listening on ' + port);
});

app.get('/listobjects', (req, res) => {

    console.log('Received a get request at list objects')
    res.send('thanks!')

    var params = {Bucket: 'sentinel-s2-l1c',
        Delimiter: '/',
        EncodingType: "url",
        FetchOwner: false,
        MaxKeys: 100,
        RequestPayer: "requester",
        Prefix: "tiles/30/U/XC/2015/7/12/0/"};



    s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {
        if (err) console.log(err);
        else console.log(data);
    });
});

