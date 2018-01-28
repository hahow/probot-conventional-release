const isBreakingChangeCommit = require('./isBreakingChangeCommit')
const isFeatureCommit = require('./isFeatureCommit')
const isHotfixCommit = require('./isHotfixCommit')

module.exports = (conventionalCommit) => (
  isBreakingChangeCommit(conventionalCommit) ||
  isFeatureCommit(conventionalCommit) ||
  isHotfixCommit(conventionalCommit)
)
