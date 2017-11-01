/**
 * Created by sc on 7/25/2017.
 */
import React from 'react';

import { Circle, Map, Marker, Popup, TileLayer, FeatureGroup } from 'react-leaflet';

import { EditControl } from 'react-leaflet-draw';

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

        this.state = {
            imageSrc: "/app/static/img.jpg",
            currentTileInfo: {},
            amazonAPI: true
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

    getBoundsInMGRS(inputCoords) {

        let mgrsValues = [];

        let fn = coordinator('latlong', 'mgrs');

        for (let coord of inputCoords) {

            console.log(coord)
            console.log(coord.lat, coord.lng)
            mgrsValues.push(fn(coord.lat, coord.lng, 5));
        }

        for (let value of mgrsValues) {
            console.log(value);
        }

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

            // using the esa open data hub API instead of the amazon
            axios.get(config.server_address + '/openaccessdatahub?' + queryStr, {responseType: 'json'}).then((response) => {

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

        console.log(this.imageSrc)

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
                    <Marker position={position}>
                        <Popup>
                            <span>A pretty CSS3 popup.<br/>Easily customizable.</span>
                        </Popup>
                    </Marker>
                </Map>
                <div className="resultList">
                    <h3>Query Results</h3>
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

                <img id="sampleimage" src={this.state.imageSrc}></img>
                <div>
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
