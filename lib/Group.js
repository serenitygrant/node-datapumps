(function() {
  var Buffer, EventEmitter, Group, Promise, Pump,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  EventEmitter = require('events').EventEmitter;

  Promise = require('bluebird');

  Pump = require('./Pump');

  Buffer = require('./Buffer');

  Group = (function(_super) {
    __extends(Group, _super);

    Group.STOPPED = 0;

    Group.STARTED = 1;

    Group.PAUSED = 2;

    Group.ENDED = 3;

    function Group() {
      this._pumps = {};
      this._exposedBuffers = {};
      this._state = Group.STOPPED;
      this._errorBuffer = new Buffer;
      this._id = null;
    }

    Group.prototype.addPump = function(name, pump) {
      var pumpId;
      if (pump == null) {
        pump = null;
      }
      if (this._pumps[name] != null) {
        throw new Error('Pump already exists');
      }
      this._pumps[name] = pump != null ? pump : new Pump;
      this._pumps[name].on('end', (function(_this) {
        return function() {
          return _this.pumpEnded(name);
        };
      })(this));
      pumpId = this._id != null ? "" + this._id + "/" + name : name;
      this._pumps[name].id(pumpId);
      return this._pumps[name];
    };

    Group.prototype.pumpEnded = function(name) {
      var end, pump, _ref;
      end = true;
      _ref = this._pumps;
      for (name in _ref) {
        pump = _ref[name];
        if (!pump.isEnded()) {
          end = false;
        }
      }
      if (!end) {
        return;
      }
      this._state = Group.ENDED;
      return this.emit('end');
    };

    Group.prototype.pump = function(name) {
      if (this._pumps[name] == null) {
        throw new Error("Pump " + name + " does not exist");
      }
      return this._pumps[name];
    };

    Group.prototype.pumps = function() {
      return this._pumps;
    };

    Group.prototype.start = function() {
      var name, pump, _ref;
      if (this._state !== Group.STOPPED) {
        throw new Error('Group already started');
      }
      this._state = Group.STARTED;
      this._registerErrorBufferEvents();
      _ref = this._pumps;
      for (name in _ref) {
        pump = _ref[name];
        pump.errorBuffer(this._errorBuffer);
      }
      this.run();
      return this;
    };

    Group.prototype._registerErrorBufferEvents = function() {
      return this._errorBuffer.on('full', (function(_this) {
        return function() {
          return _this.pause().then(function() {
            return _this.emit('error');
          });
        };
      })(this));
    };

    Group.prototype.run = function() {
      return this.runPumps();
    };

    Group.prototype.runPumps = function(pumps) {
      var finishPromises, pumpName, _i, _len;
      if (pumps == null) {
        pumps = null;
      }
      if (pumps == null) {
        pumps = this._getAllStoppedPumps();
      }
      if (typeof pumps === 'string') {
        pumps = [pumps];
      }
      finishPromises = [];
      for (_i = 0, _len = pumps.length; _i < _len; _i++) {
        pumpName = pumps[_i];
        finishPromises.push(this.pump(pumpName).start().whenFinished());
      }
      return Promise.all(finishPromises);
    };

    Group.prototype._getAllStoppedPumps = function() {
      var name, pump, result, _ref;
      result = [];
      _ref = this._pumps;
      for (name in _ref) {
        pump = _ref[name];
        if (pump.isStopped()) {
          result.push(name);
        }
      }
      return result;
    };

    Group.prototype.isStopped = function() {
      return this._state === Group.STOPPED;
    };

    Group.prototype.isStarted = function() {
      return this._state === Group.STARTED;
    };

    Group.prototype.isPaused = function() {
      return this._state === Group.PAUSED;
    };

    Group.prototype.isEnded = function() {
      return this._state === Group.ENDED;
    };

    Group.prototype.whenFinished = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          _this.on('end', function() {
            return resolve();
          });
          return _this.on('error', function() {
            return reject('Pumping failed. See .errorBuffer() contents for error messages');
          });
        };
      })(this));
    };

    Group.prototype.createBuffer = function(options) {
      if (options == null) {
        options = {};
      }
      return new Buffer(options);
    };

    Group.prototype.expose = function(exposedName, bufferPath) {
      if (this._exposedBuffers[exposedName] != null) {
        throw new Error("Already exposed a buffer with name " + exposedName);
      }
      return this._exposedBuffers[exposedName] = this._getBufferByPath(bufferPath);
    };

    Group.prototype._getBufferByPath = function(bufferPath) {
      var bufferName, bufferNames, pumpName, _ref;
      _ref = bufferPath.split('/'), pumpName = _ref[0], bufferNames = 2 <= _ref.length ? __slice.call(_ref, 1) : [];
      bufferName = bufferNames.length ? bufferNames.join('/') : 'output';
      return this.pump(pumpName).buffer(bufferName);
    };

    Group.prototype.buffer = function(name) {
      var result, _ref;
      if (name == null) {
        name = 'output';
      }
      try {
        result = (_ref = this._exposedBuffers[name]) != null ? _ref : this._getBufferByPath(name);
      } catch (_error) {

      }
      if (!result) {
        throw new Error("No such buffer: " + name);
      }
      return result;
    };

    Group.prototype.inputPump = function(pumpName) {
      if (pumpName == null) {
        pumpName = null;
      }
      if (pumpName == null) {
        return this._inputPump;
      }
      this._inputPump = this.pump(pumpName);
      return this;
    };

    Group.prototype.addInputPump = function(name, pump) {
      var result;
      if (pump == null) {
        pump = null;
      }
      result = this.addPump(name, pump);
      this.inputPump(name);
      return result;
    };

    Group.prototype.from = function(buffer) {
      if (buffer == null) {
        buffer = null;
      }
      if (this._inputPump == null) {
        throw new Error('Input pump is not set, use .inputPump to set it');
      }
      this._inputPump.from(buffer);
      return this;
    };

    Group.prototype.mixin = function(mixins) {
      if (this._inputPump == null) {
        throw new Error('Input pump is not set, use .inputPump to set it');
      }
      this._inputPump.mixin(mixins);
      return this;
    };

    Group.prototype.process = function() {
      throw new Error('Cannot call .process() on a group: data in a group is transformed by its pumps.');
    };

    Group.prototype.errorBuffer = function(buffer) {
      if (buffer == null) {
        buffer = null;
      }
      if (buffer === null) {
        return this._errorBuffer;
      }
      this._errorBuffer = buffer;
      return this;
    };

    Group.prototype.pause = function() {
      var name, pausePromises, pump, _ref;
      if (this._state === Group.PAUSED) {
        return;
      }
      if (this._state !== Group.STARTED) {
        throw new Error('Cannot .pause() a group that is not pumping');
      }
      pausePromises = [];
      _ref = this._pumps;
      for (name in _ref) {
        pump = _ref[name];
        if (pump.isStarted()) {
          pausePromises.push(pump.pause());
        }
      }
      return Promise.all(pausePromises).then((function(_this) {
        return function() {
          return _this._state = Group.PAUSED;
        };
      })(this));
    };

    Group.prototype.resume = function() {
      var name, pump, _ref;
      if (this._state !== Group.PAUSED) {
        throw new Error('Cannot .resume() a group that is not paused');
      }
      this._state = Group.STARTED;
      _ref = this._pumps;
      for (name in _ref) {
        pump = _ref[name];
        pump.resume();
      }
      return this;
    };

    Group.prototype.id = function(id) {
      var name, pump, _ref;
      if (id == null) {
        id = null;
      }
      if (id === null) {
        return this._id;
      }
      this._id = id;
      _ref = this._pumps;
      for (name in _ref) {
        pump = _ref[name];
        pump.id("" + this._id + "/" + name);
      }
      return this;
    };

    return Group;

  })(EventEmitter);

  module.exports = Group;

}).call(this);