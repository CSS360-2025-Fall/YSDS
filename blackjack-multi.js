// blackjack-multi.js
// Turn-based multiplayer Blackjack using a shared lobby + table.

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
    const nameMap = {
        A: "Ace",
        K: "King",
        Q: "Queen",
        J: "Jack",
    };
    const rankName = nameMap[c.rank] || c.rank;
    return `${rankName} of ${c.suit}`;
}

function formatHand(cards) {
    return cards.map(formatCard).join("\n- ");
}

function formatPlayersList(table) {
    if (!table.players.length) return "(no players yet)";
    return table.players.map(id => `- <@${id}>`).join("\n");
}

function buildLobbyMessage(table) {
    let msg = "🃏 **Blackjack Multiplayer Lobby**\n\n";
    msg += `Host: <@${table.hostId}>\n\n`;
    msg += "**Players joined:**\n";
    msg += `${formatPlayersList(table)}\n\n`;
    msg += "Press **Join** to enter.\nHost can press **Start** when ready.";
    return msg;
}

function buildLobbyButtons(tableId) {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    custom_id: `bjm_join:${tableId}`,
                    style: 1,
                    label: "Join",
                },
                {
                    type: 2,
                    custom_id: `bjm_start:${tableId}`,
                    style: 3,
                    label: "Start Game",
                },
                {
                    type: 2,
                    custom_id: `bjm_cancel:${tableId}`,
                    style: 4,
                    label: "Cancel",
                },
            ],
        },
    ];
}

function buildTurnMessage(table) {
    const players = table.players;
    const currentIndex = table.currentTurnIndex;
    const currentPlayerId = players[currentIndex];
    const hand = table.hands[currentPlayerId].cards;
    const playerTotal = handValue(hand);

    let msg = "🃏 **Blackjack Multiplayer**\n\n";
    msg += `🎮 **Turn ${currentIndex + 1} of ${players.length}:** <@${currentPlayerId}>\n\n`;

    msg += "**Your Hand:**\n";
    msg += `- ${formatHand(hand)}\n`;
    msg += `Total: ${playerTotal}\n\n`;

    msg += "**Dealer Shows:**\n";
    msg += `- ${formatCard(table.dealer[0])}\n`;
    msg += "- Hidden card\n\n";

    msg += "**Players:**\n";
    for (const pid of players) {
        const h = table.hands[pid];
        const status = h.finished
            ? (h.surrendered ? "surrendered" : (h.busted ? "busted" : "done"))
            : (pid === currentPlayerId ? "playing" : "waiting");
        msg += `- <@${pid}> (${status})\n`;
    }

    msg += "\nUse the buttons to play your turn.";
    return msg;
}

function buildTurnButtons(tableId) {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    custom_id: `bjm_hit:${tableId}`,
                    style: 1,
                    label: "Hit",
                },
                {
                    type: 2,
                    custom_id: `bjm_stand:${tableId}`,
                    style: 2,
                    label: "Stand",
                },
                {
                    type: 2,
                    custom_id: `bjm_double:${tableId}`,
                    style: 3,
                    label: "Double",
                },
                {
                    type: 2,
                    custom_id: `bjm_surrender:${tableId}`,
                    style: 4,
                    label: "Surrender",
                },
            ],
        },
    ];
}

function allPlayersDone(table) {
    return table.players.every(pid => table.hands[pid].finished);
}

function advanceTurn(table) {
    const n = table.players.length;
    while (table.currentTurnIndex < n && table.hands[table.players[table.currentTurnIndex]].finished) {
        table.currentTurnIndex++;
    }
}

function dealerPlay(table) {
    while (handValue(table.dealer) < 17) {
        table.dealer.push(draw(table.deck));
    }
}

function buildResultsMessage(table) {
    const dealerTotal = handValue(table.dealer);
    let msg = "🃏 **Blackjack Results**\n\n";

    msg += "**Dealer Hand:**\n";
    msg += `- ${formatHand(table.dealer)}\n`;
    msg += `Total: ${dealerTotal}\n\n`;

    msg += "**Player Outcomes:**\n";

    for (const pid of table.players) {
        const h = table.hands[pid];
        const total = handValue(h.cards);

        let outcome = "";
        if (h.surrendered) {
            outcome = "Surrendered (lost).";
        } else if (h.busted) {
            outcome = "Busted. Dealer wins.";
        } else if (dealerTotal > 21) {
            outcome = "Dealer busted. You win!";
        } else if (total > dealerTotal) {
            outcome = "You win!";
        } else if (total < dealerTotal) {
            outcome = "Dealer wins.";
        } else {
            outcome = "It's a tie.";
        }

        msg += `- <@${pid}> — ${outcome} (Total: ${total})\n`;
    }

    return msg;
}

// 🟢 Called when /blackjack_multi is used
export function startBlackjackMulti(tables, tableId, hostId) {
    tables[tableId] = {
        hostId,
        players: [hostId],
        started: false,
        deck: null,
        dealer: [],
        hands: {},
        currentTurnIndex: 0,
    };

    const table = tables[tableId];

    return {
        content: buildLobbyMessage(table),
        components: buildLobbyButtons(tableId),
    };
}

// 🟢 Called when a bjm_* button is clicked
export function handleBlackjackMultiAction(tables, tableId, userId, action) {
    const table = tables[tableId];

    if (!table) {
        return {
            content: "❌ This blackjack lobby no longer exists.",
            components: [],
            ephemeral: true,
        };
    }

    // Lobby phase actions
    if (!table.started) {
        if (action === "join") {
            if (!table.players.includes(userId)) {
                table.players.push(userId);
            }
            return {
                content: buildLobbyMessage(table),
                components: buildLobbyButtons(tableId),
                ephemeral: false,
            };
        }

        if (action === "start") {
            if (userId !== table.hostId) {
                return {
                    content: "❌ Only the host can start the game.",
                    components: [],
                    ephemeral: true,
                };
            }

            // Initialize deck, dealer, and hands
            table.deck = createDeck();
            table.dealer = [draw(table.deck), draw(table.deck)];
            table.hands = {};
            for (const pid of table.players) {
                table.hands[pid] = {
                    cards: [draw(table.deck), draw(table.deck)],
                    finished: false,
                    surrendered: false,
                    busted: false,
                };
            }
            table.started = true;
            table.currentTurnIndex = 0;

            return {
                content: buildTurnMessage(table),
                components: buildTurnButtons(tableId),
                ephemeral: false,
            };
        }

        if (action === "cancel") {
            if (userId !== table.hostId) {
                return {
                    content: "❌ Only the host can cancel the lobby.",
                    components: [],
                    ephemeral: true,
                };
            }
            delete tables[tableId];
            return {
                content: "❌ The blackjack lobby has been cancelled by the host.",
                components: [],
                ephemeral: false,
            };
        }
    }

    // Game phase actions
    if (!table.started) {
        return {
            content: "❌ The game has not started yet.",
            components: [],
            ephemeral: true,
        };
    }

    const currentPlayerId = table.players[table.currentTurnIndex];
    if (userId !== currentPlayerId) {
        return {
            content: "⏳ It's not your turn.",
            components: [],
            ephemeral: true,
        };
    }

    const hand = table.hands[currentPlayerId];

    if (action === "hit") {
        hand.cards.push(draw(table.deck));
        if (handValue(hand.cards) > 21) {
            hand.finished = true;
            hand.busted = true;
        }
    } else if (action === "stand") {
        hand.finished = true;
    } else if (action === "double") {
        hand.cards.push(draw(table.deck));
        hand.finished = true;
    } else if (action === "surrender") {
        hand.finished = true;
        hand.surrendered = true;
    }

    // After player's action, either next player or dealer
    if (allPlayersDone(table)) {
        dealerPlay(table);
        const resultMsg = buildResultsMessage(table);
        delete tables[tableId];
        return {
            content: resultMsg,
            components: [],
            ephemeral: false,
        };
    } else {
        advanceTurn(table);
        return {
            content: buildTurnMessage(table),
            components: buildTurnButtons(tableId),
            ephemeral: false,
        };
    }
}