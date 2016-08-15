'use strict';

const gulp = require('gulp');
const madeInJapan = require('../../');

gulp.task('repository:save', ['validate'], () => {

  const token = process.env.token;
  madeInJapan(token)
    .readRepository(false)
    .saveRepository();
});
