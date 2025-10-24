
# Code Architecture 

Yahya's Portion
This section explains the structure of the Discord bot project, including the purpose of each file and folder.


```markdown
project-root/                     # Project root 🙄
├── assets/                       # This is the file that contains the assets
├── examples/                     # This file came with the original Discord bot package we started the project off with
├── .gitignore                    # These are the files we told our git to ignore and not add to the pushes.
├── LICENSE                       # Same as examples
├── README.md                     # What the bots are about (similar to examples)
├── app.js                        # This is the file that contains the command functions and what they do. So the math is done here.
├── architecture.md               # This file!
├── commands.js                   # This is the file that contains the commands that appear on Discord. So even with the commands in app.js, they wouldn't appear without this file.
├── game.js                       # This was the file with the original options for the first project. Too sentimental to delete it.
├── ngrok-v3-stable-linux-amd64.tgz  # Ngrok stuff.
├── package.json                  # Stuff that helps the bot actually run. Without it, we couldn't npm start 😢.
├── package-lock.json             # Same as package.json but a lot longer
├── renovate.json                 # Same as example
└── utils.js                      # The API stuff for the Discord bot!

```

Sebaquien's Portion:
This section explains any questions the user might have about ngrok

Ngrok in Our Discord Bot Architecture
This section explains what ngrok is, why we use it with our Discord bot, how it fits our system and code architecture, and how to configure it safely for local development.

What ngrok is:
ngrok is a secure reverse‑tunneling service. It exposes a port on your local machine (e.g., http://localhost:3000) to the public Internet via an HTTPS URL (e.g., https://abc123.ngrok.app). Incoming requests hit ngrok’s global edge and are forwarded over an encrypted tunnel to your local server.
Why we need it for this bot: when Discord sends HTTP Interaction webhooks (slash commands, component interactions) it must reach a public URL. During development, our bot runs locally and isn’t publicly reachable. ngrok gives us a temporary (or reserved) HTTPS URL that Discord can call.

Where ngrok fits (system architecture)
flowchart LR
  U[Discord (Cloud)] -->|POST /interactions\n+ Ed25519 Signatures| E[ngrok Edge]
  E --> T[Secure Tunnel]
  T --> L[Local Dev Server\n(app.js on localhost:3000)]
  L --> E
  E --> U

Request path
User triggers a slash command in Discord.

Discord sends an HTTPS POST /interactions to our ngrok URL with signature headers.

ngrok forwards the request to http://localhost:3000/interactions (or our configured path).

Our local server verifies the Ed25519 signature, processes the command, and replies within Discord’s deadline (typically 3 seconds for an initial ACK).

In production we would not use ngrok; we’d deploy behind a public HTTPS endpoint (e.g., Fly.io, Render, Railway, Cloud Run, EC2 + reverse proxy, etc.).

Code architecture touchpoints
Entry point: app.js registers the /interactions HTTP route. This is the path Discord calls via the ngrok URL.

Signature verification: we must verify Discord’s X-Signature-Ed25519 and X-Signature-Timestamp headers before reading the body. If verification fails, return 401.

Command handler(s): our command logic (e.g., in commands.js) runs after verification. For long work, return a deferred response and follow up via webhooks.

If we switch to Gateway-only handling (no web server), ngrok is not required. We’re using HTTP interactions for this project, so ngrok is part of the dev loop.

Setup (development)
Install ngrok (don’t commit the binary to the repo):

Download from ngrok.com and place the binary on your PATH.

Authenticate once: ngrok config add-authtoken <YOUR_TOKEN>.

Run your local server: node app.js (listening on localhost:3000).

Start the tunnel:

 ngrok http 3000
# or use a reserved domain to avoid changing URLs each session:
# ngrok http --domain=my-bot-dev.ngrok.app 3000


Update Discord Developer Portal → Interactions Endpoint URL with the displayed https://.ngrok.app/interactions.


Tip: If you use a random ngrok URL, you must update the Interactions Endpoint URL in the portal each time ngrok assigns a new subdomain. A reserved domain (paid plan) avoids this churn and reduces 401/404 errors due to stale URLs.

ngrok configuration file (optional, recommended)
Create ~/.config/ngrok/ngrok.yml (platform dependent) and add a named tunnel:
version: 3
authtoken: ${NGROK_AUTHTOKEN}
tunnels:
  bot:
    proto: http
    addr: 3000
    domain: my-bot-dev.ngrok.app   # use if you have a reserved domain; otherwise omit

Start it with:
ngrok start bot

Security considerations
Do not trust requests just because they arrive via ngrok. Always verify Discord signatures before parsing the body.

Never commit your NGROK_AUTHTOKEN or Discord secrets. Use .env / environment variables.

Treat the ngrok URL as public: anything reachable on your local server (routes, admin UIs) is exposed while the tunnel is open.

Prefer a reserved domain for predictable callbacks and to reduce the risk of someone racing to register your expected subdomain during demos.

Limits & pitfalls (and how to avoid them)
Stale Interactions URL → 401/404: happens when your ngrok subdomain changes. Use a reserved domain or update the Developer Portal after each ngrok http start.

Invalid signature (401): ensure you read the raw request body bytes for verification before any JSON parsing that could alter whitespace.

Timeouts (~3s): if command work is long, respond with a deferred ACK and finish via follow‑up message/webhook.

Tunnel not forwarding (502/failed to connect): confirm your local server is listening on the correct port/path and ngrok points to the right address.

Accidentally committed binary: remove the tarball or binary from git history; add ignores (below).

Repo hygiene (.gitignore)
Add the following to .gitignore (or extend ours) so binaries/artifacts don’t enter the repo:
# ngrok
ngrok
ngrok.exe
ngrok*.tgz
.ngrok/
.ngrok2/
.ngrok-config

If a large binary already landed in git history, consider using git filter-repo or GitHub’s BFG tool to purge it from history.

TL;DR
ngrok gives our local HTTP interactions server a public HTTPS URL so Discord can call it during development. Keep secrets out of git, verify signatures, prefer a reserved domain, and remember to update the Interactions Endpoint URL when your tunnel URL changes.


Doug's portion:


# How the container interacts with ngrok and Discord 

1. Your bot receives and verifies the request from Discord through ngrok

Your bot’s HTTP server (running in Docker) receives this POST request.

Discord includes headers:
X-Signature-Ed25519 and X-Signature-Timestamp

Your bot uses your app’s PUBLIC_KEY to verify the signature — this ensures it’s really from Discord, not someone faking it.

If verification fails → ignore the request.

2. Your bot processes the command

Once verified:

The bot’s dispatcher looks at the command name (calc add).

It calls your calculator function: 2 + 3 = 5.

Then the bot sends a response back to Discord, usually JSON like:

{
  "type": 4,
  "data": { "content": "Result: 5" }
}


Discord requires this within 3 seconds, otherwise the bot must first “defer” and send the result later.

3. Discord delivers the result to the user

Discord receives your response and posts it as a message in the channel (or ephemeral message to the user).

In short: User → Discord → your ngrok URL → your bot → Discord → User
