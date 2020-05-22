/**
 * Application components.
 * Requires Vue.js, data.js, util.js.
 *
 * ------------------------------------------------------------------------------
 * This file is part of Deckathlon - card game website.
 * Released under the MIT License.
 *
 * @author    Erki Suurjaak
 * @created   18.04.2020
 * @modified  22.05.2020
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

    <span v-if="msg" class="msg" v-bind:class="msgclass + (ongoing ? ' loading' : '')">
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
                     "Error contacting server.");
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

    <div class="tables">

      <input type="search" v-bind:placeholder="_('Search')"
             v-on:keyup="onSearch" v-on:change="onSearch" v-on:search="onSearch" />

      <table v-if="!Util.isEmpty(alltables)">
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
            <td>
              <a v-bind:href="Data.db.settings.get('rootURL') + 'table/' + item.shortid">{{ item.name }}</a>
              <span v-if="user && item.fk_host == user.id"
                    v-bind:title="_('You are table host')"
                    class="tag">&copy;</span>
            </td>
            <td>{{ item.template }}</td>
            <td>{{ item.host }}</td>
            <td>
              {{ item.players }}
              <span v-if="user && item.users.indexOf(user.id) >= 0"
                    v-bind:title="_('You are player')"
                    class="tag">&reg;</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>


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

            <a v-bind:class="table_template && Data.db.templates.rw.get(table_template).description ? '' : 'disabled'" 
               v-on:click="onShowDescription" v-bind:title="_('Game description')" class="info">i</a>
          </td>
        </tr>
        <tr>
          <td><label for="template_public">{{ _("Public") }}:</label></td>
          <td><input type="checkbox" v-model="table_public" id="template_public" /></td>
        </tr>
        <tr>
          <td><label for="table_join">{{ _("Joinable") }}:</label></td>
          <td><input type="checkbox" v-model="table_opts.join" id="table_join" /></td>
        </tr>
      </table>
    </appdialog>

  </div>

`;

Vue.component("index", {
  template: TEMPLATE_INDEX,

  data: function() {
    return {
      alltables:        [],    // All available tables
      tables:           [],    // Search-filtered tables
      templates:        [],
      table_join:       false, // Whether dialog is joining private table 
      table_shortid:    "",    // Shortid of private table to join
      table_new:        false, // Whether dialog is creating new table
      table_name:       "",    // Name for new table
      table_template:   null,  // Selected game template for new table
      table_public:     false, // Public-flag for new table
      table_opts:       {},    // {join: Boolean}
      searchtimer:      null,  // Delayed search timer
      search:           "",    // Current search text
      searchfilter:     null,  // Current search filter-function
      user:             null,
      unsubscribes:     [],    // Data listener unsubscribers
    };
  },

  mounted: function() {
    var self = this;
    self.alltables = Data.db.tables.list().map(function(x) {
      x.template = Data.db.templates.rw.get(x.fk_template).name;
      x.host     = Data.db.users.rw.get(x.fk_host).username;
      return x;
    });
    self.tables    = self.alltables.slice();
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
      else if ("tables" == type) {
        self.alltables = Data.db.tables.list().map(function(x) {
          x.template = Data.db.templates.rw.get(x.fk_template).name;
          x.host     = Data.db.users.rw.get(x.fk_host).username;
          return x;
        });
        var search = self.search;
        self.search = "";
        self.onSearch(search);
      } else self[type] = Data.db[type].list();
    },

    onSearch: function(evt) {
      var self = this;
      window.clearTimeout(self.searchtimer); // Avoid reacting to rapid changes

      var search = Util.isString(evt) ? evt : evt.target.value.trim();
      var timer = self.searchtimer = window.setTimeout(function() {
        if (timer == self.searchtimer && search != self.search) {
          self.search = search;
          self.searchfilter = search ? Util.makeTextFilter(search) : null;
          self.tables = self.alltables.filter(function(x) {
            return !self.searchfilter || [x.name, x.template, x.host, x.players].some(self.searchfilter);
          });
          self.$forceUpdate();
        };
        self.searchtimer = null;
      }, 200);
    },

    /** Handler for showing game template description. */
    onShowDescription: function() {
      var self = this;
      var template = Data.db.templates.rw.get(self.table_template);
      if (!template) return;

      var dom = Util.createElement("div", {"class": "text"}, markdown(template.description));
      AppActions.dialog(template.name, {dom: dom, onclose: self.onNew});
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

      var data = {name: self.table_name.trim(), fk_template: self.table_template,
                  public: self.table_public, opts: self.table_opts};
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
 * Header component, shows index link and username.
 */
var TEMPLATE_HEADER = `

  <div>
    <a v-if="'table' == page" v-bind:href="Data.db.settings.get('rootURL')">{{ _("Back to index") }}</a>

    <a v-if="!Util.isEmpty(user)" v-on:click.prevent="onLogout"
       v-bind:href="Data.db.settings.get('rootURL') + 'logout'">
       {{ _("Log out {0}", user.username) }}
    </a>

  </div>

`;

Vue.component("page_header", {
  template: TEMPLATE_HEADER,

  data: function() {
    var self = this;
    return {
      page: self.$options.parent.page || "",
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
 * Footer component, shows languages and about.
 *
 * State: {langs, user}
 */
var TEMPLATE_FOOTER = `

  <div>

    <div class="langs">
      <a v-for="lang in langs"
         v-bind:class="lang == Data.db.settings.get('lang') ? 'active' : ''"
         v-bind:href="getLangUrl(lang)">
         {{ _(lang) }}
      </a>
    </div>

    <a v-on:click="onAbout">
       {{ _("about") }}
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

    /** Handler for opening about-box. */
    onAbout: function() {
      var settings = Data.db.settings.rw.get();
      var text = _(settings.about, settings.version, settings.versiondate, settings.author);
      var dom = Util.createElement("div", {"class": "about"}, markdown(text));
      Array.from(dom.getElementsByTagName("a")).forEach(function(x) { x.target = "_blank"; });
      AppActions.dialog(_(settings.title), {dom: dom});
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
      {{ _("Table: {0} (by {1}, playing {2})", table.name, Util.get(usermap, table.fk_host, "username"), template.name) }}
      <a v-if="template && template.description" v-on:click="onShowDescription" v-bind:title="_('Game description')" class="info">i</a>
      <button v-if="player && player.fk_user == table.fk_host"
              v-on:click="onOpenTableMenu" v-bind:title="_('Open table settings')" class="menu">&#x2630;</button>
    </h3>

    <div class="table">

      <div class="tabletop" v-bind:class="table.status"
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

          <div v-if="sellable" class="controls">
            <button v-on:click="onSell" v-bind:title="_('Put talon on sale.')">{{ _("Sell") }}</button>
          </div>

        </div>


        <div v-if="biddingable" class="bidding">
          <span class="heading">{{ _("Bidding") }}</span>

          <div class="bids" id="bids">
            <table>
              <tr v-for="item in game.bids">
                <td>{{ getName(item) }}:</td>
                <td v-html="formatBid(item, false, true)"></td>
              </tr>
            </table>
          </div>


          <div v-if="'bidding' == game.status && isTurn(player)" class="controls">

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
            <button v-if="redealable" v-on:click="onRedeal">{{ _("Demand redeal") }}</button>

          </div>

        </div>


        <div v-if="game && ('ongoing' == game.status || 'ended' == game.status)" class="moves">

          <div id="trick" v-bind:class="getClass('trick')">

            <div v-for="(playerx, i) in otherplayers.concat(player).filter(Boolean)"
                 v-if="!player || playerx.id != player.id || !isTurn(player)"
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

          <div v-if="isTurn(player) && !player.expected.follow" class="cards">
            <div v-for="card in move.cards"
                 v-bind:draggable="player"
                 v-on:dragstart  ="player && onDragCardStart('cards', card, $event)" 
                 v-on:dblclick   ="player && onMoveCard('cards', player.id, card)"
                 v-html="Cardery.tag(card)"
                 class="card"></div>
          </div>

          <div v-else-if="isTurn(player) && player.expected.follow" class="cards response">
            <div v-for="i in Util.range(player.expected.cards)"
                 v-bind:draggable="move.cards && move.cards[i]"
                 v-on:dragstart  ="onDragCardStart('cards', move.cards && move.cards[i], $event)" 
                 v-on:drop       ="onDropCard('cards', $event)"
                 v-on:dragover   ="onDragCardTo('cards', $event)"
                 v-on:dblclick   ="onMoveCard('cards', player.id, move.cards && move.cards[i])"
                 class="card drop">
              <div v-html="Cardery.tag(move.cards && move.cards[i])"></div>
              <div v-if="Util.isEmpty(move.cards)" class="hint">{{ _("respond") }}</div>
            </div>
          </div>


          <div v-if="isTurn(player) && player.expected.follow" class="cards follow">
            <div v-for="i in Util.range(player.expected.follow)"
                 v-bind:draggable="move.follow && move.follow[i]"
                 v-on:dragstart  ="onDragCardStart('follow', move.follow && move.follow[i], $event)" 
                 v-on:drop       ="onDropCard('follow', $event)"
                 v-on:dragover   ="onDragCardTo('follow', $event)"
                 v-on:dblclick   ="onMoveCard('follow', player.id, move.follow && move.follow[i])"
                 class="card drop">
              <div v-html="Cardery.tag(move.follow && move.follow[i])"></div>
              <div v-if="Util.isEmpty(move.follow)" class="hint">{{ _("follow") }}</div>
            </div>
          </div>



          <div v-if="isTurn(player)" class="controls">
            <label v-if="crawlable" class="crawl" v-bind:title="_('Make facedown move')">
              <input v-if="Util.isEmpty(game.trick)" type="checkbox" v-model="move.crawl" />
              <input v-else type="checkbox" v-model="move.crawl" />
              {{ _("Crawl") }}
            </label>
            <label v-for="special in specialables" v-bind:class="special" v-bind:title="_('Make {0}', special)">
              <input type="checkbox" v-model="move[special]" />
              {{ _(special.capitalize()) }}
            </label>
            <button v-bind:disabled="!playable" v-on:click="onMove(true, $event)">{{ _("Play") }}</button>
            <button v-if="retreatable" v-on:click="onRetreat">{{ _("Retreat") }}</button>
            <button v-if="passable" v-on:click="onMove(false, $event)">{{ _("Pass") }}</button>
          </div>

        </div>


        <div v-if="game" class="extra">

          <div v-for="talon in [getData('talon')]" class="talon">
            <div v-if="Util.get(template, 'opts', 'bidding', 'talon')" class="cards">
              <div v-for="card in talon" v-html="Cardery.tag(card)" class="card"></div>
            </div>
            <template v-else-if="!Util.isEmpty(talon) && 'ended' != game.status">
              <div v-if="Util.get(template, 'opts', 'talon', 'trump')" v-html="Cardery.tag(talon.shift())" class="trump card"></div>

              <div v-if="!Util.isEmpty(talon)" v-bind:title="talon.length" class="stack">
                <div v-html="Cardery.tag(' ')" class="card"></div>
                <div class="count">{{ talon.length }}</div>
              </div>
            </template>
          </div>

          <div v-if="!Util.isEmpty(game.opts)" class="opts">
            <div v-if="game.opts.trump && !Util.get(template, 'opts', 'talon', 'trump')" class="trump">
              {{ _("Trump") }}
              <div v-bind:class="Cardery.name(game.opts.trump)"
                   v-html="Cardery.tag(game.opts.trump)"></div>
            </div>
          </div>

        </div>


        <div v-if="game && 'ended' == game.status" class="gameover">
          {{ ("complete" == table.status) ? _("Game finished") : _("Game over") }}

          <table v-if="!Util.isEmpty(game.score)" class="score">
            <tr v-if="!Util.isEmpty(game.bid)">
              <td class="bid">{{ _("Bidding") }}:</td>
              <td class="bid" v-html="formatBid(game.bid, true, false)"></td>
            </tr>
            <tr v-for="playerx in players">
              <td>{{ getName(playerx) }}:</td>
              <td>{{ game.score[playerx.id] }}</td>
            </tr>
          </table>

          <div v-else-if="game.bids" class="bids">
            <table>
              <tr v-for="item in game.bids">
                <td>{{ getName(item) }}:</td>
                <td v-html="formatBid(item)"></td>
              </tr>
            </table>
          </div>
        </div>



      </div>



      <div v-for="(playerx, i) in otherplayers" v-bind:class="getClass('player', i)">
        <div v-bind:class="getClass('name', playerx)"
             v-bind:title="offline[playerx.fk_user] ? _('Offline since {0}', offline[playerx.fk_user].strftime('%H:%M, %d.%m.%Y')) : ''">
          {{ getName(playerx) }}
          <span v-if="offline[playerx.fk_user]" class="offline"></span>
        </div>
        <div class="cards">
          <div v-for="card in getData('hand', playerx)" v-html="Cardery.tag(card)" class="card"></div>
        </div>

        <fieldset v-if="playerx.tricks.length" class="tricks">
          <legend>{{ _("Tricks") }}</legend>
          <div class="cards">
            <div v-for="(trick, j) in playerx.tricks" v-html="Cardery.tag(Cardery.FACEDOWN)"
                 v-on:click="isFaceUp(trick) ? onShowPlayerTrick(playerx, j) : null"
                 v-bind:title="getTitle('trick', trick, j)"
                 class="card"></div>
          </div>
        </fieldset>
      </div>


      <div v-if="player" class="player me">
        <div v-bind:class="getClass('name', player)">{{ getName(player) }}</div>
        <div class="cards"
             v-on:dragover="onDragCardTo(player.id, $event)"
             v-on:drop    ="onDropCard(player.id, $event)" 
             v-on:auxclick="onHighlightNew"
             v-on:wheel   ="onHighlightNew" >
          <div v-for="card in getData('hand', player)" v-html="Cardery.tag(card)"
               v-bind:draggable="draggable(card)"
               v-on:dragstart  ="onDragCardStart(player.id, card, $event)"
               v-on:dblclick   ="onMoveCard(player.id, null, card)"
               v-bind:class="getClass('card', card)"></div>
          <button v-if="blindable" v-on:click="onLookAtHand" class="look">{{ _("Look at cards") }}</button>
        </div>

        <fieldset v-if="player.tricks.length" class="tricks">
          <legend>{{ _("Tricks") }}</legend>
          <div class="cards">
            <div v-for="(trick, j) in player.tricks" v-html="Cardery.tag(Cardery.FACEDOWN)"
                 v-on:click="isFaceUp(trick) ? onShowPlayerTrick(player, j) : null"
                 v-bind:title="getTitle('trick', trick, j)"
                 class="card"></div>
          </div>
        </fieldset>

        <fieldset v-if="game && game.discards.length && Util.get(template, 'opts', 'discards')" class="discards">
          <legend>{{ _("Discard pile") }}</legend>
          <div class="cards" v-bind:title="_('Show last discards')" v-on:click="onShowDiscards(null)">
            <div v-for="_ in game.discards" v-html="Cardery.tag(Cardery.FACEDOWN)" class="card"></div>
          </div>
        </fieldset>
      </div>


      <div v-if="scoreable" class="scores" id="scores">

        <div v-for="(scores, i) in getData('scores')">
          <div v-if="!Util.isEmpty(table.scores_history)" class="title">
            <hr v-if="i" />
            {{ _("Game series #{0}", i + 1) }}
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
                  {{ formatBid(getData('bids')[i][j], true, false) }}
                </td>
              </tr>
              <tr v-if="game && 'ended' != game.status && !Util.isEmpty(game.bid)">
                <td class="index">{{ Util.isEmpty(table.scores) ? "" : getData("bids")[i].length + 1 }}</td>
                <td v-for="playerx in players"></td>
                <td class="bid">{{ formatBid(game.bid, true, false) }}</td>
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
      <button v-if="leavable"   v-on:click="onLeaveTable">{{ _("Leave table") }}</button>

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
          <tr>
            <td><label for="table_join">{{ _("Joinable") }}:</label></td>
            <td><input type="checkbox" v-model="menu.table.opts.join" id="table_join" /></td>
          </tr>
          <tr>
            <td>
              <label for="table_user">{{ _("User") }}:</label>
            </td>
            <td>
              <select v-model="menu.table.fk_user" id="table_user">
                <option></option>
                <option v-for="playerx in otherplayers" v-if="playerx.fk_user" v-bind:key="playerx.fk_user" v-bind:value="playerx.fk_user">{{ getName(playerx) }}</option>
              </select>
              <button v-on:click="onKickUser" v-bind:disabled="!kickable">{{ _("Kick user out") }}</button>
            </td>
          </tr>
          <tr>
            <td>
              <label for="table_player">{{ _("Player") }}:</label>
            </td>
            <td>
              <select v-model="menu.table.fk_player" id="table_player">
                <option></option>
                <option v-for="playerx in otherplayers" v-bind:key="playerx.id" v-bind:value="playerx.id">{{ getName(playerx) }}</option>
              </select>
              <button v-on:click="onKickPlayer" v-bind:disabled="!droppable">{{ _("Drop player") }}</button>
            </td>
          </tr>
        </table>

        <div class="bottom">
          <button v-on:click="onResetTable">{{ _("Reset game series") }}</button>
        </div>

      </div>
    </appdialog>

  </div>

`;

Vue.component("page_table", {
  template: TEMPLATE_TABLE,

  sounds: {
    deal:  "deal.mp3",  // Played on cards being dealt
    knock: "knock.mp3", // Played on current player's turn
    trump: "trump.mp3", // Played on trump being made
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
      requests:     [],   // Current requests
      requestqueue: {},   // {request ID: {request}}
      usermap:      [],   // {id_user:   {users-row}, }
      playermap:    {},   // {id_player: {players-row}, }
      offline:      {},   // {id_user: Date last seen, }
      user:         null, // User account
      hand:         [],   // Current hand, with temporary local changes
      move:         {},   // Current move (or bid) being made
      drag:         {},   // Current dragging as {source, card}
      menu:         {},   // Table settings-menu current state
      flags:        {},   // Various temporary flags like "highlightnew"
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
    self.requests     = Data.db.requests.list();
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
                         Data.db.requests.listen(self.onData),
                         Data.db.users.listen(self.onData)];

    if (!Util.isEmpty(self.requests)) window.setTimeout(self.processRequests, 500);
    window.setTimeout(self.scrollToBottom, 500, "scores");
    window.setTimeout(self.scrollToBottom, 500, "trick");
    window.setTimeout(self.scrollToBottom, 500, "bid");
    // Pre-fetch sounds
    Util.objectFilter(self.$options.sounds, function(file) {
      new Audio(Data.db.settings.get("staticURL") + "media/" + file);
    });
    self.setPageTitle();
    self.processDataUpdate("games");
    self.processDataUpdate("players");
  },


  beforeDestroy: function() {
    var self = this;
    self.unsubscribes.forEach(function(f) { f(); });
  },


  computed: {

    /** Returns whether game is joinable for current user. */
    joinable: function() {
      var self = this;
      if (!Util.get(self.table, "opts", "join")) return;

      var template = Data.db.templates.rw.get(self.table.fk_template);
      var rng = Util.get(template, "opts", "players");
      if (rng != null && !Array.isArray(rng)) rng = [0, rng];
      var userplayers = self.players.filter(function(x) { return !x.fk_user; });
      return !self.player && (rng == null || userplayers.length < rng[1]);
    },


    /** Returns whether game is leavable for current user. */
    leavable: function() {
      var self = this;
      return self.player && self.table && self.player.id != self.table.fk_host;
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


    /** Returns whether user is kickable from table. */
    kickable: function() {
      var self = this;
      return self.user.id == self.table.fk_host;
    },


    /** Returns whether player is droppable from table. */
    droppable: function() {
      var self = this;
      return self.user.id == self.table.fk_host && ["new", "ended", "complete"].indexOf(self.table.status) >= 0;
    },


    /** Returns whether current player can make blind bid. */
    blindable: function() {
      var self = this;
      return self.player && "blind" == self.player.status && Util.get(self.template, "opts", "bidding", "blind");
    },


    /** Returns whether current cards distribution has all requirements filled. */
    distributable: function() {
      var self = this;
      var result = Boolean(Util.get(self.player, "expected", "distribute"));
      result && Util.objectMap(self.player.expected.distribute, function(playerid, count) {
        if (count > (self.move[playerid] ? self.move[playerid] : []).length) result = false;
      });
      return result;
    },


    /** Returns whether to show bidding section. */
    biddingable: function() {
      var self = this;
      return self.game && ("bidding" == self.game.status || 
        !Util.isEmpty(self.game.bid) && "ended" != self.game.status 
        && !self.game.trick.some(function(x) { return x.fk_player; }) && Util.isEmpty(self.game.tricks)
      );
    },


    /** Returns whether to show scores section. */
    scoreable: function() {
      var self = this;
      return self.getData("scores").some(function(x) { return !Util.isEmpty(x); })
             || self.game && !Util.isEmpty(self.game.bid);
    },


    /** Returns whether current game bid has all requirements filled. */
    biddable: function() {
      var self = this;
      return self.move.number && (!Util.get(self.template, "opts", "bidding", "suite") || self.move.suite);
    },


    /** Returns whether player can demand redeal. */
    redealable: function() {
      var self = this;
      if (!self.player || !Util.get(self.template, "opts", "redeal")
      || self.game.bids.some(function(x) { return x.fk_player == self.player.id })) return;

      var copts = Util.get(self.template, "opts", "redeal", "condition") || {};
      return copts.hand && Util.intersect(self.player.hand, copts.hand).length >= copts.min;
    },


    /** Returns whether distributing player can sell talon. */
    sellable: function() {
      var self = this;
      return self.player && self.game && !Util.isEmpty(self.game.bid)
             && "distributing" == self.game.status
             && Util.get(self.template, "opts", "bidding", "sell")
             && !self.game.bids.some(function(x) { return x.sell; });
    },


    /** Returns whether current game move has all requirements filled. */
    playable: function() {
      var self = this;
      var result = false;
      if (self.player && Util.isNumeric(self.player.expected.cards)) {
        if ((self.move.cards || []).length == self.player.expected.cards) result = true;
      } else result = Object.keys(self.move).length;
      if (result && Util.get(self.template, "opts", "move", "follow")) {
        result = !self.hand.length || !Util.isEmpty(self.move.follow);
      };
      return result;
    },


    /** Returns whether current game move is retreatable. */
    retreatable: function() {
      var self = this;
      var result = false;
      if ("ongoing" == self.game.status)
        result = Util.get(self.template, "opts", "move", "retreat");
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
          if (can && Util.get(sopts, special, "condition", "opt")) {
            can = self.game.opts[sopts[special].condition.opt];
          };
          if (can && Util.get(sopts, special, "condition", "suite")) {
            var optsuite = Cardery.name(self.game.opts[sopts[special].condition.opt]);
            var potentials = Util.get(sopts, special, "*").reduce(function(o, v) {
              var inter = Util.intersect(self.player.hand, v);
              if (inter.length >= v.length) o.push.apply(o, v);
              return o;
            }, []);
            can = potentials.some(function(x) { return Cardery.name(x) == optsuite; });
          };
          if (can) o.push(special);
          return o;
        }, []);
      };

      return result;
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


    /**
     * Translate function, trying for template-specific translation first.
     */
    _: function(text, args) {
      var self = this;
      var args = Array.isArray(args) ? args : Array.apply(null, arguments).slice(1);
      var tt = self.template && self.template.i18n[Data.db.settings.get("lang")] || {};
      if (text in tt) {
        var result = tt[key];
        if (args && args.length) result = result.format.apply(result, args);
      } else var result = _(text, args);
      return result;
    },


    /** Returns whether card is draggable. */
    draggable: function(card) {
      var self = this;
      var result = self.game && (["ongoing", "distributing"].indexOf(self.game.status) >= 0);
      result = result && self.isTurn(self.player);

      // Allow preparing move before own turn
      if (!result && Util.get(self.template, "opts", "trick")
      && self.game.trick.length && !self.game.trick.some(function(x) {
        return x.fk_player == self.player.id;
      })) result = true;
      return result;
    },


    /** Returns whether cards in trick are face up for current player. */
    isFaceUp: function(trick) {
      return trick.every(function(x) { return !Util.isEmpty(x.cards) && x.cards.every(Cardery.faceup); });
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
    formatBid: function(bid, doUser, doSale) {
      var self = this;
      if (!Object.keys(bid).length) return null;

      var result = "";
      if (doUser) result += self.getName(bid) + " ";
      result += bid.pass ? self._("pass") : (bid.number) || "";
      if (Util.get(self.template, "opts", "bidding", "suite") && bid.suite) {
        result += Cardery.tag(bid.suite);
      };
      if (bid.blind) result += " " + self._("blind");
      if (bid.sell && doSale) result += " " + self._("sale");
      if (bid.redeal)  result += " " + self._("redeal");
      return result;
    },


    /** Returns score for scorecard. */
    formatScore: function(scores, index, player) {
      var self = this;
      var result = scores[index][player.id];
      if (Util.get(self.template, "opts", "points")) {
        if (!index && !result || index && scores[index - 1][player.id] == scores[index][player.id])
          result = '—'; // Score same as previous
      };
      return result;
    },


    /** Returns data structure like "hand" or "hand0", depending on game state. */
    getData: function(name, a) {
      var self = this;
      var result = null;
      if ("talon" == name && self.game) {
        result = ("ended" == self.game.status) ? self.game.talon0 : self.game.talon;
      } else if ("hand" == name && self.game) {
        if ("ended" == self.game.status && Util.get(self.template, "opts", "reveal")) {
          result = self.game.hands[self.player.id];
        } else if (self.player && a.id == self.player.id) result = self.hand;
        else result = a.hand;
      } else if ("scores" == name && self.table) {
        result = self.table.scores_history;
        if (!Util.isEmpty(self.table.scores)) result = result.concat([self.table.scores]);
        if (!result.length) result = result.concat([[]]); // Enable at least one iteration
      } else if ("bids" == name && self.table) {
        result = self.table.bids_history;
        if (!Util.isEmpty(self.table.bids)) result = result.concat([self.table.bids]);
      };
      return Util.clone(result);
    },


    /** Returns CSS class for section. */
    getClass: function(name, a) {
      var self = this;
      var result = name;
      if ("trick" == name) {
        if (!self.game.trick.some(function(x) { return x.fk_player; })) result += " over";
        if (Util.get(self.template, 'opts', 'stack')) result += " stack";
      } else if ("player" == name) {
         result += " pos{0}of{1}".format(a + 1, self.players.length);
      } else if ("name" == name) {
         result = "name";
         if (self.isTurn(a)) {
           result += " turn";
           if (Util.isEmpty(self.game0) || self.game0.fk_player != self.game.fk_player)
             result += " pulse";
         };
         if (self.offline[a.fk_user]) result += " offline";
      } else if ("card" == name) {
         result = "card";
         if (self.flags.highlightnew
         && Util.difference(self.player.hand, self.player.hand0).indexOf(a) >= 0) result += " pulse";
      };
      return result;
    },


    /** Returns player's last move, or any last move. */
    getLastMove: function(player, nopass) {
      var self = this;
      var result = null;
      var moves = [];
      if (!self.game.trick.some(function(x) { return x.fk_player; })) {
        if (Util.isEmpty(self.move)) moves = self.game.tricks[self.game.tricks.length - 1];
      } else moves = self.game.trick;
      if (!player && self.template.opts.stack && Util.get(self.game, "trick", 0, "stack")) {
        result = {"cards": Util.get(self.game, "trick", 0, "stack", -1)};
      } else (moves || []).slice().reverse().some(function(move) {
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
        if (x["id"] == playerid) return result = self._("Player #{0}", i + 1);
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


    /** Returns title for element like "trick". */
    getTitle: function(name, a, b) {
      var self = this;
      var result = null;
      if ("trick" == name) {
        if (self.isFaceUp(a)) {
          result = (self.game && "ended" == self.game.status) ? self._('Show trick #{0}', b+1) : self._('Show last trick');
        };
      };
      return result;
    },


    /**
     * Plays certain sound files if game state has changed,
     * pre-fills bid.
     */
    processDataUpdate: function(type) {
      var self = this;
      var sound = null;

      if ("games" == type || "tables" == type) {
        if ((Util.isEmpty(self.game0) && !Util.isEmpty(self.game)
             || !Util.isEmpty(self.game0) && self.game0.id != self.game.id)
        && !self.game.trick.some(function(x) { return x.fk_player; }) && Util.isEmpty(self.game.bids)
        && JSON.stringify(self.player.hand) == JSON.stringify(self.player.hand0)) sound = "deal";
      };

      if (!sound && "games" == type) {

        if (!Util.isEmpty(self.game) && !Util.isEmpty(self.player)
        && Util.get(self.game0, "fk_player") != self.game.fk_player && self.game.fk_player == self.player.id) {
          sound = "knock";
        } else if ((Util.isEmpty(self.game0) || self.game0.trick.length != self.game.trick.length)
        && self.game && self.game.trick.length && self.game.trick[self.game.trick.length - 1].trump) sound = "trump";

      } else if ("players" == type) {
        if (!Util.isEmpty(self.player) && !Util.isEmpty(self.player.expected)
        && JSON.stringify(Util.get(self.player0, "expected")) != JSON.stringify(self.player.expected)
        && (Util.isEmpty(self.game0) && Util.isEmpty(self.game) || !self.game.fk_player)) {
          sound = "knock";
        }
      };


      if ("games" == type || "players" == type) {
        if (self.game && "bidding" == self.game.status && !Util.isEmpty(self.game.bids)) {
          var number = self.game.bids.reduce(function(o, v) {
            return v.number > o ? v.number : o; // Pre-fill starting bid to latest
          }, 0);
          if (number) Vue.set(self.move, "number", number);
        } else if (self.game && "bidding" != self.game.status && !self.move.__touched) {
          self.move = {};
        };
      };


      if ("games" == type || "players" == type) {
         if (self.game && "ended" != self.game.status 
         && (Util.get(self.template, "opts", "refill") && (Util.get(self.game.trick, -1) || {}).fk_player == self.player.id
             || !Util.get(self.template, "opts", "refill")
             && Util.isEmpty(self.game.tricks)
             && !self.game.trick.some(function(x) { return x.fk_player; }) && Util.isEmpty(self.move)
             && (Util.get(self.game, "bid", "fk_player") != self.player.id
             || "ongoing" != self.game.status))) self.onHighlightNew();
      };

      var file = self.$options.sounds[sound];
      if (file && "ended" != self.game.status) new Audio(Data.db.settings.get("staticURL") + "media/" + file).play();
    },


    /** Processes current requests, like to join the game. */
    processRequests: function() {
      var self = this;
      if (Util.isEmpty(self.user) || Util.isEmpty(self.table) || !Util.isEmpty(self.requestqueue)) return;

      var processed = {}; // {request ID: true}

      var process = function(request) {
        self.requestqueue[request.id] = request;
        var next = true;

        if (request.fk_user == self.user.id) {

          if ("join" == request.type && "rejected" == request.status) {
            next = false;
            AppActions.dialog(self._("Request to join game was rejected."), {onclose: processNext.bind(self, request)});

            Util.set(request, true, "opts", "processed", self.user.id);
            DataActions.update("requests", request);
            DataActions.save("requests", request);
            processed[request.id] = true;
          };

        } else if (self.user.id == self.table.fk_host) {

          if ("join" == request.type) {
            next = false;
            AppActions.dialog(
              self._("User '{0}' wishes to join the game.", self.getName(request)), {
                ok: self._("Accept"), cancel: self._("Reject"),
                modal: true, onclose: function(result) {
                  request.status = result ? "accepted" : "rejected";
                  Util.set(request, true, "opts", "processed", self.user.id);

                  DataActions.update("requests", request);
                  DataActions.save("requests", request, null, function(err, req) {
                    console.log("Error accepting request.", err, req);
                    AppActions.dialog(self._(err));
                  });

                  processed[request.id] = true;
                  processNext(request);
                }
            });
          };

        };

        if (next) processNext(request);
      };

      var processNext = function(request) {
        if (request) delete self.requestqueue[request.id];
        request = null;
        self.requests.some(function(x) {
          if (!processed[x.id] && !Util.get(x, "opts", "processed", self.user.id))
            return request = x;
        });
        if (request) window.setTimeout(process, 0, request);
      };

      processNext();
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

      if ("requests" == type) self.processRequests();
      if ("tables" == type || "games" == type && self.game && !Util.isEmpty(self.game.bid)) window.setTimeout(self.scrollToBottom, 500, "scores");
      if ("games"  == type) window.setTimeout(self.scrollToBottom, 500, "trick");
      if ("games"  == type) window.setTimeout(self.scrollToBottom, 500, "bid");
      self.processDataUpdate(type);
      self.setPageTitle();
    },


    /** Handler for clicking to highlight new cards in hand. */
    onHighlightNew: function() {
      var self = this;
      if (self.flags.highlightnew || !self.player 
      || Util.isEmpty(self.player.hand0) || Util.isEmpty(self.player.hand)
      || !self.player.hand0.some(Cardery.faceup)
      || !self.player.hand.some(Cardery.faceup)
      || !Util.difference(self.player.hand, self.player.hand0).length) return;

      Vue.set(self.flags, "highlightnew", true);
      window.setTimeout(function() { Vue.delete(self.flags, "highlightnew"); }, 3000);
    },


    /** Handler for clicking to open table menu. */
    onOpenTableMenu: function() {
      var self = this;
      self.menu = {"open": true, table: {"name": self.table.name, "public": self.table.public, "opts": self.table.opts}};

      AppActions.dialog(self._("Settings"), {cancel: true, onclose: function(result) {
        var data = self.menu.table;
        self.menu = {};
        if (!result) return;

        data.id = self.table.id;
        DataActions.save("tables", data, null, function(err, req) {
          console.log("Error saving table.", err, req);
          AppActions.dialog(self._(err));
        });
      }});
    },


    /** Handler for starting to drag card, remembers card and source. */
    onDragCardStart: function(source, card, evt) {
      var self = this;
      self.drag = {source: source, card: card};
    },


    /** Handler for dragging a card over a container, allows droppability. */
    onDragCardTo: function(target, evt) {
      var self = this;
      if (target != self.drag.source) evt.preventDefault();
    },


    /** Handler for dropping a dragged card. */
    onDropCard: function(target, evt) {
      var self = this;

      var source = self.drag.source;
      var card = self.drag.card;
      self.drag = {};
      self.onMoveCard(source, target, card, true);
    },


    /** Handler for moving a card from source to target. */
    onMoveCard: function(source, target, card, swap) {
      var self = this;
      if (!card || ["distributing", "ongoing"].indexOf(self.game.status) < 0) return;
      if (!self.isTurn(self.player) && (!Util.get(self.template, "opts", "trick") || !self.game.trick.length || self.game.trick.some(function(x) {
        return x.fk_player == self.player.id;
      }))) return;

      if (source == self.player.id) {
        // From hand to table or distribution

        var expected = self.player.expected;
        if ("distributing" == self.game.status) expected = self.player.expected.distribute;

        if (!target && expected.cards
        && (!Util.isNumeric(expected.cards) || (self.move.cards || []).length < expected.cards))
          target = "cards";

        if (!target) Object.keys(expected).some(function(k) {
          // Find target with room, or just any target
          if (!Util.isNumeric(expected[k])) return;
          target = k;
          if ((self.move[k] || []).length < expected[k]) return true;
        });

        if (!target || !swap && Util.isNumeric(expected[target]) 
        && (self.move[target] || []).length >= expected[target]) return;

        self.hand = self.hand.filter(function(x) { return x != card; });
        var move = self.move[target] || [];
        if (move.length >= expected[target])
          self.hand = Util.intersectUnique(self.player.hand, self.hand.concat(move.pop()));
        move.push(card);
        Vue.set(self.move, target, move);
        self.move.__touched = true;

      } else if (target == self.player.id) {
        // From table or distribution to hand

        source = source || "cards";
        self.hand = Util.intersectUnique(self.player.hand, self.hand.concat(card));
        var move = self.move[source].filter(function(x) { return x != card; });
        if (Util.isEmpty(move)) Vue.delete(self.move, source);
        else Vue.set(self.move, source, move);

      } else {
        // From one distribution to another

        source = source || "cards";
        target = target || "cards";
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
      AppActions.dialog(self._("Join game?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        var data = {fk_table: self.table.id, type: "join"};
        DataActions.save("requests", data, function() {
          AppActions.dialog(self._("Sent request to join game."));
        }, function(err, req) {
          console.log("Error joining game.", err, req);
          AppActions.dialog(self._(err));
        });
      }});
    },


    /** Leaves table as player. */
    onLeaveTable: function() {
      var self = this;
      AppActions.dialog(self._("Leave table? You will no longer be a player."), {cancel: true, onclose: function(result) {
        if (!result) return;

        var player = Util.merge(self.player, {fk_user: null});
        DataActions.save("players", player, function() {
          document.location.href = Data.db.settings.get("rootURL");
        }, function(err, req) {
          console.log("Error leaving table.", err, req);
          AppActions.dialog(self._(err));
        });
      }});
    },


    /** Confirms and drops player from table */
    onKickPlayer: function(player) {
      var self = this;
      var player = self.playermap[self.menu.table.fk_player];
      if (!player) return;

      AppActions.dialog(self._("Drop player '{0}' from game?", self.getName(player)), {cancel: true, onclose: function(result) {
        if (!result) return;

        DataActions.remove("players", player, null, function(err, req) {
          console.log("Error dropping player.", err, req);
          AppActions.dialog(self._(err));
        });
      }});
    },


    /** Confirms and kicks user from table */
    onKickUser: function(player) {
      var self = this;
      var user = self.usermap[self.menu.table.fk_user];
      var player = user ? Data.db.players.next({fk_user: user.id}) : null;
      if (!player) return;

      AppActions.dialog(self._("Kick user '{0}' from game?", self.getName(player)), {cancel: true, onclose: function(result) {
        if (!result) return;

        player.fk_user = null;
        DataActions.save("players", player, null, function(err, req) {
          console.log("Error kicking user out.", err, req);
          AppActions.dialog(self._(err));
        });
      }});
    },


    /** Carries out game action: start game. */
    onStartGame: function() {
      var self = this;

      AppActions.dialog(self._("Deal cards and start a new game?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        AppActions.dialog(self._("Starting game.."), {modal: true, ok: false});

        var data = {action: "start", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).success(function() {
          AppActions.dialog();
        }).error(function(err, req) {
          console.log("Error starting game.", err, req);
          AppActions.dialog(self._(err));
        });
      }});
    },


    /** Carries out game action: end game. */
    onEndGame: function() {
      var self = this;
      AppActions.dialog(self._("End game?"), {cancel: true, onclose: function(result) {
        if (!result) return;

        var data = {action: "end", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).success(function() {
          AppActions.dialog();
        }).error(function(err, req) {
          console.log("Error ending game.", err, req);
          AppActions.dialog(self._(err));
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
          self._("Are you really sure you want to reset the game series? This will lose the current scores."),
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
          AppActions.dialog(self._(err));
        });
      };

      AppActions.dialog(self._("Reset game series and restart?"), {cancel: true, onclose: confirm});
    },


    /** Carries out game action: look at own hand. */
    onLookAtHand: function() {
      var self = this;
      var data = {action: "look", fk_table: self.table.id};

      Data.query({url: "actions", data: data}).error(function(err, req) {
        console.log("Error looking at hand.", err, req);
        AppActions.dialog(self._(err));
      });
    },


    /** Handler for showing game template description. */
    onShowDescription: function() {
      var self = this;

      var dom = Util.createElement("div", {"class": "text"}, markdown(self.template.description));
      AppActions.dialog(self.template.name, {dom: dom});
    },


    /** Shows player's trick, last if game underway. */
    onShowPlayerTrick: function(player, index) {
      var self = this;

      var any = ("ended" == self.game.status);
      if (any) {
        var text = self._("Player '{0}' trick #{1}:", self.getName(player), index + 1);
        var trick = player.tricks[index];
      } else {
        var text = self._("Player '{0}' last trick:", self.getName(player));
        var trick = player.tricks[player.tricks.length - 1];
      };

      var cards = trick.map(function(move) {
        return Util.createElement("div", {"class": "move"}, [
          Util.createElement("div", {"class": "name"}, self._(self.getName(move))),
        ].concat(move.cards.map(function(card) {
            return Cardery.tag(card, true);
          })).concat([
            self.getMoveSpecial(move) ? 
            Util.createElement("div", {"class": "special"}, self._(self.getMoveSpecial(move))) :
            null
          ]).filter(Boolean)
        );
      });

      AppActions.dialog(text, {dom: Util.createElement("div", {"class": "trick"}, [
        Util.createElement("div", {"class": "prev"},
          any && index ? Util.createElement("button", {"onclick": self.onShowPlayerTrick.bind(self, player, index-1), "title": self._("Show previous")}, "<") : "",
        ),
        Util.createElement("div", {"class": "moves"}, cards),
        Util.createElement("div", {"class": "next"},
          any && (index < player.tricks.length - 1) ? Util.createElement("button", {"onclick": self.onShowPlayerTrick.bind(self, player, index+1), "title": self._("Show next")}, ">") : "",
        ),
      ])});
    },


    /** Shows last discards. */
    onShowDiscards: function(index) {
      var self = this;

      if (index == null) index = self.game.discards.length - 1;
      var discard = Util.get(self.game.discards, index);
      if (!discard) return;

      var cards = discard.map(function(move) {
        if (!move.cards) return "";
        return Util.createElement("div", {"class": "move"}, [
          Util.createElement("div", {"class": "name"}, self._(self.getName(move))),
          Util.createElement("div", {"class": "cards"}, move.cards.map(function(card) {
            return Util.createElement("div", {"class": "card"}, Cardery.tag(card, true));
          }))
        ]);
      }).filter(Boolean);

      var any = ("ended" == self.game.status);
      AppActions.dialog(self._("Discards #{0}:", index + 1), {dom: Util.createElement("div", {"class": "discard"}, [
        Util.createElement("div", {"class": "prev"},
          any && index ? Util.createElement("button", {"onclick": self.onShowDiscards.bind(self, index-1), "title": self._("Show previous")}, "<") : "",
        ),
        Util.createElement("div", {"class": "moves"}, cards),
        Util.createElement("div", {"class": "next"},
          any && (index < self.game.discards.length - 1) ? Util.createElement("button", {"onclick": self.onShowDiscards.bind(self, index+1), "title": self._("Show next")}, ">") : "",
        ),
      ])});
    },


    /** Carries out game action: make a bid. */
    onBid: function(nopass, evt) {
      var self = this;
      var bid = nopass ? Util.clone(self.move) : {pass: true};
      delete bid.__touched;
      if (nopass && self.blindable) bid.blind = true;
      var data = {action: "bid", fk_table: self.table.id, data: bid};

      evt.target.disabled = true;
      Data.query({url: "actions", data: data}).success(function() {
        Vue.set(self.game, "fk_player", null);
        self.move = {};
      }).error(function(err, req) {
        console.log("Error making bid.", err, req);
        AppActions.dialog(self._(err));
      }).complete(function() {
        evt.target.disabled = false;
      });
    },


    /** Carries out game action: make a move. */
    onMove: function(nopass, evt) {
      var self = this;
      var move = nopass ? Util.clone(self.move) : {pass: true};
      delete move.__touched;
      var data = {action: "move", fk_table: self.table.id, data: move};

      evt.target.disabled = true;
      Data.query({url: "actions", data: data}).success(function() {
        Vue.set(self.game, "fk_player", null); // Get immediate UI update
        if (!self.game.trick.some(function(x) { return x.fk_player; })) // Avoid previous trick flicker
          Vue.set(self.game, "tricks", self.game.tricks.concat([[Util.merge(move, {"fk_player": self.player.id})]]));
        self.move = {};
      }).error(function(err, req) {
        console.log("Error making move.", err, req);
        AppActions.dialog(self._(err));
      }).complete(function() {
        evt.target.disabled = false;
      });
    },


    /** Carries out game action: make a retreat. */
    onRetreat: function(evt) {
      var self = this;
      evt.target.disabled = true;

      var move = {retreat: true};
      var data = {action: "retreat", fk_table: self.table.id, data: move};

      AppActions.dialog(self._("Retreat and take penalty?"), {cancel: true, onclose: function(result) {
        if (!result) return evt.target.disabled = false;

        Data.query({url: "actions", data: data}).success(function() {
          Vue.set(self.game, "fk_player", null); // Get immediate UI update
          if (self.game.trick.some(function(x) { return x.fk_player; })) // Avoid previous trick flicker
            Vue.set(self.game, "tricks", self.game.tricks.concat([[Util.merge(move, {"fk_player": self.player.id})]]));
          self.move = {};
        }).error(function(err, req) {
          console.log("Error making retreat.", err, req);
          AppActions.dialog(self._(err));
        }).complete(function() {
          evt.target.disabled = false;
        });
      }});
    },


    /** Carries out game action: distribute cards to other players. */
    onDistribute: function(evt) {
      var self = this;
      var given = Util.clone(self.move);
      delete given.__touched;
      var data = {action: "distribute", fk_table: self.table.id, data: given};

      evt.target.disabled = true;
      Data.query({url: "actions", data: data}).success(function() {
        Vue.set(self.game, "fk_player", null);
        self.move = {};
      }).error(function(err, req) {
        console.log("Error distributing.", err, req);
        AppActions.dialog(self._(err));
      }).complete(function() {
        evt.target.disabled = false;
      });
    },


    onSell: function(evt) {
      var self = this;
      evt.target.disabled = true;

      var cards = Util.difference(self.player.hand, self.player.hand0);
      var dom = Util.createElement("div", {"class": "cards"}, cards.map(function(card) {
        return Util.createElement("div", {"class": "card"}, Cardery.tag(card, true));
      }));

      AppActions.dialog(self._("Put the talon cards on sale?"), {cancel: true, dom: dom, onclose: function(result) {
        if (!result) return evt.target.disabled = false;

        var data = {action: "sell", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).success(function() {
          Vue.set(self.game, "fk_player", null);
          Vue.set(self.game, "status", "bidding");
          self.hand = self.player.hand0;
        }).error(function(err, req) {
          console.log("Error putting on sale.", err, req);
          AppActions.dialog(self._(err));
        }).complete(function() {
          evt.target.disabled = false;
        });
      }});
    },


    onRedeal: function(evt) {
      var self = this;
      evt.target.disabled = true;

      var cards = Util.intersect(self.player.hand, Util.get(self.template, "opts", "redeal", "condition", "hand"));
      var dom = Util.createElement("div", {"class": "cards"}, cards.map(function(card) {
        return Util.createElement("div", {"class": "card"}, Cardery.tag(card, true));
      }));

      AppActions.dialog(self._("Demand redeal?"), {cancel: true, dom: dom, onclose: function(result) {
        if (!result) return evt.target.disabled = false;

        var data = {action: "redeal", fk_table: self.table.id};
        Data.query({url: "actions", data: data}).success(function() {
          Vue.set(self.game, "fk_player", null);
          Vue.set(self.game, "opts", Util.merge(self.game.opts, {redeal: true}));
          Vue.set(self.game, "bids", self.game.bids.concat({fk_player: self.player.id, redeal: true}));
          Vue.set(self.game, "status", "ended");
        }).error(function(err, req) {
          console.log("Error demanding redeal.", err, req);
          AppActions.dialog(self._(err));
        }).complete(function() {
          evt.target.disabled = false;
        });
      }});
    },


  },

});



/**
 * Modal dialog component.
 *
 * {hidden, text, html, dom, ok, cancel, modal, callback}
 */
var TEMPLATE_APPDIALOG = `

  <div v-if="!hidden" id="appdialog">

    <div class="shadow" v-on:click="!modal && onClose(false)"></div>
    <div class="dialog">
      <div class="content">
        <div v-if="text" class="text">{{ text }}</div>

        <div v-if="html" v-html="html" class="html"></div>

        <div v-if="dom" ref="dom" class="dom"></div>

        <slot></slot>
      </div>

      <div class="buttons">
        <button v-if="ok"     v-on:click="onClose(true)" ref="ok">{{ oklabel }}</button>
        <button v-if="cancel" v-on:click="onClose(false)">{{ cancellabel }}</button>
      </div>
    </div>

  </div>

`;

Vue.component("appdialog", {
  template: TEMPLATE_APPDIALOG,

  data: function() {
    return {
      hidden:             true,
      unsubscribe:        null, // AppAction listener unsubscriber
      text:                 "", // Text message
      html:                 "", // HTML content
      dom:                null, // DOM node content
      ok:                 true, // Whether dialog has ok-button
      cancel:            false, // Whether dialog has cancel-button
      modal:             false, // Whether dialog is uncloseable without buttons
      callback:           null, // function(ok) invoked on close
      oklabel:         _("OK"),
      cancellabel: _("Cancel"),
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
      if (!self.hidden) self.onClose(false);

      self.text = text;
      self.html   = (opts && "html"   in opts) ? opts.html   : "";
      self.dom    = (opts && "dom"    in opts) ? opts.dom    : null;
      self.ok     = (opts && "ok"     in opts) ? opts.ok     : true;
      self.cancel = (opts && "cancel" in opts) ? opts.cancel : false;
      self.modal  = (opts && "modal"  in opts) ? opts.modal :  false;
      self.oklabel     = opts && Util.isString(opts.ok)     ? opts.ok     : _("OK");
      self.cancellabel = opts && Util.isString(opts.cancel) ? opts.cancel : _("Cancel");
      self.callback = opts && opts.onclose;
      self.hidden = false;
      if (!self.text && !self.html) return self.onClose(false);

      if (self.dom) window.setTimeout(function() { self.$refs.dom.innerHTML = ""; self.$refs.dom.append(self.dom); });
      if (self.ok)  window.setTimeout(function() { self.$refs.ok.focus(); });
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
    "X":  "&#x1f0cf;", // Basic joker
    "XX": "&#x1f0cf;", "YX": "&#x1f0cf;", "ZX": "&#x1f0cf;", // Unique jokers
    " ":  "&#x1f0a0;", // Card back
    "D":  "&#x2666;",  // Diamonds suite
    "H":  "&#x2665;",  // Hearts suite
    "S":  "&#x2660;",  // Spades suite
    "C":  "&#x2663;",  // Clubs suite
  };
  self.NAMES = {
    "C": "clubs",
    "D": "diamonds",
    "H": "hearts",
    "S": "spades",
    "X": "joker",
    " ": "back",
  };
  self.FACEDOWN = " ";


  /** Returns glyph for card ("&#x1f0bd;" for "QH"). */
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

  /** Returns card suite name ("diamonds" for "*D") */
  self.name = function(card) {
    return self.NAMES[card[card.length - 1]];
  };

  /** Returns whether the card is face up. */
  self.faceup = function(card) {
    return self.FACEDOWN != card;
  };

};
