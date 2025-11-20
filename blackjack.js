// blackjack.js
// Minimal, clean, fully compatible with your existing bot.

function createDeck() {
    const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const deck = [];

    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit });
        }
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function draw(deck) {
    return deck.pop();
}

function cardValue(rank) {
    if (rank === "A") return 11;
    if (["K", "Q", "J"].includes(rank)) return 10;
    return Number(rank);
}

function handValue(cards) {
    let total = 0;
    let aces = 0;

    for (const c of cards) {
        total += cardValue(c.rank);
        if (c.rank === "A") aces++;
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
}

function formatCard(c) {
    const name = {
        A: "Ace",
        K: "King",
        Q: "Queen",
        J: "Jack",
    }[c.rank] || c.rank;

    return `${name} of ${c.suit}`;
}

function formatHand(cards) {
    return cards.map(formatCard).join("\n- ");
}

function buildMessage(state, revealDealer = false, resultText = "") {
    const playerTotal = handValue(state.player);
    const dealerTotal = revealDealer ? handValue(state.dealer) : null;

    let msg = "**🃏 Blackjack**\n\n";

    msg += "**Your Hand:**\n";
    msg += `- ${formatHand(state.player)}\n`;
    msg += `Total: ${playerTotal}\n\n`;

    msg += "**Dealer Hand:**\n";
    if (revealDealer) {
        msg += `- ${formatHand(state.dealer)}\n`;
        msg += `Total: ${dealerTotal}\n\n`;
    } else {
        msg += `- ${formatCard(state.dealer[0])}\n`;
        msg += `- Hidden card\n\n`;
    }

    if (resultText) {
        msg += `**${resultText}**`;
    } else {
        msg += "Choose an action:";
    }

    return msg;
}

function buildButtons(disabled = false) {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    custom_id: "blackjack_hit",
                    style: 1,
                    label: "Hit",
                    disabled,
                },
                {
                    type: 2,
                    custom_id: "blackjack_stand",
                    style: 2,
                    label: "Stand",
                    disabled,
                },
                {
                    type: 2,
                    custom_id: "blackjack_double",
                    style: 3,
                    label: "Double",
                    disabled,
                },
                {
                    type: 2,
                    custom_id: "blackjack_surrender",
                    style: 4,
                    label: "Surrender",
                    disabled,
                },
            ],
        },
    ];
}

export function startBlackjack(userId, games) {
    const deck = createDeck();
    const player = [draw(deck), draw(deck)];
    const dealer = [draw(deck), draw(deck)];

    games[userId] = { deck, player, dealer, finished: false };

    return {
        content: buildMessage(games[userId], false),
        components: buildButtons(false),
    };
}

export function handleBlackjackAction(userId, action, games) {
    const game = games[userId];
    if (!game || game.finished) {
        return {
            content: "❌ No active blackjack game. Use `/blackjack` to start one.",
            components: [],
        };
    }

    const deck = game.deck;
    let result = "";

    if (action === "hit") {
        game.player.push(draw(deck));
        if (handValue(game.player) > 21) {
            game.finished = true;
            result = "You busted! Dealer wins.";
            return {
                content: buildMessage(game, true, result),
                components: buildButtons(true),
            };
        }

        return {
            content: buildMessage(game, false),
            components: buildButtons(false),
        };
    }

    if (action === "surrender") {
        game.finished = true;
        result = "You surrendered. Dealer wins.";
        return {
            content: buildMessage(game, true, result),
            components: buildButtons(true),
        };
    }

    // Double
    if (action === "double") {
        game.player.push(draw(deck));
        game.finished = true;
        return finishDealer(game, "You doubled!", games, userId);
    }

    // Stand
    if (action === "stand") {
        game.finished = true;
        return finishDealer(game, "", games, userId);
    }

    return {
        content: "Unknown action.",
        components: [],
    };
}

function finishDealer(game, prefix, games, userId) {
    while (handValue(game.dealer) < 17) {
        game.dealer.push(draw(game.deck));
    }

    const playerTotal = handValue(game.player);
    const dealerTotal = handValue(game.dealer);

    let result = prefix + "\n\n";

    if (dealerTotal > 21) result += "Dealer busted! You win.";
    else if (playerTotal > dealerTotal) result += "You win!";
    else if (playerTotal < dealerTotal) result += "Dealer wins!";
    else result += "It's a tie!";

    return {
        content: buildMessage(game, true, result),
        components: buildButtons(true),
    };
}
