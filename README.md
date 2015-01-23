# SC5 Device Wall
[![Build Status](https://travis-ci.org/SC5/sc5-devicewall.svg?branch=master)](https://travis-ci.org/SC5/sc5-devicewall) [![dependencies](https://david-dm.org/SC5/sc5-devicewall.png)](https://david-dm.org/SC5/sc5-devicewall)

Device Wall helps developers test web applications on multiple devices at the same time.

## Table of contents

* [Installation](#installation)
* [Configuration](#configuration)
  * [Config files](#config-files)
  * [Generated configurations](#generated-configurations)
  * [Custom configuration files](#custom-configuration-files)
  * [Local server configuration](#local-server-configuration)
  * [Application configuration](#application-configuration)
* [Building](#building)
* [Running the Service](#Running-the-service)
  * [Live reloading the changes](#live-reloading-the-changes)
* [Testing](#testing)
  * [Testing in headless environment](#testing-in-headless-environment)
* [License](#license)

## Installation

If you don't already have node.js 0.10.x or later, fetch it from
[nodejs.org](http://www.nodejs.org/). In addition we need a few dependencies
you may have.

    > npm install -g gulp

In addition, you will need [Ruby](https://www.ruby-lang.org/en/downloads/) to use
Compass framework for compiling SASS stylesheets into CSS and sprite sheets:

    > gem update --system
    > gem install bundler
    > bundle install

Note: you may need to first uninstall other SASS versions than (3.2.x).

Installing the project itself is easy. Both build system dependencies and app dependencies are
triggered by

    > npm install

It actually performs a release build, too (to verify that everything is ok).

## Configuration

Server and Angular configurations are generated by gulp "config" task.

Gulp "config" task rewrites configuration files for both server and Angular app.

Default server configuration is read from npm config environments variables, see package.json.

### Config files

These files are kept in version control.

Server config:

    config/server/config.json
Angular application config:

    config/app/config.json

### Generated configurations

Runtime configuration files are generated to these locations:

Server configuration:

    config.json
Angular app configuration:

    src/app/config.js

### Custom configuration files

Configurations can be overridden with config.local.json configuration.

Gulp task will check these files and includes them when found.

    config/server/config.local.json
    config/app/config.local.json

### Local server configuration

##### proxyHost
To define proxy host use param eg. "192.168.0.1" or use false to use auto-detection

    "proxyHost": false # proxyHost is autodetected, otherwise will be host string
#### protocol
To use HTTPS or HTTP protocol with Devicewall

    "protocol": "https" # https-protocol is used
#### sslKey
SSL certificate key path when protocol HTTPS used

    "sslKey": "./node_modules/browser-sync/lib/server/certs/server.key"
#### sslKey
SSL certificate path when protocol HTTPS used

    "sslCert": "./node_modules/browser-sync/lib/server/certs/server.crt"
#### deviceWallAppURL
This URL is represents idle mode URL. Used when client jumps from testing back to idle.

    "deviceWallAppURL": "https://devicewall.sc5.io/client" # clients returns from browserSync to this URL
#### clientIdleReturnSeconds
Client is automatically redirected back to idle mode after clientIdleReturnSeconds is exceeded

    "clientIdleReturnSeconds": 300 # client returns from testing automatically after 300 seconds
#### removeDeviceAfterUnusedDays
Unused devices are removed completely after defined amount of days

    "removeDeviceAfterUnusedDays": 30 # device removed from server after unused for 30 days

### Application configuration

#### connectionSetup
Connection setup represents control panel configuration tab which is used to give different kind of settings

    "connectionsSetup": {
      "enabled: true, # connection setup tab enabled
      "customUserAgent": true # Custom user agent header setting enabled
      "client": {
        "screenSaverTimeoutSeconds": 600, # screen saver enabled after 600s
        "redirectToClientModeAutomatically": false # automatic redirect disabled from main page if device detected as client
      }

#### screenSaverTimeoutSeconds
Controls the time after screen saver appears. Screen saver is supposed to keep devices displays to not burn.

    "connectionsSetup.client.screenSaverTimeoutSeconds": 300 # Screen saver will appear after 300 seconds idle

## Building

The current build compiles JS and CSS monoliths for both the debug and release builds. The big
difference is that the debug build supports source maps and is not minified.

To first cleanup your distribution directory and trigger **release** build

    > gulp clean
    > gulp

To trigger **debug** build, run gulp with a debug flag

    > gulp --debug

To keep gulp running and watch for changes, use e.g.

    > gulp watch --debug

To update your package version, you eventually want to do one of the following:

    > gulp bump --patch
    > gulp bump --minor
    > gulp bump --major
    > gulp bump # defaults to minor

## Running the Service

Most likely the normal *gulp serve* task will not suffice, and you want to run your own test
server, instead. The task below, will default to 'gulp serve' by default until you change it:

    > npm start
    or
    > node server/server.js

### Live reloading the changes

Live reloading is enabled when running *gulp watch* in another window. Just change any of your
JavaScript or SASS files to trigger reload. The reload monitors 'dist' directory and pushes the
changes as needed.

## Testing

Run tests with chromedriver:

    > gulp test:e2e

### Testing in headless environment

Install Xvfb or similar.

Simplified instructions:

    > sudo apt-get install xvfb
    > sudo Xvfb :10 -ac
    > export DISPLAY=:10
    > gulp test:e2e

## License

    The MIT License (MIT)

    Copyright (c) 2014 SC5 Online Oy

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
