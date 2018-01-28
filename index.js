const onPushedMaster = require('./handler/onPushedMaster')
const onReleasePROpened = require('./handler/onReleasePROpened')

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
  robot.on('push', onPushedMaster)
  robot.on('pull_request', onReleasePROpened)

  robot.log('Conventional release bot is on!')
}
