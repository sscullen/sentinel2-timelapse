# sentinel2-timelapse

## Quick Instructions

### Prerequisites

#### Setup SentinelHub-Py for Downloading

This is a python module used for downloading S2 products from AWS, install with:

`bash
pip3.6 install sentinelhub
`

Verify that it is installed correctly:

`bash
sentinelhub.aws --help
`

#### Setup Sen2Cor for Atmospheric Correction

Download Sen2Cor 2.4.0, extract the archive anywhere on your computer, add the path to the extracted folder to your PATH env variable.


Verify you have access to the L2A_Process.bat script from anywhere on your system:

`bash
L2A_Process
`

This should show a help message with the possible command options.

#### Download the Static files

This zip contains static files such as images or geotiffs of the MGRS grid. Since there is a lot of files and they are not changing, these files are stored in a seperate download, here:
https://drive.google.com/file/d/1-sIt-sQbAT5xu5d5QifjfqemwskxfvV1/view?usp=sharing

Later in the intructions, you will place the `static` folder in the downloaded code from github, in `sentinel2-timelapse/client-dist/app`

### Get Sentinel2-Timelapse and Install

Download the latest .zip of the code from here https://github.com/sscullen/sentinel2-timelapse/archive/master.zip or do a git clone of https://github.com/sscullen/sentinel2-timelapse , if the repo is private, request permission from ss.cullen [at] uleth.ca.

Extract the code, and from inside the extracted folder, run these commands:

`bash
npm install
`

This will install all the node.js and javascript dependencies.

`bash
npm run webpack
`

This will transpile the code into a single bundle.js which is the heart of our application.

`bash
npm run start
`

This is the command that actually starts the application. There are 2 components, the client and the server. The server does 2 critical things: serves the client application, and responds to RESTful API requests from the client application. You can verify everything is working by going to http://localhost:8000 

The localhost address is the default but can be changed to another ip and port config in the `s2-tl.config.json` file.

Make sure to copy the `static` folder to the `client-dist/app/` now that you have the code downloaded and extracted.

### Conclusion

That is the very basic installation instructions, email ss.cullen [at] uleth.ca with questions.