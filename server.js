var
  express = require('express'),
  cookieParser = require('cookie-parser'),
  bodyParser = require('body-parser'),
  expressSession = require('express-session'),
  fs = require('fs'),
  browserSync = require('browser-sync'),
  passport = require('passport'),
  GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
  app = express(),
  users = {},
  devices = [],
  instances = [],
  config = require('./config.json'),
  childProcesses = {},
  fork = require('child_process').fork;

if (fs.existsSync('./data/devices.json')) {
  devices = require('./data/devices.json');
}

if (fs.existsSync('./data/instances.json')) {
  instances = require('./data/instances.json');
}

app.use(cookieParser());
app.use(expressSession({secret: config.sessionKey, resave: true, saveUninitialized: true}));
app.use(bodyParser.urlencoded({extended: true}));
app.use(passport.initialize());
app.use(passport.session());

app.on('update-devices', function () {
  fs.writeFileSync('./data/devices.json', JSON.stringify(devices));
  console.log('Updated devices.json');
});

app.on('update-instances', function () {
  fs.writeFileSync('./data/instances.json', JSON.stringify(instances));
  console.log('Updated instances.json');
});

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  done(null, users[id]);
});

passport.use(new GoogleStrategy(
  {
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL:config.GOOGLE_CALLBACK_URL
  },
  function (accessToken, refreshToken, profile, done) {
    var
      userId = profile.id,
      user = {
        id: userId,
        displayName: profile.displayName,
        emails: profile.emails
      };
    users[userId] = user;
    return done(null, user);
  }
));

app.get('/auth/google', passport.authenticate('google', {scope: 'openid profile email'}));

app.get('/auth/google/callback',
  passport.authenticate('google', {failureRedirect: '/'}),
  function (req, res) {
    res.redirect('/');
  }
);

app.get('/user', function (req, res) {
  res.set('Cache-Control', 'no-cache');
  res.json({user: req.user});
});

app.get('/devices', function (req, res) {
  devices.sort(function (a, b) {
    if (a.location > b.location) {
      return 1;
    } else if (a.location < b.location) {
      return -1;
    } else {
      if (a.label > b.label) {
        return 1;
      } else if (a.label < b.label) {
        return -1;
      }
    }
    return 0;
  });

  res.set('Cache-Control', 'no-cache');
  res.json(devices);
});

app.post('/save', function (req, res) {
  var
    label = req.body.label,
    key = req.body.key,
    value = req.body.value;

  // Update device

  devices.forEach(function (device, index) {
    if (device.label == label) {
      device[key] = value;
    }
  });

  app.emit('update-devices');

  res.json({message: 'Saved value'});

});

app.use(express.static(__dirname + '/dist'));

var server = app.listen(process.argv[2] || 80, function () {
  console.log('Express server listening on port %d', server.address().port);
});


// Socket.io server
var
  io = require('socket.io')(server),
  nsApp = io.of('/devicewallapp'),
  ns = io.of('/devicewall');

function guid() {
  function _p8(s) {
      var p = (Math.random().toString(16)+'000000000').substr(2,8);
      return s ? '-' + p.substr(0,4) + '-' + p.substr(4,4) : p ;
  }
  return _p8() + _p8(true) + _p8(true) + _p8();
}

// Namespace "devicewallapp"
nsApp.on('connection', function (socket) {

  console.log('DeviceWall device connected!');

  // Update device status
  socket.on('update', function (data) {

    var label = data.label,
        model = data.model,
        batteryStatus = data.batteryStatus,
        platform = data.platform,
        version = data.version,
        updated = false;

    devices.forEach(function (device, index) {
      if (device.label === label) {
        device.model = model;
        device.platform = platform;
        device.version = version;
        device.batteryStatus = batteryStatus;
        device.updated = +new Date();
        updated = true;
      }
    });

    if (!updated) {

    	// Determine label for the device

    	var tempLabel = 0;

	    devices.forEach(function (device, index) {
	    	var currentLabel = parseInt(device.label.replace(/[^0-9]/, ''), 10);
	      if (currentLabel > tempLabel) {
	      	tempLabel = currentLabel;
	      }
	    });

      if (!label) {
        label = 'P' + ('00' + (label + 1)).substr(-3, 3); // P stands for "phone", default format is for example "P001"
	    }

      devices.push({
        label: label,
        model: model,
        platform: platform,
        version: version,
        batteryStatus: batteryStatus,
        updated: +new Date()
      });

    }

    app.emit('update-devices');

    ns.emit('update', devices);

  });

  socket.on('disconnect', function () {
    console.log('DeviceWall device disconnected.');
  });

});





// Namespace "devicewall"
ns.on('connection', function (socket) {

  console.log('DeviceWall control panel connected!');

  // Start
  socket.on('start', function (data) {

    console.log('DeviceWall control panel start.');

    var user = data.user,
        url = data.url,
        labels = data.labels || [];

    // Updating devices
    devices.forEach(function (device, deviceIndex) {
      labels.forEach(function (label, labelIndex) {
        // Check that there's no user or same user tries to use device
        if (device.label === label && (!device.userId || device.userId === user.id)) {
          device.userId = user.id;
          device.userName = user.displayName;
          device.lastUsed = +new Date();
        }
      });
    });

    app.emit('update-devices');

    // Updating instances
    var updated = false;

    instances.forEach(function (instance, index) {
      if (instance.userId === user.id) {
        updated = true;
        instance.url = url;
        instance.labels = labels;
        instance.browserSync = null;
        instance.updated = +new Date();
      }
    });

    if (!updated) {
      instances.push({
        userId: user.id,
        url: url,
        labels: labels,
        browserSync: null,
        updated: +new Date()
      });
    }

    app.emit('update-instances');

    if (childProcesses[user.id]) {
      childProcesses[user.id].send({type: 'exit'});
      delete childProcesses[user.id];
    }

    childProcesses[user.id] = fork('./server-browsersync');
    childProcesses[user.id].send({type: 'init', url: url});
    childProcesses[user.id].on('message', function(message) {
      if (message.type === 'browserSyncInit') {
        instances.forEach(function(instance, index) {
          if (instance.userId === user.id) {
            instance.browserSync = message.browserSync;
            instance.updated = +new Date();
          }
        });
        data.url = message.browserSync;
        app.emit('update-devices');
        ns.emit('update', devices);
        ns.emit('start', data);
        nsApp.emit('start', data);
      }
    });

  });

  // Stop
	socket.on('stop', function (data) {

	  console.log('DeviceWall control panel stop.');

	  var labels = data.labels,
	      user = data.user;

	  // Update device
	  devices.forEach(function (device, index) {
	    labels.forEach(function (label, index) {
  	    if (device.label === label) {
  	      device.userId = null;
  	      device.userName = null;
  	    }
	    });
	  });

	  app.emit('update-devices');
    ns.emit('update', devices);
    nsApp.emit('stop', data);

    if (user && childProcesses[user.id]) {
      childProcesses[user.id].send({type: 'location', url: config.deviceWallAppURL});
      childProcesses[user.id].send({type: 'exit'});
      delete childProcesses[user.id];
    }
	});

	// List devices

	socket.on('list', function (data, fn) {
	  devices.sort(function (a, b) {
	    if (a.location > b.location) {
	      return 1;
	    } else if (a.location < b.location) {
	      return -1;
	    } else {
	      if (a.label > b.label) {
	        return 1;
	      } else if (a.label < b.label) {
	        return -1;
	      }
	    }
	    return 0;
	  });

		fn(devices);
	});

  socket.on('disconnect', function () {
    console.log('DeviceWall control panel disconnected.');
  });

});





// Start server
io.listen(3000);
console.log('Socket.io server listening on port 3000');
