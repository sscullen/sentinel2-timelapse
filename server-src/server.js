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
const moment = require('moment');

const fs = require('fs');
const https = require('https');
const path = require('path');

const xml2js = require('xml2js');

const parseString = xml2js.parseString;
const { spawn } = require('child_process');

// for zip results files
var archiver = require('archiver');

// SEt up your auth requirements
const sentinelUser = process.env.sentinelUser;
const sentinelPass = process.env.sentinelPass;

// should grab env variables for email here as well
let jobHistory = undefined;

if (fs.existsSync(path.resolve(__dirname, '../datacache/jobhistory.json'))) {
    jobHistory = fs.readFileSync(path.resolve(__dirname, '../datacache/jobhistory.json'));
}

// IMPORTANT DATA

let jobList = [];
let jobCount = 0;

let atmosPromiseList = [];

// setup default developer options
let options = {
    resolution: 60, // this is the resolution the atmos correction is done at, much faster for testing
    maxResults: -1, // -1 is no limit, set a limit here will make testing the gui easier.
};

if (jobHistory) {
    console.log('found existing job history, updating server');
    console.log(jobHistory);

    jobList = JSON.parse(jobHistory);
    console.log(jobList);

    jobList.map((item) => {
        jobCount += 1;
    });

} else {
    console.log('no job history found, initing job list to empty array');
}

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


// connect to ESA Sentinel Datahub API, multiple pages might be required
const searchSentinelDataHubSinglePage = (polygonString, startRow, startDate) => {

    return new Promise((resolve, reject) => {
        let rows = 100;

        var options = {
            host: 'scihub.copernicus.eu',
            path: '/dhus/search?format=json&start=' + startRow + '&rows=' + rows + '&q=' + querystring.escape('platformname:Sentinel-2 AND filename:*L1C* AND footprint:"Intersects(POLYGON((' + polygonString + ')))"') + '&orderby=beginposition%20desc',
            auth:  sentinelUser + ':' + sentinelPass
        }

        console.log('making request to esa server');

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
                let dateNow = new Date();

                console.log(dateNow.getTime() - startDate.getTime())

                if ((dateNow.getTime() - startDate.getTime()) > 110000)
                    reject('taking too long to fetch search results, longer than 120 seconds')

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

const getCompleteItemList = (polygonString, itemList, startDate) => {

    return new Promise((resolve, reject) => {
        return searchSentinelDataHubSinglePage(polygonString, 0, startDate).then((result) => {
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
                    promiseList.push(searchSentinelDataHubSinglePage(polygonString, i * 100, startDate))
                }

                Promise.all(promiseList).then((result) => {
                    console.log("ALL DONE THIS GROUP OF PROMISES BOSS")
                    console.log('RESULT ', result)
                    //console.log(result);
                    for (let r of result) {
                        console.log('One result------------------------------------------------------------------------');
                        console.log(r.feed.entry.length)

                        if (r.feed.entry.length > 1)
                            itemList.push(...r.feed.entry)
                        else
                            itemList.push(r.feed.entry);
                    }
                    resolve();
                }, (err) => {
                    console.log('error occured when gathering all the search results')
                    reject(err)
                });
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

const createZipFile = (tileName) => {

    return new Promise((resolve, reject) => {

        // create a file to stream archive data to.
        var output = fs.createWriteStream(path.resolve(__dirname,'../datacache/zips/' + tileName + '.SAFE.zip'));
        var archive = archiver('zip', {
            zlib: { level: 5 } // Sets the compression level.
        });

        // listen for all archive data to be written
        // 'close' event is fired only when a file descriptor is involved
        output.on('close', function() {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');

            resolve('Tile was zipped successfully');
        });

        // This event is fired when the data source is drained no matter what was the data source.
        // It is not part of this library but rather from the NodeJS Stream API.
        // @see: https://nodejs.org/api/stream.html#stream_event_end
        output.on('end', function() {
            console.log('Data has been drained');
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function(err) {
            if (err.code === 'ENOENT') {
                // log warning
            } else {
                // throw error
                throw err;
            }
        });

        // good practice to catch this error explicitly
        archive.on('error', function(err) {
            throw err;
            reject(err);
        });

        // pipe archive data to the file
        archive.pipe(output);

        // // append a file from stream
        //     var file1 = __dirname + '/file1.txt';
        //     archive.append(fs.createReadStream(file1), { name: 'file1.txt' });
        //
        // // append a file from string
        //     archive.append('string cheese!', { name: 'file2.txt' });
        //
        // // append a file from buffer
        //     var buffer3 = Buffer.from('buff it!');
        //     archive.append(buffer3, { name: 'file3.txt' });
        //
        // // append a file
        //     archive.file('file1.txt', { name: 'file4.txt' });

        // // append files from a sub-directory and naming it `new-subdir` within the archive
        //     archive.directory('subdir/', 'new-subdir');

        // append files from a sub-directory, putting its contents at the root of archive
        console.log(path.resolve(__dirname, '../datacache/', tileName + '.SAFE/'));

        archive.directory(path.resolve(__dirname, '../datacache/', tileName + '.SAFE/'), false);

        // // append files from a glob pattern
        //     archive.glob('subdir/*.txt');

        // finalize the archive (ie we are done appending files but streams have to finish yet)
        // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
        archive.finalize();
    });



};

const createZipJob = (tileList, jobID) => {
    return new Promise((resolve, reject) => {

        let dateNow = moment().format("YYMMDD_HHmm");
        let fileName = 'JOBID_' + jobID.toString().padStart(4, "0") + '_' + dateNow;

        // create a file to stream archive data to.
        var output = fs.createWriteStream(path.resolve(__dirname,'../datacache/zips/' + fileName + '.zip'));
        var archive = archiver('zip', {
            zlib: { level: 1 } // Sets the compression level.
        });

        // listen for all archive data to be written
        // 'close' event is fired only when a file descriptor is involved
        output.on('close', function() {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            let jobResolveObject = {
                message: 'Job was zipped successfully',
                jobFileName: fileName
            };
            resolve(jobResolveObject);
        });

        // This event is fired when the data source is drained no matter what was the data source.
        // It is not part of this library but rather from the NodeJS Stream API.
        // @see: https://nodejs.org/api/stream.html#stream_event_end
        output.on('end', function() {
            console.log('Data has been drained');
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function(err) {
            if (err.code === 'ENOENT') {
                // log warning
            } else {
                // throw error
                throw err;
            }
        });

        // good practice to catch this error explicitly
        archive.on('error', function(err) {
            throw err;
            reject(err);
        });

        // pipe archive data to the file
        archive.pipe(output);

        // // append a file from stream
        //     var file1 = __dirname + '/file1.txt';
        //     archive.append(fs.createReadStream(file1), { name: 'file1.txt' });
        //
        // // append a file from string
        //     archive.append('string cheese!', { name: 'file2.txt' });
        //
        // // append a file from buffer
        //     var buffer3 = Buffer.from('buff it!');
        //     archive.append(buffer3, { name: 'file3.txt' });
        //

        tileList.map((item) => {
            let correctTileZipName = item.name.replace(/L1C/, 'L2A') + '.SAFE.zip';

            console.log(path.resolve(__dirname, '../datacache/', correctTileZipName));
            // append a file
            archive.file(path.resolve(__dirname, '../datacache/zips/', correctTileZipName), {
                name: correctTileZipName });
        });



        // // append files from a sub-directory and naming it `new-subdir` within the archive
        //     archive.directory('subdir/', 'new-subdir');

        // append files from a sub-directory, putting its contents at the root of archive
        // console.log(path.resolve(__dirname, '../datacache/', tileName + '.SAFE/'));
        //
        // archive.directory(path.resolve(__dirname, '../datacache/', tileName + '.SAFE/'), false);

        // // append files from a glob pattern
        //     archive.glob('subdir/*.txt');

        // finalize the archive (ie we are done appending files but streams have to finish yet)
        // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
        archive.finalize();
    });
};


const getTileData = (options) => {


    return new Promise((resolve, reject) => {
        let imagePath = `/dhus/odata/v1/Products('${options}')/$value`;

        console.log('https://scihub.copernicus.eu/' + imagePath);

        axios({
            method: 'get',
            url: imagePath,
            baseURL: 'https://scihub.copernicus.eu',
            responseType: 'stream',
            timeout: 120000,
            auth: {
                username: sentinelUser,
                password: sentinelPass
            },
            httpsAgent: new https.Agent({keepAlive: true})
        }).then((res) => {

            console.log('RESPONSE STARTS HERE: ' +
                res);
            console.log('axios WORKDED!');

            // console.log(response.headers)
            // console.log(typeof(response.statusCode))

            if (res.statusCode === 404) {
                console.log('status code is 404')
                return reject('not found')
            } else if (res.statusCode === 401) {

                console.log('status code is un-authorized')

                return reject('not authorized')
            }

            // console.log('image buffer has been received! --------------------------------------');
            // console.log('image buffer is... ', res);
            let data = [];
            let timeout;
            res.data.on('data', (chunk) => {
                console.log(`Received ${chunk.length} bytes of data.`);
                data.push(chunk);
                clearTimeout(timeout);

                timeout = setTimeout(() => {
                    console.log('streaming the data took too long');
                    res.data.destroy();
                }, 30000);
            });

            res.data.on('end', () => {
                console.log('There will be no more data.');
                let finalBuffer = Buffer.concat(data);

                clearTimeout(timeout);

                resolve(finalBuffer);

            });

            res.data.on('error', (err) => {
                console.log('something went wrong connecting to the stream')
                reject(err);
            });
        }).catch((err) => {
            console.log(err);
        });
    });
};

app.get('/jobs', (req, res) => {
    console.log('recieved a request for currently active jobs');



    if (jobList.length === 0) {
        res.status(200).send(JSON.stringify(jobList));
    } else {
        res.status(200).send(JSON.stringify(jobList));
    }

});

app.post('/options', bodyParser.json(), (req, res) => {
   console.log('recieved post request to /options');

   console.log('data', req.body);

   options.maxResults = req.body.maxResults;
   options.resolution = req.body.resolution;

   res.status(200).send();

});

app.get('/previewimage/:name', (req, response) => {

    console.log(req.params.name)
    // On Windows Only ...
    // use sentinel hub python script
    const bat = spawn('cmd.exe', ['/c', 'sentinelhub.aws', '--product', req.params.name, '-i']);

    let jsonString = '';

    bat.stdout.on('data', (data) => {
        console.log(data.toString());
        jsonString = data.toString();
    });

    bat.stderr.on('data', (data) => {
        console.log('something went wrong when trying to fetch the object structure')
    });

    bat.on('exit', (code) => {
        console.log(`Child exited with code ${code}`);


        if (code === 0) {
            console.log('fetched the object structure successfully')

        } else {
            console.log('didnt work, something went wrong');

        }

        let fixedJson = jsonString.replace(/'/g, '"');
        let jsonObject = JSON.parse(fixedJson);

        console.log(jsonObject[req.params.name + '.SAFE'].GRANULE)

        let nextKey = Object.keys(jsonObject[req.params.name + '.SAFE'].GRANULE)[0]
        console.log(jsonObject[req.params.name + '.SAFE'].GRANULE[nextKey].IMG_DATA);

        let finalKey = Object.keys(jsonObject[req.params.name + '.SAFE'].GRANULE[nextKey].IMG_DATA).find((item) => {
            if (item.includes('TCI'))
                return item;
        })

        console.log('AWS url for hi res TCI image', jsonObject[req.params.name + '.SAFE'].GRANULE[nextKey].IMG_DATA[finalKey]);

        console.log('lets get the preview instead')

        let stringURL = jsonObject[req.params.name + '.SAFE'].GRANULE[nextKey].IMG_DATA[finalKey].replace(/TCI.jp2/, 'preview.jpg');

        axios({
            method: 'get',
            url: stringURL,
            baseURL: '',
            responseType: 'stream',
            timeout: 120000,
        }).then((res) => {

            console.log('RESPONSE STARTS HERE: ',
                res);
            console.log('axios WORKDED!');

            // console.log(response.headers)
            // console.log(typeof(response.statusCode))

            if (res.statusCode === 404) {
                console.log('status code is 404')
                return reject('not found')
            } else if (res.statusCode === 401) {

                console.log('status code is un-authorized')

                return reject('not authorized')
            }

            // // console.log('image buffer has been received! --------------------------------------');
            // // console.log('image buffer is... ', res);
            let data = [];
            let timeout;
            res.data.on('data', (chunk) => {
                console.log(`Received ${chunk.length} bytes of data.`);
                data.push(chunk);
                clearTimeout(timeout);

                timeout = setTimeout(() => {
                    console.log('streaming the data took too long');
                    res.data.destroy();
                }, 30000);
            });

            res.data.on('end', () => {
                console.log('There will be no more data.');
                let finalBuffer = Buffer.concat(data);

                clearTimeout(timeout);


                response.status(200).send(finalBuffer);
            });

            res.data.on('error', (err) => {
                console.log('something went wrong connecting to the stream')
                response.status(500).send();
            });
        }).catch((err) => {
            console.log(err);
        });
    });
});

// TODO: delete this function, a broken bad first attempt

// const startDownloadingBatch = (jobID, tileList, index, pageSize) => {
//
//     console.log('inside startDownloadBatch, creating group of promises...')
//     console.log('tileList, index, pageSize', tileList, index, pageSize);
//
//     return new Promise((resolve, reject) => {
//
//         // if no more tiles, then resolve, otherwise recurse
//         let tileListLength = tileList.length;
//         let iteration = pageSize;
//
//         if ((tileListLength - index) < 3) {
//             iteration = tileListLength - index;
//         }
//
//         let promiseDownloadList = [];
//         for(let i = index; i < index + iteration; i++) {
//             let downloadPromise = downloadATile(tileList[i].name, jobID);
//             promiseDownloadList.push(downloadPromise);
//         }
//
//         Promise.all(promiseDownloadList).then((result) => {
//
//             if (tileListLength <= index + iteration) {
//                 console.log('there are no more tiles, we are done');
//
//                 // uncomment these to do atmos
//
//                 // for (let i = index; i < tileListLength; i++) {
//                 //     console.log('starting index', index, i, tileListLength);
//                 //
//                 //     atmosPromiseList.push(atmosCorrectATile(tileList[i].name, jobID).then((result) => {
//                 //         console.log('did we run atmos correction correctly? ', result)
//                 //         return result;
//                 //     }));
//                 // }
//
//
//                 return resolve(result);
//
//
//             } else {
//                 console.log('there are more tiles to do, recursing in startDownloadBatch');
//                 // before starting a new batch, lets start a batch of atmos correction on the
//                 // data we just downloaded
//
//                 // startAtmosCorrectionBatchHere
//                 // return the promise list here by adding to promise list
//                 // associated with the jobID, then where the downloading batch is finished, we can wait for the
//                 // atmos correction promise list to finish
//
//                 // uncomment to do atmos
//
//                 for (let i = index; i < index + 3; i++) {
//                     console.log('starting index', index, i, tileListLength);
//
//                     atmosPromiseList.push(atmosCorrectATile(tileList[i].name, jobID));
//
//                 }
//
//
//                 startDownloadingBatch(jobID, tileList, index + 3, pageSize);
//             }
//
//
//         }, (err) => {
//             console.log('something went wrong');
//         });
//
//
//     });
//
// };

// Code sourced from https://github.com/DukeyToo/es6-promise-patterns

function resourceLimiter(numResources) {

    let pool = {
        available: numResources,
        max: numResources
    };

    let futures = []; //array of callbacks to trigger the promised resources

    /*
     * takes a resource.  returns a promises that resolves when the resource is available.
     * promises resolve FIFO.
     */
    pool.take = function() {
        if (pool.available > 0) {
            // no need to wait - take a slot and resolve immediately
            pool.available -= 1;
            return Promise.resolve();
        } else {
            // need to wait - return promise that resolves when wait is over
            let p = new Promise(function(resolve, reject) {
                futures.push(resolve);
            });

            return p;
        }
    }

    var emptyPromiseResolver;
    var emptyPromise = new Promise(function(resolve, reject) {
        emptyPromiseResolver = resolve;
    });

    /*
     * returns a resource to the pool
     */
    pool.give = function() {
        if (futures.length) {
            // we have a task waiting - execute it
            var future = futures.shift(); // FIFO

            future();
        } else {
            // no tasks waiting - increase the available count
            pool.available += 1;
            if (pool.available === pool.max) {
                emptyPromiseResolver('Queue is empty')
            }
        }
    }

    /*
     * Returns a promise that resolves when the queue is empty
     */
    pool.emptyPromise = function() {
        return emptyPromise;
    }

    return pool;
};

// Adapt this function to work with tileList

function maxInProcessThrottle(someInput, times, limit) {
    var limiter = resourceLimiter(limit);  //max "limit" in-process at a time

    var finalOutput = someInput;

    var tasks = new Array(times);

    function executeTask(i) {
        return function() {
            return downloadATile("", i).then(function(result) {
                finalOutput += result;
                limiter.give();
            });
        }
    }

    for (var i=0; i<times; i++) {
        tasks[i] = limiter.take().then(executeTask(i));
    }

    return Promise.all(tasks).then(function(results) {
        return finalOutput;
    });
};

function downloadTiles(tileList, jobID, limit) {
    let limiter = resourceLimiter(limit); //max "limit" in-process at a time

    // check the resolution for the job, if the resolution is high, then less tiles should be processed in parallel
    let atmosLimit = 3;
    if (jobList[jobID].resolution == 60) {
        atmosLimit += 1;
    } else if (jobList[jobID].resolution === 10) {
        atmosLimit -= 1;
    }

    let atmosCorrectionLimiter = resourceLimiter(atmosLimit);

    let tilePromises = [];
    let atmosCorrectPromises = [];

    for (let tile of tileList) {
        tilePromises.push(limiter.take().then(() => downloadATile(tile.name, jobID).then((result) => {
            console.log('Result: ', result);

            atmosCorrectPromises.push(atmosCorrectionLimiter.take().then(() => atmosCorrectATile(tile.name, jobID)
                .then((result) => {
                    console.log('Result: ', result);
                    console.log('done atmos correction on a tile')
                    atmosCorrectionLimiter.give();
                })));

            limiter.give();
        })));
    }

    return Promise.all(tilePromises).then((results) => {
        console.log('done downloading all tiles =====================================================');

        return Promise.all(atmosCorrectPromises);

    }).then((results) => {
        console.log('done correcting all tiles ===================================================');
    });
}

const downloadATile = (tileName, jobID) => {

    // use jobID to look up settings

    // newJob.tileStatus[item] = {
    //     downloading: '',
    //     atmosCorrection: '',
    //     processing: ''
    console.log(`Downloading using AWS tile ${tileName} from job ${jobID})`);
    jobList[jobID].tileStatus[tileName].downloading = 'inprogress';

    return new Promise((resolve, reject) => {

        // On Windows Only ...
        // use sentinel hub python script
        const bat = spawn('cmd.exe', ['/c', 'sentinelhub.aws', '--product', tileName], {cwd: path.resolve(__dirname, '../datacache')});

        bat.stdout.on('data', (data) => {
            jobList[jobID].jobLog.push('++__' + tileName + "__" + data.toString());

            console.log('++__' + tileName + "__" + data.toString());

            jobList[jobID].tileStatus[tileName].downloading = 'inprogress';
        });

        bat.stderr.on('data', (data) => {
            jobList[jobID].jobLog.push('XX__' + tileName + "__" + data.toString());

            console.log('XX__' + tileName + "__" + data.toString());

            jobList[jobID].tileStatus[tileName].downloading = 'failed';
            reject('ERROR XX__' + tileName + "__" + data.toString());
        });

        bat.on('exit', (code) => {
            console.log(`Child exited with code ${code}`);


            if (code === 0) {
                console.log('finished AWS Download successfully')
                jobList[jobID].tileStatus[tileName].downloading = 'completed';
                jobList[jobID].status.downloading += 1;

                resolve('success!')
            } else {
                console.log('download failed')
                jobList[jobID].tileStatus[tileName].downloading = 'failed';
                reject('failed...')
            }

            console.log('tile status for job id', jobList[jobID].tileStatus, jobID)
        });
    });
};

const atmosCorrectATile = (tileName, jobID) => {

    console.log(`Running atmospheric correction on a tile ${tileName} from job ${jobID})`);
    jobList[jobID].tileStatus[tileName].atmosCorrection = 'inprogress';

    return new Promise((resolve, reject) => {
        // WRAP THIS IN A PROMISE!

        // On Windows Only ...
        // use sentinel hub python script
        const bat = spawn('cmd.exe', ['/c', 'L2A_Process.bat', '--resolution', jobList[jobID].resolution, tileName + '.SAFE'], {cwd: path.resolve(__dirname, '../datacache')});

        bat.stdout.on('data', (data) => {
            jobList[jobID].jobLog.push('++__' + tileName + "__" + data.toString());

            console.log('++__' + tileName + "__" + data.toString());

            jobList[jobID].tileStatus[tileName].atmosCorrection = 'inprogress';
        });

        bat.stderr.on('data', (data) => {
            jobList[jobID].jobLog.push('XX__' + tileName + "__" + data.toString());

            console.log('ERROR XX__' + tileName + "__" + data.toString());

            jobList[jobID].tileStatus[tileName].atmosCorrection = 'failed';

            reject(data.toString());
        });

        bat.on('exit', (code) => {
            console.log(`Child exited with code ${code}`);


            if (code === 0) {
                console.log('finished atmospheric correction successfully')
                jobList[jobID].tileStatus[tileName].atmosCorrection = 'completed';
                jobList[jobID].status.atmosCorrection += 1;

                resolve('success!================================ ATMOS CORRECTION on a tile done')
            } else {
                console.log('atmospheric correction failed')
                jobList[jobID].tileStatus[tileName].atmosCorrection = 'failed';
                reject('failed...')
            }

            console.log('tile status for job id', jobList[jobID].tileStatus, jobID)
        });
    });
};

app.post('/startjob', bodyParser.json(), (req, res) => {
    console.log('received a POST request at /startjob');
    console.log(req.body);

    let useAWS = true;
    let atmosCorrectionRes = 10; // 10, 20, 60

    let jobID = jobCount;

    // should get an options object from the client specifying things like:
    // bands to return, should clip to study area, file format (simple, .SAFE)
    // should produce NDVI, NIC, any other composites required.

    // sample job object
    // {
    //     dateSubmitted: new Date(),
    //         dateCompleted: undefined,
    //     studyArea: undefined, // geojson polygon should go here, from client
    //     jobID: jobCount,
    //     dateCompleted: undefined,
    //     email: req.body.email,
    //     tileList: req.body.idList,
    //     status: {
    //     overall: 'starting',
    //         downloading: 0,
    //         atmosCorrection: 0,
    //         processing: 0
    // },
    //     options: {
    //         deliveryFormat: 'simple', // options here are simple, safe, if safe is selected, then all bands are delivered
    //             bands: [],
    //             processing: {
    //             clip: true, // clip bands and other processed results to study area
    //                 ndvi: true, // create a vegatation index ratio image from red and nir bands
    //                 fcni: true, // create a false color composite with nir, red, green
    //         }
    //     },
    //     jobLog: ['Job has been submitted and is starting...'],
    //         downloadLink: undefined
    // }
    //

    console.log(req.body.idList);

    let newJob = {
        dateSubmitted: new Date(),
            dateCompleted: undefined,
        studyArea: undefined, // geojson polygon should go here, from client
        jobID: jobCount,
        email: req.body.email,
        tileList: req.body.idList,
        tileStatus: {},
        resolution: options.resolution, // 10, 20, 60m used for atmos correction
        status: {
        overall: 'started',
            downloading: 0,
            atmosCorrection: 0,
            processing: 0,
    },
        options: {
            deliveryFormat: 'simple', // options here are simple, safe, if safe is selected, then all bands are delivered
                bands: [],
                processing: {
                clip: false, // clip bands and other processed results to study area
                    ndvi: false, // create a vegetation index ratio image from red and nir bands
                    fcni: false, // create a false color composite with nir, red, green
            }
        },
        jobLog: ['Job has been submitted and is starting...'],
            downloadLink: undefined
    };

    newJob.tileList.map((item) => {
        console.log(item);
        newJob.tileStatus[item.name] = {
            downloading: 'not started',
            atmosCorrection: 'not started',
            processing: 'not started'
        };
    });

    // atmosPromiseList[jobID] = [];

    jobList.push(newJob);

    res.status(200).send();

    jobCount += 1;

    let currentId = req.body.idList[0];

    if (!useAWS) {
        getTileData(currentId.id).then((result) => {
            console.log('Current Job List', jobList);

            console.log('tile fetching worked!')
            console.log(result);
            console.log('writing to file');

            try {
                fs.writeFile('datacache/' + currentId.name + '.zip', result, (err) => {
                    if (err) throw err;
                    console.log('The file has been saved!');
                });
            } catch (err) {
                console.log('Something went wrong', err);
            }

        }, (err) => {
            console.log('Something failed when fetching the tile', err);
        });
    } else {
        console.log('Not using ESA data hub...');

        let dataCachePath = path.resolve(__dirname, '../datacache/')

        console.log('PATH: ', __dirname);
        console.log('Datacache path, ', dataCachePath);

        // okay lets implement multiple tiles
        // premise: can do three tiles at once without flooding the server or client
        // 3 downloads should be running at a time (if possible), along side 3 atmos corrections,
        // 3 processing ops.
        // downloading is network intensive, while atmos and processing is CPU intense
        // could do downloading only..., linear chain of promises, wastes CPU cycles
        // but definitely DO NOT want to be waiting on CPU atmos correction to start downloading again
        // SHOULD ALWAYS BE DOWNLOADING....
        // so. linear chain of downloads not great, might not saturate connection to AWS, 3 at a time should
        // when that batch of Downloading is done, we recurse to do another batch, and start CPU processing

        let amountOfTiles = req.body.idList.length;
        let tileList = req.body.idList;

        let batchesRequired = Math.ceil(amountOfTiles / 3);
        let lastBatchAmount = amountOfTiles % 3;
        let pageSize = 3;
        let index = 0;

        // so we be paging, need a start index, page size (3)
        if (batchesRequired === 1)
            pageSize = lastBatchAmount;

        downloadTiles(tileList, jobID, pageSize).then((result) => {

            console.log('Finished+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
            console.log('result', result);

            console.log('ALL DONE!');

            // should run the zip utility and add a url for sendFile to the client
            // here

            console.log('jobStatus', jobList[jobID]);

            let archivePromiseList = [];

            tileList.map((tile) => {

                let correctedTileName = tile.name.replace(/L1C/, 'L2A');
                console.log('The tilename we want is ', path.resolve(__dirname, '../datacache/zips/', correctedTileName + '.zip'));

                // first, check to see if .zip archive already exists
                if (fs.existsSync(path.resolve(__dirname, '../datacache/zips/', correctedTileName + '.SAFE.zip'))) {
                    // Do something
                    console.log('that tile already has a zip archive');
                } else {
                    archivePromiseList.push(createZipFile(correctedTileName).then((result) => {
                        console.log('created the zip file successfully for ', correctedTileName);
                    }));
                }
                // make sure to convert the filename to use the correct version: L1C --> L2A
            });

            Promise.all(archivePromiseList).then((result) =>{
                console.log('all of the individual tile folders were archived, time to archive a the whole job');

                return createZipJob(tileList, jobID);

            }).then((result) => {

                console.log('Succesfully zipped entire job');
                console.log(result.message);

                console.log('the finished jobs filename is ', result.jobFileName);

                // need to update job data, add link to download,
                // send email

                // hooray, update jobobject with links for download
                // send email with download, and we are done

                console.log(jobList[jobID]);
                jobList[jobID].status.overall = 'completed';

                jobList[jobID].downloadLink = {
                    jobDownload: result.jobFileName + '.zip',
                    tilesDownload: []
                };

                tileList.map((item) => {
                   let finalName = item.name.replace(/L1C/, 'L2A') + '.SAFE.zip';

                   jobList[jobID].downloadLink.tilesDownload.push(finalName);
                });

                jobList[jobID].dateCompleted = moment();

                console.log('job log file write', path.resolve(__dirname, '../datacache/' + result.jobFileName + '.json'));

                fs.writeFileSync(path.resolve(__dirname, '../datacache/' + result.jobFileName + '.json'),
                    JSON.stringify(jobList[jobID]));

                console.log('job data updated!');

                fs.writeFileSync(path.resolve(__dirname, '../datacache/' + 'jobhistory' + '.json'),
                    JSON.stringify(jobList));



            }).catch((err) => {
                console.log('somethign went wrong for one of the tiles ', err);

                // set job to failed here
                jobList[jobID].status.overall = 'failed';
            });




        }).catch((err) => {
            console.log('something went wrong, ', err);
        });

    }

});

app.get('/getzip/:zipfilename', (req, res) => {
   console.log('recieved request for zip file, ', req.params.zipfilename);


    if (fs.existsSync(path.resolve(__dirname, '../datacache/zips/', req.params.zipfilename))) {
        // Do something
        res.sendFile(path.resolve(__dirname, '../datacache/zips/' + req.params.zipfilename));
        console.log('sending file to client');
    } else {
        res.status(404).send();
    }
});

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

    let startRequestTime = new Date();

    getCompleteItemList(polygonString, itemList, startRequestTime).then(() => {
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

        // .entries() lets use an iterator to get the index of the loop
        // along with [index, item]

        res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Transfer-Encoding': 'chunked'
        });

        // using for development, set to -1 in production
        let maxResults = options.maxResults;

        for (let [index, item] of itemList.entries()) {

            if (maxResults !== -1)
                if (index === maxResults)
                    break

            console.log('-==================== stargin promise for item ' + index + ' of ' + itemList.length);
            promiseList.push(reformatDataItem(item, index, itemList.length, res))
        }

        Promise.all(promiseList).then((result) => {

            console.log('all done! Everything was transferred to client successfully====================================');

            res.end();

        }, (err) => {
            console.log('something went wrong, in the reject block!', err);
            console.log('something went wrong trying to reformat each data item and fetch the preview image.')
            res.status(401).send('something went wrong trying to reformat each data item and fetch the preview image.');
        }).catch((err) => {
            console.log('something went wrong WOOP WOOP in the catch block');
            res.status(401).send('something went wrong trying to reformat each data item and fetch the preview image.');
        });


    }, (err) => {
        console.log('the promise was rejected, ', err)
        res.status(500).send(err);
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

// connect to ESA Sentinel Datahub API to get preview image, return as a base64 encoded string,
// That can be transferred back to binary on the client side
const getPreviewImage = (obj, base64String) => {

    return new Promise((resolve, reject) => {
        // Quicklookurl https://scihub.copernicus.eu/dhus/odata/v1/Products('f4d9d5b2-48de-4f64-b4c9-16ad52222f6c')/Products('Quicklook')/$value
        const justPath = obj.quicklookURL.slice(28);

        var options = {
            host: 'scihub.copernicus.eu',
            path: justPath,
            auth:  sentinelUser + ':' + sentinelPass,
            timeout: 5000
        };

        console.log(justPath);

        console.log('in get preview image, sending http request...')

        // try implementing with another library

        axios({
            method: 'get',
            url: justPath,
            baseURL: 'https://scihub.copernicus.eu',
            responseType: 'stream',
            timeout: 120000,
            auth: {
                username: sentinelUser,
                password: sentinelPass
            },
            httpsAgent: new https.Agent({ keepAlive: true })
        }).then((res) => {

            console.log('RESPONSE STARTS HERE: ' +
                res);
            console.log('axios WORKDED!')

            // console.log(response.headers)
            // console.log(typeof(response.statusCode))

            if (res.statusCode === 404) {
                console.log('status code is 404')
                return reject('not found')
            } else if(res.statusCode === 401) {

                console.log('status code is un-authorized')

                return reject('not authorized')
            }

            // console.log('image buffer has been received! --------------------------------------');
            // console.log('image buffer is... ', res);
            let data =[];
            let timeout;
            res.data.on('data', (chunk) => {
                console.log(`Received ${chunk.length} bytes of data.`);
                data.push(chunk);
                clearTimeout(timeout);

                timeout = setTimeout(() => {
                    console.log('streaming the data took too long');
                    res.data.destroy();
                }, 30000);
            });

            res.data.on('end', () => {
                console.log('There will be no more data.');
                let finalBuffer = Buffer.concat(data);

                clearTimeout(timeout);

                if (base64String === true) {
                    obj.imagebuffer = finalBuffer.toString('base64');

                    // console.log(obj.imagebuffer);
                    // console.log('resolving promise with image buffer converted to base64 string');
                    resolve(obj);
                } else {
                    obj.imagebuffer = finalBuffer;
                    resolve(obj);
                }
            });

            res.data.on('error', (err) => {
                console.log('something went wrong connecting to the stream')
                reject(err);
            });

        }).catch((err) => {
            console.log(err);
            console.log('GET IMAGE PREVIEW: somethign went wrong trying to fetch the image preview', err);

            reject(err);
            console.log('axios did not work')
        });
    });
};


const reformatDataItem = (item, index, length, res) => {

    console.log('returning a new promise')
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
            console.log('looping through polygons.')
            singlePolygon.push(coord.split(" ").map((item) => {
                console.log('item : ', item);
                return parseFloat(item);
            }));
        }

        geoJsonFootprint.coordinates.push(singlePolygon.reverse())

        obj.footprint = geoJsonFootprint;

        // calling get preview image
        console.log('calling get Preview from within reformate data... ');
        getPreviewImage(obj, true).then((result) => {
            console.log('Got preview image', result.uuid);
            console.log(`resolving ${index} of ${length}`);
            res.write(JSON.stringify(result) + '_#_', 'utf8', () => {
                console.log('write is finished')
                resolve(result);
            });

        }, (err) => {
            console.log('REFORMATDATAITEM_ something went wrong when trying to get the preview image,' +
                'setting image buffer to undefined and resolving', err);
            obj.imageBuffer = undefined;
            console.log(`resolving ${index} of ${length}, could not fetch image preview`);
            console.log(obj);
            res.write(JSON.stringify(obj) + '_#_', 'utf8', () => {
                console.log('write is finished')
                resolve(obj);
            });
        });
    });
};