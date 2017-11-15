/**
 * Created by sc on 7/25/2017.
 */
import React from 'react';

// import { Circle, Map, Marker, Popup, TileLayer, FeatureGroup, GeoJSON } from 'react-leaflet';

// import { EditControl } from 'react-leaflet-draw';

// import imageoverlay from 'leaflet-imageoverlay-rotated';

import axios from 'axios';

import coordinator from 'coordinator';
// import utmToLatlng from 'utm-latlng';
// //var utmConverter = require('utm');
//
// import utm from 'leaflet.utm';

import "../style/_MapContainer.scss"

import config from 'Config'

import mapboxgl from 'mapbox-gl'

import mapboxgldraw from '@mapbox/mapbox-gl-draw';

// Don't forget to import the CSS
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const position = [51.505, -0.09];

mapboxgl.accessToken = 'pk.eyJ1Ijoic2N1bGxlbiIsImEiOiJ1UVAwZ19BIn0.wn4ltQcyl9P5j3bAmNJEPg'

export default class MapContainer extends React.Component {

    constructor(props) {
        super(props);


        this.getBoundsInMGRS = this.getBoundsInMGRS.bind(this);

        this.clickHandler = this.clickHandler.bind(this);

        // this.drawControl = this.drawControl.bind(this);


        this.toggleAmazonAPI = this.toggleAmazonAPI.bind(this);

        this.handleZoomChange = this.handleZoomChange.bind(this);

        this.setCurrentTile = this.setCurrentTile.bind(this);

        this.layerList = [];

        this.state = {
            imageSrc: "./app/static/img.jpg",
            currentTileInfo: {},
            amazonAPI: true,
            resultsList: [],
            geoJson: [],
            tileFootprint: [],
            currentTileID: "",
            currentTileLayerID: "",
            selectionID: ""
        };


    }

    componentDidMount() {

        this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: 'mapbox://styles/mapbox/streets-v9'
        });

        this.map.on('click', (e) => {
            console.log('map clicked', e)
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

    }

    componentWillUnmount() {
        this.map.remove();
    }

    componentDidUpdate() {
        console.log('component updated')
        // this.drawControl.on('draw.create', (features) => {
        //     console.log('did thiss finally work?', features);
        // });

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

        console.log('footprint geometry=================================================================', coords)


        if (this.map.getLayer(this.state.currentTileLayerID + 'footprint') !== undefined) {
            this.map.removeLayer(this.state.currentTileLayerID + 'footprint');
            this.map.removeLayer(this.state.currentTileLayerID + 'image');

            console.log('----------------------------------removed previous layer')


        }

        let currentSource = this.map.getSource(currentTile.uuid + 'footprint')
        console.log(currentSource);
        console.log('current footprint', currentFootprint);

        // this.map.addSource(jsonMetadata.productName + 'source', {
        //     type: 'image',
        //     url: objUrl,
        //     coordinates: latLngCoords
        // });
        //
        // // this.map.addSource(jsonMetadata.productName, {
        // //     type: 'geojson',
        // //     data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
        // // });
        //
        // this.map.addLayer({
        //     id: jsonMetadata.productName + 'layer',
        //     type: 'raster',
        //     source: jsonMetadata.productName + 'source'
        // });
        //

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


        // let imageBounds = [];
        //
        // // imageBounds.push([coords[0][1], coords[0][0]]);
        // // imageBounds.push([coords[2][1], coords[2][0]]);
        // //
        //
        // console.log('Image bounds:', imageBounds);


        // L.imageOverlay(currentTile.localImageURL, imageBounds).addTo(this.mainMap);

        // var topleft    = L.latLng(coords[0][1], coords[0][0]),
        //     topright   = L.latLng(coords[1][1], coords[1][0]),
        //     bottomleft = L.latLng(coords[3][1], coords[3][0]),
        //     bottomright = L.latLng(coords[2][1], coords[2][0]);
        //
        // // imageoverlay.rotated(currentTile.localImageURL, topleft, topright, bottomleft, {
        // //     opacity: 0.7,
        // //     interactive: true,
        // //     attribution: "ESA-Sentinel2"
        // // }).addTo(this.mainMap);
        //
        // console.log('Calling image overlay rotated')
        //
        // L.imageOverlay.rotated(currentTile.localImageURL, topleft, topright, bottomleft, bottomright, {
        //     opacity: 0.9,
        //     interactive: true,
        //     attribution: "ESA-Sentinel2"
        // }).addTo(this.mainMap);

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

                    // this.map.addSource(jsonMetadata.productName, {
                    //     type: 'geojson',
                    //     data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
                    // });

                    this.map.addLayer({
                        id: jsonMetadata.productName + 'layer',
                        type: 'raster',
                        source: jsonMetadata.productName + 'source'
                    });

                    // convert to lat long from UTM zone
                    // let imageBoundsLatLong = [];

                    // var item = L.utm({x: imageBounds[0][0], y: imageBounds[0][1], zone: jsonMetadata.utmZone, band: jsonMetadata.latitudeBand});
                    // var coord = item.latLng();
                    //
                    // var item2 = L.utm({x: imageBounds[1][0], y: imageBounds[1][1], zone: jsonMetadata.utmZone, band: jsonMetadata.latitudeBand});
                    // var coord2 = item2.latLng();
                    //
                    //
                    // console.log('coords, ', coord, coord2);
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

    //
    // _onEditPath(e) {
    //     console.log('path was edited - ', e)
    // }
    //
    // _onCreate(e) {
    //     console.log('path was created - ', e);
    //     console.log(e.layer.getLatLngs());
    //     let coords = e.layer.getLatLngs()[0];
    //
    //     let coordArray = [];
    //
    //     for (let coord of coords) {
    //         console.log(coord)
    //
    //
    //         console.log('org coord', coord)
    //         console.log('wrapped coord', coord.wrap())
    //
    //         coordArray.push(coord.wrap())
    //     }
    //
    //     console.log("coordarray is", coordArray)
    //     this.getBoundsInMGRS(coordArray);
    // }
    //
    // _onDeleted(e) {
    // }
    //     console.log('path was Deleted - ', e)

    callback = (reference) => {
        console.log(this)
        console.log(reference)
    }


    render() {

        // check if there are any new things to be drawn


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



        // var southWest = new L.LatLng(-90, -200);
        // var northEast = new L.LatLng(90, 200);
        // var restrictBounds = new L.LatLngBounds(southWest, northEast);


        let imageSrc = this.state.imageSrc;

        console.log(imageSrc)

        var sectionStyle = {
            border: "1px solid red",
            backgroundColor: "red",
            backgroundImage: "url(" + this.state.imageSrc + ")",
            backgroundSize: "contain"
        };
        const style =  {
            gridColumn: "span 1",
            gridRow: "span 1",
            minHeight: "40vh",
            minWidth: "50vw"
            }
        ;



            // let currentTileFootprint = () => {
        //     let style = {
        //         "color": "#ff7800",
        //         "weight": 5,
        //         "opacity": 0.65
        //     };
        //
        //     if (this.state.currentTileID !== "") {
        //         let currentTileFootprint = this.state.resultsList.find((obj) => obj.uuid === this.state.currentTileID).footprint;
        //         console.log(currentTileFootprint);
        //         return (
        //             <GeoJSON key={this.state.currentTileID} data={currentTileFootprint} style={style} />
        //         );
        //     }
        // }

        return (
            <div className='grid-container'>
                {/*<Map*/}
                    {/*ref={(butt) => { this.mapContainer = butt; }}*/}
                    {/*style="mapbox://styles/mapbox/streets-v9"*/}
                    {/*containerStyle={{*/}
                        {/*height: "50vh",*/}
                        {/*width: "50vw",*/}
                        {/*gridColumn: "span 1"*/}
                    {/*}}*/}
                    {/*onClick={this.clickHandler}*/}
                    {/*drawCreate={this.polygonCreated}*/}
                    {/*onRender={this.mapRendered}*/}
                    {/*>*/}
                    {/*<DrawControl*/}
                        {/*ref={(drawControl) => { this.drawControl = drawControl; }}*/}
                        {/*displayControlsDefault={false}*/}
                        {/*controls={{*/}
                            {/*polygon: true,*/}
                            {/*trash: true*/}
                        {/*}}*/}
                        {/*create={this.polygonCreated}*/}
                    {/*/>*/}
                    {/*<Layer*/}
                        {/*type="symbol"*/}
                        {/*id="marker"*/}
                        {/*layout={{ "icon-image": "harbor-15" }}>*/}
                        {/*<Feature coordinates={[-0.481747846041145, 51.3233379650232]}/>*/}
                    {/*</Layer>*/}
                {/*</Map>*/}

                <div className="mapContainer" style={style} ref={el => this.mapContainer = el}/>


                {/*<Map ref='map' center={position} zoom={13} height={500} className="mainMap" minZoom={2} maxBounds={restrictBounds} maxBoundsViscosity={1.0} onZoomend={this.handleZoomChange}>*/}
                    {/*<FeatureGroup>*/}
                        {/*<EditControl*/}
                            {/*position='topright'*/}
                            {/*onEdited={this._onEditPath}*/}
                            {/*onCreated={this._onCreate}*/}
                            {/*onDeleted={this._onDeleted}*/}
                            {/*draw={{*/}
                                {/*marker: false,*/}
                                {/*polyline: false,*/}
                                {/*circle: false*/}
                            {/*}}*/}
                        {/*/>*/}
                        {/*<Circle center={[51.51, -0.06]} radius={200} />*/}
                    {/*</FeatureGroup>*/}
                    {/*<TileLayer*/}
                        {/*url='http://{s}.tile.osm.org/{z}/{x}/{y}.png'*/}
                        {/*attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'*/}
                        {/*// noWrap='false'*/}
                    {/*/>*/}

                    {/*{this.state.tileFootprint.map((obj) =>{*/}
                        {/*return (*/}
                            {/*<GeoJSON key={obj.name} data={obj} style="" />*/}
                        {/*);*/}
                    {/*})}*/}


                    {/*{currentTileFootprint()}*/}


                    {/*<Marker position={position}>*/}
                        {/*<Popup>*/}
                            {/*<span>A pretty CSS3 popup.<br/>Easily customizable.</span>*/}
                        {/*</Popup>*/}
                    {/*</Marker>*/}
                {/*</Map>*/}
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
