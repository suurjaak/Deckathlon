# -*- coding: utf-8 -*-
"""
WSGI or manual launch entrypoint.

------------------------------------------------------------------------------
This file is part of Deckathlon - card game website.
Released under the MIT License.

@author    Erki Suurjaak
@created   04.05.2020
@modified  19.05.2020
------------------------------------------------------------------------------
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.realpath(__file__)))

from deckathlon import index


app = index.init()

def application(environ, start_response):
    # Wrapper to set SCRIPT_NAME to actual mount point.
    environ["SCRIPT_NAME"] = os.path.dirname(environ["SCRIPT_NAME"])
    if environ['SCRIPT_NAME'] == "/":
        environ['SCRIPT_NAME'] = ""

    return app(environ,  start_response)


if "__main__" == __name__:
    index.run()
