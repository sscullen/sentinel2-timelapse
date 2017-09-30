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

const fs = require('fs');

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


// getPrefixFragmentPromise

// wrap the s3.request in a promise, the result returns a new list of common prefixes

const getPrefixFragment = (prefix) => {

    return new Promise((resolve, reject) => {
        console.log('getPrefixFragment called, incoming prefix: ' + prefix);

        var params = {
            Bucket: 'sentinel-s2-l1c',
            Delimiter: '/',
            EncodingType: "url",
            FetchOwner: false,
            MaxKeys: 100,
            RequestPayer: "requester",
            Prefix: prefix
        };

        s3.makeUnauthenticatedRequest('listObjectsV2', params, function (err, data) {

            if (err) {
                console.log(err);
                console.log('something went wrong');
                reject(err);
            } else {
                // console.log(data);

                if (data.Contents.length === 0 && data.CommonPrefixes.length !== 0) {

                    console.log('meaning there are further directories to explore, common prefix length is non zero');
                    console.log(data.CommonPrefixes)

                    return resolve({prefixes: data.CommonPrefixes})

                } else {
                    console.log('data contents is not empty, returning list of data');

                    return resolve({data: data.Contents})
                }
            }

        });

    });
};

let masterList = [];

const getCompletePrefix = (prefix, masterList) => {

            return new Promise((resolve, reject) => {

                return getPrefixFragment(prefix).then((result) => {

                    if (result.data === undefined) {
                        console.log('prefix, no data')
                        let promiseList = [];
                        for (let nextPrefix of result.prefixes) {

                             promiseList.push(getCompletePrefix(nextPrefix.Prefix, masterList))
                        }

                        Promise.all(promiseList).then(() => {
                            console.log("ALL DONE THIS GROUP OF PROMISES BOSS")
                            resolve();
                        })


                    } else {
                        console.log('RESULT DATA: ', result.data)
                        console.log('actual data recieved')

                        for (let keys of result.data) {
                            let keyComponents = keys.Key.split('/');

                            if (keyComponents[keyComponents.length - 1] === 'preview.jpg') {
                                masterList.push({key: keys.Key,
                                                etag: keys.ETag});
                            }
                        }

                        console.log('MASTER LIST: ', masterList);

                        resolve();

                    }


                })

    });

};


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


    //let year, month, day, specifier;

    let prefixInitial = "tiles/" + parsedCoordMain[0] + "/" + parsedCoordMain[1] + "/" + parsedCoordMain[2] + "/";

    console.log('Starting prefix: ' + prefixInitial);

    let masterList = [];

    getCompletePrefix(prefixInitial, masterList).then((result) => {
        console.log('all done boss')
        console.log('HERE IS THE FINAL LIST OF FILES TO DOWNLOAD')
        console.log("MASTER LIST ", masterList)

        // DOWNLOAD FILES HERE

        // wrap below request in a promise and then call
        var params = {
            Bucket: 'sentinel-s2-l1c',
            RequestPayer: "requester",
            Key: masterList[0].key
        };

        s3.makeUnauthenticatedRequest('getObject', params, function (err, data) {

            if (err) {
                console.log(err);
                console.log('something went wrong')
            } else {
                console.log(data);

                fs.writeFile(__dirname + '/test.jpg', data.Body, () => {
                    console.log('Wrote out the image to disk! Check it out!');
                });

            }

        });
    });
});
