'use strict';

const fs = require('fs');
const path = require('path');

const gulp = require('gulp');
const MadeIn = require('made-in-generator');

const infopath = path.resolve(__dirname, '../..', 'data', 'info.json');

/**
 * Gets all Japaneses repositories by `data/developers.json`
 * gulp repo:save --token <token>
 */
gulp.task('repo:save', ['validate'], () => {

  return getRepositories();
});

/**
 * Gets Japaneses repositories by `data/rankers.json`
 * gulp repo:ranker:save --token <token>
 */
gulp.task('repo:ranker:save', ['validate'], () => {

  return getRepositories(true);
});

function getRepositories(ranker = false) {
  const { token } = process.env;
  const madeIn = new MadeIn({ token });
  const developers = ranker ? madeIn.readRankers() : madeIn.readDevelopers();
  const info = require(infopath);
  const { current_developer: developer } = info;
  const index = developer ? developers.indexOf(info.current_developer) : 0;
  const users = developers.slice(index).concat(developers.slice(0, index));
  return madeIn.getRepositories(users)
    .then(({ developer }) => {
      console.log('getRepositories', 'finished', developer);
      info.current_developer = developer;
      fs.writeFileSync(infopath, JSON.stringify(info, null, 2), 'utf8');
    });
}

