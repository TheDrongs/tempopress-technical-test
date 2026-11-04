#!/bin/sh
set -eu

node dist/database/setup/cli.js setup
exec node dist/main.js
