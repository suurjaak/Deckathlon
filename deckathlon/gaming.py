# -*- coding: utf-8 -*-
"""
Gaming engine.

@author    Erki Suurjaak
@created   19.04.2020
@modified  05.05.2020
------------------------------------------------------------------------------
"""
import collections
import copy
import datetime
import functools
import httplib
import logging
import random
import string
import sys

import pytz

from . import conf
from . lib import db, util

logger = logging.getLogger(__name__)


class Table(object):
    """
    Game tables functionality.
    """


    def __init__(self, userid):
        self._userid      = userid
        self._template    = None
        self._table       = None
        self._table_users = None
        self._game        = None
        self._players     = None
        self._player      = None
        self._users       = None
        self._tx = db.transaction(commit=False)


    def create(self, data):
        """
        Creates and returns new table, adding user as table user and first player.

        @param   data  {name, fk_template, public}
        @return        ({table} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.CREATED

        template = self._tx.fetchone("templates", id=data["fk_template"])
        if not template:
            error, status = "Template not found", httplib.BAD_REQUEST

        if not error:
            data = {k: data[k] for k in data if k in ("name", "fk_template", "public")}
            data["shortid"] = None
            while not data["shortid"] or self._tx.fetchone("tables", shortid=data["shortid"]):
                data["shortid"] = "".join(random.sample(string.ascii_lowercase, k=4))
            data["fk_creator"] = data["fk_host"] = self._userid
            data["players"] = 1

            tableid = self._tx.insert("tables", data)
            logger.error("Created table, id #%s.", tableid) # @todo remove
            logger.error("Current tables in db: %s.", self._tx.fetchall("tables")) # @todo remove
            result = self._tx.fetchone("tables", id=tableid)
            self._tx.insert("table_users", fk_table=result["id"], fk_user=self._userid)
            self._tx.insert("players",     fk_table=result["id"], fk_user=self._userid)
            self._tx.commit()

        self.update_online()
        self._tx.close()
        return result, error, status


    def update(self, tableid, data):
        """
        Updates and returns table data.

        @param   data  {name, fk_template, public}
        @return        ({table data} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        data = {k: data[k] for k in data if k in ("name", "fk_template", "public")}

        table = self._tx.fetchone("tables", id=tableid)
        if table and self._userid == table["fk_host"]:
            self._tx.update("tables", data, id=tableid)
            self._tx.commit()
            result = self._tx.fetchone("tables", id=tableid)
        elif table:
            error, status = "Forbidden", httplib.FORBIDDEN
        else:
            error, status = "Not found", httplib.NOT_FOUND

        self.update_online()
        self._tx.close()
        return result, error, status


    def join(self, tableid):
        """
        Joins table as player.

        @return        ({player} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.CREATED

        if self._tx.fetchone("table_users", fk_table=tableid, fk_user=self._userid):
            table = self._table = self._tx.fetchone("tables", id=tableid)
        else:
            error, status = "Forbidden", httplib.FORBIDDEN

        if table and table["status"] not in ("new", "ended"):
            error, status = "Cannot join game in progress", httplib.CONFLICT

        if table and not error:
            _, template, players = self.populate(template=True, players=True)
            if not any(x["fk_user"] == self._userid for x in players) \
            and len(players) < util.get(template, "opts", "players", 1):
                playerid = self._tx.insert("players", sequence=len(players),
                                          fk_table=table["id"], fk_user=self._userid)
                self._tx.update("tables", {"players": len(players) + 1},
                                id=table["id"])
                result = self._tx.fetchone("players", id=playerid)
                self._tx.commit()
            elif len(players) >= util.get(template, "opts", "players", 1):
                error, status = "Table full", httplib.CONFLICT
        elif not table:
            error, status = "Not found", httplib.NOT_FOUND

        self.update_online()
        self._tx.close()
        return result, error, status


    def leave(self, playerid):
        """
        Leaves table as player and user.

        @return        ({player} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        table = self._tx.fetchone("tables", where=("EXPR", (
            "id IN (SELECT fk_table FROM players WHERE id = ? AND fk_user = ?)",
            [playerid, self._userid]
        )))

        playeruserid = None
        if not table:
            error, status = "Table not found", httplib.NOT_FOUND
        else:
            player = self._tx.fetchone("players", id=playerid,
                                       fk_table=table["id"], dt_deleted=None)
            if player: playeruserid = player["id"]

        if not error and not playeruserid:
            error, status = "Forbidden", httplib.FORBIDDEN

        if not error and self._userid not in (table["fk_host"] , playeruserid):
            error, status = "Forbidden", httplib.FORBIDDEN
        elif not error and table["fk_host"] == playeruserid:
            error, status = "Host cannot leave", httplib.BAD_REQUEST

        if not error:
            self._tx.update("players", {"dt_deleted": util.utcnow()}, id=playerid)
            self._tx.update("table_users", {"dt_deleted": util.utcnow()},
                            fk_table=table["id"], fk_user=playeruserid)
            self._tx.commit()

        self._tx.close()
        return result, error, status


    def index(self):
        """
        Returns data for tables index page.

        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = {}, None, httplib.OK

        result["tables"]    = self._tx.fetchall("tables", fk_host=self._userid)
        result["tables"]   += self._tx.fetchall("tables", fk_host=("!=", self._userid), public=True)
        hosters             = util.unwrap(result["tables"], "fk_host")
        result["users"]     = self._tx.fetchall("users", id=("IN", set(hosters)))
        result["templates"] = self._tx.fetchall("templates", dt_deleted=None)

        self.update_online()
        self._tx.close()
        return result, error, status


    def poll(self, tableid=None, shortid=None, dt_from=None):
        """
        Returns poll data for table page.

        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        where = {"id": tableid} if tableid else {"shortid": shortid}
        table = self._tx.fetchone("tables", where=where)

        if not table:
            error, status = "Not found", httplib.NOT_FOUND
        else:
            table_users = self._tx.fetchall("table_users", fk_table=table["id"],
                                            dt_deleted=None)

        if not error and not any(self._userid == x["fk_user"] for x in table_users):
            self._tx.insert("table_users", fk_table=table["id"], fk_user=self._userid)
            self._tx.insert("online", fk_table=table["id"], fk_user=self._userid)
            self._tx.commit()
            table_users = self._tx.fetchall("table_users", fk_table=table["id"],
                                            dt_deleted=None)

        if not error:
            self._table, self._table_users = table, table_users
            _, template, game, players, users = self.populate(
                template=True, game=True, players=True, users=True
            )

            dt_from = dt_from or pytz.utc.localize(datetime.datetime.min)
            where = {"dt_changed": (">", dt_from), "fk_table": table["id"],
                     "fk_user": ("IN", set(util.unwrap(users, "id")) - set([self._userid]))}
            online = self._tx.fetchall("online", where=where)

            if not table   ["dt_changed"] > dt_from: table     = None
            if not template["dt_changed"] > dt_from: template  = None
            if game and not game["dt_changed"] > dt_from: game = None

            table_users = [x for x in table_users if x["dt_changed"] > dt_from]
            players     = [x for x in players     if x["dt_changed"] > dt_from]
            userids = set(util.unwrap(table_users, "fk_user")) | set(util.unwrap(players, "fk_user"))
            users = [x for x in users if x["dt_changed"] > dt_from or x["id"] in userids]

            result = dict(tables=[table], games=[game], players=players, users=users,
                          online=online, table_users=table_users, templates=[template])
            result = {k: v for k, v in result.items() if any(v)}
            for datatype in "players", "table_users":
                dels = self._tx.fetchall(datatype, "id", dt_deleted=("!=", None),
                                         dt_changed=(">", dt_from))
                if dels: result.setdefault("__deleted__", {})[datatype] = dels
        result = self.adapt_data(result)

        self.update_online()
        self._tx.close()
        return result, error, status


    def poll_index(self, dt_from=None):
        """
        Returns poll data for index page.

        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = {}, None, httplib.OK

        where = {"EXPR": ("(public = ? OR fk_host = ? or id in "
                 "(SELECT fk_table FROM table_users WHERE fk_table = tables.id "
                 "AND fk_user = ? AND dt_deleted IS NULL))",
                 [True, self._userid, self._userid])}
        if dt_from: where["dt_changed"] = (">=", dt_from)
        result["tables"] = self._tx.fetchall("tables", where=where)

        where = {"id": ("IN", util.unwrap(result["tables"], "fk_host"))} \
                if result["tables"] else {}
        if where: result["users"] = self._tx.fetchall("users", where=where)

        where = {}
        if dt_from: where["dt_changed"] = (">=", dt_from)
        result["templates"] = self._tx.fetchall("templates", where=where)

        result = {k: v for k, v in result.items() if any(v)}

        dels = self._tx.fetchall("templates", "id", dt_changed=(">", dt_from),
                                 dt_deleted=("!=", None))
        if dels: result.setdefault("__deleted__", {})["templates"] = util.unwrap(dels)
        dels = self._tx.fetchall("tables", "id", dt_changed=(">", dt_from),
                                 fk_host=("!=", self._userid), public=False)
        if dels: result.setdefault("__deleted__", {})["tables"] = util.unwrap(dels)

        self.update_online()
        self._tx.close()
        return result, error, status


    def update_online(self):
        """
        Updates user's online status.
        """
        DELTA_UPDATE = datetime.timedelta(seconds=conf.OnlineUpdateInterval)
        now = util.utcnow()

        where = dict(fk_user=self._userid)
        for tableid in set([None, (self._table or {}).get("id")]):
            where.update(fk_table=tableid)
            row = self._tx.fetchone("online", where=where)
            if not row: self._tx.insert("online", where)
            elif now - row["dt_online"] > DELTA_UPDATE:
                self._tx.update("online", {"dt_online": now, "active": True},
                                where=where)
            self._tx.commit()


    def action(self, data):
        """
        Performs specific game actions, 

        @param   data  {action: str, fk_table, data: {}}
        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        HANDLERS = {"start": self.start, "end": self.end, "look": self.look,
                    "bid": self.bid, "move": self.move, "distribute": self.distribute,
                    "reset": self.reset}

        if data["action"] not in HANDLERS:
            error, status = "Unknown action", httplib.BAD_REQUEST
        else:
            tableid = data.pop("fk_table")
            table_users = self._tx.fetchall("table_users", fk_table=tableid)

            if not any(x["fk_user"] == self._userid for x in table_users):
                error, status = "Forbidden", httplib.FORBIDDEN
            else:
                self._table_users = table_users
                self._table = self._tx.fetchone("tables", id=tableid)
                error, status = HANDLERS[data["action"]](data)

            if error:
                self._tx.rollback()
            else:
                self._tx.insert("log", action=data.pop("action"),
                          data=data, fk_user=self._userid)
                self._tx.commit()
        result = self.adapt_data(result)

        self.update_online()
        self._tx.close()
        return result, error, status


    def start(self, data=None):
        """

        @return        (error, statuscode)
        """
        error, status = None, httplib.OK

        table, template, players, player = self.populate(template=True, players=True, player=True)

        if self._userid != table["fk_host"]:
            error, status = "Forbidden", httplib.FORBIDDEN
        elif table["status"] not in ("new", "ended"):
            error, status = "Game underway", httplib.CONFLICT
        elif util.get(template, "opts", "players") \
        and not (template["opts"]["players"][0] <= len(players) <= template["opts"]["players"][1]):
            error, status = "Not enough players", httplib.BAD_REQUEST
        else:
            deck = make_deck(template)
            dist = distribute_deck(template, players, deck)
            logger.info("Starting new game of %s on table #%s '%s'.",
                        template["name"], table["id"], table["name"])

            gamestatus = "bidding" if "bidding" in template["opts"] else "ongoing"
            game = {"deck": deck, "sequence": table["games"] + 1,
                    "status": gamestatus, "fk_table": table["id"],
                    "hands": {k: v for k, v in dist.items() if k != "talon"}}
            if "talon" in dist: game["talon"] = game["talon0"] = dist["talon"]

            expecteds = {} # {fk_player: {..}}

            # Set starting player, next from previous game's starting player
            game0 = self._tx.fetchone("games", fk_table=table["id"], sequence=table["games"])

            if game0 and game0["score"] and util.get(template, "opts", "nextgame", "distribute"):
                # Game starts with players exchanging cards

                game["status"] = "distributing"
                if util.get(template, "opts", "nextgame", "distribute", "ranking"):

                    ranking = {int(k): v for k, v in game0["score"].items()}
                    playersx = sorted([x for x in players if x["id"] in ranking],
                                      key=lambda x: ranking[x["id"]])
                    count = util.get(template, "opts", "nextgame", "distribute", "max")

                    for i, player1 in enumerate(playersx):
                        if i >= len(playersx) / 2:
                            break # for i, (..)
                        player2 = playersx[-(i + 1)]
                        pchanges1 = {"action": "distribute",
                                     "distribute": {player2["id"]: count - i}}
                        pchanges2 = {"action": "distribute",
                                     "distribute": {player1["id"]: count - i}}
                        expecteds[player1["id"]] = pchanges1
                        expecteds[player2["id"]] = pchanges2

            else:
                player0 = player
                if game0:
                    player0id = None
                    if game0["bids"]:
                        # Next from previous game's first bidder
                        player0id = int(game0["bids"][0]["fk_player"])
                    elif game0["tricks"]:
                        # Next from previous game's first mover
                        player0id = int(game0["tricks"][0][0]["fk_player"])
                    if player0id:
                        player0 = next(x for x in players if x["id"] == player0id)

                game["fk_player"] = players[(players.index(player0) + 1) % len(players)]["id"]

            gameid = self._tx.insert("games", game)

            for p in players:
                pchanges = {"tricks": [], "moves": [], "fk_game": gameid}
                pchanges["hand"] = pchanges["hand0"] = dist[p["id"]]
                if util.get(template, "opts", "bidding", "blind"):
                    pchanges["status"] = "blind"

                if p["id"] == game.get("fk_player"):
                    pchanges["expected"] = {}
                    if util.get(template, "opts", "bidding"):
                        pchanges["expected"]["bid"] = True
                    else:
                        pchanges["expected"]["move"] = True
                        if util.get(template, "opts", "move", "cards"):
                            pchanges["expected"]["cards"] = util.get(template, "opts", "move", "cards")
                elif p["id"] in expecteds:
                    pchanges["expected"] = expecteds[p["id"]]
                self._tx.update("players", pchanges, id=p["id"])

            tchanges = {"status": "ongoing", "games": game["sequence"]}
            self._tx.update("tables", tchanges, id=table["id"])

        return error, status


    def end(self, data=None):
        """
        Carries out game end action.

        @return        (error, statuscode)
        """
        error, status = None, httplib.OK

        table, game, players = self.populate(game=True, players=True)

        if self._userid != table["fk_host"]:
            error, status = "Forbidden", httplib.FORBIDDEN
        elif table["status"] in ("new", "ended"):
            error, status = "Game not underway", httplib.CONFLICT
        else:
            gchanges = {"status": "ended", "fk_player": None}
            tchanges = {"status": "ended"}
            self._tx.update("games", gchanges,  id=game["id"])
            self._tx.update("tables", tchanges, id=table["id"])
            for p in players: self._tx.update("players", {"status": ""}, id=p["id"])
            self._tx.commit()

        return error, status


    def reset(self, data=None):
        """
        Carries out table reset action.

        @return        (error, statuscode)
        """
        error, status = None, httplib.OK

        table, game = self.populate(game=True)

        if self._userid != table["fk_host"]:
            error, status = "Forbidden", httplib.FORBIDDEN
        else:
            tchanges = {"status": "new", "games": 0, "bids": [], "scores": []}
            if table["scores"]:
                tchanges["scores_history"] = table["scores_history"] + [table["scores"]]
            if table["bids"]:
                tchanges["bids_history"]   = table["bids_history"]   + [table["bids"]]
            self._tx.update("tables", tchanges, id=table["id"])
            self._table.update(tchanges)
            error, status = self.start()

        return error, status


    def look(self, data=None):
        """
        Carries out game action: look at own hand.

        @return        (error, statuscode)
        """
        error, status = None, httplib.OK

        self._tx.update("players", {"status": ""}, fk_user=self._userid,
                        fk_table=self._table["id"], status="blind")
        self._tx.commit()

        return error, status


    def bid(self, data):
        """Carries out game bid action."""
        error, status = None, httplib.OK

        table, template, game, players, player = self.populate(
            template=True, game=True, players=True, player=True
        )

        if "bidding" != game["status"]:
            error, status = "Not in bidding phase", httplib.CONFLICT
        elif game["fk_player"] != player["id"]:
            error, status = "Not player's turn", httplib.FORBIDDEN
        elif not data.get("data"):
            error, status = "Bid missing data", httplib.BAD_REQUEST
        else:
            bid, do_pass = data["data"], data["data"].get("pass")
            can_pass    = util.get(template, "opts", "bidding", "pass")
            pass_final  = util.get(template, "opts", "bidding", "pass_final")
            needs_suite = util.get(template, "opts", "bidding", "suite")

            if do_pass and not can_pass:
                error, status = "Cannot pass", httplib.BAD_REQUEST
            elif not do_pass and (not isinstance(bid.get("number"), (int, long)) \
            or needs_suite and bid.get("suite") not in template["opts"]["bidding"]["suite"]):
                error, status = "Bid missing data", httplib.BAD_REQUEST

            elif not do_pass and bid_beyond_limit(template, player, bid, "min"):
                error, status = "Bid too small", httplib.BAD_REQUEST
            elif not do_pass and bid_beyond_limit(template, player, bid, "max"):
                error, status = "Bid too high", httplib.BAD_REQUEST
            elif not do_pass \
            and util.get(template, "opts", "bidding", "step") is not None \
            and bid["number"] % template["opts"]["bidding"]["step"]:
                error, status = "Bid invalid number", httplib.BAD_REQUEST
            elif bid.get("blind") and player["status"] != "blind":
                error, status = "No longer blind", httplib.FORBIDDEN

            if not error and not do_pass and game["bids"]:
                lastbid = next((x for x in game["bids"][::-1] if not x.get("pass")), None)
                numbercmp = cmp(bid["number"], lastbid["number"]) if lastbid else 1

                if numbercmp < 0:
                    error, status = "Bid needs to be higher than previous", httplib.BAD_REQUEST
                elif not numbercmp:
                    if needs_suite:
                        suites = template["opts"]["suites"]
                        suitecmp = suites.index(bid["suite"]) - suites.index(lastbid["suite"])
                        if suitecmp < 0:
                            error, status = "Bid needs to be higher than previous", httplib.BAD_REQUEST
                    else:
                        error, status = "Bid needs to be higher than previous", httplib.BAD_REQUEST

        if not error:
            gchanges = {"bids": game["bids"] + [dict(bid, fk_player=player["id"])]}
            tchanges = {}

            lastbids, winningbid = {}, {}
            for bid0 in gchanges["bids"][::-1]:
                if bid0["fk_player"] not in lastbids:
                    lastbids[bid0["fk_player"]] = bid0
                    if not bid0.get("pass"): winningbid = bid0

            if len(lastbids) == len(players) \
            and all(x.get("pass") for x in lastbids.values()):
                # All players have passed without a single bid: game over.
                gchanges.update(fk_player=None, status="ended")
                tchanges.update(status="ended")
                for p in players: self._tx.update("players", {"status": ""}, id=p["id"])
                    

            elif len(lastbids) == len(players) \
            and len([x for x in lastbids.values() if x.get("pass")]) == len(players) - 1:
                # All players except one have passed: bidding complete.

                for p in players: # Clear blind status
                    self._tx.update("players", {"status": ""}, id=p["id"])

                gchanges["bid"] = next(x for x in gchanges["bids"][::-1] if not x.get("pass"))
                if util.get(template["opts"], "bidding", "talon"):
                    # Bidding player wins talon
                    player2id = winningbid["fk_player"]
                    player2 = next((x for x in players if x["id"] == player2id), None)
                    pchanges2 = {"hand": sort(template, player2["hand"] + game["talon"])}
                    gchanges.update(talon=[], status="ongoing", fk_player=player2id)

                    if util.get(template["opts"], "bidding", "distribute"):
                        distribute = {x["id"]: 1 for x in players if x["id"] != player2id}
                        pchanges2["expected"] = dict(distribute=distribute, action="distribute")
                        gchanges["status"] = "distributing"

                    self._tx.update("players", pchanges2, id=player2id)
                else:
                    gchanges["fk_player"] = None
                    if "bidder" == util.get(template["opts"], "lead", "0"):
                        gchanges["fk_player"] = winningbid["fk_player"]
                    gchanges["status"] = "ongoing"

            else:
                if pass_final:
                    player2 = players[(players.index(player) + 1) % len(players)]
                    while player2["id"] in lastbids and lastbids[player2["id"]].get("pass"):
                        player2 = players[(players.index(player2) + 1) % len(players)]
                    gchanges["fk_player"] = player2["id"]
                else:
                    gchanges["fk_player"] = players[(players.index(player) + 1) % len(players)]["id"]

            self._tx.update("games", gchanges, id=game["id"])
            if tchanges: self._tx.update("tables",  tchanges, id=table["id"])

        return error, status


    def distribute(self, data):
        """Carries out game distribution action after bidding."""
        error, status = None, httplib.OK

        table, template, game, players, player = self.populate(
            template=True, game=True, players=True, player=True
        )

        if "distributing" != game["status"]:
            error, status = "Not in distributing phase", httplib.CONFLICT
        elif not util.get(player, "expected", "distribute"):
            error, status = "Not in distributing phase", httplib.FORBIDDEN
        elif not data.get("data"):
            error, status = "Distribution missing data", httplib.BAD_REQUEST
        elif game["fk_player"] != player["id"] \
        and not util.get(template, "opts", "nextgame", "distribute"):
            error, status = "Not player's turn", httplib.FORBIDDEN
        else:
            dist = {int(k): sort(template, v) for k, v in data["data"].items()}
            expected = {int(k): v for k, v in player["expected"]["distribute"].items()}
            allgiven = sort(template, [x for xx in dist.values() for x in xx])

            if set(dist) - set(util.unwrap(players, "id")) \
            or set(dist) - set(expected):
                error, status = "Unknown players", httplib.BAD_REQUEST
            elif len(drop(player["hand"], allgiven)) > len(player["hand"]) - len(allgiven):
                error, status = "No such cards", httplib.BAD_REQUEST
            for fk_player, count in () if error else expected.items():
                if count != len(dist.get(fk_player) or []):
                    error, status = "Wrong amount being distributed", httplib.BAD_REQUEST
                    break # for fk_player


        if not error and util.get(template, "opts", "nextgame", "distribute", "ranking"):

            game0 = self._tx.fetchone("games", fk_table=table["id"], sequence=table["games"] - 1)
            ranking = {int(k): v for k, v in game0["score"].items()}
            playersx = sorted([x for x in players if x["id"] in ranking],
                              key=lambda x: ranking[x["id"]])
            if ranking[player["id"]] > len(playersx) / 2:
                # The lower half of ranking needs to give top cards
                phand = drop(player["hand"], allgiven)
                if strength(template, phand[0]) > strength(template, allgiven[-1]):
                    error, status = "Must give top cards", httplib.BAD_REQUEST

        if not error:
            gchanges = {}
            pchanges = {"expected": {}, "status": ""}

            if util.get(template, "opts", "nextgame", "distribute"):
                # Multiple players distributing at once

                move = next({"cards": cc, "fk_player2": pid}
                            for pid, cc in dist.items())
                gmove = dict(move, fk_player=player["id"])

                pchanges["moves"] = copy.deepcopy(player["moves"])
                gchanges["moves"] = copy.deepcopy(game["moves"])
                if not player["moves"]: pchanges["moves"].append([])
                if not game["moves"]:   gchanges["moves"].append([])
                pchanges["moves"][-1].append(move)
                gchanges["moves"][-1].append(gmove)
                pchanges["hand"] = drop(player["hand"], allgiven)

                self._tx.update("players", pchanges, id=player["id"])
                player.update(pchanges)

                if not any(util.get(x, "expected", "distribute") for x in players):
                    # All players have distributed who were expected to
                    players = self._tx.fetchall("players", fk_table=table["id"],
                                                dt_deleted=None, order="sequence")
                    for pmove in gchanges["moves"][-1]:
                        # Update receiving player hands
                        player2 = next(x for x in players if x["id"] == pmove["fk_player2"])
                        pchanges2 = {"hand": sort(template, player2["hand"] + pmove["cards"])}
                        self._tx.update("players", pchanges2, id=player2["id"])

                    if util.get(template, "opts", "lead", "0", "ranking") is not None:
                        gchanges["fk_player"] = playersx[util.get(template, "opts", "lead", "0", "ranking")]["id"]
                    else:
                        player0id = int(game0["tricks"][0][0]["fk_player"])
                        player0 = next(x for x in players if x["id"] == player0id)
                        gchanges["fk_player"] = players[(players.index(player0) + 1) % len(players)]["id"]

                    gchanges["status"] = "ongoing"
                    pchanges2 = {"expected": {"move": True}}
                    if util.get(template, "opts", "move", "cards"):
                        pchanges2["expected"]["cards"] = util.get(template, "opts", "move", "cards")
                    self._tx.update("players", pchanges2, id=gchanges["fk_player"])

                self._tx.update("games", gchanges, id=game["id"])


            else:
                # Singple player making distributing move
                gchanges = {"status": "ongoing"}
                pchanges = {"expected": {}}

                for fk_player, cards in dist.items():
                    player2 = next(x for x in players if x["id"] == fk_player)
                    pchanges2 = {"hand": sort(template, player2["hand"] + cards)}
                    self._tx.update("players", pchanges2, id=fk_player)

                pchanges["expected"] = {"move": True}
                if util.get(template, "opts", "move", "cards"):
                    pchanges["expected"]["cards"] = util.get(template, "opts", "move", "cards")
                pchanges["hand"] = drop(player["hand"], allgiven)

                self._tx.update("games",   gchanges, id=game["id"])
                self._tx.update("players", pchanges, id=player["id"])

        return error, status


    def move(self, data):
        """Carries out game move action."""
        error, status = None, httplib.OK

        table, template, game, players, player = self.populate(
            template=True, game=True, players=True, player=True
        )

        if "ongoing" != game["status"]:
            error, status = "Game not underway", httplib.CONFLICT
        elif game["fk_player"] != player["id"]:
            error, status = "Not player's turn", httplib.FORBIDDEN
        elif not data.get("data"):
            error, status = "Move missing data", httplib.BAD_REQUEST
        else:
            cards = data["data"].get("cards") or []
            do_pass, do_crawl, do_trump = (data["data"].get(x) for x in 
                                          ("pass", "crawl", "trump"))
            # @todo võiks ka kontrollida, et crawl ja trump üldse saab templates teha
            do_special = next((x for x in util.get(template, "opts", "move", "special") or {}
                               if x != "trump" and data["data"].get(x)), None)
            expected = player["expected"].get("cards")

            if do_pass and not game["trick"]:
                error, status = "Cannot pass", httplib.BAD_REQUEST
            if do_pass and not util.get(template, "opts", "move", "pass"):
                error, status = "Cannot pass", httplib.BAD_REQUEST
            elif not cards and not do_pass:
                error, status = "Not the right amount of cards", httplib.BAD_REQUEST
            elif len(drop(player["hand"], cards)) > len(player["hand"]) - len(cards):
                error, status = "No such cards", httplib.BAD_REQUEST
            elif isinstance(util.get(template, "opts", "move", "cards"), (int, long)) \
            and len(cards) != util.get(template, "opts", "move", "cards"):
                error, status = "Not the right amount of cards", httplib.FORBIDDEN
            elif do_crawl and isinstance(util.get(template, "opts", "move", "crawl"), (int, long)) \
            and util.get(template, "opts", "move", "crawl") != len(game["tricks"]):
                error, status = "Cannot make crawl move this round", httplib.FORBIDDEN
            elif do_crawl and set(map(level, template["opts"]["cards"][-4])) & set(map(level, player["hand"])):
                error, status = "Cannot crawl if you have a top card", httplib.FORBIDDEN

            elif do_trump and not util.get(template, "opts", "trump"):
                error, status = "Cannot make trump in game", httplib.FORBIDDEN
            elif do_trump and util.get(template, "opts", "move", "special", "trump", len(game["tricks"])) == False:
                error, status = "Cannot make trump this round", httplib.FORBIDDEN
            elif do_trump and not any(len(set(player["hand"]) & set(cc)) == len(cc)
                                      for cc in util.get(template, "opts", "move", "special", "trump", "*")):
                error, status = "No cards to make trump", httplib.FORBIDDEN
            elif do_trump and not any(set(cards) & set(cc)
                                      for cc in util.get(template, "opts", "move", "special", "trump", "*")):
                error, status = "Not trump card", httplib.FORBIDDEN

            elif do_special and util.get(template, "opts", "move", "special", do_special, len(game["tricks"])) == False:
                error, status = "Cannot make {0} this round".format(do_special), httplib.BAD_REQUEST
            elif do_special and not any(len(set(player["hand"]) & set(cc)) == len(cc)
                                      for cc in util.get(template, "opts", "move", "special", do_special, "*")):
                error, status = "No cards to make {0}".format(do_special), httplib.FORBIDDEN
            elif do_special and not any(set(cards) & set(cc)
                                      for cc in util.get(template, "opts", "move", "special", do_special, "*")):
                error, status = "Not {0} card".format(do_special), httplib.FORBIDDEN
            elif do_special and util.get(template, "opts", "move", "special", do_special, "condition") \
            and not util.get(game, "opts", util.get(template, "opts", "move", "special", do_special, "condition")):
                error, status = "Not meeting {0} condition: {1}".format(do_special, util.get(template, "opts", "move", "special", do_special, "condition")), httplib.FORBIDDEN


        if not error:

            if cards and util.get(template, "opts", "move", "suite") and len(set(map(suite, cards))) != 1:
                error, status = "Must play cards of one suite", httplib.BAD_REQUEST
            elif cards and util.get(template, "opts", "move", "level") and len(set(map(level, cards))) != 1:
                error, status = "Must play cards of one level", httplib.BAD_REQUEST
            elif cards and game["trick"] and util.get(template, "opts", "move", "response", "suite") \
            and not any(x.get("crawl") for x in game["trick"]) \
            and set(map(suite, cards)) != set(map(suite, game["trick"][0]["cards"])) \
            and set(map(suite, game["trick"][0]["cards"])) & set(map(suite, player["hand"])):
                error, status = "Must follow suite", httplib.BAD_REQUEST

            elif cards and game["trick"] and util.get(template, "opts", "move", "response", "level") \
            and cmp_cards(template, cards[0], last_cards(game["trick"])[0]) < 0:
                error, status = "Must play at least same level", httplib.BAD_REQUEST

            elif cards and game["trick"] and util.get(template, "opts", "move", "response", "amount") \
            and len(cards) < len(last_cards(game["trick"])):
                error, status = "Must play at least same amount", httplib.BAD_REQUEST

        if not error:
            do_crawl = do_crawl or any(x.get("crawl") for x in game["trick"])
            pchanges = {"expected": {}, "hand": drop(player["hand"], cards)}
            player2, gchanges, tchanges, pchanges2 = None, {}, {}, {}

            move = {}
            if cards: move["cards"] = cards
            if do_trump:
                move["trump"] = True
                gchanges["opts"] = dict(game["opts"], trump=suite(cards[0]))
            if do_special:
                move[do_special] = True
            if do_crawl:
                move["crawl"] = True
            if do_pass:
                move["pass"] = True
            gmove = dict(move, fk_player=player["id"])

            pchanges["moves"] = copy.deepcopy(player["moves"])
            if not any(x["fk_player"] == player["id"] for x in game["trick"]):
                pchanges["moves"].append([])
            pchanges["moves"][-1].append(move)

            gchanges["moves"]    = copy.deepcopy(game["moves"])
            gchanges["trick"]    = copy.deepcopy(game["trick"])
            if not game["trick"]:    gchanges["moves"].append([])
            gchanges["moves"][-1].append(gmove)
            gchanges["trick"].append(gmove)

            player.update(pchanges)
            playerids_ingame = set(x["id"] for x in players if x["hand"])
            playerids_passed = set(x["fk_player"] for x in gchanges["trick"] if x.get("pass"))
            playerid_lastmove = next((x["fk_player"] for x in gchanges["trick"][::-1]
                                      if not x.get("pass")), None)

            round_over = game_over = False
            if util.get(template, "opts", "trick") and len(gchanges["trick"]) == len(players):
                # All players have participated in trick
                round_over = True
            elif cards and util.get(template, "opts", "move", "win") \
            and "all" == util.get(template, "opts", "move", "win", "level") \
            and has_allofakind(template, gchanges["trick"]):
                # Trick ends with all of a kind
                round_over = True
            elif not util.get(template, "opts", "trick") \
            and util.get(template, "opts", "move", "win", "last") \
            and len(playerids_ingame - playerids_passed - set([playerid_lastmove])) < 1:
                # All except one have passed or played their last
                round_over = True

            if round_over and len(playerids_ingame) < 2:
                # Only one or zero players have any cards left
                game_over = True

            if round_over:
                player2 = round_winner(template, dict(game, **gchanges), players, gchanges["trick"])

                if not game_over and "trick" == util.get(template["opts"], "lead", "*"):
                    pchanges2["expected"] = {"move": True, "cards": util.get(template, "opts", "move", "cards")}
                    player_next = player2
                    if not player_next["hand"]:
                        player_next = next_player_in_game(template, dict(game, **gchanges), players, player_next)
                    gchanges["fk_player"] = player_next["id"]
                if util.get(template, "opts", "trick"):
                    pchanges2["tricks"] = copy.deepcopy(player2["tricks"]) + [gchanges["trick"]]

                gchanges["discards"] = copy.deepcopy(game["discards"]) + [gchanges["trick"]]

                gchanges["tricks"] = copy.deepcopy(game["tricks"]) + [gchanges["trick"]]
                gchanges["trick"] = []
            else:
                player2 = next_player_in_round(template, dict(game, **gchanges), players, player)
                gchanges["fk_player"] = player2["id"]
                pchanges2["expected"] = {"move": True, "cards": util.get(template, "opts", "move", "cards")}

            self._tx.update("games",   gchanges, id=game["id"])
            self._tx.update("players", pchanges, id=player["id"])
            if pchanges2: self._tx.update("players", pchanges2, id=player2["id"])
            if tchanges:  self._tx.update("tables",  tchanges,  id=table["id"])

            if game_over:
                game    = self._tx.fetchone("games",   fk_table=table["id"], order=("dt_created", True))
                players = self._tx.fetchall("players", fk_table=table["id"], dt_deleted=None, order="sequence")

                gchanges = {"status": "ended", "fk_player": table["fk_host"]}
                tchanges = {"status": "ended"}
                if game["bid"]:
                    tchanges["bids"] = table["bids"] + [game["bid"]]
                if util.get(template, "opts", "points"):
                    gchanges["score"] = game_points(template, table, game, players)
                    tchanges["scores"] = table_points(template, table, gchanges["score"])
                elif util.get(template, "opts", "ranking"):
                    gchanges["score"] = game_ranking(template, game, players)
                    tchanges["scores"] = table["scores"] + [gchanges["score"]]

                if is_game_complete(template, dict(table, **tchanges)):
                    tchanges["status"] = "complete"

                self._tx.update("games",   gchanges, id=game["id"])
                self._tx.update("tables",  tchanges, id=table["id"])
                for p in players: self._tx.update("players", {"dt_changed": util.utcnow()}, id=p["id"])
                    


        return error, status


    def populate(self, template=False, game=False, players=False, player=False, users=False):
        """
        Populates instance data structures and returns (table, ..all requested..).
        """
        result = [self._table]

        if template and not self._template:
            self._template = self._tx.fetchone("templates", id=self._table["fk_template"])
        if game and not self._game:
            self._game = self._tx.fetchone("games", fk_table=self._table["id"], sequence=self._table["games"])
        if (players or player) and self._players is None:
            self._players = self._tx.fetchall("players", fk_table=self._table["id"], dt_deleted=None, order="sequence")
        if player and not self._player:
            self._player = next((x for x in self._players if x["fk_user"] == self._userid), None)
        if users and not self._users:
            where = {"EXPR": ("id IN (SELECT fk_user FROM table_users "
                     "WHERE fk_table = ?)", [self._table["id"]])}
            self._users = self._tx.fetchall("users", where=where)

        if template: result.append(self._template)
        if game:     result.append(self._game)
        if players:  result.append(self._players)
        if player:   result.append(self._player)
        if users:    result.append(self._users)

        return result


    def adapt_data(self, data):
        """
        Returns card structures replaced with blanks if user not in state
        to see cards.
        """
        FIELDS = {"players": ["hand", "hand0", "moves", "tricks"],
                  "games":   ["deck", "hands", "talon",  "talon0",
                              "tricks", "trick", "moves", "discards"]}
        for datatype, fields in FIELDS.items() if data else ():
            for row in data.get(datatype, []):
                for field in fields:
                    row[field] = self.reveal_cards(datatype, field, row[field], row)
        return data


    def reveal_cards(self, datatype, field, value, row):
        """
        Returns card structures replaced with blanks if user not in state
        to see cards.
        """
        result, faceup = value, None
        hider = lambda v: (v and " ") if len(v) < 3 else v

        table, template, game = self.populate(template=True, game=True)
        is_game   = ("games"   == datatype)
        is_player = ("players" == datatype)
        player = row if is_player else None

        if is_game and game["status"] == "ongoing" and any(x.get("crawl") for x in game["trick"]):
            # Game doing crawl trick, hide games.trick and all moves but previous
            if field == "trick":
                faceup = False
            elif field == "moves":
                result = util.recursive_decode(value[:-2], [hider]) + value[-2:-1] + \
                         util.recursive_decode(value[-1:], [hider])
                faceup = True

        if faceup is None and field in ("tricks", "discards"):
            # Render only last trick and last discard visible
            result = util.recursive_decode(value[:-1], [hider]) + value[-1:]
            faceup = True

        if faceup is None and is_player and game \
        and game["status"] == "bidding" and player["status"] == "blind":
            # Game supports blind bidding, player has not looked at own cards yet
            if field in ("hand", "hand0"):
                faceup = False

        if faceup is None and field == "trick":
            # Game ongoing trick visible, if not crawl
            faceup = True

        if faceup is None and is_player and self._userid == player["fk_user"] \
        and field in ("hand", "hand0"):
            # Reveal player's own hand to player, if not blind
            faceup = True

        if faceup is None and field == "moves":
            # Moves are always hidden by default
            faceup = False

        if faceup is None and game and game["status"] == "ended":
            # Reveal everything at game end
            faceup = util.get(template["opts"], "reveal")

        if faceup is None and field in ("talon", "talon0"):
            # Reveal talon according to game template
            faceup = util.get(template["opts"], "talon", "face")

        if not faceup:
            result = util.recursive_decode(value, [hider])

        return result


def make_deck(template):
    """Returns a new shuffled deck for specified game template."""
    result = template["opts"]["cards"][:]
    random.shuffle(result)
    return result


def distribute_deck(template, players, deck):
    """
    Returns deck cards distributed to players and talon, as
    {"talon": [..cards..], userid1: [..cards..], userid2: [..cards..], }.
    """
    result = {x["id"]: [] for x in players}
    maxhand, deck = util.get(template, "opts", "hand"), deck[:]

    while deck:
        for p in players:
            if not deck: break # for p
            result[p["id"]].append(deck.pop(0))

        if maxhand and any(len(result[p["id"]]) >= maxhand for p in players) \
        or "talon" in template["opts"] and len(deck) <= len(players):
            break # while

    if deck and "talon" in template["opts"]:
        result["talon"] = deck

    for p in players:
        result[p["id"]] = sort(template, result[p["id"]])

    return result


def sort(template, cards):
    """Returns cards sorted according to template options."""
    return sorted(cards, cmp=lambda a, b: -cmp_cards(template, a, b))


def cmp_cards(template, a, b):
    """
    Returns whether card a is weaker, equal or stronger than b (-1, 0, 1).
    """
    result = 0

    strengths = util.get(template, "opts", "strengths")
    suites    = util.get(template, "opts", "suites")

    for category in util.listify(util.get(template, "opts", "sort") or []):
        if result: break # for category

        if "suite" == category and suites:
            result = suites.index(suite(a)) - suites.index(suite(b))
        if "strength" == category and strengths:
            result = strengths.index(level(a)) - strengths.index(level(b))

    return result and result / abs(result)


def round_winner(template, game, players, trick):
    """Returns ID of game player who won the trick."""
    playerid = trick[0]["fk_player"]

    if util.get(template, "opts", "trick"):
        wsuite, wlevel = None, None
        if util.get(template, "opts", "move", "win", "suite"):
            wsuite = suite(next(x["cards"][0] for x in trick if x.get("cards")))
        if util.get(template, "opts", "move", "win", "level"):
            wlevel = level(next(x["cards"][0] for x in trick if x.get("cards")))

        for move in trick:
            if not move.get("cards"): continue # for move
            msuite, mlevel = next((suite(x), level(x)) for x in move["cards"])
            if util.get(template, "opts", "trump") \
            and msuite == util.get(game, "opts", "trump") and msuite != wsuite:
                wsuite, wlevel = msuite, mlevel
            if msuite == wsuite and strength(template, mlevel) >= strength(template, wlevel):
                wlevel, playerid = mlevel, move["fk_player"]

    elif util.get(template, "opts", "move", "win", "last"):
        playerid = next(x["fk_player"] for x in trick[::-1] if x.get("cards"))

    return next(x for x in players if x["id"] == playerid)


def game_points(template, table, game, players):
    """Returns scores for game, from current tricks."""
    result = {}
    popts = util.get(template, "opts", "points")

    for player in players:
        score = 0

        for trick in player["tricks"]:
            for move in trick:
                for card in move.get("cards", []):
                    score += points(template, card)

        for trick in player["moves"]:
            for move in trick:
                if move.get("trump") and popts.get("trump"):
                    score += popts["trump"][suite(move["cards"][0])]
                for x in set(popts) & set(move):
                    if "trump" != x and move.get(x): score += popts[x]

        if player["id"] == game["bid"].get("fk_player") \
        and game["bid"].get("number"):
            op = None
            # Apply penalty for not fulfilling bid
            if score < game["bid"]["number"]:
                if util.get(popts, "penalties", "blind") \
                and game["bid"].get("blind"):
                    op = util.get(popts, "penalties", "blind")
                else: 
                    op = util.get(popts, "penalties", "bid")
            else:
                # Bidder only wins as much as they bid
                score = game["bid"]["number"]
            if op: score = apply_op(game["bid"]["number"], op)

        if player["id"] != game["bid"].get("fk_player") \
        and popts.get("bidonly", "min") is not None:
            # Player at stage where they can only get points from bidding
            score0 = util.get(table, "scores", -1, player["id"]) or 0
            if score0 >= popts["bidonly"]["min"]: score = 0

        result[player["id"]] = score

    return result


def table_points(template, table, lastscores):
    """Returns new scores for table, as [[{playerid1: xx, ..}, ], ]."""
    result = copy.deepcopy(table["scores"]) + [{}]
    copts = util.get(template, "opts", "points", "penalties", "nochange")

    for playerid, score in lastscores.items():
        if not score and copts and copts.get("times"):
            allscores = [x.get(playerid, x.get(str(playerid))) for x in table["scores"]]
            allscores = [x for x in allscores if x is not None]
            allscores += allscores[-1:] # No point change -> prev score repeats
            if len(allscores) >= copts["times"] \
            and len(set(allscores[-copts["times"] - 1:])) == 1:
                score = apply_op(score, copts)        

        score0 = util.get(table, "scores", -1, str(playerid)) or 0
        result[-1][playerid] = score0 + score
    return result


def game_ranking(template, game, players):
    """Returns ranking scores for game, from game moves."""
    result = {}
    ropts = util.get(template, "opts", "ranking")

    if ropts.get("finish"):
        ranking = {}

        for i, moves in enumerate(game["moves"]):
            for j, move in enumerate(moves):
                if move.get("pass"): continue # for move
                ranking[int(move["fk_player"])] = i * len(template["opts"]["cards"]) + j

        for player in players:
            if player["hand"]: ranking[player["id"]] = sys.maxint

        for i, playerid in enumerate(sorted(ranking, key=lambda x: ranking[x])):
            result[playerid] = i + 1

    return result


def bid_beyond_limit(template, player, bid, side):
    """Returns whether player bid is over or under allowed maximum or minimum."""
    result = False
    limit = util.get(template, "opts", "bidding", side)
    if isinstance(limit, dict):
        if "trump" in limit and util.get(template, "opts", "trump") \
        and any(len(set(player["hand"]) & set(cc)) == len(cc)
                for cc in util.get(template, "opts", "move", "special", "trump", "*")):
            limit = limit.get("trump")
        else: limit = limit.get("*")

    if limit is not None:
        result = bid["number"] > limit if "max" == side else \
                 bid["number"] < limit if "min" == side else result
    return result


def is_game_complete(template, table):
    """Returns whether table has reached total game completion (e.g. max score)."""
    result = False
    copts = util.get("template", "opts", "complete") or {}

    if copts.get("score") and table["scores"]:
        for score in table["scores"][-1].values():
            if score >= copts["score"]:
                result = True
                break # for score

    return result


def has_allofakind(template, trick):
    """Returns whether trick ends with all of the cards of one level."""
    tricklevels = [level(y) for x in trick for y in x.get("cards") or []]
    lastlevels = [x for x in tricklevels[::-1] if x == tricklevels[-1]]
    alllevels = map(level, util.get(template, "opts", "cards") or [])
    levelcounts = collections.Counter(alllevels)
    return levelcounts[lastlevels[0]] == len(lastlevels)


def next_player_in_round(template, game, players, player):
    """Returns the next player in trick."""
    result = None
    while not result:
        result = players[(players.index(player) + 1) % len(players)]
        if not result["hand"] \
        or any(x.get("pass") for x in game["trick"] if x["fk_player"] == result["id"]):
            result, player = None, result

    return result


def next_player_in_game(template, game, players, player):
    """Returns the next player in game, one after this player who still has cards."""
    result = None
    while not result:
        result = players[(players.index(player) + 1) % len(players)]
        if not result["hand"]:
            result, player = None, result
    return result


def last_cards(trick):
    """Returns last cards played in trick."""
    return next(x["cards"] for x in trick[::-1] if x.get("cards"))


def suite(card):
    """Returns card suite, one of "DHSC" or "X" for joker."""
    return card[1:]


def level(card):
    """Returns card level, one of "234567890JQKAX"."""
    return "X" if "X" == card[1:] else card[:1]


def strength(template, card):
    """Returns card or level strength in template level strengths order."""
    return util.get(template, "opts", "strengths").index(level(card))


def points(template, card):
    """Returns points for card."""
    result = 0
    values = util.get(template, "opts", "points", "trick")
    csuite, clevel = suite(card), level(card)
    if card   in values: result += values[card]
    if csuite in values: result += values[csuite]
    if clevel in values: result += values[clevel]
    return result


def drop(cards, todrop):
    """Returns cards without those in todrop."""
    result = cards[:]
    [result.remove(x) for x in todrop if x in result]
    return result


def apply_op(value, opts):
    """
    Applies an arithmetic operation on value.

    @param   opts   {"op": "mul"|"add", "value": number}
    """
    result = value
    if "mul" == opts.get("op"):
        result = value * opts.get("value", 1)
    elif "add" == opts.get("op"):
        result = value + opts.get("value", 0)
    return result    




if "__main__" == __name__:
    import json
    template = {"opts": json.loads("""{
        "cards":     ["9D", "9H", "9S", "9C", "JD", "JH", "JS", "JC", "QD", "QH", "QS", "QC", "KD", "KH", "KS", "KC", "0D", "0H", "0S", "0C", "AD", "AH", "AS", "AC"],
        "strengths": "9JQK0A",
        "suites":    "DHSC",
        "points":    {"9": 0, "0": 10, "J": 2, "Q": 3, "K": 4, "A": 11},
        "players":   [3, 4],
        "hand":      7,
        "sort":      ["suite", "strength"],

        "talon":    {
            "face":       false
        },
        "trick":    true,
        "bid":      {
            "min":         60,
            "max":         340,
            "step":        5,
            "pass":        true,
            "pass_final":  true,
            "talon":       true,
            "aftermarket": true,
            "distribute":  true,
            "blind":       true,
            "distribute":  1
        },

        "lead":     {
            "0":    "bidder",
            "*":    "trick"
        },
        "move":     {
            "cards":   1,
            "pass":    false,
            "blind":   0,
            "response":  {
              "suite":   true
            }
        },
        "order":    true,
        "pass":     false,
        "redeal":   {
            "reveal":      true
        }
    }
    """)}
    players = [{"id": i} for i in range(4)]
    deck = make_deck(template)
    # print distribute_deck(template, players, deck)

    from deckathlon import model
    model.init(conf.DbSchema, conf.DbPath, conf.DbStatements)
    template = db.fetchone("templates")
    table = db.fetchone("tables")
    table["scores"] = table["scores"][:-1]
    lastscores = {
      "1": 0, 
      "8": 0, 
      "9": 60, 
      "10": 0
    }


    #template = db.fetchone("templates", name="Arschloch")
    #players = db.fetchall("players", fk_table=14, order="sequence")

    for p in db.fetchall("players", fk_table=14, order="sequence"):
        print p["id"], len(p["hand0"]), p["hand0"]
        #print p["id"], len(p["hand"]), p["hand"]
