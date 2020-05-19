%"""
Login page template.

@param   data            {datatype: [rows], }
@param   langs           [code, ]
@param   schema          {url, datatype: {url, key, fields: {name: {name, key, fk, fklabel}, }}, }
@param   translations    simple flat translations dictionary for current language

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author      Erki Suurjaak
@created     18.04.2020
@modified    19.05.2020
%"""
%from deckathlon import conf
%from deckathlon.lib import util
%WEBROOT = get_url("/")
<!DOCTYPE html>
<html>
<head>
  <title>{{_(conf.Title)}} - {{_("Login")}}</title>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <link rel="icon" type="image/x-icon" href="{{WEBROOT}}static/media/favicon.ico" />
  <link rel="stylesheet" href="{{WEBROOT}}static/site.css" />
  <script src="{{WEBROOT}}static/vendor/vue.min.js"></script>
  <script src="{{WEBROOT}}static/util.js"></script>
  <script src="{{WEBROOT}}static/data.js"></script>
  <script src="{{WEBROOT}}static/ui.js"></script>
</head>
<body class="login">


<div id="main">
  <login></login>
</div>
<div id="footer">
  <page_footer ref="footer"></page_footer>
</div>


<script type="text/javascript">

  var languages    = Util.jsonLoad({{! repr(util.json_dumps(langs,        indent=None)) }});
  var translations = Util.jsonLoad({{! repr(util.json_dumps(translations, indent=None)) }});
  var typedata     = Util.jsonLoad({{! repr(util.json_dumps(data,         indent=None)) }});
  var typeschema   = Util.jsonLoad({{! repr(util.json_dumps(schema,       indent=None)) }});

  Locale.init(translations);
  Data.configure({schema: typeschema, data: typedata, rootURL: (typedata.settings || {}).dataURL});

  window.addEventListener("load", function() {
    vm = new Vue({el: "#main"});
    vmf = new Vue({el: "#footer", data: {langs: languages}});
  });

</script>

</body>
</html>
