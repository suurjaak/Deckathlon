/**
 * Application components.
 * Requires Vue.js, data.js, util.js.
 *
 * @author    Erki Suurjaak
 * @created   18.04.2020
 * @modified  03.05.2020
 */


var AppActions = PubSub.topic([
  "dialog",         // Show modal dialog        (text, {close: onCloseDialog(clickedOk), cancel: true if cancel-button})
  "title",          // Sets main title          (title)
]);


/* Make globals like Data available in Vue templates. */
Vue.use({
  install: function() {
    Object.defineProperty(Vue.prototype, "Cardery", { get: function() { return Cardery; }, });
    Object.defineProperty(Vue.prototype, "Data",    { get: function() { return Data; }, });
    Object.defineProperty(Vue.prototype, "Util",    { get: function() { return Util; }, });
  },
});



/**
 * Login component.
 *
 * State: {username, password, ongoing, msg, msgclass}
 */
var TEMPLATE_LOGIN = `

  <div class="template_login">

    <h1>{{ _("Deckathlon") }}</h1>

    <span v-if="msg" v-bind:class="'msg ' + msgclass + (ongoing ? ' loading' : '')">
      {{ msg }}<br />
    </span>

    <form v-on:submit.prevent>
        <input type="text"     name="username" v-bind:disabled="ongoing"  v-bind:placeholder=" _('Username') " v-model="username" autofocus />
        <input type="password" name="password" v-bind:disabled="ongoing"  v-bind:placeholder=" _('Password') " v-model="password" />

        <button v-if="!register" class="login" v-bind:disabled="ongoing" v-on:click="onLogin">{{ _("Login") }}</button>
        <button v-if="!register" class="login" v-bind:disabled="ongoing" v-on:click="onTo(true)">{{ _("Register") }}</button>
        <button v-if="register"  class="login" v-bind:disabled="ongoing" v-on:click="onRegister">{{ _("Register") }}</button>
        <button v-if="register"  class="login" v-bind:disabled="ongoing" v-on:click="onTo(false)">{{ _("Back to login") }}</button>
    </form>

  </div>

`;

Vue.component("login", {
  template: TEMPLATE_LOGIN,

  data: function() {
    return {
      msg:      "",
      msgclass: "",
      username: "",
      password: "",
      register: false,
      ongoing:  false,
    };
  },

  methods: {

    onLogin: function() {
      var self = this;
      var data = {username: self.username.trim(),
                  password: self.password.trim()};
      if (!data.username || !data.password) return;

      Util.ajax({
        url: Data.db.settings.get("dataURL") + "login", data: data,
      }).success(function(text) {
        self.msg = _("Login successful, loading application...");
        document.location.reload();
      }).error(function(req) {
        self.ongoing = false;
        self.msgclass = "error";
        self.msg = _(401 == req.status ?
                     "Invalid username or password." :
                     "Error contacting login server.");
      }).complete(function() {
        self.$forceUpdate();
      });
      self.ongoing = true;
      self.msgclass = "";
      self.msg = _("Logging in...");
    },

    onRegister: function() {
      var self = this;
      var data = {username: self.username.trim(),
                  password: self.password.trim()};
      if (!data.username || !data.password) return;

      DataActions.save("users", data, function() {
        self.msg = _("Registration successful, loading application...");
        document.location.reload();
      }, function(error, req) {
        self.ongoing = false;
        self.msgclass = "error";
        self.msg = _(error || "Error registering account.");
      });
      self.ongoing = true;
      self.msgclass = "";
      self.msg = _("Registering...");
    },

    onTo: function(register) {
      var self = this;
      self.register = register;
      self.msgclass = "";
      self.msg = "";
    },

  },

});



/**
 * Index component, shows tables list.
 *
 * State: {tables}
 */
var TEMPLATE_INDEX = `

  <div class="template_index">

    <h1>{{ _("Deckathlon") }}</h1>

    <table v-if="!Util.isEmpty(tables)" class="tables">
      <thead>
        <tr>
          <th>{{ _("Table") }}</th>
          <th>{{ _("Game") }}</th>
          <th>{{ _("Host") }}</th>
          <th>{{ _("Players") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in tables" v-bind:key="item.id">
          <td><a v-bind:href="Data.db.settings.get('rootURL') + 'table/' + item.shortid">{{ item.name }}</a></td>
          <td>{{ Data.db.templates.rw.get(item.fk_template).name }}</td>
          <td>{{ Data.db.users.rw.get(item.fk_host).username }}</td>
          <td>{{ item.players }}</td>
        </tr>
      </tbody>
    </table>


    <div class="controls">
      <button v-on:click="onNew">{{ _("New game table") }}</button>

      <button v-on:click="onOpenPrivateTable">{{ _("Join private table") }}</button>

      <button v-on:click="onLogout">{{ _("Log out {0}").format(user && user.username) }}</button>
    </div>

    <appdialog>
      <table v-if="table_join" class="private">
        <tr>
          <td><label for="table_shortid">{{ _("Table short ID:") }}</label></td>
          <td><input type="text" v-model="table_shortid" id="table_shortid" /></td>
        </tr>
      </table>

      <table v-if="table_new" class="new">
        <tr>
          <td><label for="table_name">{{ _("Table name:") }}</label></td>
          <td><input type="text" v-model="table_name" id="table_name" /></td>
        </tr>
        <tr>
          <td><label for="table_template">{{ _("Game:") }}</label></td>
          <td>
            <select v-model="table_template" id="table_template">
              <option></option>
              <option v-for="item in templates" v-bind:key="item.id" v-bind:value="item.id">{{ item.name }}</option>
            </select>
          </td>
        </tr>
        <tr>
          <td><label for="template_public">{{ _("Public:") }}</label></td>
          <td><input type="checkbox" v-model="table_public" id="template_public" /></td>
        </tr>
      </table>
    </appdialog>

  </div>

`;

Vue.component("index", {
  template: TEMPLATE_INDEX,

  data: function() {
    return {
      tables:        Data.db.tables.list(),
      templates:     Data.db.templates.list(),
      table_join:       false, // Whether dialog is joining private table 
      table_shortid:    "",    // Shortid of private table to join
      table_new:        false, // Whether dialog is creating new table
      table_name:       "",    // Name for new table
      table_template:   null,  // Selected game template for new table
      table_public:     false, // Public-flag for new table
      user:             null,
      unsubscribes:     [],    // Data listener unsubscribers
    };
  },

  mounted: function() {
    var self = this;
    self.tables    = Data.db.tables.list();
    self.templates = Data.db.templates.list();
    self.user = Data.db.user.get();
    self.unsubscribes = [Data.db.user.listen(self.onData),
                         Data.db.tables.listen(self.onData),
                         Data.db.templates.listen(self.onData)];
    AppActions.title(_("Index"));
  },


  beforeDestroy: function() {
    var self = this;
    self.unsubscribes.forEach(function(f) { f(); });
  },


  methods: {

    onData: function(type) {
      var self = this;
      if ("user" == type) self.user = Data.db.user.get();
      else self[type] = Data.db[type].list();
    },

    /** Handler for logout, confirms choice. */
    onLogout: function() {
      AppActions.dialog(_("Log out?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        document.location.href = Data.db.settings.get("rootURL") + "logout";
      }});
    },

    onOpenTable: function(item) {
      document.location.href = Data.db.settings.get("rootURL") + "table/" + item.shortid;
    },

    onOpenPrivateTable: function() {
      var self = this;
      self.table_join = true;
      AppActions.dialog(_("Join table"), {cancel: true, onclose: this.onJoinPrivate});
    },

    onJoinPrivate: function(result) {
      var self = this;
      self.table_join = false;
      if (!result) return;

      var shortid = self.table_shortid.trim();
      if (shortid) self.onOpenTable({shortid: shortid});
    },

    onNew: function() {
      var self = this;
      self.table_new = true;
      AppActions.dialog(_("New game table"), {cancel: true, onclose: this.onCreateNew});
    },

    onCreateNew: function(result) {
      var self = this;
      self.table_new = false;
      if (!result) return;

      var data = {name: self.table_name.trim(), fk_template: self.table_template, public: self.table_public};
      if (!data.name || !data.fk_template) return self.onNew();

      DataActions.save("tables", data, function(items) {
        self.onOpenTable(items[0]);
      }, function(err, req) {
        console.log("Error creating table.", err, req);
        AppActions.dialog(_(err));
      });

    },

  },

});



/**
 * Table component, shows ongoing game table.
 *
 * State: {table, game, players, spectators, ..}
 */
var TEMPLATE_TABLE = `

  <div v-if="table" class="template_table">

    <h3>{{ _("Table: {0} (by {1}, playing {2})").format(table.name, usermap[table.fk_host].username, template.name) }}</h3>

    <div class="table">

      <div v-if="game" class="tabletop"
           v-on:dragover="'distributing' != game.status ? onDragCardTo(null, $event) : null"
           v-on:drop    ="'distributing' != game.status ? onDropCard(null, $event) : null">


        <div v-if="player && game.status == 'distributing' && game.fk_player == player.id" class="distribute">

          <div v-for="(item, i) in otherplayers" v-bind:class="'player pos' + (i+1) + 'of' + players.length">
            {{ getName(item) }}

            <div class="cards">
              <div v-for="i in Util.range(player.expected.distribute[item.id])"
                   v-bind:draggable="move[item.id] && move[item.id][i]"
                   v-on:dragstart  ="onDragCardStart(item.id, move[item.id] && move[item.id][i], $event)" 
                   v-on:drop       ="onDropCard(item.id, $event)"
                   v-on:dragover   ="onDragCardTo(item.id, $event)"
                   v-on:dblclick   ="onMoveCard(item.id, player.id, move[item.id] && move[item.id][i])"
                   v-html="Cardery.html(move[item.id] && move[item.id][i])"
                   class="card drop"></div>
            </div>
          </div>

          <button class="give" v-bind:disabled="!distributable" v-on:click="onDistribute">{{ _("Give") }}</button>

        </div>


        <div v-if="'bidding' == game.status && player" class="bidding">
          <span class="heading">{{ _("Bidding") }}</span>

          <div class="bids" id="bids">
            <table>
              <tr v-for="item in game.bids">
                <td>{{ getName(item) }}:</td>
                <td v-html="formatBid(item)"></td>
              </tr>
            </table>
          </div>


          <div v-if="player && player.id == game.fk_player" class="controls">

            <select v-if="Util.get(template, 'opts', 'bidding', 'suite')" v-model="move.suite" class="suite">
              <option v-for="suite in template.opts.suites" v-bind:key="suite" v-bind:value="suite" v-html="Cardery.html(suite, true)"></option>
            </select>

            <label v-if="blindable" class="blind">
              <input type="checkbox" v-model="move.blind" />
              {{ _("Blind") }}
            </label>

            <input type="number" v-model.number="move.number"
              v-bind:min="Util.get(template, 'opts', 'bidding', 'min')" 
              v-bind:max="Util.get(template, 'opts', 'bidding', 'max')" 
              v-bind:step="Util.get(template, 'opts', 'bidding', 'step')" />

            <button v-bind:disabled="!biddable" v-on:click="onBid(true, $event)">{{ _("Bid") }}</button>
            <button v-if="passable" v-on:click="onBid(false, $event)">{{ _("Pass") }}</button>

          </div>

        </div>


        <div v-if="!Util.isEmpty(game.talon)" class="talon">
          <div class="cards">
            <div v-for="card in game.talon" v-html="Cardery.html(card)" class="card"></div>
          </div>
        </div>


        <div v-if="'ongoing' == game.status" class="moves">

          <div class="trick" id="trick">
            <div v-for="move in game.trick">
              {{ getName(move) }}
              <span v-for="(value, key) in move" v-if="value && key != 'cards' && key != 'fk_player'">: {{ _(key) }}!</span>
              <div class="cards">
                <div v-for="card in move.cards" v-html="Cardery.html(card)" class="card"></div>
              </div>
            </div>
          </div>


          <div class="cards">
            <div v-for="card in move.cards"
                 v-bind:draggable="true"
                 v-on:dragstart  ="onDragCardStart(null, card, $event)" 
                 v-on:dblclick   ="onMoveCard(null, player.id, card)"
                 v-html="Cardery.html(card)"
                 class="card"></div>
          </div>


          <div v-if="game.fk_player == player.id" class="controls">
            <label v-if="crawlable" class="crawl" v-bind:title="_('Make facedown move')">
              <input v-if="Util.isEmpty(game.trick)" type="checkbox" v-model="move.crawl" />
              <input v-else type="checkbox" v-model="move.crawl" />
              {{ _("Crawl") }}
            </label>
            <label v-if="trumpable" class="trump" v-bind:title="_('Make trump')">
              <input type="checkbox" v-model="move.trump" />
              {{ _("Trump") }}
            </label>
            <button v-bind:disabled="!playable" v-on:click="onMove(true, $event)">{{ _("Play") }}</button>
            <button v-if="passable" v-on:click="onMove(false, $event)">{{ _("Pass") }}</button>
          </div>

        </div>


        <div v-if="'ended' != game.status && !Util.isEmpty(game.opts)" class="opts">
          <div v-if="game.opts.trump" class="trump">
            {{ _("Trump") }}: <div v-html="Cardery.html(game.opts.trump)"></div>
          </div>
        </div>

      </div>


      <div v-for="(item, i) in otherplayers" v-bind:class="'player pos' + (i+1) + 'of' + players.length">
        <div v-bind:class="'name' + (isTurn(item) ? ' turn' : '')">{{ usermap[item.fk_user].username }}</div>
        <div class="cards">
          <div v-for="card in item.hand" v-html="Cardery.html(card)" class="card"></div>
        </div>

        <div v-if="item.tricks.length" class="tricks">
          <div v-for="trick in item.tricks" v-html="Cardery.html(' ')"
               v-on:click="onShowLastTrick(item)" v-bind:title="_('Show last trick')"
               class="card"></div>
        </div>

        <button v-if="kickable" v-on:click="onKickPlayer(item)" class="kick">{{ _("Kick out") }}</button>
      </div>


      <div v-if="player" class="player me">
        <div v-bind:class="'name' + (isTurn(player) ? ' turn' : '')">{{ usermap[player.fk_user].username }}</div>
        <div class="cards">
          <div v-for="card in hand" v-html="Cardery.html(card)"
               v-bind:draggable="draggable(card)"
               v-on:dragstart  ="onDragCardStart(player.id, card, $event)"
               v-on:drop       ="onDropCard(player.id, $event)"
               v-on:dblclick   ="onMoveCard(player.id, null, card)"
               v-on:dragover   ="onDragCardTo(player.id, $event)"
               class="card"></div>
          <button v-if="blindable" v-on:click="onLookAtHand" class="look">{{ _("Look at cards") }}</button>
        </div>

        <div v-if="player.tricks.length" class="tricks">
          <div v-for="trick in player.tricks" v-html="Cardery.html(' ')"
               v-on:click="onShowLastTrick(player)" v-bind:title="_('Show last trick')"
               class="card"></div>
        </div>
      </div>


      <div v-if="!Util.isEmpty(table.scores)" class="scores" id="scores">

        <table>
          <thead>
            <tr>
              <th class="index">{{ _("#") }}</th>
              <th v-for="item in players">{{ usermap[item.fk_user].username }}</th>
              <th v-if="!Util.isEmpty(table.bids)" class="bid">{{ _("Bid") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in table.scores">
              <th class="index">{{ i + 1 }}</th>
              <td v-for="pitem in players">{{ i && (table.scores[i - 1][pitem.id] == item[pitem.id]) ? '—' : item[pitem.id] }}</td>
              <td v-if="!Util.isEmpty(table.bids)" class="bid">{{ formatBid(table.bids[i], true) }}</td>
            </tr>
            <tr v-if="'ended' != game.status && !Util.isEmpty(game.bid)">
              <td class="index">{{ table.bids.length + 1 }}</td>
              <td v-for="pitem in players"></td>
              <td class="bid">{{ formatBid(game.bid, true) }}</td>
            </tr>
          </tbody>
        </table>

      </div>



    </div>

    <div class="controls">

      <button v-if="joinable"   v-on:click="onJoinGame">  {{ _("Join game") }}    </button>
      <button v-if="startable"  v-on:click="onStartGame" v-bind:title="_('Start new game on table')"> {{ _("Start next") }} </button>
      <button v-if="endable"    v-on:click="onEndGame">   {{ _("End game") }}     </button>
      <button v-if="resettable" v-on:click="onResetTable">{{ _("Reset table") }}  </button>
      <button v-if="leavable"   v-on:click="onLeaveGame"> {{ _("Leave game") }}   </button>
      <button                   v-on:click="onGoToIndex"> {{ _("Back to index") }}</button>
      <button                   v-on:click="onLogout">    {{ _("Log out {0}").format(user && user.username) }}</button>

    </div>

    <appdialog></appdialog>

  </div>

`;

Vue.component("game_table", {
  template: TEMPLATE_TABLE,

  data: function() {
    return {
      table:        null, // Current game table
      player:       null, // User player
      game:         null, // Current game
      players:      [],   // Table players, [{players-row}, ]
      table_users:  [],   // All users at table, [{table_users-row}, ]
      template:     null, // templates-row for game
      usermap:      [],   // {id_user:   {users-row}, }
      playermap:    {},   // {id_player: {players-row}, }
      user:         null, // User account
      hand:         [],   // Current hand, with temporary local changes
      move:         {},   // Current move (or bid) being made
      drag:         {},   // Current dragging as {playerid, card}
      unsubscribe:  [],   // Data listener unsubscribers
    };
  },

  mounted: function() {
    var self = this;
    var user = Data.db.user.get();
    self.table        = Data.db.tables.next();
    self.player       = Data.db.players.next({fk_user: user.id});
    self.players      = Data.db.players.list();
    self.game         = Data.db.games.next(self.table ? {sequence: self.table.games} : null);
    self.user         = user;
    self.table_users  = Data.db.table_users.list();
    self.template     = Data.db.templates.next();
    self.usermap      = Data.db.users.get();
    self.playermap    = Data.db.players.get();
    self.hand         = self.player ? self.player.hand : [];

    self.unsubscribes = [Data.db.tables.listen(self.onData),
                         Data.db.players.listen(self.onData),
                         Data.db.games.listen(self.onData),
                         Data.db.table_users.listen(self.onData),
                         Data.db.templates.listen(self.onData),
                         Data.db.users.listen(self.onData)];
    AppActions.title(_("Table"));
    window.setTimeout(self.scrollToBottom, 500, "scores");
    window.setTimeout(self.scrollToBottom, 500, "trick");
    window.setTimeout(self.scrollToBottom, 500, "bid");
  },


  beforeDestroy: function() {
    var self = this;
    self.unsubscribes.forEach(function(f) { f(); });
  },


  /**

  @todo trick võiks mitte kohe eest ära kaduda.
  ehk, niikaua kuni Util.isEmpty(game.trick), näitab laual game.tricks[-1]


  kui uued playerid liitusid, siis userid juba lehel said errorit.

  ja kui mäng loodi, ei tekkinud kaardid enne refreshi.


  kui liiga palju kaarte, siis võiks neid mitte näidata järjest, sõidavad tabletoppi sisse.
  võib ehk kasutada seda flex-wrap asja.
  mm, aga seda siis ainult külgmiste puhul.
  njah, sõltuvalt laiusest ikka sõidab sisse.


  kui trick game, siis võiks panna kaardid suht fiks asukohtadesse.
  1of3 jne klassid.

  kui mitte-trick game, siis laduda järjest keskele.
  ja peale klikates näitab popupis kõiki.
  samas passi oleks hea näha.. njah, vbl ei tee nii.

  aga vbl teeks sellest tabeli, esimene tulp username, teine käik.



  */

  computed: {

    /** Returns whether game is joinable for current user. */
    joinable: function() {
      var self = this;
      var template = Data.db.templates.rw.get(self.table.fk_template);
      var max = Util.get(template, "opts", "players", 1);
      return !self.player && (self.players.length < max);
    },


    /** Returns whether game is leavable for current user. */
    leavable: function() {
      var self = this;
      return false; // @todo work on this

      return self.player && self.game && self.player.id != self.game.fk_host;
    },


    /** Returns whether game is startable (player is table owner and game in not-running status). */
    startable: function() {
      var self = this;
      return self.user.id == self.table.fk_host && ["new", "ended"].indexOf(self.table.status) >= 0;
    },


    /** Returns whether game is endable (player is table owner and game in running status. */
    endable: function() {
      var self = this;
      return self.user.id == self.table.fk_host && ["new", "ended", "complete"].indexOf(self.table.status) < 0;
    },


    /** Returns whether table is resettable (player is table owner and table has reached completion). */
    resettable: function() {
      var self = this;
      return self.user.id == self.table.fk_host && "complete" == self.table.status;
    },


    /** Returns whether current player can make blind bid. */
    blindable: function() {
      var self = this;
      return Util.get(self.template, "opts", "bidding", "blind") && "blind" == self.player.status;
    },


    /** Returns whether current cards distribution has all requirements filled. */
    distributable: function() {
      var self = this;
      var result = true;
      Util.objectMap(self.player.expected.distribute, function(playerid, count) {
        if (count > (self.move[playerid] ? self.move[playerid] : []).length) result = false;
      });
      return result;
    },


    /** Returns whether current game bid has all requirements filled. */
    biddable: function() {
      var self = this;
      return self.move.number && (!Util.get(self.template, "opts", "bidding", "suite") || self.move.suite);
    },


    /** Returns whether current game move has all requirements filled. */
    playable: function() {
      var self = this;
      var result = false;
      if (Util.isNumeric(self.player.expected.cards)
      && (self.move.cards || []).length == self.player.expected.cards) result = true;
      else result = Object.keys(self.move).length;
      return result;
    },


    /** Returns whether current game move is passable. */
    passable: function() {
      var self = this;
      var result = Util.get(self.template, "opts", "move", "pass");
      result = result && !Util.isEmpty(self.game["trick"]);
      return result;
    },


    /** Returns whether player can make a crawl move (face down). */
    crawlable: function() {
      var self = this;
      var result = false;
      if (!self.game.tricks.length && !self.game.trick.length) {
        result = (Util.get(self.template, "opts", "move", "crawl") === 0);
      };
      return result;
    },


    /** Returns whether player can make trump. */
    trumpable: function() {
      var self = this;
      var result = Util.get(self.template, "opts", "trump") && !self.game.trick.length;
      if (result) {
        result = (Util.get(self.template, "opts", "move", "special", "trump", self.game.tricks.length) !== false);
      };
      return result;
    },


    /** Returns whether current user can kick out other players. */
    kickable: function() {
      var self = this;
      return self.player && self.table && self.game
             && self.player.id == self.game.fk_host
             && ["new", "ended"].indexOf(self.table.status) >= 0;
    },


    /** Returns a list of other players, in order after current player. */
    otherplayers: function() {
      var self = this;
      if (!self.player) return null;
      var result = Data.db.players.filter(function(x) { return x.fk_user != self.user.id; });
      return result.sort(function(a, b) {
        var av = a.sequence + (a.sequence < self.player.sequence ? self.players.length * 2 : 0);
        var bv = b.sequence + (b.sequence < self.player.sequence ? self.players.length * 2 : 0);
        return av - bv;
      });
    },

  },


  methods: {


    /** Returns whether card is draggable. */
    draggable: function(card) {
      var self = this;
      var result = self.game && (["ongoing", "distributing"].indexOf(self.game.status) >= 0);
      return result && self.isTurn(self.player);
    },


    /** Returns whether it's player's turn. */
    isTurn: function(player) {
      var self = this;
      return self.game && player.id == self.game.fk_player;
    },


    /** Returns whether current player has cards in move not yet made. */
    hasCardsInMove: function() {
      var self = this;
      var result = !Util.isEmpty(self.move.cards);
      if (!result && self.game && "distributing" == self.game.status) {
        result = self.otherplayers.some(function(player) {
          return (Util.get(self.move, player.id) || []).length;
        });
      };
      return result;
    },


    /** Returns HTML element containing bid information. */
    formatBid: function(bid, doUser) {
      var self = this;
      if (!Object.keys(bid).length) return null;

      var result = "";
      if (doUser) {
        var user = self.usermap[self.playermap[bid.fk_player].fk_user];
        result += "{0}: ".format(user.username);
      };
      result += bid.pass ? _("pass") : (bid.number) || "";
      if (Util.get(self.template, "opts", "bidding", "suite") && bid.suite) {
        result += Cardery.html(bid.suite);
      };
      if (bid.blind) result += " " + _("blind");
      return result;
    },


    /** Returns username from {fk_player} or playerid. */
    getName: function(item) {
      var self = this;
      var result = "";
      var playerid = null, player = null, user = null;
      if (Util.isDict(item) && item.fk_player) playerid = item.fk_player;
      else if (Util.isDict(item) && item.id) playerid = item.id;
      else playerid = item;
      if (playerid) player = self.playermap[playerid];
      if (player)   user   = self.usermap[player.fk_user];
      if (user)     result = user.username;
      return result;
    },


    /** Scrolls the element to bottom. */
    scrollToBottom: function(id) {
      var self = this;
      var elem = document.getElementById(id);
      if (elem) elem.scrollTop = elem.scrollHeight;
    },


    /** Handler for data store update, refreshes local data. */
    onData: function(type) {
      var self = this;
      if ("tables" == type) self.table = Data.db.tables.next();

      if ("tables" == type || "games" == type) self.game = Data.db.games.next(self.table ? {sequence: self.table.games} : null);
      else if ("users" == type)     self.usermap  = Data.db.users.get();
      else if ("templates" == type) self.template = Data.db.templates.next();
      else self[type] = Data.db[type].list();

      if ("players" == type) {
        self.player    = Data.db.players.filter({fk_user: self.user.id})[0];
        self.playermap = Data.db.players.get();
        if (!self.hasCardsInMove()) self.hand = self.player ? self.player.hand : [];
      };

      if ("tables" == type) window.setTimeout(self.scrollToBottom, 500, "scores");
      if ("games" == type)  window.setTimeout(self.scrollToBottom, 500, "trick");
      if ("games" == type)  window.setTimeout(self.scrollToBottom, 500, "bid");
    },


    /** Handler for logout, confirms choice. */
    onLogout: function() {
      AppActions.dialog(_("Log out?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        document.location.href = Data.db.settings.get("rootURL") + "logout";
      }});
    },


    /** Handler for starting to drag card, remembers card and source. */
    onDragCardStart: function(playerid, card, evt) {
      var self = this;
      self.drag = {playerid: playerid, card: card};
    },


    /** Handler for dragging a card over a container, allows droppability. */
    onDragCardTo: function(playerid, evt) {
      var self = this;
      var playerid0 = self.drag.playerid;
      if (playerid != playerid0) evt.preventDefault();
    },


    /** Handler for dropping a dragged card. */
    onDropCard: function(playerid, evt) {
      var self = this;

      var playerid0 = self.drag.playerid;
      var card = self.drag.card;
      self.drag = {};
      self.onMoveCard(playerid0, playerid, card);
    },


    /** Handler for moving a card from source to target. */
    onMoveCard: function(source, target, card) {
      var self = this;
      if (!card || !self.isTurn(self.player) || ["distributing", "ongoing"].indexOf(self.game.status) < 0) return;

      // From hand to table or distribution
      if (source == self.player.id) {
        if (self.game.status == "distributing") {
          if (!target) {
            // Find distribution target with room
            self.otherplayers.some(function(player) {
              var count = self.player.expected.distribute[player.id];
              if (count > (Util.get(self.move, player.id) || []).length) return target = player.id;
            });
            if (!target) return;

          };
          
          if (Util.isNumeric(self.player.expected.distribute[target])
          && (self.move[target] || []).length == self.player.expected.distribute[target]) return;
        };
        target = target || "cards";
        var dropped = false;
        self.hand = self.hand.filter(function(x) {
          // Take care to not drop all jokers as they're not unique.
          if (dropped) return true;
          var result = (x != card);
          if (!result) dropped = true;
          return result;
        });
        var move = self.move[target] || [];
        move.push(card);
        Vue.set(self.move, target, move);

      // From table or distribution to hand
      } else if (target == self.player.id) {
        source = source || "cards";
        self.hand = Util.intersectUnique(self.player.hand, self.hand.concat(card));
        var move = self.move[source].filter(function(x) { return x != card; });
        Vue.set(self.move, source, move);

      // From one distribution to another
      } else {
        var move1 = self.move[source].filter(function(x) { return x != card; });
        var move2 = self.move[target] || [];

        if (move2.length) move1.push(move2.shift());
        move2.push(card);

        Vue.set(self.move, source, move1);
        Vue.set(self.move, target, move2);
      };
      self.$forceUpdate();
    },


    /** Requests to join game. */
    onJoinGame: function() {
      var self = this;
      AppActions.dialog(_("Join game?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        DataActions.save("players", {fk_table: self.table.id}, null, function(err, req) {
          console.log("Error joining game.", err, req);
          AppActions.dialog(_(err));
        });
      }});
    },


    /** Leaves game as player. */
    onLeaveGame: function() {
      var self = this;
      AppActions.dialog(_("Leave game?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        DataActions.remove("players", self.player, function() {
          document.location.href = Data.db.settings.get("rootURL");
        }, function(err, req) {
          console.log("Error leaving game.", err, req);
          AppActions.dialog(_(err));
        });
      }});
    },


    /** Goes to index page. */
    onGoToIndex: function() {
      document.location.href = Data.db.settings.get("rootURL");
    },


    /** Confirms and kicks player out of table */
    onKickPlayer: function(player) {
      var self = this;

      var user = self.usermap[player.fk_user];
      AppActions.dialog(_("Kick player '{}' out of game?").format(user.username), {cancel: true, onclose: function(result) {
        if (!result) return;

        DataActions.remove("players", player, null, function(err, req) {
          console.log("Error kicking player out.", err, req);
          AppActions.dialog(_(err));
        });
      }});
    },


    /** Carries out game action: start game. */
    onStartGame: function() {
      var self = this;
      AppActions.dialog(_("Starting game.."), {modal: true, ok: false});

      var data = {action: "start", fk_table: self.table.id};
      Data.query({url: "actions", data: data}).success(function() {
        AppActions.dialog();
      }).error(function(err, req) {
          console.log("Error starting game.", err, req);
          AppActions.dialog(_(err));
      });
    },


    /** Carries out game action: end game. */
    onEndGame: function() {
      var self = this;
      AppActions.dialog(_("End game?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        var data = {action: "end", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).success(function() {
          AppActions.dialog();
        }).error(function(err, req) {
          console.log("Error ending game.", err, req);
          AppActions.dialog(_(err));
        });
      }});
    },


    /** Carries out game action: reset table and start new game. */
    onResetTable: function() {
      var self = this;

      AppActions.dialog(_("Reset table and start again?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        var data = {action: "reset", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).success(function() {
          AppActions.dialog();
        }).error(function(err, req) {
          console.log("Error resetting table.", err, req);
          AppActions.dialog(_(err));
        });
      }});
    },


    /** Carries out game action: look at own hand. */
    onLookAtHand: function() {
      var self = this;
        var data = {action: "look", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).error(function(err, req) {
          console.log("Error looking at hand.", err, req);
          AppActions.dialog(_(err));
        });
    },


    /** Shows player's last trick. */
    onShowLastTrick: function(player) {
      var self = this;
      var text = _("Player '{0}' last trick:").format(self.usermap[player.fk_user].username);
      var cards = player.tricks[player.tricks.length - 1].map(function(trick) {
        return trick.cards.map(function(card) { return Cardery.html(card); }).join("");
      }).join("");
      AppActions.dialog(text, {html: cards});
    },


    /** Carries out game action: make a bid. */
    onBid: function(nopass, evt) {
      var self = this;
      var bid = nopass ? self.move : {pass: true};
      if (bid.blind && !self.blindable) delete bid.blind;
      var data = {action: "bid", fk_table: self.table.id, data: bid};

      evt.target.disabled = true;
      Data.query({url: "actions", data: data}).success(function() {
        Vue.set(self.game, "fk_player", null);
        self.move = {};
      }).error(function(err, req) {
        console.log("Error making bid.", err, req);
        AppActions.dialog(_(err));
      }).complete(function() {
        evt.target.disabled = false;
      });
    },


    /** Carries out game action: make a move. */
    onMove: function(nopass, evt) {
      var self = this;
      var move = nopass ? self.move : {pass: true};
      var data = {action: "move", fk_table: self.table.id, data: move};

      evt.target.disabled = true;
      Data.query({url: "actions", data: data}).success(function() {
        Vue.set(self.game, "fk_player", null);
        self.move = {};
      }).error(function(err, req) {
        console.log("Error making move.", err, req);
        AppActions.dialog(_(err));
      }).complete(function() {
        evt.target.disabled = false;
      });
    },


    /** Carries out game action: distribute cards to other players. */
    onDistribute: function(evt) {
      var self = this;
      var data = {action: "distribute", fk_table: self.table.id, data: self.move};

      evt.target.disabled = true;
      Data.query({url: "actions", data: data}).success(function() {
        Vue.set(self.game, "fk_player", null);
        self.move = {};
      }).error(function(err, req) {
        console.log("Error distributing.", err, req);
        AppActions.dialog(_(err));
      }).complete(function() {
        evt.target.disabled = false;
      });
    },

  },

});



/**
 * Modal dialog component.
 *
 * {hidden, text, html, ok, cancel, modal, callback}
 */
var TEMPLATE_APPDIALOG = `

  <div v-if="!hidden" id="appdialog">

    <div class="shadow" v-on:click="!modal && onClose(false)"></div>
    <div class="dialog">
      <div class="content">
        {{ text }}
      </div>

      <div v-if="html" v-html="html" class="html"></div>

      <slot></slot>

      <div class="buttons">
        <button v-if="ok"     v-on:click="onClose(true)" ref="ok">{{ _("OK") }}</button>
        <button v-if="cancel" v-on:click="onClose(false)">{{ _("Cancel") }}</button>
      </div>
    </div>

  </div>

`;

Vue.component("appdialog", {
  template: TEMPLATE_APPDIALOG,

  data: function() {
    return {
      hidden: true,
      unsubscribe: null, // AppAction listener unsubscriber
      text: "",
      html: "",
      ok: true,
      cancel: false,
      modal: false,
      callback: null,
    };
  },

  mounted: function() {
    document.body.addEventListener("keydown", this.onKeyDown, true);
    this.unsubscribe = AppActions.dialog.listen(this.onDialog);
  },

  beforeDestroy: function() {
    document.body.removeEventListener("keydown", this.onKeyDown, true);
    this.unsubscribe();
  },


  methods: {
    onClose: function(result) {
      this.hidden = true;
      if (this.callback) this.callback(result);
    },

    /** Handler for keypress on opened dialog, closes dialog on Enter/Escape. */
    onKeyDown: function(evt) {
      if (this.hidden) return;
      if ([13, 27].indexOf(evt.keyCode) < 0) return;
      evt.preventDefault(), evt.stopPropagation();
      this.onClose(13 == evt.keyCode); // Confirm dialog on Enter, cancel on Escape
    },

    onDialog: function(text, opts) {
      var self = this;
      self.text = text;
      self.html   = (opts && "html"   in opts) ? opts.html   : "";
      self.ok     = (opts && "ok"     in opts) ? opts.ok     : true;
      self.cancel = (opts && "cancel" in opts) ? opts.cancel : false;
      self.modal  = (opts && "modal"  in opts) ? opts.modal :  false;
      self.callback = opts && opts.onclose;
      self.hidden = false;
      if (!self.text && !self.html) self.onClose(false);
      else if (self.ok) window.setTimeout(function() { self.$refs.ok.focus(); });
    },
  },

});



/**
 * Cards visualization.
 *
 * Card data is represented as a two-byte string, value + suite.
 * Values for numerical cards 2-10 are "2"-"0", face cards "J", "Q", "K", "A".
 * Suites for clubs, diamonds, hearts and spades are "C", "D", "H", "S".
 * E.g. queen of hearts is "QH", ten of spades is "0S".
 * Jokers are "X".
 */
var Cardery = {

  ENTITIES: {
    "2S": "&#x1f0a2;", "2H": "&#x1f0b2;", "2D": "&#x1f0c2;", "2C": "&#x1f0d2;",
    "3S": "&#x1f0a3;", "3H": "&#x1f0b3;", "3D": "&#x1f0c3;", "3C": "&#x1f0d3;",
    "4S": "&#x1f0a4;", "4H": "&#x1f0b4;", "4D": "&#x1f0c4;", "4C": "&#x1f0d4;",
    "5S": "&#x1f0a5;", "5H": "&#x1f0b5;", "5D": "&#x1f0c5;", "5C": "&#x1f0d5;",
    "6S": "&#x1f0a6;", "6H": "&#x1f0b6;", "6D": "&#x1f0c6;", "6C": "&#x1f0d6;",
    "7S": "&#x1f0a7;", "7H": "&#x1f0b7;", "7D": "&#x1f0c7;", "7C": "&#x1f0d7;",
    "8S": "&#x1f0a8;", "8H": "&#x1f0b8;", "8D": "&#x1f0c8;", "8C": "&#x1f0d8;",
    "9S": "&#x1f0a9;", "9H": "&#x1f0b9;", "9D": "&#x1f0c9;", "9C": "&#x1f0d9;",
    "0S": "&#x1f0aa;", "0H": "&#x1f0ba;", "0D": "&#x1f0ca;", "0C": "&#x1f0da;",
    "JS": "&#x1f0ab;", "JH": "&#x1f0bb;", "JD": "&#x1f0cb;", "JC": "&#x1f0db;",
    "QS": "&#x1f0ad;", "QH": "&#x1f0bd;", "QD": "&#x1f0cd;", "QC": "&#x1f0dd;",
    "KS": "&#x1f0ae;", "KH": "&#x1f0be;", "KD": "&#x1f0ce;", "KC": "&#x1f0de;",
    "AS": "&#x1f0a1;", "AH": "&#x1f0b1;", "AD": "&#x1f0c1;", "AC": "&#x1f0d1;",
    "X":  "&#x1f0cf;", // Joker
    " ":  "&#x1f0a0;", // Card back
    "D":  "&#x2666;",
    "H":  "&#x2665;",
    "S":  "&#x2660;",
    "C":  "&#x2663;",
  },
  NAMES: {
    "C": "clubs",
    "D": "diamonds",
    "H": "hearts",
    "S": "spades",
    "X": "joker",
    " ": "back",
  },


  /** Returns HTML content for card (<span class="hearts">&#x1f0bd;</span> for "QH"). */
  html: function(card, textOnly) {
    var cls = card ? this.NAMES[card[card.length - 1]] : "";
    var attr = cls ? {"class": "card " + cls} : {"class": "card"};
    return textOnly ? this.ENTITIES[card] : Util.createElement("span", attr, this.ENTITIES[card]).outerHTML;
  },

  /** Returns whether card is face down. */
  isFaceDown: function(card) {
    return card == " ";
  },


};
