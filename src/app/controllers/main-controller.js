angular.module('DeviceWall')
  .controller('MainController', function($rootScope, $scope, $window, $http, $timeout, lodash, LOGIN_TYPE, $log, socket) {
    var _ = lodash;
    $log.debug('loading main controller');
    $scope.indicatorWaiting = {show: true};

    // selected device uuid list? TODO refactor whole selected devices list feature, this is not nice, really.
    $scope.uuids = {};

    // this is weird, just weiirrddd, TODO refactor away
    $scope.user = {
      id: $window.localStorage.getItem('name'),
      displayName: $window.localStorage.getItem('name')
    };
    $scope.url = '';
    // maybe there is an old url in localstorage already..
    if ($window.localStorage.getItem('url') !== null) {
      $scope.url = $window.localStorage.getItem('url');
    }

    $scope.btnGo =              {show: true};
    $scope.btnStopAllTesting =  {show: false};
    $scope.btnStopTesting =     {show: false};

    // TODO maybe better error notification
    $scope.tooltipError = {
      show: false,
      content: ''
    };

    $scope.popupWindow = null;

    // Connected devices
    $scope.deviceList = [];

    // TODO maybe custom $filter
    $scope.getBatteryStatusTitle = function(level, isPlugged) {
      return level ? 'Level: ' + level + ' %' + (isPlugged ? ', plugged' : '') : '';
    };
    // TODO maybe https://docs.angularjs.org/api/ng/service/$filter
    $scope.getBatteryStatusStyle = function(level, isPlugged) {
      var position = (level * 0.8 + 10) + '%',
          stop1 = (isPlugged ? '#0f0' : '#fff') + ' ' + position,
          stop2 = (isPlugged ? '#0c0' : '#ccc') + ' ' + position;
      return 'background-image: -webkit-linear-gradient(left, ' + stop1 + ', ' + stop2 + ');';
    };
    // TODO maybe https://docs.angularjs.org/api/ng/service/$filter
    $scope.getDeviceDisabled = function(userId) {
      return userId ? true : false;
    };

    $scope.submitUrl = function() {
      $log.debug('Submit url ', $scope.url.value);
      if ($scope.url.value.length <= 4) {
        $scope.tooltipError = {
          show: true,
          content: 'Invalid url'
        };
        return;
      }
      var uuids = [];
      _.each($scope.uuids, function(val, key) {
        if(val) {
          uuids.push(key);
        }
      });
      var formData = {
        url: $scope.url.value,
        labels: $scope.deviceList.map(function(o) { return o.label; }),
        user: $scope.user
      };
      $window.localStorage.setItem('url', $scope.url.value);
      socket.emit('start', formData);
      setButtonsStatus(false);
    };

    $scope.url = {
      value: '',
      click: function() {
        if (!$scope.url.value || $scope.url.value === '') {
          $scope.url.value = 'http://www.';
        }
      }
    };

    $scope.selectAll = {
      click: function() {
        _.each($scope.deviceList, function(val, key) {
          if (!val.userId || val.userId === '') {
            $scope.uuids[val.uuid] = true;
          }
        });
      }
    };

    $scope.selectNone = {
      click: function() {
        _.each($scope.deviceList, function(val, key) {
          $scope.uuids[val.uuid] = false;
        });
      }
    };

    /***************** Create service from socket actions **/
    // TODO move socket stuff from controller to service
    socket.on('connect',  function () {
      $log.debug("Connected");
      $scope.indicatorWaiting = {show: false};
      socket.emit('list', 'list', function(data) {
        $log.debug("socket::list", data);
        $scope.deviceList = data;
      });
    });

    socket.on('update', function (data) {
      $log.debug("socket::update");
      $scope.deviceList = data;
    });

    socket.on('start', function (data) {
      $log.debug("socket::start", data);
      if (data.user.id === $scope.user.id) {
        setButtonsStatus(false);
        if ($scope.openUrl) {
          $log.debug('Opening a popup view');
          if ($scope.popupWindow && !$scope.popupWindow.closed) {
            $scope.popupWindow.location.href = data.url;
            $scope.popupWindow.focus();
          } else {
            $scope.popupWindow = $window.open(data.url, '_blank');
          }
        }
      }
    });

    socket.on('server-stop', function(data) {
      $log.debug('socket::server-stop');
      if (data.user.id === $scope.user.id) {
        setButtonsStatus(true);
      }
      if (data.reason) {
        $log.debug('some err', data.reason);
        $scope.tooltipError.content = data.reason;
        $scope.tooltipError.show = true;
      }
    });

    socket.on('stopall', function() {
      $log.debug('socket::stopall');
      setButtonsStatus(true);
    });

    // TODO maybe move this to $filter
    function getUserDevices() {
      var userDevices = [];
      _.each($scope.deviceList, function(device) {
        if (device.userId === $scope.user.id) {
          userDevices.push(device.uuid);
        }
      });
      return userDevices;
    }

    $scope.stopTesting = function() {
      $log.debug('stop testing');
      socket.emit('stop', {user: $scope.user, labels: getUserDevices()});
      $scope.btnStopTesting.show = false;
    };

    $scope.stopAllTesting = function() {
      $log.debug('stop All testing');
      // TODO remove this filthy code
      if ($window.confirm("Do you really want to stop all browsersync instances?")) {
        socket.emit('stopall');
      }
    };

    $scope.removeDevice = function(device) {
      socket.emit('remove', {labels: [device.label]});
      $scope.deviceList = _.filter($scope.deviceList, function(d) {
        return d.label === device.label;
      });
    };

    // simple helper for buttons
    function setButtonsStatus(status) {
      $scope.btnStopAllTesting.show = !status;
      $scope.btnStopTesting.show = !status;
      $scope.btnGo.show = status;
    }
  });