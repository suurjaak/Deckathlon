# -*- coding: utf-8 -*-
"""
Internationalization support, uses Portable Object (.po) files. In case of
multiple translations for the same identifier, tries to narrow selection down
by filename and line number, if so defined in .po file:

    #: views/index.tpl:50
    msgid "Groups"
    msgstr "Grupid"

@author      Erki Suurjaak
@created     04.02.2015
@modified    03.01.2019
"""
import inspect
import logging
import os
import polib

logger = logging.getLogger(__name__)
FILETEMPLATES = ["%s.po"] # .po file path templates with language code placeholder
DEFAULTLANG = "en"        # Default language if none detected in translate call stack
RELOAD = False            # Whether to auto-reload dictionary on file change


def translate(text, *args, **kwargs):
    """
    Translates the text to current language, inserting positional and keyword 
    arguments, if any. Language is taken from "lang" variable in calling stack,
    falling back to default language, falling back to original text.

    @param   text  text as Unicode or UTF-8
    @return        translated text as Unicode
    """
    lang = filename = line = None
    frame = inspect.currentframe(1)
    try:
        lang = frame.f_locals.get("lang", DEFAULTLANG)
        filename, line = inspect.getframeinfo(frame, context=0)[:2]
        filename = filename.replace(os.path.dirname(__file__) + os.path.sep, "")
    finally:
        del frame # Required to avoid inspection reference cycle problems

    text = text if isinstance(text, unicode) else text.decode("utf-8")
    result = get_translation(lang, text, filename, line)
    if not (args or kwargs): return result
    for f in [lambda x: x % tuple(args), lambda x: x % kwargs,
              lambda x: x.format(*args, **kwargs)]:
        try: # Try to format translation with given arguments
            result = f(result)
            break # for f
        except (KeyError, IndexError, TypeError): pass
    return result


def get_all(lang=None):
    """
    Returns all translations defined for the language as {text: translation, },
    retaining only one for non-unique texts. Uses default language if none given.
    """
    lang = lang or DEFAULTLANG
    return dict((t, e[-1].msgstr) for t, e in (load_dictionary(lang) or {}).items())


def get_translation(lang, text, filename, line):
    """
    Returns the translated text, as defined in the Portable Object file for
    this language, or the original text if no translation found.
    """
    result, dictionary = text, load_dictionary(lang)
    if dictionary and text in dictionary:
        entries = dictionary[text]
        if len(entries) > 1: # Narrow selection to source file name
            entries = [e for e in entries
                       if any(x for x in e.occurrences if x[0] == filename)]
            if len(entries) > 1: # Narrow to closest line number in source file
                entries = list(sorted(entries, key=lambda e: min(abs(x[1] - line)
                                      for x in e.occurrences)))
        result = (entries[-1] if entries else dictionary[text][-1]).msgstr
    return result


def load_dictionary(lang, dictcache={}, timestamps={}):
    """Returns a cached language dictionary loaded from .po file, if any."""
    filenames = [x % lang for x in FILETEMPLATES]
    dictionary, pofiles = dictcache.get(lang), []
    if dictionary is not None and RELOAD:
        for filename in filenames:
            try:
                if os.path.getmtime(filename) != timestamps.get(filename):
                    dictionary = None
            except EnvironmentError:
                logger.warn("Error checking timestamp on translation file %s.",
                            filename, exc_info=True)

    if dictionary is None:
        for filename in filenames:
            try:
                if not os.path.isfile(filename): continue # for filename
                pofiles.append(polib.pofile(filename))
                timestamps[filename] = os.path.getmtime(filename)
            except EnvironmentError:
                logger.exception("Error on translation file %s.", filename)
    if pofiles:
        dictionary = {}
        to_base = os.path.basename # Avoid path prefixes: strip to basename
        to_int = lambda x: int(x) if x.isdigit() else x # Line numbers to int
        for e in (e for f in pofiles for e in f):
            e.occurrences = [(to_base(f), to_int(l)) for f, l in e.occurrences]
            dictionary.setdefault(e.msgid, []).append(e)
        dictcache[lang] = dictionary
    return dictionary


def init(defaultlang, filetemplate, reload=False):
    """Sets module configuration."""
    global DEFAULTLANG, FILETEMPLATES, RELOAD
    if isinstance(filetemplate, basestring): filetemplate = [filetemplate]
    DEFAULTLANG, FILETEMPLATES, RELOAD = defaultlang, filetemplate, reload
