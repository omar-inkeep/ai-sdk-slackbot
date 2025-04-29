# AI SDK Slackbot

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fomar-inkeep%2Fai-sdk-slackbot&env=SLACK_BOT_TOKEN,SLACK_SIGNING_SECRET,INKEEP_API_KEY&envDescription=API%20keys%20needed%20for%20application&envLink=https%3A%2F%2Fgithub.com%2Fomar-inkeep%2Fai-sdk-slackbot%3Ftab%3Dreadme-ov-file%234-set-environment-variables&project-name=ai-sdk-slackbot)

An AI-powered chatbot for Slack powered by the [AI SDK by Vercel](https://sdk.vercel.ai/docs).

## Features

- Integrates with [Slack's API](https://api.slack.com) for easy Slack communication
- Works both with app mentions and direct messages
- Maintains conversation context within both threads and direct messages

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- Slack workspace with admin privileges
- [Inkeep API key](https://inkeep.com/docs/api-reference/introduction)
- A server or hosting platform (e.g., [Vercel](https://vercel.com)) to deploy the bot

## Setup

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click "Create New App"
2. Choose "From scratch" and give your app a name
3. Select your workspace

### 3. Configure Slack App Settings

#### Basic Information

- Under "App Credentials", note down your "Signing Secret"

#### App Home

- Go to "App Home"
- Enable "Messages Tab"
- Check "Allow users to send Slash commands and messages from the messages tab"
- Save Changes

#### OAuth & Permissions

- Add the following [Bot Token Scopes](https://api.slack.com/scopes):
  - `app_mentions:read`
  - `channels:history`
  - `chat:write`
  - `groups:history`
  - `chat:write.customize`
  - `im:history`
  - `im:write`
  - `im:read`
  - `users.profile:read`

- Install the app to your workspace and note down the "Bot User OAuth Token"

### 4. Set Environment Variables

Create a `.env` file in the root of your project with the following:

```
# Slack Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_ID=your-app-id

# Inkeep Credentials
INKEEP_API_KEY=your-inkeep-api-key
```

Replace the placeholder values with your actual tokens.

### 5. Deploy your app

- If building locally, follow steps in the Local Development section to tunnel your local environment and then copy the tunnel URL.
- If deploying to Vercel, follow the instructions in the Production Deployment section and copy your deployment URL.

### 6. Update your Slack App configuration:

Go to your [Slack App settings](https://api.slack.com/apps)

- Select your app
- Go to "Event Subscriptions"
- Enable Events
- Set the Request URL to either your local URL or your deployment URL: (e.g. `https://your-app.vercel.app/api/events`)
- Save Changes
- Under "Subscribe to bot events", add:
  - `app_mention`
  - `message.channels`
  - `message.groups`
  - `message.im`

> Remember to include `/api/events` in the Request URL.

### 7. Enable Interactivity

- Go to "Interactivity & Shortcuts"
- Enable Interactivity
- Set the Request URL to: `https://your-app.vercel.app/api/events`
- Save Changes


## Local Development

Use the [Vercel CLI](https://vercel.com/docs/cli) and [untun](https://github.com/unjs/untun) to test out this project locally:

```sh
pnpm i -g vercel
pnpm vercel dev --listen 3000 --yes
```

```sh
npx untun@latest tunnel http://localhost:3000
```

Make sure to modify the [subscription URL](./README.md/#enable-slack-events) to the `untun` URL.

> Note: you may encounter issues locally with `waitUntil`. This is being investigated.

## Production Deployment

### Deploying to Vercel

1. Push your code to a GitHub repository

2. Deploy to [Vercel](https://vercel.com):

   - Go to vercel.com
   - Create New Project
   - Import your GitHub repository

3. Add your environment variables in the Vercel project settings:

   - `SLACK_BOT_TOKEN`
   - `SLACK_SIGNING_SECRET`
   - `SLACK_APP_ID`
   - `INKEEP_API_KEY`

4. After deployment, Vercel will provide you with a production URL

5. Update your Slack App configuration:
   - Go to your [Slack App settings](https://api.slack.com/apps)
   - Select your app
   - Go to "Event Subscriptions"
   - Enable Events
   - Set the Request URL to: `https://your-app.vercel.app/api/events`
   - Save Changes
   - Under "Subscribe to bot events", add:
     - `app_mention`
     - `message.channels`
     - `message.groups`
     - `message.im`

## Usage

The bot will respond to:

1. Direct messages - Send a DM to your bot
2. Mentions - Mention your bot in a channel using `@YourBotName`

The bot maintains context within both threads and direct messages, so it can follow along with the conversation.

## License

MIT
