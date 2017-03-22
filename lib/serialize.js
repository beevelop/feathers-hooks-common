'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.serialize = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _utils = require('./utils');

var serialize = exports.serialize = function serialize(schema) {
  return function (hook) {
    schema = typeof schema === 'function' ? schema(hook) : schema;
    var schemaDirectives = ['computed', 'exclude', 'only'];

    (0, _utils.replaceItems)(hook, serializeItems((0, _utils.getItems)(hook), schema));
    return hook;

    function serializeItems(items, schema) {
      if (!Array.isArray(items)) {
        return serializeItem(items, schema);
      }

      return items.map(function (item) {
        return serializeItem(item, schema);
      });
    }

    function serializeItem(item, schema) {
      var computed = {};
      Object.keys(schema.computed || {}).forEach(function (name) {
        computed[name] = schema.computed[name](item, hook); // needs closure
      });

      var only = schema.only;
      only = typeof only === 'string' ? [only] : only;
      if (only) {
        var newItem = {};
        only.concat('_include', '_elapsed', item._include || []).forEach(function (key) {
          (0, _utils.setByDot)(newItem, key, (0, _utils.getByDot)(item, key), true);
        });
        item = newItem;
      }

      var exclude = schema.exclude;
      exclude = typeof exclude === 'string' ? [exclude] : exclude;
      if (exclude) {
        exclude.forEach(function (key) {
          (0, _utils.setByDot)(item, key, undefined, true);
        });
      }

      var _computed = Object.keys(computed);
      item = Object.assign({}, item, computed, _computed.length ? { _computed: _computed } : {});

      Object.keys(schema).forEach(function (key) {
        if (!schemaDirectives.includes(key) && _typeof(item[key]) === 'object') {
          // needs closure
          item[key] = serializeItems(item[key], schema[key]);
        }
      });

      return item;
    }
  };
};