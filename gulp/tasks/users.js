'use strict';

const gulp = require('gulp');

const madeInJapan = require('../../');

gulp.task('user:save', ['validate'], () => {

  const token = process.env.token;
  const gist = process.env.gist;
  madeInJapan(token)
    .gist(gist)
    .save();
});
