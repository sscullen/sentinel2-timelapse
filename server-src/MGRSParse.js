// Created by Shaun Cullen Sep 10 2017

class MGRSParse {
    constructor(props) {

    }

    parse(mgrsinput) {

        console.log(mgrsinput);

        let utmZoneRegEx = /^\d+/;

        let utmZone = utmZoneRegEx.exec(mgrsinput)

        console.log(utmZone[0])

        mgrsinput = mgrsinput.slice(utmZone[0].length)

        console.log(mgrsinput)

        return [utmZone[0], mgrsinput.slice(0, 1), mgrsinput.slice(1, 3)]

    }
}

module.exports = new MGRSParse();