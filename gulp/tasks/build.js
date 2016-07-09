'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const gulp = require('gulp');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));
const madeInJapan = require('../../');

gulp.task('build', done => {

  const token = argv.t || argv.token;
  if (!token) {
    return done(new Error('token is required.'));
  }
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
    .sortBy('language')
    .groupBy('language')
    .mapValues(repos => {
      return _.chain(repos)
        .sortBy('stars')
        .reverse()
        .map(r => {
          const name = r.name.length >= 20 ? r.name.slice(0, 20) + '…' : r.name;
          const homepage = r.homepage ? `[:arrow_upper_right:](${r.homepage})` : '';
          return `|${r.stars}|[@${r.owner.login}](${r.owner.html_url})/[**${name}**](${r.html_url})|${r.desc}|${homepage}|`;
        })
        .value()
        .join('\n');
    })
    .value();

  const tempPath = path.resolve(__dirname, 'templete.md');
  const readmePath = path.resolve(__dirname, '../../', 'README.md');
  let readme = fs.readFileSync(tempPath, 'utf8');
  // make link
  readme = _.reduce(info, (result, str, language) => {
    return `${result} - [${language}](#${language})\n`;
  }, `${readme} ## Link\n`);

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

