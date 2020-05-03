%"""
Table page template.

@param   data            {datatype: [rows], }
@param   poll            ?{url: "poll", interval: millis}
@param   schema          {url, datatype: {url, key, fields: {name: {name, key, fk, fklabel}, }}, }
@param   translations    simple flat translations dictionary for current language

@author      Erki Suurjaak
@created     18.04.2020
@modified    02.05.2020
%"""
%from deckathlon import conf
%from deckathlon.lib import util
%WEBROOT = get_url("/")
<!DOCTYPE html>
<html>
<head>
  <title>{{ _(conf.Title) }} - {{ data["tables"][0]["name"] }}</title>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <link rel="icon" type="image/png" href="{{WEBROOT}}static/media/favicon.png" />
  <link rel="stylesheet" href="{{WEBROOT}}static/site.css" />
  <script src="{{WEBROOT}}static/vendor/vue.min.js"></script>
  <script src="{{WEBROOT}}static/util.js"></script>
  <script src="{{WEBROOT}}static/data.js"></script>
  <script src="{{WEBROOT}}static/ui.js"></script>
</head>
<body class="table">


<div id="main">
  <game_table ref="root"></game_table>
</div>


<script type="text/javascript">

  var translations = Util.jsonLoad('{{! util.json_dumps(translations, indent=None) }}');
  var typedata     = Util.jsonLoad('{{! util.json_dumps(data, indent=None) }}');
  var typeschema   = Util.jsonLoad('{{! util.json_dumps(schema, indent=None) }}');

  Locale.init(translations);
  Data.configure({schema: typeschema, data: typedata, rootURL: (typedata.settings || {}).dataURL});

  window.addEventListener("load", function() {
    vm = new Vue({el: "#main"});
%if get("poll"):
    Data.poll("{{! poll["url"] }}", {{ poll["interval"] }}, new function() {
      var dt_from = null;
      return function() {
        var dt = new Date(dt_from - 1000) || new Date(new Date() - {{ poll["interval"] * 2000 }});
        dt_from = new Date();
        return {dt_from: dt, dt_now: dt_from};
      };
    });
%end # if poll
  });

</script>

</body>
</html>
