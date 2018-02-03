const get = require('lodash/get')
const groupBy = require('lodash/groupBy')
const moment = require('moment')
const semver = require('semver')

const compileReleaseTemplate = require('../lib/compileReleaseTemplate')
const convertToReleasableCommits = require('../lib/convertToReleasableCommits')
const getLatestReleaseTag = require('../lib/getLatestReleaseTag')
const getSemverType = require('../lib/getSemverType')
const getTemplatableCommitType = require('../lib/getTemplatableCommitType')

const pushedMasterTemplate = require('../template/pushedMasterTemplate')

const defaultConfig = {
  INITIAL_VERSION: '0.0.0',
  RELEASE_BRANCH: 'master',
  RELEASE_TEMPLATE: pushedMasterTemplate
}

module.exports = async (context) => {
  context.log('Push event is trigger!')

  // Reads the app configuration from the given YAML file in the .github directory of the repository.
  const config = await context.config('conventional-release.yml', defaultConfig)

  // Prepare basic params for GitHub APIs.
  const owner = get(context, 'payload.repository.owner.name')
  const repo = get(context, 'payload.repository.name')

  /**
   * Step 1.
   *
   * Determine correct branch that commits will pushing.
   */

  // The full Git ref that was pushed. Example: refs/heads/master.
  const ref = get(context, 'payload.ref')

  if (ref !== `refs/heads/${config.RELEASE_BRANCH}`) {
    context.log(`${owner}/${repo} pushed branch is ${ref}, not ${config.RELEASE_BRANCH}, exit this process.`)

    return
  }

  /**
   * Step 2.
   * 
   * Retrieve Git tag of the previous GitHub Releases, it should be a SemVer.
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
   * Step 3.
   * 
   * Filter, and convert all commits to releasable format.
   */

  const allCommits = get(context, 'payload.commits')

  context.log(`${owner}/${repo} has ${allCommits.length} commits`)

  const releasableCommits = convertToReleasableCommits(allCommits)

  if (releasableCommits.length === 0) {
    context.log(`${owner}/${repo} has not found any releasable commits, exit this process`)

    return
  }

  context.log(`${owner}/${repo} has ${releasableCommits.length} releasable commits`)

  /**
   * Step 4.
   * 
   * Compile releasable commits template, and release it to GitHub Releases.
   */

  const templatableCommits = groupBy(releasableCommits, getTemplatableCommitType)

  const nextReleaseType = getSemverType(templatableCommits)

  const nextReleaseVersion = semver.inc(latestReleaseTag, nextReleaseType)
  const nextReleaseTag = `v${nextReleaseVersion}`

  context.log(`${owner}/${repo} next GitHub Releases tag is ${nextReleaseTag}`)

  const nextReleaseDate = moment(new Date()).format('YYYY-MM-DD')

  const compiledReleaseBody = compileReleaseTemplate(config.RELEASE_TEMPLATE)({
    owner,
    repo,
    commits: templatableCommits,
    date: nextReleaseDate,
    preTag: latestReleaseTag,
    tag: nextReleaseTag
  })

  try {
    await context.github.repos.createRelease({
      owner,
      repo,
      tag_name: nextReleaseTag,
      target_commitish: config.RELEASE_BRANCH,
      name: nextReleaseTag,
      body: compiledReleaseBody,
      draft: false,
      prerelease: false
    })

    context.log(`${owner}/${repo} GitHub Releases complete!`)
  } catch (error) {
    context.log(`${owner}/${repo} GitHub Releases fail...`)
  }
}
