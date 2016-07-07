'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const gulp = require('gulp');
const gutil = require('gulp-util');

const madeInJapan = require('../../');

gulp.task('build', done => {

  const token = gutil.env.t || gutil.env.token;
  const language = gulp.env.l || gulp.env.language;
  if (!token) {
    return done(new Error('token is required.'));
  }
  if (!language) {
    return done(new Error('language is required.'));
  }
  madeInJapan(token, language, (err, res) => {
    if (err) {
      return done(err);
    }
    makeDocs(language, res);
    done();
  });
});

function makeDocs(language, data) {

  const str = _.chain(data)
    .map(repo => {
      return {
        name: repo.name,
        full_name: repo.full_name,
        desc: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count
      };
    })
    .sortBy('stars')
    .map(r => {
      return `|${r.stars}|${r.full_name}|${r.desc}|${r.url}|`;
    })
    .value()
    .reverse()
    .join('\n');

  const readmePath = path.resolve(__dirname, '../../', 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf8');
  readme += `\## ${language} \n\n` +
    `|:star2: | Name | Description | 🌍|\n` +
    `|---|---|---|---|\n` +
    str;

  fs.writeFileSync(readmePath, readme, 'utf8');
}
