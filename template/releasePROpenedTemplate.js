module.exports = `
## {{tag}} {{#if date}}({{date}}){{/if}}

{{#if commits.breakingChange}}
### :scream: BREAKING CHANGES :bangbang:

{{#each commits.breakingChange}}
- {{#if scope}}**{{scope}}**: {{/if}}{{subject}} (https://github.com/{{../owner}}/{{../repo}}/commit/{{sha}}) by {{author.name}}
{{/each}}

{{/if}}
{{#if commits.feat}}
### :tada: New Features

{{#each commits.feat}}
- {{#if scope}}**{{scope}}**: {{/if}}{{subject}} (https://github.com/{{../owner}}/{{../repo}}/commit/{{sha}}) by {{author.name}}
{{/each}}

{{/if}}
{{#if commits.fix}}
### :bug: Bug Fixes

{{#each commits.fix}}
- {{#if scope}}**{{scope}}**: {{/if}}{{subject}} (https://github.com/{{../owner}}/{{../repo}}/commit/{{sha}}) by {{author.name}}
{{/each}}

{{/if}}
`
