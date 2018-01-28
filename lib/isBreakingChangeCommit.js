const get = require('lodash/get')
const some = require('lodash/some')

/**
 * 判斷 commit 是否屬於 BREAKING CHANGE
 *
 * @param {Object} conventionalCommit
 * @param {Object[]} conventionalCommit.notes
 * @param {string} conventionalCommit.notes[].title
 * @returns {boolean} 當 conventionalCommit.notes[].title 為 "BREAKING CHANGE" 回傳 true，否則回傳 false
 */
module.exports = ({ notes }) => some(notes, { title: 'BREAKING CHANGE' })
