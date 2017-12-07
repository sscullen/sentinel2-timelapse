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

const xml2js = require('xml2js');

const parseString = xml2js.parseString;

// SEt up your auth requirements
const sentinelUser = process.env.sentinelUser;
const sentinelPass = process.env.sentinelPass;

let path = require('path');

let  parseMGRS  = require('./MGRSParse')

var mode   = process.env.NODE_ENV;

var s3 = new AWS.S3();

const querystring = require('querystring')

var RateLimit = require('express-rate-limit')

const port = 8000;

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

app.set('view engine', 'ejs');

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

// connect to ESA Sentinel Datahub API to get preview image, return as a base64 encoded string,
// That can be transferred back to binary on the client side
const getPreviewImage = (obj, base64String) => {

    return new Promise((resolve, reject) => {

        // Quicklookurl https://scihub.copernicus.eu/dhus/odata/v1/Products('f4d9d5b2-48de-4f64-b4c9-16ad52222f6c')/Products('Quicklook')/$value
        const justPath = obj.quicklookURL.slice(28);

        var options = {
            host: 'scihub.copernicus.eu',
            path: justPath,
            auth:  sentinelUser + ':' + sentinelPass
        };

        https.request(options, (response) => {

            var data = [];

            console.log(response.headers)
            console.log(typeof(response.statusCode))

            if (response.statusCode === 404) {
                console.log('status code is 404')
                return reject('not found')
            } else if(response.statusCode === 401) {

                console.log('status code is un-authorized')
                return reject('not authorized')
            }

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                console.log('chunk recieved ----------------')
                data.push(chunk);
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                console.log('everything has been received! --------------------------------------');

                let finalBuffer = Buffer.concat(data);

                if (base64String === true) {
                    obj.imagebuffer = finalBuffer.toString('base64');
                    resolve(obj);
                } else {
                    obj.imagebuffer = finalBuffer;
                    resolve(obj);
                }
            });
        }).end();
    });
};

// connect to ESA Sentinel Datahub API, multiple pages might be required
const searchSentinelDataHubSinglePage = (polygonString, startRow) => {

    return new Promise((resolve, reject) => {

        var options = {
            host: 'scihub.copernicus.eu',
            path: '/dhus/search?format=json&start=' + startRow + '&rows=100&q=' + querystring.escape('platformname:Sentinel-2 AND filename:*L1C* AND footprint:"Intersects(POLYGON((' + polygonString + ')))"') + '&orderby=beginposition%20desc',
            auth:  sentinelUser + ':' + sentinelPass
        }

        https.request(options, (response) => {
            var str = '';
            console.log(response.headers)
            console.log(typeof(response.statusCode))

            if (response.statusCode === 404) {
                console.log('status code is 404')
                return reject('not found')
            } else if(response.statusCode === 401) {
                console.log('status code is un-authorized')
                return reject('not authorized')
            }

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                console.log('chunk recieved ----------------')
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                console.log('everything has been received! --------------------------------------');
                console.log(str);
                let jsonResponseObject = JSON.parse(str)

                console.log(jsonResponseObject)
                return resolve(jsonResponseObject);
            });
        }).end();
    });
};

const getCompleteItemList = (polygonString, itemList) => {

    return new Promise((resolve, reject) => {
        return searchSentinelDataHubSinglePage(polygonString, 0).then((result) => {
            const totalResults = result.feed['opensearch:totalResults'];
            if (totalResults === 0) {
                reject('something went wrong, no results')
            }
            if (totalResults <= 100) {

                console.log('all data fits on one page, no need to page further')
                //console.log('RESULT DATA: ', result)
                console.log(result.feed.entry)
                itemList.push(...result.feed.entry);
                console.log('Total Item : ', itemList);
                resolve();
            } else {

                let promiseList = [];
                // how many times does 100 go into total results
                let pageCount = parseInt(totalResults) / parseInt(100);
                console.log('Data not contained on one page, we will need to query ', pageCount);

                for (let i = 0; i < pageCount; i++) {
                    promiseList.push(searchSentinelDataHubSinglePage(polygonString, i * 100))
                }

                Promise.all(promiseList).then((result) => {
                    console.log("ALL DONE THIS GROUP OF PROMISES BOSS")
                    console.log('RESULT ', result)
                    //console.log(result);
                    for (let r of result) {
                        console.log('One result------------------------------------------------------------------------');
                        console.log(r.feed.entry.length)
                        itemList.push(...r.feed.entry)
                    }
                    resolve();
                })
            }
        }, (err) => {
            console.log(err)
            reject(err);

        });
    });

};

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

    let coords = req.query.q.split('_')
    let polygonString = '';

    let x = coords.length;
    let counter = 0;

    for (let coord of coords) {
        let coordSplit = coord.split(',')

        polygonString += parseFloat(coordSplit[1]).toFixed(4) + ' ' + parseFloat(coordSplit[0]).toFixed(4);
        if (counter !== (x - 1)) {
            polygonString += ','
        }
        counter++;
    }

    console.log(polygonString)

    let itemList = [];

    getCompleteItemList(polygonString, itemList).then(() => {
        // All done boss, lets filter the array and send a response to the client
        // Each item should have
        // Title
        // Quicklook url (should be standard, might not be)
        // UUID
        // footprint polygon
        // cloud percentage
        // metadata url (for more info like title, if multiple granules or not)

        // use utility function reformatDataItem
        let formattedDataItemArray = [];
        let promiseList = []

        for (let item of itemList) {
            promiseList.push(reformatDataItem(item))
        }

        Promise.all(promiseList).then((result) => {
            //console.log(result);
            res.send(JSON.stringify(result));
        });

    }, (err) => {
        console.log('the promise was rejected, ', err)
        res.status(401).send('sorry something didnt work');
    }).catch((err) => {
        console.log(err);
        console.log('sorry something went wrong');
        res.status(401).send(err);
    });
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
    }

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

const reformatDataItem = (item) => {

    return new Promise((resolve, reject) => {

        let obj = {};

        console.log(item.link); // All the link items with this entry

        obj.quicklookURL = item.link.find((item) => {
            return item.rel === 'icon';
        }).href;

        obj.product_name = item.title;
        obj.uuid = item.id;
        obj.date = item.date.find((date) => {
            return date.name === 'beginposition';
        }).content;

        obj.ingestionname = item.str.find((item) => {
            return item.name === 's2datatakeid';
        }).content;

        if (item.str.hasOwnProperty('tileid')) {
            obj.tileid = item.str.find((item) => {
                return item.name === 'tileid';
            }).content;
        }

        obj.datasize = item.str.find((item) => {
            return item.name === 'size';
        }).content;

        // parse polygon
        let polygonString = item.str.find((item) => {
            return item.name === 'footprint';
        }).content;

        polygonString = polygonString.slice(10, -2);

        console.log(polygonString);

        polygonCoords = polygonString.split(',');

        console.log('Polygon coords : ', polygonCoords)

        let geoJsonFootprint = {};

        geoJsonFootprint.type = 'Polygon';
        geoJsonFootprint.coordinates = [];

        let singlePolygon = [];

        for (let coord of polygonCoords) {
            singlePolygon.push(coord.split(" ").map((item) => {
                console.log('item : ', item);
                return parseFloat(item);
            }));
        }

        geoJsonFootprint.coordinates.push(singlePolygon.reverse())

        obj.footprint = geoJsonFootprint;

        getPreviewImage(obj, true).then((result) => {
            resolve(result);
        });
    });
};