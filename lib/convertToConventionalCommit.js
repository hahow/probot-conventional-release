const conventionalCommitsParser = require('conventional-commits-parser')

/**
 * 使用 conventional-commits-parser 這個 package，
 * 將 GitHub 的 commit message 轉成 conventional commit 的資料結構，
 * 另外因為 Release Notes 需要，會額外回傳 author 和 SHA 這兩筆資料。
 * 
 * @param {Object} commit
 * @param {Object} commit.author The Git author of the commit.
 * @param {string} commit.author.name The Git author's name.
 * @param {string} id The SHA of the commit.
 * @param {string} commit.message The commit message.
 * @returns {Object} conventionalCommit
 * @returns {Object} conventionalCommit.author
 * @returns {string} conventionalCommit.author.name
 * @returns {string} conventionalCommit.sha
 * @see https://github.com/conventional-changelog-archived-repos/conventional-commits-parser
 */
module.exports = ({ author, id, message }) => {
  const parserOptions = {
    // 預設的 headerPattern 是 /^(\w*)(?:\(([\w\$\.\-\* ]*)\))?\: (.*)$/
    // 但我們的 scope 有斜線的需求，例如：fix(controllers/auth): oauth login failed
    // 固修改 headerPattern 支援斜線（/）。
    headerPattern: /^(\w*)(?:\(([\w$.\-*/ ]*)\))?: (.*)$/
  }

  const conventionalCommit = conventionalCommitsParser.sync(message, parserOptions)

  return {
    ...conventionalCommit,
    author,
    sha: id
  }
}
