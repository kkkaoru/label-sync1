#!/bin/bash

# JSONファイルのパスを指定
json_file="repositories.json"
# 環境変数からソースリポジトリを取得
SOURCE_REPO=${SOURCE_REPO:-"kkkaoru/label-sync1"}

# JSONファイルが存在するか確認
if [ ! -f "$json_file" ]; then
  echo "JSON file not found: $json_file"
  exit 1
fi

# jq を使って JSON から情報を抽出し、xargs で処理する
cat repositories.json | jq -r --arg src_repo "$SOURCE_REPO" '.[] | "gh label clone --force \($src_repo) -R \(.owner)/\(.name)"' | xargs -P 0 -I {} sh -c {}
