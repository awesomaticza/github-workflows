---
id: github-app-setup
title: GitHub App Setup
sidebar_position: 1
---

# GitHub App Setup

The `release.yml` workflow authenticates as a GitHub App rather than using the default `GITHUB_TOKEN`. This guide explains why, and walks you through creating and wiring in your own app.

## Why Not `GITHUB_TOKEN`?

GitHub intentionally prevents `GITHUB_TOKEN` from triggering further workflow runs. This is a security guardrail to prevent infinite CI loops.

The `merge-2-develop` job creates a version-bump commit and opens a PR into `develop`. That PR needs to re-trigger the `build.yml` CI workflow on `develop` — which it will not do if the commit was made with `GITHUB_TOKEN`.

A GitHub App token does not carry this restriction. When the app pushes the commit, GitHub treats it as a third-party actor and triggers workflows normally.

## Step 1 — Register a GitHub App

Follow the official guide to create a new GitHub App in your organisation:

[Registering a GitHub App →](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)

Settings to configure during registration:

| Setting | Value |
|---|---|
| **GitHub App name** | e.g. `my-org-ci-bot` |
| **Homepage URL** | Your organisation's GitHub URL |
| **Webhook** | Disable (uncheck "Active") |
| **Repository permissions → Contents** | Read and write |
| **Repository permissions → Pull requests** | Read and write |

Leave all other permissions at their defaults (no access).

## Step 2 — Generate a Private Key

After creating the app:

1. Go to the app's settings page.
2. Scroll to **Private keys**.
3. Click **Generate a private key**.
4. A `.pem` file will download — keep it safe.

## Step 3 — Install the App on Your Repository

1. Go to the app's settings page.
2. Click **Install App**.
3. Choose your organisation and select the repositories the workflows will run in.

## Step 4 — Add Secrets to Each Repository

In each consumer repository, go to **Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|---|---|
| `CI_APP_ID` | The numeric App ID shown on the app's settings page |
| `CI_APP_PRIVATE_KEY` | The full contents of the `.pem` file generated in Step 2 |

## How the Workflow Uses the App Token

The `release.yml` workflow uses [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token?tab=readme-ov-file) to exchange the app credentials for a short-lived token at runtime:

```yaml
- uses: actions/create-github-app-token@v2
  id: app-token
  with:
    app-id: ${{ secrets.CI_APP_ID }}
    private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}
```

The token is then passed to `actions/checkout` and used for `git push` and `gh pr create`, so all git operations appear as the bot user rather than `github-actions[bot]`.

## References

- [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
- [actions/create-github-app-token](https://github.com/actions/create-github-app-token?tab=readme-ov-file)
