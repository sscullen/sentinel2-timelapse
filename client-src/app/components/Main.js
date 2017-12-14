/**
 * Created by sc on 7/25/2017.
 */
import React from 'react';

import axios from 'axios';

import coordinator from 'coordinator';

import moment from 'moment';
import ReactModal from 'react-modal';




import "../style/_Main.scss";

import config from 'Config';

// using vanilla mapbox api, callbacks setup in componentDidMount
import mapboxgl from 'mapbox-gl';
import mapboxgldraw from '@mapbox/mapbox-gl-draw';

// Don't forget to import the CSS
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// Components
import LinearCalendar from './LinearCalendar';
import ResultItem from './ResultItem';

const position = [51.505, -0.09];

mapboxgl.accessToken = 'pk.eyJ1Ijoic2N1bGxlbiIsImEiOiJ1UVAwZ19BIn0.wn4ltQcyl9P5j3bAmNJEPg'

export default class Main extends React.Component {

    constructor(props) {
        super(props);

        this.getBoundsInMGRS = this.getBoundsInMGRS.bind(this);
        this.clickHandler = this.clickHandler.bind(this);
        this.toggleAmazonAPI = this.toggleAmazonAPI.bind(this);
        this.handleZoomChange = this.handleZoomChange.bind(this);
        this.setCurrentTile = this.setCurrentTile.bind(this);
        this.toggleDeveloperCache = this.toggleDeveloperCache.bind(this);

        this.keyDebouncer = false;
        this.scrollDebouncer = false;
        this.previousScrollTop = 0;
        this.userScroll = false;

        this.layerList = [];

        this.state = {
            imageSrc: "./app/static/img.jpg",
            currentTileInfo: {},
            amazonAPI: false,
            resultsList: [],
            geoJson: [],
            tileFootprint: [],
            currentTileID: "",
            currentTileLayerID: "",
            selectionID: "",
            requestStarted: undefined,
            requestTime: 0,
            currentResultNumber: 0,
            developerCache: false,
            showJobModal: false,
            showJobListModal: false,
            selectedCount: 0,
            jobList: []
        };
    }

    componentDidMount() {

        this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: 'mapbox://styles/mapbox/streets-v9',
            center: [0, 54],
            zoom: 5
        });

        this.map.on('click', (e) => {
            console.log('map clicked', e)
        });

        let scrollContainer = document.getElementsByClassName('scrollContainer')[0];

        document.addEventListener('mousewheel', () => {

            this.userScroll = true;
            console.log('this is the user')
        });

        // Create a Draw control
        this.draw = new mapboxgldraw();

        // Add the Draw control to your map
        this.map.addControl(this.draw);

        this.map.on('draw.create', (feature) => {
           console.log('Selection: ', feature);

           let coords = feature.features[0].geometry.coordinates[0];

           console.log('Starting coords', coords);

           // set the polygon to the store so the job has reference to the polygon
            this.setState({
                studyAreaPolygon: feature.features[0]
            });


           let selectionSource = this.map.getSource('selection-id');

           if (selectionSource === undefined) {
               this.map.addSource('selection-id', {
                   type: 'geojson',
                   data: feature.features[0]
               })

               this.map.addLayer({
                   id: 'selection-id',
                   type: 'line',
                   source: 'selection-id',
                   paint: {
                       'line-width': 4,
                       'line-color': '#77ffda'
                   }
               });
           } else {
               selectionSource.setData(feature.features[0])
           }

           let coordsLatLng = []

            for (let coord of coords) {
                console.log('coord', coord);

                let newCoord = {}
                newCoord.lat = coord[1]
                newCoord.lng = coord[0]
               coordsLatLng.push(newCoord)
            }

            console.log('okay!')

            console.log('finishing coords', coordsLatLng)

           this.getBoundsInMGRS(coordsLatLng)

        });

        document.addEventListener('keydown', (event) => {

            let timeout;

            if (this.keyDebouncer === false) {

                this.keyDebouncer = true;

                timeout = setTimeout(() => {
                    this.keyDebouncer = false;
                }, 250);

                const keyName = event.key;

                if (keyName === 'ArrowUp') {
                    // do not alert when only Control key is pressed.
                    console.log('User pressed the up arrow key')

                    if(this.state.currentResultNumber > 0) {
                        
                        console.log(this.state.currentResultNumber);

                        let newResultNum = this.state.currentResultNumber - 1;
                        console.log(newResultNum, 'new cursor num')


                        this.itemClicked(this.state.resultsList[newResultNum].uuid, newResultNum)
                    }
                }

                if (keyName === 'ArrowDown') {

                    console.log(this.state.currentResultNumber);


                    if(this.state.currentResultNumber < this.state.resultsList.length - 1) {

                        let newResultNum = this.state.currentResultNumber + 1;
                        console.log(newResultNum, 'new cursor num')
                        this.itemClicked(this.state.resultsList[newResultNum].uuid, newResultNum)
                    }
                }

                if (keyName === ' ') {
                    // do not alert when only Control key is pressed.
                    console.log('User pressed the space bar')

                    let newStateList = this.state.resultsList.map((item) => {
                        if (item.uuid === this.state.currentTileID)
                            item.selected = !item.selected
                        return item;
                    });

                    let count = 0;

                    newStateList.map((item) => {
                        if(item.selected === true)
                            count++
                    });

                    this.setState({
                        resultsList: [...newStateList],
                        selectedCount: count

                    });
                }

            } else {


            }


        }, false);

    }

    componentWillUnmount() {
        this.map.remove();
    }

    componentDidUpdate() {
        console.log('component updated')
    }

    clickHandler(map, evt) {
        console.log('lcik', map, evt)
        //this.drawControl.draw.deleteAll().getAll();
    }

    toggleAmazonAPI() {
        this.setState({
            amazonAPI: !this.state.amazonAPI
        })
    }

    toggleDeveloperCache() {
        this.setState({
          developerCache: !this.state.developerCache
        })
    }

    handleZoomChange(event) {
        console.log('Zoom change event-------', event);

        console.log('Current zoom level: ', event.target._zoom);

        if (event.target._zoom > 5) {
            console.log('Zoom level is greater than 5...')
        }
    }

    setCurrentTile(uuid, event) {
        console.log('Tile clicked', event)

        console.log('Tile id : ', uuid)

        this.setState({
            currentTileID: uuid
        });

        let currentTile = this.state.resultsList.filter((tile) => tile.uuid === uuid)[0]
        console.log('currentTile', currentTile);

        let myRE = /T\d{1,2}[A-Z]{3}/;

        var myArray = myRE.exec(currentTile.product_name);

        if (myArray !== null) {
            let tileUTM = myArray[0].slice(1);

            console.log('TileUTM ident', tileUTM);

            // get the right footprint from the list of tile foot prints
            let currentFootprint = this.state.tileFootprint.filter((tile) => tile.name === tileUTM)[0];

            let coords = currentFootprint.geometry.geometries[0].coordinates[0];

            console.log('footprint geometry=================================================================', coords)

            if (this.map.getLayer(this.state.currentTileLayerID + 'footprint') !== undefined) {
                this.map.removeLayer(this.state.currentTileLayerID + 'footprint');
                this.map.removeLayer(this.state.currentTileLayerID + 'image');

                console.log('----------------------------------removed previous layer')
            }

            let currentSource = this.map.getSource(currentTile.uuid + 'footprint')
            console.log(currentSource);
            console.log('current footprint', currentFootprint);

            this.setState({
                currentFootprint: currentFootprint
            });

            if (currentSource === undefined) {

                console.log('-------------------------------------Never encountered this source before, adding....')

                this.map.addSource(currentTile.uuid + 'footprint', {
                    type: 'geojson',
                    data: currentTile.footprint
                })

                console.log(currentFootprint);
                let imageFootprint = currentFootprint.geometry.geometries[0].coordinates[0];

                console.log('image footprint', imageFootprint)

                let imageThing = imageFootprint.map((item) => {
                    return [item[0], item[1]]
                });

                imageThing.pop()

                console.log('image footprint 2', imageThing)

                this.map.addSource(currentTile.uuid + 'image', {
                    type: 'image',
                    url: currentTile.localImageURL,
                    coordinates: imageThing
                })
            }

            console.log('---------------------------------------------------------adding this footprint to map... ')

            this.map.addLayer({
                id: currentTile.uuid + 'footprint',
                type: 'line',
                source: currentTile.uuid + 'footprint',
                paint: {
                    'line-width': 5,
                    'line-color': '#ff88da'
                }
            });

            this.map.addLayer({
                id: currentTile.uuid + 'image',
                type: 'raster',
                source: currentTile.uuid + 'image'
            });


        } else {
            console.log('We dont know the tile ID, (its not in the product name');
        }

        this.map.removeLayer("selection-id");
        this.map.addLayer({
            id: 'selection-id',
            type: 'line',
            source: 'selection-id',
            paint: {
                'line-width': 4,
                'line-color': '#77ffda'
            }
        });

        this.setState({
            currentTileLayerID: currentTile.uuid
        })
    }

    b64toBlob = (b64Data, contentType='', sliceSize=512) => {
        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);

            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, {type: contentType});
        return blob;
    };

    setCurrentTileFootprint() {
        console.log('getting tile footprints...');

        // Load the footprints for the retrieved data
        // First get teh uniq tile zones in the retrieved data
        let uniqUTMZone = [];

        for (let thing of this.state.resultsList) {

            console.log('local data list item', thing);
            // load the reference tile for this geojson
            console.log('ProductName', thing.product_name)

            let myRE = /T\d{1,2}[A-Z]{3}/;
            var myArray = myRE.exec(thing.product_name);

            if (myArray) {

                console.log('Full Zone Name: ', myArray[0]);
                uniqUTMZone.push(myArray[0]);

            } else {
                console.log('this is a multi-feature data product (not a single tile)')
            }
        }

        let uniqUTMZoneSet = new Set(uniqUTMZone);

        let uniqJustUTM = {};

        for (let thing of uniqUTMZoneSet) {
            console.log('THING ------------------------------------------------------- ', thing);

            let justUTM = thing.slice(1, 3);
            console.log("UTM ZOne!!:", justUTM);

            if (!uniqJustUTM.hasOwnProperty(justUTM)) {

                let newArray = []
                newArray.push(thing.slice(3, 6));

                console.log('WE IN IT NOW BOYSE', thing.slice(3, 6));

                uniqJustUTM[justUTM] = newArray;

            } else {
                uniqJustUTM[justUTM].push(thing.slice(3, 6));
            }
        }

        console.log('list of files to open for footprint', uniqJustUTM);

        for (let zoneIndex in uniqJustUTM) {

            let fileStringComplete = './app/static/' + zoneIndex + '.geojson';
            console.log(fileStringComplete)
            let that = this;

            fetch(fileStringComplete).then(function(response) {
                return response.json();

            }).then(function(myJSON) {

                console.log(myJSON)
                var newArray = that.state.tileFootprint.slice();
                for(let listItem of uniqJustUTM[zoneIndex]) {

                    console.log("list item", listItem);
                    for (let feature of myJSON.features) {
                        if (feature.properties.name.slice(-3) === listItem) {
                            feature.name = zoneIndex + listItem;
                            console.log(feature);

                            newArray.push(feature);
                        }
                    }
                    console.log('New Array: ', newArray)
                }

                that.setState({
                    tileFootprint: newArray
                })
            });
        }
    }

    getBoundsInMGRS(inputCoords) {

        this.setState({
            tileFootprint: []
        })

        let mgrsValues = [];

        let fn = coordinator('latlong', 'mgrs');

        console.log('input coords', inputCoords)

        for (let coord of inputCoords) {

            console.log(coord)
            console.log(coord.lat, coord.lng)

            mgrsValues.push(fn(coord.lat, coord.lng, 5));
        }

        console.log('MGRS coords')

        let postObject = {
            coords: mgrsValues
        };

        let that = this;

        if (this.state.developerCache) {

            let locallist = window.localStorage.getItem('localResultList');

            if (locallist) {

                this.setState({
                    resultsList: []
                });

                let localResultsList = JSON.parse(locallist)

                console.log('getting cached results...', localResultsList);
                // when a moment object is serialized, it is a string, need to reinstatiate it as a full moment object
                localResultsList.map((item) => {
                    let itemDate = item.dateObj;
                    item.dateObj = moment(itemDate);

                    if( item.imagebuffer !== undefined) {
                        let blob = this.b64toBlob(item.imagebuffer, 'image/jpg');

                        let objUrl = window.URL.createObjectURL(blob);

                        item.localImageURL = objUrl;
                    } else {
                        item.localImageURL = "./app/static/noimage.jpg";
                    }

                    return item;
                });

                this.setState({
                    resultsList: [...localResultsList]
                });

                this.setCurrentTileFootprint();

            } else {
                alert('No local cache found, can\'t use developer mode, try getting some data first.')
            }

        } else {

            if (this.state.amazonAPI) {
                axios.post(config.server_address + '/listobjects', postObject, {responseType: 'arraybuffer'}).then((response) => {

                    console.log(response);
                    //reset captcha after submission result (SOMEHOW)
                    if (response.status === 200) {

                        console.log('it was a success')

                        // how to add an image raster to the map using the mainMap reference
                        // Check for the various File API support.
                        if (window.File && window.FileReader && window.FileList && window.Blob) {
                            // Great success! All the File APIs are supported.
                            console.log('The File APIs are fully supported')
                        } else {
                            console.log('The File APIs are not fully supported in this browser.');
                        }

                        let sizeArray1 = response.data.slice(0,4);
                        let sizeArray2 = response.data.slice(4,8);
                        let dv = new DataView(sizeArray1, 0);

                        console.log(sizeArray1);
                        console.log(dv.getInt32())

                        let imageOffset = dv.getInt32();

                        dv = new DataView(sizeArray2, 0);

                        console.log(sizeArray2);
                        console.log(dv.getInt32())

                        let jsonOffset = dv.getInt32();

                        let jsonArray = response.data.slice(8 + imageOffset);

                        let imageArray = response.data.slice(8 ,8 + imageOffset);

                        let blob = new Blob([imageArray], {type: 'image/jpeg'});

                        let objUrl = window.URL.createObjectURL(blob);

                        that.setState({
                            imageSrc: objUrl
                        });

                        var decodedString = String.fromCharCode.apply(null, new Uint8Array(jsonArray));

                        console.log(JSON.parse(decodedString));

                        let jsonMetadata = JSON.parse(decodedString);

                        that.setState({currentTileInfo: jsonMetadata});

                        let coords = jsonMetadata.tileGeometry.coordinates[0];

                        let latLngCoords = []

                        for (let coord of coords) {

                            let utmToLatLng = coordinator('utm', 'latlong')

                            let convCoord = utmToLatLng(coord[1], coord[0], jsonMetadata.utmZone);

                            latLngCoords.push([convCoord.longitude, convCoord.latitude])
                        }

                        console.log(latLngCoords);

                        latLngCoords.pop();

                        this.map.addSource(jsonMetadata.productName + 'source', {
                            type: 'image',
                            url: objUrl,
                            coordinates: latLngCoords
                        });

                        this.map.addLayer({
                            id: jsonMetadata.productName + 'layer',
                            type: 'raster',
                            source: jsonMetadata.productName + 'source'
                        });

                    } else {

                        console.log('it was not a success')
                    }

                }).catch(function (error) {
                    console.log(error);
                    console.log('something went wrong')
                });

            } else {

                console.log('not using the AmazonAPI')

                let queryStr = 'q=';
                for (let coord of inputCoords) {

                    console.log(coord)
                    console.log(coord.lat, coord.lng)
                    queryStr += coord.lat + ',' + coord.lng + '_';
                }

                queryStr += inputCoords[0].lat + ',' + inputCoords[0].lng; // complete the polygon

                console.log('query string is :', queryStr)

                let requestDate = new Date();
                console.log('request sent to server at', requestDate);
                this.setState({
                    requestStarted: requestDate
                });
                let interval = setInterval(() => {
                    let newDate = new Date();

                    let ms = newDate - requestDate;
                    this.setState({
                        requestTime: parseInt(ms / 1000)
                    });
                }, 1000);

                // using the esa open data hub API instead of the amazon
                axios.get(config.server_address + '/openaccessdatahub?' + queryStr, {
                    responseType: 'text',
                    timeout: 240000,
                    headers: {
                        // "Keep-Alive": `timeout=${1*60*5}`
                    }
                }).then((response) => {

                    console.log(response);
                    //reset captcha after submission result (SOMEHOW)
                    if (response.status === 200) {

                        this.setState({
                            resultsList: []
                        });

                        console.log('it was a success')

                        // how to add an image raster to the map using the mainMap reference

                        console.log('Raw response ' + response)
                        // console.log('response data' + response.data);

                        let localList = [];

                        let jsonArray = response.data.split('_#_');

                        jsonArray.pop();

                        let jsonStrings = [];

                        for (let json of jsonArray) {
                            console.log('Json string', json)
                            jsonStrings.push(JSON.parse(json));
                        }

                        for (let item of jsonStrings) {

                            if( item.imagebuffer !== undefined) {
                                let blob = this.b64toBlob(item.imagebuffer, 'image/jpg');

                                let objUrl = window.URL.createObjectURL(blob);

                                item.localImageURL = objUrl;
                            } else {
                                item.localImageURL = "./app/static/noimage.jpg";
                            }

                            item.dateObj = moment(item.date, 'YYYY-MM-DDTHH:mm:ss.SSSZ');

                            item.selected = false

                            localList.push(item);
                        }

                        // 2017-11-13T11:13:09.027Z
                        localList.sort((a, b) => {

                            // sort descending, reverse (A - B) to sort ascending
                            return b.dateObj - a.dateObj;
                        })

                        this.setState({
                            resultsList: [...localList]
                        });

                        // we have the state, lets write it out to localStorage on if we want to do developer mode
                        window.localStorage.setItem('localResultList', JSON.stringify(localList));

                        // Load the footprints for the retrieved data
                        // First get teh uniq tile zones in the retrieved data
                        let uniqUTMZone = [];

                        for (let thing of this.state.resultsList) {

                            console.log('local data list item', thing);
                            // load the reference tile for this geojson
                            console.log('ProductName', thing.product_name)

                            let myRE = /T\d{1,2}[A-Z]{3}/;
                            var myArray = myRE.exec(thing.product_name);

                            if (myArray) {

                                console.log('Full Zone Name: ', myArray[0]);
                                uniqUTMZone.push(myArray[0]);

                            } else {
                                console.log('this is a multi-feature data product (not a single tile)')
                            }
                        }

                        let uniqUTMZoneSet = new Set(uniqUTMZone);

                        let uniqJustUTM = {};

                        for (let thing of uniqUTMZoneSet) {
                            console.log('THING ------------------------------------------------------- ', thing);

                            let justUTM = thing.slice(1, 3);
                            console.log("UTM ZOne!!:", justUTM);

                            if (!uniqJustUTM.hasOwnProperty(justUTM)) {

                                let newArray = []
                                newArray.push(thing.slice(3, 6));

                                console.log('WE IN IT NOW BOYSE', thing.slice(3, 6));

                                uniqJustUTM[justUTM] = newArray;

                            } else {
                                uniqJustUTM[justUTM].push(thing.slice(3, 6));
                            }
                        }

                        console.log('list of files to open for footprint', uniqJustUTM);

                        for (let zoneIndex in uniqJustUTM) {

                            let fileStringComplete = './app/static/' + zoneIndex + '.geojson';
                            console.log(fileStringComplete)
                            let that = this;

                            fetch(fileStringComplete).then(function(response) {
                                return response.json();

                            }).then(function(myJSON) {

                                console.log(myJSON)
                                var newArray = that.state.tileFootprint.slice();
                                for(let listItem of uniqJustUTM[zoneIndex]) {

                                    console.log("list item", listItem);
                                    for (let feature of myJSON.features) {
                                        if (feature.properties.name.slice(-3) === listItem) {
                                            feature.name = zoneIndex + listItem;
                                            console.log(feature);

                                            newArray.push(feature);
                                        }
                                    }
                                    console.log('New Array: ', newArray)
                                }

                                that.setState({
                                    tileFootprint: newArray
                                })
                            });
                        }

                        clearInterval(interval);

                    } else {
                        // something went wrong
                        console.log('it was not a success')
                    }

                }).catch(function (error) {
                    console.log(error);
                    console.log('something went wrong')
                    clearInterval(interval);
                });
            }
        }


    }

    callback = (reference) => {
        console.log(this)
        console.log(reference)
    };

    toggleSelected = (id) => {

        let updatedResultList = this.state.resultsList.map((item) => {

            if (item.uuid === id)
                item.selected = !item.selected;

            return item;
        });

        let count = 0

        updatedResultList.map((item) => {
            if(item.selected === true)
                count++
        });

        console.log(count);

        this.setState({
            resultsList: [...updatedResultList],
            selectedCount: count
        });

    };

    itemClicked = (id, number) => {
         console.log(id + ' Was Clicked by the user');

         this.setState({
             currentTileID: id,
             currentResultNumber: number
         });

        this.setCurrentTile(id);


         if (this.state.resultsList[number].localImageURL === "./app/static/noimage.jpg") {
             // Query the server for a list of ongoing jobs

             // let currentFootprint = this.state.currentFootprint;
             //
             // console.log('Current footprint ==========================', currentFootprint);
             //
             // axios.get(config.server_address + '/previewimage/' + this.state.resultsList[number].product_name, {responseType: 'arraybuffer', timeout: 10000}).then((response) => {
             //
             //     //reset captcha after submission result (SOMEHOW)
             //     if (response.status === 200) {
             //
             //         console.log('it was a success', response.data)
             //
             //         console.log(response.data);
             //
             //         var arrayBufferView = new Uint8Array( response.data )
             //
             //         let blob = new Blob([arrayBufferView], {type: 'image/jpeg'});
             //
             //         let objUrl = window.URL.createObjectURL(blob);
             //
             //         let newResultsList = this.state.resultsList;
             //
             //         newResultsList[number].localImageURL = objUrl;
             //
             //         let currentTile = newResultsList[number];
             //
             //         this.setState({
             //             resultsList: [...newResultsList]
             //         });
             //
             //         this.map.removeSource(currentTile.uuid + 'image')
             //
             //         console.log(currentTile);
             //
             //        console.log('current Footprint geometry', currentFootprint.geometry);
             //
             //         let coords = currentFootprint.geometry.geometries[0].coordinates[0];
             //
             //         let imageThing = coords.map((item) => {
             //             return [item[0], item[1]]
             //         });
             //
             //         imageThing.pop()
             //
             //         this.map.addSource(currentTile.uuid + 'image', {
             //             type: 'image',
             //             url: currentTile.localImageURL,
             //             coordinates: imageThing
             //         })
             //
             //
             //         // if( item.imagebuffer !== undefined) {
             //         //     let blob = this.b64toBlob(item.imagebuffer, 'image/jpg');
             //         //
             //         //     let objUrl = window.URL.createObjectURL(blob);
             //         //
             //         //     item.localImageURL = objUrl;
             //         // } else {
             //         //     item.localImageURL = "./app/static/noimage.jpg";
             //         // }
             //
             //         // this.setState({
             //         //     showJobListModal: true,
             //         // })
             //
             //     } else {
             //
             //         console.log('it was not a success', response.data);
             //         console.log('unable to fetch preview image from server');
             //
             //         // should still show the modal, just with a message saying coms with server failed.
             //
             //     }
             //
             // }).catch( (error) => {
             //     console.log(error);
             //     console.log('something went wrong')
             // });

             // TODO: bugged

         }


    };

    showJobModal = () => {

        this.setState({
            showJobModal: true,
        });
    };

    handleCloseJobModal = () => {



        this.setState({
            showJobModal: false,
            startingJob: ""
        });
    };

    showJobListModal = () => {
        console.log('querying server for job list, then showing the modal');

        // Query the server for a list of ongoing jobs
        axios.get(config.server_address + '/jobs', {responseType: 'json', timeout: 10000}).then((response) => {

            //reset captcha after submission result (SOMEHOW)
            if (response.status === 200) {

                console.log('it was a success', response.data)

                console.log(response.data);

                let setupJobList = response.data.map((item) => {
                    let date = item.dateSubmitted;
                    item.dateSubmitted = moment(date);
                    console.log('job recieved from server: ', item)
                    return item;
                })


                this.setState({
                    showJobListModal: true,
                    jobList: setupJobList,
                })

            } else {

                console.log('it was not a success', response.data);
                console.log('unable to fetch jobs list from server');

                // should still show the modal, just with a message saying coms with server failed.

            }

        }).catch( (error) => {
            console.log(error);
            console.log('something went wrong')
        });
    };

    handleCloseJobListModal = () => {
        this.setState({
            showJobListModal: false
        })
    };

    handleStartJob = () => {
        console.log('user tried to start a download job');

        this.setState({
            startingJob: 'Thanks! Starting job on the server....'
        });

        let tileList = [];

        this.state.resultsList.map((item) => {
            if (item.selected)
                tileList.push({
                    id:item.uuid,
                    name: item.product_name
                });
        });

        let postObject = {
            email: this.state.jobEmail,
            idList: tileList
        };

        console.log('post object', postObject);

        axios.post(config.server_address + '/startjob', postObject, {responseType: 'json'}).then((response) => {

            //reset captcha after submission result (SOMEHOW)
            if (response.status === 200) {

                console.log('it was a success', response.data)

                this.setState({
                    startingJob: 'Job was started successfully'
                });

            } else {

                console.log('it was not a success', response.data);
                this.setState({
                    startingJob: 'Sorry, something went wrong on the server, please try again...'
                });

            }

        }).catch( (error) => {
            console.log(error);
            console.log('something went wrong')
            this.setState({
                startingJob: 'Sorry, something went wrong on the server, please try again...'
            });
        });
    };

    handleEmailInput = (e) => {
      this.setState({
          jobEmail: e.target.value
      });
    };

    render() {

        for (let name of this.layerList) {
            this.map.removeLayer(name);
        }
        this.layerList = [];

        let currentTiles = this.state.tileFootprint;
        console.log('current Tiles', currentTiles);

        for (let tile of currentTiles) {

            let currentSearchFootprint = this.map.getSource(tile.name + 'source');
            if (currentSearchFootprint !== undefined) {
                console.log('this layer already exists, updating')
                // do not need to update, if that tile exists thats fine
                // what we should do here first is remove all tiles

                //currentSearchFootprint.setData(tile)

                this.layerList.push(tile.name + 'layer');

                this.map.addLayer({
                    id: tile.name + 'layer',
                    type: 'line',
                    source: tile.name + 'source'
                });

            } else {

                let source = this.map.getSource(tile.name + 'source');

                if (source === undefined) {
                    this.map.addSource(tile.name + 'source', {
                        type: 'geojson',
                        data: tile
                    });
                } else {
                    source.setData(tile);
                }


                this.layerList.push(tile.name + 'layer');

                this.map.addLayer({
                    id: tile.name + 'layer',
                    type: 'line',
                    source: tile.name + 'source'
                });
            }
        }

        let imageSrc = this.state.imageSrc;

        console.log(imageSrc)

        var sectionStyle = {
            border: "1px solid red",
            backgroundColor: "red",
            backgroundImage: "url(" + this.state.imageSrc + ")",
            backgroundSize: "contain"
        };
        const style = {
            gridColumn: "span 1",
            gridRow: "span 1",
            minHeight: "450px",
        };

        const tileInfoDiv = () => {

            if (this.state.resultsList.length > 0) {


                let currentTile = this.state.resultsList[this.state.currentResultNumber];
                return (<div className="tile-info">

                    <div className="flex-container">
                        <div className="imageDiv">
                            <img src={currentTile.localImageURL} alt={currentTile.uuid}/>
                        </div>
                        <div className="textInfoDiv">
                            <h3>Current Tile Info</h3>

                            <p className="label">Result #: {this.state.currentResultNumber + 1}</p>
                            {currentTile.selected ? <p>Selected</p> : <p>Not Selected</p>}
                            <p className="label">Date:</p> <p>{currentTile.dateObj.format("MMMM Do YYYY, HH:mm:ss zzz")}</p>
                            <p className="label">Tilename: </p>
                            <p>{currentTile.product_name}</p>
                            <p className="label">Ingestion name: </p>
                            <p>{currentTile.ingestionname}</p>
                            <p className="label">Data Size: {currentTile.datasize}</p><br/>
                            <p className="label">Cloudy Pixel %: {currentTile.cloudy_pixels}</p>
                        </div>
                    </div>
                </div>);
            } else {
                return (<div className="tile-info">
                    <h3>Tile Info</h3>
                    <p>There are no tiles.</p>
                </div>)
            }
        };

        const setupModalContent = () => {


            let returnString = '';
            let jobStatusString = '';

            if (this.state.startingJob !== '') {
                jobStatusString = this.state.startingJob;
            }

            if (this.state.resultsList.length === 0) {
                return (<div><p>You haven't queried for any data yet. Use the polygon selection tool in
                                    the map to query the server for satellite imagery.</p>
                                <p>Once you have queried for data it will show in the results list. Once you have
                                selected the tile data you want, you can then start downloading the high resolution data
                                    from the server.</p></div>);
            } else if (this.state.selectedCount === 0) {
                return (<div><p>You have queried for data, but you haven't selected any to download.
                    Use the select tile checkbox to select the tiles you want to download.</p>
                    <p>Alternatively, you can use the arrow up and down keys to navigate, and the spacebar
                        to select or deselect tiles.</p>
                    <p>Once you have selected the tile data you want, you can then start downloading the high resolution data
                        from the server.</p></div>);
            } else {
                return (<div>
                    <p>You have selected the tiles you want to download. Enter your email address below
                    and a link will be emailed to you once the processing is finished.</p>
                    <label htmlFor="email-input">Email:</label>
                    <input id="email-input" value={this.state.jobEmail} onChange={(e) => this.handleEmailInput(e)} type="email"/>
                    <button className="modal-button" onClick={this.handleStartJob}>Start the Download Job</button>
                    <p>{jobStatusString}</p>

                </div>);
            }

        };

        const displayOptionsJobList = (item) => {
            return 'to do!?';
        };

        const displayTileListJobList = (tileList) => {
            return 'to do!?';
        }

        const setupJobListModal = () => {

            return (<div className="jobTable">
                <h1>Current and Previous Jobs On Server</h1>

                {this.state.jobList.length === 0 ? <p> No ongoing jobs</p> : (
                    <table style={{width: '100%'}}>
                        <thead>
                        <tr key='rowheader'>
                            <th>Job ID</th>
                            <th>Submitted By</th>
                            <th>Submitted Date</th>
                            <th>Completed Date</th>
                            <th># of Tiles</th>
                            <th>Options</th>
                            <th>Tile List</th>
                            <th>Job Status</th>
                            <th>Download Status</th>
                            <th>Atmos Correction Status</th>
                            <th>Processing Status</th>
                            <th>Download Link</th>
                        </tr>
                        </thead>
                        <tbody>
                        { this.state.jobList.map((item, index) => {
                            return (
                                <tr key={'row' + index}>
                                    <td>{item.jobID}</td>
                                    <td>{item.email }</td>
                                    <td>{item.dateSubmitted.format("dd, MMM Do YYYY, h:mm a") + '\n' + item.dateSubmitted.fromNow()}</td>
                                    <td>{item.hasOwnProperty('dateCompleted') ? item.dateCompleted.format("dd, MMM Do YYYY, h:mm a") + '-' + item.dateCompleted.fromNow() : 'not done yet'}</td>
                                    <td>{item.tileList.length}</td>
                                    <td>{ displayOptionsJobList(item.options) }</td>
                                    <td className="max-width">{displayTileListJobList(item.tileList)}</td>
                                    <td>{ item.status.overall }</td>
                                    <td>{ item.status.downloading + '/' + item.tileList.length}</td>
                                    <td>{ item.status.atmosCorrection + '/' + item.tileList.length}</td>
                                    <td>{ item.status.processing + '/' + item.tileList.length}</td>
                                    <td>{ item.hasOwnProperty('downloadURL') ? item.downloadURL : 'not ready yet'}</td>
                                </tr>
                            );
                        })
                        }
                        </tbody>
                    </table>)}
            </div>)
        };

        return (
            <div className='main' ref={{}}>

                <div className="mapContainer" style={style} ref={el => this.mapContainer = el}/>

                <div className="resultList">
                    <h2>Query Results</h2>
                    <div className="scrollContainer">
                         <div className="list">
                            {this.state.resultsList.map((obj, index) => {
                                console.log('index', index);
                                let currentTile = false;
                                if (obj.uuid === this.state.currentTileID) {
                                    currentTile  = true;
                                }

                                return (<ResultItem key={obj.uuid} item={obj} itemClicked={this.itemClicked} currentTile={currentTile} resultNumber={index} toggleSelected={this.toggleSelected}/>);
                            })}
                        </div>
                    </div>
                </div>

                {tileInfoDiv()}

                <div className="optionsContainer">
                    <h1>Options</h1>
                    <input id="amazonapitoggle" type='checkbox' defaultChecked={this.state.amazonAPI} onChange={this.toggleAmazonAPI} />
                    <label htmlFor="amazonapitoggle">Use Amazon S3 API</label>
                    <br/>
                    <input id="developerCache" type='checkbox' defaultChecked={this.state.developerCache} onChange={this.toggleDeveloperCache} />
                    <label htmlFor="developerCache">Use Local Cache for GUI Development</label>
                </div>
                <div className="serverInfo">
                    { this.state.requestStarted !== undefined ? <p>Request Started</p> : <p>No request running</p>}
                    { this.state.requestTime != 0 ? <p>Elapsed time {this.state.requestTime}</p> : ""}
                </div>
                <LinearCalendar/>
                <div className="serverControls">
                    <button onClick={this.showJobModal}>Start Downloading</button>
                    <button onClick={this.showJobListModal}>View Active Jobs</button>
                    <ReactModal
                        className="startJobModal"
                        ariaHideApp={false} // TODO: should fix this later for accessibility reasons
                        isOpen={this.state.showJobModal}
                        shouldCloseOnOverlayClick={true}
                        onRequestClose={this.handleCloseJobModal}
                        contentLabel="Server Downloading Jobs"
                        style={ {}

                            }>
                            {setupModalContent()}
                            <button className="modal-button" onClick={this.handleCloseJobModal}>Close</button>
                    </ReactModal>
                    <ReactModal
                        className="startJobModal jobListModal"
                        ariaHideApp={false} // TODO: should fix this later for accessibility reasons
                        isOpen={this.state.showJobListModal}
                        shouldCloseOnOverlayClick={true}
                        onRequestClose={this.handleCloseJobListModal}
                        contentLabel="Server Downloading Jobs"
                        style={{

                        }}>
                        {setupJobListModal()}
                        <button className="modal-button" onClick={this.handleCloseJobListModal}>Close</button>
                    </ReactModal>
                </div>
            </div>
        );
    }
};
