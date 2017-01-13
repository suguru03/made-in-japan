'use strict';

const _ = require('lodash');
const gulp = require('gulp');
const async = require('neo-async');

const info = require('../../data/info.json');
const locations = require('../../data/japan.json');
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
  const currentLoc = _.get(info, 'current_location');
  const index = _.indexOf(locations, currentLoc);
  const locs = index < 0 ? locations : locations.slice(index);
  async.eachSeries(locs, (loc, next) => {
    info.current_location = loc;
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
