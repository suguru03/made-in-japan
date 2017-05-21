'use strict';

const fs = require('fs');
const path = require('path');

const gulp = require('gulp');
const { MadeIn } = require('made-in-generator');

const infopath = path.resolve(__dirname, '../..', 'data', 'info.json');

/**
 * Gets speficied developers
 * gulp user:save --token <token> --location Japan
 */
gulp.task('user:save', ['validate'], () => {

  const {
    token,
    location
  } = process.env;
  const tokens = token.split(',');
  return new MadeIn({ tokens }).getDevelopers(location);
});

/**
 * Gets all Japaneses developers
 * gulp user:save:all --token <token>
 */
gulp.task('user:save:all', ['validate'], () => {

  const tokens = process.env.token.split(',');
  const locations = require('../../data/japan.json');
  const info = require(infopath);
  const { location, location_page: page } = info;
  const index = location ? locations.indexOf(info.current_location) : 0;
  const array = locations.slice(index).concat(locations.slice(0, index));
  return new MadeIn({ tokens })
    .getDevelopers(array, page)
    .then(res => {
      res = res || {};
      console.log('user:save:all', 'finished', res);
      info.location = res.location;
      info.location_page = res.page;
      fs.writeFileSync(infopath, JSON.stringify(info, null, 2), 'utf8');
    });
});
