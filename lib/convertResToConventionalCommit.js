const conventionalCommitsParser = require('conventional-commits-parser')

module.exports = ({ commit: { author, message }, sha }) => {
  const parserOptions = {
    headerPattern: /^(\w*)(?:\(([\w$.\-*/ ]*)\))?: (.*)$/
  }

  const conventionalCommit = conventionalCommitsParser.sync(message, parserOptions)

  return {
    ...conventionalCommit,
    author,
    sha
  }
}
