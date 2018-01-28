const get = require('lodash/get')

const DEFAULT_INITIAL_VERSION = '0.0.0'

/**
 * 取得最後一次 GitHub Releases 的 tag，如果沒有則回傳 "0.0.0"
 * 
 * @param {Context} context Probot Context object, see @{link https://probot.github.io/api/latest/Context.html}
 * @param {Object} options
 * @param {string} options.initialVersion If repo has not latest GitHub Releases, use this as return value.
 * @returns {string} Return repo latest GitHub Releases tag name or initialVersion.
 */
module.exports = async (context, { initialVersion }) => {
  const owner = get(context, 'payload.repository.owner.name')
  const repo = get(context, 'payload.repository.name')

  // 因為在 repo 沒有 release 的情況下，
  // context.github.repos.getLatestRelease() 會拋出 Error，
  // 所以用 try cache 來處理 Error 統一回傳 initialVersion
  try {
    const latestRelease = await context.github.repos.getLatestRelease({ owner, repo })
    const latestReleaseTagName = get(latestRelease, 'data.tag_name')

    return latestReleaseTagName
  } catch (error) {
    return initialVersion || DEFAULT_INITIAL_VERSION
  }
}
