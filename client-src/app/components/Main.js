/**
 * Created by sc on 7/25/2017.
 */
import React from 'react';

import axios from 'axios';

import coordinator from 'coordinator';

import moment from 'moment';


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
            developerCache: false
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
                    })

                    this.setState({
                        resultList: [...newStateList]
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

        this.setState({
            resultsList: [...updatedResultList]
        });

    };

    itemClicked = (id, number) => {
         console.log(id + ' Was Clicked by the user');

         this.setState({
             currentTileID: id,
             currentResultNumber: number
         });

         this.setCurrentTile(id);
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
            minHeight: "40vh",
            minWidth: "50vw"
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
                            <h3>Tile Info</h3>

                            <p className="label">Result #: </p>
                            <p>{this.state.currentResultNumber + 1}</p>

                            <p className="label">Date: </p>
                            <p>{currentTile.dateObj.format("MMMM Do YYYY, HH:mm:ss zzz")}</p>
                            <p className="label">Tilename: </p>
                            <p>{currentTile.product_name}</p>
                            <p className="label">Ingestion name: </p>
                            <p>{currentTile.ingestionname}</p>
                            <p className="label">Data Size: </p>
                            <p>{currentTile.datasize}</p>
                            <p className="label">Cloudy Pixel %: </p>
                            <p>{currentTile.cloudy_pixels}</p>
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


        return (
            <div className='main'>

                <div className="mapContainer" style={style} ref={el => this.mapContainer = el}/>

                <div className="resultList">
                    <h3>Query Results</h3>
                    <div className="scrollContainer">
                         <div className="list">
                            {this.state.resultsList.map((obj, index) => {
                                console.log('index', index);
                                let currentTile = false;
                                if (obj.uuid === this.state.currentTileID) {
                                    currentTile  = true;
                                }

                                return (<ResultItem item={obj} itemClicked={this.itemClicked} currentTile={currentTile} resultNumber={index} toggleSelected={this.toggleSelected}/>);
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

            </div>
        );
    }
};
