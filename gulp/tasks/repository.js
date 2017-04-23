'use strict';

const gulp = require('gulp');
const MadeIn = require('../../lib/madeIn');
const madeInJapan = require('../../');

gulp.task('repository:save', ['validate'], () => {

  const { token } = process.env;
  madeInJapan(token)
    .readRepository(false)
    .saveRepository();
});

gulp.task('repository:ranker:save', ['validate'], () => {

  const { token } = process.env;
  new MadeIn({ ranker: true })
    .token(token)
    .location('Japan')
    .readRepository(false)
    .saveRepository();
});
