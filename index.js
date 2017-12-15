const conventionalCommitsParser = require('conventional-commits-parser')
const handlebars = require('handlebars')
const _ = require('lodash')
const Rx = require('rx')
const semver = require('semver')

/** 只有 push 到這個 branch 才會觸發 conventional release */
const DEFAULT_BRANCH = 'master'
/** 如果 GitHub repository 從來沒有建立過 release tag，可以指定一個初始版號 */
const INITIAL_VERSION = '0.0.0'
/** GitHub release notes 的 template，使用 Handlebars.js */
const RELEASE_TEMPLATE = `
## {{tag}} ({{date}})

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
 * 當有 PR 被 merge 回 master 或是 commits 被 push 到 master 時，
 * 這個 Probot 機器人就會檢查自從上一次 Release 以來一直到最新的所有 commits，
 * 將其中所有符合 Conventional Commits 規範的 commits 寫進 GitHub Release Notes，
 * 並根據 semver 更新 tag 版本號。
 *
 * @see {@link http://conventionalcommits.org | Conventional Commits}
 * @see {@link https://developer.github.com/apps | GitHub Apps}
 * @see {@link https://github.com/probot/probot | Probot}
 */
module.exports = (robot) => {
  robot.on('push', async (context) => {
    const ref = _.get(context, 'payload.ref')
    const repo = _.get(context, 'payload.repository.name')
    const owner = _.get(context, 'payload.repository.owner.name')

    // 只對 push master 的事件執行 conventional release
    if (ref !== `refs/heads/${DEFAULT_BRANCH}`) {
      robot.log(`🤖 ${owner}/${repo}：因為本次 merge 的對象是 ${ref} 而不是 ${DEFAULT_BRANCH}，所以不執行 Conventional Release。`)

      return
    }

    // 基本上所有 GitHub API 都會需要這些 parameters
    const defaultParams = {
      owner,
      repo
    }

    /**
     * 整個 Conventional Release 的步驟：
     *
     * Step 1. 取得自從最後一次 Release 之後的所有 Commits
     * Step 2. 將這些 Commits 封裝成可以支援 Release Template 的格式
     * Step 3. 建立 GitHub Release Notes
     */

    /**
     * 如果最後一次 release 的 tag 不符合 semver，就不會繼續往下執行了，因為也沒辦法算出下一個版號是多少
     */

    const latestReleaseTagName = await getLatestReleaseTagName()

    if (semver.valid(latestReleaseTagName) === false) {
      robot.log(`🤖 ${owner}/${repo}：因為上一次 Release 的 Tag 不符合 Semver，所以放棄接下來的 Release，蓋牌結束這回合。`)

      return
    }

    /**
     * Step 1. 取得自從最後一次 Release 之後的所有 Commits
     */

    // 一次取 100 筆 commits（GitHub API 的上限）
    const getCommitsSinceLatestReleaseAsync = getCommitsSince(latestReleaseTagName)({ per_page: 100 })

    // 使用 RxJS 的 expand 的遞迴特性，一次拿完所有分頁的所有 commits
    // 詳細原理可以參考我的文章 http://blog.amowu.com/2017/12/rxjs-pagination-with-github-api.html
    const getAllCommitsSinceLatestRelease$ = Rx.Observable
      .fromPromise(getCommitsSinceLatestReleaseAsync)
      .expand(checkNextPage)
      .reduce(concatAllCommits, [])

    const allCommitsSinceLatestRelease = await getAllCommitsSinceLatestRelease$.toPromise()

    robot.log(`🤖 ${owner}/${repo}：自從最後一次 Release 之後的所有 Commits 一共 ${allCommitsSinceLatestRelease.length} 筆`)

    /**
     * Step 2. 將所有 Commits 封裝成 compileReleaseTemplate(context) 的 context 資料結構
     */

    const conventionalCommitsSinceLatestRelease = _
      .chain(allCommitsSinceLatestRelease)
      // 因為最後一筆 commit 已經被 merge 了，所以需要先移除掉
      .dropRight()
      // 透過 conventionalCommitsParser 封裝所有 commits 成為 conventionalCommit 物件
      .map(convertToConventionalCommit)
      // 過濾掉不是 feat、fix 和 BREAKING CHANGE 的 commits
      .filter(isReleasableCommit)
      // 封裝成為 compileReleaseTemplate(context) 的 context 物件
      .groupBy(groupReleasableCommit)
      .value()

    robot.log(`🤖 ${owner}/${repo}：封裝之後的格式長這樣：`, conventionalCommitsSinceLatestRelease)

    /**
     * Step 3. 建立 GitHub Release Notes
     */

    // 根據 commits 的 conventional type 來取得接下來 release 更新的版本類型，
    // 例：major、minor 或 patch，如果沒有則結束 release
    const nextReleaseType = getReleaseTypeFactory()(conventionalCommitsSinceLatestRelease)

    if (_.isUndefined(nextReleaseType)) {
      robot.log(`🤖 ${owner}/${repo}：因為這次沒有發現任何可以 Release 的 Commit Type，所以蓋牌結束這回合。`)

      return
    }

    const nextReleaseVersion = semver.inc(latestReleaseTagName, nextReleaseType)
    const nextReleaseTagName = `v${nextReleaseVersion}`

    robot.log(`🤖 ${owner}/${repo}：本次預計 Release 的 Tag：${nextReleaseTagName}`)

    // 用來顯示 Release Notes 的時間，只取日期的部分
    const nextReleaseDate = _
      .chain(context)
      .get('payload.head_commit.timestamp')
      .split('T')
      .head()
      .value()

    // 編譯 Release Notes 的內容
    const compiledReleaseBody = compileReleaseTemplate({
      ...defaultParams,
      commits: conventionalCommitsSinceLatestRelease,
      date: nextReleaseDate,
      preTag: latestReleaseTagName,
      tag: nextReleaseTagName
    })

    robot.log(`🤖 ${owner}/${repo}：本次預計 Release 的內容如下：`, compiledReleaseBody)

    try {
      // 建立 Release Notes！🚀
      await context.github.repos.createRelease({
        ...defaultParams,
        tag_name: nextReleaseTagName,
        target_commitish: DEFAULT_BRANCH,
        name: nextReleaseTagName,
        body: compiledReleaseBody,
        draft: false,
        prerelease: false
      })

      robot.log(`🤖 ${owner}/${repo}：Release 完成了 🎉`)
    } catch (error) {
      robot.log(`🤖 ${owner}/${repo}：不知道為什麼 Release 失敗了⋯⋯。`)
    }

    /**
     * 取得最後一次 release 的 tag，如果沒有 release 過，否則回傳 "0.0.0"
     */
    async function getLatestReleaseTagName () {
      // 因為從來沒 release 過的情況下，
      // context.github.repos.getLatestRelease 會拋出 Error，
      // 所以用 try cache 來處理，error 統一回傳 INITIAL_VERSION
      try {
        const latestRelease = await context.github.repos.getLatestRelease({ owner, repo })

        const latestReleaseTagName = _.get(latestRelease, 'data.tag_name')

        robot.log(`🤖 ${owner}/${repo}：最後一次 Release 的 Tag：${latestReleaseTagName}`)

        return latestReleaseTagName
      } catch (error) {
        robot.log(`🤖 ${owner}/${repo}：因為找不到最後一次 Release 的資料。所以版本從 ${INITIAL_VERSION} 開始計算。`)

        return INITIAL_VERSION
      }
    }

    function getCommitsFactory (initialParams) {
      return function (params) {
        return context.github.repos.getCommits({
          ...defaultParams,
          ...initialParams,
          ...params
        })
      }
    }

    /**
     * 指定 tag，取得自從 tag 之後的所有 commits，規則如下：
     *
     * 1. 如果是 tag 是 INITIAL_VERSION（ex: 0.0.0），直接使用 getCommits API
     * 2. 否則一般情況會是使用 getCommits API 搭配 since（從哪個時間點開始取 commits）參數
     */
    function getCommitsSince (tagName) {
      return async function (params) {
        if (tagName === INITIAL_VERSION) {
          return getCommitsFactory()(params)
        } else {
          /**
           * 要拿到最後一次 release commit 的時間有點麻煩，需要經過以下步驟：
           *
           * 1. 先拿到這個 repo 的所有 tags
           * 2. 找出最後一次 release 的 tag commit 的 SHA
           * 3. 根據這個 SHA 去取得該作者 commit 的時間
           */

          // 拿到這個 repo 的所有 tags
          const tags = await context.github.repos.getTags({ owner, repo })

          // 找出最後一次 release 的 tag commit 的 SHA
          const latestReleaseTagSHA = _
            .chain(tags)
            .get('data')
            .find({ name: tagName })
            .get('commit.sha')
            .value()

          robot.log(`🤖 ${owner}/${repo}：最後一次 Release Tag 的 SHA：${latestReleaseTagSHA}`)

          /**
           * 取得最後一次 release commit 的時間戳
           */

          const { data: latestReleaseCommit } = await context.github.repos.getCommit({
            owner,
            repo,
            sha: latestReleaseTagSHA
          })

          const latestReleaseCommitDate = _.get(latestReleaseCommit, 'commit.author.date')

          robot.log(`🤖 ${owner}/${repo}：最後一次 Release 的 Commit 時間：${latestReleaseCommitDate}`)

          // 回傳一個客製化、可以取得自從上一次 release 之後所有 commits 的 GitHub getCommits API
          return getCommitsFactory({ since: latestReleaseCommitDate })(params)
        }
      }
    }

    function checkNextPage (response) {
      // 如果 getCommits API 還有下一頁，
      // 繼續使用 getNextPage API 取得下一頁的 commits，
      // 反之回傳 Rx.Observable.empty() 結束 Rx.Observable.expand() 的遞迴計算
      return context.github.hasNextPage(response)
        ? Rx.Observable.fromPromise(context.github.getNextPage(response))
        : Rx.Observable.empty()
    }
  })
}

/**
 * @returns {Array} 將 RxJS stream 之中的所有 GitHub getCommits API response.data 組合成一個一維陣列，
 * 例如：[...response1.data, ...response2.data, ...response3.data]
 */
function concatAllCommits (acc, curr) {
  return acc.concat(curr.data)
}

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
function convertToConventionalCommit ({ commit: { author, message }, sha }) {
  const conventionalCommit = conventionalCommitsParser.sync(message)

  return {
    conventionalCommit,
    sha,
    author
  }
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
  const isReleasableCommit =
    _.includes(['feat', 'fix'], _.get(conventionalCommit, 'conventionalCommit.type')) ||
    isBreakingChang(conventionalCommit)

  return isReleasableCommit
}

/**
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
  return isBreakingChang(conventionalCommit)
    ? 'breakingChange'
    : _.get(conventionalCommit, 'conventionalCommit.type')
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
function getReleaseTypeFactory () {
  return _.cond([
    [_.property('breakingChange'), _.constant('major')],
    [_.property('feat'), _.constant('minor')],
    [_.property('fix'), _.constant('patch')]
  ])
}
