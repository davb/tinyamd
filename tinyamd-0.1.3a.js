(function(exports) {
  var def, req, _definitions, _modules, _path_to_absolute, _req, _req_rel, _resolving, _root, _validate_define_arguments, _validate_require_arguments;

  _validate_define_arguments = function(args) {
    var pass;

    pass = (args.length >= 2) && (args.length < 4) && (typeof args[0] === 'string');
    if (!pass) {
      throw new Error("invalid arguments for define", args);
    }
  };
  _validate_require_arguments = function(args) {
    var pass;

    pass = (args.length === 1) && (typeof args[0] === 'string');
    if (!pass) {
      throw new Error("invalid arguments for require", args);
    }
  };
  _definitions = {};
  def = function(path, deps, factory) {
    _validate_define_arguments(arguments);
    if (arguments.length === 2) {
      factory = deps;
      deps = [];
    }
    return _definitions[_root(path)] = [deps, factory];
  };
  def.amd = {};
  _root = function(path) {
    if (path[0] === '/') {
      return path;
    } else {
      return '/' + path;
    }
  };
  _path_to_absolute = function(path, base) {
    var b, e, p;

    if (path[0] !== '.') {
      return _root(path);
    }
    base = _root(base);
    base = base.split('/');
    path = path.split('/');
    b = base.length;
    p = 0;
    while ((e = path[p])[0] === '.') {
      if (e === '..') {
        b -= 2;
      }
      if (e === '.') {
        b -= 1;
      }
      p += 1;
    }
    return base.slice(0, b).concat(path.slice(p)).join('/');
  };
  _modules = {};
  _resolving = {};
  _req = function(absolute_path) {
    var d, definition, m, module, resolved_deps, _i, _len, _ref;

    if ((m = _modules[absolute_path])) {
      return _modules[absolute_path];
    }
    if (_resolving[absolute_path]) {
      throw new Error("circular dependency detected");
    }
    if (!(definition = _definitions[absolute_path])) {
      throw new Error("missing module " + (absolute_path.substr(1)));
    }
    _resolving[absolute_path] = 1;
    resolved_deps = [];
    _ref = definition[0];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      d = _ref[_i];
      resolved_deps.push(_req_rel(d, absolute_path));
    }
    _modules[absolute_path] = module = definition[1].apply(this, resolved_deps);
    delete _resolving[absolute_path];
    return module;
  };
  _req_rel = function(path, root) {
    if (path === 'require') {
      return function(p) {
        return _req_rel(p, root);
      };
    }
    return _req(_path_to_absolute(path, root));
  };
  req = function(path) {
    _validate_require_arguments(arguments);
    return _req(_root(path));
  };
  exports.define = def;
  exports.require = req;
  return {
    define: def,
    require: req
  };
})(typeof exports === 'undefined' && this || exports);
