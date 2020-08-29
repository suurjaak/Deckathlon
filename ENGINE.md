Game Template
=============

All game-specific logic is driven by game configuration, 
stored in database table `templates`.

Cards are represented as two-character strings, with first character being
card level and second being card suite, e.g. "AS" for ace of spades.
Levels are 234567890JQKAX (with 0 being 10 and X being joker),
suites are HSDCX (hearts, spades, diamonds, clubs, jokers).

Jokers are represented as "XX" "YX" "ZX", so that all card strings are unique.

Card glyphs in UI are shown using Unicode symbols in DejaVu Sans font.


Each game is described with a configuration template in table column `templates.opts`:

```
{
    "cards":              list of cards in deck, as ["3H", "3S", "3D", "3C", ..];
    "levels":             card strength order in ascending order, as "34567890JQKA2X";
    "suites":             suite strength order in ascending order, as "HSDCX";
    "players":            number of supported players, as [min, max] or single number for [1, max];
    "hand":               maximum number of cards in hand in the beginning;
    "sort":               card comparison order, as ["level", "suite"] or a single "level" or "suite";

    "discards":           whether game has a discard pile;
    "reveal":             whether all cards are revealed at the end;

    "talon": {            if game has talon:
        "face":           whether talon is face up;
        "trump":          whether one card from talon goes under talon face-up as trump;
        "lead":           whether one card from talon goes on table as first move
                          (can be integer if more than one card);
    },
    "trick":              whether game is a trick-taking game,
                          with each player playing one card per round;
    "stack":              whether game has a single growing card stack on table;
    "trump":              whether game has trump suite;

    "bidding": {          if game has bidding:
        "min":            bid minimum number;

        "max":            bid maximum number, as single value or {
            "*":              default maximum,
            "blind":          maximum when bidding blind,
            "trump":          maximum when have trump cards in hand,
        },

        "step":           minimum step when overbidding last bid;
        "pass":           whether player can pass in bidding;
        "pass_final":     whether player can't bid any more once passed;
        "talon":          whether bid winner takes talon;
        "sell":           whether bid winner can put talon on sale;
        "distribute":     whether bid winner distributes cards to other
                          players for everyone to have equal number of cards;
        "blind":          whether game supports blind bidding (without looking at own hand);
    },

    "lead": {
        "0":              leader of first round, 
                          by default the player next to last game's first leader
                          (or player next to table host if first game),
                          or "bidder" for player winning bid,
                          or {"ranking": -1} for player position in current table ranking;
        "*":              leader of consecutive rounds, "trick" for player winning last trick;
    },

    "move": {
        "cards":          number of cards in a move, or "*" for any number;
        "level":          whether move cards needs to be at same level;
        "pass":           whether player can pass;
        "crawl":          round number when player can crawl (play card face down,
                          with next players making their move face down as well),

        "response": {
            "amount":     whether next player needs to match the number of cards in previous move;
            "level":      whether next player needs to match the card level of previous move;
            "suite":      whether next player needs to follow the card suite of previous move,
                          or more options as {
              "trump":    "mandatory"   if player must play trump if they have trump but don't have suite
                          "optional"    if player can play trump if they don't have suite
                          "alternative" if player can play trump even if they have suite
            }
            "follow":     whether move needs to be accompanied with a follow card,
                          e.g. {"cards": 1}
        },

        "retreat":        action on retreat (not being able to respond),
                          e.g. to take up 5 cards from stack: {"uptake": {"stack": 5}};

        "win": {          for non-trick-taking games:
          "last":         whether round if won by being last player to play in round;
          "level":        "all" if round is won by having all cards of one level on table;
        }
        "win": {          for trick-taking games:
          "suite":        whether round is won by following the suite of first move;
          "level":        whether round is won by defeating the level of first move;
        }

        "special": {      special moves:
          "trump": {      if player can make trump on move:
            "condition":  {"cards": 3} if player needs to have a minimum number of cards in hand,
            "0":          whether player can make this move on first turn,
            "*":          sets of cards needed to make this move,
                          as [["KD", "QD"], ["KH", "QH"], ["KS", "QS"], ["KC", "QC"]];
          },
          "some other":   some other special move than trump:
            "condition":  {"opt": "trump", "suite": true} if trump needs to have been made
                          and move needs to follow trump suite;
            "0":          whether player can make this move on first turn;
            "*":          sets of cards needed to make this move,
                          as [["AD", "0D"], ["AH", "0H"], ["AS", "0S"], ["AC", "0C"]];
          }
        }
    },

    "ranking": {
        "finish":         whether game ranking is determined by order of finishing all cards in hand;
    },

    "nextgame": {
        "distribute": {   next game starts with exchanging cards between winning and losing players,
                          with losing players needing to give their best cards,
                          winning players able to give any cards:
            "ranking":    whether cards are distributed by ranking order;
            "max":        number of cards the biggest winner and loser exchange,
                          next player pair in ranking line will give one less etc;
        }
    },

    "complete": {         condition for winning the game series:
      "score":            minimum score needed to win game series;
    },

    "redeal": {           players can demand redeal at game start:
        "condition": {
            "hand":       cards in hand required for redeal, as ["9H", "9S", "9D", "9C"];
            "min":        minimum number of said cards required;
        }
    },

    "points": {           points scoring:
      "trick":            for trick-taking games, points that card levels give,
                          as {"9": 0, "0": 10, "J": 2, "Q": 3, "K": 4, "A": 11};

      "special": {        points for special moves like trump:

          "trump": {          points for making a trump of specific suite:
            "D":  40,
            "H":  60,
            "S":  80,
            "C": 100
          },
          "some other":       points for making some other special move;
      },

      "bonuses": {        bonuses for conditions like bidding blind:
          "blind":        arithmetic operation to apply to score on succeeding to meet
                          the point score of a blind bid,
                          as {"op": "mul", "value": 2} for doubling score
                          (supported operations: "mul" and "add");
      },
      "penalties": {      penalties for various conditions:
        "bid":            arithmetic operation to apply to score on failing to meet
                          the point score of a bid,
                          as {"op": "mul", "value": -1} for getting negative the points bid,
        "blind":          arithmetic operation to apply to score on failing to meet
                          the point score of a blind bid,
                          as {"op": "mul", "value": -2} for burning double the points bid;
        "nochange": {     penalty for having no change in points for several games:
            "times":      number of consecutive games required for penalty;
            "op":         arithmetic operation to apply to score, like "mul" or "add";
            "value":      value to use in arithmetic operation;
        }
      },

      "bidonly": {        condition where player can get points from bids only:
          "min":          minimum score from which player can no longer get points from tricks et al;
      }
    }

}
```


Template Data
-------------

Templates can specify game description and rules in table column
`templates.description`, using simple Markdown format supporting headings, 
lists, pre-formatted text and blockquotes.


Localization
------------

Game templates can specify their own translations, both for template properties
like name and description plus any translation strings, in table column `templates.i18n`,
in the form of:

```
{
  language code: {
    "template.name":         "translated game name",
    "template.description":  "translated game description",
    some other text:         "translated value"
  }
}
```

