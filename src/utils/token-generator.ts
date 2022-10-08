/**
 * OAuth 2.0 (PKCE) Auth Token Generator for using User Context.
 * @requires `.env` CLIENT_ID, CLIENT_SECRET
 * @see https://developer.twitter.com/en/portal/dashboard (set `http://localhost` as callback URL in your app.)
 * @see https://developer.twitter.com/en/docs/authentication/oauth-2-0/user-access-token
 */
import { createServer } from 'http'
import { env, exit } from 'process'
import axios from 'axios'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'fs'
import { config } from 'dotenv'
config()

interface TokenResponse {
    token_type: 'bearer'
    expires_in: number
    access_token: string
    scope: string
    refresh_token?: string
}

let state: string
let code_verifier: string

/** listen OAuth callback */
const server = createServer(async (req, res) => {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams
    if (state === params.get('state')) {
        /** convert `code` in callback to bearer token. */
        const { data: { access_token, refresh_token, expires_in } } = await axios.post<TokenResponse>('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
            code: params.get('code'),
            grant_type: 'authorization_code',
            client_id: env.CLIENT_ID,
            redirect_uri: 'http://localhost',
            code_verifier
        }).toString(), {
            auth: { username: env.CLIENT_ID, password: env.CLIENT_SECRET },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        /** merge new credentials and `.env` */
        const newEnv = Object.entries({
            ...Object.fromEntries(new Map(readFileSync('.env', { encoding: 'utf-8' }).split('\n').filter(Boolean).map(line => line.split('=', 2) as [string, string]))),
            BEARER_TOKEN: access_token,
            REFRESH_TOKEN: refresh_token
        }).map(([key, value]) => `${key}=${value}`).join('\n')
        writeFileSync('.env', newEnv)
        console.log(`\x1b[32m.env updated. new $BEARER_TOKEN expires in ${expires_in} seconds.\x1b[0m`)

        res.writeHead(302, { Location: 'https://twitter.com' }).end(() => exit(0))
    } else {
        res.writeHead(400).end()
    }
})

const base64URLEncode = (buffer: Buffer) => buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

server.listen(80, '0.0.0.0', async () => {
    /** generate authorize URL */
    state = Math.random().toString(36).substring(7) /** @todo time-based generate */
    code_verifier = base64URLEncode(randomBytes(32))
    const param = new URLSearchParams({
        response_type: 'code',
        client_id: env.CLIENT_ID,
        redirect_uri: 'http://localhost',
        /** @see https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code */
        scope: 'tweet.read users.read follows.read like.read mute.read block.read bookmark.read', /** `refresh_token` requires `offline.access` scope. */
        state,
        code_challenge: base64URLEncode(createHash('sha256').update(code_verifier).digest()),
        code_challenge_method: 's256',
    }).toString()
    console.log(`\x1b[32mTwitter OAuth2 Authorization Request URL (Open in browser): \x1b[33mhttps://twitter.com/i/oauth2/authorize?${param}`)
})
