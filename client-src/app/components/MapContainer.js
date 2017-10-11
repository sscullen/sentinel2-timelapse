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

        this.state = {
            imageSrc: "/app/static/img.jpg"
        };


    }

    componentDidMount() {
        this.mainMap = this.refs.map.leafletElement
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

        axios.post(config.server_address + '/listobjects', postObject).then((response) => {

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

                var arrayBufferView = new Uint8Array( response.data );

                console.log(arrayBufferView)

                let blob = new Blob(arrayBufferView);

                var video = document.getElementById('sampleimage');



                var url = URL.createObjectURL(blob);

                video.src = url;

                //  var imageBounds = [];
                //
                //  imageBounds.push(response.data.body.tileCoords[0][3]);
                //  imageBounds.push(response.data.body.tileCoords[0][1]);
                //
                //
                //  // convert to lat long from UTM zone
                // let imageBoundsLatLong = [];
                //
                // var item = L.utm({x: imageBounds[0][0], y: imageBounds[0][1], zone: 30, southHemi: false});
                // var coord = item.latLng();
                //
                // var item2 = L.utm({x: imageBounds[1][0], y: imageBounds[1][1], zone: 30, southHemi: false});
                // var coord2 = item2.latLng();


                // console.log('coords, ', coord, coord2);
                // // let latLong1 = utmConverter.toLatLong(imageBounds[0][0], imageBounds[0][1], 30, 'northern');
                // // let latLong2 = utmConverter.toLatLong(imageBounds[1][0], imageBounds[1][1], 30, 'northern');
                //
                // imageBoundsLatLong.push([coord.lat, coord.lng]);
                // imageBoundsLatLong.push([coord2.lat, coord2.lng]);
                //
                // console.log(imageBoundsLatLong);
                // console.log(url)

                this.setState({
                    imageSrc: url
                });

                var a = document.createElement("a");
                document.body.appendChild(a);
                a.style = "display: none";

                    a.href = url;
                    a.download = 'name';
                    a.click();

                    window.URL.revokeObjectURL(url);
                //
                // L.imageOverlay(url, imageBoundsLatLong).addTo(that.mainMap);

                console.log(this.state.imageSrc);

            } else {

                console.log('it was not a success')
            }



        })
            .catch(function (error) {
                console.log(error);
                console.log('something went wrong')
            });

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
            <div>
                <Map ref='map' center={position} zoom={13} height={500} className="mainMap" minZoom={2} maxBounds={restrictBounds} maxBoundsViscosity={1.0}>
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

                <img id="sampleimage" src={this.state.imageSrc}></img>
            </div>
        );
    }
};
