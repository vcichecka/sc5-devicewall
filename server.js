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
  config = require('./config.json');

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
  console.log(devices);
});

app.on('update-instances', function () {
  fs.writeFileSync('./data/instances.json', JSON.stringify(instances));
  console.log('Updated instances.json');
  console.log(instances);
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





app.post('/identify', function (req, res) {

  var label = req.body.label;

  if (!label) {
    res.json({message: 'Label missing.'});
    return;
  }

  var updated = false;

  devices.forEach(function (device, index) {

    if (device.label == label) {
      device.updated = +new Date();
      updated = true;
    }

  });

  if (!updated) {
    devices.push({
      label: label,
      updated: +new Date()
    });
  }

  app.emit('update-devices');

  res.json({message: 'Identified succesfully.'});

});





app.get('/ping', function (req, res) {

  var
    label = req.query.label,
    userId = req.query.user_id,
    message = {};

  instances.forEach(function (instance, index) {
    if (label) {
      if (instance.labels.indexOf(label) >= 0 && instance.browserSync && instance.updated + 10000 > (+new Date())) {
        message.address = instance.browserSync;
      }
    } else if (userId) {
      if (instance.userId == userId && instance.browserSync) {
        message.address = instance.browserSync;
      }
    }
  });

  res.json(message);

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





// Namespace "devicewallapp"

nsApp.on('connect', function (socket) {

  console.log('DeviceWall device connected!');

  // Update device status

  socket.on('update', function (data) {

    console.log(data);

    var
      uuid = data.uuid,
      model = data.model,
      batteryStatus = data.batteryStatus;

    var updated = false;

    devices.forEach(function (device, index) {

      if (device.uuid == uuidl) {
        device.model = model;
        device.batteryStatus = batteryStatus;
        device.updated = +new Date();
        updated = true;
      }

    });

    if (!updated) {
      devices.push({
        uuid: uuid,
        model: model,
        batteryStatus: batteryStatus,
        updated: +new Date()
      });
    }

    app.emit('update-devices');

    ns.emit('update', devices);

  });

});

nsApp.on('disconnect', function () {
  console.log('DeviceWall device disconnected.');
});





// Namespace "devicewall"

ns.on('connect', function (socket) {

  console.log('DeviceWall control panel connected!');

  // Start

  socket.on('start', function (data) {

    var
      user = data.user,
      url = data.url,
      uuids = data.uuids || [];

    // Updating devices

    devices.forEach(function (device, deviceIndex) {
      uuids.forEach(function (uuid, uuidIndex) {
        // Check that there's no user or same user tries to use device
        if (device.uuid === uuid && (!device.userId || device.userId === user.id)) {
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
      if (instance.userId == user.id) {
        updated = true;
        instance.url = url;
        instance.uuids = uuids;
        instance.browserSync = null;
        instance.updated = +new Date();
      }
    });

    if (!updated) {
      instances.push({
        userId: user.id,
        url: url,
        uuids: uuids,
        browserSync: null,
        updated: +new Date()
      });
    }

    app.emit('update-instances');

    // Start Browser Sync

    var bs = browserSync.init(null, {
      proxy: url,
      browser: 'disable',
      ghostMode: {
        clicks: true,
        location: true,
        forms: true,
        scroll: true
      }
    });

    // Update instances once BrowserSync is up and running, after that the page can be opened

    bs.events.on('init', function (api) {

      instances.forEach(function (instance, index) {
        if (instance.userId == user.id) {
          instance.browserSync = api.options.urls.external;
          instance.updated = +new Date();
        }
      });

      app.emit('update-instances');

      ns.emit('open', data);
      nsApp.emit('open', data);

    });

  });

  // Stop

	socket.on('stop', function (data) {

	  var uuids = data.uuids;

	  // Update device

	  devices.forEach(function (device, index) {
	    if (uuids.indexOf(device.uuid) > 0) {
	      device.userId = null;
	      device.userName = null;
	    }
	  });

	  app.emit('update-devices');

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

});

ns.on('disconnect', function () {
  console.log('DeviceWall control panel disconnected.');
});





// Start server

io.listen(3000);
console.log('Socket.io server listening on port 3000');
