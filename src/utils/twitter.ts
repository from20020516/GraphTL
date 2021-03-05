import { ApiClient, Client, HttpMethod, ObjectLike, QueryParameters, Params$searchStream, Schemas } from './client-generated'
import { IncomingMessage } from 'http'
import { Tweet } from '../entity/Tweet'
import { User } from '../entity/User'
import axios, { Method, AxiosError } from 'axios'
import GraphTLORM from './graphtl-orm'
import * as dotenv from 'dotenv'
dotenv.config()

/**
 * axios based Twitter client with interceptors.
 * @example (await client.get('/1.1/application/rate_limit_status.json')).data
 */
export const client = axios.create({
    headers: {
        Authorization: `Bearer ${process.env.BEARER_TOKEN}`
    },
    baseURL: 'https://api.twitter.com'
})
client.interceptors.request.use(request => {
    request.params &&= Object.fromEntries(Object.entries(request.params).map(array => {
        if (typeof array[1] !== 'object') return array
        if (Array.isArray(array[1])) return [array[0], array[1].join()]
        if (Array.isArray(array[1]['value'])) return [array[0], array[1]['value'].join()]
        if (array[1]['value']) return [array[0], array[1]['value']]
        return []
    }))
    return request
}, (error: AxiosError) => {
    console.error('ERR_REQUEST:', error.request)
})
client.interceptors.response.use((response) => {
    return response
}, (error: AxiosError) => {
    console.error('ERR_RESPONSE:', error.response?.status, error.response?.statusText)
})
interface RequestOption {
    retries?: number
    timeout?: number
    deadline?: number
}
const convertHttpMethodToAxiosMethod = (httpMethod: HttpMethod): Method => {
    const patterns: { [key in HttpMethod]: Method } = {
        GET: 'GET',
        PUT: 'PUT',
        POST: 'POST',
        DELETE: 'DELETE',
        OPTIONS: 'OPTIONS',
        HEAD: 'HEAD',
        PATCH: 'PATCH',
        TRACE: 'POST', // ?
    }
    return patterns[httpMethod]
}
const apiClientImpl: ApiClient<RequestOption> = {
    request: async (
        httpMethod: HttpMethod,
        url: string,
        headers: ObjectLike | any,
        requestBody: ObjectLike | any,
        queryParameters: QueryParameters | undefined,
        options?: RequestOption,
    ): Promise<any> => (await client({
        baseURL: url,
        method: convertHttpMethodToAxiosMethod(httpMethod),
        headers,
        params: queryParameters,
        data: requestBody,
        timeout: options?.timeout,
    })).data
}

/**
 * Twitter v2 API Client
 * @requires process.env.BEARER_TOKEN
 * @see https://developer.twitter.com/en/docs/twitter-api
 */
export const V2Client = new Client<RequestOption>(apiClientImpl, 'https://api.twitter.com')

/**
 * (v2): Streams tweets matching a user's active rule set.
 * @see https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/introduction
 * @see https://nodejs.org/api/stream.html
 * @example (await connectSearchStream(params)).on('data', async chunk => chunk.length > 2 && console.log(JSON.parse(chunk)))
 */
export const connectSearchStream = async (params: Params$searchStream): Promise<IncomingMessage> =>
    (await client.get(`/2/tweets/search/stream`, { responseType: 'stream', params: params.parameter })).data

interface IDeleteRulesRequest extends Schemas.DeleteRulesRequest { delete: { ids: string[] } }
/**
 * (v2):  Create rule set by specific user’s timeline.
 * @param username
 * @see https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/introduction
 */
export const createTimelineRulesByUsername = async (username: string) => {
    const user = await V2Client.findUserByUsername({
        parameter: {
            username,
            "tweet.fields": undefined,
            "user.fields": undefined,
            expansions: undefined,
        }
    })

    let rules: string[][] = [];
    (await V2Client.usersIdFollowers({ parameter: { id: user.data.id, max_results: 1000 } })).data
        .map(follower => `from:${follower.username}`)
        .reduce((usernames, username) => {
            const index = Math.floor((usernames.length + (` OR ${username} `.length)) / 512)
            rules[index] = [...rules[index] ?? [], username]
            return `${usernames} OR ${username} `
        })

    await Promise.all(rules.map(async (rule, tag) => {
        const add = [{ value: rule.join(' OR '), tag: String(tag) }]
        console.log(add)

        await V2Client.addOrDeleteRules({
            parameter: { dry_run: false },
            requestBody: {
                add
            }
        })
    }))
}

/**
* (v2): Delete all rule set.
*/
export const deleteAllRules = async () => {
    const ids = (await V2Client.getRules({ parameter: {} })).data?.map(rule => rule.id)
    console.log(ids)
    ids && await V2Client.addOrDeleteRules({
        parameter: { dry_run: false },
        requestBody: {
            delete: { ids }
        } as IDeleteRulesRequest,
    })
}

interface ITweet extends Schemas.Tweet { id_str: string }
/**
 * (v1): Get specific user's timeline.
 * @param username
 * @see https://developer.twitter.com/en/docs/twitter-api/v1/tweets/timelines/api-reference/get-statuses-user_timeline
 */
export const fetchTimeLine = async (username: string): Promise<ITweet[]> => {
    let tweets: ITweet[] = []
    do {
        try {
            const response = (await client.get<ITweet[]>('/1.1/statuses/user_timeline.json', {
                params: {
                    count: 200,
                    screen_name: username,
                    max_id: tweets.slice(-1)[0] ? (BigInt(tweets.slice(-1)[0].id_str) - BigInt(1)) : undefined,
                    trim_user: true,
                    exclude_replies: false,
                    include_rts: true,
                },
            })).data
            if (!response.length) break
            tweets.push(...response)
        } catch (error) {
            console.error(error)
            break
        } finally {
            console.log(tweets.length, username)
        }
    } while (3200 >= tweets.length || !tweets.length)

    return tweets
}

/**
 * Create Tweet/User record by a specific user on Database.
 * @param username
 */
export const createTimeline = async (username: string) => {
    await GraphTLORM.initialize()
    try {
        const tweets = await fetchTimeLine(username)
        const user = await User.findOneOrFail({ username }, { relations: ['tweets'] })
            .catch(async () => {
                const user = await V2Client.findUserByUsername({
                    parameter: {
                        username,
                        "tweet.fields": undefined,
                        "user.fields": ['created_at'],
                        expansions: undefined
                    }
                })
                return await User.create({
                    id_str: user.data.id,
                    username,
                    data: JSON.stringify(user),
                    created_at: user.data.created_at
                }).save()
            })

        await GraphTLORM
            .client
            .createQueryBuilder()
            .insert()
            .into(Tweet)
            .values(tweets.map(tweet => {
                return Tweet.create({
                    id_str: tweet.id_str,
                    user_id_str: user.id_str,
                    data: JSON.stringify(tweet),
                    created_at: tweet.created_at
                })
            }))
            /** https://github.com/typeorm/typeorm/commit/706d93fb05978a54243e57754c52d331a6aa063c */
            .orUpdate({ conflict_target: ['id_str'], overwrite: ['id', 'id_str'] })
            .execute()

    } catch (error) {
        console.error(error)
    }
}
