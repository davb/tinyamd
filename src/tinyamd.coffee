# Configuration
config = {}
# Base URL for file paths
baseUrl = window.tinyamd_config ? ''
# Ensure Base URL ends with a '/'
baseUrl += '/' unless baseUrl.charAt(baseUrl.length - 1 ) == '/'


# All defined modules by their normalized name
_defined = {}

# Modules waiting to be loaded
_waiting = {}

# Modules being defined
_defining = {}


# Iterates over an array. Uses native Array.forEach if available
_each = if [].forEach? then (a, c, b) -> a.forEach(c, b) else (a, c, b) ->
  _map a, c, b
  null


# Maps over an array. Uses native Array.map if available
_map = if ![].map? then (a, c, b) -> a.map(c, b) else (a, c, b) ->
  results = []
  results.push c.call (b || @), x, i for x, i in a
  results


# Run an array of functions in parallel.
# If any of the functions pass an error to its callback, the main callback
# is immediately called with the value of the error as its first argument.
# Once all tasks have completed, the results are passed to the final callback
# as an array as its second argument.
_parallel = (tasks, callback) ->
  succeeded = 0
  results = []
  # if there are no task, consider it a success and immediately call callback
  return callback(undefined, results) if tasks.length == 0
  # otherwise, run all tasks in parallel, storing their results in order
  _each tasks, (task, i) ->
    task.call @, (err, result) ->
      if err?
        # an error occurred: immediately call the main callback
        succeeded = - 1 # the success callback will never get called
        return callback(err)
      # the task completed successfully
      results[i] = result
      callback(undefined, results) if (succeeded += 1) == tasks.length


# Normalize file path
_normalize = (name, base) ->  
  # split base on '/', drop the last element, and concat with split name
  # e.g.  `./name`, `/the/base`  -> `/the/./name`
  if base
    parts = (p=base.split('/')).slice(0, p.length-1).concat(name.split('/'))
    # remove dots : loop over parts in reverse order, skipping single dots and
    # 'jumping' double dots
    name = []
    for i in [parts.length-1..0] by -1
      # skip '..' part unless it's the first one
      if parts[i] == '..' && i > 0
        i -= 1
        break
      # prepend parts[i] at the beginning of name array, ignoring '.'
      name.unshift parts[i] unless parts[i] == '.'
    # done removing dots
    name = name.join('/')
  else if name.indexOf('./') == 0
    name = name.substring(2)
  name


_loading = {}
_loaded = {}
_on_defined = {}
# id is expected to be normalized
_load_module = (nid, callback) ->
  if _loading[nid]
    _on_defined[nid].push(callback)
    return
  else
    _loading[nid] = true
    _on_defined[nid] = [callback]
    head.js "#{baseUrl}#{nid}.js", ->
      _loaded[nid] = true
      window.setTimeout (->
        _require [nid], (module) ->
          _each _on_defined[nid], (callback) ->
            callback(module)
      ), 10


# we assume the id's passed to this function are normalized
_require = (__id_or_ids, callback) ->
  if callback?
    # we are loading several modules asynchronously
    ids = __id_or_ids
    tasks = _map ids, (id) ->
      (task_callback) ->
        if _defined[id]
          # module is defined: return it
          return task_callback(undefined, _defined[id])
        else if (args = _waiting[id])
          # module is waiting: call its factory function
          delete _waiting[id]
          module_name = args[0]
          module_dep_nids = _map (args[1] || []), (did) -> _normalize(did, id)
          module_factory = args[2]
          _require module_dep_nids, (module_dependencies...) ->
            _defined[id] = module_factory.apply @, module_dependencies
            task_callback(undefined, _defined[id])
        else
          # module is not available: load it remotely, or fail if loading has
          # already been attempted
          if _loaded[id]
            task_callback("unable to load module #{id} remotely")
          else
            _load_module id, (module) ->
              task_callback(undefined, module)
    # run tasks in parallel and retrieve modules
    _parallel tasks, (err, modules) ->
      throw new Error(err) if err?
      callback.apply @, modules
  else
    # we are loading a single module synchronously
    id = __id_or_ids
    if !_defined[id] && (args = _waiting[id])
      delete _waiting[id]
      module_name = args[0]
      module_dep_names = args[1] || []
      module_factory = args[2]
      module_factory_args = _map module_dep_names, (dep_name) ->
        _require _normalize(dep_name)
      _defined[id] = module_factory.apply @, module_factory_args
    return _defined[id]


# AMD `require` function
#
# - require(String)
# Synchronously returns the module export for the module ID represented by
# the String argument.
# Throws an error if the module has not been already loaded and evaluated.
# It does NOT try to dynamically fetch the module if not already loaded.
#
# - require(Array, Function)
# The Array is an array of String module IDs. Retrieves the modules represented
# by the module IDs and once all the modules for those module IDs are available,
# the Function callback is called, passing the modules in the same order as
# their IDs in the Array argument.
#
window.require = (id_or_ids, callback) ->
  if typeof id_or_ids == 'string'
    # we are synchronously loading a single module
    # ignore callback, use return value
    return _require(id_or_ids) || throw new Error("missing module #{id_or_ids}")
  else if id_or_ids.splice
    # we are asynchronously several modules: required callback
    throw new Error("missing callback") unless typeof callback == 'function'
    # return self, pass callback
    _require id_or_ids, callback
    return require


# AMD `define` function
#
# - define(String id, Function factory)
# Defines a named module with no dependencies
#
# - define(String id, Array dependencies, Function factory)
# Defines a named module with an array of dependencies. The factory function
# will receive the dependent modules as arguments in the order they are
# specified
#
# Other definitions, even accepted by the AMD standard, are not supported here.
#
window.define = (name, deps, factory) ->
  # this module may not have dependencies
  if !deps.splice
    # deps is not an array; it should be the callback function then
    factory = deps
    deps = []
  # if module not already defined or waiting, add to waiting
  if !_defined[name] && !_waiting[name]
    _waiting[name] = [name, deps, factory]


  