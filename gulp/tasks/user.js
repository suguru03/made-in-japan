'use strict';

const fs = require('fs');
const path = require('path');

const gulp = require('gulp');

const MadeIn = require('../../lib/madeIn2');
const infopath = path.resolve(__dirname, '../..', 'data', 'info.json');

gulp.task('user:save', ['validate'], () => {

  const {
    token,
    location
  } = process.env;
  return new MadeIn({ token }).getDevelopers(location);
});

gulp.task('user:save:all', ['validate'], () => {

  const { token } = process.env;
  const locations = require('../../data/japan.json');
  const info = require(infopath);
  const index = locations.indexOf(info.current_location);
  const array = locations.slice(index).concat(locations.slice(0, index));
  return new MadeIn({ token }).getDevelopers(array)
    .then(res => {
      console.log('user:save:all', 'finished', res);
      info.current_location = res.location;
      fs.writeFileSync(infopath, JSON.stringify(info, null, 2), 'utf8');
    });
});
