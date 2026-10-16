---
status: ACCEPTED
publish: allowed for the Google consent screen. Check again before the App Store submission.
---

# Privacy policy of Sudoku

<!-- Source of the public page. `web/build.mjs` renders it at build time. See ../../site/README.md. Check this policy again before the App Store submission. -->

Last changed: 2026-10-15

## Who

Felix Vandemaele runs the Sudoku app. Contact: <vandemaelefelix@gmail.com>.

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

## International transfers

Clerk processes data in the United States. The United States is outside the European Economic Area. The transfer uses
a safeguard under Chapter V of the GDPR. This is the EU-US Data Privacy Framework where Clerk is certified. Otherwise
it is the standard contractual clauses in the data processing agreement with Clerk. AWS keeps the games in Ireland.

## This website

Vercel hosts this website. Vercel processes the IP address of a visitor to serve the pages. The website sets no
cookies. The website has no analytics. The website makes no request to another party.

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
3. A small record keeps your user ID and the delete date for 30 days. It holds no email and no games.
4. Backups of the table age out within 35 days.

The server log has one line per request. It holds our user ID and no email. It is kept for one month.

## Delete your account

Open Settings, then Account, then Delete account. You can also send an email to the contact address.

## Your rights

Under the GDPR you have these rights:

- Access: ask for a copy of your data.
- Correction: ask us to fix wrong data.
- Deletion: delete your account in the app, or ask us.
- Portability: ask for your data in a structured, common format.
- Restriction: ask us to pause the use of your data.
- Objection: object to the use of your data.

Send an email to the contact address. We answer within one month.

You can complain to a supervisory authority. In Belgium this is the Data Protection Authority
(Gegevensbeschermingsautoriteit), <https://www.gegevensbeschermingsautoriteit.be>.

## Children

The app is not made for children under 13. We do not knowingly collect data from them.

## Changes

We change this page when the app changes. The date at the top shows the last change.
