'use strict';

const gulp = require('gulp');

const madeInJapan = require('../../');

gulp.task('user:save', ['validate'], () => {

  const token = process.env.token;
  madeInJapan(token)
    .readUser(false)
    .saveUser();
});
