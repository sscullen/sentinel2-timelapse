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
const https = require('https');


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
    max: 20, // remember that CORS has preflight request, so each request counts for 2 requests, just double the limit for what you want it
    delayMs: 0 // disabled
});

app.use("/public", express.static(path.join(__dirname + '/public')));


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use('/listobjects', apiLimiter);

app.use('/openaccessdatahub', apiLimiter);


app.listen(port, () => {
    console.log('Express listening on ' + port);
});


// connect to sentinel 2 data hub API

// important parameters
// -m <mission name>		: Sentinel mission name. Possible options are: Sentinel-1, Sentinel-2, Sentinel-3);"
// echo ""
// echo "   -i <instrument name>		: instrument name. Possible options are: SAR, MSI, OLCI, SLSTR, SRAL);"

// //The url we want is: 'www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new'
// var options = {
//     host: 'scihub.copernicus.eu',
//     path: '/dhus/search?q=' + querystring.escape('producttype:S2MSI1C AND footprint:"Intersects(POLYGON((-4.53 29.85, 26.75 29.85, 26.75 46.80,-4.53 46.80,-4.53 29.85)))"'),
//     auth: 'ss.cullen:M0n796St3Ruleth4'
// };
//
// console.log(querystring.escape('/dhus/search?q=producttype:MSI AND platformname:Sentinel-2 AND footprint:"Intersects(POLYGON((-4.53 29.85, 26.75 29.85, 26.75 46.80,-4.53 46.80,-4.53 29.85)))"'))
//
// callback = function(response) {
//     var str = '';
//
//     console.log(response.headers)
//     console.log(response.statusCode)
//
//     //another chunk of data has been recieved, so append it to `str`
//     response.on('data', function (chunk) {
//         str += chunk;
//     });
//
//     //the whole response has been recieved, so we just print it out here
//     response.on('end', function () {
//         console.log(str);
//     });
// }
//
// https.request(options, callback).end();



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

                } else if (data.Contents.length !== 0) {
                    console.log('data contents is not empty, returning list of data');
                    console.log('data contents is ', data.Contents);

                    return resolve({data: data.Contents})
                } else {
                    console.log('could not find the tile specified');

                    return reject('could not find tile specified')
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

function toBytesInt32 (num) {
    arr = new ArrayBuffer(4); // an Int32 takes 4 bytes
    view = new DataView(arr);
    view.setUint32(0, num, false); // byteOffset = 0; litteEndian = false

    console.log(view.buffer)
    return Buffer.from(view.buffer);
}

app.get('/openaccessdatahub', (req, res) => {

    console.log('recieved a request on /openaccessdatahub');

    console.log(req);

    let coords = req.query.q.split('_')

    let polygonString = '';

    let x = coords.length;
    let counter = 0;

    for (let coord of coords) {
        let coordSplit = coord.split(',')

        polygonString += parseFloat(coordSplit[0]).toFixed(5) + ' ' + parseFloat(coordSplit[1]).toFixed(5);
        if (counter !== (x - 1)) {
            polygonString += ', '
        }
        counter++;
    }

    //The url we want is: 'www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new'
    var options = {
        host: 'scihub.copernicus.eu',
        path: '/dhus/search?q=' + querystring.escape('platformname:Sentinel-2 AND footprint:"Intersects(POLYGON((' + polygonString + ')))"'),
        auth: 'ss.cullen:M0n796St3Ruleth4'
    };

    console.log(options.path);

    callback = function(response) {
        var str = '';

        console.log(response.headers)
        console.log(response.statusCode)

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {
            console.log(str);
        });
    }

    https.request(options, callback).end();




});




app.post('/listobjects', bodyParser.json(), (req, res) => {

    console.log('Received a post request at list objects')

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



        let returnDataObject = {};

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
                res.send('something went wrong')
            } else {
                console.log(data);

                let fileName = masterList[0].key.replace(/\//g, '_');

                fs.writeFile(__dirname + '/' + fileName, data.Body, () => {
                    console.log('Wrote out the image to disk! Check it out!');


                    // send individual file

                    //var options = {
                        //     root: __dirname,
                        //     dotfiles: 'deny',
                        //     headers: {
                        //         'x-timestamp': Date.now(),
                        //         'x-sent': true
                        //     }
                        // };


                        // res.sendFile(fileName, options, function (err) {
                    //     if (err) {
                    //         console.log(err)
                    //     } else {
                    //         console.log('Sent file: ', fileName)
                    //         console.log('sent back preview image for ', fileName)
                    //     }
                    // });



                });

                returnDataObject.imageBuffer = data.Body;

                console.log(returnDataObject.imageBuffer);

                // wrap below request in a promise and then call
                var params = {
                    Bucket: 'sentinel-s2-l1c',
                    RequestPayer: "requester",
                    Key: masterList[0].key.replace('preview.jpg', 'tileInfo.json')
                };

                s3.makeUnauthenticatedRequest('getObject', params, function (err, data) {

                    if (err) {
                        console.log(err);
                        console.log('something went wrong')
                        res.send('something went wrong')
                    } else {
                        console.log(data);

                        console.log('got tile info.json')

                        //let jsonObject = JSON.parse(data.Body.toString('utf8'));
                        //console.log(jsonObject);

                        // log the size of the preview.jpg buffer

                        var sizeBuffer = Buffer.concat([toBytesInt32(returnDataObject.imageBuffer.length), toBytesInt32(data.Body.length)], 8);

                        console.log('sizeBuffer size', sizeBuffer.length, sizeBuffer)
                        console.log('preview.jpg buffer size', returnDataObject.imageBuffer.length);
                        console.log('tileInfoJson buffer size', data.Body.length)

                        console.log(JSON.parse(data.Body))


                        const returnBuffer = Buffer.concat([sizeBuffer, returnDataObject.imageBuffer, data.Body],
                                                sizeBuffer.length + returnDataObject.imageBuffer.length + data.Body.length)

                        res.send(returnBuffer);

                    }

                });

            }

        }, (err) => {
             console.log('ERROR: ' + err);
             res.status(404);
        });
    });
});
