# GraphTL
Store and Analyze Twitter realtime customized Timeline. (v2 API use)

## Quick Start
1. create `.env` file on project root.
```sh
# from Twitter v2 API Authentication Tokens.
# https://developer.twitter.com/
BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAA...
# set 1 to fetch timeline from `/2/tweets/sample/stream` instead of `/2/tweets/search/stream`.
SAMPLE_STREAM=1
# DB_HOST=mysql
# DB_USER=root
# DB_PASSWORD=
```
2. Run `docker-compose -f docker-compose.yml up`
    - create database container. 
    - do `npm install`.
3. Run `docker-compose up -d` when `mysqld: ready for connections.` displayed.
    - merge `docker-compose.override.yml`.
    - create `phpmyadmin` and `metabase` container.
    - do `npm run start`.

## Tips
- Run RAW SQL query:
  - ```sh
    npm run typeorm query "SELECT JSON_EXTRACT(data, '$.data') FROM tweet WHERE JSON_EXTRACT(data, '$.data.lang') = 'ja';"
    ```
  - ```ts
    // MariaDB not support `->>` operator. use `JSON_EXTRACT` instead.
    await User.findOne({ where: "data->>'$.data.lang' = 'ja'" })
    ```
