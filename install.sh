#!/bin/bash

# install homebrew
command -v brew >/dev/null 2>&1 || { echo >&2 "Installing Homebrew Now"; \
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"; }

# install ollama
brew install ollama
# serve ollama
ollama serve & ollama run mistral-nemo 2>&1 &
# install at least one llm

# install nvm
if [ -d "${HOME}/.nvm/.git" ]; then 
    echo "nvm installed"; 
else 
    echo "nvm not installed, installing nvm"; 
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
fi
# source nvm to get nvm command
source ~/.nvm/nvm.sh
# install currect node version
nvm install
npm install

# run the electron app
npm run dev:electron