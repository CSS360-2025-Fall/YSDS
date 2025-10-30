- Not enough features

- Math command can be merged into one, so the user doesn't have to remember 4 different commands

- Improper HTTP Response for Unknown Commands : The bot returns an HTTP 400 Bad Request when encountering unknown or unhandled slash commands. Discord’s API expects a 200 OK response with a valid interaction payload for all handled requests. Returning 400 causes Discord to interpret the interaction as a failure, resulting in “Interaction failed” messages for users and potential warning logs in the developer dashboard.
