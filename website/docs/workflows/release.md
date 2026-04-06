---
id: release
title: release.yml
sidebar_position: 2
---

# release.yml

Triggered when a PR is merged into `master`. Publishes the release artifact, creates a git tag and GitHub Release, then opens a back-merge PR into `develop` to keep the two branches in sync.

## What It Does

```mermaid
flowchart TD
    A([PR merged into master]) --> BUILD_JOB["Job: build"]

    BUILD_JOB --> B{SERVICE_NAME provided?}
    B -- No --> LIB_RELEASE["mvn deploy -Pbuild<br/>→ CodeArtifact release artifact"]
    B -- Yes --> DEP_RELEASE["mvn spring-boot:build-image<br/>Push to ECR:<br/>x.x.x · latest · sha"]

    LIB_RELEASE --> TAG_JOB["Job: tag-release"]
    DEP_RELEASE --> TAG_JOB

    TAG_JOB --> TAG["Create git tag x.x.x<br/>Create GitHub Release"]
    TAG --> MERGE_JOB["Job: merge-2-develop"]

    MERGE_JOB --> C{Hotfix?<br/>patch &gt; 0?}
    C -- No --> BUMP["Increment minor version<br/>e.g. 1.2.0 → 1.3.0-SNAPSHOT"]
    C -- Yes --> SKIP["Skip version bump<br/>develop keeps current SNAPSHOT"]

    BUMP --> PR["Open PR: merge/x.x.x → develop"]
    SKIP --> PR

    classDef job fill:#003366,stroke:#003366,color:#ffffff
    classDef step fill:#1a2e4a,stroke:#1a2e4a,color:#ffffff
    classDef artifact fill:#155724,stroke:#155724,color:#ffffff
    classDef decision fill:#7d4e00,stroke:#7d4e00,color:#ffffff
    classDef gitop fill:#3d1a78,stroke:#3d1a78,color:#ffffff

    class BUILD_JOB,TAG_JOB,MERGE_JOB job
    class TAG gitop
    class LIB_RELEASE,DEP_RELEASE artifact
    class C decision
    class BUMP,SKIP,PR step
```

## Caller Permissions

The job in your project that calls this workflow **must** declare:

```yaml
permissions:
  contents: write
  pull-requests: write
```

GitHub only passes down the permissions the caller explicitly grants to nested reusable workflow jobs. Without this block, the `tag-release` job cannot push a git tag or create a GitHub Release (`contents: write`), and the `merge-2-develop` job cannot open the back-merge PR (`pull-requests: write`).

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `AWS_REGION` | Yes | — | AWS region for CodeArtifact and ECR |
| `SERVICE_NAME` | No | `''` | ECR repository name. Omit for library projects. |
| `java-version` | No | `'21'` | Temurin JDK version passed to `actions/setup-java` in both the `build` and `merge-2-develop` jobs. |
| `working-directory` | No | `'.'` | Directory containing `pom.xml`. Set to the service subdirectory in a monorepo. Applied to all three jobs: `build`, `tag-release`, and `merge-2-develop`. |

## Three Jobs

### 1. `build`

Identical to `build.yml` except the image tag for deployables is the **exact project version** (no build number suffix):

| Workflow | Image tag |
|---|---|
| `build.yml` | `x.x.x.<run_number>` |
| `release.yml` | `x.x.x` |

For libraries, runs `mvn deploy -Pbuild` to publish the release JAR to CodeArtifact.

### 2. `tag-release`

Uses a **GitHub App token** (not `GITHUB_TOKEN`) to:

1. Read the project version from `pom.xml`.
2. Create an annotated git tag with that version.
3. Push the tag to the remote.
4. Create a GitHub Release with auto-generated release notes.

:::info Why a GitHub App token?
`GITHUB_TOKEN` cannot trigger further workflow runs — a security restriction GitHub imposes to prevent infinite loops. The version-bump commit and back-merge PR created in the next job need to re-trigger CI on `develop`. A GitHub App token bypasses this restriction. See [GitHub App Setup](../guides/github-app-setup).
:::

### 3. `merge-2-develop`

Opens a PR to keep `develop` in sync with `master` after the release. The branch is named `merge/<version>`.

The job also handles the **version bump** logic. It reads the patch component of the release version:

| Release version | Patch | Action |
|---|---|---|
| `1.2.0` (normal release) | `0` | Increment minor: `develop` → `1.3.0-SNAPSHOT` |
| `1.2.1` (hotfix) | `> 0` | Skip bump: `develop` keeps its current SNAPSHOT version |

This distinction matters because a hotfix is an emergency patch off `master` — `develop` is already ahead of it and has the correct next version. A normal release, by contrast, has just cut a version that `develop` needs to move past.

The merge uses `git merge -X ours origin/master` — if there are conflicts, `develop`'s files win automatically.

## Monorepo Usage

In a monorepo, pass `working-directory` alongside `paths:` in the trigger to scope the release workflow to a single service. All three jobs (`build`, `tag-release`, `merge-2-develop`) run their Maven and git commands from that subdirectory.

```yaml
# .github/workflows/release-my-service.yml
name: "Release My Service"

on:
  pull_request:
    types: [closed]
    branches: [master]
    paths: ['services/my-service/**']   # only trigger for this service

jobs:
  release-workflow:
    uses: awesomaticza/github-workflows/.github/workflows/release.yml@master
    permissions:
      contents: write
      pull-requests: write
    with:
      AWS_REGION: ${{ vars.AWS_REGION }}
      SERVICE_NAME: my-service
      java-version: '25'
      working-directory: services/my-service   # pom.xml lives here
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

The `merge-2-develop` job reads and bumps `pom.xml` inside `working-directory`, so the version commit and back-merge PR correctly update only the service that was released — other services in the monorepo are untouched.

:::warning Always merge the back-merge PR
The back-merge PR is not optional. If you skip it, `develop` diverges from `master`. For a normal release this means the version bump is lost — the next release will be cut from the wrong version. For a hotfix, the fix itself is lost from the development line and will reappear as a bug in the next release.

**Always merge the back-merge PR before starting any new feature work.**
:::
