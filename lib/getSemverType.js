const cond = require('lodash/cond')
const constant = require('lodash/constant')
const property = require('lodash/property')

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
module.exports = (templatableCommits) =>
  cond([
    [property('breakingChange'), constant('major')],
    [property('feat'), constant('minor')],
    [property('fix'), constant('patch')]
  ])(templatableCommits)
