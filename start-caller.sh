#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s $NVM_DIR/nvm.sh ] && source $NVM_DIR/nvm.sh  # This loads nvm

node ./dist/src-srv/caller.js
