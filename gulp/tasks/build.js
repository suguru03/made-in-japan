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
        desc: repo.desc || '',
        html_url: repo.html_url,
        stars: repo.stars,
        homepage: repo.homepage
      };
    })
    .sortBy(['owner.login', 'name'])
    .reverse()
    .value();

  const limit = 10;
  const rankInfo = _.chain(info)
    .transform((result, { owner, stars }) => {
      const { login: name } = owner;
      const info = result[name] = result[name] || { name, stars: 0 };
      info.stars += stars;
    }, {})
    .orderBy('stars', 'desc')
    .slice(0, limit)
    .value();

  const linkInfo = _.chain(info)
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

  // make top ${limit}
  const now = new Date();
  const month = (now.getMonth() + 1);
  const date = now.getDate();
  const monthStr = (month / 10 | 0 ? '' : '0') + month;
  const dateStr = (date / 10 | 0 ? '' : '0') + date;
  const nowStr = `${now.getFullYear()}/${monthStr}/${dateStr}`;
  readme = _.reduce(rankInfo, (result, { name, stars }) => {
    return `${result}|[${name}](https://github.com/${name})|${stars}|\n`;
  }, `${readme} \n## Top ${limit} (${nowStr})\n|Name|:star2:|\n|---|---|\n`);

  // make link
  readme = _.reduce(linkInfo, (result, str, language) => {
    let link = `${basePath}/blob/master/docs/${language}.md`;
    return `${result} - [${language}](${link})\n`;
  }, `${readme} \n## Link\n`);



  // make list
  _.chain(linkInfo)
    .mapValues(str => {
      return '|:star2: | Name | Description | 🌍|\n' +
        '|---|---|---|---|\n' +
        `${str}` +
        '\n\n';
    })
    .forOwn((text, language) => {
      const filepath = path.resolve(__dirname, '../..', 'docs', `${language}.md`);
      fs.writeFileSync(filepath, text, 'utf8');
    })
    .value();

  fs.writeFileSync(readmePath, readme, 'utf8');
}

