
# Shedding the Test Command 

Yahya's Portion
This section explains the existence of the Unnecessary Test Command.

Originally, when launching the bot, we had a test command to make sure it properly functioned, and it continued to remain in the bot until the moment of writing this. It isn't necessary due to the other commands in the bot, as well as the fact that it takes up space in the commands.js file, which could confuse someone covering the code.

So we need to delete it to save space and minimize confusion.

# Code Overwrites All Commands Every Time: Sebi's Portion

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



# USABILITY TESTING REPORT – YSDS DISCORD BOT by Shivek Tiwari

The YSDS bot currently supports six commands: /test, /add, /sub, /multi, /div, and /challenge.
All arithmetic commands function correctly, providing instant feedback with clear results and error handling (for example, divide-by-zero prevention).
However, the /challenge command for Rock–Paper–Scissors responds without executing the actual game logic, indicating incomplete functionality.

From a usability standpoint, the bot is stable and responsive but lacks user guidance and consistency in responses. There is no /help command to introduce features, and messages are plain text without visual structure or embedded formatting. Feedback style varies slightly between commands, which can confuse users.

Overall, the bot performs well for basic functions but would benefit from:

Completing the Rock–Paper–Scissors result logic.

Adding a /help command for discoverability.


# Improper HTTP Response for Unknown Commands -- Doug

Description:
The bot returns an HTTP 400 Bad Request when encountering unknown or unhandled slash commands. Discord’s API expects a 200 OK response with a valid interaction payload for all handled requests. Returning 400 causes Discord to interpret the interaction as a failure, resulting in “Interaction failed” messages for users and potential warning logs in the developer dashboard.

Impact:

Users see an error instead of a friendly message.

Discord may flag the endpoint as unreliable due to repeated failed responses.

Debugging becomes harder due to misleading error logs.

Fix -> Return an HTTP 200 status with a valid interaction response, such as an ephemeral message indicating that the command is unrecognized.

# Challenge Command Regression – Doug

During development, someone accidentally deleted the `if (name === 'challenge')` portion in `commands.js` while the rest of the registration script stayed intact. Discord still exposes `/challenge` to users, but the server no longer routes those interactions and instead falls through to the unknown-command fallback, returning HTTP 400 “Interaction failed.” This regression blocks every rock–paper–scissors match and shows how easy it is for command handling to break when a single branch disappears without tests or automated safeguards.

# Command Copy Drift – Doug

Multiple math command descriptions and option labels in `commands.js` have diverged from the actual behavior. `/add` advertises “a * b”, and `/sub` swaps the minuend/subtrahend descriptions. The slash-command UI still renders these strings, so contributors and testers see misleading guidance and risk assuming the handlers are wrong. Because Discord globally caches command metadata, fixing typos requires a full re-register cycle, making drift expensive. We should repair the text and add a quick checklist (or test) so future edits don’t let the copy fall out of sync again.

