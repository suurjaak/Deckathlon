/**
 * Application components.
 * Requires Vue.js, data.js, util.js.
 *
 * @author    Erki Suurjaak
 * @created   18.04.2020
 * @modified  08.05.2020
 */


var AppActions = PubSub.topic([
  "dialog",         // Show modal dialog  (text, {close: onCloseDialog(clickedOk), cancel: true if cancel-button})
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

  <div id="login">

    <h1>{{ Data.db.settings.get("title") }}</h1>

    <span v-if="msg" v-bind:class="'msg ' + msgclass + (ongoing ? ' loading' : '')">
      {{ msg }}<br />
    </span>

    <form v-on:submit.prevent>
        <input type="text"     name="username" v-bind:disabled="ongoing"  v-bind:placeholder=" _('Username') " v-model="username" autofocus />
        <input type="password" name="password" v-bind:disabled="ongoing"  v-bind:placeholder=" _('Password') " v-model="password" />

        <button v-if="!register" class="login" v-bind:disabled="ongoing" v-on:click="onLogin">{{ _("Login") }}</button>
        <button v-if="!register" class="login" v-bind:disabled="ongoing" v-on:click="onTo(true)">{{ _("Register") }}</button>
        <button v-if="register"  class="login" v-bind:disabled="ongoing" v-on:click="onRegister">{{ _("Register") }}</button>
        <button v-if="register"  class="login" v-bind:disabled="ongoing" v-on:click="onTo(false)">{{ _("Back") }}</button>
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
        self.msg = _("Login successful, loading site..");
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
      self.msg = _("Logging in..");
    },

    onRegister: function() {
      var self = this;
      var data = {username: self.username.trim(),
                  password: self.password.trim()};
      if (!data.username || !data.password) return;

      DataActions.save("users", data, function() {
        self.msg = _("Registration successful, loading site..");
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

  <div id="index">

    <h1>{{ Data.db.settings.get("title") }}</h1>

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
      <button v-on:click="onNew">             {{ _("New game table") }}    </button>
      <button v-on:click="onOpenPrivateTable">{{ _("Join private table") }}</button>
    </div>

    <appdialog>
      <table v-if="table_join" class="private">
        <tr>
          <td><label for="table_shortid">{{ _("Table short ID") }}:</label></td>
          <td><input type="text" v-model="table_shortid" id="table_shortid" /></td>
        </tr>
      </table>

      <table v-if="table_new" class="new">
        <tr>
          <td><label for="table_name">{{ _("Table name") }}:</label></td>
          <td><input type="text" v-model="table_name" id="table_name" /></td>
        </tr>
        <tr>
          <td><label for="table_template">{{ _("Game") }}:</label></td>
          <td>
            <select v-model="table_template" id="table_template">
              <option></option>
              <option v-for="item in templates" v-bind:key="item.id" v-bind:value="item.id">{{ item.name }}</option>
            </select>
          </td>
        </tr>
        <tr>
          <td><label for="template_public">{{ _("Public") }}:</label></td>
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
 * Header component, shows index link.
 */
var TEMPLATE_HEADER = `

  <div>
    <a v-bind:href="Data.db.settings.get('rootURL')">{{ _("Back to index") }}</a>
  </div>

`;

Vue.component("page_header", {
  template: TEMPLATE_HEADER,
});



/**
 * Footer component, shows languages and username and logout.
 *
 * State: {langs, user}
 */
var TEMPLATE_FOOTER = `

  <div>

    <div class="langs">
      <a v-for="lang in langs"
         v-bind:href="getLangUrl(lang)">
         {{ _(lang) }}
      </a>
    </div>

    <a v-if="!Util.isEmpty(user)" v-on:click.prevent="onLogout"
       v-bind:href="Data.db.settings.get('rootURL') + 'logout'">
       {{ _("Log out {0}").format(user.username) }}
    </a>

  </div>

`;

Vue.component("page_footer", {
  template: TEMPLATE_FOOTER,

  data: function() {
    var self = this;
    return {
      langs: self.$options.parent.langs || [],
      user:  null,
    };
  },

  mounted: function() {
    var self = this;
    self.user = Data.db.user.get();
    self.unsubscribes = [Data.db.user.listen(self.onData)];
  },


  beforeDestroy: function() {
    var self = this;
    self.unsubscribes.forEach(function(f) { f(); });
  },


  methods: {

    getLangUrl: function(lang) {
      var root = Data.db.settings.get("rootURL");
      return root + lang + "/" + document.location.pathname.replace(root, "");
    },

    onData: function(type) {
      var self = this;
      if ("user" == type) self.user = Data.db.user.get();
    },

    /** Handler for logout, confirms choice. */
    onLogout: function() {
      AppActions.dialog(_("Log out?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        document.location.href = Data.db.settings.get("rootURL") + "logout";
      }});
    },

  },

});



/**
 * Table component, shows ongoing game table.
 *
 * State: {table, game, players, spectators, ..}
 */
var TEMPLATE_TABLE = `

  <div v-if="table" id="table">

    <h3>
      {{ _("Table: {0} (by {1}, playing {2})").format(table.name, Util.get(usermap, table.fk_host, "username"), template.name) }}
      <button v-if="player && player.fk_user == table.fk_host"
              v-on:click="onOpenTableMenu" v-bind:title="_('Open table settings')" class="menu">&#x2630;</button>
    </h3>

    <div class="table">

      <div v-bind:class="'tabletop ' + table.status"
           v-on:dragover="game && 'distributing' != game.status ? onDragCardTo(null, $event) : null"
           v-on:drop    ="game && 'distributing' != game.status ? onDropCard(null, $event) : null">


        <div v-if="game && game.status == 'distributing' && isTurn(player)" class="distribute">

          <div v-for="(playerx, i) in otherplayers"
               v-if="Util.get(player.expected.distribute, playerx.id)"
               v-bind:class="getClass('player', i)">

            <div class="cards">
              <div v-for="i in Util.range(player.expected.distribute[playerx.id])"
                   v-bind:draggable="move[playerx.id] && move[playerx.id][i]"
                   v-on:dragstart  ="onDragCardStart(playerx.id, move[playerx.id] && move[playerx.id][i], $event)" 
                   v-on:drop       ="onDropCard(playerx.id, $event)"
                   v-on:dragover   ="onDragCardTo(playerx.id, $event)"
                   v-on:dblclick   ="onMoveCard(playerx.id, player.id, move[playerx.id] && move[playerx.id][i])"
                   v-html="Cardery.tag(move[playerx.id] && move[playerx.id][i])"
                   class="card drop"></div>
            </div>
          </div>

          <button class="give" v-bind:disabled="!distributable" v-on:click="onDistribute">{{ _("Give") }}</button>

        </div>


        <div v-if="game && 'bidding' == game.status" class="bidding">
          <span class="heading">{{ _("Bidding") }}</span>

          <div class="bids" id="bids">
            <table>
              <tr v-for="item in game.bids">
                <td>{{ getName(item) }}:</td>
                <td v-html="formatBid(item)"></td>
              </tr>
            </table>
          </div>


          <div v-if="isTurn(player)" class="controls">

            <select v-if="Util.get(template, 'opts', 'bidding', 'suite')" v-model="move.suite" class="suite">
              <option v-for="suite in template.opts.suites" v-bind:key="suite" v-bind:value="suite" v-html="Cardery.glyph(suite)"></option>
            </select>

            <label v-if="blindable" class="blind">
              {{ _("Blind") }}
            </label>

            <input type="number" v-model.number="move.number"
              v-bind:min ="Util.get(template, 'opts', 'bidding', 'min')" 
              v-bind:max ="Util.get(template, 'opts', 'bidding', 'max')" 
              v-bind:step="Util.get(template, 'opts', 'bidding', 'step')" />

            <button v-bind:disabled="!biddable" v-on:click="onBid(true, $event)">{{ _("Bid") }}</button>
            <button v-if="passable" v-on:click="onBid(false, $event)">{{ _("Pass") }}</button>

          </div>

        </div>


        <div v-if="game && ('ongoing' == game.status || 'ended' == game.status)" class="moves">

          <div id="trick" v-bind:class="getClass('trick')">

            <div v-for="(playerx, i) in otherplayers.concat(player)"
                 v-bind:class="getClass('player', i)">
              <template v-for="move in [getLastMove(playerx)]" v-if="move">
                <div class="cards">
                  <div v-for="card in move.cards" v-html="Cardery.tag(card)" class="card"></div>
                </div>
                <div v-if="getMoveSpecial(move)" class="special">{{ _(getMoveSpecial(move)) }}</div>
              </template>
            </div>

            <div v-if="Util.get(template, 'opts', 'stack')" class="stack">
              <template v-for="move in [getLastMove(null, true)]" v-if="move">
                <div v-if="!Util.isEmpty(move.cards)" class="cards">
                  <div v-for="card in move.cards" v-html="Cardery.tag(card)" class="card"></div>
                </div>
              </template>
            </div>

          </div>

          <div class="cards">
            <div v-for="card in move.cards"
                 v-bind:draggable="player"
                 v-on:dragstart  ="player && onDragCardStart(null, card, $event)" 
                 v-on:dblclick   ="player && onMoveCard(null, player.id, card)"
                 v-html="Cardery.tag(card)"
                 class="card"></div>
          </div>

          <div v-if="isTurn(player)" class="controls">
            <label v-if="crawlable" class="crawl" v-bind:title="_('Make facedown move')">
              <input v-if="Util.isEmpty(game.trick)" type="checkbox" v-model="move.crawl" />
              <input v-else type="checkbox" v-model="move.crawl" />
              {{ _("Crawl") }}
            </label>
            <label v-for="special in specialables" v-bind:class="special" v-bind:title="_('Make {0}').format(special)">
              <input type="checkbox" v-model="move[special]" />
              {{ _(special.capitalize()) }}
            </label>
            <button v-bind:disabled="!playable" v-on:click="onMove(true, $event)">{{ _("Play") }}</button>
            <button v-if="passable" v-on:click="onMove(false, $event)">{{ _("Pass") }}</button>
          </div>

        </div>


        <div v-if="game" class="extra">

          <div v-if="!Util.isEmpty(getData('talon'))" class="talon">
            <div class="cards">
              <div v-for="card in getData('talon')" v-html="Cardery.tag(card)" class="card"></div>
            </div>
          </div>

          <div v-if="!Util.isEmpty(game.opts)" class="opts">
            <div v-if="game.opts.trump" class="trump">
              {{ _("Trump") }}
              <div v-bind:class="Cardery.name(game.opts.trump)"
                   v-html="Cardery.tag(game.opts.trump)"></div>
            </div>
          </div>

        </div>


        <div v-if="game && 'ended' == game.status" class="gameover">
          {{ _("Game over") }}
          <table v-if="!Util.isEmpty(game.score)" class="score">
            <tr v-if="!Util.isEmpty(game.bid)">
              <td class="bid">{{ _("Bidding") }}:</td>
              <td class="bid" v-html="formatBid(game.bid)"></td>
            </tr>
            <tr v-for="playerx in players">
              <td>{{ getName(playerx) }}:</td>
              <td>{{ game.score[playerx.id] }}</td>
            </tr>
          </table>
        </div>


      </div>



      <div v-for="(playerx, i) in otherplayers" v-bind:class="getClass('player', i)">
        <div v-bind:class="getClass('name', playerx)"
             v-bind:title="offline[playerx.fk_user] ? _('Offline since {0}').format(offline[playerx.fk_user].toISOString()) : ''">
          {{ getName(playerx) }}
        </div>
        <div class="cards">
          <div v-for="card in getData('hand', playerx)" v-html="Cardery.tag(card)" class="card"></div>
        </div>

        <fieldset v-if="playerx.tricks.length" class="tricks">
          <legend>{{ _("Tricks") }}</legend>
          <div class="cards">
            <div v-for="(trick, j) in playerx.tricks" v-html="Cardery.tag(' ')"
                 v-on:click="onShowPlayerTrick(playerx, j)"
                 v-bind:title="game && 'ended' == game.status ? _('Show trick #{0}').format(j+1) : _('Show last trick')"
                 class="card"></div>
          </div>
        </fieldset>

        <button v-if="kickable" v-on:click="onKickPlayer(playerx)" class="kick">{{ _("Kick out") }}</button>
      </div>


      <div v-if="player" class="player me">
        <div v-bind:class="'name' + (isTurn(player) ? ' turn' : '')">{{ getName(player) }}</div>
        <div class="cards"
             v-on:dragover   ="onDragCardTo(player.id, $event)"
             v-on:drop       ="onDropCard(player.id, $event)" >
          <div v-for="card in getData('hand', player)" v-html="Cardery.tag(card)"
               v-bind:draggable="draggable(card)"
               v-on:dragstart  ="onDragCardStart(player.id, card, $event)"
               v-on:dblclick   ="onMoveCard(player.id, null, card)"
               class="card"></div>
          <button v-if="blindable" v-on:click="onLookAtHand" class="look">{{ _("Look at cards") }}</button>
        </div>

        <fieldset v-if="player.tricks.length" class="tricks">
          <legend>{{ _("Tricks") }}</legend>
          <div class="cards">
            <div v-for="(trick, j) in player.tricks" v-html="Cardery.tag(' ')"
                 v-on:click="onShowPlayerTrick(player, j)"
                 v-bind:title="game && 'ended' == game.status ? _('Show trick #{0}').format(j+1) : _('Show last trick')"
                 class="card"></div>
          </div>
        </fieldset>
      </div>


      <div v-if="!Util.isEmpty(getData('scores'))" class="scores" id="scores">

        <div v-for="(scores, i) in getData('scores')">
          <div v-if="!Util.isEmpty(table.scores_history)">
            {{ _("Game series #{0}").format(i + 1) }}
            <hr />
          </div>
          <table>
            <thead>
              <tr>
                <th class="index">{{ _("#") }}</th>
                <th v-for="item in players">{{ getName(item) }}</th>
                <th v-if="!Util.isEmpty(getData('bids'))" class="bid">{{ _("Bidding") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, j) in scores">
                <td class="index">{{ j + 1 }}</th>
                <td v-for="playerx in players">
                  {{ formatScore(scores, j, playerx) }}
                </td>
                <td v-if="!Util.isEmpty(getData('bids'))" class="bid">
                  {{ formatBid(getData('bids')[i][j], true) }}
                </td>
              </tr>
              <tr v-if="game && 'ended' != game.status && !Util.isEmpty(game.bid)">
                <td class="index">{{ getData("bids")[i].length + 1 }}</td>
                <td v-for="playerx in players"></td>
                <td class="bid">{{ formatBid(game.bid, true) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>


      <div v-if="!Util.isEmpty(spectators)" class="spectators">
        {{ _("Spectators") }}:
        <span v-for="(item, i) in spectators">{{ (i ? ", " : "") + getName(item) }}</span>
      </div>



    </div>

    <div class="controls">

      <button v-if="joinable"   v-on:click="onJoinGame">  {{ _("Join game") }}</button>
      <button v-if="startable"  v-on:click="onStartGame" v-bind:title="_('Start new game on table')"> {{ _("Deal cards") }} </button>
      <button v-if="endable"    v-on:click="onEndGame">   {{ _("End game") }}</button>
      <button v-if="resettable" v-on:click="onResetTable">{{ _("Reset game series") }}</button>
      <button v-if="leavable"   v-on:click="onLeaveGame"> {{ _("Leave game") }}</button>

    </div>

    <appdialog>
      <div v-if="!Util.isEmpty(menu)" class="slot">

        <table>
          <tr>
            <td><label for="table_name">{{ _("Table name") }}:</label></td>
            <td><input type="text" v-model="menu.table.name" id="table_name" /></td>
          </tr>
          <tr>
            <td><label for="template_public">{{ _("Public") }}:</label></td>
            <td><input type="checkbox" v-model="menu.table.public" id="template_public" /></td>
          </tr>
        </table>

        <button v-on:click="onResetTable">{{ _("Reset game series") }}</button>

      </div>
    </appdialog>

  </div>

`;

Vue.component("page_table", {
  template: TEMPLATE_TABLE,

  sounds: {
    deal:  "deal.mp3",  // Played on cards being dealt
    move:  "move.mp3",  // Played on another player making move
    knock: "knock.mp3", // Played on current player's turn
  },

  data: function() {
    return {
      table:        null, // Current game table
      player:       null, // User player
      player0:      null, // Player backup for recognizing changed state
      game:         null, // Current game
      game0:        null, // Game backup for recognizing changed state
      players:      [],   // Table players, [{players-row}, ]
      table_users:  [],   // All users at table, [{table_users-row}, ]
      template:     null, // templates-row for game
      usermap:      [],   // {id_user:   {users-row}, }
      playermap:    {},   // {id_player: {players-row}, }
      offline:      {},   // {id_user: Date last seen, }
      user:         null, // User account
      hand:         [],   // Current hand, with temporary local changes
      move:         {},   // Current move (or bid) being made
      drag:         {},   // Current dragging as {playerid, card}
      menu:         {},   // Table settings-menu current state
      unsubscribe:  [],   // Data listener unsubscribers
    };
  },

  mounted: function() {
    var self = this;
    var user = Data.db.user.get();
    self.table        = Data.db.tables.next();
    self.player       = Data.db.players.next({fk_user: user.id});
    self.player0      = self.player;
    self.players      = Data.db.players.list();
    self.game         = Data.db.games.next(self.table ? {sequence: self.table.games} : null);
    self.game0        = self.game;
    self.user         = user;
    self.table_users  = Data.db.table_users.list();
    self.template     = Data.db.templates.next();
    self.usermap      = Data.db.users.get();
    self.playermap    = Data.db.players.get();
    self.hand         = self.player ? self.player.hand : [];
    self.offline      = Data.db.online.list().reduce(function(o, v) {
      if (!v.active) o[v.fk_user] = v.dt_online; return o;
    }, {});

    self.unsubscribes = [Data.db.tables.listen(self.onData),
                         Data.db.players.listen(self.onData),
                         Data.db.games.listen(self.onData),
                         Data.db.online.listen(self.onData),
                         Data.db.table_users.listen(self.onData),
                         Data.db.templates.listen(self.onData),
                         Data.db.users.listen(self.onData)];
    self.setPageTitle();
    window.setTimeout(self.scrollToBottom, 500, "scores");
    window.setTimeout(self.scrollToBottom, 500, "trick");
    window.setTimeout(self.scrollToBottom, 500, "bid");
  },


  beforeDestroy: function() {
    var self = this;
    self.unsubscribes.forEach(function(f) { f(); });
  },


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
      return self.player && "blind" == self.player.status && Util.get(self.template, "opts", "bidding", "blind");
    },


    /** Returns whether current cards distribution has all requirements filled. */
    distributable: function() {
      var self = this;
      var result = Boolean(self.player);
      result && Util.objectMap(self.player.expected.distribute, function(playerid, count) {
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
      if (self.player && Util.isNumeric(self.player.expected.cards)
      && (self.move.cards || []).length == self.player.expected.cards) result = true;
      else result = Object.keys(self.move).length;
      return result;
    },


    /** Returns whether current game move is passable. */
    passable: function() {
      var self = this;
      var result = false;
      if ("bidding" == self.game.status)
        result = Util.get(self.template, "opts", "bidding", "pass");
      else result = Util.get(self.template, "opts", "move", "pass") && !Util.isEmpty(self.game["trick"]);
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


    /** Returns the special moves player can make, like ["trump", "wheels"]. */
    specialables: function() {
      var self = this;
      var result = null;

      if (self.player && !self.game.trick.length) {
        var sopts = Util.get(self.template, "opts", "move", "special") || {};
        result = Object.keys(sopts).reduce(function(o, special) {
          var can = Util.get(sopts, special, self.game.tricks.length) !== false;
          can = can && Util.get(sopts, special, "*").some(function(cards) {
            return Util.intersect(self.player.hand, cards).length >= cards.length;
          });
          if (can && Util.get(sopts, special, "condition")) {
            can = self.game.opts[sopts[special].condition];
          };
          if (can) o.push(special);
          return o;
        }, []);
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
      var result = Data.db.players.filter(function(x) { return x.fk_user != self.user.id; });
      return self.player ? result.sort(function(a, b) {
        var av = a.sequence + (a.sequence < self.player.sequence ? self.players.length * 2 : 0);
        var bv = b.sequence + (b.sequence < self.player.sequence ? self.players.length * 2 : 0);
        return av - bv;
      }) : result;
    },


    /** Returns a list of spectators. */
    spectators: function() {
      var self = this;
      if (Util.isEmpty(self.usermap)) return null;
      var idmap = Object.keys(self.playermap).reduce(function(o, v) {
        o[self.playermap[v].fk_user] = self.getName(v);
        return o;
      }, {});

      var result = Data.db.table_users.filter(function(x) { return !idmap[x.fk_user] && !self.offline[x.fk_user]; });
      return Util.sortObjects(result, "fk_user", null, function(x) { return idmap[x]; });
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
      if (!player) return;
      var self = this;
      var result = self.game && player.id == self.game.fk_player && "ended" != self.game.status;
      if (!result && self.player && "distributing" == Util.get(self.game, "status")) {
        result = (player.id == self.player.id) && Util.get(self.player, "expected", "distribute");
      };
      return result;
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
      if (doUser) result += self.getName(bid) + " ";
      result += bid.pass ? _("pass") : (bid.number) || "";
      if (Util.get(self.template, "opts", "bidding", "suite") && bid.suite) {
        result += Cardery.tag(bid.suite);
      };
      if (bid.blind) result += " " + _("blind");
      return result;
    },


    /** Returns score for scorecard. */
    formatScore: function(scores, index, player) {
      var self = this;
      var result = scores[index][player.id];
      if (index && Util.get(self.template, "opts", "points")) {
        if (scores[index - 1][player.id] == scores[index][player.id])
          result = '—'; // Score same as previous
      };
      return result;
    },


    /** Returns data structure like "hand" or "hand0", depending n game state. */
    getData: function(name, a) {
      var self = this;
      var result = null;
      if ("talon" == name && self.game) {
        result = ("ended" == self.game.status) ? self.game.talon0 : self.game.talon;
      } else if ("hand" == name && self.game) {
        if (a && self.player && a.id == self.player.id)
          result = ("ended" == self.game.status) ? a.hand0 : self.hand;
        else result = ("ended" == self.game.status) ? a.hand0 : a.hand;
      } else if ("scores" == name && self.table) {
        result = self.table.scores_history;
        if (!Util.isEmpty(self.table.scores)) result = result.concat([self.table.scores]);
      } else if ("bids" == name && self.table) {
        result = self.table.bids_history;
        if (!Util.isEmpty(self.table.bids)) result = result.concat([self.table.bids]);
      };
      return result;
    },


    /** Returns CSS class for section. */
    getClass: function(name, a) {
      var self = this;
      var result = name;
      if ("trick" == name) {
        if (Util.isEmpty(self.game.trick)) result += " over";
        if (Util.get(self.template, 'opts', 'stack')) result += " stack";
      } else if ("player" == name) {
         result += " pos{0}of{1}".format(a + 1, self.players.length);
      } else if ("name" == name) {
         result = "name" + (self.isTurn(a) ? " turn" : "");
         if (self.offline[a.fk_user]) result += " offline";
      };
      return result;
    },


    /** Returns player's last move, or any last move. */
    getLastMove: function(player, nopass) {
      var self = this;
      var result = null;
      var moves = [];
      if (Util.isEmpty(self.game.trick)) {
        if (Util.isEmpty(self.move)) moves = self.game.tricks[self.game.tricks.length - 1];
      } else moves = self.game.trick;
      (moves || []).slice().reverse().some(function(move) {
        if ((!player || move.fk_player == player.id)
        && (nopass == null || move.pass != Boolean(nopass))) return result = move;
      });
      return result;
    },


    /** Returns username from {fk_player} or {fk_user}, or {id} as item as player ID. */
    getName: function(item) {
      var self = this;
      var result = "";
      var playerid = null, player = null, user = null;
      if (Util.isDict(item) && item.fk_player) playerid = item.fk_player;
      else if (Util.isDict(item) && item.fk_user) user = self.usermap[item.fk_user];
      else if (Util.isDict(item) && item.id) playerid = item.id;
      else playerid = item;
      if (playerid) player = self.playermap[playerid];
      if (player)   user   = self.usermap[player.fk_user];
      if (user)     result = user.username;
      else if (playerid) self.players.some(function(x, i) {
        if (x["id"] == playerid) return result = _("Player #{0}").format(i + 1);
      });
      return result;
    },


    /** Returns a special this move contains (e.g. "trump" or "wheels" or "crawl"). */
    getMoveSpecial: function(move) {
      var self = this;
      var result = null;
      Object.keys(move).some(function(k) {
        if (typeof(move[k]) == "boolean") return result = k;
      });
      return result;
    },


    /** Plays certain sound files if game state has changed. */
    playDataSound: function(type) {
      var self = this;
      var sound = null;

      if ("games" == type || "tables" == type) {
        if (Util.isEmpty(self.game0) && !Util.isEmpty(self.game)
        || self.game0.id != self.game.id) sound = "deal";
      };

      if (!sound && "games" == type) {
        if (!Util.isEmpty(self.game) && !Util.isEmpty(self.player)
        && Util.get(self.game0, "fk_player") != self.game.fk_player && self.game.fk_player == self.player.id) {
          sound = "knock";
        }

        else if (!Util.isEmpty(self.game) && !Util.isEmpty(self.game.trick)
        && JSON.stringify(Util.get(self.game0, "trick")) != JSON.stringify(self.game.trick)) {
          sound = "move";
        }

      } else if ("players" == type) {
        if (!Util.isEmpty(self.player) && !Util.isEmpty(self.player.expected)
        && JSON.stringify(Util.get(self.player0, "expected")) != JSON.stringify(self.player.expected)) {
          sound = "knock";
        }
      };


      var file = self.$options.sounds[sound];
      if (file) new Audio(Data.db.settings.get("staticURL") + "media/" + file).play();
    },


    /** Scrolls the element to bottom. */
    scrollToBottom: function(id) {
      var self = this;
      var elem = document.getElementById(id);
      if (elem) elem.scrollTop = elem.scrollHeight;
    },


    /** Sets document header title. */
    setPageTitle: function() {
      var self = this;
      var head = document.head.getElementsByTagName("title")[0];
      if (head) head.innerText = "{0} - {1}".format(Data.db.settings.get("title"), self.table.name);
    },


    /** Handler for data store update, refreshes local data. */
    onData: function(type) {
      var self = this;

      if ("tables" == type) self.table = Data.db.tables.next();

      if ("tables" == type || "games" == type) {
        self.game0 = self.game;
        self.game = Data.db.games.next(self.table ? {sequence: self.table.games} : null);
      } else if ("users" == type)     self.usermap  = Data.db.users.get();
      else if ("templates" == type) self.template = Data.db.templates.next();
      else if ("online" == type) {
        self.offline = Data.db.online.list().reduce(function(o, v) {
          if (!v.active) o[v.fk_user] = v.dt_online; return o;
        }, {});
      } else self[type] = Data.db[type].list();

      if ("players" == type) {
        self.player0   = self.player
        self.player    = Data.db.players.next({fk_user: self.user.id});
        self.playermap = Data.db.players.get();
        if (!self.hasCardsInMove()) self.hand = self.player ? self.player.hand : [];
      };

      if ("tables" == type) window.setTimeout(self.scrollToBottom, 500, "scores");
      if ("games"  == type) window.setTimeout(self.scrollToBottom, 500, "trick");
      if ("games"  == type) window.setTimeout(self.scrollToBottom, 500, "bid");
      self.playDataSound(type);
      self.setPageTitle();
    },


    /** Handler for clicking to open table menu. */
    onOpenTableMenu: function() {
      var self = this;
      self.menu = {"open": true, table: {"name": self.table.name, "public": self.table.public}};

      AppActions.dialog(_("Settings"), {cancel: true, onclose: function(result) {
        var data = self.menu.table;
        self.menu = {};
        if (!result) return;

        data.id = self.table.id;
        DataActions.save("tables", data, null, function(err, req) {
          console.log("Error saving table.", err, req);
          AppActions.dialog(_(err));
        });
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
        } else {
          if (Util.isNumeric(self.player.expected.cards)
          && (self.move.cards || []).length >= self.player.expected.cards) return;
        };
        target = target || "cards";
        var dropped = false;
        self.hand = self.hand.filter(function(x) {
          // Take care to not drop all jokers as they're not unique.
          if (dropped) return true;
          dropped = (x == card);
          return !dropped;
        });
        var move = self.move[target] || [];
        move.push(card);
        Vue.set(self.move, target, move);

      // From table or distribution to hand
      } else if (target == self.player.id) {
        source = source || "cards";
        self.hand = Util.intersectUnique(self.player.hand, self.hand.concat(card));
        var move = self.move[source].filter(function(x) { return x != card; });
        if (Util.isEmpty(move)) Vue.delete(self.move, source);
        else Vue.set(self.move, source, move);

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


    /** Confirms and kicks player out of table */
    onKickPlayer: function(player) {
      var self = this;

      // @todo kas kickitakse mängija koht lauast, või user mängija kohalt?
      // mõlemat on vist vaja.. paneme vast settingsisse.

      // Drop player position from game: <select Player #2 (username)> <button>
      // Kick user from player position: <select username> <button>

      // selectis on kõik peale minu enda.
      // kui mäng käib, siis on nupud disabled.

      AppActions.dialog(_("Kick player '{}' out of game?").format(self.getName(player)), {cancel: true, onclose: function(result) {
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
      self.menu = {};
      AppActions.dialog();

      var confirm = function(result) {
        if (!result) return;

        if ("complete" != self.table.status && !Util.isEmpty(self.table.scores)) AppActions.dialog(
          _("Are you really sure you want to reset the game series? This will lose the current scores."),
          {cancel: true, onclose: action}
        );
        else action(result);
      };

      var action = function(result) {
        if (!result) return;

        var data = {action: "reset", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).success(function() {
          AppActions.dialog();
        }).error(function(err, req) {
          console.log("Error resetting table.", err, req);
          AppActions.dialog(_(err));
        });
      };

      AppActions.dialog(_("Reset game series and restart?"), {cancel: true, onclose: confirm});
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


    /** Shows player's trick, last if game underway. */
    onShowPlayerTrick: function(player, index) {
      var self = this;
      if ("ended" != self.game.status) {
        var text = _("Player '{0}' last trick:").format(self.getName(player));
        var trick = player.tricks[player.tricks.length - 1];
      } else {
        var text = _("Player '{0}' trick #{1}:").format(self.getName(player), index + 1);
        var trick = player.tricks[index];
      };
      var cards = trick.map(function(move) {
        return Util.createElement("div", {"class": "move"}, move.cards.map(function(card) {
            return Cardery.tag(card, true);
          }).concat([
            self.getMoveSpecial(move) ? 
            Util.createElement("div", {"class": "special"}, _(self.getMoveSpecial(move))) :
            null
          ]).filter(Boolean)
        ).outerHTML;
      }).join("");
      AppActions.dialog(text, {html: cards});
    },


    /** Carries out game action: make a bid. */
    onBid: function(nopass, evt) {
      var self = this;
      var bid = nopass ? self.move : {pass: true};
      if (nopass && self.blindable) bid.blind = true;
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
      text: "",          // Text message
      html: "",          // HTML content
      ok: true,          // Whether dialog has ok-button
      cancel: false,     // Whether dialog has cancel-button
      modal: false,      // Whether dialog is uncloseable without buttons
      callback: null,    // function(ok) invoked on close
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
var Cardery = new function() {
  var self = this;

  self.ENTITIES = {
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
  };
  self.NAMES = {
    "C": "clubs",
    "D": "diamonds",
    "H": "hearts",
    "S": "spades",
    "X": "joker",
    " ": "back",
  };


  /** Returns glyph for card (&#x1f0bd; for "QH"). */
  self.glyph = function(card) {
    return self.ENTITIES[card];
  };

  /**
   * Returns HTML content for card (<span class="card hearts">&#x1f0bd;</span> for "QH"),
   * or DOM element if specified.
   */
  self.tag = function(card, dom) {
    if (!self.ENTITIES[card]) return;
    var cls = card ? self.name(card) : "";
    var attr = cls ? {"class": "card " + cls} : {"class": "card"};
    var result = Util.createElement("span", attr, self.ENTITIES[card]);
    return dom ? result : result.outerHTML;
  };

  /** Returns card suite name ('diamonds' for '*D') */
  self.name = function(card) {
    return self.NAMES[card[card.length - 1]];
  };

};
