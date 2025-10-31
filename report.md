
# Shedding the Test Command 

Yahya's Portion
This section explains the existence of the Unnecessary Test Command.

Originally, when launching the bot, we had a test command to make sure it properly functioned, and it continued to remain in the bot until the moment of writing this. It isn't necessary due to the other commands in the bot, as well as the fact that it takes up space in the commands.js file, which could confuse someone covering the code.

So we need to delete it to save space and minimize confusion.

# Code Overwrites All Commands Every Time

Right now, the code uses a global command update that replaces every single Discord command in the bot each time this script runs. It uses this line:
PUT /applications/${APP_ID}/commands
This tells Discord to delete old commands and replace them with only the commands in this file.
At first, this seems simple. But there is a big problem:
 If another team member or future developer adds a new command somewhere else, running this script can wipe their command out by accident.
So all commands must always be in this one file. If someone forgets to add one, it disappears from Discord.
Why is this a weakness?
This is risky because it can:
Delete commands by accident
Break the bot without warning
Waste time while teammates try to figure out why commands vanished
Make the bot hard to maintain as it gets bigger
Cause teamwork problems since one person can overwrite everyone's changes
Also, global Discord commands take time to update (sometimes up to an hour). So if something breaks, it will not fix quickly.
Example Scenario
Imagine our group adds 8 commands to the bot.
 Someone only includes 6 in this file and runs the script.
 Suddenly, 2 commands disappear from Discord—no error message, no warning.
 Now the bot looks broken until we figure out what happened.
How to improve it>
To fix this, we can:
 Use guild commands during testing. They update instantly and don’t affect global commands.
 Add new commands one-by-one instead of replacing everything.
  Store commands in separate files and import them, so nobody forgets one.
  Add a safety check before overwriting global commands.
The current setup works for small projects. But as our bot grows and more people work on it, replacing all commands every time becomes dangerous. Changing to safer command-updating methods will protect teamwork, prevent bugs, and make the bot easier to maintain in the future.

By: Shivek Tiwari
Usability Testing Report – YSDS Discord Bot

The YSDS bot currently supports six commands: /test, /add, /sub, /multi, /div, and /challenge.
All arithmetic commands function correctly, providing instant feedback with clear results and error handling (for example, divide-by-zero prevention).
However, the /challenge command for Rock–Paper–Scissors responds without executing the actual game logic, indicating incomplete functionality.

From a usability standpoint, the bot is stable and responsive but lacks user guidance and consistency in responses. There is no /help command to introduce features, and messages are plain text without visual structure or embedded formatting. Feedback style varies slightly between commands, which can confuse users.

Overall, the bot performs well for basic functions but would benefit from:

Completing the Rock–Paper–Scissors result logic.

Adding a /help command for discoverability.



# Use this to seperate the portions guys.

- Math command can be merged into one, so the user doesn't have to remember 4 different commands

- Improper HTTP Response for Unknown Commands : The bot returns an HTTP 400 Bad Request when encountering unknown or unhandled slash commands. Discord’s API expects a 200 OK response with a valid interaction payload for all handled requests. Returning 400 causes Discord to interpret the interaction as a failure, resulting in “Interaction failed” messages for users and potential warning logs in the developer dashboard.

- Rock–Paper–Scissors (RPS) command (/challenge) is registered and the bot responds to it, but the actual game logic isn’t running or returning results.
