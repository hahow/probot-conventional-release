const includes = require('lodash/includes')

/**
 * 判斷 commit 是否屬於 New Feature
 *
 * @param {Object} conventionalCommit
 * @param {string} conventionalCommit.type
 * @returns {boolean} 當 conventionalCommit.type 為 "feat" 回傳 true，否則回傳 false
 */
module.exports = ({ type }) => includes('feat', type)
