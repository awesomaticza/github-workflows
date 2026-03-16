# GitHub Actions Workflows

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-awesomaticza.github.io%2Fgithub--workflows-blue)](https://awesomaticza.github.io/github-workflows/)
[![Deploy Docs](https://github.com/awesomaticza/github-workflows/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/awesomaticza/github-workflows/actions/workflows/deploy-docs.yml)
[![Java 21](https://img.shields.io/badge/Java-21-orange?logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Maven](https://img.shields.io/badge/Maven-C71A36?logo=apachemaven&logoColor=white)](https://maven.apache.org/)
[![AWS ECR](https://img.shields.io/badge/AWS-ECR-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/ecr/)
[![AWS CodeArtifact](https://img.shields.io/badge/AWS-CodeArtifact-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/codeartifact/)

A library of reusable GitHub Actions workflows for the Awesomatic platform. Rather than duplicating CI/CD logic across every project, consuming projects reference these workflows via `workflow_call`, keeping pipelines consistent and changes centralised.

## Architecture

```mermaid
flowchart TD
    GHA["github-actions-workflows<br/>└─ workflows<br/>&nbsp;&nbsp;&nbsp;├─ build.yml<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ release.yml"]

    LIB["&lt;&lt;library&gt;&gt;<br/>raise-event-registry"]
    DEP["&lt;&lt;deployable&gt;&gt;<br/>raise-core"]

    GF["awesomatic-gitflow<br/>├─ Makefile<br/>└─ scripts<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ hotfix.sh<br/>&nbsp;&nbsp;&nbsp&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ release.sh"]

    GHA -."Reuse GitHub Actions Scripts".-> LIB
    GHA -."Reuse GitHub Actions Scripts".-> DEP
    LIB --"Add as Git Submodule"--> GF
    DEP --"Add as Git Submodule"--> GF

    classDef sharedrepo fill:#1a2e4a,stroke:#1a2e4a,color:#ffffff
    classDef consumer fill:#f0f0f0,stroke:#888888,color:#222222

    class GHA,GF sharedrepo
    class LIB,DEP consumer
```

Two types of projects consume these workflows:

| Project type | Example | Build workflow | Release workflow |
|---|---|---|---|
| **Library** — Maven JAR published to AWS CodeArtifact | `raise-event-registry` | `build.yml` | `release.yml` |
| **Deployable** — Spring Boot app published as Docker image to AWS ECR | `raise-core` | `build.yml` | `release.yml` |

Both project types also add `awesomatic-gitflow` as a git submodule to manage the `make release` / `make hotfix` commands that feed into these pipelines.

## Workflows

```mermaid
flowchart TD
    DEV_PR([PR merged into develop])
    MASTER_PR([PR merged into master])

    DEV_PR --> BUILD["build.yml"]
    MASTER_PR --> RELEASE["release.yml"]

    BUILD -- "SERVICE_NAME absent" --> CA_S["AWS CodeArtifact<br/>SNAPSHOT artifact"]
    BUILD -- "SERVICE_NAME present" --> ECR_B["AWS ECR<br/>x.x.x.build_num · latest · sha"]

    RELEASE -- "SERVICE_NAME absent" --> CA_R["AWS CodeArtifact<br/>Release artifact"]
    RELEASE -- "SERVICE_NAME present" --> ECR_R["AWS ECR<br/>x.x.x · latest · sha"]
    RELEASE --> TAG["Git Tag + GitHub Release"]
    TAG --> M2D["PR: merge/x.x.x → develop<br/>+ version bump"]

    classDef trigger fill:#003366,stroke:#003366,color:#ffffff
    classDef workflow fill:#155724,stroke:#155724,color:#ffffff
    classDef codeartifact fill:#7d4e00,stroke:#7d4e00,color:#ffffff
    classDef ecr fill:#5c2500,stroke:#5c2500,color:#ffffff
    classDef gitop fill:#3d1a78,stroke:#3d1a78,color:#ffffff
    classDef mergeback fill:#0a3d62,stroke:#0a3d62,color:#ffffff

    class DEV_PR,MASTER_PR trigger
    class BUILD,RELEASE workflow
    class CA_S,CA_R codeartifact
    class ECR_B,ECR_R ecr
    class TAG gitop
    class M2D mergeback
```

### `build.yml`
Triggered when a PR is merged into `develop`. Authenticates with AWS, configures Maven to resolve and deploy to AWS CodeArtifact, then publishes the artifact. If `SERVICE_NAME` is provided, builds a Docker image via `spring-boot:build-image` and pushes it to ECR tagged as `x.x.x.<build_number>`, `latest`, and the short commit hash. If `SERVICE_NAME` is omitted, runs `mvn deploy -Pbuild` to publish the SNAPSHOT artifact to CodeArtifact.

### `release.yml`
Triggered when a PR is merged into `master`. Publishes the release artifact, then:
1. Creates a git tag and GitHub release for the version in `pom.xml`
2. Opens a PR to merge `master` back into `develop`, bumping the minor version (e.g. `1.2.0` → `1.3.0-SNAPSHOT`). For hotfixes (patch version > 0), the version bump is skipped.

If `SERVICE_NAME` is provided, builds and pushes the Docker image to ECR tagged with the exact release version, `latest`, and the short commit hash before tagging. If `SERVICE_NAME` is omitted, runs `mvn deploy -Pbuild` to publish the release artifact to CodeArtifact.

## How to Use

### Library project (Maven JAR → AWS CodeArtifact)

`.github/workflows/build.yml` — triggered on PR merged into `develop`:

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

`.github/workflows/release.yml` — triggered on PR merged into `master`:

```yaml
name: "Release My Library"

on:
  pull_request:
    types: [ closed ]
    branches: [ master ]

jobs:
  release-workflow:
    uses: awesomaticza/github-workflows/.github/workflows/release.yml@master
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

---

### Deployable project (Docker image → AWS ECR)

`.github/workflows/build.yml` — triggered on PR merged into `develop`:

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

`.github/workflows/release.yml` — triggered on PR merged into `master`:

```yaml
name: "Release My Service"

on:
  pull_request:
    types: [ closed ]
    branches: [ master ]

jobs:
  release-workflow:
    uses: awesomaticza/github-workflows/.github/workflows/release.yml@master
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

## Required Secrets and Variables

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

`CI_APP_ID` and `CI_APP_PRIVATE_KEY` are credentials for a GitHub App. The release workflows use the app's token (rather than `GITHUB_TOKEN`) to push the version bump commit and create the merge-back PR — actions that the default token cannot trigger further workflow runs for.
