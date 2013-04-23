# TinyAMD: A tiny loader for Javascript AMD modules

TinyAMD is a lightweight loader of AMD modules designed for production use.
It uses [`head.js`](http://headjs.com/) to load Javascript files asynchronously.
The main use case is when your application is large and could
be split it into separate files, to be lazily loaded at runtime.

Here are the issues that prevent doing this with the current AMD loaders:
  * There are a lot of ways to define Javascript modules that follow the AMD
specification.
  * Require.js and similar are huge and full of options for broad compatibility.
  * The almond shim is nice and small but cannot load modules dynamically

TinyAMD supports one single format for defining AMD modules:

    define("module_name", ["dependency1", "dependency2"], function (dependency1, dependency2) {
      /* ... module code here ... */
      return the_module;
    })

The dependencies array may be omitted when the module does not have dependencies.
The return value of the factory function is used as the module.

No `module.exports`,
no `require('dependency')` calls inside the factory function body.

## Download

  * Development: `tinyamd-X.X.X.js`

  * Production: `tinyamd-X.X.X.min.js`

both files already include `head.js`

Load the script with a `<script>` tag in the `<head>` section of your web page.
You can now define modules using the standard AMD format described above, and
`require` them as follows:

  * To require a module that is already defined:

    `var MyModule = require('my_module');`

    will throw an error if `module_name` is not already defined.

  * To asynchronously load a module, call `require` with an array as its first
    argument (even for a single file), and pass a `callback` function
    which will get called with the module as an argument once the module and its
    dependencies have been loaded and defined.

        `require(['my_module'], function(MyModule) { /* do something amazing */ });`

    This will load the Javascript file `{{baseUrl}}/my_module.js`, and expects it
    to define a module named `my_module`. The file may indeed define other modules.

    To customize the `baseUrl`, include the following Javascript code _before_ the
    `<script>` tag that loads `tinyamd`:

        <script type='text/javascript'>
        var tinyamd_config = {baseUrl: 'http://example.com/my/url/'};
        </script>
        <script type='text/javascript' src='tinyamd-X.X.X.js' />






## Contribute

  1. Clone this repository

  2. run `bower install` to fetch the `headjs` sources

  3. run `npm install` to install `grunt` and other modules needed for build

You can now edit the `src/tinyamd.coffee` source file, and then

  * run `grunt watch` to rebuild the development files whenever you save the
  source file

  * run `grunt` to rebuild the development and production files.


