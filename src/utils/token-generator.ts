/**
 * OAuth 2.0 (PKCE) Auth Token Generator for using User Context.
 * @requires `.env` CLIENT_ID, CLIENT_SECRET
 * @see https://developer.twitter.com/en/portal/dashboard (set `http://localhost` as callback URL in your app.)
 * @see https://developer.twitter.com/en/docs/authentication/oauth-2-0/user-access-token
 */
import { createServer, Server } from 'http'
import { Socket } from 'node:net'
import * as process from 'process'
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

const base64URLEncode = (buffer: Buffer) => buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

/** set auth tokens to `process.env` and `.env` file. */
const exportAuthToken = ({ access_token, refresh_token }: TokenResponse) => {
    process.env.BEARER_TOKEN = access_token
    process.env.REFRESH_TOKEN = refresh_token
    /** merge new credentials and `.env` */
    const newEnv = Object.entries({
        ...Object.fromEntries(new Map(readFileSync('.env', { encoding: 'utf-8' }).split('\n').filter(Boolean).map(line => line.split('=', 2) as [string, string]))),
        BEARER_TOKEN: access_token,
        REFRESH_TOKEN: refresh_token
    }).map(([key, value]) => `${key}=${value}`).join('\n')
    writeFileSync('.env', newEnv)
}

let state: string
let code_verifier: string

/** @see https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code */
type scope =
    'tweet.read' |
    'tweet.write' |
    'tweet.moderate.write' |
    'users.read' |
    'follows.read' |
    'follows.write' |
    'offline.access' |
    'space.read' |
    'mute.read' |
    'mute.write' |
    'like.read' |
    'like.write' |
    'list.read' |
    'list.write' |
    'block.read' |
    'block.write' |
    'bookmark.read' |
    'bookmark.write'

export const tokenGenerator = async (scope: scope[]) => new Promise<TokenResponse>(async (resolve) => {
    const sockets: Socket[] = []
    const { server, token } = await new Promise<{ server: Server, token?: TokenResponse }>(resolve => {
        /** listen OAuth callback */
        const server = createServer(async (req, res) => {
            const params = new URL(req.url, `http://${req.headers.host}`).searchParams
            if (state === params.get('state')) {
                /** convert `code` in callback to bearer token. */
                const { data } = await axios.post<TokenResponse>('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
                    code: params.get('code'),
                    grant_type: 'authorization_code',
                    client_id: process.env.CLIENT_ID,
                    redirect_uri: 'http://localhost',
                    code_verifier
                }).toString(), {
                    auth: { username: process.env.CLIENT_ID, password: process.env.CLIENT_SECRET },
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                })
                res.writeHead(302, { Location: 'https://twitter.com' }).end(() => resolve({ server, token: data }))
            } else {
                res.writeHead(400).end()
            }
        })
        server.on('connection', socket => sockets.push(socket))
        server.listen(80, '0.0.0.0', async () => {
            /** generate authorize URL */
            state = Math.random().toString(36).substring(7) /** @todo time-based generate */
            code_verifier = base64URLEncode(randomBytes(32))
            const param = new URLSearchParams({
                response_type: 'code',
                client_id: process.env.CLIENT_ID,
                redirect_uri: 'http://localhost',
                /** @see https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code */
                scope: scope.join(' '), /** `refresh_token` requires `offline.access` scope. */
                state,
                code_challenge: base64URLEncode(createHash('sha256').update(code_verifier).digest()),
                code_challenge_method: 's256',
            }).toString()
            console.log(`\x1b[32mTwitter OAuth2 Authorization Request URL (Open in browser): \x1b[33mhttps://twitter.com/i/oauth2/authorize?${param}`)
        })
    })
    exportAuthToken(token)
    server.on('close', () => resolve(token))
    sockets.forEach(socket => socket.destroy())
    server.close()
})
