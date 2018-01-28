const isBreakingChangeCommit = require('./isBreakingChangeCommit')

module.exports = (conventionalCommit) => isBreakingChangeCommit(conventionalCommit)
  ? 'breakingChange'
  : conventionalCommit.type
