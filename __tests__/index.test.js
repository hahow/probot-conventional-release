// You can import your modules
// const index = require('../index')
const convertToConventionalCommit = require('../lib/convertToConventionalCommit')

test('Conventional Commit 的 scope 應該正確解析斜線（例如：controllers/auth）', () => {
  const fakeCommit = {
    message: 'fix(controllers/auth): oauth login failed'
  }

  const {
    type,
    scope,
    subject
  } = convertToConventionalCommit(fakeCommit)

  expect(type).toBe('fix')
  expect(scope).toBe('controllers/auth')
  expect(subject).toBe('oauth login failed')
})

test('Conventional Commit 的 scope 應該正確解析空格（例如：controllers auth）', () => {
  const fakeCommit = {
    message: 'fix(controllers auth): oauth login failed'
  }

  const {
    type,
    scope,
    subject
  } = convertToConventionalCommit(fakeCommit)

  expect(type).toBe('fix')
  expect(scope).toBe('controllers auth')
  expect(subject).toBe('oauth login failed')
})

const isBreakingChangeCommit = require('../lib/isBreakingChangeCommit')

test('isBreakingChangeCommit() 應該正確判斷 conventional commit 屬於 BREAKING CHANGE', () => {
  const fakeConventionalCommit = {
    notes: [
      {
        title: 'BREAKING CHANGE',
        text: 'some breaking change.\nThanks @stevemao'
      }
    ]
  }

  const isBreakingChange = isBreakingChangeCommit(fakeConventionalCommit)

  expect(isBreakingChange).toBe(true)
})

const isFeatureCommit = require('../lib/isFeatureCommit')

test('isFeatureCommit() 應該正確判斷 conventional commit 屬於 New Feature', () => {
  const fakeConventionalCommit = {
    type: 'feat'
  }

  const isFeature = isFeatureCommit(fakeConventionalCommit)

  expect(isFeature).toBe(true)
})

const isHotfixCommit = require('../lib/isHotfixCommit')

test('isHotfixCommit() 應該正確判斷 conventional commit 屬於 Hotfix', () => {
  const fakeConventionalCommit = {
    type: 'fix'
  }

  const isHotfix = isHotfixCommit(fakeConventionalCommit)

  expect(isHotfix).toBe(true)
})

// For more information about testing with Jest see:
// https://facebook.github.io/jest/
