---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

This guide walks you through wiring `github-workflows` into an existing Maven project.

## Prerequisites

| Requirement | Purpose |
|---|---|
| GitHub repository with `master` and `develop` branches | GitFlow branching model |
| A registered GitHub App with `contents: write` and `pull-requests: write` permissions | Required by the release workflow to push version-bump commits and create PRs without `GITHUB_TOKEN` restrictions — see [GitHub App Setup](./guides/github-app-setup) |
| AWS account with ECR and/or CodeArtifact set up | Artifact storage |
| `pom.xml` in the project root with a `-Pbuild` Maven profile | Used by all Maven commands in the workflows |

For the developer-side automation (creating release and hotfix branches), see [gitflow →](https://awesomaticza.github.io/gitflow/)

## Step 1 — Add `build.yml` to your project

Create `.github/workflows/build.yml` in your consumer project.

### Library (Maven JAR → AWS CodeArtifact)

```yaml
name: "Build My Library"

on:
  pull_request:
    types: [ closed ]
    branches: [ develop ]

jobs:
  build-workflow:
    uses: awesomaticza/github-workflows/.github/workflows/build.yml@master
    with:
      AWS_REGION: ${{ vars.AWS_REGION }}
    secrets:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      CODEARTIFACT_DOMAIN: ${{ secrets.CODEARTIFACT_DOMAIN }}
      CODEARTIFACT_RELEASES_REPO: ${{ secrets.CODEARTIFACT_RELEASES_REPO }}
      CODEARTIFACT_SNAPSHOTS_REPO: ${{ secrets.CODEARTIFACT_SNAPSHOTS_REPO }}
```

### Deployable (Spring Boot → Docker → AWS ECR)

```yaml
name: "Build My Service"

on:
  pull_request:
    types: [ closed ]
    branches: [ develop ]

jobs:
  build-workflow:
    uses: awesomaticza/github-workflows/.github/workflows/build.yml@master
    with:
      AWS_REGION: ${{ vars.AWS_REGION }}
      SERVICE_NAME: my-service
    secrets:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      CODEARTIFACT_DOMAIN: ${{ secrets.CODEARTIFACT_DOMAIN }}
      CODEARTIFACT_RELEASES_REPO: ${{ secrets.CODEARTIFACT_RELEASES_REPO }}
      CODEARTIFACT_SNAPSHOTS_REPO: ${{ secrets.CODEARTIFACT_SNAPSHOTS_REPO }}
```

`SERVICE_NAME` is the name of your ECR repository (e.g. `my-service`). Omit it entirely for library projects.

To use a Java version other than the default (`21`), pass `java-version` in the `with:` block:

```yaml
    with:
      AWS_REGION: ${{ vars.AWS_REGION }}
      java-version: '25'
```

## Step 2 — Add `release.yml` to your project

Create `.github/workflows/release.yml` in your consumer project.

### Library

```yaml
name: "Release My Library"

on:
  pull_request:
    types: [ closed ]
    branches: [ master ]

jobs:
  release-workflow:
    uses: awesomaticza/github-workflows/.github/workflows/release.yml@master
    permissions:
      contents: write
      pull-requests: write
    with:
      AWS_REGION: ${{ vars.AWS_REGION }}
    secrets:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      CI_APP_ID: ${{ secrets.CI_APP_ID }}
      CI_APP_PRIVATE_KEY: ${{ secrets.CI_APP_PRIVATE_KEY }}
      CODEARTIFACT_DOMAIN: ${{ secrets.CODEARTIFACT_DOMAIN }}
      CODEARTIFACT_RELEASES_REPO: ${{ secrets.CODEARTIFACT_RELEASES_REPO }}
      CODEARTIFACT_SNAPSHOTS_REPO: ${{ secrets.CODEARTIFACT_SNAPSHOTS_REPO }}
```

### Deployable

```yaml
name: "Release My Service"

on:
  pull_request:
    types: [ closed ]
    branches: [ master ]

jobs:
  release-workflow:
    uses: awesomaticza/github-workflows/.github/workflows/release.yml@master
    permissions:
      contents: write
      pull-requests: write
    with:
      AWS_REGION: ${{ vars.AWS_REGION }}
      SERVICE_NAME: my-service
    secrets:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      CI_APP_ID: ${{ secrets.CI_APP_ID }}
      CI_APP_PRIVATE_KEY: ${{ secrets.CI_APP_PRIVATE_KEY }}
      CODEARTIFACT_DOMAIN: ${{ secrets.CODEARTIFACT_DOMAIN }}
      CODEARTIFACT_RELEASES_REPO: ${{ secrets.CODEARTIFACT_RELEASES_REPO }}
      CODEARTIFACT_SNAPSHOTS_REPO: ${{ secrets.CODEARTIFACT_SNAPSHOTS_REPO }}
```

:::warning Required permissions on the caller job
The `permissions` block is **required** on the caller job. GitHub only passes permissions the caller explicitly grants to nested reusable workflow jobs. Without it, the `tag-release` and `merge-2-develop` jobs will fail — `tag-release` needs `contents: write` to push a git tag and create a GitHub Release; `merge-2-develop` needs `contents: write` and `pull-requests: write` to push the back-merge branch and open the PR.
:::

## Step 3 — Add secrets and variables to your repository

Go to your repository **Settings → Secrets and variables → Actions** and add:

| Name | Type | Required by |
|---|---|---|
| `AWS_REGION` | Variable | All workflows |
| `AWS_ACCESS_KEY_ID` | Secret | All workflows |
| `AWS_SECRET_ACCESS_KEY` | Secret | All workflows |
| `AWS_ACCOUNT_ID` | Secret | All workflows |
| `CODEARTIFACT_DOMAIN` | Secret | All workflows |
| `CODEARTIFACT_RELEASES_REPO` | Secret | All workflows |
| `CODEARTIFACT_SNAPSHOTS_REPO` | Secret | All workflows |
| `CI_APP_ID` | Secret | Release workflows only |
| `CI_APP_PRIVATE_KEY` | Secret | Release workflows only |

`CI_APP_ID` and `CI_APP_PRIVATE_KEY` are credentials for a GitHub App. See [GitHub App Setup](./guides/github-app-setup) for how to create and register one.

## Step 4 — Verify

Open a PR into `develop` and merge it. The `build.yml` workflow should trigger and either publish a SNAPSHOT artifact to CodeArtifact or push a Docker image to ECR, depending on whether you provided `SERVICE_NAME`.
