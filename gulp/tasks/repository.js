'use strict';

const fs = require('fs');
const path = require('path');

const gulp = require('gulp');
const { MadeIn } = require('made-in-generator');

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
gulp.task('repo:save:ranker', ['validate'], () => {

  return getRepositories(true);
});

function getRepositories(ranker = false) {
  const tokens = process.env.token.split(',');
  const madeIn = new MadeIn({ tokens });
  const developers = ranker ? madeIn.readRankers() : madeIn.readDevelopers();
  const info = require(infopath);
  const { developer, developer_page: page } = info;
  const index = developer ? developers.indexOf(developer) : 0;
  const users = developers.slice(index).concat(developers.slice(0, index));
  return madeIn.getRepositories(users, page)
    .then(res => {
      res = res || {};
      console.log('getRepositories', 'finished', res);
      info.developer = res.developer;
      info.developer_page = res.page;
      fs.writeFileSync(infopath, JSON.stringify(info, null, 2), 'utf8');
    });
}

