const plumber = require('gulp-plumber');
const through = require('through2');
const chalk = require('chalk');
const newer = require('gulp-newer');
const babel = require('gulp-babel');
const gulpWatch = require('gulp-watch');
const fancyLog = require('fancy-log');
const gulp = require('gulp');
const path = require('path');
const merge = require('merge-stream');

const sources = ['packages'];

function swapSrcWithLib(srcPath) {
  const parts = srcPath.split(path.sep);
  parts[1] = 'lib';
  return parts.join(path.sep);
}

function getGlobFromSource(source) {
  return `./${source}/*/src/**/*.js`;
}

function compilationLogger() {
  return through.obj((file, enc, callback) => {
    fancyLog(`Compiling '${chalk.cyan(file.relative)}'...`);
    callback(null, file);
  });
}

function errorsLogger() {
  return plumber({
    errorHandler(err) {
      fancyLog(err.stack);
    },
  });
}

function rename(fn) {
  return through.obj((file, enc, callback) => {
    file.path = fn(file);
    callback(null, file);
  });
}

function buildTuringMachineJs() {
  return merge(sources.map((source) => {
    const base = path.join(__dirname, source);

    const stream = gulp.src(getGlobFromSource(source), { base });

    return stream
      .pipe(errorsLogger())
      .pipe(newer({ dest: base, map: swapSrcWithLib }))
      .pipe(compilationLogger())
      .pipe(babel())
      .pipe(rename(file => path.resolve(file.base, swapSrcWithLib(file.relative))))
      .pipe(gulp.dest(base));
  }));
}

gulp.task('build', () => buildTuringMachineJs());

gulp.task('default', gulp.series('build'));

gulp.task('watch', gulp.series('build', () => {
  gulpWatch(sources.map(getGlobFromSource), { debounceDelay: 200 }, gulp.task('build'));
}));
