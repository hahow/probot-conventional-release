module.exports = async (context) => {
  robot.log('pull_request event is trigger!')

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
}
