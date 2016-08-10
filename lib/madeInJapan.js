'use strict';

const MadeIn = require('./madeIn');

function madeInJapan(token, language, callback) {
  return new MadeIn()
    .token(token)
    .location('Japan')
    .language(language)
    .callback(callback);
}
module.exports = madeInJapan;
