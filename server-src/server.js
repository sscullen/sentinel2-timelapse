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


//var deferred = new Promise(function (resolve, reject) {
//
//         http.get('http://localhost:8080/meta/' + name, function(response) {
//
//             var responseBody = "";  // will hold the response body as it comes
//
//             // join the data chuncks as they come
//             response.on('data', function(chunck) { responseBody += chunck });
//
//             response.on('end', function() {
//
//                 var jsonResponse = JSON.parse(responseBody);
//                 list.push(name);
//
//                 if(jsonResponse.hasDependency) {
//                     loadMetaOf(jsonResponse.dependency, list)
//                         .then(function() {
//                             resolve();
//                         });
//                 }
//                 else {
//                     resolve();
//                 }
//             });
//         });
//
//
//     });
//
//
//
//     // here will go any remainings of the function's code
//
//     return deferred;

let recurseCount = 0;

function getTileList(requestPrefix, tileList) {

    console.log('getTileListFunction called, incoming prefix: ' + requestPrefix);

    var params = {
        Bucket: 'sentinel-s2-l1c',
        Delimiter: '/',
        EncodingType: "url",
        FetchOwner: false,
        MaxKeys: 100,
        RequestPayer: "requester",
        Prefix: requestPrefix
    };


    let promise = new Promise((resolve, reject) => {

        // async call should be wrapped in a new promise constructor
        // this function should return a new promise, so that the recursive calls
        // can resolve it with a .then call

        ////// SEE RECURSIVE PROMISE STRUCTURE IN CODE AT VERY BOTTOM OF THIS FILE /////
        s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {

            if (err) {
                console.log(err);
                console.log('something went wrong')
            } else {
                // console.log(data);

                if (data.Contents.length === 0) {

                    console.log('data contents length is zero')
                    for (let prefix of data.CommonPrefixes) {
                        console.log('Prefix count ' + data.CommonPrefixes.length)
                        console.log('Prefix: ' + prefix.Prefix);

                        let prefixSplit = prefix.Prefix.split('/')

                        if (prefixSplit[prefixSplit.length - 2] != 'qi' && prefixSplit[prefixSplit.length - 2] != 'preview' && prefixSplit[prefixSplit.length - 2] != 'preview') {
                            // recursive call should immediately be invoked by
                            // 'then' and passed resolve so the promises above in the
                            // recursion stack know they can resolve themselves
                            console.log('recursing recursively..... ')
                            recurseCount++;
                            console.log(recurseCount)

                            getTileList(prefix.Prefix, tileList).then(() => {

                                console.log('executing promise in chain..... ')
                                recurseCount--;
                                console.log(recurseCount);
                                console.log('split prefix length ' + prefixSplit.length);
                                resolve();
                            });
                        }
                    }

                } else {

                    for (let dataItem of data.Contents) {
                        //console.log('data item split', dataItem.Key.split("."))
                        if (dataItem.Key.split(".").pop() === 'jpg') {

                            // THis is where the magic happens
                            // need to download the specific bands to a file

                            console.log('Found a tile preview');
                            console.log(dataItem.Key);
                            console.log(dataItem.ETag);
                            tileList.push(dataItem.Key);
                            recurseCount--;
                            console.log(recurseCount)
                            resolve();

                        }
                    }

                    //resolve();

                }
            }

        });

    });

    return promise;

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

        console.log('IS THIS SHOWING UP')

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

    console.log('Starting prefix: ' + prefixInitial);


    let anAsyncCall = () => {
        return promise =  getTileList(prefixInitial, masterTileList).then(function () {
            console.log('fetched all the image prefixes');

            console.log(masterTileList);

            console.log('DONE, FINALLY ------------------------------------------------------------------------------------');

        });
    };

    anAsyncCall();


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

// Recursive promise general structure


// var http = require('http');
//
// function loadMetaOf(name, list) {
//
//     // here will go some of the function's logic
//     //
//     // if(jsonResponse.hasDependency) {
//     //     loadMetaOf(jsonResponse.dependency, list)
//     //         .then(function() {
//     //             deferred.resolve();
//     //         });
//     // }
//     // else {
//     //     deferred.resolve();
//     // }
//
//     var deferred = new Promise(function (resolve, reject) {
//
//         http.get('http://localhost:8080/meta/' + name, function(response) {
//
//             var responseBody = "";  // will hold the response body as it comes
//
//             // join the data chuncks as they come
//             response.on('data', function(chunck) { responseBody += chunck });
//
//             response.on('end', function() {
//
//                 var jsonResponse = JSON.parse(responseBody);
//                 list.push(name);
//
//                 if(jsonResponse.hasDependency) {
//                     loadMetaOf(jsonResponse.dependency, list)
//                         .then(function() {
//                             resolve();
//                         });
//                 }
//                 else {
//                     resolve();
//                 }
//             });
//         });
//
//
//     });
//
//
//
//     // here will go any remainings of the function's code
//
//     return deferred;
// }
//
// var list = [];
// loadMetaOf('moduleA', list)
//     .then(function() {
//         // log the details to the user
//         console.log('fetched all metadata for moduleA');
//         console.log('all of the following modules need to be loaded');
//         console.log(list);
//     });

