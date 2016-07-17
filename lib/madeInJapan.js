'use strict';

const MadeIn = require('./madeIn');

function madeInJapan(token, language, callback) {
  return new MadeIn(token)
    .loc('Japan');
}
module.exports = madeInJapan;
