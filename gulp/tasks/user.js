'use strict';

const gulp = require('gulp');

const madeInJapan = require('../../');

gulp.task('user:save', ['validate'], () => {

  const token = process.env.token;
  const loc = process.env.location;
  madeInJapan(token)
    .location(loc)
    .readEngineer(false)
    .saveEngineer();
});
