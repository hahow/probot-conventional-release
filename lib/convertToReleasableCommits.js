const _ = require('lodash')
const convertToConventionalCommit = require('./convertToConventionalCommit')
const isReleasableCommit = require('./isReleasableCommit')

module.exports = (commits) => _.chain(commits)
  .map(convertToConventionalCommit)
  .filter(isReleasableCommit)
  .value()
