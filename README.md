<p align="center" >
  <img height="64" src="https://user-images.githubusercontent.com/559351/34089642-b019fec8-e3ec-11e7-8c26-569195570252.png">
</p>

# GitHub Conventional Release Bot

> A GitHub App built with [Probot](https://github.com/probot/probot) that creates GitHub Release following [Conventional Commits](http://conventionalcommits.org/)

## Conventional Commits

The commit message should be structured as follows:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

The commit contains the following structural elements, to communicate intent to the consumers of your library:

1. **fix**: a commit of the _type_ `fix` patches a bug in your codebase (this correlates with [PATCH](http://semver.org/#summary) in semantic versioning).
2. **feat**: a commit of the _type_ `feat` introduces a new feature to the codebase (this correlates with [MINOR](http://semver.org/#summary) in semantic versioning).
3. **BREAKING CHANGE**: a commit that has the text `BREAKING CHANGE:` at the beginning of its optional body or footer section introduces a breaking API change (correlating with [Major](http://semver.org/#summary) in semantic versioning). A breaking change can be part of commits of any _type_. e.g., a `fix:`, `feat:` & `chore:` types would all be valid, in addition to any other _type_.

A scope may be provided to a commit’s type, to provide additional contextual information and is contained within parenthesis, e.g., `feat(parser):` add ability to parse arrays.

Commit _types_ other than `fix:` and `feat:` are allowed, for example [the Angular convention](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit) recommends `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:`, but these tags are not mandated by the conventional commits specification.

See more http://conventionalcommits.org/

## Installation

```
# Install dependencies
npm install

# Run the bot
npm start
```

See [docs/deploy.md](docs/deploy.md) if you would like to run your own instance of this app.

### Permissions

![Repository contents Access: Read & Write](https://user-images.githubusercontent.com/559351/34095403-40e42ca2-e40c-11e7-9fe6-eb28864bfc46.png)

### Subscribe to events

![Subscribe to events: Push](https://user-images.githubusercontent.com/559351/34095741-8fbe3a6a-e40d-11e7-923d-e2e959c724ab.png)


## Example

### Patch Release (Bug Fixes)

![screen shot 2017-12-18 at 14 47 06](https://user-images.githubusercontent.com/559351/34094930-417e2dcc-e40a-11e7-9356-c696f9973725.png)
![screen shot 2017-12-18 at 14 58 50](https://user-images.githubusercontent.com/559351/34094929-4152e6da-e40a-11e7-9a0f-fdba6c1bfeec.png)

### Minor Release (New Features)

![screen shot 2017-12-18 at 14 25 22](https://user-images.githubusercontent.com/559351/34094933-41cceac0-e40a-11e7-92c0-ece88fb67a9e.png)
![screen shot 2017-12-18 at 14 26 50](https://user-images.githubusercontent.com/559351/34094931-41a64d52-e40a-11e7-8323-5537c1335477.png)

### Major Release (Breaking Changes)

![screen shot 2017-12-18 at 14 59 14](https://user-images.githubusercontent.com/559351/34094935-421b34c8-e40a-11e7-9098-806392f89b06.png)
![screen shot 2017-12-18 at 14 59 53](https://user-images.githubusercontent.com/559351/34094934-41f31a24-e40a-11e7-8fbd-6cafe18d9337.png)
