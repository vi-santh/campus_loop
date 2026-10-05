#!/bin/bash
set -e
npm ci
npm run db:push
