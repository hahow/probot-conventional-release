const get = require('lodash/get')
const Rx = require('rx')
const semver = require('semver')

const compileReleaseTemplate = require('../lib/compileReleaseTemplate')
const convertResToConventionalCommit = require('../lib/convertResToConventionalCommit')
const convertToReleasableCommits = require('../lib/convertToReleasableCommits')
const getLatestReleaseTag = require('../lib/getLatestReleaseTag')
const getSemverType = require('../lib/getSemverType')
const releasePROpenedTemplate = require('../template/releasePROpenedTemplate')

const defaultConfig = {
  INITIAL_VERSION: '0.0.0',
  RELEASE_BRANCH: 'master',
  RELEASE_TEMPLATE: releasePROpenedTemplate
}

module.exports = async (context) => {
  context.log('pull_request event is trigger!')

  // Reads the app configuration from the given YAML file in the .github directory of the repository.
  const config = await context.config('conventional-release.yml', defaultConfig)

  const owner = get(context, 'payload.repository.owner.login')
  const repo = get(context, 'payload.repository.name')

  /**
   * Step 1
   *
   * Determine This Pull Request Is Merged Into Master Branch
   */

  const action = get(context, 'payload.action')
  const ref = get(context, 'payload.pull_request.base.ref')

  const isOpendForMaster = (action === 'opened' && ref === config.RELEASE_BRANCH)

  if (isOpendForMaster === false) {
    context.log(`This Pull Request is not opend for ${config.RELEASE_BRANCH} branch, exit this process.`)

    return
  }

  /**
   * Step 2
   *
   * Get Latest Release Git Tag
   */

  const latestReleaseTag = await getLatestReleaseTag(context, {
    initialVersion: config.INITIAL_VERSION
  })

  context.log(`${owner}/${repo} latest GitHub Releases tag is ${latestReleaseTag}`)

  if (semver.valid(latestReleaseTag) === false) {
    context.log(`${latestReleaseTag} is not a SemVer, exit this process.`)

    return
  }

  /**
   * Step 3
   *
   * Get All Commits In This Pull Request
   */

  /** The pull request number */
  const number = get(context, 'payload.number')

  const getPullRequestCommits = context.github.pullRequests.getCommits({
    owner,
    repo,
    number,
    // A custom page size up to 100. Default is 30.
    per_page: 100
  })

  // 利用 RxJS 的 expand 處理遞迴的特性，一次拿取 GitHub 分頁 API 的所有 commits
  // @see {@link https://tech.hahow.in/adfd29de1967 | 如何使用 RxJS 處理分頁 API}
  const getAllCommits$ = Rx.Observable
    .fromPromise(getPullRequestCommits)
    .expand(checkNextPage)
    .reduce(concatAllCommits, [])

  const allCommits = await getAllCommits$.toPromise()

  context.log(`${owner}/${repo}/pulls/${number} has ${allCommits.length} commits`)

  console.log(allCommits)

  return

  /**
   * Step 4
   *
   * Convert GitHub API's Commits To Conventional Commits
   */

  const releasableCommits = convertToReleasableCommits(allCommits)

  if (releasableCommits.length === 0) {
    context.log(`${owner}/${repo} has not found any releasable commits, exit this process`)

    return
  }

  context.log(`${owner}/${repo} has ${releasableCommits.length} releasable commits`)

  const templatableCommits = _.groupBy(releasableCommits, getTemplatableCommitType)

  /**
   * Step 5
   *
   * Create GitHub Release Note
   */

  // 根據 commits 的 conventional type 取得接下來 release 更新的 SemVer，
  // 預期會是 major、minor 或 patch，如果都不是則會結束 conventional release。
  const nextReleaseType = getSemverType(templatableCommits)

  const nextReleaseVersion = semver.inc(latestReleaseTagName, nextReleaseType)
  const nextReleaseTag = `v${nextReleaseVersion}`

  context.log(`${owner}/${repo} next GitHub Releases tag is ${nextReleaseTag}`)

  // 用來顯示 Release Notes 的時間，只取日期的部分
  const nextReleaseDate = _
    .chain(context)
    .get('payload.pull_request.merged_at')
    .split('T')
    .head()
    .value()

  // 編譯 Release Template 的內容
  const compiledReleaseBody = compileReleaseTemplate(config.RELEASE_TEMPLATE)({
    owner,
    repo,
    commits: conventionalCommits,
    date: nextReleaseDate,
    tag: nextReleaseTagName
  })

  context.log(`${owner}/${repo}/pulls/${number} 預計 Release 的內容：`, compiledReleaseBody)

  // 如果是 Open PR，則建立 Release 留言
  try {
    await context.github.issues.createComment({
      owner,
      repo,
      number,
      body: compiledReleaseBody
    })

    context.log(`${owner}/${repo}/pulls/${number} Comment 完成 🎉`)
  } catch (error) {
    context.log(`${owner}/${repo}/pulls/${number} Comment 失敗⋯⋯`)
  }

  /**
   * 如果 GitHub getCommits() API 還有下一頁，
   * 則繼續使用 getNextPage() API 取得下一頁的 commits，
   * 反之則回傳 Rx.Observable.empty() 結束 Rx.Observable.expand() 的遞迴計算
   *
   * @param {Object} response context.github.pullRequests.getCommits 的 response
   */
  function checkNextPage (response) {
    return context.github.hasNextPage(response)
      ? Rx.Observable.fromPromise(context.github.getNextPage(response))
      : Rx.Observable.empty()
  }
}

/**
 * 將 RxJS stream 之中所有 GitHub getCommits() API response.data 合併成一個一維陣列，
 * 例如：[...response1.data, ...response2.data, ...response3.data]
 *
 * @returns {Array}
 */
function concatAllCommits (acc, curr) {
  return acc.concat(curr.data)
}
