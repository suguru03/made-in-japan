'use strict';

const gulp = require('gulp');
const { makeDocs } = require('made-in-generator');

/**
 * Makes all docs
 * gulp build
 */
gulp.task('build', () => makeDocs(require('../../data/repositories.json')));
