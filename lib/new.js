'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.traverse = exports.isNot = exports.isProvider = exports.unless = exports.every = exports.some = exports.when = exports.iff = exports.iffElse = exports.combine = exports.softDelete = undefined;

var _commons = require('feathers-hooks/lib/commons');

var _utils = require('./utils');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/* eslint-env es6, node */
/* eslint no-param-reassign: 0, no-var: 0 */

var traverser = require('traverse');
var errors = require('feathers-errors').errors;


/**
 * Mark an item as deleted rather than removing it from the database.
 *
 * @param {string} field - Field for delete status. Supports dot notation. Default is 'deleted'.
 *
 * export.before = {
 *   all: softDelete()
 * };
 */
var softDelete = exports.softDelete = function softDelete(field) {
  var deleteField = field || 'deleted';

  return function (hook) {
    var service = this;
    hook.data = hook.data || {};
    hook.params.query = hook.params.query || {};
    (0, _utils.checkContext)(hook, 'before', null, 'softDelete');

    if (hook.params.query.$disableSoftDelete) {
      delete hook.params.query.$disableSoftDelete;
      return hook;
    }

    switch (hook.method) {
      case 'find':
        hook.params.query[deleteField] = { $ne: true };
        return hook;
      case 'get':
        return throwIfItemDeleted(hook.id).then(function () {
          return hook;
        });
      case 'create':
        return hook;
      case 'update': // fall through
      case 'patch':
        if (hook.id) {
          return throwIfItemDeleted(hook.id).then(function () {
            return hook;
          });
        }
        hook.params.query[deleteField] = { $ne: true };
        return hook;
      case 'remove':
        return Promise.resolve().then(function () {
          return hook.id ? throwIfItemDeleted(hook.id) : null;
        }).then(function () {
          hook.data[deleteField] = true;
          hook.params.query[deleteField] = { $ne: true };
          hook.params.query.$disableSoftDelete = true;

          return service.patch(hook.id, hook.data, hook.params).then(function (result) {
            hook.result = result;
            return hook;
          });
        });
    }

    function throwIfItemDeleted(id) {
      return service.get(id, { query: { $disableSoftDelete: true } }).then(function (data) {
        if (data[deleteField]) {
          throw new errors.NotFound('Item has been soft deleted.');
        }
      }).catch(function () {
        throw new errors.NotFound('Item not found.');
      });
    }
  };
};

/**
 * Hook to execute multiple hooks
 *
 * @param {Array.function} rest - Hook functions to execute.
 * @returns {Object} resulting hook
 *
 * Example 1
 * service.before({
 *   create: hooks.combine(hook1, hook2, ...) // same as [hook1, hook2, ...]
 * });
 *
 * Example 2 - called within a custom hook function
 * function (hook) {
 *   ...
 *   return hooks.combine(hook1, hook2, ...).call(this, currentHook)
 *     .then(hook => { ... });
 * }
 */
var combine = exports.combine = function combine() {
  for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
    rest[_key] = arguments[_key];
  }

  return function (hook) {
    return _commons.processHooks.call(this, rest, hook);
  };
};

/**
 * Hook to conditionally execute one or another set of hooks.
 *
 * @param {Function|Promise|boolean} ifFcn - Predicate function(hook).
 * @param {Array.function|Function} trueHooks - Hook functions to execute when ifFcn is truthy.
 * @param {Array.function|Function} falseHooks - Hook functions to execute when ifFcn is falsey.
 * @returns {Object} resulting hook
 *
 * The predicate is called with hook as a param.
 *   const isServer = hook => !hook.params.provider;
 *   iff(isServer, hook.remove( ... ));
 * You can use a high order predicate to access other values.
 *   const isProvider = provider => hook => hook.params.provider === provider;
 *   iff(isProvider('socketio'), hook.remove( ... ));
 *
 * The hook functions may be sync, return a Promise, or use a callback.
 * feathers-hooks will catch any errors from the predicate or hook Promises.
 *
 * Examples
 * iffElse(isServer, [hookA, hookB], hookC)
 *
 * iffElse(isServer,
 *   [ hookA, iffElse(hook => hook.method === 'create', hook1, [hook2, hook3]), hookB ],
 *   iffElse(isProvider('rest'), [hook4, hook5], hook6])
 * )
 */
var iffElse = exports.iffElse = function iffElse(ifFcn, trueHooks, falseHooks) {
  return function (hook) {
    var _this = this;

    if (typeof trueHooks === 'function') {
      trueHooks = [trueHooks];
    }
    if (typeof falseHooks === 'function') {
      falseHooks = [falseHooks];
    }

    var runHooks = function runHooks(hooks) {
      return hooks ? combine.apply(undefined, _toConsumableArray(hooks)).call(_this, hook) : hook;
    };

    var check = typeof ifFcn === 'function' ? ifFcn(hook) : !!ifFcn;

    if (!check) {
      return runHooks(falseHooks);
    }

    if (typeof check.then !== 'function') {
      return runHooks(trueHooks);
    }

    return check.then(function (check1) {
      return runHooks(check1 ? trueHooks : falseHooks);
    });
  };
};

/**
 * Hook to conditionally execute one or another set of hooks using function chaining.
 *
 * @param {Function|Promise|boolean} ifFcn - Predicate function(hook).
 * @param {Array.function} rest - Hook functions to execute when ifFcn is truthy.
 * @returns {Function} iffWithoutElse
 *
 * Examples:
 * iff(isServer, hookA, hookB)
 *   .else(hookC)
 *
 * iff(isServer,
 *   hookA,
 *   iff(isProvider('rest'), hook1, hook2, hook3)
 *     .else(hook4, hook5),
 *   hookB
 * )
 *   .else(
 *     iff(hook => hook.method === 'create', hook6, hook7)
 *   )
 */

var iff = exports.iff = function iff(ifFcn) {
  for (var _len2 = arguments.length, rest = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    rest[_key2 - 1] = arguments[_key2];
  }

  var trueHooks = [].concat(rest);

  var iffWithoutElse = function iffWithoutElse(hook) {
    return iffElse(ifFcn, trueHooks, null).call(this, hook);
  };
  iffWithoutElse.else = function () {
    for (var _len3 = arguments.length, falseHooks = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      falseHooks[_key3] = arguments[_key3];
    }

    return iffElse(ifFcn, trueHooks, falseHooks);
  };

  return iffWithoutElse;
};

/**
 * Alias for iff
 */

var when = exports.when = iff;

/**
 * Hook that executes a set of hooks and returns true if at least one of
 * the hooks returns a truthy value and false if none of them do.
 *
 * @param {Array.function} rest - Hook functions to execute.
 * @returns {Boolean}
 *
 * Example 1
 * service.before({
 *   create: hooks.iff(hooks.some(hook1, hook2, ...), hookA, hookB, ...)
 * });
 *
 * Example 2 - called within a custom hook function
 * function (hook) {
 *   ...
 *   hooks.some(hook1, hook2, ...).call(this, currentHook)
 *     .then(bool => { ... });
 * }
 */

var some = exports.some = function some() {
  for (var _len4 = arguments.length, rest = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
    rest[_key4] = arguments[_key4];
  }

  return function (hook) {
    var _this2 = this;

    var hooks = rest.map(function (fn) {
      return fn.call(_this2, hook);
    });

    return Promise.all(hooks).then(function (results) {
      return Promise.resolve(results.some(function (result) {
        return !!result;
      }));
    });
  };
};

/**
 * Hook that executes a set of hooks and returns true if all of
 * the hooks returns a truthy value and false if one of them does not.
 *
 * @param {Array.function} rest - Hook functions to execute.
 * @returns {Boolean}
 *
 * Example 1
 * service.before({
 *    create: hooks.iff(hooks.every(hook1, hook2, ...), hookA, hookB, ...)
 * });
 *
 * Example 2 - called within a custom hook function
 * function (hook) {
 *   ...
 *   hooks.every(hook1, hook2, ...).call(this, currentHook)
 *     .then(bool => { ... })
 * }
 */

var every = exports.every = function every() {
  for (var _len5 = arguments.length, rest = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
    rest[_key5] = arguments[_key5];
  }

  return function (hook) {
    var _this3 = this;

    var hooks = rest.map(function (fn) {
      return fn.call(_this3, hook);
    });

    return Promise.all(hooks).then(function (results) {
      return Promise.resolve(results.every(function (result) {
        return !!result;
      }));
    });
  };
};

/**
 * Hook to conditionally execute one or another set of hooks using function chaining.
 * if the predicate hook function returns a falsey value.
 * Equivalent to iff(isNot(isProvider), hook1, hook2, hook3).
 *
 * @param {Function|Promise|boolean} unlessFcn - Predicate function(hook).
 * @param {Array.function} rest - Hook functions to execute when unlessFcn is falsey.
 * @returns {Function} iffWithoutElse
 *
 * Examples:
 * unless(isServer, hookA, hookB)
 *
 * unless(isServer,
 *   hookA,
 *   unless(isProvider('rest'), hook1, hook2, hook3),
 *   hookB
 * )
 */
var unless = exports.unless = function unless(unlessFcn) {
  for (var _len6 = arguments.length, rest = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
    rest[_key6 - 1] = arguments[_key6];
  }

  if (typeof unlessFcn === 'function') {
    return iff.apply(undefined, [isNot(unlessFcn)].concat(rest));
  }

  return iff.apply(undefined, [!unlessFcn].concat(rest));
};

/**
 * Predicate to check what called the service method.
 *
 * @param {string} [providers] - Providers permitted
 *    'server' = service method called from server,
 *    'external' = any external access,
 *    string = that provider e.g. 'rest',
 * @returns {boolean} whether the service method was called by one of the [providers].
 */
var isProvider = exports.isProvider = function isProvider() {
  for (var _len7 = arguments.length, providers = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
    providers[_key7] = arguments[_key7];
  }

  if (!providers.length) {
    throw new errors.MethodNotAllowed('Calling iff() predicate incorrectly. (isProvider)');
  }

  return function (hook) {
    // allow bind
    var hookProvider = (hook.params || {}).provider;

    return providers.some(function (provider) {
      return provider === hookProvider || provider === 'server' && !hookProvider || provider === 'external' && hookProvider;
    });
  };
};

/**
 * Negate a predicate.
 *
 * @param {Function} predicate - returns a boolean or a promise resolving to a boolean.
 * @returns {boolean} the not of the predicate result.
 *
 * const hooks, { iff, isNot, isProvider } from 'feathers-hooks-common';
 * iff(isNot(isProvider('rest')), hooks.remove( ... ));
 */
var isNot = exports.isNot = function isNot(predicate) {
  if (typeof predicate !== 'function') {
    throw new errors.MethodNotAllowed('Expected function as param. (isNot)');
  }

  return function (hook) {
    var result = predicate(hook); // Should we pass a clone? (safety vs performance)

    if (!result || typeof result.then !== 'function') {
      return !result;
    }

    return result.then(function (result1) {
      return !result1;
    });
  };
};

/**
 * Traverse objects and modifies values in place
 *
 * @param {function} converter - conversion function(node).
 *    See details at https://github.com/substack/js-traverse
 * @param {function|object?} getObj - object or function(hook) to get object. Optional.
 *    Default is items in hook.data or hook.result.
 *
 * Example - trim strings
 * const trimmer = function (node) {
 *   if (typeof node === 'string') { this.update(node.trim()); }
 * };
 * service.before({ create: traverse(trimmer) });
 *
 * Example - REST HTTP request uses string 'null' in query. Replace them with value null.
 * const nuller = function (node) {
 *   if (node === 'null') { this.update(null); }
 * };
 * service.before({ find: traverse(nuller, hook => hook.params.query) });
 *
 */
var traverse = exports.traverse = function traverse(converter, getObj) {
  return function (hook) {
    if (typeof getObj === 'function') {
      var items = getObj(hook);
    } else {
      items = getObj || (0, _utils.getItems)(hook);
    }

    (Array.isArray(items) ? items : [items]).forEach(function (item) {
      traverser(item).forEach(converter); // replacement is in place
    });

    return hook;
  };
};