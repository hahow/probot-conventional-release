const handlebars = require('handlebars')
const _ = require('lodash')
const Rx = require('rx')
const semver = require('semver')

const convertToConventionalCommit = require('./lib/convertToConventionalCommit')

/** 只有 merge 到這個 branch 的 PR 才會觸發 conventional release */
const RELEASE_BRANCH = 'master'
/** 如果 GitHub repository 從來沒有建立過 release tag，可以指定一個初始版號 */
const INITIAL_VERSION = '0.0.0'
/** GitHub release notes 的 template，使用 Handlebars.js */
const RELEASE_TEMPLATE = `
## {{tag}} {{#if date}}({{date}}){{/if}}

{{#if commits.breakingChange}}
### :scream: BREAKING CHANGES :bangbang:

{{#each commits.breakingChange}}
- {{#if conventionalCommit.scope}}**{{conventionalCommit.scope}}**: {{/if}}{{conventionalCommit.subject}} (https://github.com/{{../owner}}/{{../repo}}/commit/{{sha}}) by {{author.name}}
{{/each}}

{{/if}}
{{#if commits.feat}}
### :tada: New Features

{{#each commits.feat}}
- {{#if conventionalCommit.scope}}**{{conventionalCommit.scope}}**: {{/if}}{{conventionalCommit.subject}} (https://github.com/{{../owner}}/{{../repo}}/commit/{{sha}}) by {{author.name}}
{{/each}}

{{/if}}
{{#if commits.fix}}
### :bug: Bug Fixes

{{#each commits.fix}}
- {{#if conventionalCommit.scope}}**{{conventionalCommit.scope}}**: {{/if}}{{conventionalCommit.subject}} (https://github.com/{{../owner}}/{{../repo}}/commit/{{sha}}) by {{author.name}}
{{/each}}

{{/if}}
[{{preTag}}...{{tag}}](https://github.com/{{owner}}/{{repo}}/compare/{{preTag}}...{{tag}})
`

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
const compileReleaseTemplate = handlebars.compile(RELEASE_TEMPLATE)

/**
 * 這是一個用來處裡自動化 GitHub Release Notes 的 Probot 專案
 *
 * 功能：
 *
 * 1. 當有 PR 被 merge 回 master 時
 * 這個 Probot 機器人就會檢查所有 commits，
 * 將其中所有符合 Conventional Commits 規範的 commits 寫進 GitHub Release Notes，
 * 並根據 semver 更新 tag 版本號。
 *
 * 2. 當有 merge master 的 PR 被建立時
 * 這個 Probot 機器人就會將 1 預期會 Release 的內容寫進該 PR 底下的留言
 *
 * @see {@link http://conventionalcommits.org | Conventional Commits}
 * @see {@link https://developer.github.com/apps | GitHub Apps}
 * @see {@link https://github.com/probot/probot | Probot}
 */
module.exports = (robot) => {
  robot.on('pull_request', async(context) => {
    robot.log('pull_request event is trigger!')

    const config = Object.assign(
      {},
      {
        enabled: true,
      },
      context.config('probot-conventional-release.yml')
    );

    if (!config.enabled) {
      return;
    }

    const owner = _.get(context, 'payload.repository.owner.login')
    const repo = _.get(context, 'payload.repository.name')

    /**
     * Step 1
     *
     * Determine This Pull Request Is Merged Into Master Branch
     */

    const action = _.get(context, 'payload.action')
    const merged = _.get(context, 'payload.pull_request.merged')
    const ref = _.get(context, 'payload.pull_request.base.ref')

    robot.log(`action is ${action}`)
    robot.log(`merged is ${merged}`)
    robot.log(`ref is ${ref}`)

    // If the action is "closed" and the merged key is false, the pull request was closed with unmerged commits.
    // If the action is "closed" and the merged key is true, the pull request was merged.
    const isMergedIntoMaster = (
      action === 'closed' &&
      merged === true &&
      ref === RELEASE_BRANCH
    )

    const isOpendForMaster = (
      action === 'opened' &&
      ref === RELEASE_BRANCH
    )

    if (isOpendForMaster === false && isMergedIntoMaster === false) {
      robot.log(`
        This Pull Request is not opend for master branch,
        and is not merged into master branch,
        so exit this process.
      `)

      return
    }

    /**
     * Step 2
     *
     * Get Latest Release Git Tag
     */

    const latestReleaseTagName = await getLatestReleaseTagName()

    if (semver.valid(latestReleaseTagName) === false) {
      robot.log(`${latestReleaseTagName} is not a semver, exit this process.`)

      return
    }

    /**
     * Step 3
     *
     * Get All Commits In This Pull Request
     */

    /** The pull request number */
    const number = _.get(context, 'payload.number')

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

    robot.log(`${owner}/${repo}/pulls/${number} has ${allCommits.length} commits`)

    /**
     * Step 4
     *
     * Convert GitHub API's Commits To Conventional Commits
     */

    const conventionalCommits = _
      .chain(allCommits)
      // 透過 conventionalCommitsParser 封裝所有 commits 成 conventionalCommit 物件
      .map(convertToConventionalCommit)
      // 過濾掉不是 feat、fix 和 BREAKING CHANGE 的 commits
      .filter(isReleasableCommit)
      // 封裝成 Release Template 的格式
      .groupBy(groupReleasableCommit)
      .value()

    robot.log(`${owner}/${repo}/pulls/${number}/commits -> conventionalCommits:`, conventionalCommits)

    /**
     * Step 5
     *
     * Create GitHub Release Note
     */

    // 根據 commits 的 conventional type 取得接下來 release 更新的 SemVer，
    // 預期會是 major、minor 或 patch，如果都不是則會結束 conventional release。
    const nextReleaseType = getSemverTypeFactory()(conventionalCommits)

    if (_.isUndefined(nextReleaseType)) {
      robot.log(`${owner}/${repo}/pulls/${number} 沒有發現任何可以 Release 的 Commit Type，所以蓋牌結束這回合。`)

      return
    }

    const nextReleaseVersion = semver.inc(latestReleaseTagName, nextReleaseType)
    const nextReleaseTagName = `v${nextReleaseVersion}`

    robot.log(`${owner}/${repo}/pulls/${number} 預計 Release 的 Tag 是 ${nextReleaseTagName}`)

    // 用來顯示 Release Notes 的時間，只取日期的部分
    const nextReleaseDate = _
      .chain(context)
      .get('payload.pull_request.merged_at')
      .split('T')
      .head()
      .value()

    // 編譯 Release Template 的內容
    const compiledReleaseBody = compileReleaseTemplate({
      owner,
      repo,
      commits: conventionalCommits,
      date: nextReleaseDate,
      preTag: latestReleaseTagName,
      tag: nextReleaseTagName
    })

    robot.log(`${owner}/${repo}/pulls/${number} 預計 Release 的內容：`, compiledReleaseBody)

    // 如果是 Open PR，則建立 Release 留言
    if (isOpendForMaster) {
      try {
        await context.github.issues.createComment({
          owner,
          repo,
          number,
          body: compiledReleaseBody
        })
  
        robot.log(`${owner}/${repo}/pulls/${number} Comment 完成 🎉`)
      } catch (error) {
        robot.log(`${owner}/${repo}/pulls/${number} Comment 失敗⋯⋯`)
      }
    }

    // 如果是 Merge PR，則建立 Release Notes
    if (isMergedIntoMaster) {
      try {
        // 建立 Release Notes！🚀
        await context.github.repos.createRelease({
          owner,
          repo,
          tag_name: nextReleaseTagName,
          target_commitish: RELEASE_BRANCH,
          name: nextReleaseTagName,
          body: compiledReleaseBody,
          draft: false,
          prerelease: false
        })
  
        robot.log(`${owner}/${repo}/pulls/${number} Release 完成 🎉`)
      } catch (error) {
        robot.log(`${owner}/${repo}/pulls/${number} Release 失敗⋯⋯`)
      }
    }

    /**
     * 取得最後一次 release 的 tag，如果沒有 release 過則回傳 "0.0.0"
     */
    async function getLatestReleaseTagName () {
      // 因為在 repo 沒有 release 的情況下，
      // context.github.repos.getLatestRelease() 會拋出 Error，
      // 所以用 try cache 來處理，Error 統一回傳 INITIAL_VERSION（預設 0.0.0）
      try {
        const latestRelease = await context.github.repos.getLatestRelease({ owner, repo })
        const latestReleaseTagName = _.get(latestRelease, 'data.tag_name')

        robot.log(`${owner}/${repo} 上一次 Release 的 Git Tag ${latestReleaseTagName}`)

        return latestReleaseTagName
      } catch (error) {
        robot.log(`${owner}/${repo} 因為找不到上一次 Release 的 Git Tag。所以版本從 ${INITIAL_VERSION} 開始計算。`)

        return INITIAL_VERSION
      }
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
  })

  robot.log('Conventional release bot is on!')
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

/**
 * 判斷 commit 是否屬於 New Feature 或 Bug Fix
 *
 * @param {Object} conventionalCommit
 * @param {Object} conventionalCommit.conventionalCommit
 * @param {string} conventionalCommit.conventionalCommit.type
 * @returns {boolean}
 * @see https://github.com/conventional-changelog-archived-repos/conventional-commits-parser
 */
function isFeatureOrBugfix (conventionalCommit) {
  const commitType = _.get(conventionalCommit, 'conventionalCommit.type')

  return _.includes(['feat', 'fix'], commitType)
}

/**
 * 判斷 commit 是否屬於 BREAKING CHANGE
 *
 * @param {Object} conventionalCommit - 傳進來的 commit 資料結構必須是 conventionalCommit 物件（conventional-commits-parser）
 * @param {Object} conventionalCommit.conventionalCommit
 * @param {Object[]} conventionalCommit.conventionalCommit.notes
 * @param {string} conventionalCommit.conventionalCommit.notes[].title - 如果這個 commit 屬於 BREAKING CHANGE，那它會出現在這
 * @returns {boolean} 如果為 true，那麼這個 commit 屬於 BREAKING CHANGE
 * @see https://github.com/conventional-changelog-archived-repos/conventional-commits-parser
 */
function isBreakingChang (conventionalCommit) {
  const commitNotes = _.get(conventionalCommit, 'conventionalCommit.notes')
  const isBreakingChang = _.some(commitNotes, { title: 'BREAKING CHANGE' })

  return isBreakingChang
}

/**
 * 判斷 commit 是否屬於可以出現在 Release Notes 的類型，判斷條件只要滿足以下其中一點即可：
 *
 * 1. commit type 是 feat 或 fix 其中一種
 * 2. commit notes 有 BREAKING CHANGE 這個關鍵字
 *
 * @param {Object} conventionalCommit - 傳進來的 commit 資料結構必須是 conventionalCommit 物件（conventional-commits-parser）
 * @param {Object} conventionalCommit.conventionalCommit
 * @param {Object[]} conventionalCommit.conventionalCommit.notes
 * @param {string} conventionalCommit.conventionalCommit.notes[].title - 如果這個 commit 屬於 BREAKING CHANGE，那它會出現在這
 * @param {Object[]} conventionalCommit.conventionalCommit.type - Conventional commit 的 type，通常是 fix 或 refactor 之類的
 * @returns {boolean} 如果為 true，那麼這個 commit 屬於可以出現在 Release Notes 的 commit
 * @see https://github.com/conventional-changelog-archived-repos/conventional-commits-parser
 */
function isReleasableCommit (conventionalCommit) {
  const isReleasableCommit = (
    isFeatureOrBugfix(conventionalCommit) ||
    isBreakingChang(conventionalCommit)
  )

  return isReleasableCommit
}

/**
 * 封裝 conventionalCommit 成 Release Template 的格式
 *
 * @example
 * _.group(
 *   [
 *     { conventionalCommit: { type:'feat', subject: 'foo' } }
 *     { conventionalCommit: { type:'fix', subject: 'bar' } }
 *     { conventionalCommit: { type:'feat', subject: 'hello' } }
 *     { conventionalCommit: { type:'feat', subject: 'world', notes: [{ title: 'BREAKING CHANGE' }] } }
 *   ]
 * , groupReleasableCommit)
 * =>
 * {
 *   breakingChange: [
 *     { conventionalCommit: { type:'feat', subject: 'world', notes: [{ title: 'BREAKING CHANGE' }] } }
 *   ],
 *   feat: [
 *     { conventionalCommit: { type:'feat', subject: 'foo' } },
 *     { conventionalCommit: { type:'feat', subject: 'hello' } }
 *   ],
 *   fix: [
 *     { conventionalCommit: { type:'fix', subject: 'bar' } }
 *   ]
 * }
 */
function groupReleasableCommit (conventionalCommit) {
  const commitType = _.get(conventionalCommit, 'conventionalCommit.type')

  return isBreakingChang(conventionalCommit)
    ? 'breakingChange'
    : commitType
}

/**
 * 產生一個 function，用來判斷傳進來的物件 property 屬於哪一種 semver type：
 *
 * 1. breakingChange => major
 * 2. feat => minor
 * 3. fix => patch
 *
 * @example
 * getReleaseTypeFactory()({ breakingChange, feat, fix })
 * => "major"
 * @example
 * getReleaseTypeFactory()({ feat, fix })
 * => "minor"
 * @example
 * getReleaseTypeFactory()({ fix })
 * => "patch"
 * @example
 * getReleaseTypeFactory()({ foo })
 * => undefined
 */
function getSemverTypeFactory () {
  return _.cond([
    [_.property('breakingChange'), _.constant('major')],
    [_.property('feat'), _.constant('minor')],
    [_.property('fix'), _.constant('patch')]
  ])
}
