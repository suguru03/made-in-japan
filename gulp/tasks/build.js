'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const gulp = require('gulp');

const madeInJapan = require('../../');

gulp.task('build', ['validate'], done => {

  const token = process.env.token;
  madeInJapan(token, (err, res) => {
    if (err) {
      return done(err);
    }
    makeDocs(res);
    done();
  });
});

function makeDocs(data) {

  const info = _.chain(data)
    .map(repo => {
      return {
        name: repo.name || '',
        owner: repo.owner,
        language: repo.language || 'Documents',
        full_name: repo.full_name,
        desc: repo.description,
        html_url: repo.html_url,
        stars: repo.stargazers_count,
        homepage: repo.homepage
      };
    })
    .sortBy(['owner.login', 'name'])
    .reverse()
    .sortBy('language')
    .groupBy('language')
    .mapValues(repos => {
      return _.chain(repos)
        .sortBy('stars')
        .reverse()
        .map(r => {
          const name = r.name.length >= 18 ? r.name.slice(0, 18) + '…' : r.name;
          const homepage = r.homepage ? `[:arrow_upper_right:](${r.homepage})` : '';
          return `|${r.stars}|[@${r.owner.login}](${r.owner.html_url})/[**${name}**](${r.html_url})|${r.desc}|${homepage}|`;
        })
        .value()
        .join('\n');
    })
    .value();

  const tempPath = path.resolve(__dirname, '..', 'templete.md');
  const readmePath = path.resolve(__dirname, '../../', 'README.md');
  let readme = fs.readFileSync(tempPath, 'utf8');
  // make link
  const memo = {};
  const resolve = function(name, suffix) {
    let n = name;
    suffix = suffix || 0;
    if (suffix) {
      n += `-${suffix}`;
    }
    if (memo[n]) {
      return resolve(name, ++suffix);
    }
    memo[n] = true;
    return n;
  };
  readme = _.reduce(info, (result, str, language) => {
    let link = resolve(language.toLowerCase().replace(/\#|\+\+/, '').replace(/ /, '-'));
    return `${result} - [${language}](#${link})\n`;
  }, `${readme} \n## Link\n`);

  // make list
  readme = _.reduce(info, (result, str, language) => {
    return `${result}` +
      `\## ${language} \n\n` +
      `|:star2: | Name | Description | 🌍|\n` +
      `|---|---|---|---|\n` +
      `${str}` +
      `\n\n`;
  }, `${readme} \n`);

  fs.writeFileSync(readmePath, readme, 'utf8');
}

