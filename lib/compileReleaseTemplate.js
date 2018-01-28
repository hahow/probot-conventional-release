const handlebars = require('handlebars')

/**
 * RELEASE_TEMPLATE 可以接受的參數：
 *
 * @param {Object} context
 * @param {Object} context.commits
 * @param {Object[]} context.commits.breakingChange - (Optional) 如果有，則 commits 會出現在 relase notes 的 BREAKING CHANGES 區塊
 * @param {Object} context.commits.breakingChange[].author
 * @param {string} context.commits.breakingChange[].author.name - Commit 的作者名字
 * @param {Object} context.commits.breakingChange[].conventionalCommit
 * @param {string} context.commits.breakingChange[].conventionalCommit.scope - Conventional commit 的 scope
 * @param {string} context.commits.breakingChange[].conventionalCommit.subject - Conventional commit 的 subject
 * @param {string} context.commits.breakingChange[].sha - Commit 的 SHA
 * @param {Object[]} context.commits.feat - (Optional) 如果有，則 commits 會出現在 relase notes 的 New Features 區塊
 * @param {Object} context.commits.feat[].author
 * @param {string} context.commits.feat[].author.name
 * @param {Object} context.commits.feat[].conventionalCommit
 * @param {string} context.commits.feat[].conventionalCommit.scope
 * @param {string} context.commits.feat[].conventionalCommit.subject
 * @param {string} context.commits.feat[].sha
 * @param {Object[]} context.commits.fix - (Optional) 如果有，則 commits 會出現在 relase notes 的 Bug Fixes 區塊
 * @param {Object} context.commits.fix[].author
 * @param {string} context.commits.fix[].author.name
 * @param {Object} context.commits.fix[].conventionalCommit
 * @param {string} context.commits.fix[].conventionalCommit.scope
 * @param {string} context.commits.fix[].conventionalCommit.subject
 * @param {string} context.commits.fix[].sha
 * @param {string} context.commits.owner - Release 的 repository owner, ex: hahow
 * @param {string} context.commits.repo - Release 的 repository, ex: hh-frontend-react
 * @param {string} context.date - Release 的時間, ex: 2112-09-03
 * @param {string} context.preTag - 上一次 release 的 tag name, ex: v1.0.0
 * @param {string} context.tag - Release 的 tag name, ex: v1.1.0
 */
module.exports = (releaseTemplate) => handlebars.compile(releaseTemplate)
