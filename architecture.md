
# Code Architecture - Yahya

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

