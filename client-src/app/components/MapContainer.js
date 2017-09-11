/**
 * Created by sc on 7/25/2017.
 */
import React from 'react';

import { Circle, Map, Marker, Popup, TileLayer, FeatureGroup } from 'react-leaflet';

import { EditControl } from 'react-leaflet-draw';

import axios from 'axios';

import coordinator from 'coordinator';

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

        axios.post(config.server_address + '/listobjects', postObject).then(function (response) {

            console.log(response);

            //reset captcha after submission result (SOMEHOW)
            if (response.data === 'success') {

                console.log('it was a success')

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

        return (
            <div>
                <Map center={position} zoom={13} height={500} className="mainMap" minZoom={2} maxBounds={restrictBounds} maxBoundsViscosity={1.0}>
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
            </div>
        );
    }
};
