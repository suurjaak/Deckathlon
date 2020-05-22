%"""
Table page template.

@param   data            {datatype: [rows], }
@param   lang            code
@param   langs           [code, ]
@param   poll            ?{url: "poll", interval: millis}
@param   schema          {url, datatype: {url, key, fields: {name: {name, key, fk, fklabel}, }}, }
@param   translations    simple flat translations dictionary for current language

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author      Erki Suurjaak
@created     18.04.2020
@modified    22.05.2020
%"""
%from deckathlon import conf
%from deckathlon.lib import util
%WEBROOT = get_url("/")
<!DOCTYPE html>
<html>
<head>
  <title>{{ _(conf.Title) }} - {{ data["tables"][0]["name"] }}</title>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <link rel="icon" type="image/x-icon" href="{{WEBROOT}}static/media/favicon.ico" />
  <link rel="stylesheet" href="{{WEBROOT}}static/site.css" />
  <script src="{{WEBROOT}}static/vendor/drawdown.js"></script>
  <script src="{{WEBROOT}}static/vendor/vue.min.js"></script>
  <script src="{{WEBROOT}}static/util.js"></script>
  <script src="{{WEBROOT}}static/data.js"></script>
  <script src="{{WEBROOT}}static/ui.js"></script>
</head>
<body class="table">


<div id="header">
  <page_header ref="header"></page_header>
</div>
<div id="main">
  <page_table ref="root"></page_table>
</div>
<div id="footer">
  <page_footer ref="footer"></page_footer>
</div>


<script type="text/javascript">

  var languages    = Util.jsonLoad({{! repr(util.json_dumps(langs,        indent=None)) }});
  var translations = Util.jsonLoad({{! repr(util.json_dumps(translations, indent=None)) }});
  var typedata     = Util.jsonLoad({{! repr(util.json_dumps(data,         indent=None)) }});
  var typeschema   = Util.jsonLoad({{! repr(util.json_dumps(schema,       indent=None)) }});

  typeschema.templates.transform = function(item) {
    var tt = item.i18n[{{! repr(lang) }}] || {};
    Object.keys(item).forEach(function(k) { var key = "template." + k; if (key in tt) item[k] = tt[key]; });
    return item;
  };

  Locale.init(translations);
  Data.configure({schema: typeschema, data: typedata, rootURL: (typedata.settings || {}).dataURL});

  window.addEventListener("load", function() {
    vmh = new Vue({el: "#header", data: {page: "table"}});
    vm  = new Vue({el: "#main"});
    vmf = new Vue({el: "#footer", data: {langs: languages}});
%if get("poll"):

    Data.poll("{{! poll["url"] }}", {{ poll["interval"] * 1000 }}, new function() {
      var dt_from = null;
      return function() {
        var dt = dt_from ? new Date(dt_from - 1000) : new Date(new Date() - {{ poll["interval"] * 2000 }});
        dt_from = new Date();
        return {dt_from: dt, dt_now: dt_from};
      };
    });
%end # if poll
  });

</script>

</body>
</html>
