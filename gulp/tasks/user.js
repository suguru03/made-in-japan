'use strict';

const path = require('path');
const gulp = require('gulp');
const async = require('neo-async');

const madeInJapan = require('../../');

gulp.task('user:save', ['validate'], () => {

  const token = process.env.token;
  const loc = process.env.location;
  madeInJapan(token)
    .location(loc)
    .readEngineer(false)
    .saveEngineer();
});

gulp.task('user:save:all', ['validate'], done => {

  const token = process.env.token;
  const filepath = path.resolve(__dirname, '..', '..', 'data', 'japan.json');
  const locations = require(filepath);
  async.eachSeries(locations, (loc, next) => {
    console.log(`location:${loc}`);
    madeInJapan(token)
      .location(loc)
      .readEngineer(false)
      .saveEngineer()
      .callback(err => {
        err = /^Only the first 1000/.test(err) ? null : err;
        next(err);
      });
  }, done);
});
