# Custom Account Manager · Discord bot

Members redeem keys, reset their HWID and password, and get the buyer role.
Staff make keys and manage accounts. Everything is the same database the app
and the website use.

## Commands

**Everyone** (replies are private)

| Command | What it does |
| --- | --- |
| `/redeem` | No account yet: opens a form for a username and password, and the key makes the account, linked to your Discord. Already have one: adds the key's time. |
| `/account` | Time left, PC lock, when the next HWID reset is available. |
| `/hwidreset` | Moves the account to another PC, once a day. Only works on the account linked to *your* Discord. |
| `/resetpassword` | Sets a new password (Discord proves who you are). Signs out everywhere. |
| `/link` / `/unlink` | Link an account made in the app or on the website. |
| `/pricing`, `/download`, `/status`, `/help` | Info. |

**Staff** (anyone with Administrator, or a staff role added with `/setup staff-add`)

| Command | What it does |
| --- | --- |
| `/genkey plan amount note send_to` | Makes 1–50 keys; optionally DMs them to someone. |
| `/lookup user/username` | Full account details. |
| `/addtime days/lifetime`, `/removetime` | Change an account's time. |
| `/forcereset` | HWID reset without the daily limit. |
| `/ban reason`, `/unban` | Ban an account from the app and website. |
| `/keyinfo`, `/revokekey` | Check or cancel an unused key. |
| `/stats` | Accounts and keys at a glance. |
| `/panel channel` | Posts a message with buttons: Redeem a key, My account, Reset HWID, Reset password. |

**Server admins** (Administrator permission only)

| Command | What it does |
| --- | --- |
| `/setup view` | Shows the current settings. |
| `/setup buyer-role role` | The role buyers get. Checks the bot can actually give it. |
| `/setup staff-add role` / `/setup staff-remove role` | Which roles can use the staff commands. |
| `/setup log-channel channel` | Where logs go; leave the channel empty to turn logs off. |

Settings are saved in the database, so they survive restarts and redeploys.

The buyer role is given when someone redeems or links an account with time,
and every 10 minutes the bot catches anyone who got time elsewhere. It's never
taken away.

## Setup (about 10 minutes)

1. **Make the bot.** Go to <https://discord.com/developers/applications> →
   *New Application*. Under **Bot**, press *Reset Token* and copy it.
2. **Invite it.** Under **OAuth2 → URL Generator** tick `bot` and
   `applications.commands`, then the permissions **Manage Roles**,
   **Send Messages**, **Embed Links** and **Attach Files**. Open the link and
   add it to your server.
3. **Put its role above the buyer role.** Server Settings → Roles: drag the
   bot's role higher than the buyer role, or it can't give it. Then, in
   Discord, run `/setup buyer-role`, `/setup staff-add` and
   `/setup log-channel`.
4. **Fill in `.env`.** Copy `.env.example` to `.env` and fill it in. The
   Supabase secret key is under Project Settings → API Keys.
5. **Start it.** Double-click `start-bot.bat` (needs Node.js 20+ from
   <https://nodejs.org>). It registers the commands and starts the bot. Keep
   the window open.

### On Railway (stays online when your PC is off)

1. Railway → **New Project → Deploy from GitHub repo** → pick this repo.
2. Open the service → **Variables** → add every line from `.env.example`
   with your values (Railway keeps them secret).
3. That's it. `railway.json` registers the commands and starts the bot on
   every deploy, and restarts it if it ever crashes. Pushing to GitHub
   redeploys it.

Then run `/panel` in your support channel.

## Commands for developers

- `npm run check`: checks every command is valid, no Discord login needed
- `npm run deploy`: registers the slash commands in your server
- `npm start`: runs the bot
