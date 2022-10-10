import { Client, HttpMethod, ObjectLike, QueryParameters } from './client-generated'
import { createToken, updateToken, Scope } from './token-generator'
import axios, { AxiosError } from 'axios'
import { config } from 'dotenv'
config()

const scope: Scope[] = [
    // 'offline.access',
    // 'tweet.write',
    // 'tweet.moderate.write',
    // 'follows.write',
    // 'mute.write',
    // 'like.write',
    // 'list.write',
    // 'block.write',
    // 'bookmark.write',
    'tweet.read',
    'users.read',
    'follows.read',
    'space.read',
    'mute.read',
    'like.read',
    'list.read',
    'block.read',
    'bookmark.read',
]

/**
 * axios based Twitter client with interceptors.
 * @example (await client.get('/1.1/application/rate_limit_status.json')).data
 */
export const client = axios.create()
client.interceptors.request.use(request => {
    console.log(request.method.toUpperCase(), request.url, request.data)
    return request
})
client.interceptors.response.use(({ data }) => {
    return data
}, async ({ config, response: { statusText, data } }: AxiosError) => {
    if ('Unauthorized' === statusText) {
        const { CLIENT_ID, CLIENT_SECRET, BEARER_TOKEN, REFRESH_TOKEN } = process.env
        if (BEARER_TOKEN && REFRESH_TOKEN) {
            await updateToken(CLIENT_ID, REFRESH_TOKEN)
            return client.request(config)
        } else if (CLIENT_ID && CLIENT_SECRET) {
            const token = await createToken(CLIENT_ID, CLIENT_SECRET, scope)
            config.headers.Authorization = `Bearer ${token.access_token}`
            return client.request(config)
        }
    }
    return Promise.reject(JSON.stringify(data, null, 2))
})

/**
 * Twitter v2 API Client
 * @requires process.env.BEARER_TOKEN
 * @see https://developer.twitter.com/en/docs/twitter-api
 */
export const V2Client = new Client({
    request: async (
        httpMethod: HttpMethod,
        url: string,
        headers: ObjectLike | any,
        requestBody: ObjectLike | any,
        queryParameters: QueryParameters | undefined,
        options?: {
            retries?: number
            timeout?: number
            deadline?: number
        }
    ): Promise<any> => client({
        method: httpMethod,
        data: requestBody,
        headers: {
            ...headers,
            /** @see https://developer.twitter.com/ja/docs/authentication/oauth-2-0/application-only */
            Authorization: (_ => `Bearer ${_.includes('/stream') ? process.env.APP_BEARER_TOKEN : process.env.BEARER_TOKEN}`)(url)
        },
        params: queryParameters,
        paramsSerializer: (params) => Object.entries(params)
            .reduce((prev, [key, value]) => {
                if (typeof value !== 'object')
                    return [...prev, [key, value].join('=')]
                if (Array.isArray(value))
                    return [...prev, [key, value.join(',')].join('=')]
                if (Array.isArray(value['value']))
                    return [...prev, [key, value['value'].join(',')].join('=')]
                if (value['value'])
                    return [...prev, [key, value['value']].join('=')]
                return prev
            }, []).join('&'),
        responseType: (_ => _.endsWith('/stream') ? 'stream' : 'json')(url),
        timeout: options?.timeout,
        url,
    })
}, 'https://api.twitter.com')

export const deleteAllStreamRules = async () => {
    const { data } = await V2Client.getRules({ parameter: {} })
    if (data) {
        await V2Client.addOrDeleteRules({
            parameter: { dry_run: false },
            requestBody: {
                delete: { ids: data.map(rule => rule.id) }
            }
        })
        console.log(`${data.length} rules deleted.`)
    }
}

export const createMyTimelineStreamRules = async () => {
    const { data: { id, username } } = await V2Client.findMyUser({ parameter: {} })
    const { data } = await V2Client.usersIdFollowers({ parameter: { id, max_results: 1000 } })
    const { rules } = data
        .map(follower => `from:${follower.username}`)
        .reduce((prev, username) => {
            const index = Math.floor((prev.usernames.length + (` OR ${username} `.length)) / 512)
            prev.rules[index] = [...prev.rules[index] ?? [], username]
            return { rules: prev.rules, usernames: `${prev.usernames} OR ${username}` }
        }, { rules: [], usernames: '' })
    await Promise.all(rules.map(async (rule, index) => {
        const add = [{ value: rule.join(' OR '), tag: `${username}_${index + 1}` }]
        await V2Client.addOrDeleteRules({
            parameter: { dry_run: false },
            requestBody: {
                add
            }
        })
    }))
    console.log(`${rules.length}/25 rules created.`)
}
