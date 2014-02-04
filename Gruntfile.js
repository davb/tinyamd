module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    filename: '<%= pkg.name %>-<%= pkg.version %>',
    coffee: {
      compile: {
        options: {
          bare: true
        },
        files: {
          '<%= filename %>.js': 'src/<%= pkg.name %>.coffee'
        }
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= pkg.version %> <%= grunt.template.today("dd-mm-yyyy") %> */'
      },
      dist: {
        files: {
          '<%= filename %>.min.js': ['<%= filename %>.js']
        }
      }
    },
    watch: {
      files: ['./*.coffee'],
      tasks: ['clean:dist', 'coffee']
    },
    clean: {
      dist: ['<%= pkg.name %>-*.js'],
      tmp: ['./tmp']
    }
  });


  grunt.loadNpmTasks('grunt-contrib-coffee');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-clean');

  //grunt.registerTask('test', ['jshint', 'qunit']);

  grunt.registerTask('default', ['clean:tmp', 'clean:dist', 'coffee', 'uglify', 'clean:tmp']);

};