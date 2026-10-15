---
status: DRAFT
publish: blocked until in-app deletion ships and the production smoke test passes
---

# Privacy policy of Sudoku

<!-- Do not publish this file yet. The server deletion exists. The in-app Delete account button ships with the app.
Publish only after the button ships and the production smoke test passes. -->

Last changed: 2026-10-15

This file is the source of the public privacy page. The developer copies it to the host of the page. See
[`infra/README.md`](../../infra/README.md), "The production release".

## Who

Felix Vandemaele runs the Sudoku app. Contact: `<contact email, added before the page is published>`.

## Without an account

The app works without an account. No data leaves your phone. The games, the settings and the stats stay on the phone.

## With an account

You can make an account to back up your finished games. The app then holds this data about you:

| Data | Why | Where |
| --- | --- | --- |
| Email address | To sign you in | Clerk, United States |
| Clerk user ID | To know which games are yours | Clerk and AWS |
| Name and email from Google | Only if you sign in with Google. Clerk receives them from Google | Clerk, United States |
| Finished games: puzzle, difficulty, time, mistakes, date | To back up and sync your history | AWS `eu-west-1`, Ireland |
| Daily request count | To limit the load on the service | AWS `eu-west-1`, Ireland |
| Session and device data, such as your IP address | To run the sign-in | Clerk, United States |

Clerk Inc. is the sign-in service. It acts as a processor for us. It keeps session and device data, such as your IP
address, to run the sign-in. AWS DynamoDB in Ireland keeps the history and the daily request count.

## Legal basis

We process this data under Article 6(1)(b) of the GDPR: it is needed to perform the account service that you ask for.

## What the app does not collect

- Camera frames, photos and scan images. A scan runs on the phone. The images never leave it.
- The settings and the game in progress.
- Your location.
- An advertising ID.
- Analytics or usage data.

The app does not track you. The app has no ads.

## How long we keep the data

We keep the data until you delete the account.

When you delete the account:

1. Clerk removes your user at once.
2. The history rows are removed at once.
3. A small record keeps only the delete date for 30 days. It holds no email and no games.
4. Backups of the table age out within 35 days.

The server log has one line per request. It holds our user ID and no email. It is kept for one month.

## Delete your account

Open Settings, then Account, then Delete account. You can also send an email to the contact address.

## Your rights

Under the GDPR you can ask for access to your data, for a correction, or for a deletion. You can complain to the Belgian
Data Protection Authority.

## Children

The app is not made for children under 13. We do not knowingly collect data from them.

## Changes

We change this page when the app changes. The date at the top shows the last change.
