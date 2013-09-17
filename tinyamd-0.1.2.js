/*!
 * HeadJS     The only script in your <HEAD>    
 * Author     Tero Piirainen  (tipiirai)
 * Maintainer Robert Hoffmann (itechnology)
 * License    MIT / http://bit.ly/mit-license
 *
 * Version 0.99
 * http://headjs.com
 */
; (function (win, undefined) {
    "use strict";

    var doc = win.document,
        domWaiters = [],
        queue      = [], // waiters for the "head ready" event
        handlers   = {}, // user functions waiting for events
        assets     = {}, // loadable items in various states
        isAsync    = "async" in doc.createElement("script") || "MozAppearance" in doc.documentElement.style || win.opera,
        isHeadReady,
        isDomReady,

        /*** public API ***/
        headVar = win.head_conf && win.head_conf.head || "head",
        api     = win[headVar] = (win[headVar] || function () { api.ready.apply(null, arguments); }),

        // states
        PRELOADING = 1,
        PRELOADED  = 2,
        LOADING    = 3,
        LOADED     = 4;

    // Method 1: simply load and let browser take care of ordering
    if (isAsync) {
        api.load = function () {
            ///<summary>
            /// INFO: use cases
            ///    head.load("http://domain.com/file.js","http://domain.com/file.js", callBack)
            ///    head.load({ label1: "http://domain.com/file.js" }, { label2: "http://domain.com/file.js" }, callBack)
            ///</summary> 
            var args      = arguments,
                 callback = args[args.length - 1],
                 items    = {};

            if (!isFunction(callback)) {
                callback = null;
            }

            each(args, function (item, i) {
                if (item !== callback) {
                    item             = getAsset(item);
                    items[item.name] = item;

                    load(item, callback && i === args.length - 2 ? function () {
                        if (allLoaded(items)) {
                            one(callback);
                        }

                    } : null);
                }
            });

            return api;
        };


    // Method 2: preload with text/cache hack
    } else {
        api.load = function () {
            var args = arguments,
                rest = [].slice.call(args, 1),
                next = rest[0];

            // wait for a while. immediate execution causes some browsers to ignore caching
            if (!isHeadReady) {
                queue.push(function () {
                    api.load.apply(null, args);
                });

                return api;
            }            

            // multiple arguments
            if (!!next) {
                /* Preload with text/cache hack (not good!)
                 * http://blog.getify.com/on-script-loaders/
                 * http://www.nczonline.net/blog/2010/12/21/thoughts-on-script-loaders/
                 * If caching is not configured correctly on the server, then items could load twice !
                 *************************************************************************************/
                each(rest, function (item) {
                    if (!isFunction(item)) {
                        preLoad(getAsset(item));
                    }
                });

                // execute
                load(getAsset(args[0]), isFunction(next) ? next : function () {
                    api.load.apply(null, rest);
                });                
            }
            else {
                // single item
                load(getAsset(args[0]));
            }

            return api;
        };
    }

    // INFO: for retro compatibility
    api.js = api.load;
    
    api.test = function (test, success, failure, callback) {
        ///<summary>
        /// INFO: use cases:
        ///    head.test(condition, null       , "file.NOk" , callback);
        ///    head.test(condition, "fileOk.js", null       , callback);        
        ///    head.test(condition, "fileOk.js", "file.NOk" , callback);
        ///    head.test(condition, "fileOk.js", ["file.NOk", "file.NOk"], callback);
        ///    head.test({
        ///               test    : condition,
        ///               success : [{ label1: "file1Ok.js"  }, { label2: "file2Ok.js" }],
        ///               failure : [{ label1: "file1NOk.js" }, { label2: "file2NOk.js" }],
        ///               callback: callback
        ///    );  
        ///    head.test({
        ///               test    : condition,
        ///               success : ["file1Ok.js" , "file2Ok.js"],
        ///               failure : ["file1NOk.js", "file2NOk.js"],
        ///               callback: callback
        ///    );         
        ///</summary>    
        var obj = (typeof test === 'object') ? test : {
            test: test,
            success: !!success ? isArray(success) ? success : [success] : false,
            failure: !!failure ? isArray(failure) ? failure : [failure] : false,
            callback: callback || noop
        };

        // Test Passed ?
        var passed = !!obj.test;

        // Do we have a success case
        if (passed && !!obj.success) {
            obj.success.push(obj.callback);
            api.load.apply(null, obj.success);
        }
            // Do we have a fail case
        else if (!passed && !!obj.failure) {
            obj.failure.push(obj.callback);
            api.load.apply(null, obj.failure);
        }
        else {
            callback();
        }

        return api;
    };

    api.ready = function (key, callback) {
        ///<summary>
        /// INFO: use cases:
        ///    head.ready(callBack)
        ///    head.ready(document , callBack)
        ///    head.ready("file.js", callBack);
        ///    head.ready("label"  , callBack);        
        ///</summary>

        // DOM ready check: head.ready(document, function() { });
        if (key === doc) {
            if (isDomReady) {
                one(callback);
            }
            else {
                domWaiters.push(callback);
            }

            return api;
        }

        // shift arguments
        if (isFunction(key)) {
            callback = key;
            key      = "ALL";
        }

        // make sure arguments are sane
        if (typeof key !== 'string' || !isFunction(callback)) {
            return api;
        }

        // This can also be called when we trigger events based on filenames & labels
        var asset = assets[key];

        // item already loaded --> execute and return
        if (asset && asset.state === LOADED || key === 'ALL' && allLoaded() && isDomReady) {
            one(callback);
            return api;
        }

        var arr = handlers[key];
        if (!arr) {
            arr = handlers[key] = [callback];
        }
        else {
            arr.push(callback);
        }

        return api;
    };


    // perform this when DOM is ready
    api.ready(doc, function () {

        if (allLoaded()) {
            each(handlers.ALL, function (callback) {
                one(callback);
            });
        }

        if (api.feature) {
            api.feature("domloaded", true);
        }
    });


    /* private functions
    *********************/
    function noop() {
        // does nothing
    }

    function each(arr, callback) {
        if (!arr) {
            return;
        }

        // arguments special type
        if (typeof arr === 'object') {
            arr = [].slice.call(arr);
        }

        // do the job
        for (var i = 0, l = arr.length; i < l; i++) {
            callback.call(arr, arr[i], i);
        }
    }

    /* A must read: http://bonsaiden.github.com/JavaScript-Garden
     ************************************************************/
    function is(type, obj) {
        var clas = Object.prototype.toString.call(obj).slice(8, -1);
        return obj !== undefined && obj !== null && clas === type;
    }

    function isFunction(item) {
        return is("Function", item);
    }

    function isArray(item) {
        return is("Array", item);
    }

    function toLabel(url) {
        ///<summary>Converts a url to a file label</summary>
        var items = url.split("/"),
             name = items[items.length - 1],
             i    = name.indexOf("?");

        return i !== -1 ? name.substring(0, i) : name;
    }

    // INFO: this look like a "im triggering callbacks all over the place, but only wanna run it one time function" ..should try to make everything work without it if possible
    // INFO: Even better. Look into promises/defered's like jQuery is doing
    function one(callback) {
        ///<summary>Execute a callback only once</summary>
        callback = callback || noop;

        if (callback._done) {
            return;
        }

        callback();
        callback._done = 1;
    }

    function getAsset(item) {
        ///<summary>
        /// Assets are in the form of
        /// { 
        ///     name : label,
        ///     url  : url,
        ///     state: state
        /// }
        ///</summary>
        var asset = {};

        if (typeof item === 'object') {
            for (var label in item) {
                if (!!item[label]) {
                    asset = {
                        name: label,
                        url : item[label]
                    };
                }
            }
        }
        else {
            asset = {
                name: toLabel(item),
                url : item
            };
        }

        // is the item already existant
        var existing = assets[asset.name];
        if (existing && existing.url === asset.url) {
            return existing;
        }

        assets[asset.name] = asset;
        return asset;
    }

    function allLoaded(items) {
        items = items || assets;

        for (var name in items) {
            if (items.hasOwnProperty(name) && items[name].state !== LOADED) {
                return false;
            }
        }
        
        return true;
    }


    function onPreload(asset) {
        asset.state = PRELOADED;

        each(asset.onpreload, function (afterPreload) {
            afterPreload.call();
        });
    }

    function preLoad(asset, callback) {
        if (asset.state === undefined) {

            asset.state     = PRELOADING;
            asset.onpreload = [];

            loadAsset({ url: asset.url, type: 'cache' }, function () {
                onPreload(asset);
            });
        }
    }

    function load(asset, callback) {
        ///<summary>Used with normal loading logic</summary>
        callback = callback || noop;

        if (asset.state === LOADED) {
            callback();
            return;
        }

        // INFO: why would we trigger a ready event when its not really loaded yet ?
        if (asset.state === LOADING) {
            api.ready(asset.name, callback);
            return;
        }

        if (asset.state === PRELOADING) {
            asset.onpreload.push(function () {
                load(asset, callback);
            });
            return;
        }

        asset.state = LOADING;
        
        loadAsset(asset, function () {
            asset.state = LOADED;
            callback();

            // handlers for this asset
            each(handlers[asset.name], function (fn) {
                one(fn);
            });

            // dom is ready & no assets are queued for loading
            // INFO: shouldn't we be doing the same test above ?
            if (isDomReady && allLoaded()) {
                each(handlers.ALL, function (fn) {
                    one(fn);
                });
            }
        });
    }

    /* Parts inspired from: https://github.com/cujojs/curl
    ******************************************************/
    function loadAsset(asset, callback) {
        callback = callback || noop;

        var ele;
        if (/\.css[^\.]*$/.test(asset.url)) {
            ele      = doc.createElement('link');
            ele.type = 'text/' + (asset.type || 'css');
            ele.rel  = 'stylesheet';
            ele.href = asset.url;
        }
        else {
            ele      = doc.createElement('script');
            ele.type = 'text/' + (asset.type || 'javascript');
            ele.src  = asset.url;
        }

        ele.onload  = ele.onreadystatechange = process;
        ele.onerror = error;

        /* Good read, but doesn't give much hope !
         * http://blog.getify.com/on-script-loaders/
         * http://www.nczonline.net/blog/2010/12/21/thoughts-on-script-loaders/
         * https://hacks.mozilla.org/2009/06/defer/
         */

        // ASYNC: load in parellel and execute as soon as possible
        ele.async = false;
        // DEFER: load in parallel but maintain execution order
        ele.defer = false;

        function error(event) {
            event = event || win.event;
            
            // need some more detailed error handling here

            // release event listeners
            ele.onload = ele.onreadystatechange = ele.onerror = null;
                        
            // do callback
            callback();
        }

        function process(event) {
            event = event || win.event;

            // IE 7/8 (2 events on 1st load)
            // 1) event.type = readystatechange, s.readyState = loading
            // 2) event.type = readystatechange, s.readyState = loaded

            // IE 7/8 (1 event on reload)
            // 1) event.type = readystatechange, s.readyState = complete 

            // event.type === 'readystatechange' && /loaded|complete/.test(s.readyState)

            // IE 9 (3 events on 1st load)
            // 1) event.type = readystatechange, s.readyState = loading
            // 2) event.type = readystatechange, s.readyState = loaded
            // 3) event.type = load            , s.readyState = loaded

            // IE 9 (2 events on reload)
            // 1) event.type = readystatechange, s.readyState = complete 
            // 2) event.type = load            , s.readyState = complete 

            // event.type === 'load'             && /loaded|complete/.test(s.readyState)
            // event.type === 'readystatechange' && /loaded|complete/.test(s.readyState)

            // IE 10 (3 events on 1st load)
            // 1) event.type = readystatechange, s.readyState = loading
            // 2) event.type = load            , s.readyState = complete
            // 3) event.type = readystatechange, s.readyState = loaded

            // IE 10 (3 events on reload)
            // 1) event.type = readystatechange, s.readyState = loaded
            // 2) event.type = load            , s.readyState = complete
            // 3) event.type = readystatechange, s.readyState = complete 

            // event.type === 'load'             && /loaded|complete/.test(s.readyState)
            // event.type === 'readystatechange' && /complete/.test(s.readyState)

            // Other Browsers (1 event on 1st load)
            // 1) event.type = load, s.readyState = undefined

            // Other Browsers (1 event on reload)
            // 1) event.type = load, s.readyState = undefined            

            // event.type == 'load' && s.readyState = undefined


            // !doc.documentMode is for IE6/7, IE8+ have documentMode
            if (event.type === 'load' || (/loaded|complete/.test(ele.readyState) && (!doc.documentMode || doc.documentMode < 9))) {
                // release event listeners               
                ele.onload = ele.onreadystatechange = ele.onerror = null;

                // do callback
                callback();
            }

            // emulates error on browsers that don't create an exception
            // INFO: timeout not clearing ..why ?
            //asset.timeout = win.setTimeout(function () {
            //    error({ type: "timeout" });
            //}, 3000);
        }

        // use insertBefore to keep IE from throwing Operation Aborted (thx Bryan Forbes!)
        var head = doc['head'] || doc.getElementsByTagName('head')[0];
        // but insert at end of head, because otherwise if it is a stylesheet, it will not ovverride values
        head.insertBefore(ele, head.lastChild);
    }

    /* Mix of stuff from jQuery & IEContentLoaded
     * http://dev.w3.org/html5/spec/the-end.html#the-end
     ***************************************************/
    function domReady() {
        // Make sure body exists, at least, in case IE gets a little overzealous (jQuery ticket #5443).
        if (!doc.body) {
            // let's not get nasty by setting a timeout too small.. (loop mania guaranteed if assets are queued)
            win.clearTimeout(api.readyTimeout);
            api.readyTimeout = win.setTimeout(domReady, 50);
            return;
        }

        if (!isDomReady) {
            isDomReady = true;
            each(domWaiters, function (fn) {
                one(fn);
            });
        }
    }

    function domContentLoaded() {
        // W3C
        if (doc.addEventListener) {
            doc.removeEventListener("DOMContentLoaded", domContentLoaded, false);
            domReady();
        }

        // IE
        else if (doc.readyState === "complete") {
            // we're here because readyState === "complete" in oldIE
            // which is good enough for us to call the dom ready!            
            doc.detachEvent("onreadystatechange", domContentLoaded);
            domReady();
        }
    };

    // Catch cases where ready() is called after the browser event has already occurred.
    // we once tried to use readyState "interactive" here, but it caused issues like the one
    // discovered by ChrisS here: http://bugs.jquery.com/ticket/12282#comment:15    
    if (doc.readyState === "complete") {
        domReady();
    }

    // W3C
    else if (doc.addEventListener) {
        doc.addEventListener("DOMContentLoaded", domContentLoaded, false);

        // A fallback to window.onload, that will always work
        win.addEventListener("load", domReady, false);
    }

    // IE
    else {
        // Ensure firing before onload, maybe late but safe also for iframes
        doc.attachEvent("onreadystatechange", domContentLoaded);

        // A fallback to window.onload, that will always work
        win.attachEvent("onload", domReady);

        // If IE and not a frame
        // continually check to see if the document is ready
        var top = false;

        try {
            top = win.frameElement == null && doc.documentElement;
        } catch (e) { }

        if (top && top.doScroll) {
            (function doScrollCheck() {
                if (!isDomReady) {
                    try {
                        // Use the trick by Diego Perini
                        // http://javascript.nwbox.com/IEContentLoaded/
                        top.doScroll("left");
                    } catch (error) {
                        // let's not get nasty by setting a timeout too small.. (loop mania guaranteed if assets are queued)
                        win.clearTimeout(api.readyTimeout);
                        api.readyTimeout = win.setTimeout(doScrollCheck, 50);
                        return;
                    }

                    // and execute any waiting functions
                    domReady();
                }
            })();
        }
    }

    /*
        We wait for 300 ms before asset loading starts. for some reason this is needed
        to make sure assets are cached. Not sure why this happens yet. A case study:

        https://github.com/headjs/headjs/issues/closed#issue/83
    */
    setTimeout(function () {
        isHeadReady = true;
        each(queue, function (fn) {
            fn();
        });

    }, 300);

})(window);
(function() {
  var baseUrl, config, _defined, _defining, _each, _load_module, _loaded, _loading, _map, _normalize, _on_defined, _parallel, _ref, _require, _waiting,
    __slice = [].slice;

  config = {};

  baseUrl = (_ref = window.tinyamd_config) != null ? _ref : '';

  if (baseUrl.charAt(baseUrl.length - 1) !== '/') {
    baseUrl += '/';
  }

  _defined = {};

  _waiting = {};

  _defining = {};

  _each = [].forEach != null ? function(a, c, b) {
    return a.forEach(c, b);
  } : function(a, c, b) {
    _map(a, c, b);
    return null;
  };

  _map = [].map == null ? function(a, c, b) {
    return a.map(c, b);
  } : function(a, c, b) {
    var i, results, x, _i, _len;

    results = [];
    for (i = _i = 0, _len = a.length; _i < _len; i = ++_i) {
      x = a[i];
      results.push(c.call(b || this, x, i));
    }
    return results;
  };

  _parallel = function(tasks, callback) {
    var results, succeeded;

    succeeded = 0;
    results = [];
    if (tasks.length === 0) {
      return callback(void 0, results);
    }
    return _each(tasks, function(task, i) {
      return task.call(this, function(err, result) {
        if (err != null) {
          succeeded = -1;
          return callback(err);
        }
        results[i] = result;
        if ((succeeded += 1) === tasks.length) {
          return callback(void 0, results);
        }
      });
    });
  };

  _normalize = function(name, base) {
    var i, p, parts, _i, _ref1;

    if (base) {
      parts = (p = base.split('/')).slice(0, p.length - 1).concat(name.split('/'));
      name = [];
      for (i = _i = _ref1 = parts.length - 1; _i >= 0; i = _i += -1) {
        if (parts[i] === '..' && i > 0) {
          i -= 1;
          break;
        }
        if (parts[i] !== '.') {
          name.unshift(parts[i]);
        }
      }
      name = name.join('/');
    } else if (name.indexOf('./') === 0) {
      name = name.substring(2);
    }
    return name;
  };

  _loading = {};

  _loaded = {};

  _on_defined = {};

  _load_module = function(nid, callback) {
    if (_loading[nid]) {
      _on_defined[nid].push(callback);
    } else {
      _loading[nid] = true;
      _on_defined[nid] = [callback];
      return head.js("" + baseUrl + nid + ".js", function() {
        _loaded[nid] = true;
        return window.setTimeout((function() {
          return _require([nid], function(module) {
            return _each(_on_defined[nid], function(callback) {
              return callback(module);
            });
          });
        }), 10);
      });
    }
  };

  _require = function(__id_or_ids, callback) {
    var args, id, ids, module_dep_names, module_factory, module_factory_args, module_name, tasks;

    if (callback != null) {
      ids = __id_or_ids;
      tasks = _map(ids, function(id) {
        return function(task_callback) {
          var args, module_dep_nids, module_factory, module_name;

          if (_defined[id]) {
            return task_callback(void 0, _defined[id]);
          } else if ((args = _waiting[id])) {
            delete _waiting[id];
            module_name = args[0];
            module_dep_nids = _map(args[1] || [], function(did) {
              return _normalize(did, id);
            });
            module_factory = args[2];
            return _require(module_dep_nids, function() {
              var module_dependencies;

              module_dependencies = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
              _defined[id] = module_factory.apply(this, module_dependencies);
              return task_callback(void 0, _defined[id]);
            });
          } else {
            if (_loaded[id]) {
              return task_callback("unable to load module " + id + " remotely");
            } else {
              return _load_module(id, function(module) {
                return task_callback(void 0, module);
              });
            }
          }
        };
      });
      return _parallel(tasks, function(err, modules) {
        if (err != null) {
          throw new Error(err);
        }
        return callback.apply(this, modules);
      });
    } else {
      id = __id_or_ids;
      if (!_defined[id] && (args = _waiting[id])) {
        delete _waiting[id];
        module_name = args[0];
        module_dep_names = args[1] || [];
        module_factory = args[2];
        module_factory_args = _map(module_dep_names, function(dep_name) {
          return _require(_normalize(dep_name));
        });
        _defined[id] = module_factory.apply(this, module_factory_args);
      }
      return _defined[id];
    }
  };

  window.require = function(id_or_ids, callback) {
    if (typeof id_or_ids === 'string') {
      return _require(id_or_ids) || (function() {
        throw new Error("missing module " + id_or_ids);
      })();
    } else if (id_or_ids.splice) {
      if (typeof callback !== 'function') {
        throw new Error("missing callback");
      }
      _require(id_or_ids, callback);
      return require;
    }
  };

  window.define = function(name, deps, factory) {
    if (!deps.splice) {
      factory = deps;
      deps = [];
    }
    if (!_defined[name] && !_waiting[name]) {
      return _waiting[name] = [name, deps, factory];
    }
  };

}).call(this);

(function() {
  var baseUrl, config, _defined, _defining, _each, _load_module, _loaded, _loading, _map, _normalize, _on_defined, _parallel, _ref, _require, _waiting,
    __slice = [].slice;

  config = {};

  baseUrl = (_ref = window.tinyamd_config) != null ? _ref : '';

  if (baseUrl.charAt(baseUrl.length - 1) !== '/') {
    baseUrl += '/';
  }

  _defined = {};

  _waiting = {};

  _defining = {};

  _each = [].forEach != null ? function(a, c, b) {
    return a.forEach(c, b);
  } : function(a, c, b) {
    _map(a, c, b);
    return null;
  };

  _map = [].map != null ? function(a, c, b) {
    return a.map(c, b);
  } : function(a, c, b) {
    var i, results, x, _i, _len;

    results = [];
    for (i = _i = 0, _len = a.length; _i < _len; i = ++_i) {
      x = a[i];
      results.push(c.call(b || this, x, i));
    }
    return results;
  };

  _parallel = function(tasks, callback) {
    var results, succeeded;

    succeeded = 0;
    results = [];
    if (tasks.length === 0) {
      return callback(void 0, results);
    }
    return _each(tasks, function(task, i) {
      return task.call(this, function(err, result) {
        if (err != null) {
          succeeded = -1;
          return callback(err);
        }
        results[i] = result;
        if ((succeeded += 1) === tasks.length) {
          return callback(void 0, results);
        }
      });
    });
  };

  _normalize = function(name, base) {
    var i, p, parts;

    parts = name.split('/');
    if (parts[0].indexOf('.') === 0) {
      if (base != null) {
        parts = (p = base.split('/')).slice(0, p.length - 1).concat(parts);
      }
      name = [];
      i = parts.length - 1;
      while (i >= 0) {
        if (parts[i] === '..') {
          i -= 1;
        } else {
          if (parts[i] !== '.') {
            name.unshift(parts[i]);
          }
        }
        i -= 1;
      }
      name = name.join('/');
    }
    return name;
  };

  _loading = {};

  _loaded = {};

  _on_defined = {};

  _load_module = function(nid, callback) {
    if (_loading[nid]) {
      _on_defined[nid].push(callback);
    } else {
      _loading[nid] = true;
      _on_defined[nid] = [callback];
      return head.js("" + baseUrl + nid + ".js", function() {
        _loaded[nid] = true;
        return window.setTimeout((function() {
          return _require([nid], function(module) {
            return _each(_on_defined[nid], function(callback) {
              return callback(module);
            });
          });
        }), 10);
      });
    }
  };

  _require = function(__id_or_ids, callback) {
    var args, id, ids, module_dep_names, module_factory, module_factory_args, module_name, tasks;

    if (callback != null) {
      ids = __id_or_ids;
      tasks = _map(ids, function(id) {
        return function(task_callback) {
          var args, module_dep_nids, module_factory, module_name;

          if (_defined[id]) {
            return task_callback(void 0, _defined[id]);
          } else if ((args = _waiting[id])) {
            delete _waiting[id];
            module_name = args[0];
            module_dep_nids = _map(args[1] || [], function(did) {
              return _normalize(did, id);
            });
            module_factory = args[2];
            return _require(module_dep_nids, function() {
              var module_dependencies;

              module_dependencies = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
              _defined[id] = module_factory.apply(this, module_dependencies);
              return task_callback(void 0, _defined[id]);
            });
          } else {
            if (_loaded[id]) {
              return task_callback("unable to load module " + id + " remotely");
            } else {
              return _load_module(id, function(module) {
                return task_callback(void 0, module);
              });
            }
          }
        };
      });
      return _parallel(tasks, function(err, modules) {
        if (err != null) {
          throw new Error(err);
        }
        return callback.apply(this, modules);
      });
    } else {
      id = __id_or_ids;
      if (id === 'require') {
        return _require;
      }
      if (!_defined[id] && (args = _waiting[id])) {
        delete _waiting[id];
        module_name = args[0];
        module_dep_names = args[1] || [];
        module_factory = args[2];
        module_factory_args = _map(module_dep_names, function(dep_name) {
          return _require(_normalize(dep_name, module_name));
        });
        _defined[id] = module_factory.apply(this, module_factory_args);
      }
      return _defined[id];
    }
  };

  window.require = function(id_or_ids, callback) {
    if (typeof id_or_ids === 'string') {
      return _require(id_or_ids) || (function() {
        throw new Error("missing module " + id_or_ids);
      })();
    } else if (id_or_ids.splice) {
      if (typeof callback !== 'function') {
        throw new Error("missing callback");
      }
      _require(id_or_ids, callback);
      return require;
    }
  };

  window.define = function(name, deps, factory) {
    if (!deps.splice) {
      factory = deps;
      deps = [];
    }
    if (!_defined[name] && !_waiting[name]) {
      return _waiting[name] = [name, deps, factory];
    }
  };

  window.define.amd = {};

}).call(this);

(function() {
  var baseUrl, config, _defined, _defining, _each, _load_module, _loaded, _loading, _map, _normalize, _on_defined, _parallel, _ref, _require, _waiting,
    __slice = [].slice;

  config = {};

  baseUrl = (_ref = window.tinyamd_config) != null ? _ref : '';

  if (baseUrl.charAt(baseUrl.length - 1) !== '/') {
    baseUrl += '/';
  }

  _defined = {};

  _waiting = {};

  _defining = {};

  _each = [].forEach != null ? function(a, c, b) {
    return a.forEach(c, b);
  } : function(a, c, b) {
    _map(a, c, b);
    return null;
  };

  _map = [].map != null ? function(a, c, b) {
    return a.map(c, b);
  } : function(a, c, b) {
    var i, results, x, _i, _len;

    results = [];
    for (i = _i = 0, _len = a.length; _i < _len; i = ++_i) {
      x = a[i];
      results.push(c.call(b || this, x, i));
    }
    return results;
  };

  _parallel = function(tasks, callback) {
    var results, succeeded;

    succeeded = 0;
    results = [];
    if (tasks.length === 0) {
      return callback(void 0, results);
    }
    return _each(tasks, function(task, i) {
      return task.call(this, function(err, result) {
        if (err != null) {
          succeeded = -1;
          return callback(err);
        }
        results[i] = result;
        if ((succeeded += 1) === tasks.length) {
          return callback(void 0, results);
        }
      });
    });
  };

  _normalize = function(name, base) {
    var i, p, parts;

    parts = name.split('/');
    if (parts[0].indexOf('.') === 0) {
      if (base != null) {
        parts = (p = base.split('/')).slice(0, p.length - 1).concat(parts);
      }
      name = [];
      i = parts.length - 1;
      while (i >= 0) {
        if (parts[i] === '..') {
          i -= 1;
        } else {
          if (parts[i] !== '.') {
            name.unshift(parts[i]);
          }
        }
        i -= 1;
      }
      name = name.join('/');
    }
    return name;
  };

  _loading = {};

  _loaded = {};

  _on_defined = {};

  _load_module = function(nid, callback) {
    if (_loading[nid]) {
      _on_defined[nid].push(callback);
    } else {
      _loading[nid] = true;
      _on_defined[nid] = [callback];
      return head.js("" + baseUrl + nid + ".js", function() {
        _loaded[nid] = true;
        return window.setTimeout((function() {
          return _require([nid], function(module) {
            return _each(_on_defined[nid], function(callback) {
              return callback(module);
            });
          });
        }), 10);
      });
    }
  };

  _require = function(__id_or_ids, callback) {
    var args, id, ids, module_dep_names, module_factory, module_factory_args, module_name, tasks;

    if (callback != null) {
      ids = __id_or_ids;
      tasks = _map(ids, function(id) {
        return function(task_callback) {
          var args, module_dep_nids, module_factory, module_name;

          if (_defined[id]) {
            return task_callback(void 0, _defined[id]);
          } else if ((args = _waiting[id])) {
            delete _waiting[id];
            module_name = args[0];
            module_dep_nids = _map(args[1] || [], function(did) {
              return _normalize(did, id);
            });
            module_factory = args[2];
            return _require(module_dep_nids, function() {
              var module_dependencies;

              module_dependencies = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
              _defined[id] = module_factory.apply(this, module_dependencies);
              return task_callback(void 0, _defined[id]);
            });
          } else {
            if (_loaded[id]) {
              return task_callback("unable to load module " + id + " remotely");
            } else {
              return _load_module(id, function(module) {
                return task_callback(void 0, module);
              });
            }
          }
        };
      });
      return _parallel(tasks, function(err, modules) {
        if (err != null) {
          throw new Error(err);
        }
        return callback.apply(this, modules);
      });
    } else {
      id = __id_or_ids;
      if (id === 'require') {
        return _require;
      }
      if (!_defined[id] && (args = _waiting[id])) {
        delete _waiting[id];
        module_name = args[0];
        module_dep_names = args[1] || [];
        module_factory = args[2];
        module_factory_args = _map(module_dep_names, function(dep_name) {
          return _require(_normalize(dep_name, module_name));
        });
        _defined[id] = module_factory.apply(this, module_factory_args);
      }
      return _defined[id];
    }
  };

  window.require = function(id_or_ids, callback) {
    if (typeof id_or_ids === 'string') {
      return _require(id_or_ids) || (function() {
        throw new Error("missing module " + id_or_ids);
      })();
    } else if (id_or_ids.splice) {
      if (typeof callback !== 'function') {
        throw new Error("missing callback");
      }
      _require(id_or_ids, callback);
      return require;
    }
  };

  window.define = function(name, deps, factory) {
    if (!deps.splice) {
      factory = deps;
      deps = [];
    }
    if (!_defined[name] && !_waiting[name]) {
      return _waiting[name] = [name, deps, factory];
    }
  };

  window.define.amd = {};

}).call(this);
