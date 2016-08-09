'use strict';

const gulp = require('gulp');

const madeInJapan = require('../../');

gulp.task('user:save', ['validate'], done => {

  const token = process.env.token;
  madeInJapan(token)
    .readCache(false)
    .saveCache();
});
