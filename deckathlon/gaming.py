# -*- coding: utf-8 -*-
"""
Gaming engine.

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author    Erki Suurjaak
@created   19.04.2020
@modified  17.05.2020
------------------------------------------------------------------------------
"""
import collections
import copy
import datetime
import httplib
import logging
import random
import string
import sys
import threading

import pytz

from . import conf
from . lib import db, util

MUTEX = collections.defaultdict(threading.Lock) # {table ID: lock}

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
        self._user = self._tx.fetchone("users", id=userid)


    def finalize(self, no_online=False):
        """Updates online-status, closes transaction."""
        if not no_online: self.update_online()
        self._tx.close()


    def update_online(self):
        """Updates user's online status, for table and global."""
        DELTA_UPDATE = datetime.timedelta(seconds=conf.OnlineUpdateInterval)
        now = util.utcnow()

        where = dict(fk_user=self._userid)
        for tableid in set([None, (self._table or {}).get("id")]):
            with MUTEX[tableid]:
                where.update(fk_table=tableid)
                row = self._tx.fetchone("online", where=where)
                if not row: self._tx.insert("online", where)
                elif now - row["dt_online"] > DELTA_UPDATE:
                    self._tx.update("online", {"dt_online": now, "active": True},
                                    where=where)
                self._tx.commit()


    def table(self, **kwargs):
        """Queries and sets and returns self._table."""
        if "dt_deleted" not in kwargs: kwargs["dt_deleted"] = None
        self._table = self._tx.fetchone("tables", **kwargs)
        return self._table


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
            data = {k: data[k] for k in data if k in ("name", "fk_template", "public", "opts")}
            data["shortid"] = None
            with MUTEX[None]:
                while not data["shortid"] \
                or self._tx.fetchone("tables", shortid=data["shortid"], dt_deleted=None):
                    data["shortid"] = "".join(random.sample(string.ascii_lowercase, k=4))
            data["fk_creator"] = data["fk_host"] = self._userid
            data["players"] = 1

            result = self.table(id=self._tx.insert("tables", data))
            logger.info("User '%s' created table #%s '%s'.",
                        self._user['username'], result["id"], result["name"])
            self._tx.insert("table_users", fk_table=result["id"], fk_user=self._userid)
            self._tx.insert("players",     fk_table=result["id"], fk_user=self._userid)
            self._tx.commit()

        self.finalize()
        return result, error, status


    def update(self, tableid, data):
        """
        Updates and returns table data.

        @param   data  {name, fk_template, public, opts}
        @return        ({table data} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        data = {k: data[k] for k in data if k in ("name", "fk_template", "public", "opts")}

        table = self.table(id=tableid)
        if table and self._userid == table["fk_host"]:
            self._tx.update("tables", data, id=tableid)
            self._tx.commit()
            logger.info("User '%s' saved changes for table #%s: %s.",
                        self._user["username"], tableid, data)
            result = self.table(id=tableid)
        elif table:
            error, status = "Forbidden", httplib.FORBIDDEN
        else:
            error, status = "Not found", httplib.NOT_FOUND

        self.finalize()
        return result, error, status


    def update_player(self, playerid, data):
        """
        Updates and returns player data.

        @param   data  {fk_user}
        @return        ({player data} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        data = {k: data[k] for k in data if k in ("fk_user", )}
        player = self._tx.fetchone("players", id=playerid, dt_deleted=None)

        if not player:
            error, status = "Not found", httplib.NOT_FOUND
        elif "fk_user" not in data:
            error, status = "Unknown action", httplib.BAD_REQUEST
        elif data.get("fk_user"):
            error, status = "Unknown action", httplib.BAD_REQUEST
        else:
            table = self.table(id=player["fk_table"])
            if not table:
                error, status = "Not found", httplib.NOT_FOUND
            elif player["fk_user"] == table["fk_host"]:
                error, status = "Host cannot leave", httplib.BAD_REQUEST

        if not error and self._userid not in (player["fk_user"], table["fk_host"]):
            error, status = "Forbidden", httplib.FORBIDDEN

        if not error:
            self._tx.update("players", data, id=playerid)
            self._tx.commit()
            logger.info("User '%s' saved changes for player #%s: %s.",
                        self._user["username"], playerid, data)
            result = self._tx.fetchone("players", id=playerid)
            result = self.adapt_data({"players": result})["players"]

        self.finalize()
        return result, error, status


    def remove_player(self, playerid):
        """
        Removes player from table.

        @return        ({player} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        player = self._tx.fetchone("players", id=playerid, dt_deleted=None)

        if not player:
            error, status = "Not found", httplib.NOT_FOUND
        elif not player["fk_user"]:
            error = "" # Nothing to do
        else:
            table = self.table(id=player["fk_table"])
            if not table:
                error, status = "Not found", httplib.NOT_FOUND

        if error is None and self._userid not in (player["fk_user"], table["fk_host"]):
            error, status = "Forbidden", httplib.FORBIDDEN
        elif error is None and table["fk_host"] == player["fk_user"]:
            error, status = "Host cannot leave", httplib.BAD_REQUEST
        elif error is None:
            with MUTEX[table["id"]]:
                self._tx.update("players", {"dt_deleted": util.utcnow()}, id=player["id"])
                self._tx.update("tables", {"players": table["players"] - 1}, id=table["id"])
                self._tx.commit()
            user = self._tx.fetchone("users", id=player["fk_user"])
            logger.info("User '%s' %s table #%s as player #%s.", user["username"],
                        "left" if player["fk_user"] == self._userid else "kicked from",
                        table["id"], player["id"])

        self.finalize()
        return result, error, status


    def index(self):
        """
        Returns data for tables index page.

        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = {}, None, httplib.OK

        where = {"EXPR": ("(public = ? OR fk_host = ? or id in "
                 "(SELECT fk_table FROM table_users WHERE fk_table = tables.id "
                 "AND fk_user = ? AND dt_deleted IS NULL))",
                 [True, self._userid, self._userid])}
        where["dt_deleted"] = None
        result["tables"]    = self._tx.fetchall("tables", where=where)
        hosters             = util.unwrap(result["tables"], "fk_host")
        result["users"]     = self._tx.fetchall("users", id=("IN", set(hosters)))
        result["templates"] = self._tx.fetchall("templates", dt_deleted=None)
        if result["tables"]:
            players = self._tx.fetchall("players", "fk_table, fk_user", dt_deleted=None,
                                        fk_table=("IN", util.unwrap(result["tables"], "id")))
            for t in result["tables"]: t["users"] = [
                x["fk_user"] for x in players if x["fk_table"] == t["id"] and x["fk_user"]
            ]

        self.finalize()
        return result, error, status


    def poll(self, tableid=None, shortid=None, dt_from=None):
        """
        Returns poll data for table page.

        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        table = self.table(**{"id": tableid} if tableid else {"shortid": shortid})

        if not table:
            error, status = "Not found", httplib.NOT_FOUND
        else:
            with MUTEX[table["id"]]:
                table_users = self._tx.fetchall("table_users", fk_table=table["id"],
                                                dt_deleted=None)
                if not any(self._userid == x["fk_user"] for x in table_users):
                    self._tx.insert("table_users", fk_table=table["id"], fk_user=self._userid)
                    self._tx.commit()
                    table_users = self._tx.fetchall("table_users", fk_table=table["id"],
                                                    dt_deleted=None)
                self._table_users = table_users

        if not error:
            table, template, game, players, users = self.populate(
                template=True, game=True, players=True, users=True
            )

            dt_from = dt_from or pytz.utc.localize(datetime.datetime.min)
            where = {"dt_changed": (">", dt_from), "fk_table": table["id"],
                     "fk_user": ("IN", set(util.unwrap(users, "id")) - set([self._userid]))}
            online = self._tx.fetchall("online", where=where)
            where = {"dt_changed": (">", dt_from), "fk_table": table["id"],
                     "status": ("IN", ["new", "pending", "rejected"])}
            if self._userid != table["fk_host"]:
                where["EXPR"] = ("(public = ? OR fk_user = ?)", [True, self._userid])
            requests = self._tx.fetchall("requests", where=where)

            if not table   ["dt_changed"] > dt_from: table     = None
            if not template["dt_changed"] > dt_from: template  = None
            if game and not game["dt_changed"] > dt_from: game = None

            table_users = [x for x in table_users if x["dt_changed"] > dt_from]
            players     = [x for x in players     if x["dt_changed"] > dt_from]
            userids = set(util.unwrap(table_users, "fk_user")) | set(util.unwrap(players, "fk_user"))
            users = [x for x in users if x["dt_changed"] > dt_from or x["id"] in userids]

            result = dict(tables=[table], games=[game], players=players, users=users,
                          online=online, table_users=table_users, templates=[template],
                          requests=requests)
            result = {k: v for k, v in result.items() if any(v)}
            for datatype in "players", "table_users":
                dels = self._tx.fetchall(datatype, "id", dt_deleted=("!=", None),
                                         dt_changed=(">", dt_from))
                if dels: result.setdefault("__deleted__", {})[datatype] = util.unwrap(dels, "id")
        result = self.adapt_data(result)

        self.finalize()
        return result, error, status


    def poll_index(self, dt_from=None):
        """
        Returns poll data for index page.

        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = {}, None, httplib.OK

        twhere = {"EXPR": ("(public = ? OR fk_host = ? or id in "
                  "(SELECT fk_table FROM table_users WHERE fk_table = tables.id "
                  "AND fk_user = ? AND dt_deleted IS NULL))",
                  [True, self._userid, self._userid])}
        twhere["dt_deleted"] = None
        if dt_from: twhere["dt_changed"] = (">=", dt_from)
        result["tables"] = self._tx.fetchall("tables", where=twhere)

        if result["tables"]:
            players = self._tx.fetchall("players", "fk_table, fk_user", dt_deleted=None,
                                        fk_table=("IN", util.unwrap(result["tables"], "id")))
            for t in result["tables"]:
                t["users"] = [x["fk_user"] for x in players if x["fk_table"] == t["id"]]

        where = {"id": ("IN", set(util.unwrap(result["tables"], "fk_host")))} \
                if result["tables"] else {}
        if where: result["users"] = self._tx.fetchall("users", where=where)

        where = {"dt_deleted": None}
        if dt_from: where["dt_changed"] = (">=", dt_from)
        result["templates"] = self._tx.fetchall("templates", where=where)

        result = {k: v for k, v in result.items() if any(v)}

        if dt_from:
            dels = self._tx.fetchall("templates", "id", dt_changed=(">", dt_from),
                                     dt_deleted=("!=", None))
            if dels: result.setdefault("__deleted__", {})["templates"] = util.unwrap(dels)
            dels = self._tx.fetchall("tables", "id", dict(twhere, dt_deleted=("!=", None)))
            if dels: result.setdefault("__deleted__", {})["tables"] = util.unwrap(dels)

        self.finalize()
        return result, error, status


    def request(self, data):
        """
        Issues a request: e.g. joining a game.
        """
        result, error, status = None, None, httplib.OK

        table = self.table(id=data["fk_table"])

        if not table:
            error, status = "Not found", httplib.NOT_FOUND
        else:
            table, template, players, table_users = self.populate(
                template=True, players=True, table_users=True
            )
            if not any(x["fk_user"] == self._userid for x in table_users):
                error, status = "Forbidden", httplib.FORBIDDEN
            elif util.get(table, "opts", "join") is False:
                error, status = "Forbidden", httplib.FORBIDDEN

        if not error:
            with MUTEX[table["id"]]:
                request = {"fk_user": self._userid, "fk_table": table["id"],
                           "type": data["type"]}
                if self._tx.fetchone("requests", "1", where=request,
                                     status=("IN", ["new", "pending"])):
                    error = "" # Duplicate request: ignore

                if error is None and "join" == data["type"]:
                    userplayers = [x for x in players if x["fk_user"]]

                    if any(x["fk_user"] == self._userid for x in players):
                        error = "Already joined"
                    elif table["status"] not in ("new", "ended", "complete") \
                    and len(userplayers) == len(players):
                        error, status = "Cannot join game in progress", httplib.CONFLICT
                    elif not in_range(len(userplayers) + 1, util.get(template, "opts", "players"), lower=False):
                        error, status = "Table full", httplib.CONFLICT

                if error is None:
                    result = self._tx.fetchone("requests", id=self._tx.insert("requests", request))
                    self._tx.commit()
                    logger.info("User '%s' requested to %s on table #%s.",
                                self._user["username"], request["type"], table["id"])

        self.finalize()
        return result, error, status


    def request_response(self, requestid, data):
        """
        Responds to request, e.g. joining a game.
        """
        result, error, status = None, None, httplib.OK

        table = self.table(id=data["fk_table"])
        if not table:
            error, status = "Not found", httplib.NOT_FOUND

        with MUTEX[table["id"]]:
            request = self._tx.fetchone("requests", id=requestid)

            if not error and not request:
                error, status = "Not found", httplib.NOT_FOUND
            elif not error and request["status"] not in ("new", "pending") \
            and util.get(request, "opts", "processed", self._userid):
                error, status = "Request already processed", httplib.CONFLICT
            elif not error:
                table, template, players, table_users = self.populate(
                    template=True, players=True, table_users=True
                )
                if not any(x["fk_user"] == self._userid for x in table_users):
                    error, status = "Forbidden", httplib.FORBIDDEN

            rchanges = {}
            if not error and "join" == request["type"]:
                rchanges["opts"] = copy.deepcopy(request["opts"])
                rchanges["opts"].setdefault("processed", {}).setdefault(self._userid, True)

                userplayers = [x for x in players if x["fk_user"]]

                if self._userid == request["fk_user"]:
                    pass
                elif not request["public"] and self._userid != table["fk_host"]:
                    error, status = "Forbidden", httplib.FORBIDDEN
                elif data["status"] not in ("accepted", "rejected"):
                    error, status = "Unknown action", httplib.BAD_REQUEST
                elif table["status"] not in ("new", "ended", "complete") \
                and len(userplayers) == len(players):
                    error, status = "Cannot join game in progress", httplib.CONFLICT
                    rchanges.update(status="rejected")
                elif not in_range(len(userplayers) + 1, util.get(template, "opts", "players"), lower=False):
                    error, status = "Table full", httplib.CONFLICT
                    rchanges.update(status="rejected")
                elif any(x["fk_user"] == request["fk_user"] for x in players):
                    rchanges.update(status="accepted") # Sanity check
                elif "accepted" == data["status"]:
                    if len(userplayers) < len(players):
                        # Have free spot
                        player = next(x for x in players if not x["fk_user"])
                        self._tx.update("players", {"fk_user": request["fk_user"]}, id=player["id"])
                    else:
                        self._tx.insert("players", sequence=len(players),
                                        fk_table=table["id"], fk_user=request["fk_user"])
                        self._tx.update("tables", {"players": len(players) + 1},
                                        id=table["id"])
                    user1 = self._tx.fetchone("users", id=request["fk_user"])
                    user2 = self._tx.fetchone("users", id=self._userid)
                    logger.info("Host '%s' accepted user '%s' request to %s on table #%s.",
                                user2["username"], user1["username"], request["type"], table["id"])

                    rchanges.update(status="accepted")
                elif "rejected" == data["status"]:
                    rchanges.update(status="rejected")

            if rchanges:
                self._tx.update("requests", rchanges, id=request["id"])
                self._tx.commit()
                result = self._tx.fetchone("requests", id=request["id"])

        self.finalize()
        return result, error, status


    def action(self, data):
        """
        Performs specific game actions.

        @param   data  {action: str, fk_table, data: {}}
        @return        ({datatype: [..] or {..}} or None, error, statuscode)
        """
        result, error, status = None, None, httplib.OK

        HANDLERS = {"start": self.start, "end":    self.end,    "look": self.look,
                    "bid":   self.bid,   "move":   self.move,   "distribute": self.distribute,
                    "sell":  self.sell,  "redeal": self.redeal, "reset": self.reset}

        if data["action"] not in HANDLERS:
            error, status = "Unknown action", httplib.BAD_REQUEST
        else:
            tableid = data.pop("fk_table")
            table = self.table(id=tableid)
            if not table:
                error, status = "Not found", httplib.NOT_FOUND
            else:
                table, table_users = self.populate(table_users=True)

            if not error and not any(x["fk_user"] == self._userid for x in table_users):
                error, status = "Forbidden", httplib.FORBIDDEN
            elif not error:
                try:
                    with MUTEX[table["id"]]:
                        error, status = HANDLERS[data["action"]](data)
                except Exception:
                    logger.exception("Error handling user '%s' action '%s' for table #%s%s.",
                                     self._user["username"], data["action"], tableid,
                                     " (args %s)" % data if data else "")
                    error, status = "Unexpected error", httplib.INTERNAL_SERVER_ERROR

            if error:
                self._tx.rollback()
            else:
                self._tx.insert("log", action=data.pop("action"),
                          data=data, fk_user=self._userid)
                self._tx.commit()
        result = self.adapt_data(result)

        self.finalize()
        return result, error, status


    def start(self, data=None):
        """

        @return        (error, statuscode)
        """
        error, status = None, httplib.OK

        table, template, players, player = self.populate(template=True, players=True, player=True)

        if self._userid != table["fk_host"]:
            error, status = "Forbidden", httplib.FORBIDDEN
        elif table["status"] not in ("new", "ended", "complete"):
            error, status = "Game underway", httplib.CONFLICT
        elif util.get(template, "opts", "players") \
        and not in_range(len(players), template["opts"]["players"]):
            error, status = "Not enough players", httplib.BAD_REQUEST
        else:
            deck = make_deck(template)
            dist = distribute_deck(template, players, deck)
            logger.info("User '%s' started new game of %s on table #%s",
                        self._user["username"], template["name"], table["id"])

            gamestatus = "bidding" if "bidding" in template["opts"] else "ongoing"
            game = {"deck": deck, "sequence": table["games"] + 1,
                    "series": table["series"],
                    "status": gamestatus, "fk_table": table["id"],
                    "hands": {k: v for k, v in dist.items() if k != "talon"}}
            if "talon" in dist: game["talon"] = game["talon0"] = dist["talon"]

            expecteds = {} # {fk_player: {..}}

            # Set starting player, next from previous game's starting player
            game0 = self._tx.fetchone("games", fk_table=table["id"],
                                      sequence=table["games"], series=table["series"])

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
                    if game0["bids"]: # Next from previous game's first bidder
                        player0id = game0["bids"][0]["fk_player"]
                    elif game0["tricks"]: # Next from previous game's first mover
                        player0id = game0["tricks"][0][0]["fk_player"]
                    if player0id:
                        player0 = next(x for x in players if x["id"] == player0id)

                game["fk_player"] = players[(players.index(player0) + 1) % len(players)]["id"]

            game["id"] = self._tx.insert("games", game)

            for p in players:
                pchanges = {"tricks": [], "moves": [], "fk_game": game["id"]}
                pchanges["hand"] = pchanges["hand0"] = dist[p["id"]]
                if util.get(template, "opts", "bidding", "blind"):
                    pchanges["status"] = "blind"

                if p["id"] == game.get("fk_player"):
                    pchanges["expected"] = get_expected_move(template, game, p)
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
        elif table["status"] in ("new", "ended", "complete"):
            error, status = "Game not underway", httplib.CONFLICT
        else:
            gchanges = {"status": "ended", "fk_player": None}
            tchanges = {"status": "ended"}
            self._tx.update("games",  gchanges, id=game["id"])
            self._tx.update("tables", tchanges, id=table["id"])
            for p in players: self._tx.update("players", {"status": ""}, id=p["id"])

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
            gchanges = {}
            tchanges = {"status": "new", "games": 0, "bids": [], "scores": []}

            if game:
                tchanges["series"] = table["series"] + 1
                if "ended" != game["status"]: gchanges["status"] = "ended"
            if table["scores"]:
                tchanges["scores_history"] = table["scores_history"] + [table["scores"]]
            if table["bids"]:
                tchanges["bids_history"]   = table["bids_history"]   + [table["bids"]]

            self._tx.update("tables", tchanges, id=table["id"])
            if gchanges: self._tx.update("games", gchanges, id=game["id"])
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
            bid = {k: v for k, v in data["data"].items()
                   if k in ("number", "pass", "suite", "blind")}
            do_pass = data["data"].get("pass")
            can_pass    = util.get(template, "opts", "bidding", "pass")
            pass_final  = util.get(template, "opts", "bidding", "pass_final")
            needs_suite = util.get(template, "opts", "bidding", "suite")

            if do_pass and not can_pass:
                error, status = "Cannot pass", httplib.BAD_REQUEST
            elif not do_pass and (not isinstance(bid.get("number"), (int, long)) \
            or not do_pass and needs_suite \
            and bid.get("suite") not in template["opts"]["bidding"]["suite"]):
                error, status = "Bid missing data", httplib.BAD_REQUEST

            elif not do_pass and bid_beyond_limit(template, game, player, bid, "min"):
                error, status = "Bid too small", httplib.BAD_REQUEST
            elif not do_pass and bid_beyond_limit(template, game, player, bid, "max"):
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
                    if bid0.get("sell") and game["opts"].get("sell"):
                        break # for bid0

            if len(lastbids) == len(players) \
            and all(x.get("pass") for x in lastbids.values()):
                # All players have passed without a single bid: game over.
                gchanges.update(fk_player=None, status="ended",
                                opts={k: v for k, v in game["opts"].items() if k != "sell"})
                tchanges.update(status="ended")
                for p in players:
                    self._tx.update("players", {"status": "", "expected": {}}, id=p["id"])
                    

            elif len(lastbids) == len(players) \
            and len([x for x in lastbids.values() if x.get("pass")]) == len(players) - 1:
                # All players except one have passed: bidding complete.

                for p in players: # Clear blind status from all
                    self._tx.update("players", {"status": "", "expected": {}}, id=p["id"])

                gchanges["bid"] = next(x for x in gchanges["bids"][::-1] if not x.get("pass"))
                gchanges["opts"] = {k: v for k, v in game["opts"].items() if k != "sell"}

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
                if pass_final and not game["opts"].get("sell"):
                    player2 = players[(players.index(player) + 1) % len(players)]
                    while player2["id"] in lastbids and lastbids[player2["id"]].get("pass"):
                        player2 = players[(players.index(player2) + 1) % len(players)]
                    gchanges["fk_player"] = player2["id"]
                else:
                    gchanges["fk_player"] = players[(players.index(player) + 1) % len(players)]["id"]

            self._tx.update("games", gchanges, id=game["id"])
            if tchanges: self._tx.update("tables",  tchanges, id=table["id"])

        return error, status


    def sell(self, data=None):
        """Carries out game sell action."""
        error, status = None, httplib.OK

        table, template, game, players, player = self.populate(
            template=True, game=True, players=True, player=True
        )

        if "distributing" != game["status"]:
            error, status = "Not in distributing phase", httplib.CONFLICT
        elif game["fk_player"] != player["id"]:
            error, status = "Not player's turn", httplib.FORBIDDEN
        elif not util.get(template, "opts", "bidding", "sell"):
            error, status = "Unknown action", httplib.BAD_REQUEST
        elif any(x.get("sell") for x in game["bids"]):
            error, status = "Forbidden", httplib.FORBIDDEN
        else:
            bid = {k: v for k, v in dict(game["bid"], sell=True).items() if k != "blind"}
            pchanges = {"expected": {}, "hand": player["hand0"], "status": ""}
            gchanges = {"talon": game["talon0"], "status": "bidding", "bid": {},
                        "fk_player": players[(players.index(player) + 1) % len(players)]["id"],
                        "bids": game["bids"] + [bid], "opts": dict(game["opts"], sell=True)}

            self._tx.update("players", pchanges, id=player["id"])
            self._tx.update("games",   gchanges, id=game["id"])

        return error, status


    def redeal(self, data=None):
        """Carries out game redeal action."""
        error, status = None, httplib.OK

        table, template, game, players, player = self.populate(
            template=True, game=True, players=True, player=True
        )
        copts = util.get(template, "opts", "redeal", "condition")

        if "bidding" != game["status"]:
            error, status = "Not in bidding phase", httplib.CONFLICT
        elif game["fk_player"] != player["id"]:
            error, status = "Not player's turn", httplib.FORBIDDEN
        elif not util.get(template, "opts", "redeal"):
            error, status = "Unknown action", httplib.BAD_REQUEST
        elif any(x.get("fk_player") == player["id"] for x in game["bids"]):
            error, status = "Forbidden", httplib.FORBIDDEN
        elif len(set(copts.get("hand", [])) & set(player["hand"])) < copts.get("min", sys.maxint):
            error, status = "Forbidden", httplib.FORBIDDEN

        else:
            pchanges = {"expected": {}, "status": ""}
            gchanges = {"status": "ended", "fk_player": None,
                        "bids": game["bids"] + [{"fk_player": player["id"], "redeal": True}],
                        "opts": dict(game["opts"], redeal=True)}

            for p in players: self._tx.update("players", pchanges, id=p["id"])
            self._tx.update("games",  gchanges, id=game["id"])
            self._tx.update("tables", {"status": "ended"}, id=table["id"])

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

            game0 = self._tx.fetchone("games", fk_table=table["id"],
                                      sequence=table["games"] - 1, series=table["series"])
            ranking = {int(k): v for k, v in game0["score"].items()}
            playersx = sorted([x for x in players if x["id"] in ranking],
                              key=lambda x: ranking[x["id"]])
            if ranking[player["id"]] > len(playersx) / 2:
                # The lower half of ranking needs to give top cards
                phand = drop(player["hand"], allgiven)
                if cmp_cards(template, phand[0], allgiven[-1]) > 0:
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
                        player2 = playersx[util.get(template, "opts", "lead", "0", "ranking")]
                        gchanges["fk_player"] = player2["id"]
                    else:
                        player0id = game0["tricks"][0][0]["fk_player"]
                        player0 = next(x for x in players if x["id"] == player0id)
                        player2 = next_player_in_game(template, game, players, player0)
                        gchanges["fk_player"] = player2["id"]

                    gchanges["status"] = "ongoing"
                    pchanges2 = {"expected": get_expected_move(template, dict(game, **gchanges), player)}
                    self._tx.update("players", pchanges2, id=gchanges["fk_player"])

                self._tx.update("games", gchanges, id=game["id"])


            else:
                # Single player making distributing move
                gchanges = {"status": "ongoing"}
                pchanges = {"expected": {}}

                for fk_player, cards in dist.items():
                    player2 = next(x for x in players if x["id"] == fk_player)
                    pchanges2 = {"hand": sort(template, player2["hand"] + cards)}
                    self._tx.update("players", pchanges2, id=fk_player)

                pchanges["expected"] = get_expected_move(template, dict(game, **gchanges), player)
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
            do_special = next((x for x in util.get(template, "opts", "move", "special") or {}
                               if x != "trump" and data["data"].get(x)), None)

            if do_pass and not game["trick"]:
                error, status = "Cannot pass", httplib.BAD_REQUEST
            elif do_pass and not util.get(template, "opts", "move", "pass"):
                error, status = "Cannot pass", httplib.BAD_REQUEST
            elif do_crawl and util.get(template, "opts", "move", "crawl") is None:
                error, status = "Cannot crawl", httplib.BAD_REQUEST
            elif not cards and not do_pass:
                error, status = "Not the right amount of cards", httplib.BAD_REQUEST
            elif len(drop(player["hand"], cards)) > len(player["hand"]) - len(cards):
                error, status = "No such cards", httplib.BAD_REQUEST
            elif not has_move_right_amount(template, player, cards):
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
            elif do_trump and util.get(template, "opts", "move", "special", "trump", "condition", "cards") \
            and len(player["hand"]) < util.get(template, "opts", "move", "special", "trump", "condition", "cards"):
                error, status = "Cannot make trump: not enough cards", httplib.FORBIDDEN
            elif do_trump and not any(len(set(player["hand"]) & set(cc)) == len(cc)
                                      for cc in util.get(template, "opts", "move", "special", "trump", "*")):
                error, status = "No cards to make trump", httplib.FORBIDDEN
            elif do_trump and not (set(cards) & set(
                c for cc in util.get(template, "opts", "move", "special", "trump", "*")
                if len(set(player["hand"]) & set(cc)) == len(cc) for c in cc
            )):
                error, status = "Not trump card", httplib.FORBIDDEN

            elif do_special and util.get(template, "opts", "move", "special", do_special) is None:
                error, status = "Cannot make {0}".format(do_special), httplib.BAD_REQUEST
            elif do_special and util.get(template, "opts", "move", "special", do_special, len(game["tricks"])) == False:
                error, status = "Cannot make {0} this round".format(do_special), httplib.BAD_REQUEST
            elif do_special and not any(len(set(player["hand"]) & set(cc)) == len(cc)
                                      for cc in util.get(template, "opts", "move", "special", do_special, "*")):
                error, status = "No cards to make {0}".format(do_special), httplib.FORBIDDEN
            elif do_special and not (set(cards) & set(
                c for cc in util.get(template, "opts", "move", "special", do_special, "*")
                if len(set(player["hand"]) & set(cc)) == len(cc) for c in cc
            )):
                error, status = "Not {0} card".format(do_special), httplib.FORBIDDEN
            elif do_special and util.get(template, "opts", "move", "special", do_special, "condition") is not None \
            and not util.get(game, "opts", util.get(template, "opts", "move", "special", do_special, "condition", "opt")):
                error, status = "Not meeting {0} condition: {1}".format(do_special, util.get(template, "opts", "move", "special", do_special, "condition", "opt")), httplib.FORBIDDEN
            elif do_special and util.get(template, "opts", "move", "special", do_special, "condition", "suite") \
            and util.get(game, "opts", util.get(template, "opts", "move", "special", do_special, "condition", "opt")) != suite(cards[0]):
                error, status = "Not meeting {0} condition: {1}".format(do_special, util.get(template, "opts", "move", "special", do_special, "condition", "opt")), httplib.FORBIDDEN


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
            player2, player3, gchanges, tchanges, pchanges2, pchanges3 = None, None, {}, {}, {}, {}

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

                gchanges["discards"] = copy.deepcopy(game["discards"]) + [gchanges["trick"]]
                gchanges["tricks"] = copy.deepcopy(game["tricks"]) + [gchanges["trick"]]
                gchanges["trick"] = []

                if not game_over and "trick" == util.get(template["opts"], "lead", "*"):
                    player3 = player2
                    if not player3["hand"]:
                        player3 = next_player_in_game(template, dict(game, **gchanges), players, player2)
                        pchanges3["expected"] = get_expected_move(template, game, player3)
                        gchanges["fk_player"] = player3["id"]
                    else:
                        pchanges2["expected"] = get_expected_move(template, game, player2)
                        gchanges["fk_player"] = player2["id"]

                if util.get(template, "opts", "trick"):
                    pchanges2["tricks"] = copy.deepcopy(player2["tricks"]) + [gchanges["trick"]]
            else:
                player2 = next_player_in_round(template, dict(game, **gchanges), players, player)
                gchanges["fk_player"] = player2["id"]
                pchanges2["expected"] = get_expected_move(template, dict(game, **gchanges), player2)

            self._tx.update("games",   gchanges, id=game["id"])
            self._tx.update("players", pchanges, id=player["id"])
            if pchanges2: self._tx.update("players", pchanges2, id=player2["id"])
            if pchanges3: self._tx.update("players", pchanges3, id=player3["id"])
            if tchanges:  self._tx.update("tables",  tchanges,  id=table["id"])
            table, template, game, players, player = self.populate(
                template=True, game=True, players=True, player=True, refresh=True
            )

            if game_over:
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
                for p in players:
                    self._tx.update("players", {"dt_changed": util.utcnow()}, id=p["id"])

        return error, status


    def populate(self, template=False, game=False, players=False, player=False,
                 table_users=False, users=False, refresh=False):
        """
        Populates instance data structures and returns (table, ..all requested..).
        """
        result = [self._table]

        if template and (refresh or not self._template):
            self._template = self._tx.fetchone("templates", id=self._table["fk_template"])
        if game and (refresh or not self._game):
            self._game = self._tx.fetchone("games", fk_table=self._table["id"],
                                           sequence=self._table["games"], series=self._table["series"])
        if (players or player) and (refresh or self._players is None):
            self._players = self._tx.fetchall("players", fk_table=self._table["id"], dt_deleted=None, order="sequence")
        if player and (refresh or not self._player):
            self._player = next((x for x in self._players if x["fk_user"] == self._userid), None)
        if table_users and (refresh or not self._table_users):
            self._table_users = self._tx.fetchall("table_users", fk_table=self._table["id"], dt_deleted=None)
        if users and (refresh or not self._users):
            where = {"EXPR": ("id IN (SELECT fk_user FROM table_users "
                     "WHERE fk_table = ? AND dt_deleted IS NULL)", [self._table["id"]])}
            self._users = self._tx.fetchall("users", where=where)

        if template:    result.append(self._template)
        if game:        result.append(self._game)
        if players:     result.append(self._players)
        if player:      result.append(self._player)
        if table_users: result.append(self._table_users)
        if users:       result.append(self._users)

        return result


    def adapt_data(self, data):
        """
        Returns player and game card structures replaced with blanks
        if user not in state to see cards.
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
        Returns card structures in value replaced with blanks
        if user not in state to see cards.
        """
        result, faceup = value, None
        hider = lambda v: (v and " ") if len(v) < 3 else v

        _, template, game = self.populate(template=True, game=True)
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

        if faceup is None and field in ("hand", "hand0") and is_player and game \
        and game["status"] == "bidding" and player["status"] == "blind":
            # Game supports blind bidding, player has not looked at own cards yet
            faceup = False

        if faceup is None and field in ("talon", "talon0") \
        and game and game["opts"].get("sell"):
            # Reveal talon if selling talon
            faceup = True

        if faceup is None and field == "trick":
            # Game ongoing trick visible, if not crawl
            faceup = True

        if faceup is None and field in ("hand", "hand0") \
        and is_player and self._userid == player["fk_user"]:
            # Reveal player's own hand to player, if not blind
            faceup = True

        if faceup is None and field == "moves":
            # Moves are always hidden by default
            faceup = False

        if faceup is None and field == "discards":
            # Render only last discard visible during game
            if game and game["status"] != "ended":
                result = util.recursive_decode(value[:-1], [hider]) + value[-1:]
            faceup = True

        if faceup is None and field == "tricks" and game and game["status"] == "ended":
            # Render tricks visible after game
            faceup = True

        if faceup is None and game and game["status"] == "ended":
            # Reveal everything at game end
            faceup = util.get(template["opts"], "reveal")

        if faceup is None and field == "tricks":
            # Render only last trick visible during game
            result = util.recursive_decode(value[:-1], [hider]) + value[-1:]
            faceup = True

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
    if util.get(template, "opts", "bidding", "talon"):
        result["talon"] = sort(template, result["talon"])

    return result


def sort(template, cards):
    """Returns cards sorted according to template options."""
    return sorted(cards, cmp=lambda a, b: -cmp_cards(template, a, b, True))


def cmp_cards(template, a, b, sort=False):
    """
    Returns whether card a is weaker, equal or stronger than b (-1, 0, 1).
    If sort, returns cards of equal level in fixed suite order.
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

    if sort and not result and suites:
        result = suites.index(suite(a)) - suites.index(suite(b))

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
                if move.get("trump") and util.get(popts, "special", "trump"):
                    score += popts["special"]["trump"][suite(move["cards"][0])]
                for x in set(popts.get("special", {})) & set(move):
                    if "trump" != x and move.get(x): score += popts["special"][x]

        if player["id"] == game["bid"].get("fk_player") \
        and game["bid"].get("number"):
            op = None
            if score < game["bid"]["number"]:
                # Apply penalty for not fulfilling bid
                if util.get(popts, "penalties", "blind") \
                and game["bid"].get("blind"):
                    op = util.get(popts, "penalties", "blind")
                else: 
                    op = util.get(popts, "penalties", "bid")
            else:
                # Bidder only wins as much as they bid
                score = game["bid"]["number"]
                if util.get(popts, "bonuses", "blind") \
                and game["bid"].get("blind"):
                    op = util.get(popts, "bonuses", "blind")

            if op: score = apply_op(game["bid"]["number"], op)

        if player["id"] != game["bid"].get("fk_player") \
        and popts.get("bidonly", "min") is not None:
            # Player at stage where they can only get points from bidding
            score0 = util.get(table, "scores", -1, str(player["id"])) or 0
            if score0 >= popts["bidonly"]["min"]: score = 0

        result[player["id"]] = score

    return result


def table_points(template, table, lastscores):
    """Returns new scores for table, as [[{playerid1: xx, ..}, ], ]."""
    result = copy.deepcopy(table["scores"]) + [{}]
    copts = util.get(template, "opts", "points", "penalties", "nochange")
    prevscores = util.get(table, "scores", -1) or {}

    for playerid, score in lastscores.items():
        playerid = int(playerid)
        if not score and copts and copts.get("times"):
            allscores = [x.get(playerid, x.get(str(playerid))) for x in table["scores"]]
            allscores = [x for x in allscores if x is not None]
            allscores += allscores[-1:] # No point change -> prev score repeats
            if len(allscores) >= copts["times"] \
            and len(set(allscores[-copts["times"] - 1:])) == 1:
                score = apply_op(score, copts)        

        score0 = prevscores.get(playerid, prevscores.get(str(playerid))) or 0
        result[-1][playerid] = score0 + score
    return result


def game_ranking(template, game, players):
    """Returns ranking scores for game, in order of emptying hand."""
    result = {}
    ropts = util.get(template, "opts", "ranking")

    if ropts.get("finish"):
        ranking = {}

        for i, moves in enumerate(game["moves"]):
            for j, move in enumerate(moves):
                if move.get("pass"): continue # for move
                ranking[move["fk_player"]] = i * len(template["opts"]["cards"]) + j

        for player in players:
            if player["hand"]: ranking[player["id"]] = sys.maxint

        for i, playerid in enumerate(sorted(ranking, key=lambda x: ranking[x])):
            result[playerid] = i + 1

    return result


def bid_beyond_limit(template, game, player, bid, side):
    """Returns whether player bid is over or under allowed maximum or minimum."""
    result = False
    limit = util.get(template, "opts", "bidding", side)
    if isinstance(limit, dict):
        if "blind" in limit and bid.get("blind"):
            limit = limit.get("blind")
        elif "trump" in limit and util.get(template, "opts", "trump") \
        and (any(x.get("sell") for x in game["bids"])
        or any(len(set(player["hand"]) & set(cc)) == len(cc)
                for cc in util.get(template, "opts", "move", "special", "trump", "*"))):
            limit = limit.get("trump")
        else: limit = limit.get("*")

    if limit is not None:
        result = bid["number"] > limit if "max" == side else \
                 bid["number"] < limit if "min" == side else result
    return result


def is_game_complete(template, table):
    """Returns whether table has reached total game completion (e.g. max score)."""
    result = False
    copts = util.get(template, "opts", "complete") or {}

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
    return lastlevels and levelcounts[lastlevels[0]] == len(lastlevels) 


def next_player_in_round(template, game, players, player):
    """Returns the next player in trick."""
    result, count = None, 0
    while not result and count < len(players):
        result = players[(players.index(player) + 1) % len(players)]
        if not result["hand"] \
        or any(x.get("pass") for x in game["trick"] if x["fk_player"] == result["id"]):
            result, player = None, result
        count += 1
    return result


def next_player_in_game(template, game, players, player):
    """Returns the next player in game, one after this player who still has cards."""
    result, count = None, 0
    while not result and count < len(players):
        result = players[(players.index(player) + 1) % len(players)]
        if not result["hand"]:
            result, player = None, result
        count += 1
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


def in_range(value, rng, lower=True, upper=True):
    """
    Returns whether value is in range if rng is array,
    else smaller or equal if rng is scalar.
    Returns true if rng is null.
    """
    if rng is None or not lower and not upper: return True
    rng = [1, rng] if isinstance(rng, (int, long)) else rng
    return (not lower or rng[0] <= value) and (not upper or value <= rng[1])


def has_move_right_amount(template, player, cards):
    """Returns whether player moved the right amount of cards."""
    result = True

    count_needed = 0
    if isinstance(util.get(template, "opts", "move", "cards"), (int, long)):
        count_needed = util.get(template, "opts", "move", "cards")

    if count_needed: result = len(cards) == count_needed
    return result


def get_expected_move(template, game, player):
    """Returns player's next expected move, depending on game phase."""
    result = {}

    if "bidding" == game["status"]:
        if util.get(template, "opts", "bidding"):
            result["bid"] = True

    elif "ongoing" == game["status"]:
        result["move"] = True
        if util.get(template, "opts", "move", "cards"):
            result["cards"] = util.get(template, "opts", "move", "cards")

    return result



if "__main__" == __name__:
    def test():
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
        model.init()
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
    test()
