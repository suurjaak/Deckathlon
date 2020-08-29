# -*- coding: utf-8 -*-
"""
Setup.py for Deckathlon.

@author      Erki Suurjaak
@created     18.04.2020
@modified    29.08.2020
------------------------------------------------------------------------------
"""
import setuptools

from deckathlon import conf

setuptools.setup(
    name=conf.Name,
    version=conf.Version,
    description="A card game website.",

    author="Erki Suurjaak",
    author_email="erki@lap.ee",
    platforms=["any"],

    install_requires=["beaker", "bottle", "polib", "pytz"],
    packages=setuptools.find_packages(),
    include_package_data=True, # Use MANIFEST.in for data files
    classifiers=[
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 2.7",
    ],

    long_description=
"""A card game website. Users can register an account, create their own game table, 
or join an existing one as player or spectator.

Comes installed with a few game templates, more can be added.
""",
)
