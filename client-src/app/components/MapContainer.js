/**
 * Created by sc on 7/25/2017.
 */
import React from 'react';

import { Circle, Map, Marker, Popup, TileLayer, FeatureGroup, GeoJSON } from 'react-leaflet';

import { EditControl } from 'react-leaflet-draw';

import imageoverlay from 'leaflet-imageoverlay-rotated';

import axios from 'axios';

import coordinator from 'coordinator';
import utmToLatlng from 'utm-latlng';
//var utmConverter = require('utm');

import utm from 'leaflet.utm';

import "../style/_MapContainer.scss"

import config from 'Config'


const position = [51.505, -0.09];


export default class MapContainer extends React.Component {

    constructor(props) {
        super(props);

        this.getBoundsInMGRS = this.getBoundsInMGRS.bind(this);
        this._onEditPath = this._onEditPath.bind(this);

        this._onCreate = this._onCreate.bind(this);

        this._onDeleted = this._onDeleted.bind(this);

        this.toggleAmazonAPI = this.toggleAmazonAPI.bind(this);

        this.handleZoomChange = this.handleZoomChange.bind(this);

        this.setCurrentTile = this.setCurrentTile.bind(this);

        this.state = {
            imageSrc: "./app/static/img.jpg",
            currentTileInfo: {},
            amazonAPI: true,
            resultsList: [],
            geoJson: [],
            tileFootprint: [],
            currentTileID: ""
        };


    }

    componentDidMount() {
        this.mainMap = this.refs.map.leafletElement
    }

    toggleAmazonAPI() {
        this.setState({
            amazonAPI: !this.state.amazonAPI
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

        let tileUTM = myArray[0].slice(1);

        console.log('TileUTM ident', tileUTM);

        // get the right footprint from the list of tile foot prints

        let currentFootprint = this.state.tileFootprint.filter((tile) => tile.name === tileUTM)[0];

        let coords = currentFootprint.geometry.geometries[0].coordinates[0];

        console.log('footprint geometry', coords)
        // let imageBounds = [];
        //
        // // imageBounds.push([coords[0][1], coords[0][0]]);
        // // imageBounds.push([coords[2][1], coords[2][0]]);
        // //
        //
        // console.log('Image bounds:', imageBounds);


        // L.imageOverlay(currentTile.localImageURL, imageBounds).addTo(this.mainMap);

        var topleft    = L.latLng(coords[0][1], coords[0][0]),
            topright   = L.latLng(coords[1][1], coords[1][0]),
            bottomleft = L.latLng(coords[3][1], coords[3][0]),
            bottomright = L.latLng(coords[2][1], coords[2][0]);

        // imageoverlay.rotated(currentTile.localImageURL, topleft, topright, bottomleft, {
        //     opacity: 0.7,
        //     interactive: true,
        //     attribution: "ESA-Sentinel2"
        // }).addTo(this.mainMap);

        console.log('Calling image overlay rotated')

        L.imageOverlay.rotated(currentTile.localImageURL, topleft, topright, bottomleft, bottomright, {
            opacity: 0.9,
            interactive: true,
            attribution: "ESA-Sentinel2"
        }).addTo(this.mainMap);

    }


    getBoundsInMGRS(inputCoords) {

        this.setState({
            tileFootprint: []
        })

        let mgrsValues = [];

        let fn = coordinator('latlong', 'mgrs');

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

                    //
                    // let blob = new Blob([response.data], {type: 'image/jpeg'});
                    //
                    // let objUrl = window.URL.createObjectURL(blob);
                    //
                    // that.setState({
                    //     imageSrc: objUrl
                    // });

                    var imageBounds = [];

                    imageBounds.push(jsonMetadata.tileGeometry.coordinates[0][3]);
                    imageBounds.push(jsonMetadata.tileGeometry.coordinates[0][1]);

                    that.setState({currentTileInfo: jsonMetadata});

                    // convert to lat long from UTM zone
                    let imageBoundsLatLong = [];

                    var item = L.utm({x: imageBounds[0][0], y: imageBounds[0][1], zone: jsonMetadata.utmZone, band: jsonMetadata.latitudeBand});
                    var coord = item.latLng();

                    var item2 = L.utm({x: imageBounds[1][0], y: imageBounds[1][1], zone: jsonMetadata.utmZone, band: jsonMetadata.latitudeBand});
                    var coord2 = item2.latLng();


                    console.log('coords, ', coord, coord2);

                    imageBoundsLatLong.push([coord.lat, coord.lng]);
                    imageBoundsLatLong.push([coord2.lat, coord2.lng]);

                    console.log(imageBoundsLatLong);
                    var imageUrl = this.state.imageSrc;

                    L.imageOverlay(imageUrl, imageBoundsLatLong).addTo(that.mainMap);


                } else {

                    console.log('it was not a success')
                }



            })
                .catch(function (error) {
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

            const b64toBlob = (b64Data, contentType='', sliceSize=512) => {
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

            // using the esa open data hub API instead of the amazon
            axios.get(config.server_address + '/openaccessdatahub?' + queryStr, {responseType: 'json'}).then((response) => {

                console.log(response);

                //reset captcha after submission result (SOMEHOW)
                if (response.status === 200) {

                    console.log('it was a success')

                    // how to add an image raster to the map using the mainMap reference

                    console.log('Raw response ' + response)
                    console.log('response data' + response.data);

                    let localList = [];

                    for (let item of response.data) {

                        let blob = b64toBlob(item.imagebuffer, 'image/jpg');

                        let objUrl = window.URL.createObjectURL(blob);

                        item.localImageURL = objUrl;

                        localList.push(item);

                    }


                    this.setState({
                        resultsList: [...localList]
                    });

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


                    console.log('What does our data have: ', localList[0])

                    let geoJsonString = JSON.stringify(localList[0].footprint);

                    console.log(geoJsonString);

                    // L.geoJSON(geoJsonString).addTo(that.mainMap);
                    console.log('UPDDDDDATING!');

                    let newArray = [];
                    newArray.push(localList[0].footprint);


                    newArray[0].name = localList[0].product_name;

                    console.log(newArray)
                    this.setState({
                        geoJson: newArray
                    });

                    // Check for the various File API support.
                    // if (window.File && window.FileReader && window.FileList && window.Blob) {
                    //     // Great success! All the File APIs are supported.
                    //     console.log('The File APIs are fully supported')
                    // } else {
                    //     console.log('The File APIs are not fully supported in this browser.');
                    // }

                    // var imageUrl = 'http://www.lib.utexas.edu/maps/historical/newark_nj_1922.jpg',
                    //     imageBounds = [[40.712216, -74.22655], [40.773941, -74.12544]];
                    //     L.imageOverlay(imageUrl, imageBounds).addTo(that.mainMap);
                    //
                    //let fileReader = new FileReader();
                    //console.log(response.data)


                    //
                    // imageBoundsLatLong.push([coord.lat, coord.lng]);
                    // imageBoundsLatLong.push([coord2.lat, coord2.lng]);
                    //
                    // console.log(imageBoundsLatLong);
                    // var imageUrl = this.state.imageSrc;
                    //
                    // L.imageOverlay(imageUrl, imageBoundsLatLong).addTo(that.mainMap);


                } else {

                    console.log('it was not a success')
                }



            }).catch(function (error) {
                    console.log(error);
                    console.log('something went wrong')
                });
        }



    }


    _onEditPath(e) {
        console.log('path was edited - ', e)
    }

    _onCreate(e) {
        console.log('path was created - ', e);
        console.log(e.layer.getLatLngs());
        let coords = e.layer.getLatLngs()[0];

        let coordArray = [];

        for (let coord of coords) {
            console.log(coord)


            console.log('org coord', coord)
            console.log('wrapped coord', coord.wrap())

            coordArray.push(coord.wrap())
        }

        console.log("coordarray is", coordArray)
        this.getBoundsInMGRS(coordArray);
    }

    _onDeleted(e) {
        console.log('path was Deleted - ', e)
    }

    render() {

        var southWest = new L.LatLng(-90, -200);
        var northEast = new L.LatLng(90, 200);
        var restrictBounds = new L.LatLngBounds(southWest, northEast);


        let imageSrc = this.state.imageSrc;

        console.log(imageSrc)

        var sectionStyle = {
            border: "1px solid red",
            backgroundColor: "red",
            backgroundImage: "url(" + this.state.imageSrc + ")",
            backgroundSize: "contain"
        };



        let currentTileFootprint = () => {
            let style = {
                "color": "#ff7800",
                "weight": 5,
                "opacity": 0.65
            };

            if (this.state.currentTileID !== "") {
                let currentTileFootprint = this.state.resultsList.find((obj) => obj.uuid === this.state.currentTileID).footprint;
                console.log(currentTileFootprint);
                return (
                    <GeoJSON key={this.state.currentTileID} data={currentTileFootprint} style={style} />
                );
            }
        }

        return (
            <div className='grid-container'>
                <Map ref='map' center={position} zoom={13} height={500} className="mainMap" minZoom={2} maxBounds={restrictBounds} maxBoundsViscosity={1.0} onZoomend={this.handleZoomChange}>
                    <FeatureGroup>
                        <EditControl
                            position='topright'
                            onEdited={this._onEditPath}
                            onCreated={this._onCreate}
                            onDeleted={this._onDeleted}
                            draw={{
                                marker: false,
                                polyline: false,
                                circle: false
                            }}
                        />
                        <Circle center={[51.51, -0.06]} radius={200} />
                    </FeatureGroup>
                    <TileLayer
                        url='http://{s}.tile.osm.org/{z}/{x}/{y}.png'
                        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                        // noWrap='false'
                    />

                    {this.state.tileFootprint.map((obj) =>{
                        return (
                            <GeoJSON key={obj.name} data={obj} style="" />
                        );
                    })}


                    {currentTileFootprint()}


                    <Marker position={position}>
                        <Popup>
                            <span>A pretty CSS3 popup.<br/>Easily customizable.</span>
                        </Popup>
                    </Marker>
                </Map>
                <div className="resultList">
                    <h3>Query Results</h3>
                    <ul>
                        {this.state.resultsList.map((obj) =>{
                            return (<li key={ obj.uuid } onClick={(e) => this.setCurrentTile(obj.uuid, e)}>
                                        {obj.product_name}<br/>
                                        {obj.uuid} <br/>
                                        {obj.date} <br/>

                                        {/*need to authenticate to use the raw url for the images*/}
                                        <img src={obj.localImageURL} alt={obj.product_name}/>
                                    </li>);
                        })}
                    </ul>
                </div>

                {/*{path: "tiles/30/U/YC/2015/8/8/0", timestamp: "2015-08-08T11:05:33.511Z", utmZone: 30, latitudeBand: "U", gridSquare: "YC", …}*/}
                {/*cloudyPixelPercentage*/}
                {/*:*/}
                {/*8.35*/}
                {/*dataCoveragePercentage*/}
                {/*:*/}
                {/*100*/}
                {/*datastrip*/}
                {/*:*/}
                {/*{id: "S2A_OPER_MSI_L1C_DS_EPA__20160905T121355_S20150808T110533_N02.04", path: "products/2015/8/8/S2A_OPER_PRD_MSIL1C_PDMC_2016090…R094_V20150808T110036_20150808T110533/datastrip/0"}*/}
                {/*gridSquare*/}
                {/*:*/}
                {/*"YC"*/}
                {/*latitudeBand*/}
                {/*:*/}
                {/*"U"*/}
                {/*path*/}
                {/*:*/}
                {/*"tiles/30/U/YC/2015/8/8/0"*/}
                {/*productName*/}
                {/*:*/}
                {/*"S2A_OPER_PRD_MSIL1C_PDMC_20160907T051210_R094_V20150808T110036_20150808T110533"*/}
                {/*productPath*/}
                {/*:*/}
                {/*"products/2015/8/8/S2A_OPER_PRD_MSIL1C_PDMC_20160907T051210_R094_V20150808T110036_20150808T110533"*/}
                {/*tileDataGeometry*/}
                {/*:*/}
                {/*{type: "Polygon", crs: {…}, coordinates: Array(1)}*/}
                {/*tileGeometry*/}
                {/*:*/}
                {/*{type: "Polygon", crs: {…}, coordinates: Array(1)}*/}
                {/*tileOrigin*/}
                {/*:*/}
                {/*{type: "Point", crs: {…}, coordinates: Array(2)}*/}
                {/*timestamp*/}
                {/*:*/}
                {/*"2015-08-08T11:05:33.511Z"*/}
                {/*utmZone*/}
                {/*:*/}
                {/*30*/}

                <div id="sampleimage" style={ sectionStyle }></div>

                {/*<img src={imageSrc} alt="Sample Tile Image"/>*/}
                <div className="tile-info">
                    <p>Tile Info</p>
                    <p>Date: {this.state.currentTileInfo.timestamp}</p>
                    <p>Tile: {this.state.currentTileInfo.path}</p>
                    <p>Cloudy Pixel Percent: {this.state.currentTileInfo.cloudyPixelPercentage}</p>
                    <input id="amazonapitoggle" type='checkbox' defaultChecked={this.state.amazonAPI} onChange={this.toggleAmazonAPI} />
                    <label htmlFor="amazonapitoggle">Use Amazon S3 API</label>
                </div>
            </div>
        );
    }
};
