---
id: intro
slug: /
title: Introduction
sidebar_position: 1
---

# github-workflows

`github-workflows` is a library of **reusable GitHub Actions workflows** for the GitFlow branching and release strategy. Consumer projects reference these centrally-managed workflows via `workflow_call`, keeping CI/CD logic consistent and changes centralised.

It is the server-side counterpart to [gitflow](https://awesomaticza.github.io/gitflow/) — the developer-side automation toolkit. Together the two repos cover the full GitFlow lifecycle.

:::note Tech stack
The workflows are built around **Java 21**, **Spring Boot**, **Apache Maven**, **AWS Elastic Container Registry (ECR)**, and **AWS CodeArtifact**. This reflects the platform they were designed for, but the patterns are straightforward to adapt to any tech stack, cloud provider, or artifact registry.

**Gradle support** is on the roadmap.
:::

## What Problem Does It Solve?

Without this repo, every project would need to duplicate hundreds of lines of CI/CD YAML. With `workflow_call`, a consuming project's entire build pipeline is a 15-line file that says "run that centralised workflow with these inputs and secrets."

Changes to the pipeline — upgrading a GitHub Action version, tweaking image tagging, fixing a Maven command — happen once here and propagate to every consumer automatically.

## Full Architecture

```mermaid
flowchart TD
    LIB["&lt;&lt;library&gt;&gt;<br/>commons"]
    DEP["&lt;&lt;deployable&gt;&gt;<br/>web-application"]

    GF["gitflow<br/>├─ Makefile<br/>└─ scripts<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ hotfix.sh<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ release.sh"]

    GW["github-workflows<br/>└─ .github/workflows<br/>&nbsp;&nbsp;&nbsp;├─ build.yml<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ release.yml"]

    LIB --"Add as Git Submodule"--> GF
    DEP --"Add as Git Submodule"--> GF
    GW -."Reuse via workflow_call".-> LIB
    GW -."Reuse via workflow_call".-> DEP

    classDef sharedrepo fill:#1a2e4a,stroke:#1a2e4a,color:#ffffff
    classDef consumer fill:#f0f0f0,stroke:#888888,color:#222222

    class GF,GW sharedrepo
    class LIB,DEP consumer
```

Consumer projects wire in both repos:

- **[gitflow](https://awesomaticza.github.io/gitflow/)** — add the [gitflow repository](https://github.com/awesomaticza/gitflow) as a git submodule in the root folder of the consumer project. To initiate the process, developers execute `make release` or `make hotfix` locally, which creates the corresponding branch and opens a PR all in one step.
- **`github-workflows`** - this [repository](https://github.com/awesomaticza/github-workflows) is referenced via `workflow_call` from the GitHub Actions scripts in the consumer's own `.github/workflows` folder. Once the PR lands on `master`, GitHub Actions takes over: publishing artifacts, tagging the release, and opening a back-merge PR into `develop` automatically.

## Two Project Types

| Project type | Build trigger | Release trigger |
|---|---|---|
| **Library** — Maven JAR → AWS CodeArtifact | PR merged into `develop` | PR merged into `master` |
| **Deployable** — Spring Boot app → Docker image → AWS ECR | PR merged into `develop` | PR merged into `master` |

The discriminator is `SERVICE_NAME`. When it is provided, the workflow takes the Docker/ECR path. When it is omitted, the workflow takes the Maven library/CodeArtifact path.

## Workflow Overview

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
