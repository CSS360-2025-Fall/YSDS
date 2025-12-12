// blackjack-multi.js
// Turn-based multiplayer Blackjack using a shared lobby + table.
// FINAL v3.0 – fully playable multiplayer blackjack

// =======================
// BETTING STATE
// =======================

const playerBalances = {};
const playerBets = {};

function getBalance(userId) {
    if (!(userId in playerBalances)) {
        playerBalances[userId] = 1000;
    }
    return playerBalances[userId];
}

function hasBet(userId) {
    return playerBets[userId] !== undefined;
}

function clearBet(userId) {
    delete playerBets[userId];
}

export function placeBet(userId, amount) {
    getBalance(userId);

    if (amount < 10 || amount > 500) {
        return "❌ Bet must be between **10 and 500** chips.";
    }

    if (amount > playerBalances[userId]) {
        return `❌ Insufficient balance. You have **${playerBalances[userId]}** chips.`;
    }

    playerBets[userId] = amount;
    return `💰 **Bet placed!**\nBet: **${amount} chips**\nBalance: **${playerBalances[userId]} chips**`;
}

// =======================
// CARD / HAND UTILITIES
// =======================

function createDeck() {
    const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const deck = [];

    for (const s of suits) {
        for (const r of ranks) deck.push({ rank: r, suit: s });
    }

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
    let total = 0, aces = 0;

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
    const names = { A: "Ace", K: "King", Q: "Queen", J: "Jack" };
    return `${names[c.rank] || c.rank} of ${c.suit}`;
}

function formatHand(cards) {
    return cards.map(formatCard).join("\n- ");
}

// =======================
// UI BUILDERS
// =======================

function buildLobbyMessage(table) {
    let msg = "🃏 **Blackjack Multiplayer Lobby**\n\n";
    msg += `Host: <@${table.hostId}>\n\n**Players:**\n`;

    if (!table.players.length) msg += "(no players yet)\n";

    for (const pid of table.players) {
        msg += `- <@${pid}> (${hasBet(pid) ? `💰 Bet: ${playerBets[pid]}` : "❌ No bet"})\n`;
    }

    msg += "\nUse `/bet amount` before joining.\n";
    msg += "Host can start only when all players have bet.";
    return msg;
}

function buildLobbyButtons(tableId) {
    return [{
        type: 1,
        components: [
            { type: 2, custom_id: `bjm_join:${tableId}`, style: 1, label: "Join" },
            { type: 2, custom_id: `bjm_start:${tableId}`, style: 3, label: "Start Game" },
            { type: 2, custom_id: `bjm_cancel:${tableId}`, style: 4, label: "Cancel" },
        ],
    }];
}

function buildTurnMessage(table) {
    const pid = table.players[table.currentTurnIndex];
    const hand = table.hands[pid].cards;

    let msg = "🃏 **Blackjack Multiplayer**\n\n";
    msg += `🎮 **Current Turn:** <@${pid}>\n\n`;
    msg += "**Your Hand:**\n- " + formatHand(hand) + "\n";
    msg += `Total: ${handValue(hand)}\n\n`;
    msg += "**Dealer Shows:**\n- " + formatCard(table.dealer[0]) + "\n- Hidden card\n\n";
    return msg;
}

function buildTurnButtons(tableId) {
    return [{
        type: 1,
        components: [
            { type: 2, custom_id: `bjm_hit:${tableId}`, style: 1, label: "Hit" },
            { type: 2, custom_id: `bjm_stand:${tableId}`, style: 2, label: "Stand" },
            { type: 2, custom_id: `bjm_double:${tableId}`, style: 3, label: "Double" },
            { type: 2, custom_id: `bjm_surrender:${tableId}`, style: 4, label: "Surrender" },
        ],
    }];
}

// =======================
// DEALER + RESULTS
// =======================

function dealerPlay(table) {
    while (handValue(table.dealer) < 17) {
        table.dealer.push(draw(table.deck));
    }
}

function buildResultsMessage(table) {
    dealerPlay(table);

    const dealerTotal = handValue(table.dealer);
    let msg = "🃏 **Blackjack Results**\n\n";
    msg += "**Dealer Hand:**\n- " + formatHand(table.dealer) + `\nTotal: ${dealerTotal}\n\n`;
    msg += "**Player Results:**\n";

    for (const pid of table.players) {
        const h = table.hands[pid];
        const total = handValue(h.cards);
        const bet = playerBets[pid];

        let outcome = "Push";

        if (h.surrendered || h.busted || (dealerTotal <= 21 && total < dealerTotal)) {
            playerBalances[pid] -= bet;
            outcome = "Lose";
        } else if (dealerTotal > 21 || total > dealerTotal) {
            playerBalances[pid] += bet;
            outcome = "Win";
        }

        msg += `- <@${pid}> → **${outcome}** | Bet: ${bet} | Balance: ${playerBalances[pid]}\n`;
        clearBet(pid);
    }

    return msg;
}

// =======================
// ENTRY POINTS
// =======================

export function startBlackjackMulti(tables, tableId, hostId) {
    tables[tableId] = {
        hostId,
        players: [],
        started: false,
        deck: null,
        dealer: [],
        hands: {},
        currentTurnIndex: 0,
    };

    return {
        content: buildLobbyMessage(tables[tableId]),
        components: buildLobbyButtons(tableId),
    };
}

export function handleBlackjackMultiAction(tables, tableId, userId, action) {
    const table = tables[tableId];
    if (!table) return { content: "❌ Lobby not found.", ephemeral: true };

    // ===== LOBBY =====
    if (!table.started) {
        if (action === "join") {
            if (!hasBet(userId)) return { content: "❌ Place a bet first.", ephemeral: true };
            if (!table.players.includes(userId)) table.players.push(userId);
            return { content: buildLobbyMessage(table), components: buildLobbyButtons(tableId) };
        }

        if (action === "start") {
            if (userId !== table.hostId) return { content: "❌ Only host can start.", ephemeral: true };
            if (!table.players.every(hasBet)) return { content: "⏳ Waiting for bets.", ephemeral: true };

            table.started = true;
            table.deck = createDeck();
            table.dealer = [draw(table.deck), draw(table.deck)];

            for (const pid of table.players) {
                table.hands[pid] = { cards: [draw(table.deck), draw(table.deck)], busted: false, surrendered: false, finished: false };
            }

            return { content: buildTurnMessage(table), components: buildTurnButtons(tableId) };
        }

        if (action === "cancel") {
            delete tables[tableId];
            return { content: "❌ Lobby cancelled.", components: [] };
        }
    }

    // ===== IN-GAME =====
    const pid = table.players[table.currentTurnIndex];
    if (userId !== pid) return { content: "⏳ Not your turn.", ephemeral: true };

    const hand = table.hands[pid];

    if (action === "hit") {
        hand.cards.push(draw(table.deck));
        if (handValue(hand.cards) > 21) {
            hand.busted = true;
            hand.finished = true;
        }
    }

    if (action === "stand") hand.finished = true;
    if (action === "surrender") { hand.surrendered = true; hand.finished = true; }
    if (action === "double") {
        hand.cards.push(draw(table.deck));
        hand.finished = true;
    }

    // Advance turn
    do {
        table.currentTurnIndex++;
    } while (
        table.currentTurnIndex < table.players.length &&
        table.hands[table.players[table.currentTurnIndex]].finished
    );

    // All done → results
    if (table.currentTurnIndex >= table.players.length) {
        const result = buildResultsMessage(table);
        delete tables[tableId];
        return { content: result, components: [] };
    }

    return { content: buildTurnMessage(table), components: buildTurnButtons(tableId) };
}
