((exports) ->


  _validate_define_arguments = (args) ->
    pass = (args.length >= 2) && (args.length < 4) &&
      (typeof args[0] is 'string')
    throw new Error "invalid arguments for define", args if !pass


  _validate_require_arguments = (args) ->
    pass = (args.length == 1) &&
      (typeof args[0] is 'string')
    throw new Error "invalid arguments for require", args if !pass


  # helper function to get the first character of a string
  _first_char = (s) -> s.charAt 0


  # modules defined by the `define` function are stored here
  # as [path, deps, factory]
  # where
  #   - path is the absolute path of the module
  #   - deps is an array of relative or absolute paths of the dependencies
  #   - factory is the factory function that returns the module
  _definitions = {}


  # defines a module
  # accepts the following arguments
  #     path, deps, factory
  # or  path, factory
  # where
  #   - path is a string
  #   - deps is an array
  #   - factory is a function
  def = (path, deps, factory) ->
    _validate_define_arguments arguments
    if arguments.length == 2
      factory = deps
      deps = []
    _definitions[_root path] = [deps, factory]


  # make it clear that def is an AMD `define` function
  def.amd = {}


  # 'roots' an absolute path, i.e. ensures it begins with '/'
  _root = (path) ->
    if _first_char(path) == '/' then path else '/' + path


  # turns a relative path into an absolute path, starting from the base
  _path_to_absolute = (path, base) ->
    unless _first_char(path) == '.'
      return _root path
    # ensure the root starts with '/'
    base = _root base
    base = base.split('/')
    path = path.split('/')
    b = base.length
    p = 0
    while _first_char(e = path[p]) == '.'
      b -= 2 if e == '..'
      b -= 1 if e == '.'
      p += 1
    base.slice(0, b).concat(path.slice(p)).join('/')

    
  # caches the modules which have already been factoried
  _modules = {}

  # keeps track of the modules that are being resolved
  _resolving = {}


  # private `require` function, accepts an absolute path
  _req = (absolute_path) ->
    # return the cached module if we have it
    if (m = _modules[absolute_path])
      return _modules[absolute_path]
    # if the module is already being resolved, we have a loop
    if _resolving[absolute_path]
      throw new Error "circular dependency detected"
    # if the module is undefined, throw an error
    if !(definition = _definitions[absolute_path])
      throw new Error "missing module #{absolute_path.substr(1)}"
    # otherwise we need to resolve the dependencies
    _resolving[absolute_path] = 1
    resolved_deps = []
    for d in definition[0]
      resolved_deps.push _req_rel(d, absolute_path)
    _modules[absolute_path] = module = definition[1].apply @, resolved_deps
    delete _resolving[absolute_path]
    module


  # private `require` function, accepts an absolute or relative path
  _req_rel = (path, root) ->
    # if the path is `require`, return a relative 'require' function
    if path == 'require'
      return (p) -> _req_rel(p, root)
    _req _path_to_absolute(path, root)
  

  # public `require` function, accepts an absolute path
  req = (path) ->
    _validate_require_arguments arguments
    _req _root(path)


  # export the define and require functions
  exports.define = def
  exports.require = req
  {define: def, require: req}

)(typeof exports is 'undefined' && @ || exports)
