// http://petstore.swagger.wordnik.com/v2/swagger.json

var ejs = require('ejs');
var assert = require('assert');
var util = require('util');
var _cloneDeep = require('lodash.clonedeep');

var template = require('./model-template');

function BaseGenerator(options) {
  this.options = options || {};
}

function BaseOperation(op) {
  var copy = _cloneDeep(op || {});
  for (var p in copy) {
    this[p] = copy[p];
  }
}

BaseOperation.prototype.getAccepts = function () {
  if (this.accepts) {
    return this.accepts;
  }
  var accepts = this.parameters.map(this.parameter.bind(this));
  this.accepts = accepts;
  return this.accepts;
};

BaseOperation.prototype.getReturns = function () {
  if (this.returns) {
    return this.returns;
  }
  var returns = [];
  this.errorTypes = [];
  this.returnType = 'Object';
  for (var code in this.responses) {
    var res = this.responses[code];
    if (code.match(/^2\d\d$/) || code === 'default') {
      if (res.schema && res.schema.$ref && res.schema.$ref.indexOf('#/definitions/') === 0) {
        var modelName = res.schema.$ref.substring('#/definitions/'.length);
        var model = this.models[modelName];
        var type = model ? modelName : 'Object';
        this.returnType = type;
        returns.push({
          description: res.description,
          type: type
        });
      }
    } else {
      this.errorTypes.push({
        statusCode: code,
        message: res.description
      });
    }
  }
  this.returns = returns;
  return this.returns;
};

BaseOperation.prototype.getRemoting = function () {
  if (this.remoting) {
    return this.remoting;
  }
  var remoting = {isStatic: true};
  if (this.consumes) {
    remoting.consumes = this.consumes;
  }
  if (this.produces) {
    remoting.produces = this.produces;
  }
  remoting.accepts = this.getAccepts();
  remoting.returns = this.getReturns();
  remoting.http = {
    verb: this.verb,
    path: this.path
  };
  this.remoting = remoting;
  return this.remoting;
};

BaseOperation.prototype.printRemoting = function () {
  return util.inspect(this.getRemoting(), {depth: null });
}

exports.BaseOperation = BaseOperation;
exports.BaseGenerator = BaseGenerator;

BaseGenerator.prototype.getOperations = function (spec) {
  // var info = spec.info;
  // var basePath = spec.basePath;
  var models = spec.definitions;

  var operations = {};

  for (var path in spec.paths) {
    var ops = spec.paths[path];
    for (var verb in ops) {
      var op = new BaseOperation(ops[verb]);

      if (!op.parameters) {
        op.parameters = [];
      }

      op.models = models;

      op.verb = verb;
      // Replace {id} with :id
      op.path = path.replace(/{(([^{}])+)}/g, ':$1');

      op.getRemoting();

      operations[op.verb + ' ' + op.path] = op;
    }
  }
  return operations;
};

BaseGenerator.prototype.generateRemoteMethods = function (spec, options) {
  options = options || {};

  var code = ejs.render(template,
    {modelName: options.modelName || 'SwaggerModel', operations: this.getOperations(spec)});
  return code;
};

