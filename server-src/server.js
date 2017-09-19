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

let path = require('path');

let  parseMGRS  = require('./MGRSParse')

var mode   = process.env.NODE_ENV;


var s3 = new AWS.S3();


const querystring = require('querystring')

var RateLimit = require('express-rate-limit')

const port = 8000;

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

app.set('view engine', 'ejs')


var apiLimiter = new RateLimit({
    windowMs: 15*60*1000, // 15 minutes
    max: 10,
    delayMs: 0 // disabled
});

let client_dirname = path.resolve(__dirname, '..');

app.use(express.static(path.join(client_dirname + '/client-dist')));


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use('/listobjects', apiLimiter);


app.listen(port, () => {
    console.log('Express listening on ' + port);
});

app.get('/', (req, res) => {

    let client_dirname = path.resolve(__dirname, '..');
    console.log(client_dirname);

    res.sendfile(client_dirname + '/client-dist/index.html')
});


function recursiveRequests(requestPrefix, masterTileList) {

    var params = {
        Bucket: 'sentinel-s2-l1c',
        Delimiter: '/',
        EncodingType: "url",
        FetchOwner: false,
        MaxKeys: 100,
        RequestPayer: "requester",
        Prefix: requestPrefix
    };


    s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {

        if (err) {
            console.log(err);
            console.log('something went wrong')
        } else {
            //console.log(data);

            if (data.Contents.length === 0) {
                for (let prefix of data.CommonPrefixes) {
                    console.log(prefix.Prefix);

                    let prefixSplit = prefix.Prefix.split('/')

                    if (prefixSplit[prefixSplit.length - 2] != 'qi' && prefixSplit[prefixSplit.length - 2] != 'preview' && prefixSplit[prefixSplit.length - 2] != 'preview')
                        recursiveRequests(prefix.Prefix, masterTileList);

                }

            } else {


                for (let dataItem of data.Contents) {
                    //console.log('data item split', dataItem.Key.split("."))
                    if (dataItem.Key.split(".").pop() === 'jpg') {

                        // THis is where the magic happens
                        // need to download the specific bands to a file
                        // HERE

                        console.log('Found a tile preview')
                        console.log(dataItem.Key)
                        console.log(dataItem.ETag)
                        masterTileList.push(dataItem.Key);
                    }
                }

            }
        }

    });

}

app.post('/listobjects', bodyParser.json(), (req, res) => {

    console.log('Received a post request at list objects')
    res.send('thanks!')

    let coordList = req.body.coords;

    console.log(req.body);

    let parsedCoordMain;

    for (let coord of coordList) {

        let parsedCoord = parseMGRS.parse(coord);

        console.log(parsedCoord)

        parsedCoordMain = parsedCoord

        // date format "2015/7/12/0/"
        //
        // var params = {
        //     Bucket: 'sentinel-s2-l1c',
        //     Delimiter: '/',
        //     EncodingType: "url",
        //     FetchOwner: false,
        //     MaxKeys: 100,
        //     RequestPayer: "requester",
        //     Prefix: "tiles/"+ parsedCoord[0] + "/" + parsedCoord[1] + "/" + parsedCoord[2] + "/"
        // };
        //
        //
        // // disable to not get rate limited
        //
        // s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {
        //     if (err)
        //         console.log(err);
        //     else
        //         console.log(data);
        // });
    }

    // run just once for tests
    // date format "2015/7/12/0/"


    let masterTileList = [];

    //let year, month, day, specifier;

    let prefixInitial = "tiles/"+ parsedCoordMain[0] + "/" + parsedCoordMain[1] + "/" + parsedCoordMain[2] + "/";

    recursiveRequests(prefixInitial, masterTileList);

    console.log('recursion COMPLETE!!!!!!! --------------------------------------------------------------------')

    console.log('MasterTileList: ', masterTileList);

    // var params = {
    //     Bucket: 'sentinel-s2-l1c',
    //     Delimiter: '/',
    //     EncodingType: "url",
    //     FetchOwner: false,
    //     MaxKeys: 100,
    //     RequestPayer: "requester",
    //     Prefix: "tiles/"+ parsedCoordMain[0] + "/" + parsedCoordMain[1] + "/" + parsedCoordMain[2] + "/"
    // };
    //
    //
    // // disable to not get rate limited
    //
    // s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {
    //
    //     if (err) {
    //         console.log(err);
    //         console.log('something went wrong')
    //     } else {
    //         console.log(data);
    //
    //         // YEARS REQUEST STARTS HERE
    //
    //         let yearsArray = []
    //
    //
    //         for (let prefix of data.CommonPrefixes) {
    //
    //             let year = prefix.Prefix.split('/')
    //             console.log(year)
    //
    //             let year1 = year[year.length - 2]
    //
    //             yearsArray.push(year1)
    //         }
    //
    //         console.log(yearsArray)
    //
    //         let paramString = params.Prefix
    //
    //         for (let year of yearsArray) {
    //
    //                 params.Prefix = paramString + year + "/"
    //
    //                 s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {
    //                     if (err) {
    //                         console.log(err);
    //                         console.log('something went wrong')
    //                     } else {
    //                         console.log(data);
    //
    //                         // MONTHS REQUEST STARTS HERE
    //
    //                         let monthsArray = []
    //
    //
    //                         for (let prefix of data.CommonPrefixes) {
    //
    //                             let months = prefix.Prefix.split('/')
    //                             console.log(months)
    //
    //                             let month1 = months[months.length - 2]
    //
    //                             monthsArray.push(month1)
    //                         }
    //
    //                         console.log(monthsArray)
    //
    //                         let paramString = params.Prefix
    //
    //                         for (let month of monthsArray) {
    //
    //                             params.Prefix = paramString + month + "/"
    //
    //                             s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {
    //                                 if (err) {
    //                                     console.log(err);
    //                                     console.log('something went wrong')
    //                                 } else {
    //
    //                                     //////// DAYS REQUEST GOES HERE
    //
    //                                     console.log(data);
    //
    //
    //                                 }
    //                             });
    //                         }
    //
    //                     }
    //                 });
    //
    //         }
    //
    //
    //     }
    //
    //
    // });
    //
    // console.log('fuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuck me !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    // console.log(masterRequestObject)

});

