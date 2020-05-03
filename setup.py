# -*- coding: utf-8 -*-
"""
Setup.py for Deckathlon.

@author      Erki Suurjaak
@created     18.04.2020
@modified    03.05.2020
------------------------------------------------------------------------------
"""
import setuptools

from deckathlon import conf

setuptools.setup(
    name=conf.Name,
    version=conf.Version,
    description="Web application for playing card games.",

    author="Erki Suurjaak",
    author_email="erki@lap.ee",
    platforms=["any"],

    install_requires=["beaker", "bottle", "polib", "pytz"],
    packages=setuptools.find_packages(),
    include_package_data=True, # Use MANIFEST.in for data files
    classifiers=[
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 2.6",
        "Programming Language :: Python :: 2.7",
    ],

    long_description=
"""Web application for playing card games.

Users can login or register, create game templates, create game tables,
join existing tables to play or spectate.
""",
)
