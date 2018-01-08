<p align="center" >
  <img height="64" src="https://user-images.githubusercontent.com/559351/34089642-b019fec8-e3ec-11e7-8c26-569195570252.png">
</p>

# GitHub Conventional Release Bot

[![Build Status](https://travis-ci.org/amowu/probot-conventional-release.svg?branch=master)](https://travis-ci.org/amowu/probot-conventional-release)

> A GitHub App built with [Probot](https://github.com/probot/probot) that creates [GitHub Release](https://help.github.com/articles/about-releases/) following [Conventional Commits](http://conventionalcommits.org/).

## Usage

1. Install and configure the GitHub App: [github.com/apps/conventional-release-bot](https://github.com/apps/conventional-release-bot)
2. Add commit that message structure should following [Conventional Commits](http://conventionalcommits.org/)

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

3. Push commits (or merged PR) to master branch, and then the [GitHub Release](https://help.github.com/articles/about-releases/) will be created

![1_luxfee4jnww2lr9_22sdca](https://user-images.githubusercontent.com/559351/34299744-8a5f42da-e75f-11e7-8dcb-5ca9044759b3.png)

1. Git tags (based on [SemVer](https://semver.org/))
2. Release date
3. Release types: **Bug Fixes**, **New Features** and **BREAKING CHANGES** (follow [Conventional Commits](https://conventionalcommits.org/)'s type)
4. Commit's scope (follow [Conventional Commits](https://conventionalcommits.org/)'s scope)
5. Commit's description
6. Commit's SHA
7. Commit's author
8. Diff with last release

## Developer Guide

Follow the [Configure a GitHub App](https://probot.github.io/docs/development/#configure-a-github-app) section of Probot document to create your GitHub App

### Requirements

- node >= 8.9.3
- yarn >= 1.3.2

### Permissions

- Pull requests Access: **Read  & write**
- Repository contents Access: **Read & write**

![screen shot 2018-01-08 at 17 53 42](https://user-images.githubusercontent.com/559351/34665912-f4b93ace-f49c-11e7-8018-1b29693a5578.png)

### Subscribe to events

- Pull request

![screen shot 2018-01-08 at 12 22 52](https://user-images.githubusercontent.com/559351/34658994-e37ea75e-f46e-11e7-81a6-bc61bfadfab5.png)

### Installation

Clone repository:

```
$ git clone https://github.com/hahow/probot-conventional-release.git
```

Install packages:

```
$ yarn install
```

Run Probot server:

```
$ yarn start
```

### Deployment

You can deploy the app to [Glitch](https://probot.github.io/docs/deployment/#glitch), [Heroku](https://probot.github.io/docs/deployment/#heroku) or [Now](https://probot.github.io/docs/deployment/#now).
