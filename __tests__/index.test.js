// You can import your modules
// const index = require('../index')
const convertToConventionalCommit = require('../lib/convertToConventionalCommit')

test('ConventionalCommit 的 scope 應該正確解析斜線（例如：controllers/auth）', () => {
  const fakeResponse = {
    commit: {
      message: 'fix(controllers/auth): oauth login failed'
    }
  }

  const {
    conventionalCommit: {
      type,
      scope,
      subject
    }
  } = convertToConventionalCommit(fakeResponse)

  expect(type).toBe('fix')
  expect(scope).toBe('controllers/auth')
  expect(subject).toBe('oauth login failed')
})

// For more information about testing with Jest see:
// https://facebook.github.io/jest/
