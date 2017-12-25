const conventionalCommitsParser = require('conventional-commits-parser')

/**
 * 使用 conventional-commits-parser 這個 package，
 * 將 GitHub getCommit API response 的 commit.message 轉成 conventional commit 的資料結構，
 * 並另外 assign commit.author 和 commit.sha 這兩個 field，因為之後 Release Notes 會需要這些資料
 *
 * @param {Object} response
 * @param {Object} response.commit
 * @param {Object} response.commit.author
 * @param {string} response.commit.author.name
 * @param {string} response.commit.message
 * @param {string} response.sha
 * @returns {Object} conventionalCommit
 * @returns {Object} conventionalCommit.author
 * @returns {string} conventionalCommit.author.name
 * @returns {Object} conventionalCommit.conventionalCommit
 * @returns {string} conventionalCommit.sha
 * @see https://github.com/conventional-changelog-archived-repos/conventional-commits-parser
 */
module.exports = ({ commit: { author, message }, sha }) => {
  const conventionalCommit = conventionalCommitsParser.sync(message)

  return {
    conventionalCommit,
    sha,
    author
  }
}
