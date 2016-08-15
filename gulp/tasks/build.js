'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const gulp = require('gulp');

const packageJson = require('../../package.json');
const madeInJapan = require('../../');

gulp.task('build', done => {

  const token = process.env.token;
  madeInJapan(token)
    .callback((err, res) => {
      if (err) {
        return done(err);
      }
      makeDocs(res.repositories);
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

  const basePath = packageJson.homepage;
  const tempPath = path.resolve(__dirname, '..', 'templete.md');
  const readmePath = path.resolve(__dirname, '../../', 'README.md');
  let readme = fs.readFileSync(tempPath, 'utf8');
  // make link
  readme = _.reduce(info, (result, str, language) => {
    let link = path.resolve(basePath, 'docs', `${language}.md`);
    return `${result} - [${language}](#${link})\n`;
  }, `${readme} \n## Link\n`);

  // make list
  _.chain(info)
    .mapValues((str, language) => {
      return `\## ${language} \n\n` +
        `|:star2: | Name | Description | 🌍|\n` +
        `|---|---|---|---|\n` +
        `${str}` +
        `\n\n`;
    })
    .forOwn((text, language) => {
      const filepath = path.resolve(__dirname, '../..', 'docs', `${language}.md`);
      fs.writeFileSync(filepath, text, 'utf8');
    })
    .value();

  fs.writeFileSync(readmePath, readme, 'utf8');
}

