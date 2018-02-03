const onPushedMaster = require('./handler/onPushedMaster')
const onReleasePROpened = require('./handler/onReleasePROpened')

/**
 * Conventional Release Bot
 *
 * 這是一個使用 Probot 開發的 GitHub App，
 * 根據 Conventional Commits 自動化 GitHub Releases。
 *
 * 功能：
 *
 * 1. 當有 commits 被 push 上 master、或是有 PR 被 merge 進 master 的時候，
 * 這個機器人就會檢查所有 commits，
 * 並將其中符合 Conventional Commits 規範的 commits 寫進 GitHub Releases Note，
 * 然後建立 SemVer tag 版本號。
 *
 * 2. 當有 PR 被建立，並且目標是 merge 進 master 的時候，
 * 機器人會在該 PR 頁面底下留言，預覽 GitHub Releases Note 的內容。
 *
 * @see {@link http://conventionalcommits.org | Conventional Commits}
 * @see {@link https://developer.github.com/apps | GitHub App}
 * @see {@link https://probot.github.io | Probot}
 */
module.exports = (robot) => {
  robot.on('push', onPushedMaster)
  robot.on('pull_request', onReleasePROpened)

  robot.log('Conventional Release Bot is on!')
}
