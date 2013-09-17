module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    filename: '<%= pkg.name %>-<%= pkg.version %>',
    coffee: {
      compile: {
        options: {
          bare: false
        },
        files: {
          '.tmp/<%= filename %>.js': 'src/<%= pkg.name %>.coffee'
        }
      }
    },
    concat: {
      options: {
        separator: "\n"
      },
      dist: {
        src: ['components/headjs/src/load.js', '.tmp/*.js'],
        dest: '<%= filename %>.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= pkg.version %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      dist: {
        files: {
          '<%= filename %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    },
    watch: {
      files: ['./*.coffee'],
      tasks: ['clean:dist', 'coffee', 'concat']
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

  grunt.registerTask('default', ['clean:tmp', 'clean:dist', 'coffee', 'concat', 'uglify', 'clean:tmp']);

};