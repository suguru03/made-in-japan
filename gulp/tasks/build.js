'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const gulp = require('gulp');

const packageJson = require('../../package.json');

/**
 * Makes all docs
 * gulp build
 */
gulp.task('build', () => makeDocs(require('../../data/repositories.json')));

function makeDocs(data) {

  const info = _.chain(data)
    .map(repo => {
      return {
        name: repo.name || '',
        owner: repo.owner,
        language: repo.language || 'Documents',
        full_name: repo.full_name,
        desc: (repo.desc || '').replace(/\|/g, '\\|'),
        html_url: repo.html_url,
        stars: repo.stars,
        homepage: /^http/.test(repo.homepage) ? repo.homepage : ''
      };
    })
    .sortBy(['owner.login', 'name'])
    .reverse()
    .value();

  let prevRank;
  let prevStars;
  const ranks = _.chain(info)
    .transform((result, { owner, stars }) => {
      const { login: name } = owner;
      const info = result[name] = result[name] || { name, stars: 0 };
      info.stars += stars;
    }, {})
    .orderBy(['stars', 'name'], ['desc', 'asc'])
    .map(({ name, stars }, rank) => {
      if (stars === prevStars) {
        rank = prevRank;
      } else {
        prevRank = ++rank;
        prevStars = stars;
      }
      const text = `|${rank}|[${name}](https://github.com/${name})|${stars}|\n`;
      return { rank, name, stars, text };
    })
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
          r.str = `|${r.stars}|[@${r.owner.login}](${r.owner.html_url})/[**${name}**](${r.html_url})|${r.desc}|${homepage}|`;
          return r;
        })
        .value();
    })
    .value();

  const basePath = packageJson.homepage;
  const tempPath = path.resolve(__dirname, '..', 'templete.md');
  const readmePath = path.resolve(__dirname, '../../', 'README.md');
  let readme = fs.readFileSync(tempPath, 'utf8');

  // make top 10
  const limit = 10;
  const now = new Date();
  const month = (now.getMonth() + 1);
  const date = now.getDate();
  const monthStr = (month / 10 | 0 ? '' : '0') + month;
  const dateStr = (date / 10 | 0 ? '' : '0') + date;
  const nowStr = `${now.getFullYear()}/${monthStr}/${dateStr}`;
  readme = _.chain(ranks)
    .slice(0, limit)
    .reduce((result, { text }) => {
      return `${result}${text}`;
    }, `${readme} \n## Top ${limit} Developers (${nowStr})\n|Rank|Name|:star2:|\n|---|---|---|\n`)
    .value();

  // make top 1000
  const rankLimit = 1000;
  readme += `\n-> [Top 1000 Developers](${basePath}/blob/master/docs/rankers.md)\n`;
  ranks.splice(rankLimit * 2);
  const rankDoc = _.reduce(ranks.slice(0, rankLimit), (result, { text }) => {
    return `${result}${text}`;
  }, `## Top ${rankLimit} Developers (${nowStr})\n\n|Rank|Name|:star2:|\n|---|---|---|\n`);
  const rankpath = path.resolve(__dirname, '../..', 'docs', 'rankers.md');
  fs.writeFileSync(rankpath, rankDoc, 'utf8');

  const users = _.map(ranks, 'name');
  const rankInfoPath = path.resolve(__dirname, '../../', 'data', 'rankers.json');
  fs.writeFileSync(rankInfoPath, JSON.stringify(users, null, 2), 'utf8');

  // make link
  prevRank = undefined;
  prevStars = undefined;
  readme = _.chain(linkInfo)
    .map((info, language) => {
      const link = `${basePath}/blob/master/docs/${language.replace(/\s/g, '%20')}.md`;
      const stars = _.chain(info)
        .map('stars')
        .sum()
        .value();
      const text = `|[${language}](${link})|${stars}|${_.size(info)}|\n`;
      return { language, link, stars, text };
    })
    .orderBy(['stars', 'language'], ['desc', 'asc'])
    .reduce((result, { language, stars, text }, rank) => {
      if (stars === prevStars) {
        rank = prevRank;
      } else {
        prevRank = ++rank;
        prevStars = stars;
      }
      return `${result}|${rank}${text}`;
    }, `${readme} \n## Languages\n|Rank|Language|:star2:|Number of Repositories|\n|---|---|---|---|\n`)
    .value();

  // make list
  _.chain(linkInfo)
    .mapValues(info => {
      const str = _.map(info, 'str').join('\n');
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

